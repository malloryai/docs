#!/usr/bin/env node
/**
 * When the changelog page (changelog.mdx) is updated, compute its hash and, if it
 * changed, post the latest update to Slack (internal and community webhooks).
 *
 * Intended to run in GitHub Actions on pushes that touch changelog.mdx. The script
 * stores the last-seen content hash in CHANGELOG_HASH_FILE so subsequent runs do
 * not re-post the same content.
 *
 * Usage (from mintlify-docs repo root):
 *   node scripts/notify-changelog-to-slack.js
 *   node scripts/notify-changelog-to-slack.js --force   # post even if hash unchanged
 *
 * Environment:
 *   INTERNAL_SLACK_WEBHOOK   Incoming webhook URL for internal #changelog
 *   COMMUNITY_SLACK_WEBHOOK   Incoming webhook URL for community changelog
 *   CHANGELOG_HASH_FILE                 Path to file storing last hash (default: scripts/.changelog-hash)
 *
 * Flow:
 *   1. Read changelog.mdx and compute SHA-256 hash.
 *   2. Read stored hash from CHANGELOG_HASH_FILE (if present).
 *   3. If hash changed (or --force): extract the latest timeline section, format as
 *      Slack message, POST to both webhooks, write new hash to CHANGELOG_HASH_FILE.
 *   4. Exit 0 if no action or success; exit 1 on error.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPO_ROOT = path.resolve(__dirname, "..");
const CHANGELOG_PATH = path.join(REPO_ROOT, "changelog.mdx");
const HASH_FILE =
  process.env.CHANGELOG_HASH_FILE ||
  path.join(REPO_ROOT, "scripts", ".changelog-hash");
const INTERNAL_WEBHOOK = process.env.INTERNAL_SLACK_WEBHOOK;
const COMMUNITY_WEBHOOK = process.env.COMMUNITY_SLACK_WEBHOOK;

function computeHash(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function readStoredHash() {
  try {
    return fs.readFileSync(HASH_FILE, "utf8").trim();
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

function writeStoredHash(hash) {
  fs.writeFileSync(HASH_FILE, hash + "\n", "utf8");
}

/**
 * Extract the "latest" update from the changelog for Slack.
 * Changelog is newest-first; the first ### Month YYYY under ## Timeline is the latest.
 */
function extractLatestSection(content) {
  const timelineStart = content.indexOf("## Timeline");
  if (timelineStart === -1) return null;

  const afterTimeline = content.slice(timelineStart);
  // First ### month heading = newest section (e.g. ### February 2026)
  const monthHeadingRe =
    /^### (January|February|March|April|May|June|July|August|September|October|November|December) \d{4}/gm;
  const firstMatch = monthHeadingRe.exec(afterTimeline);
  if (!firstMatch) return null;

  const sectionStart = firstMatch.index;
  const sectionEnd = afterTimeline.indexOf("\n---", sectionStart);
  const raw =
    sectionEnd === -1
      ? afterTimeline.slice(sectionStart)
      : afterTimeline.slice(sectionStart, sectionEnd);

  // Strip frontmatter-style lines and normalize for Slack (shorten if huge)
  const lines = raw
    .split("\n")
    .filter((line) => !line.startsWith("---") && line.trim().length > 0);
  const text = lines.join("\n").trim();
  return text.length > 3000 ? text.slice(0, 2997) + "…" : text;
}

function buildSlackPayload(latestText) {
  return {
    text: "Changelog updated",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Changelog updated*\n\nLatest section:\n\n" + latestText,
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

  const content = fs.readFileSync(CHANGELOG_PATH, "utf8");
  const currentHash = computeHash(content);
  const storedHash = readStoredHash();

  if (!force && storedHash === currentHash) {
    console.log("Changelog unchanged (hash match). Nothing to post.");
    process.exit(0);
  }

  if (!INTERNAL_WEBHOOK || !COMMUNITY_WEBHOOK) {
    console.error("Set INTERNAL_SLACK_WEBHOOK and COMMUNITY_SLACK_WEBHOOK");
    process.exit(1);
  }

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

  writeStoredHash(currentHash);
  console.log("Posted latest changelog to Slack and updated stored hash.");
  process.exit(0);
}

main();
