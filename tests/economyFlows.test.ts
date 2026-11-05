/** Memory-store integration tests for the economy flows: atomic under concurrency, totals conserved. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryEconomy } from "../src/services/economyService";
import { DEFAULT_ECONOMY_CONFIG, type EconomyConfig } from "../src/services/economyLogic";
import type { RandomInt } from "../src/services/economyRules";

const G = "800000000000000001";
const A = "900000000000000001";
const B = "900000000000000002";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const START = Date.UTC(2026, 10, 5, 12);

function setup(config: Partial<EconomyConfig> = {}, randomInt: RandomInt = () => 0) {
  let now = START;
  const eco = memoryEconomy({ config: { ...DEFAULT_ECONOMY_CONFIG, enabled: true, ...config }, now: () => now }, { randomInt });
  return { ...eco, tick: (ms: number) => { now += ms; } };
}

test("weekly: pays once per 7 days even when claimed concurrently; 0 turns it off", async () => {
  const { service, store, tick } = setup({ weeklyAmount: 500 });
  const results = await Promise.all([1, 2, 3, 4].map(() => service.weekly(G, A)));
  assert.equal(results.filter(r => r.ok).length, 1);
  assert.equal((await store.account(G, A)).balance, 500);
  const again = await service.weekly(G, A);
  assert.ok(!again.ok && again.reason === "cooldown" && again.retryAt === START + 7 * DAY);
  tick(7 * DAY);
  assert.ok((await service.weekly(G, A)).ok);
  const off = setup({ weeklyAmount: 0 });
  assert.deepEqual(await off.service.weekly(G, A), { ok: false, reason: "off" });
});

test("bank: deposits and withdrawals conserve coins, respect the cap, and can't overdraw under concurrency", async () => {
  const { service, store } = setup({ bankCap: 1000 });
  await store.setBalance(G, A, 1500);
  const deposits = await Promise.all([1, 2, 3].map(() => service.deposit(G, A, 600)));
  assert.equal(deposits.filter(r => r.ok).length, 1, "only one 600 fits under the 1,000 cap");
  let acct = await store.account(G, A);
  assert.equal(acct.balance + acct.bank, 1500);
  const all = await service.deposit(G, A, "all");
  assert.ok(all.ok && all.amount === 400 && all.bank === 1000);
  const full = await service.deposit(G, A, 1);
  assert.ok(!full.ok && full.reason === "bank_full");
  const withdraws = await Promise.all([1, 2, 3].map(() => service.withdraw(G, A, 400)));
  assert.equal(withdraws.filter(r => r.ok).length, 2);
  acct = await store.account(G, A);
  assert.deepEqual([acct.balance, acct.bank], [1300, 200]);
  assert.deepEqual(store.transactions.map(t => t.type).filter(t => t === "deposit" || t === "withdraw").length, 4);
});

test("leaderboard ranks by wallet + bank, or by wallet only", async () => {
  const { service, store } = setup();
  await store.setBalance(G, A, 100, 900);
  await store.setBalance(G, B, 500, 0);
  assert.deepEqual((await service.leaderboard(G, 1, 10)).rows.map(r => [r.userId, r.total]), [[A, 1000], [B, 500]]);
  assert.deepEqual((await service.leaderboard(G, 1, 10, "wallet")).rows.map(r => r.userId), [B, A]);
});

test("crime: one attempt per cooldown under concurrency; fines never go below zero; off switch", async () => {
  const { service, store, tick } = setup({ crimeSuccessPercent: 50, crimeFine: 100 }, () => 99);
  await store.setBalance(G, A, 40);
  const results = await Promise.all([1, 2, 3].map(() => service.crime(G, A)));
  assert.equal(results.filter(r => r.ok).length, 1);
  const done = results.find(r => r.ok)!;
  assert.ok(done.ok && !done.success && done.fine === 40);
  assert.equal((await store.account(G, A)).balance, 0);
  tick(120 * 60_000);
  const broke = await service.crime(G, A);
  assert.ok(broke.ok && !broke.success && broke.fine === 0, "a fine on an empty wallet is 0");
  const win = setup({ crimeSuccessPercent: 50, crimeMin: 50, crimeMax: 250 }, () => 0);
  const w = await win.service.crime(G, A);
  assert.ok(w.ok && w.success && w.amount === 50 && w.balance === 50);
  const off = setup({ crimeEnabled: false });
  assert.deepEqual(await off.service.crime(G, A), { ok: false, reason: "off" });
});

test("gamble: refused while off; cooldown and daily loss cap hold under concurrent bets; payouts settle", async () => {
  const off = setup();
  const r0 = await off.service.gamble(G, A, 50, { game: "slots" });
  assert.ok(!r0.ok && r0.reason === "refused" && r0.refusal.reason === "off");

  // Always tails: every heads call loses.
  const { service, store, tick } = setup({ gamblingEnabled: true, gambleDailyLossCap: 250, gambleCooldownSeconds: 10, gambleMaxBet: 100 }, () => 1);
  await store.setBalance(G, A, 1000);
  const burst = await Promise.all([1, 2, 3].map(() => service.gamble(G, A, 100, { game: "coinflip", call: "heads" })));
  assert.equal(burst.filter(r => r.ok).length, 1, "cooldown lets one bet through");
  for (let i = 0; i < 2; i++) { tick(10_000); await service.gamble(G, A, 100, { game: "coinflip", call: "heads" }); }
  const acct = await store.account(G, A);
  assert.equal(acct.balance, 800, "third 100 bet would pass the 250 loss cap");
  assert.equal(acct.gambleLoss, 200);
  tick(10_000);
  const capped = await service.gamble(G, A, 100, { game: "coinflip", call: "heads" });
  assert.ok(!capped.ok && capped.reason === "refused" && capped.refusal.reason === "loss_cap" && capped.refusal.limit === 50);
  assert.ok((await service.gamble(G, A, 50, { game: "coinflip", call: "heads" })).ok);
  tick(DAY);
  assert.ok((await service.gamble(G, A, 100, { game: "coinflip", call: "heads" })).ok, "a new UTC day resets the loss cap");
  assert.equal((await store.account(G, A)).gambleLoss, 100);

  const winner = setup({ gamblingEnabled: true }, () => 0);
  await winner.store.setBalance(G, B, 100);
  const won = await winner.service.gamble(G, B, 100, { game: "coinflip", call: "heads" });
  assert.ok(won.ok && won.result.payout === 196 && won.balance === 196 && won.lossToday === -96);
  assert.equal(winner.store.transactions.at(-1)!.amount, 96);
});

test("pay: daily limit and tax are enforced atomically; tax leaves circulation; new day resets the limit", async () => {
  const { service, store, tick } = setup({ payDailyLimit: 1000, payTaxPercent: 10 });
  await store.setBalance(G, A, 5000);
  const burst = await Promise.all([1, 2, 3, 4].map(() => service.pay(G, A, B, 400)));
  assert.equal(burst.filter(r => r.ok).length, 2, "only 800 of the 1,000 limit fits");
  const refused = burst.find(r => !r.ok)!;
  assert.ok(!refused.ok && refused.reason === "limit" && refused.room === 200);
  const a = await store.account(G, A), b = await store.account(G, B);
  assert.equal(a.balance, 4200);
  assert.equal(b.balance, 720, "recipient gets amount minus 10% tax");
  const out = store.transactions.find(t => t.type === "pay_out")!;
  assert.equal(out.note, "tax 40");
  tick(DAY);
  assert.ok((await service.pay(G, A, B, 1000)).ok);
  const over = await service.pay(G, B, A, 5000);
  assert.ok(!over.ok && over.reason === "limit", "the limit is checked before the balance");
  await store.setBalance(G, B, 10);
  const broke = await service.pay(G, B, A, 500);
  assert.ok(!broke.ok && broke.reason === "insufficient");
});

test("buy limit, role on /use, and selling back are atomic and refund on failure", async () => {
  const { service, store } = setup({ shopSellPercent: 50 });
  await store.setBalance(G, A, 10_000);
  const badge = await service.addItem(G, { name: "Badge", price: 100, perUserLimit: "2" });
  assert.ok(badge.ok);
  const buys = await Promise.all([1, 2, 3, 4].map(() => service.buy(G, A, badge.value.id)));
  assert.equal(buys.filter(r => r.ok).length, 2);
  const limited = buys.find(r => !r.ok)!;
  assert.ok(!limited.ok && limited.reason === "limit");
  assert.equal((await store.account(G, A)).balance, 9800);
  assert.deepEqual((await store.inventory(G, A)).map(r => r.quantity), [2]);

  const sold = await service.sellItem(G, A, badge.value.id);
  assert.ok(sold.ok && sold.price === 50 && sold.balance === 9850);
  assert.deepEqual((await store.inventory(G, A)).map(r => r.quantity), [1]);
  assert.ok(!(await service.buy(G, A, badge.value.id)).ok, "selling doesn't reset the per-member limit");

  const vip = await service.addItem(G, { name: "VIP pass", price: 500, roleId: "600000000000000001", useToGrant: true, roleDurationHours: 24 });
  assert.ok(vip.ok);
  const granted: Array<[string, number | null]> = [];
  const bought = await service.buy(G, A, vip.value.id, { grantRole: async (r, h) => { granted.push([r, h]); return null; } });
  assert.ok(bought.ok);
  assert.equal(granted.length, 0, "a /use item doesn't give the role on purchase");
  const failed = await service.useItem(G, A, vip.value.id, { grantRole: async () => "Aegis can't hand out that role." });
  assert.ok(!failed.ok && failed.reason === "role_failed");
  assert.equal((await store.inventory(G, A)).find(r => r.itemId === vip.value.id)!.quantity, 1, "a failed use gives the item back");
  const used = await service.useItem(G, A, vip.value.id, { ownsRole: () => false, grantRole: async (r, h) => { granted.push([r, h]); return null; } });
  assert.ok(used.ok);
  assert.deepEqual(granted, [["600000000000000001", 24]]);
  assert.equal((await store.inventory(G, A)).find(r => r.itemId === vip.value.id), undefined);
  const again = await service.useItem(G, A, vip.value.id, {});
  assert.ok(!again.ok && again.reason === "not_owned");
  const collectible = await service.useItem(G, A, badge.value.id, {});
  assert.ok(!collectible.ok && collectible.reason === "refused" && /collectible/.test(collectible.detail));
});

test("reset clears wallet and bank and records the combined amount", async () => {
  const { service, store } = setup();
  await store.setBalance(G, A, 100, 400);
  const r = await service.adjust(G, A, "reset", 0, B, "test");
  assert.ok(r.ok && r.previous === 500 && r.balance === 0);
  assert.equal((await store.account(G, A)).bank, 0);
  assert.equal(store.transactions.at(-1)!.amount, -500);
});
