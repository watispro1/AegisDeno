import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ECONOMY_CONFIG, MAX_BALANCE, STREAK_BONUS_CAP, applyEconomySettings, dailyClaim, formatCoins,
  needsPayConfirmation, normalizeEconomyConfig, parseAmount, payRefusal, roleItemRefusal, validCurrencyEmoji,
  validateShopItem, workClaim, type EconomyConfig,
} from "../src/services/economyLogic";
import { memoryEconomy } from "../src/services/economyService";
import { mongoEconomyStore, type EconomyModelLike, type EconomyModels } from "../src/services/economyMongo";

const G = "800000000000000001";
const A = "900000000000000001";
const B = "900000000000000002";
const HOUR = 3_600_000;
const on: EconomyConfig = { ...DEFAULT_ECONOMY_CONFIG, enabled: true };

/* Settings */

test("economy config: off by default, normalizes junk, keeps workMax ≥ workMin", () => {
  const c = normalizeEconomyConfig(undefined);
  assert.equal(c.enabled, false);
  assert.equal(c.dailyAmount, 100);
  const junk = normalizeEconomyConfig({ enabled: "yes", dailyAmount: -5, currencyEmoji: "@everyone", currencyName: "<b>", workMin: 50, workMax: 10, dailyCooldownHours: 1.5 });
  assert.equal(junk.enabled, false, "only literal true turns it on");
  assert.equal(junk.dailyAmount, 100);
  assert.equal(junk.currencyEmoji, "🪙");
  assert.equal(junk.currencyName, "coins");
  assert.equal(junk.dailyCooldownHours, 24, "fractions are rejected");
  assert.equal(junk.workMax, 50);
});

test("economy config validation: range errors, all-or-nothing, emoji and name rules", () => {
  const bad = applyEconomySettings(on, { dailyAmount: "0", workMin: "90", workMax: "10", currencyEmoji: "@here" });
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    assert.match(bad.errors.dailyAmount!, /1 to 1,000,000/);
    assert.match(bad.errors.workMax!, /at least the work minimum/);
    assert.ok(bad.errors.currencyEmoji);
  }
  const ok = applyEconomySettings(on, { dailyAmount: 250, currencyName: "gems", currencyEmoji: "💎", workCooldownMinutes: "30" });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.value.dailyAmount, 250);
    assert.equal(ok.value.currencyName, "gems");
    assert.equal(ok.value.workCooldownMinutes, 30);
    assert.equal(ok.value.workMin, on.workMin, "untouched fields keep their value");
  }
  assert.ok(validCurrencyEmoji("<:coin:123456789012345678>"));
  assert.ok(validCurrencyEmoji("<a:spin:123456789012345678>"));
  for (const e of ["", "abc", "<@123456789012345678>", "a b", "**", "https://x"]) assert.ok(!validCurrencyEmoji(e), e);
  assert.equal(applyEconomySettings(on, { payConfirmThreshold: String(MAX_BALANCE + 1) }).ok, false);
  assert.equal(applyEconomySettings(on, { dailyCooldownHours: "169" }).ok, false);
});

test("amounts: integers only, commas allowed, 1..1e12", () => {
  assert.equal(parseAmount("1,000"), 1000);
  assert.equal(parseAmount(5), 5);
  for (const v of ["0", "-1", "1.5", "1e3", "abc", String(MAX_BALANCE + 1), 0, 2.5, Number.NaN, null]) assert.equal(parseAmount(v), null, String(v));
  assert.equal(parseAmount(String(MAX_BALANCE)), MAX_BALANCE);
  assert.equal(formatCoins(on, 1234567), "🪙 1,234,567 coins");
});

/* Cooldowns */

