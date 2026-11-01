/**
 * server.md is the operational manual for the official Discord server. Its
 * setup section contains copy-paste slash commands, so it drifts as soon as a
 * command or subcommand is renamed. These tests run every documented command
 * through the same validator the /commands page uses.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadCommands } from "../src/commands/loader";
import { buildCatalog, clearCatalogCache, type CommandInfo } from "../src/web/catalog";
import { checkExample, parseExample } from "../src/web/commandExamples";

const SERVER_DOC = path.join(__dirname, "..", "server.md");

function readDoc(): string {
  return fs.readFileSync(SERVER_DOC, "utf8");
}

/** Lines that are a slash command invocation, not a website path mentioned in prose. */
function documentedCommands(): { line: string; lineNumber: number }[] {
  return readDoc()
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter((entry) => /^\/[a-z][\w-]*(?:\s|$)/.test(entry.line));
}

let catalog: CommandInfo[] = [];

before(async () => {
  await loadCommands();
  clearCatalogCache();
  catalog = buildCatalog();
});

test("server.md: every documented slash command matches the live definitions", () => {
  const entries = documentedCommands();
  assert.ok(entries.length >= 30, `only found ${entries.length} command lines; the parser may be broken`);

  for (const { line, lineNumber } of entries) {
    assert.notEqual(parseExample(line), null, `server.md:${lineNumber} cannot parse: ${line}`);
    assert.equal(checkExample(line, catalog), null, `server.md:${lineNumber}: ${line}`);
  }
});

test("server.md: retired command forms stay retired", () => {
  const documented = documentedCommands().map((entry) => entry.line);
  for (const retired of [
    "/logging setup",
    "/logging categories",
    "/automod exempt role",
    "/automod exempt channel",
    "/starboard channel:",
    "/welcome message message:",
  ]) {
    assert.ok(!documented.some((line) => line.startsWith(retired)), `server.md still documents "${retired}"`);
  }
});

test("server.md: required reference sections and channels exist", () => {
  const text = readDoc();
  for (const heading of [
    "## 5. Channel Reference & Descriptions",
    "### 5.9 Channel Conventions",
    "### 5.10 What Aegis Posts Where",
    "### 7.1 Setup Order",
    "## 10. Pre-Launch QA Checklist",
  ]) {
    assert.ok(text.includes(heading), `missing "${heading}"`);
  }

  // #welcome has to exist because /welcome posts there and §7 wires it up.
  assert.ok(text.includes("👋・welcome"), "#welcome is in the channel map");
  assert.ok(text.includes("`#welcome`"), "#welcome has a channel reference row");
  assert.ok(text.includes("/welcome channel channel:#welcome"), "welcome target is configured");

  // Each public channel in the reference gets a pasteable topic.
  const referenceRows = (text.match(/^\| `#/gm) ?? []).length;
  assert.ok(referenceRows >= 20, `expected channel reference rows, found ${referenceRows}`);
});
