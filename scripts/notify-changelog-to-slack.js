#!/usr/bin/env node
/**
 * When the changelog page (changelog.mdx) is updated, post the latest section to
 * Slack (internal and community webhooks). Uses git history to decide if the
 * changelog changed, so no hash file is required.
 *
 * Intended to run in GitHub Actions on push. Pass REF_BEFORE and REF_AFTER (e.g.
 * github.event.before and github.sha) so the script can detect if changelog.mdx
 * changed in the push. Without those, compares HEAD^ to HEAD (last commit).
 *
 * Usage (from mintlify-docs repo root):
 *   node scripts/notify-changelog-to-slack.js
 *   node scripts/notify-changelog-to-slack.js --force   # post even if git says unchanged
 *
 * Environment:
 *   INTERNAL_SLACK_WEBHOOK   Incoming webhook URL for internal #changelog
 *   COMMUNITY_SLACK_WEBHOOK  Incoming webhook URL for community changelog
 *   REF_BEFORE               (optional) Git ref before push (e.g. github.event.before)
 *   REF_AFTER                (optional) Git ref after push (e.g. github.sha); used with REF_BEFORE
 *
 * Flow:
 *   1. If REF_BEFORE and REF_AFTER are set, check if changelog.mdx changed between those refs.
 *      Otherwise check if it changed between HEAD^ and HEAD.
 *   2. If unchanged (and not --force): exit 0. No post, no file to commit.
 *   3. If changed (or --force): extract latest timeline section, POST to both webhooks.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const REPO_ROOT = path.resolve(__dirname, "..");
const CHANGELOG_PATH = path.join(REPO_ROOT, "changelog.mdx");
const CHANGELOG_GIT_PATH = "changelog.mdx";
const INTERNAL_WEBHOOK = process.env.INTERNAL_SLACK_WEBHOOK;
const COMMUNITY_WEBHOOK = process.env.COMMUNITY_SLACK_WEBHOOK;
const REF_BEFORE = process.env.REF_BEFORE;
const REF_AFTER = process.env.REF_AFTER;

/**
 * Returns true if changelog.mdx was modified between refBefore and refAfter.
 */
function changelogChangedInRange(refBefore, refAfter) {
  try {
    execSync(
      `git diff --quiet ${refBefore} ${refAfter} -- ${CHANGELOG_GIT_PATH}`,
      { cwd: REPO_ROOT, stdio: "pipe" },
    );
    return false; // exit 0 = no diff
  } catch (e) {
    return true; // exit 1 = has diff
  }
}

function changelogChanged() {
  if (REF_BEFORE && REF_AFTER) {
    return changelogChangedInRange(REF_BEFORE, REF_AFTER);
  }
  try {
    execSync(`git rev-parse HEAD^`, { cwd: REPO_ROOT, stdio: "pipe" });
  } catch (e) {
    console.log(
      "No HEAD^ (e.g. first commit or shallow clone). Treating as changed.",
    );
    return true;
  }
  return changelogChangedInRange("HEAD^", "HEAD");
}

/**
 * Extract the "latest" update from the changelog for Slack.
 * Changelog is newest-first; the first #### date subheading under ## Timeline is the latest.
 */
function extractLatestSection(content) {
  const timelineStart = content.indexOf("## Timeline");
  if (timelineStart === -1) return null;

  const afterTimeline = content.slice(timelineStart);

  // Find the first #### subheading (e.g. #### February 20)
  const subheadingRe = /^#### .+$/gm;
  const firstMatch = subheadingRe.exec(afterTimeline);
  if (!firstMatch) return null;

  // Extract from the first #### to the next #### (or --- or end)
  const sectionStart = firstMatch.index;
  const nextMatch = subheadingRe.exec(afterTimeline);
  const sectionSep = afterTimeline.indexOf("\n---", sectionStart);

  // End at whichever comes first: next subheading, ---, or end of string
  let sectionEnd = afterTimeline.length;
  if (nextMatch) sectionEnd = Math.min(sectionEnd, nextMatch.index);
  if (sectionSep !== -1) sectionEnd = Math.min(sectionEnd, sectionSep);

  const raw = afterTimeline.slice(sectionStart, sectionEnd);

  // Strip frontmatter-style lines and normalize for Slack (shorten if huge)
  const lines = raw
    .split("\n")
    .filter((line) => !line.startsWith("---") && line.trim().length > 0);
  const text = lines.join("\n").trim();
  return text.length > 3000 ? text.slice(0, 2997) + "…" : text;
}

/**
 * Convert standard Markdown to Slack mrkdwn:
 *   - #### headings → *bold* lines
 *   - **bold** → *bold*
 *   - [text](url) → <url|text>
 */
function toSlackMrkdwn(md) {
  return md
    .replace(/^####\s+(.+)$/gm, "*$1*")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>");
}

function buildSlackPayload(latestText) {
  const slackText = toSlackMrkdwn(latestText);
  return {
    text: "Changelog updated",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":newspaper: *Changelog updated*\n\n" + slackText,
        },
      },
    ],
  };
}

async function postToSlack(webhookUrl, payload) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status} ${res.statusText}`);
  }
}

async function main() {
  const force = process.argv.includes("--force");

  if (!fs.existsSync(CHANGELOG_PATH)) {
    console.error("changelog.mdx not found at", CHANGELOG_PATH);
    process.exit(1);
  }

  if (!force && !changelogChanged()) {
    console.log("Changelog unchanged (git). Nothing to post.");
    process.exit(0);
  }

  if (!INTERNAL_WEBHOOK || !COMMUNITY_WEBHOOK) {
    console.error("Set INTERNAL_SLACK_WEBHOOK and COMMUNITY_SLACK_WEBHOOK");
    process.exit(1);
  }

  const content = fs.readFileSync(CHANGELOG_PATH, "utf8");
  const latestText = extractLatestSection(content);
  if (!latestText) {
    console.error("Could not extract latest changelog section.");
    process.exit(1);
  }

  const payload = buildSlackPayload(latestText);

  try {
    await postToSlack(INTERNAL_WEBHOOK, payload);
    await postToSlack(COMMUNITY_WEBHOOK, payload);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  console.log("Posted latest changelog to Slack.");
  process.exit(0);
}

main();