test("daily: 24h cooldown with retry time, streak grows within 48h, resets after, bonus capped", () => {
  const t0 = Date.UTC(2026, 10, 2, 12);
  const first = dailyClaim(null, 0, t0, on);
  assert.deepEqual(first, { ok: true, amount: 100, streak: 1 });
  const early = dailyClaim(new Date(t0), 1, t0 + 23 * HOUR, on);
  assert.deepEqual(early, { ok: false, retryAt: t0 + 24 * HOUR });
  const next = dailyClaim(new Date(t0), 1, t0 + 25 * HOUR, on);
  assert.deepEqual(next, { ok: true, amount: 110, streak: 2 });
  const broken = dailyClaim(new Date(t0), 5, t0 + 49 * HOUR, on);
  assert.deepEqual(broken, { ok: true, amount: 100, streak: 1 });
  const long = dailyClaim(new Date(t0), 30, t0 + 25 * HOUR, on);
  assert.ok(long.ok && long.amount === 100 + STREAK_BONUS_CAP * 10);
  const future = dailyClaim(new Date(t0 + HOUR), 1, t0, on);
  assert.equal(future.ok, false, "a last claim in the future (clock skew) still counts as cooling down");
});

test("work: random within [min, max], 1h cooldown", () => {
  const t0 = 1_000_000_000_000;
  assert.deepEqual(workClaim(null, t0, on, () => 0), { ok: true, amount: on.workMin, streak: 0 });
  assert.deepEqual(workClaim(null, t0, on, () => 0.999999), { ok: true, amount: on.workMax, streak: 0 });
  assert.deepEqual(workClaim(new Date(t0), t0 + 59 * 60_000, on), { ok: false, retryAt: t0 + HOUR });
  assert.equal(workClaim(new Date(t0), t0 + HOUR, on).ok, true);
});

test("service: cooldowns are persisted in the store, so a new service (restart) still sees them", async () => {
  let now = Date.UTC(2026, 10, 2);
  const { store, service } = memoryEconomy({ config: { enabled: true }, now: () => now });
  const r = await service.daily(G, A);
  assert.ok(r.ok && r.balance === 100);
  const { EconomyService } = await import("../src/services/economyService");
  const restarted = new EconomyService(store, { now: () => now });
  const again = await restarted.daily(G, A);
  assert.ok(!again.ok && again.reason === "cooldown" && again.retryAt === now + 24 * HOUR);
  now += 24 * HOUR;
  const tomorrow = await restarted.daily(G, A);
  assert.ok(tomorrow.ok && tomorrow.streak === 2 && tomorrow.balance === 210);
  assert.deepEqual(store.transactions.map(t => t.type), ["daily", "daily"]);
});

test("service: concurrent /daily claims pay exactly once", async () => {
  const { service, store } = memoryEconomy({ config: { enabled: true } });
  const results = await Promise.all(Array.from({ length: 10 }, () => service.daily(G, A)));
  assert.equal(results.filter(r => r.ok).length, 1);
  assert.equal((await service.balance(G, A)).balance, 100);
  assert.equal(store.transactions.length, 1);
});

/* Balances: atomic guards */

test("pay: no overdraft or double-spend under concurrency; totals are conserved", async () => {
  const { service, store } = memoryEconomy({ config: { enabled: true } });
  await store.setBalance(G, A, 100);
  const results = await Promise.all(Array.from({ length: 8 }, () => service.pay(G, A, B, 30)));
  assert.equal(results.filter(r => r.ok).length, 3, "only three payments of 30 fit in 100");
  assert.equal((await service.balance(G, A)).balance, 10);
  assert.equal((await service.balance(G, B)).balance, 90);
  const failed = results.find(r => !r.ok);
  assert.ok(failed && !failed.ok && failed.reason === "insufficient");
  assert.equal(store.transactions.filter(t => t.type === "pay_out").length, 3);
});

test("pay: a recipient at the cap is refused and the sender refunded", async () => {
  const { service, store } = memoryEconomy();
  await store.setBalance(G, A, 500);
  await store.setBalance(G, B, MAX_BALANCE - 10);
  const r = await service.pay(G, A, B, 100);
  assert.ok(!r.ok && r.reason === "recipient_full");
  assert.equal((await service.balance(G, A)).balance, 500);
  assert.equal((await service.balance(G, B)).balance, MAX_BALANCE - 10);
});

