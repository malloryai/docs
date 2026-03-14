#!/usr/bin/env node
/**
 * Top-level sync wrapper — runs all sync scripts in sequence.
 *
 * Usage (from mintlify-docs repo root):
 *   node scripts/sync.js
 *
 * Scripts executed:
 *   1. sync-openapi.js   – fetch OpenAPI spec from production API
 *   2. sync-export-docs.js – pull export format docs from core repo
 */

const { execSync } = require("child_process");
const path = require("path");

const SCRIPTS_DIR = __dirname;

const SYNC_SCRIPTS = [
  { file: "sync-openapi.js", label: "OpenAPI spec" },
  { file: "sync-export-docs.js", label: "Export format docs" },
];

let failed = false;

for (const { file, label } of SYNC_SCRIPTS) {
  const scriptPath = path.join(SCRIPTS_DIR, file);
  console.log(`\n--- Syncing: ${label} ---`);
  try {
    execSync(`node "${scriptPath}"`, { stdio: "inherit" });
  } catch {
    console.error(`Failed to sync: ${label}`);
    failed = true;
  }
}

console.log(failed ? "\nSync completed with errors." : "\nAll syncs complete.");
if (failed) process.exit(1);
