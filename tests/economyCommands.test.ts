import { test, before } from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits } from "discord.js";
import { commands, loadCommands, COMMAND_CATEGORIES } from "../src/commands/loader";
import { leaderboardLines } from "../src/commands/economy/leaderboard";
import { DEFAULT_ECONOMY_CONFIG } from "../src/services/economyLogic";
import { buildCatalog, clearCatalogCache, groupByCategory } from "../src/web/catalog";

type Opt = { name: string; type: number; autocomplete?: boolean; options?: Opt[]; min_value?: number; max_value?: number };
const json = (name: string) => commands.get(name)!.data.toJSON() as { name: string; contexts?: number[]; default_member_permissions?: string | null; options?: Opt[] };

before(async () => {
  await loadCommands();
  clearCatalogCache();
});

test("economy commands load in their own category, guild-only", () => {
  assert.ok((COMMAND_CATEGORIES as readonly string[]).includes("economy"));
  for (const name of ["balance", "daily", "work", "pay", "leaderboard", "shop", "inventory", "economy"]) {
    const cmd = commands.get(name);
    assert.ok(cmd, name);
    assert.equal(cmd!.category, "economy", name);
    assert.equal(cmd!.guildOnly, true, name);
    assert.deepEqual(json(name).contexts, [0], `${name} is offered in servers only`);
  }
  const group = groupByCategory(buildCatalog()).find(g => g.category === "economy");
  assert.ok(group && group.label === "Economy" && group.commands.length === 8);
});

test("/economy is Manage Server; /shop staff subcommands are checked inside; shop items autocomplete", () => {
  const eco = json("economy");
  assert.equal(eco.default_member_permissions, String(PermissionFlagsBits.ManageGuild));
  assert.deepEqual(commands.get("economy")!.userPermissions, [PermissionFlagsBits.ManageGuild]);
  assert.deepEqual(eco.options!.map(o => o.name), ["toggle", "config", "give", "take", "reset"]);
  const shop = json("shop");
  assert.equal(shop.default_member_permissions ?? null, null, "members can view and buy");
  assert.deepEqual(shop.options!.map(o => o.name), ["view", "buy", "add", "remove", "edit"]);
  for (const sub of ["buy", "remove", "edit"]) {
    assert.equal(shop.options!.find(o => o.name === sub)!.options!.find(o => o.name === "item")!.autocomplete, true, sub);
  }
  assert.equal(typeof commands.get("shop")!.autocomplete, "function");
  const amount = json("pay").options!.find(o => o.name === "amount")!;
  assert.equal(amount.min_value, 1);
  assert.equal(amount.max_value, 1_000_000_000_000);
});

test("leaderboard lines show mentions (rendered, never pinged) with ranks and medals", () => {
  const lines = leaderboardLines([{ userId: "1", balance: 5000 }, { userId: "2", balance: 10 }], 0, DEFAULT_ECONOMY_CONFIG, "2");
  assert.equal(lines[0], "🥇 <@1> · 🪙 5,000 coins");
  assert.equal(lines[1], "🥈 <@2> · 🪙 10 coins ← you");
  assert.equal(leaderboardLines([{ userId: "9", balance: 1 }], 10, DEFAULT_ECONOMY_CONFIG, "x")[0], "**11.** <@9> · 🪙 1 coins");
});