test("pay rules: not yourself, not bots, sane amount, confirmation threshold", () => {
  assert.match(payRefusal({ fromId: A, toId: A, toBot: false, amount: 5 })!, /yourself/);
  assert.match(payRefusal({ fromId: A, toId: B, toBot: true, amount: 5 })!, /Bots/);
  assert.match(payRefusal({ fromId: A, toId: B, toBot: false, amount: null })!, /whole number/);
  assert.equal(payRefusal({ fromId: A, toId: B, toBot: false, amount: 5 }), null);
  assert.equal(needsPayConfirmation(999, on), false);
  assert.equal(needsPayConfirmation(1000, on), true);
  assert.equal(needsPayConfirmation(1e9, { ...on, payConfirmThreshold: 0 }), false);
});

test("adjust: give respects the cap, take never goes negative, reset logs what was removed and calls the hook", async () => {
  const events: unknown[] = [];
  const { service, store } = memoryEconomy({}, { onAdjust: e => { events.push(e); } });
  assert.deepEqual(await service.adjust(G, A, "give", 50, B, "event"), { ok: true, balance: 50, previous: 0 });
  assert.deepEqual(await service.adjust(G, A, "take", 80, B, null), { ok: false, reason: "insufficient", balance: 50 });
  assert.deepEqual(await service.adjust(G, A, "give", MAX_BALANCE, B, null), { ok: false, reason: "cap", balance: 50 });
  assert.deepEqual(await service.adjust(G, A, "reset", 0, B, "abuse"), { ok: true, balance: 0, previous: 50 });
  assert.equal(events.length, 2, "the hook only fires for applied changes");
  const types = store.transactions.map(t => [t.type, t.amount, t.actorId]);
  assert.deepEqual(types, [["admin_give", 50, B], ["admin_reset", -50, B]]);
});

/* Shop */

test("shop items: validation, unique names, 50-item cap", async () => {
  const bad = validateShopItem({ name: "", price: "0", stock: "-1", roleId: "x", description: "d".repeat(201) });
  assert.ok(!bad.ok && bad.errors.name && bad.errors.price && bad.errors.stock && bad.errors.roleId && bad.errors.description);
  assert.ok(!validateShopItem({ name: "<@&1> ping", price: 1 }).ok, "no mentions in names");
  const { service } = memoryEconomy();
  const added = await service.addItem(G, { name: "VIP", price: "5,000", stock: "" });
  assert.ok(added.ok && added.value.price === 5000 && added.value.stock === null);
  const dup = await service.addItem(G, { name: "  vip ", price: 1 });
  assert.ok(!dup.ok && /already exists/.test(dup.errors.name!));
  for (let i = 1; i < 50; i++) assert.ok((await service.addItem(G, { name: `Item ${i}`, price: i })).ok);
  const full = await service.addItem(G, { name: "One more", price: 1 });
  assert.ok(!full.ok && /full/.test(full.errors.name!));
});

test("buy: insufficient funds charge nothing and keep stock; stock runs out exactly", async () => {
  const { service, store } = memoryEconomy();
  const item = await service.addItem(G, { name: "Badge", price: 40, stock: 2 });
  assert.ok(item.ok);
  const poor = await service.buy(G, A, item.value.id);
  assert.ok(!poor.ok && poor.reason === "insufficient" && poor.balance === 0 && poor.price === 40);
  assert.equal((await service.item(G, item.value.id))!.stock, 2, "stock returned");
  await store.setBalance(G, A, 1000);
  const results = await Promise.all(Array.from({ length: 5 }, () => service.buy(G, A, item.value.id)));
  assert.equal(results.filter(r => r.ok).length, 2);
  assert.ok(results.some(r => !r.ok && r.reason === "sold_out"));
  assert.equal((await service.balance(G, A)).balance, 920);
  assert.deepEqual(await service.inventory(G, A), [{ itemId: item.value.id, name: "Badge", quantity: 2, roleId: null }]);
  assert.ok(!(await service.buy(G, A, "nope")).ok);
});

