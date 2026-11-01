/** Round 5 bug fixes, each with a regression test. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { planRestore } from "../src/services/scheduler";
import { parseModmailSettings } from "../src/web/dashboard/modmailValidation";
import { normalizeModmailConfig } from "../src/services/modmailLogic";

const H = 3_600_000, D = 24 * H;
const NOW = Date.parse("2026-11-01T12:00:00Z");

test("scheduler: a recurring task missed by more than a day resumes at its next slot instead of being lost", () => {
  const plan = planRestore({ type: "scheduled", executeAt: new Date(NOW - 3 * D - H), intervalMs: D }, NOW);
  assert.equal(plan.kind, "reschedule");
  const at = (plan as { at: Date }).at.getTime();
  assert.ok(at > NOW && at <= NOW + D, "next slot is within one interval");
  assert.equal((at - (NOW - 3 * D - H)) % D, 0, "keeps the original time of day");
});

test("scheduler: restore plans for future, recently overdue, state-checking and stale one-off tasks", () => {
  assert.equal(planRestore({ type: "reminder", executeAt: new Date(NOW + H), intervalMs: null }, NOW).kind, "schedule");
  assert.equal(planRestore({ type: "reminder", executeAt: new Date(NOW - H), intervalMs: null }, NOW).kind, "fire");
  assert.equal(planRestore({ type: "channel_unlock", executeAt: new Date(NOW - 5 * D), intervalMs: null }, NOW).kind, "fire");
  assert.equal(planRestore({ type: "staff_digest", executeAt: new Date(NOW - 5 * D), intervalMs: null }, NOW).kind, "fire");
  assert.equal(planRestore({ type: "reminder", executeAt: new Date(NOW - 2 * D), intervalMs: null }, NOW).kind, "drop");
  assert.equal(planRestore({ type: "scheduled", executeAt: new Date(NOW - H), intervalMs: D }, NOW).kind, "fire");
});

test("scheduler: boot loads recurring tasks and prunes stale one-offs", () => {
  const src = fs.readFileSync("src/services/scheduler.ts", "utf8");
  assert.match(src, /\{ intervalMs: \{ \$gt: 0 \} \}/);
  assert.match(fs.readFileSync("src/services/schedulerRunner.ts", "utf8"), /deleteStaleTasks\(/);
});

test("modmail dashboard: @everyone can't be the staff role (would make every member staff)", () => {
  const G = "800000000000000001";
  const ctx = { textChannelIds: new Set(["700000000000000001"]), roles: new Map([[G, { assignable: false }]]) };
  const r = parseModmailSettings({ enabled: "on", channelId: "700000000000000001", staffRoleId: G }, ctx, normalizeModmailConfig({}), G);
  assert.equal(r.ok, false);
  assert.match((r as { errors: Record<string, string> }).errors.staffRoleId, /@everyone/);
});

test("split files stay under 400 lines", () => {
  for (const f of ["src/commands/community/giveaway.ts", "src/services/giveawayService.ts", "src/services/schedulerRunner.ts", "src/web/dashboard/data.ts"]) {
    assert.ok(fs.readFileSync(f, "utf8").split("\n").length < 400, f);
  }
});
