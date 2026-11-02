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
  // The regexes below assume LF; git checks the file out as CRLF on Windows.
  return fs.readFileSync(SERVER_DOC, "utf8").replace(/\r\n/g, "\n");
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

/** The §5 topic blocks: a `#channel` label line followed by a ```text fence. */
function topicBlocks(): { channel: string; topic: string }[] {
  const text = readDoc();
  const section = text.slice(text.indexOf("## 5. Channel Reference"), text.indexOf("## 6. Channel Permissions"));
  return [...section.matchAll(/^`(#[a-z0-9-]+)`\n```text\n([^]*?)\n```/gm)].map((m) => ({ channel: m[1], topic: m[2] }));
}

test("server.md §5: every reference channel has a paste-ready topic under Discord's 1024-character limit", () => {
  const text = readDoc();
  const section = text.slice(text.indexOf("## 5. Channel Reference"), text.indexOf("## 6. Channel Permissions"));
  const rows = [...section.matchAll(/^\| `(#[a-z0-9-]+)`/gm)].map((m) => m[1]);
  const topics = new Map(topicBlocks().map((t) => [t.channel, t.topic]));
  assert.ok(rows.length >= 28, `expected the full channel list, found ${rows.length}`);
  for (const channel of rows) {
    const topic = topics.get(channel);
    assert.ok(topic, `${channel} has no topic block`);
    assert.ok(topic.length <= 1024, `${channel} topic is ${topic.length} characters`);
    assert.ok(!/[*_`]{2}|\[[^\]]+\]\(/.test(topic), `${channel} topic should be plain text`);
  }
  for (const required of ["#modmail", "#staff-digest", "#status-and-incidents", "#mod-logs"]) {
    assert.ok(rows.includes(required), `${required} is documented`);
  }
});

test("server.md §5: topics name only real commands and real Aegis links", () => {
  const known = new Set<string>();
  for (const cmd of catalog) {
    known.add(cmd.name);
    for (const sub of cmd.subcommands ?? []) known.add(`${cmd.name} ${sub.name}`);
  }
  const allowedLinks = /^https:\/\/(aegisdeno\.fly\.dev\/(|status|features|commands|docs|dashboard|dashboard\/changelog|changelog|invite|security)|github\.com\/watispro1\/AegisDeno)$/;
  for (const { channel, topic } of topicBlocks()) {
    for (const m of topic.matchAll(/(?:^|[\s(])\/([a-z]+)(?: ([a-z]+))?/g)) {
      if (topic.slice(Math.max(0, m.index! - 30), m.index! + 1).includes("http")) continue;
      if (m[1] === "api") continue; // the public JSON paths, checked below
      const full = m[2] && known.has(`${m[1]} ${m[2]}`) ? `${m[1]} ${m[2]}` : m[1];
      assert.ok(known.has(full), `${channel}: /${m[1]}${m[2] ? ` ${m[2]}` : ""} is not a command`);
    }
    for (const link of topic.match(/https?:\/\/[^\s·,)]+/g) ?? []) {
      assert.match(link.replace(/[.]$/, ""), allowedLinks, `${channel}: unexpected link ${link}`);
    }
    for (const api of topic.match(/\/api\/[a-z]+/g) ?? []) assert.ok(["/api/status", "/api/commands"].includes(api), `${channel}: ${api}`);
  }
});