test("buy: role items refund coins and stock when the role can't be granted; owned roles are refused", async () => {
  const ROLE = "600000000000000001";
  const { service, store } = memoryEconomy();
  const item = await service.addItem(G, { name: "VIP", price: 100, roleId: ROLE, stock: 1 });
  assert.ok(item.ok);
  await store.setBalance(G, A, 150);
  const owned = await service.buy(G, A, item.value.id, { ownsRole: () => true });
  assert.ok(!owned.ok && owned.reason === "already_owned");
  const failed = await service.buy(G, A, item.value.id, { grantRole: async () => "Role is above Aegis." });
  assert.ok(!failed.ok && failed.reason === "role_failed" && failed.detail === "Role is above Aegis.");
  assert.equal((await service.balance(G, A)).balance, 150, "refunded");
  assert.equal((await service.item(G, item.value.id))!.stock, 1, "stock returned");
  const thrown = await service.buy(G, A, item.value.id, { grantRole: async () => { throw new Error("Missing Permissions"); } });
  assert.ok(!thrown.ok && thrown.reason === "role_failed");
  assert.equal((await service.balance(G, A)).balance, 150);
  const granted: string[] = [];
  const ok = await service.buy(G, A, item.value.id, { grantRole: async (r) => { granted.push(r); return null; } });
  assert.ok(ok.ok && ok.balance === 50 && ok.item.stock === 0);
  assert.deepEqual(granted, [ROLE]);
  assert.deepEqual(await service.inventory(G, A), [{ itemId: item.value.id, name: "VIP", quantity: 1, roleId: ROLE }], "a granted role is recorded");
});

test("a claim refused at the cap does not start the cooldown", async () => {
  const now = Date.UTC(2026, 10, 2);
  const { service, store } = memoryEconomy({ config: { enabled: true, workMin: 20, workMax: 20 }, now: () => now }, { rng: () => 0 });
  await store.setBalance(G, A, MAX_BALANCE - 5);

  const daily = await service.daily(G, A);
  assert.ok(!daily.ok && daily.reason === "cap");
  const work = await service.work(G, A);
  assert.ok(!work.ok && work.reason === "cap");

  // Spending the coins must not leave the member locked out by the failed claim.
  await store.setBalance(G, A, 0);
  const retryDaily = await service.daily(G, A);
  assert.ok(retryDaily.ok, `daily should be ready, got ${JSON.stringify(retryDaily)}`);
  const retryWork = await service.work(G, A);
  assert.ok(retryWork.ok, `work should be ready, got ${JSON.stringify(retryWork)}`);
});

test("reset on an account that never existed is a clean no-op", async () => {
  const { service, store } = memoryEconomy();
  assert.deepEqual(await service.adjust(G, "999", "reset", 0, B, "leftover"), { ok: true, balance: 0, previous: 0 });
  assert.equal((await service.balance(G, "999")).balance, 0);
  assert.equal(store.transactions.length, 0, "a reset of nothing is not a balance change");
});

