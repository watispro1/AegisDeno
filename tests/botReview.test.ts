/**
 * Regression tests for the bot-side review pass (src/bot, commands, services,
 * database, utils). Each test names the bug it pins down.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const BOT_DIRS = ["src/bot", "src/commands", "src/services", "src/database", "src/permissions", "src/utils"];

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsFiles(rel));
    else if (entry.name.endsWith(".ts")) out.push(rel);
  }
  return out;
}

test("findOneAndUpdate uses returnDocument, not the deprecated `new` option (mongoose 9 warns on every call)", () => {
  const offenders = BOT_DIRS.flatMap(tsFiles).filter((f) => /\bnew:\s*true\b/.test(fs.readFileSync(path.join(ROOT, f), "utf8")));
  assert.deepEqual(offenders, []);
});
