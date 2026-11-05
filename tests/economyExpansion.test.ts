import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ECONOMY_CONFIG, MAX_BALANCE, applyEconomySettings, dailyClaim, normalizeEconomyConfig, validateShopItem, type EconomyConfig,
} from "../src/services/economyLogic";
import {
  COINFLIP_RETURN_PERCENT, SLOT_PAIR_TENTHS, SLOT_SYMBOLS, SLOT_TRIPLE_TENTHS, SLOT_WEIGHTS, betRefusal, nextUtcMidnight,
  parseAmountOrAll, payRoomToday, payTax, payTenureRefusal, planDeposit, planWithdraw, playCoinflip, playSlots, rollCrime,
  sellPrice, slotReturnTenths, useRefusal, utcDay, type RandomInt, type SlotSymbol,
} from "../src/services/economyRules";
import { accountChange, accountFilter } from "../src/services/economyMongo";
import { guardsHold, withBounds, zeroAccount } from "../src/services/economyStore";

const G = "800000000000000001";
const A = "900000000000000001";
const HOUR = 3_600_000;
const on: EconomyConfig = { ...DEFAULT_ECONOMY_CONFIG, enabled: true };
/** randomInt that returns the given values in order (then the last one again). */
const seq = (...values: number[]): RandomInt => { let i = 0; return () => values[Math.min(i++, values.length - 1)]; };

test("new settings: conservative defaults, gambling off, bounds enforced, min/max pairs kept in order", () => {
  const c = normalizeEconomyConfig({});
  assert.equal(c.gamblingEnabled, false);
  assert.equal(c.crimeEnabled, true);
  assert.equal(c.dailyStreakCapDays, 7);
  assert.equal(c.payMinMemberHours, 24);
  assert.equal(c.payTaxPercent, 0);
  const junk = normalizeEconomyConfig({ gamblingEnabled: "true", crimeEnabled: false, payTaxPercent: 80, gambleMinBet: 500, gambleMaxBet: 10, crimeMin: 90, crimeMax: 5 });
  assert.equal(junk.gamblingEnabled, false, "only literal true turns gambling on");
  assert.equal(junk.crimeEnabled, false);
  assert.equal(junk.payTaxPercent, 0, "tax above 50% falls back");
  assert.equal(junk.gambleMaxBet, 500);
  assert.equal(junk.crimeMax, 90);
  const bad = applyEconomySettings(on, { gambleMinBet: 100, gambleMaxBet: 50, crimeSuccessPercent: 100, shopSellPercent: "91" });
  assert.ok(!bad.ok);
  if (!bad.ok) {
    assert.match(bad.errors.gambleMaxBet!, /at least the minimum bet/);
    assert.match(bad.errors.crimeSuccessPercent!, /5 to 95/);
    assert.ok(bad.errors.shopSellPercent);
  }
  const ok = applyEconomySettings(on, { gamblingEnabled: true, bankCap: "5000", weeklyAmount: 0 });
  assert.ok(ok.ok && ok.value.gamblingEnabled && ok.value.bankCap === 5000 && ok.value.weeklyAmount === 0);
});

test("streak: claim within two cooldowns keeps it; bonus capped by the configured days; 0 days = no bonus", () => {
  const cfg = { ...on, dailyStreakCapDays: 3 };
  const long = dailyClaim(new Date(0), 10, 30 * HOUR, cfg);
  assert.ok(long.ok && long.streak === 11 && long.amount === 100 + 3 * 10);
  const broken = dailyClaim(new Date(0), 10, 49 * HOUR, cfg);
  assert.ok(broken.ok && broken.streak === 1 && broken.amount === 100);
  const none = dailyClaim(new Date(0), 10, 30 * HOUR, { ...cfg, dailyStreakCapDays: 0 });
  assert.ok(none.ok && none.amount === 100);
});

test("bank plans: all/half/number, never more than the wallet, bank cap or wallet room", () => {
  assert.equal(parseAmountOrAll("ALL"), "all");
  assert.equal(parseAmountOrAll("half"), "half");
  assert.equal(parseAmountOrAll("1,500"), 1500);
  for (const v of ["0", "-3", "1.5", "lots"]) assert.equal(parseAmountOrAll(v), null, v);
  assert.deepEqual(planDeposit("all", 300, 0, 0), { ok: true, amount: 300 });
  assert.deepEqual(planDeposit("all", 300, 900, 1000), { ok: true, amount: 100 }, "all fills the bank to its cap");
  assert.deepEqual(planDeposit(200, 300, 900, 1000), { ok: false, reason: "bank_full" });
  assert.deepEqual(planDeposit(400, 300, 0, 0), { ok: false, reason: "insufficient" });
  assert.deepEqual(planDeposit("all", 0, 0, 0), { ok: false, reason: "empty" });
  assert.deepEqual(planDeposit("half", 5, 0, 0), { ok: true, amount: 2 });
  assert.deepEqual(planWithdraw("all", 10, 250), { ok: true, amount: 250 });
  assert.deepEqual(planWithdraw(300, 10, 250), { ok: false, reason: "insufficient" });
  assert.deepEqual(planWithdraw("all", MAX_BALANCE, 5), { ok: false, reason: "wallet_full" });
  assert.deepEqual(planWithdraw(null, 0, 0), { ok: false, reason: "invalid" });
});

