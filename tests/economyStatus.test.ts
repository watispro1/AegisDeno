import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ECONOMY_CONFIG, normalizeEconomyConfig } from "../src/services/economyLogic";
import { betPrompt, needsBetConfirmation, nextDailyAmount, rankLine, streakDeadline, streakLine } from "../src/services/economyStatus";

const H = 3_600_000;
const cfg = normalizeEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, dailyCooldownHours: 24, dailyAmount: 100, dailyStreakBonus: 10, dailyStreakCapDays: 7, payConfirmThreshold: 1000 });

test("streak deadline is two cooldowns after the last claim; none when lost or never started", () => {
  const last = new Date(0);
  assert.equal(streakDeadline(last, 3, 10 * H, cfg), 48 * H);
  assert.equal(streakDeadline(last, 3, 49 * H, cfg), null);
  assert.equal(streakDeadline(last, 0, H, cfg), null);
  assert.equal(streakDeadline(null, 3, H, cfg), null);
  assert.match(streakLine(last, 3, 10 * H, cfg), /^🔥 3 days · claim <t:172800:R>/);
  assert.match(streakLine(last, 3, 49 * H, cfg), /ended/);
  assert.equal(streakLine(null, 0, 0, cfg), "—");
});

test("next daily pays the streak bonus it would get when ready", () => {
  assert.equal(nextDailyAmount(null, 0, 0, cfg), 100, "first claim");
  assert.equal(nextDailyAmount(new Date(0), 3, H, cfg), 130, "on cooldown: priced at the ready time (streak 4)");
  assert.equal(nextDailyAmount(new Date(0), 3, 30 * H, cfg), 130, "ready now");
  assert.equal(nextDailyAmount(new Date(0), 3, 60 * H, cfg), 100, "streak already lost");
  assert.equal(nextDailyAmount(new Date(0), 50, H, cfg), 170, "bonus capped");
});

test("big bets ask first: at least half the wallet and at least the threshold; threshold 0 turns it off", () => {
  assert.equal(needsBetConfirmation(1000, 2000, cfg), true);
  assert.equal(needsBetConfirmation(1000, 2001, cfg), false, "under half the wallet");
  assert.equal(needsBetConfirmation(999, 999, cfg), false, "under the threshold");
  assert.equal(needsBetConfirmation(5000, 5000, normalizeEconomyConfig({ ...cfg, payConfirmThreshold: 0 })), false);
  assert.equal(betPrompt(cfg, 1000, 2000), "Bet **🪙 1,000 coins**? That's 50% of your wallet (🪙 2,000 coins).");
});

test("rank line", () => {
  assert.equal(rankLine(null), null);
  assert.equal(rankLine({ rank: 1200, total: 5000, value: 1 }), "#1,200 of 5,000");
});
