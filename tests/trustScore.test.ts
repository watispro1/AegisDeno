import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateTrustProfile, fmtAge, scoreBar } from "../src/services/trustScore";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 0, 1);
const ago = (days: number) => new Date(NOW - days * DAY);

test("brand-new account with no tenure scores 0 and is High Risk", () => {
  const p = calculateTrustProfile({ accountCreatedAt: ago(0), joinedAt: null, warnings: 0, cases: 0, now: NOW });
  assert.equal(p.score, 0);
  assert.equal(p.tier, "🔴 High Risk");
  assert.equal(p.tenureLabel, "Unknown");
});

test("veteran clean member hits the 70-point maximum (25 + 25 + 20)", () => {
  const p = calculateTrustProfile({ accountCreatedAt: ago(1000), joinedAt: ago(800), warnings: 0, cases: 0, now: NOW });
  assert.deepEqual(p.breakdown, {
    accountAge: 25, serverTenure: 25, warningPenalty: -0, casePenalty: -0, bonus: 20, total: 70,
  });
  assert.equal(p.tier, "🔵 Established");
});

test("tenure bonus steps at 180 / 365 / 730 days", () => {
  const bonus = (days: number) =>
    calculateTrustProfile({ accountCreatedAt: ago(2000), joinedAt: ago(days), warnings: 0, cases: 0, now: NOW }).breakdown.bonus;
  assert.equal(bonus(179), 0);
  assert.equal(bonus(180), 6);
  assert.equal(bonus(365), 12);
  assert.equal(bonus(730), 20);
});

test("warning and case penalties are capped", () => {
  const p = calculateTrustProfile({ accountCreatedAt: ago(1000), joinedAt: ago(800), warnings: 100, cases: 100, now: NOW });
  assert.equal(p.breakdown.warningPenalty, -30);
  assert.equal(p.breakdown.casePenalty, -20);
  assert.equal(p.score, 20);
  assert.equal(p.tier, "🟠 Elevated Risk");
});

test("score never goes below 0", () => {
  const p = calculateTrustProfile({ accountCreatedAt: ago(1), joinedAt: ago(1), warnings: 10, cases: 10, now: NOW });
  assert.equal(p.score, 0);
});

test("fmtAge and scoreBar format as expected", () => {
  assert.equal(fmtAge(0), "< 1 day");
  assert.equal(fmtAge(5 * DAY), "5d");
  assert.equal(fmtAge(65 * DAY), "2mo");
  assert.equal(fmtAge(365 * DAY), "1y");
  assert.equal(fmtAge(430 * DAY), "1y 2mo");
  assert.equal(scoreBar(0), "░░░░░░░░░░");
  assert.equal(scoreBar(70), "███████░░░");
  assert.equal(scoreBar(100), "██████████");
});