test("crime: success pays within [min, max]; a fine is capped and never exceeds the wallet", () => {
  const cfg = { ...on, crimeSuccessPercent: 50, crimeMin: 50, crimeMax: 250, crimeFine: 100 };
  assert.deepEqual(rollCrime(cfg, 0, seq(49, 0)), { success: true, amount: 50 });
  assert.deepEqual(rollCrime(cfg, 0, seq(0, 200)), { success: true, amount: 250 });
  assert.deepEqual(rollCrime(cfg, 500, seq(50)), { success: false, fine: 100 });
  assert.deepEqual(rollCrime(cfg, 30, seq(99)), { success: false, fine: 30 }, "fine limited to the wallet");
  assert.deepEqual(rollCrime(cfg, 0, seq(99)), { success: false, fine: 0 });
});

test("slots: weights and paytable give a small documented house edge (between 2% and 5%)", () => {
  const total = SLOT_SYMBOLS.reduce((n, s) => n + SLOT_WEIGHTS[s], 0);
  let ret = 0;
  for (const a of SLOT_SYMBOLS) for (const b of SLOT_SYMBOLS) for (const c of SLOT_SYMBOLS) {
    const p = (SLOT_WEIGHTS[a] * SLOT_WEIGHTS[b] * SLOT_WEIGHTS[c]) / total ** 3;
    ret += p * slotReturnTenths([a, b, c]) / 10;
  }
  assert.ok(ret > 0.95 && ret < 0.98, `slots return ${ret}`);
  assert.equal(slotReturnTenths(["💎", "💎", "💎"]), SLOT_TRIPLE_TENTHS["💎"]);
  assert.equal(slotReturnTenths(["⭐", "🍒", "⭐"]), SLOT_PAIR_TENTHS["⭐"]);
  assert.equal(slotReturnTenths(["🍒", "🍋", "🔔"]), 0);
  // randomInt(18): 0-5 cherry, 6-10 lemon, 11-14 bell, 15-16 star, 17 diamond.
  const jackpot = playSlots(10, seq(17, 17, 17));
  assert.deepEqual(jackpot.reels, ["💎", "💎", "💎"] as SlotSymbol[]);
  assert.equal(jackpot.payout, 1000);
  assert.equal(playSlots(10, seq(0, 6, 11)).payout, 0);
  assert.equal(playSlots(3, seq(0, 0, 6)).payout, 1, "half back rounds down");
  assert.equal(COINFLIP_RETURN_PERCENT, 196);
  assert.deepEqual(playCoinflip(100, "heads", seq(0)), { payout: 196, win: true, detail: "heads" });
  assert.deepEqual(playCoinflip(100, "heads", seq(1)), { payout: 0, win: false, detail: "tails" });
});

test("bets: off by default, min/max, wallet, daily loss cap counts the whole bet", () => {
  const cfg = { ...on, gamblingEnabled: true, gambleMinBet: 10, gambleMaxBet: 1000, gambleDailyLossCap: 500 };
  assert.deepEqual(betRefusal(50, { cfg: on, wallet: 100, lossToday: 0 }), { reason: "off" });
  assert.deepEqual(betRefusal(5, { cfg, wallet: 100, lossToday: 0 }), { reason: "min", limit: 10 });
  assert.deepEqual(betRefusal(2000, { cfg, wallet: 5000, lossToday: 0 }), { reason: "max", limit: 1000 });
  assert.deepEqual(betRefusal(200, { cfg, wallet: 100, lossToday: 0 }), { reason: "insufficient" });
  assert.deepEqual(betRefusal(200, { cfg, wallet: 1000, lossToday: 400 }), { reason: "loss_cap", limit: 100 });
  assert.equal(betRefusal(200, { cfg, wallet: 1000, lossToday: -100 }), null, "winnings earlier in the day give room back");
  assert.equal(betRefusal(900, { cfg: { ...cfg, gambleDailyLossCap: 0 }, wallet: 1000, lossToday: 10_000 }), null, "0 = no loss cap");
});

