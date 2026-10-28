import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_TIMEOUT_MS,
  nextTimerDelay,
  encodePersonalReminder,
  decodePersonalReminder,
  encodeChannelUnlock,
  decodeChannelUnlock,
  reminderRepeatIntervalMs,
  reminderSnoozeCustomId,
  parseReminderSnoozeCustomId,
  SNOOZE_OPTIONS_MINUTES,
} from "../src/services/timedActions";

const DAY = 86_400_000;

test("nextTimerDelay fires immediately for overdue tasks", () => {
  assert.deepEqual(nextTimerDelay(1_000, 5_000), { waitMs: 0, final: true });
});

test("nextTimerDelay waits the exact remaining time under the cap", () => {
  assert.deepEqual(nextTimerDelay(10 * DAY, 0), { waitMs: 10 * DAY, final: true });
  assert.deepEqual(nextTimerDelay(MAX_TIMEOUT_MS, 0), { waitMs: MAX_TIMEOUT_MS, final: true });
});

test("nextTimerDelay chunks delays beyond Node's ~24.8 day timer limit", () => {
  const r = nextTimerDelay(365 * DAY, 0);
  assert.equal(r.final, false);
  assert.equal(r.waitMs, MAX_TIMEOUT_MS);
  // Walking the chunks always reaches a final tick at the due time.
  let now = 0;
  let ticks = 0;
  for (;;) {
    const step = nextTimerDelay(365 * DAY, now);
    now += step.waitMs;
    ticks++;
    if (step.final) break;
  }
  assert.equal(now, 365 * DAY);
  assert.ok(ticks > 1 && ticks < 20);
});

test("personal reminder payload round-trips", () => {
  const payload = { text: "Check appeals", inChannel: true, sourceName: "Guild", setAt: 123 };
  assert.deepEqual(decodePersonalReminder(encodePersonalReminder(payload)), payload);
});

test("personal reminder decode rejects garbage", () => {
  assert.equal(decodePersonalReminder("not json"), null);
  assert.equal(decodePersonalReminder("{}"), null);
  assert.equal(decodePersonalReminder('{"text":""}'), null);
});

test("channel unlock payload round-trips and degrades safely", () => {
  const payload = { moderatorTag: "mod#0001", durationMinutes: 15 };
  assert.deepEqual(decodeChannelUnlock(encodeChannelUnlock(payload)), payload);
  // An unreadable payload must still allow the unlock to run.
  assert.deepEqual(decodeChannelUnlock("garbage"), { moderatorTag: "Unknown", durationMinutes: 0 });
});

test("repeating reminder payload round-trips; one-off stays without repeat", () => {
  const repeating = { text: "Stand-up", inChannel: false, sourceName: "Guild", setAt: 1, repeat: "weekly" as const };
  assert.deepEqual(decodePersonalReminder(encodePersonalReminder(repeating)), repeating);
  const once = decodePersonalReminder(encodePersonalReminder({ text: "x", inChannel: false, sourceName: "G", setAt: 1 }));
  assert.equal(once && "repeat" in once, false);
  assert.equal(decodePersonalReminder('{"text":"x","repeat":"hourly"}')?.repeat, undefined);
});

test("reminder repeat intervals", () => {
  assert.equal(reminderRepeatIntervalMs("daily"), DAY);
  assert.equal(reminderRepeatIntervalMs("weekly"), 7 * DAY);
  assert.equal(reminderRepeatIntervalMs("none"), null);
  assert.equal(reminderRepeatIntervalMs(undefined), null);
});

test("snooze custom ids round-trip and only accept offered lengths", () => {
  for (const min of SNOOZE_OPTIONS_MINUTES) {
    assert.deepEqual(parseReminderSnoozeCustomId(reminderSnoozeCustomId("123456789012345678", min)), { userId: "123456789012345678", minutes: min });
  }
  assert.equal(parseReminderSnoozeCustomId("remindsnooze_123_5"), null);
  assert.equal(parseReminderSnoozeCustomId("remindsnooze_abc_10"), null);
  assert.ok(reminderSnoozeCustomId("123456789012345678", 60).length <= 100);
});
