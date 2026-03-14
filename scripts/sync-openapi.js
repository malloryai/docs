#!/usr/bin/env node
/**
 * Sync OpenAPI spec from the production API into the docs site.
 *
 * Usage (from mintlify-docs repo root):
 *   node scripts/sync-openapi.js
 *
 * Environment:
 *   OPENAPI_URL  URL to fetch (default: https://api.mallory.ai/openapi.json)
 *
 * Does:
 *   1. Fetches the OpenAPI spec from the production API
 *   2. Validates it is valid JSON with an "openapi" field
 *   3. Writes it to openapi.json at the repo root
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const REPO_ROOT = path.resolve(__dirname, "..");
const OUT_PATH = path.join(REPO_ROOT, "openapi.json");
const OPENAPI_URL =
  process.env.OPENAPI_URL || "https://api.mallory.ai/openapi.json";

function fetch(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode} from ${url}`));
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

async function main() {
  console.log(`Fetching OpenAPI spec from ${OPENAPI_URL}...`);

  let body;
  try {
    body = await fetch(OPENAPI_URL);
  } catch (err) {
    console.error(`Failed to fetch: ${err.message}`);
    process.exit(1);
  }

  let spec;
  try {
    spec = JSON.parse(body);
  } catch {
    console.error("Response is not valid JSON.");
    process.exit(1);
  }

  if (!spec.openapi) {
    console.error('Response JSON missing "openapi" field — not a valid spec.');
    process.exit(1);
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(spec, null, 2) + "\n", "utf8");
  console.log(
    `Wrote openapi.json (OpenAPI ${spec.openapi}, ${Object.keys(spec.paths || {}).length} paths)`,
  );
}

main();
