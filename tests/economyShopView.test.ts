import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ECONOMY_CONFIG, type ShopItem } from "../src/services/economyLogic";
import { SHOP_PAGE_SIZE, arrangeShop, buyChoices, inventorySellValue, shopFooter, shopItemLine } from "../src/services/economyShopView";
import { buyPrompt } from "../src/services/economyItemActions";
import { roleSummary } from "../src/commands/economy/shop";

const cfg = DEFAULT_ECONOMY_CONFIG;
let n = 0;
const item = (name: string, price: number, extra: Partial<ShopItem> = {}): ShopItem => ({
  id: (++n).toString(16).padStart(24, "0"), guildId: "g", name, description: "", price, roleId: null, stock: null,
  createdAt: new Date(0), perUserLimit: null, roleDurationHours: null, useToGrant: false, effect: null, effectHours: null, effectPercent: null, ...extra,
});

const items = [item("Banana", 50), item("apple", 500), item("Crown", 9000, { stock: 0 }), item("Drum", 50, { stock: 3 })];

test("shop sort: price both ways (sold out sinks, ties by name) and name A-Z", () => {
  assert.deepEqual(arrangeShop(items).map(i => i.name), ["Banana", "Drum", "apple", "Crown"]);
  assert.deepEqual(arrangeShop(items, { sort: "price_desc" }).map(i => i.name), ["apple", "Banana", "Drum", "Crown"]);
  assert.deepEqual(arrangeShop(items, { sort: "name" }).map(i => i.name), ["apple", "Banana", "Crown", "Drum"]);
});

test("shop filters: affordable only and in stock only; input is not mutated", () => {
  const before = items.map(i => i.name);
  assert.deepEqual(arrangeShop(items, { show: "affordable", balance: 100 }).map(i => i.name), ["Banana", "Drum"]);
  assert.deepEqual(arrangeShop(items, { show: "affordable", balance: 0 }), []);
  assert.deepEqual(arrangeShop(items, { show: "affordable", balance: 1e9 }).map(i => i.name), ["Banana", "Drum", "apple"], "sold out is never affordable");
  assert.deepEqual(arrangeShop(items, { show: "in_stock" }).length, 3);
  assert.deepEqual(items.map(i => i.name), before);
});

test("shop lines show stock, sold out and an affordability mark; pages stay well under the embed limit", () => {
  assert.match(shopItemLine(cfg, items[3], 100), /^✅ \*\*Drum\*\* · .*3 left/);
  assert.match(shopItemLine(cfg, items[1], 100), /^🔒 /);
  assert.match(shopItemLine(cfg, items[2], 1e9), /^\*\*Crown\*\*.*\*\*sold out\*\*/);
  const big = Array.from({ length: SHOP_PAGE_SIZE }, (_, k) => item(`${"x".repeat(38)}${k}`, 1e12, {
    description: "d".repeat(200), roleId: "123456789012345678", roleDurationHours: 8760, useToGrant: true, stock: 999_999, perUserLimit: 1000,
  }));
  assert.ok(big.map(i => shopItemLine(cfg, i, 0)).join("\n\n").length < 4096);
  assert.equal(roleSummary({ roleId: "1", roleDurationHours: 2, useToGrant: true }), " · gives <@&1> for 2h on `/use`");
});

test("buy menu skips sold-out items, caps at 25 and flags what can't be afforded", () => {
  const choices = buyChoices(cfg, items, 100);
  assert.deepEqual(choices.map(c => c.label), ["Banana", "apple", "Drum"]);
  assert.match(choices[1].description, /can't afford/);
  assert.match(choices[2].description, /3 left/);
  assert.equal(buyChoices(cfg, Array.from({ length: 40 }, (_, k) => item(`i${k}`, 1)), 0).length, 25);
  assert.ok(choices.every(c => c.description.length <= 100 && !c.description.includes("**")));
});

test("buy prompt and footer text", () => {
  assert.equal(buyPrompt(cfg, { name: "Drum", price: 50 }, 80), "Buy **Drum** for 🪙 50 coins? You'll have 🪙 30 coins left.");
  assert.match(buyPrompt(cfg, { name: "Drum", price: 50 }, 10), /only have/);
  assert.equal(shopFooter(cfg, 4, 4, 5, "all"), "4 items · Your wallet: 🪙 5 coins");
  assert.equal(shopFooter(cfg, 2, 4, 5, "affordable"), "2 of 4 items (only what i can afford) · Your wallet: 🪙 5 coins");
});

test("inventory sell value follows the shop's sell rules", () => {
  assert.equal(inventorySellValue(item("a", 101), 50), 50);
  assert.equal(inventorySellValue(undefined, 50), null, "removed from the shop");
  assert.equal(inventorySellValue(item("a", 100, { roleId: "1" }), 50), null, "role already given on purchase");
  assert.equal(inventorySellValue(item("a", 100, { roleId: "1", useToGrant: true }), 50), 50);
  assert.equal(inventorySellValue(item("a", 100), 0), null, "selling off");
});
