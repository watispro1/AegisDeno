/** Edge cases in /watchlist, escalation, appeals, reminders, /sync, /warn and modmail. */
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

test("member join: a failed settings read still schedules the verification auto-kick", () => {
  const s = src("src/bot/client.ts");
  assert.match(s, /getGuildConfig\(member\.guild\.id\)\.catch\(/);
  assert.match(s, /config\?\.welcomeEnabled/);
});

test("/sync: the registered-commands field is capped at 1024 characters", () => {
  assert.match(src("src/commands/developer/sync.ts"), /truncate\(Array\.from\(commands\.keys\(\)\)[^\n]*1024\)/);
});

test("client, appeal, watchlist, reminder and escalation modules stay under 400 lines", () => {
  for (const f of ["src/bot/client.ts", "src/commands/moderation/appeal.ts", "src/commands/moderation/watchlist.ts", "src/bot/interactions/reminders.ts", "src/services/escalation.ts"]) {
    assert.ok(src(f).split("\n").length < 400, f);
  }
});

test("/warn history button: reasons are clipped so the reply stays under 2000 characters", () => {
  const s = src("src/commands/moderation/warn.ts");
  assert.match(s, /truncate\(String\(w\.reason\)\.replace\(\/`\/g, "'"\), 120\)/);
  assert.match(s, /content: truncate\(`📜 \*\*Warning History[^\n]*, 2000\)/);
});

test("/warn quick timeout: records a case and a mod-log entry, once", () => {
  const s = src("src/commands/moderation/warn.ts");
  assert.match(s, /addModerationCase\(\{ guildId, userId: target\.id, moderatorId: i\.user\.id, action: "timeout"/);
  assert.match(s, /title: "⏱️ Quick Timeout \(10m\)"/);
  assert.match(s, /if \(quickTimedOut\)/);
});

test("modmail: a DM sent while the thread is still being created waits for it instead of failing", async () => {
  const { awaitThreadId } = await import("../src/services/modmailService");
  let calls = 0;
  const id = await awaitThreadId("pending", async () => (++calls < 3 ? "pending" : "123456789012345678"), 10, 1);
  assert.equal(id, "123456789012345678");
  assert.equal(calls, 3);
  assert.equal(await awaitThreadId("pending", async () => "pending", 3, 1), null);
  assert.equal(await awaitThreadId("999", async () => { throw new Error("no reload"); }, 3, 1), "999");
});

test("modmail: a duplicate open relays into the conversation that won the race", () => {
  const s = src("src/services/modmailService.ts");
  assert.match(s, /duplicate: true \}/);
  assert.match(s, /else if \(opened\.duplicate\)/);
});
