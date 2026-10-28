import { test } from "node:test";
import assert from "node:assert/strict";
import { ActivityBuffer, isFirstMessageOfDay, utcDay } from "../src/services/memberActivity";
import { calculateTrustProfile, explainTrust, messageVolumePoints, recencyPoints } from "../src/services/trustScore";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 28, 15);

test("utcDay and first-message-of-day", () => {
  assert.equal(utcDay(NOW), "2026-10-28");
  assert.equal(isFirstMessageOfDay(null, NOW), true);
  assert.equal(isFirstMessageOfDay("", NOW), true);
  assert.equal(isFirstMessageOfDay("2026-10-27", NOW), true);
  assert.equal(isFirstMessageOfDay("2026-10-28", NOW), false);
});

test("ActivityBuffer coalesces messages per member and drains", () => {
  const b = new ActivityBuffer();
  b.record("g", "u1", NOW);
  b.record("g", "u1", NOW + 5);
  b.record("g", "u1", NOW + 2);
  b.record("g", "u2", NOW);
  b.record("g2", "u1", NOW);
  assert.equal(b.size, 3);
  assert.deepEqual(b.peek("g", "u1"), { guildId: "g", userId: "u1", count: 3, lastAt: NOW + 5 });
  const drained = b.drain();
  assert.equal(drained.length, 3);
  assert.equal(b.size, 0);
});

test("ActivityBuffer.restore merges a failed flush with newer messages", () => {
  const b = new ActivityBuffer();
  b.record("g", "u", NOW);
  const failed = b.drain();
  b.record("g", "u", NOW + 10);
  b.restore(failed);
  assert.deepEqual(b.peek("g", "u"), { guildId: "g", userId: "u", count: 2, lastAt: NOW + 10 });
});

test("message activity points", () => {
  assert.deepEqual([0, 9, 10, 49, 50, 249, 250, 999, 1000].map(messageVolumePoints), [0, 0, 2, 2, 4, 4, 7, 7, 10]);
  assert.equal(recencyPoints(null, NOW), 0);
  assert.equal(recencyPoints(new Date(NOW - 2 * DAY), NOW), 5);
  assert.equal(recencyPoints(new Date(NOW - 20 * DAY), NOW), 2);
  assert.equal(recencyPoints(new Date(NOW - 40 * DAY), NOW), 0);
});

test("activity adds to the score and is explained", () => {
  const base = { accountCreatedAt: new Date(NOW - 1000 * DAY), joinedAt: new Date(NOW - 800 * DAY), warnings: 0, cases: 0, now: NOW };
  const quiet = calculateTrustProfile(base);
  const active = calculateTrustProfile({ ...base, messageCount: 1200, lastActiveAt: new Date(NOW - DAY) });
  assert.equal(quiet.breakdown.activity, 0);
  assert.equal(active.breakdown.activity, 15);
  assert.equal(active.score, 85);
  assert.equal(active.tier, "🟢 Trusted");
  assert.deepEqual(active.counts, { warnings: 0, cases: 0, messages: 1200 });

  const why = explainTrust(active);
  assert.equal(why.length, 5);
  assert.ok(why.some((l) => l.includes("1,200 message(s)")));
});

test("explainTrust reports uncapped warning/case counts", () => {
  const p = calculateTrustProfile({ accountCreatedAt: new Date(NOW - 10 * DAY), joinedAt: null, warnings: 9, cases: 7, now: NOW });
  const why = explainTrust(p);
  assert.ok(why.some((l) => l.startsWith("9 active warning(s): -30")));
  assert.ok(why.some((l) => l.startsWith("7 timeout/kick/ban case(s): -20")));
  assert.ok(why.some((l) => l.includes("Not in the server")));
});
