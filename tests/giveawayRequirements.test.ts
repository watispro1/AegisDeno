/** Giveaway entry requirements: required role, minimum account age, minimum time in the server. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { giveawayEntryBlock, needsMemberLookup, requirementLines } from "../src/services/giveawayEntry";

const NOW = Date.parse("2026-11-02T15:00:00Z");
const DAY = 86_400_000;
const facts = (accountDays: number, memberDays: number | null, hasRole = true) => ({
  hasRequiredRole: hasRole,
  accountCreatedAt: new Date(NOW - accountDays * DAY),
  joinedAt: memberDays === null ? null : new Date(NOW - memberDays * DAY),
});

test("no requirements: everyone can enter and no member lookup is needed", () => {
  assert.equal(giveawayEntryBlock({}, facts(0, 0, false), NOW), null);
  assert.equal(needsMemberLookup({}, 1), false);
  assert.deepEqual(requirementLines({ minAccountAgeDays: 0, minMemberDays: 0 }), []);
});

test("required role is checked first", () => {
  assert.match(giveawayEntryBlock({ requiredRoleId: "42", minAccountAgeDays: 30 }, facts(1, 1, false), NOW)!, /<@&42> role/);
  assert.equal(needsMemberLookup({ requiredRoleId: "42" }, 1), true);
});

test("account age: blocks younger accounts and says how many days are left", () => {
  assert.match(giveawayEntryBlock({ minAccountAgeDays: 30 }, facts(27.5, 100), NOW)!, /at least \*\*30 days\*\* old to enter \(3 more days\)/);
  assert.match(giveawayEntryBlock({ minAccountAgeDays: 1 }, facts(0.99, 100), NOW)!, /\*\*1 day\*\* old .*\(1 more day\)/);
  assert.equal(giveawayEntryBlock({ minAccountAgeDays: 30 }, facts(30, 0), NOW), null);
  assert.equal(needsMemberLookup({ minAccountAgeDays: 30 }, 1), false, "account age comes from the user, not the member");
});

test("server age: blocks recent joins, and refuses when the join date is unknown", () => {
  assert.match(giveawayEntryBlock({ minMemberDays: 7 }, facts(400, 2), NOW)!, /at least \*\*7 days\*\* to enter \(5 more days\)/);
  assert.match(giveawayEntryBlock({ minMemberDays: 7 }, facts(400, null), NOW)!, /couldn't check/);
  assert.equal(giveawayEntryBlock({ minMemberDays: 7 }, facts(400, 7), NOW), null);
  assert.equal(needsMemberLookup({ minMemberDays: 7 }, 1), true);
  assert.equal(needsMemberLookup({}, 2), true, "booster bonus still needs the member");
});

test("embed lines list every requirement", () => {
  assert.deepEqual(requirementLines({ requiredRoleId: "42", minAccountAgeDays: 30, minMemberDays: 1 }), [
    "> ⚠️ **Required Role:** <@&42>",
    "> 🗓️ **Account age:** at least 30 days",
    "> 🏠 **In this server:** at least 1 day",
  ]);
});

test("/giveaway start exposes min_account_age and min_server_days with sane bounds", async () => {
  const { command } = await import("../src/commands/community/giveaway");
  const start = (command.data.toJSON() as { options: { name: string; options: { name: string; min_value?: number; max_value?: number }[] }[] }).options.find(o => o.name === "start")!;
  const age = start.options.find(o => o.name === "min_account_age")!;
  const member = start.options.find(o => o.name === "min_server_days")!;
  assert.deepEqual([age.min_value, age.max_value], [1, 3650]);
  assert.deepEqual([member.min_value, member.max_value], [1, 365]);
});
