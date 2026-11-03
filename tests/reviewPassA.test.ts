/** Review pass A (v3.7.1): bug fixes, each with a regression test. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fitLines } from "../src/utils/safeText";

const src = (f: string) => fs.readFileSync(f, "utf8");

test("fitLines: keeps a long list under the 4096-character description limit and counts the rest", () => {
  const lines = Array.from({ length: 80 }, (_, i) => `**${i + 1}.** ${"x".repeat(90)}`);
  const out = fitLines(lines, 120);
  assert.ok(out.length <= 4096, `length ${out.length}`);
  assert.match(out, /…and \d+ more\.$/);
  const shown = out.split("\n").length - 1;
  assert.ok(out.endsWith(`…and ${120 - shown} more.`));
});

test("fitLines: a short list is joined unchanged", () => {
  assert.equal(fitLines(["a", "b"], 2), "a\nb");
  assert.equal(fitLines(["a", "b"], 5), "a\nb\n…and 3 more.");
});

test("/watchlist list caps the entries it renders and fits the description", () => {
  const s = src("src/commands/moderation/watchlist.ts");
  assert.match(s, /entries\.slice\(0, WATCHLIST_LIST_MAX\)/);
  assert.match(s, /setDescription\(fitLines\(lines, entries\.length\)\)/);
});

test("escalation: a timeout or kick for a member who already left is not reported as applied", () => {
  const s = src("src/services/escalation.ts");
  assert.match(s, /if \(!member && threshold\.action !== "ban"\) return \{ triggered: false \};/);
  assert.match(s, /bans\.create\(userId, \{ reason: auditReason\(reason\) \}\)/);
});

test("appeal submit: text is saved only while the appeal is still pending (atomic)", () => {
  const s = src("src/commands/moderation/appeal.ts");
  assert.doesNotMatch(s, /appeal\.save\(\)/);
  assert.match(s, /updateOne\(\s*\{ _id: appeal\._id, userId: interaction\.user\.id, status: "pending" \}/);
  assert.match(s, /InteractionCollectorError/);
});

test("reminder snooze: a double press is ignored while the first snooze is saved", async () => {
  const mod = await import("../src/bot/interactions/reminders");
  assert.ok(mod.snoozingMessages instanceof Set);
  const s = src("src/bot/interactions/reminders.ts");
  assert.match(s, /snoozingMessages\.has\(lockKey\)/);
  assert.match(s, /finally \{\s*snoozingMessages\.delete\(lockKey\);/);
});

test("member join: a failed settings read no longer skips the verification auto-kick", () => {
  const s = src("src/bot/client.ts");
  assert.match(s, /getGuildConfig\(member\.guild\.id\)\.catch\(/);
  assert.match(s, /config\?\.welcomeEnabled/);
});

test("/sync: the registered-commands field is capped at 1024 characters", () => {
  assert.match(src("src/commands/developer/sync.ts"), /truncate\(Array\.from\(commands\.keys\(\)\)[^\n]*1024\)/);
});

test("files touched in review pass A stay under 400 lines", () => {
  for (const f of ["src/bot/client.ts", "src/commands/moderation/appeal.ts", "src/commands/moderation/watchlist.ts", "src/bot/interactions/reminders.ts", "src/services/escalation.ts"]) {
    assert.ok(src(f).split("\n").length < 400, f);
  }
});