test("role items: hierarchy rule (below Aegis and below the staff member; owner exempt; no @everyone/managed)", () => {
  const ctx = { guildId: G, botTopPosition: 10, actorTopPosition: 6, actorIsOwner: false };
  assert.equal(roleItemRefusal({ id: "1", position: 5, managed: false }, ctx), null);
  assert.match(roleItemRefusal({ id: "1", position: 6, managed: false }, ctx)!, /above your highest/);
  assert.match(roleItemRefusal({ id: "1", position: 10, managed: false }, ctx)!, /Aegis's highest/);
  assert.match(roleItemRefusal({ id: "1", position: 2, managed: true }, ctx)!, /managed/);
  assert.match(roleItemRefusal({ id: G, position: 0, managed: false }, ctx)!, /everyone/);
  assert.equal(roleItemRefusal({ id: "1", position: 8, managed: false }, { ...ctx, actorIsOwner: true }), null);
  assert.match(roleItemRefusal({ id: "1", position: 1, managed: false }, { ...ctx, actorTopPosition: null })!, /above your highest/, "unknown rank fails closed");
});

test("leaderboard: richest first, ties by ID, zero balances hidden, paged", async () => {
  const { service, store } = memoryEconomy();
  await store.setBalance(G, "3", 50);
  await store.setBalance(G, "1", 50);
  await store.setBalance(G, "2", 900);
  await store.setBalance(G, "4", 0);
  await store.setBalance("other", "5", 1e6);
  const p1 = await service.leaderboard(G, 1, 2);
  assert.deepEqual(p1, { rows: [{ userId: "2", balance: 900 }, { userId: "1", balance: 50 }], total: 3 });
  assert.deepEqual((await service.leaderboard(G, 2, 2)).rows, [{ userId: "3", balance: 50 }]);
  assert.deepEqual((await service.leaderboard(G, 0, 2)).rows.length, 2, "page < 1 is page 1");
});

/* Mongo store: the guards live in the query */

function fakeModels() {
  const calls: Array<{ model: string; op: string; args: unknown[] }> = [];
  const lean = <T>(v: T) => ({ lean: async () => v });
  const query = () => { const q = { sort: () => q, skip: () => q, limit: () => q, select: () => q, lean: async () => [] }; return q; };
  const make = (name: string, result: Record<string, unknown> | null = null): EconomyModelLike => ({
    findOne: (...args) => { calls.push({ model: name, op: "findOne", args }); return lean(null); },
    find: (...args) => { calls.push({ model: name, op: "find", args }); return query() as never; },
    findOneAndUpdate: (...args) => { calls.push({ model: name, op: "findOneAndUpdate", args }); return lean(result); },
    findOneAndDelete: (...args) => { calls.push({ model: name, op: "findOneAndDelete", args }); return lean(null); },
    updateOne: async (...args) => { calls.push({ model: name, op: "updateOne", args }); },
    countDocuments: async () => 0,
    create: async (doc) => ({ toObject: () => ({ _id: "a".repeat(24), ...doc }) }),
  });
  const models: EconomyModels = { config: make("config"), account: make("account", { balance: 5 }), transaction: make("tx"), item: make("item"), inventory: make("inv") };
  return { models, calls };
}

test("mongo store: debit/credit/stock are single guarded $inc updates", async () => {
  const { models, calls } = fakeModels();
  const store = mongoEconomyStore(models);
  await store.debit(G, A, 30);
  await store.credit(G, A, 20);
  const when = new Date(1000);
  await store.credit(G, A, 10, { field: "lastDaily", expected: when, set: { lastDaily: new Date(2000), dailyStreak: 2 } });
  await store.takeStock(G, "b".repeat(24));
  const [debit, credit, swap] = calls.filter(c => c.op === "findOneAndUpdate" && c.model === "account");
  assert.deepEqual(debit.args[0], { guildId: G, userId: A, balance: { $gte: 30 } });
  assert.deepEqual(debit.args[1], { $inc: { balance: -30 } });
  assert.deepEqual(credit.args[0], { guildId: G, userId: A, balance: { $lte: MAX_BALANCE - 20 } });
  assert.deepEqual((swap.args[0] as Record<string, unknown>).lastDaily, when, "compare-and-set on the cooldown");
  assert.deepEqual((swap.args[1] as Record<string, unknown>).$set, { lastDaily: new Date(2000), dailyStreak: 2 });
  const stock = calls.find(c => c.op === "findOneAndUpdate" && c.model === "item")!;
  assert.deepEqual((stock.args[0] as Record<string, unknown>).stock, { $gt: 0 });
  assert.equal(await store.getItem(G, "$where"), null, "non-ObjectId IDs never reach the query");
  assert.equal(calls.some(c => JSON.stringify(c.args).includes("$where")), false);
});

test("mongo store: a duplicate-key race on account creation is ignored", async () => {
  const { models } = fakeModels();
  models.account.updateOne = async () => { throw Object.assign(new Error("dup"), { code: 11000 }); };
  await mongoEconomyStore(models).ensureAccount(G, A);
  models.account.updateOne = async () => { throw new Error("down"); };
  await assert.rejects(mongoEconomyStore(models).ensureAccount(G, A), /down/);
});
