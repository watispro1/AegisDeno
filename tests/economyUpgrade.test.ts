/**
 * The economy command upgrade: amount parsing and autocomplete, cooldown
 * text, the per-member queue (and the role double-charge it closes), buy
 * and sell quantities, /shop edit conflicts, and backward-compatible
 * command definitions.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import type { Guild } from "discord.js";
import { commands, loadCommands } from "../src/commands/loader";
import { memoryEconomy } from "../src/services/economyService";
import { DEFAULT_ECONOMY_CONFIG, MAX_BALANCE, type EconomyConfig, type ShopItem, type ShopItemInput } from "../src/services/economyLogic";
import { formatDuration, readyText, waitText, balanceFields, economyEmbed } from "../src/commands/economy/lib/ui";
import { integerAmountChoices, parseAmountInput, quantityChoices, resolveAmount, textAmountChoices } from "../src/commands/economy/lib/amounts";
import { lockedMemberCount, withMemberLock } from "../src/commands/economy/lib/memberLock";
import { buyChoiceLabel, buyPlanned, grantsOnPurchase, mostBuyable, planBuy, sellMany, MAX_TRADE_QUANTITY } from "../src/commands/economy/lib/shopTrade";
import { editConflict } from "../src/commands/economy/lib/shopEdit";
import { bankRefusalText } from "../src/commands/economy/lib/bank";
import { betChoices } from "../src/commands/economy/gamble";
import { sendRoomAfter } from "../src/commands/economy/pay";
import { bankTip } from "../src/commands/economy/balance";
import { interestRate } from "../src/commands/economy/interest";
import { isUsable, useChoiceLabel } from "../src/commands/economy/use";
import snapshot from "./economyOptions.snapshot.json";

const CFG: EconomyConfig = { ...DEFAULT_ECONOMY_CONFIG, enabled: true };
const G = "800000000000000001";
const A = "900000000000000001";
const NOW = Date.UTC(2026, 10, 14, 12);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const shopItem = (over: Partial<ShopItem> = {}): ShopItem => ({
  id: "i1", guildId: G, createdAt: new Date(NOW), name: "Cookie", description: "", price: 100, roleId: null, stock: null,
  perUserLimit: null, roleDurationHours: null, useToGrant: false, effect: null, effectHours: null, effectPercent: null, ...over,
});
const input = (over: Partial<ShopItemInput> = {}): ShopItemInput => {
  const { id: _id, guildId: _g, createdAt: _c, ...rest } = shopItem(over as Partial<ShopItem>);
  return rest;
};
const fakeGuild = { id: G, members: { fetch: async () => null } } as unknown as Guild;

before(async () => { await loadCommands(); });

test("cooldown text: compact durations, clock time, and ready states", () => {
  assert.equal(formatDuration(500), "1s");
  assert.equal(formatDuration(65_000), "1m 5s");
  assert.equal(formatDuration(25 * 60_000), "25m");
  assert.equal(formatDuration(2 * 3_600_000 + 13 * 60_000), "2h 13m");
  assert.equal(formatDuration(3 * 3_600_000), "3h");
  assert.equal(formatDuration(50 * 3_600_000), "2d 2h");
  assert.equal(waitText(NOW + 90 * 60_000, NOW), `in **1h 30m** (<t:${(NOW + 90 * 60_000) / 1000}:t>)`);
  assert.match(waitText(NOW + 6 * 86_400_000, NOW), /in \*\*6d\*\* \(<t:\d+:f>\)/, "a long wait shows the date too");
  assert.equal(waitText(NOW - 1, NOW), "now");
  assert.equal(readyText(null, "daily", NOW), "✅ Ready, run `/daily`");
  assert.equal(readyText(NOW - 5, "work", NOW), "✅ Ready, run `/work`", "a cooldown already over reads as ready");
  assert.equal(readyText(NOW + 60_000, "work", NOW), `⏳ 1m · <t:${(NOW + 60_000) / 1000}:R>`);
});

test("embeds: one shape with Wallet and Bank first", () => {
  assert.deepEqual(balanceFields(CFG, { wallet: 1200, bank: 50, bankCap: 1000 }).map(f => [f.name, f.value]), [
    ["👛 Wallet", "🪙 1,200 coins"], ["🏦 Bank", "🪙 50 coins / 🪙 1,000 coins"],
  ]);
  assert.deepEqual(balanceFields(CFG, { wallet: null }), []);
  const e = economyEmbed(CFG, { tone: "ok", title: "T", description: "D", balance: { wallet: 5 }, fields: [{ name: "X", value: "y" }], footer: "hi" }).toJSON();
  assert.deepEqual(e.fields!.map(f => f.name), ["👛 Wallet", "X"]);
  assert.equal(e.footer!.text, "Aegis · hi");
});

test("amount parsing: numbers, separators, k/m/b, all/half, and junk", () => {
  assert.equal(parseAmountInput("1,500"), 1500);
  assert.equal(parseAmountInput(" 2.5k "), 2500);
  assert.equal(parseAmountInput("1M"), 1_000_000);
  assert.equal(parseAmountInput("all"), "all");
  assert.equal(parseAmountInput("MAX"), "all");
  assert.equal(parseAmountInput("100%"), "all");
  assert.equal(parseAmountInput("half"), "half");
  for (const bad of ["", "0", "-5", "1.5", "abc", "1e9", "5kk", String(MAX_BALANCE + 1), null]) assert.equal(parseAmountInput(bad), null, String(bad));
  assert.equal(resolveAmount("all", 77), 77);
  assert.equal(resolveAmount("half", 77), 38);
  assert.equal(resolveAmount("half", 1), 1);
  assert.equal(resolveAmount("half", 0), 0);
});

test("bank autocomplete: All and Half of what's there, typed numbers read back", () => {
  const empty = textAmountChoices(CFG, 0, "", "wallet");
  assert.equal(empty.length, 1);
  assert.match(empty[0].name, /wallet is empty/);
  const base = textAmountChoices(CFG, 1000, "", "wallet");
  assert.deepEqual(base.map(c => c.value), ["all", "half"]);
  assert.match(base[0].name, /All: 🪙 1,000 coins/);
  assert.deepEqual(textAmountChoices(CFG, 1000, "2k", "wallet")[0], { name: "2,000 (you only have 1,000 in your wallet)", value: "2000" });
  assert.deepEqual(textAmountChoices(CFG, 1000, "h", "wallet").map(c => c.value), ["half"], "typing narrows");
  for (const c of textAmountChoices({ ...CFG, currencyName: "x".repeat(200) }, 5, "", "bank")) assert.ok(c.name.length <= 100);
});

test("integer autocomplete (/pay, /gamble): values are numbers inside the limits", () => {
  const c = integerAmountChoices(CFG, { available: 1000, min: 1, max: MAX_BALANCE, typed: "" });
  assert.deepEqual(c.map(x => x.value), [1000, 500, 250, 1]);
  assert.ok(c.every(x => typeof x.value === "number"));
  assert.deepEqual(integerAmountChoices(CFG, { available: 1000, min: 1, max: 300, typed: "" }).map(x => x.value), [300, 150, 75, 1], "capped by the max");
  assert.deepEqual(integerAmountChoices(CFG, { available: 1000, min: 10, max: 500, typed: "5k" })[0], { name: "500 (the most allowed)", value: 500 });
  assert.deepEqual(integerAmountChoices(CFG, { available: 1000, min: 10, max: 500, typed: "3" })[0], { name: "10 (the least allowed)", value: 10 });
  assert.deepEqual(integerAmountChoices(CFG, { available: 1000, min: 1, max: 5000, typed: "half" })[0], { name: "500", value: 500 });
  const poor = integerAmountChoices(CFG, { available: 5, min: 10, max: 500, typed: "" });
  assert.equal(poor.length, 1);
  assert.match(poor[0].name, /at least 10/);
});

test("bet suggestions respect min/max bet and what's left of today's loss limit", () => {
  const cfg = { ...CFG, gambleMinBet: 10, gambleMaxBet: 5000, gambleDailyLossCap: 1000 };
  const today = new Date(NOW).toISOString().slice(0, 10);
  const values = betChoices(cfg, { balance: 9000, gambleDay: today, gambleLoss: 800 }, "", NOW).map(c => c.value);
  assert.equal(Math.max(...values), 200, "only 200 of the loss limit is left");
  const fresh = betChoices(cfg, { balance: 9000, gambleDay: "2020-01-01", gambleLoss: 800 }, "", NOW).map(c => c.value);
  assert.equal(Math.max(...fresh), 1000, "yesterday's losses don't count");
});

test("quantity suggestions: the most that works first, round numbers, never over the cap", () => {
  assert.deepEqual(quantityChoices(7, "", q => `${q}`).map(c => c.value), [7, 1, 2, 5]);
  assert.deepEqual(quantityChoices(0, "", q => `${q}`).map(c => c.value), [1]);
  assert.deepEqual(quantityChoices(500, "", q => `${q}`, 100).map(c => c.value), [100, 1, 2, 5, 10, 25, 50]);
  assert.equal(quantityChoices(10, "999", q => `${q}`, 100)[0].value, 100);
});

test("member queue: one member's actions run one at a time; others aren't held up; a stuck one times out", async () => {
  const order: string[] = [];
  const slow = (tag: string, ms: number) => async () => { order.push(`${tag}+`); await sleep(ms); order.push(`${tag}-`); return tag; };
  const [a, b, c] = await Promise.all([
    withMemberLock(G, A, slow("a", 30)),
    withMemberLock(G, A, slow("b", 5)),
    withMemberLock(G, "other", slow("c", 5)),
  ]);
  assert.deepEqual([a, b, c].map(r => r.ok && r.value), ["a", "b", "c"]);
  assert.ok(order.indexOf("a-") < order.indexOf("b+"), "same member: b starts after a ends");
  assert.ok(order.indexOf("c+") < order.indexOf("a-"), "another member runs alongside");
  const stuck = withMemberLock(G, A, () => sleep(80));
  const gaveUp = await withMemberLock(G, A, async () => "never", 10);
  assert.deepEqual(gaveUp, { ok: false, reason: "busy" });
  await stuck;
  const failed = withMemberLock(G, A, async () => { throw new Error("boom"); });
  await assert.rejects(failed, /boom/);
  assert.equal((await withMemberLock(G, A, async () => 1)).ok, true, "a failed action doesn't block the queue");
  await sleep(5);
  assert.equal(lockedMemberCount(), 0, "the queue map empties");
});

test("race fix: two buys of a role item at once charge once when queued (and twice without the queue)", async () => {
  const run = async (queued: boolean) => {
    const { service, store } = memoryEconomy({ now: () => NOW });
    await store.setBalance(G, A, 1000);
    const added = await service.addItem(G, input({ name: "VIP", price: 300, roleId: "600000000000000009" }));
    assert.ok(added.ok);
    const id = added.ok ? added.value.id : "";
    const roles = new Set<string>();
    const hooks = {
      ownsRole: (r: string) => roles.has(r),
      grantRole: async (r: string) => { await sleep(5); roles.add(r); return null; },
    };
    const buy = () => service.buy(G, A, id, hooks);
    const results = queued
      ? (await Promise.all([withMemberLock(G, A, buy), withMemberLock(G, A, buy)])).map(r => r.ok && r.value)
      : await Promise.all([buy(), buy()]);
    return { ok: results.filter(r => r && r.ok).length, balance: (await store.account(G, A)).balance };
  };
  const unqueued = await run(false);
  assert.equal(unqueued.ok, 2, "the service alone lets both through (shared-helper issue, reported)");
  const queued = await run(true);
  assert.deepEqual(queued, { ok: 1, balance: 700 }, "queued: the second sees the role and is refused");
});

test("buy plan: friendly refusals before anything changes", () => {
  const acct = { balance: 1000, bank: 0 };
  assert.match((planBuy(CFG, null, 1, acct) as { content: string }).content, /isn't in the shop/);
  assert.match((planBuy(CFG, shopItem(), 0, acct) as { content: string }).content, /1 to 100/);
  assert.match((planBuy(CFG, shopItem(), MAX_TRADE_QUANTITY + 1, acct) as { content: string }).content, /1 to 100/);
  assert.match((planBuy(CFG, shopItem({ roleId: "1" }), 2, acct) as { content: string }).content, /one at a time/);
  assert.equal(planBuy(CFG, shopItem({ roleId: "1", useToGrant: true }), 2, acct).ok, true, "role passes given on /use stack");
  assert.match((planBuy(CFG, shopItem({ stock: 0 }), 1, acct) as { content: string }).content, /sold out/);
  assert.match((planBuy(CFG, shopItem({ stock: 3 }), 5, acct) as { content: string }).content, /Only 3 left/);
  assert.match((planBuy(CFG, shopItem({ perUserLimit: 2 }), 3, acct) as { content: string }).content, /at most 2/);
  const poor = planBuy(CFG, shopItem({ price: 300 }), 5, { balance: 700, bank: 900 }) as { content: string };
  assert.match(poor.content, /cost 🪙 1,500 coins.*You can afford 2\. You have enough in the bank/);
  assert.deepEqual(planBuy(CFG, shopItem(), 4, acct), { ok: true, item: shopItem(), quantity: 4, total: 400, wallet: 1000 });
});

test("buying several: each unit is a guarded buy, partial runs say where they stopped", async () => {
  const { service, store } = memoryEconomy({ now: () => NOW });
  await store.setBalance(G, A, 1000);
  const added = await service.addItem(G, input({ name: "Cookie", price: 100, stock: 10 }));
  assert.ok(added.ok);
  const item = added.ok ? added.value : shopItem();
  const plan = planBuy(CFG, item, 3, { balance: 1000, bank: 0 });
  assert.ok(plan.ok);
  const r = await buyPlanned(fakeGuild, A, "c", CFG, plan as Extract<typeof plan, { ok: true }>, service);
  const e = r.embed!.toJSON();
  assert.equal(r.ok, true);
  assert.match(e.description!, /bought \*\*3× Cookie\*\* for 🪙 300 coins/);
  assert.equal(e.fields!.find(f => f.name === "👛 Wallet")!.value, "🪙 700 coins");
  assert.equal(e.fields!.find(f => f.name === "Stock left")!.value, "7");
  assert.equal((await store.inventory(G, A))[0].quantity, 3);
  // The wallet drops between planning and buying: two go through, then it stops.
  const plan2 = planBuy(CFG, item, 5, { balance: 700, bank: 0 }) as Extract<ReturnType<typeof planBuy>, { ok: true }>;
  await store.setBalance(G, A, 250);
  const partial = await buyPlanned(fakeGuild, A, "c", CFG, plan2, service);
  assert.match(partial.embed!.toJSON().description!, /2× Cookie[\s\S]*Stopped after 2 of 5: It costs/);
  assert.equal((await store.account(G, A)).balance, 50);
});

test("selling several: checks what you own, pays per unit, reports the wallet", async () => {
  const { service, store } = memoryEconomy({ now: () => NOW });
  const cfg = { ...CFG, shopSellPercent: 50 };
  await store.saveConfig(G, cfg);
  await store.setBalance(G, A, 1000);
  const added = await service.addItem(G, input({ name: "Gem", price: 100 }));
  const id = added.ok ? added.value.id : "";
  for (let i = 0; i < 3; i++) assert.ok((await service.buy(G, A, id)).ok);
  assert.match((await sellMany(G, A, id, 4, cfg, service)).content!, /only have 3/);
  assert.match((await sellMany(G, A, "nope", 1, cfg, service)).content!, /don't have that item/);
  assert.match((await sellMany(G, A, id, 1, { ...cfg, shopSellPercent: 0 }, service)).content!, /turned off/);
  const r = await sellMany(G, A, id, 2, cfg, service);
  assert.match(r.embed!.toJSON().description!, /sold \*\*2× Gem\*\* for 🪙 100 coins \(50%/);
  assert.equal(r.embed!.toJSON().fields![0].value, "🪙 800 coins");
  assert.equal((await store.inventory(G, A))[0].quantity, 1);
});

test("buy helpers: most buyable, labels, role-on-purchase", () => {
  assert.equal(mostBuyable(shopItem({ price: 30 }), 100), 3);
  assert.equal(mostBuyable(shopItem({ price: 1, stock: 4 }), 100), 4);
  assert.equal(mostBuyable(shopItem({ price: 1, perUserLimit: 2 }), 100), 2);
  assert.equal(mostBuyable(shopItem({ price: 1 }), 10_000), MAX_TRADE_QUANTITY);
  assert.equal(mostBuyable(shopItem({ price: 50, roleId: "1" }), 1000), 1);
  assert.equal(mostBuyable(shopItem({ price: 50, roleId: "1" }), 10), 0);
  assert.equal(grantsOnPurchase(shopItem({ roleId: "1", useToGrant: true })), false);
  assert.equal(buyChoiceLabel(shopItem({ price: 1200, stock: 3, roleId: "1" }), "coins", 1000), "Cookie · 1,200 coins · role · 3 left · need 200 more");
  assert.equal(buyChoiceLabel(shopItem({ stock: 0 }), "coins", 0), "Cookie · 100 coins · sold out");
  assert.equal(buyChoiceLabel(shopItem({ effect: "work_boost" }), "gems", null), "Cookie · 100 gems · usable");
});

test("/shop edit: contradicting options and empty edits are refused", () => {
  const none = { role: false, clearRole: false, stock: false, unlimited: false, perUser: false, noUserLimit: false, roleHours: false, permanentRole: false, changes: 1 };
  assert.equal(editConflict(none), null);
  assert.match(editConflict({ ...none, changes: 0 })!, /Nothing to change/);
  assert.match(editConflict({ ...none, role: true, clearRole: true })!, /role/);
  assert.match(editConflict({ ...none, stock: true, unlimited: true })!, /stock/);
  assert.match(editConflict({ ...none, perUser: true, noUserLimit: true })!, /per_user_limit/);
  assert.match(editConflict({ ...none, roleHours: true, permanentRole: true })!, /role_hours/);
});

test("small helpers: bank refusals, pay room, bank tip, interest rate, /use labels", () => {
  const have = { wallet: 40, bank: 900 };
  assert.match(bankRefusalText(CFG, "deposit", "invalid", have), /2\.5k/);
  assert.match(bankRefusalText(CFG, "deposit", "insufficient", have), /only have 🪙 40 coins in your wallet/);
  assert.match(bankRefusalText(CFG, "withdraw", "empty", have), /bank is empty/);
  assert.match(bankRefusalText({ ...CFG, bankCap: 1000 }, "deposit", "bank_full", have), /room for 🪙 100 coins more/);
  const today = new Date(NOW).toISOString().slice(0, 10);
  assert.equal(sendRoomAfter(1000, today, 300, NOW), 700);
  assert.equal(sendRoomAfter(1000, "2020-01-01", 300, NOW), 1000);
  assert.equal(sendRoomAfter(0, today, 300, NOW), Number.POSITIVE_INFINITY);
  assert.equal(bankTip({ robEnabled: true, crimeEnabled: true }), "Coins in the bank are safe from /rob and /crime fines. Move them with /deposit and /withdraw.");
  assert.equal(bankTip({ robEnabled: false, crimeEnabled: false }), "Move them with /deposit and /withdraw.");
  assert.equal(interestRate({ bankInterestBps: 150 }), "1.5%");
  const row = { itemId: "i1", name: "Coffee", quantity: 2, roleId: null };
  assert.equal(useChoiceLabel(row, shopItem({ effect: "work_boost", effectHours: 2, effectPercent: 25 })), "Coffee ×2 · +25% work pay 2h");
  assert.equal(useChoiceLabel(row, undefined), "Coffee ×2 · no longer in the shop");
  assert.equal(isUsable(shopItem()), false);
  assert.equal(isUsable(shopItem({ roleId: "1", useToGrant: true })), true);
});

type Opt = { name: string; type: number; required?: boolean; autocomplete?: boolean; min_value?: number; max_value?: number; description: string; options?: Opt[] };

test("backward compatible: every original option keeps its name, type and required flag", () => {
  const before = snapshot as Record<string, string[]>;
  for (const [name, opts] of Object.entries(before)) {
    const now: string[] = [];
    const walk = (o: { options?: Opt[] }, p: string) => { for (const c of o.options ?? []) { now.push(`${p}${c.name}:${c.type}${c.required ? "!" : ""}`); walk(c, `${p}${c.name}/`); } };
    walk(commands.get(name)!.data.toJSON() as { options?: Opt[] }, "");
    for (const o of opts) assert.ok(now.includes(o), `/${name} ${o} is still there`);
  }
});

test("new options: quantities and amount autocomplete; every description fits Discord's 100 characters", () => {
  const json = (n: string) => commands.get(n)!.data.toJSON() as unknown as Opt;
  const sub = (n: string, s: string) => json(n).options!.find(o => o.name === s)!;
  for (const s of ["buy", "sell"]) {
    const q = sub("shop", s).options!.find(o => o.name === "quantity")!;
    assert.deepEqual([q.type, q.required ?? false, q.autocomplete, q.min_value, q.max_value], [4, false, true, 1, 100], s);
  }
  for (const n of ["deposit", "withdraw"]) assert.equal(json(n).options![0].autocomplete, true, n);
  const amount = json("pay").options!.find(o => o.name === "amount")!;
  assert.deepEqual([amount.autocomplete, amount.min_value, amount.max_value], [true, 1, MAX_BALANCE]);
  for (const g of ["coinflip", "slots", "dice"]) assert.equal(sub("gamble", g).options!.find(o => o.name === "bet")!.autocomplete, true, g);
  for (const n of Object.keys(snapshot)) {
    assert.equal(typeof commands.get(n)!.execute, "function");
    const walk = (o: Opt, p: string) => {
      assert.ok(o.description.length >= 1 && o.description.length <= 100, `${p}: ${o.description.length} chars`);
      for (const c of o.options ?? []) walk(c, `${p} ${c.name}`);
    };
    walk(json(n), `/${n}`);
  }
  for (const n of ["shop", "use", "pay", "gamble", "deposit", "withdraw"]) assert.equal(typeof commands.get(n)!.autocomplete, "function", n);
});
