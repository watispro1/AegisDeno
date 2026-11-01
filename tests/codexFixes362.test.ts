/**
 * Regression tests for the Codex review findings on PR #18 (dashboard
 * overhaul) and PR #19 (server setup guide).
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildEmbedFromSpec, fillEmbedSpec, embedLength, EMBED_LIMITS, type EmbedSpec } from "../src/services/embedSpec";
import { loadCommands } from "../src/commands/loader";
import { buildCatalog, clearCatalogCache, type CommandInfo } from "../src/web/catalog";

const base: EmbedSpec = { title: null, description: null, color: null, authorName: null, footerText: null, imageUrl: null, thumbnailUrl: null, fields: [] };
const values = { user: "<@1>", username: "someone", server: "S".repeat(100), memberCount: 5 };

test("PR #18: an embed near the limit stays under 6000 characters after {server} expands", () => {
  const spec: EmbedSpec = {
    ...base,
    title: "{server} ".repeat(20).slice(0, 200),
    description: "{server}".repeat(300),
    footerText: "{server} welcomes you".repeat(10),
    fields: Array.from({ length: 10 }, (_, i) => ({ name: `Field ${i} {server}`, value: "{server} ".repeat(30), inline: false })),
  };
  assert.ok(embedLength(spec) <= EMBED_LIMITS.total, "stored spec passes the pre-expansion check");
  const filled = fillEmbedSpec(spec, values);
  assert.ok(embedLength(filled) <= EMBED_LIMITS.total, `expanded embed is ${embedLength(filled)} characters`);
  assert.ok(filled.title, "the title survives trimming");
  // discord.js agrees: the built embed's total length is within Discord's aggregate limit.
  assert.ok(buildEmbedFromSpec(spec, values).length <= EMBED_LIMITS.total);
});

test("PR #18: trimming drops trailing fields before shortening the description", () => {
  const spec: EmbedSpec = {
    ...base,
    description: "Hi {server}",
    fields: Array.from({ length: 25 }, (_, i) => ({ name: `F${i}`, value: "{server}".repeat(3), inline: true })),
  };
  const filled = fillEmbedSpec(spec, { ...values, server: "X".repeat(240) });
  assert.ok(embedLength(filled) <= EMBED_LIMITS.total);
  assert.ok(filled.fields.length < 25, "some trailing fields were dropped");
  assert.equal(filled.description, "Hi " + "X".repeat(240), "description untouched while fields could absorb the overflow");
  assert.equal(filled.fields[0].name, "F0", "the first fields are kept");
});

test("PR #18: an embed that fits is unchanged by the total check", () => {
  const spec: EmbedSpec = { ...base, title: "Welcome {user}", description: "to {server}", fields: [{ name: "a", value: "b", inline: false }] };
  const filled = fillEmbedSpec(spec, values);
  assert.equal(filled.title, "Welcome <@1>");
  assert.equal(filled.description, `to ${values.server}`);
  assert.equal(filled.fields.length, 1);
});

test("PR #18: /autoresponder toggle checks the save before saying it worked", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "src/commands/autoresponder/autoresponder.ts"), "utf8");
  const toggle = src.slice(src.indexOf('subcommand === "toggle"'));
  assert.match(toggle, /const saved = await setAutoResponderEnabled\(/, "the result is kept");
  assert.ok(toggle.indexOf("if (!saved)") < toggle.indexOf("is now **"), "failure is reported before the success message");
});

/* ── PR #19: every slash command named inline in server.md is real ─────── */

let catalog: CommandInfo[] = [];
before(async () => {
  await loadCommands();
  clearCatalogCache();
  catalog = buildCatalog();
});

test("PR #19: inline `/command sub` references in server.md name registered commands and subcommands", () => {
  const doc = fs.readFileSync(path.join(__dirname, "..", "server.md"), "utf8");
  const problems: string[] = [];
  doc.split(/\r?\n/).forEach((line, i) => {
    // A sentence that says a form does not exist is allowed to name it.
    if (/There is no `/.test(line)) return;
    for (const m of line.matchAll(/`\/([a-z][a-z0-9_-]*)(?: ([a-z_][a-z0-9_-]*)(:?))?/g)) {
      const [, name, sub, colon] = m;
      const cmd = catalog.find(c => c.name === name);
      if (!cmd) { problems.push(`server.md:${i + 1} /${name} is not a command`); continue; }
      if (!sub || colon) continue;
      const subs = cmd.subcommands.flatMap(s => (s.group ? [s.group, s.name] : [s.name]));
      if (subs.length && !subs.includes(sub)) problems.push(`server.md:${i + 1} /${name} has no "${sub}" subcommand`);
    }
  });
  assert.deepEqual(problems, []);
});

test("PR #19: the setup guide no longer names /config preset or /logging setup", () => {
  const doc = fs.readFileSync(path.join(__dirname, "..", "server.md"), "utf8");
  assert.doesNotMatch(doc, /\/config preset/);
  assert.doesNotMatch(doc, /\/logging setup/);
});
