import { test } from "node:test";
import assert from "node:assert/strict";
import { findEscalationThreshold } from "../src/services/escalation";
import { normalizeThresholds } from "../src/services/configuration";

const thresholds = normalizeThresholds([
  { atWarnings: 3, action: "timeout", durationMinutes: 60 },
  { atWarnings: 5, action: "kick" },
  { atWarnings: 7, action: "ban" },
]);

test("threshold fires only on an exact warning count", () => {
  assert.equal(findEscalationThreshold(thresholds, 2), undefined);
  assert.equal(findEscalationThreshold(thresholds, 3)?.action, "timeout");
  assert.equal(findEscalationThreshold(thresholds, 4), undefined);
  assert.equal(findEscalationThreshold(thresholds, 5)?.action, "kick");
  assert.equal(findEscalationThreshold(thresholds, 7)?.action, "ban");
  assert.equal(findEscalationThreshold(thresholds, 8), undefined);
});

test("no thresholds means no escalation", () => {
  assert.equal(findEscalationThreshold([], 3), undefined);
});

test("normalizeThresholds drops invalid entries", () => {
  const out = normalizeThresholds([
    { atWarnings: 0, action: "ban" },          // below 1
    { atWarnings: 101, action: "ban" },        // above 100
    { atWarnings: 2.5, action: "kick" },       // not an integer
    { atWarnings: 3, action: "explode" },      // unknown action
    null,
    "nope",
    { atWarnings: 4, action: "kick" },
  ]);
  assert.deepEqual(out, [{ atWarnings: 4, action: "kick" }]);
});

test("normalizeThresholds keeps durations only for valid timeouts", () => {
  const out = normalizeThresholds([
    { atWarnings: 1, action: "timeout", durationMinutes: 30 },
    { atWarnings: 2, action: "timeout", durationMinutes: 0 },
    { atWarnings: 3, action: "timeout", durationMinutes: 28 * 24 * 60 + 1 },
    { atWarnings: 4, action: "kick", durationMinutes: 30 },
  ]);
  assert.deepEqual(out, [
    { atWarnings: 1, action: "timeout", durationMinutes: 30 },
    { atWarnings: 2, action: "timeout" },
    { atWarnings: 3, action: "timeout" },
    { atWarnings: 4, action: "kick" },
  ]);
});

test("normalizeThresholds caps the list at 20 and ignores non-arrays", () => {
  assert.deepEqual(normalizeThresholds("x"), []);
  const many = Array.from({ length: 30 }, (_, i) => ({ atWarnings: i + 1, action: "kick" }));
  assert.equal(normalizeThresholds(many).length, 20);
});
