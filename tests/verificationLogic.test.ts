import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateMathCaptcha,
  checkCaptchaAnswer,
  CaptchaStore,
  normalizeKickMinutes,
  encodeVerifyKick,
  decodeVerifyKick,
  MAX_KICK_UNVERIFIED_MINUTES,
} from "../src/services/verificationLogic";

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1_103_515_245 + 12_345) % 2_147_483_648;
    return s / 2_147_483_648;
  };
}

test("generated captchas have correct, non-negative answers", () => {
  const rng = seeded(42);
  for (let i = 0; i < 500; i++) {
    const c = generateMathCaptcha(rng);
    const m = /^(\d+) ([+\-×]) (\d+)$/.exec(c.question);
    assert.ok(m, c.question);
    const a = Number(m[1]), b = Number(m[3]);
    const expected = m[2] === "+" ? a + b : m[2] === "-" ? a - b : a * b;
    assert.equal(c.answer, expected);
    assert.ok(c.answer >= 0);
  }
});

test("checkCaptchaAnswer accepts only the whole number", () => {
  assert.equal(checkCaptchaAnswer(" 12 ", 12), true);
  assert.equal(checkCaptchaAnswer("12.0", 12), false);
  assert.equal(checkCaptchaAnswer("twelve", 12), false);
  assert.equal(checkCaptchaAnswer("", 12), false);
  assert.equal(checkCaptchaAnswer("13", 12), false);
});

test("captcha store: correct answer is single use", () => {
  const store = new CaptchaStore(1000, 3);
  store.issue("g", "u", 7, 0);
  assert.equal(store.check("g", "u", "7", 10), "ok");
  assert.equal(store.check("g", "u", "7", 20), "expired");
});

test("captcha store: expiry and per-user keys", () => {
  const store = new CaptchaStore(1000, 3);
  store.issue("g", "u", 7, 0);
  assert.equal(store.check("g", "other", "7", 10), "expired");
  assert.equal(store.check("g", "u", "7", 1000), "expired");
  assert.equal(store.size, 0);
});

test("captcha store: locks after max wrong attempts", () => {
  const store = new CaptchaStore(10_000, 2);
  store.issue("g", "u", 5, 0);
  assert.equal(store.check("g", "u", "4", 1), "wrong");
  assert.equal(store.check("g", "u", "4", 2), "locked");
  assert.equal(store.check("g", "u", "5", 3), "expired");
});

test("normalizeKickMinutes clamps; off by default", () => {
  assert.equal(normalizeKickMinutes(undefined), 0);
  assert.equal(normalizeKickMinutes(-1), 0);
  assert.equal(normalizeKickMinutes(30.9), 30);
  assert.equal(normalizeKickMinutes(1e9), MAX_KICK_UNVERIFIED_MINUTES);
});

test("verify kick payload round-trips", () => {
  assert.deepEqual(decodeVerifyKick(encodeVerifyKick({ userId: "123" })), { userId: "123" });
  assert.equal(decodeVerifyKick("[]"), null);
});
