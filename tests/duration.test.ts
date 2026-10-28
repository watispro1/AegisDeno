import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDuration, formatDuration } from "../src/utils/duration";

test("parseDuration handles every unit", () => {
  assert.equal(parseDuration("45s"), 45);
  assert.equal(parseDuration("30m"), 1800);
  assert.equal(parseDuration("2h"), 7200);
  assert.equal(parseDuration("1d"), 86400);
  assert.equal(parseDuration("1w"), 604800);
});

test("parseDuration is case-insensitive and tolerates whitespace", () => {
  assert.equal(parseDuration(" 2H "), 7200);
  assert.equal(parseDuration("10 m"), 600);
});

test("parseDuration rejects malformed input", () => {
  for (const bad of ["", "abc", "10", "m10", "1.5h", "-5m", "10y", "10 minutes"]) {
    assert.equal(parseDuration(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test("parseDuration rejects values that overflow safe integers", () => {
  assert.equal(parseDuration("99999999999999999999w"), null);
});

test("formatDuration produces compact labels", () => {
  assert.equal(formatDuration(45), "45s");
  assert.equal(formatDuration(300), "5m");
  assert.equal(formatDuration(330), "5m 30s");
  assert.equal(formatDuration(7200), "2h");
  assert.equal(formatDuration(172800), "2d");
  assert.equal(formatDuration(1209600), "2w");
});