test("pay rules: member tenure, tax rounds down, daily room resets on a new UTC day", () => {
  assert.deepEqual(payTenureRefusal(0, 10 * HOUR, 24), { readyAt: 24 * HOUR });
  assert.equal(payTenureRefusal(0, 25 * HOUR, 24), null);
  assert.equal(payTenureRefusal(null, 0, 24), null);
  assert.equal(payTenureRefusal(0, 0, 0), null);
  assert.equal(payTax(999, 5), 49);
  assert.equal(payTax(10, 0), 0);
  assert.equal(payRoomToday(1000, "2026-11-05", 700, "2026-11-05"), 300);
  assert.equal(payRoomToday(1000, "2026-11-04", 700, "2026-11-05"), 1000);
  assert.equal(payRoomToday(0, null, 0, "2026-11-05"), Number.POSITIVE_INFINITY);
  const t = Date.UTC(2026, 10, 5, 23, 59);
  assert.equal(utcDay(t), "2026-11-05");
  assert.equal(nextUtcMidnight(t), Date.UTC(2026, 10, 6));
});

test("items: role duration and /use only for role items; use and sell refusals", () => {
  const ok = validateShopItem({ name: "VIP", price: 100, roleId: "600000000000000001", roleDurationHours: "24", useToGrant: "on", perUserLimit: "2" });
  assert.ok(ok.ok && ok.value.roleDurationHours === 24 && ok.value.useToGrant && ok.value.perUserLimit === 2);
  const collectible = validateShopItem({ name: "Gem", price: 5, useToGrant: true });
  assert.ok(collectible.ok && collectible.value.useToGrant === false, "no role, nothing to use");
  const bad = validateShopItem({ name: "Gem", price: 5, roleDurationHours: 3, perUserLimit: 0 });
  assert.ok(!bad.ok && bad.errors.roleDurationHours && bad.errors.perUserLimit);
  assert.match(useRefusal(null, false)!, /no longer in the shop/);
  assert.match(useRefusal({ roleId: null, useToGrant: false }, false)!, /collectible/);
  assert.match(useRefusal({ roleId: "1", useToGrant: false }, false)!, /when you bought/);
  assert.match(useRefusal({ roleId: "1", useToGrant: true }, true)!, /already have/);
  assert.equal(useRefusal({ roleId: "1", useToGrant: true }, false), null);
  assert.equal(sellPrice({ price: 101, roleId: null, useToGrant: false }, 50), 50);
  assert.equal(sellPrice({ price: 100, roleId: "1", useToGrant: false }, 50), null, "a role given on purchase can't be returned");
  assert.equal(sellPrice({ price: 100, roleId: "1", useToGrant: true }, 50), 50);
  assert.equal(sellPrice({ price: 100, roleId: null, useToGrant: false }, 0), null);
});

test("account guards: bounds added for every balance change; memory and Mongo read the same spec", () => {
  const upd = withBounds({ inc: { balance: -30, bank: 30 }, guard: { atMost: { bank: 70 } } });
  assert.deepEqual(upd.guard!.atLeast, { balance: 30 });
  assert.deepEqual(upd.guard!.atMost, { bank: 70 });
  const a = { ...zeroAccount(G, A), balance: 30, bank: 70, gambleDay: "2026-11-05", lastGamble: new Date(1000) };
  assert.ok(guardsHold(a, upd.guard));
  assert.ok(!guardsHold({ ...a, bank: 71 }, upd.guard));
  assert.ok(!guardsHold({ ...a, balance: 29 }, upd.guard));
  assert.ok(guardsHold(a, { notAfter: { lastGamble: new Date(1000) }, dayIs: { gambleDay: "2026-11-05" } }));
  assert.ok(!guardsHold(a, { notAfter: { lastGamble: new Date(999) } }));
  assert.ok(!guardsHold(a, { dayIsNot: { gambleDay: "2026-11-05" } }));
  const f = accountFilter(G, A, { ...upd, guard: { ...upd.guard, notAfter: { lastCrime: new Date(5) }, dayIsNot: { payDay: "d" } } });
  assert.deepEqual(f, {
    guildId: G, userId: A, balance: { $gte: 30 }, bank: { $not: { $gt: 70 } },
    lastCrime: { $not: { $gt: new Date(5) } }, payDay: { $ne: "d" },
  }, "upper bounds use $not/$gt so older accounts without the field pass");
  assert.deepEqual(accountChange({ inc: { balance: 5 }, set: { lastWeekly: new Date(1) } }), { $inc: { balance: 5 }, $set: { lastWeekly: new Date(1) } });
});
