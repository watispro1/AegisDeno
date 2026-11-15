/**
 * /shop buy and /shop sell with a quantity. Each unit still goes through the
 * service's guarded single-unit buy or sell (limit, stock, coins and role in
 * that order, each undone if a later step fails), so a run that stops part
 * way leaves everything consistent and the reply says how many went through.
 *
 * Checks that can be answered up front (sold out, not enough coins, a role
 * item bought twice) are answered privately before anything changes.
 */
import type { AutocompleteInteraction, Guild } from "discord.js";
import { economy, type BuyOutcome, type EconomyService } from "../../../services/economyService";
import { grantShopRole } from "../../../services/economyDiscord";
import { formatCoins, type EconomyConfig, type ShopItem } from "../../../services/economyLogic";
import { sellPrice } from "../../../services/economyRules";
import { rankChoices } from "../../../utils/autocomplete";
import { quantityChoices } from "./amounts";
import { economyEmbed } from "./ui";
import type { EmbedBuilder } from "discord.js";

/** Most units one /shop buy or /shop sell handles. */
export const MAX_TRADE_QUANTITY = 100;

export type TradeReply = { ok: boolean; ephemeral: boolean; content?: string; embed?: EmbedBuilder };

export type BuyPlan =
  | { ok: true; item: ShopItem; quantity: number; total: number; wallet: number }
  | { ok: false; content: string };

const plural = (q: number, word: string) => `${q.toLocaleString("en-US")} ${word}${q === 1 ? "" : "s"}`;

/** Whether an item hands out its role the moment it is bought. */
export function grantsOnPurchase(item: Pick<ShopItem, "roleId" | "useToGrant">): boolean {
  return Boolean(item.roleId) && !item.useToGrant;
}

/** Up-front checks for buying `quantity` of an item. Pure, for tests. */
export function planBuy(cfg: EconomyConfig, item: ShopItem | null, quantity: number, account: { balance: number; bank: number }): BuyPlan {
  if (!item) return { ok: false, content: "❌ That item isn't in the shop. Pick one from the list." };
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_TRADE_QUANTITY) {
    return { ok: false, content: `❌ You can buy 1 to ${MAX_TRADE_QUANTITY} at a time.` };
  }
  if (quantity > 1 && grantsOnPurchase(item)) {
    return { ok: false, content: `❌ **${item.name}** gives a role when you buy it, so it can only be bought one at a time.` };
  }
  if (item.stock !== null && item.stock < quantity) {
    return { ok: false, content: item.stock === 0 ? "❌ That item is sold out." : `❌ Only ${item.stock.toLocaleString("en-US")} left. Buy ${item.stock.toLocaleString("en-US")} or fewer.` };
  }
  if (item.perUserLimit !== null && quantity > item.perUserLimit) {
    return { ok: false, content: `❌ Each member can buy at most ${item.perUserLimit.toLocaleString("en-US")} of **${item.name}**.` };
  }
  const total = item.price * quantity;
  if (account.balance < total) {
    const afford = Math.floor(account.balance / item.price);
    const bankHint = account.bank > 0 && account.balance + account.bank >= total ? " You have enough in the bank: `/withdraw` some first." : "";
    const can = afford > 0 && quantity > 1 ? ` You can afford ${afford.toLocaleString("en-US")}.` : "";
    return { ok: false, content: `❌ ${quantity > 1 ? `${plural(quantity, "unit")} of **${item.name}** cost` : `**${item.name}** costs`} ${formatCoins(cfg, total)} and you have ${formatCoins(cfg, account.balance)} in your wallet.${can}${bankHint}` };
  }
  return { ok: true, item, quantity, total, wallet: account.balance };
}

/** Why one unit couldn't be bought, in words. */
export function buyFailureText(cfg: EconomyConfig, r: Exclude<BuyOutcome, { ok: true }>): string {
  switch (r.reason) {
    case "not_found": return "That item isn't in the shop any more.";
    case "sold_out": return "It sold out.";
    case "limit": return `You reached the limit for that item (${r.limit} per member).`;
    case "already_owned": return "You already have that role.";
    case "insufficient": return `It costs ${formatCoins(cfg, r.price)} and you have ${formatCoins(cfg, r.balance)}.`;
    case "role_failed": return `${r.detail} You were not charged for it.`;
  }
}

/** Buy the planned units one at a time; stops at the first refusal and reports what went through. */
export async function buyPlanned(guild: Guild, userId: string, channelId: string, cfg: EconomyConfig, plan: Extract<BuyPlan, { ok: true }>, svc: EconomyService = economy()): Promise<TradeReply> {
  const member = await guild.members.fetch(userId).catch(() => null);
  const hooks = {
    ownsRole: (roleId: string) => Boolean(member?.roles.cache.has(roleId)),
    grantRole: (roleId: string, hours: number | null) => grantShopRole(guild, userId, roleId, { hours, channelId, itemName: plan.item.name }),
  };
  let bought = 0;
  let wallet = plan.wallet;
  let item = plan.item;
  let stop: string | null = null;
  for (let i = 0; i < plan.quantity; i++) {
    const r = await svc.buy(guild.id, userId, plan.item.id, hooks);
    if (!r.ok) { stop = buyFailureText(cfg, r); break; }
    bought++;
    wallet = r.balance;
    item = r.item;
  }
  if (bought === 0) return { ok: false, ephemeral: true, content: `❌ ${stop ?? "That didn't work."}` };
  const role = grantsOnPurchase(item) ? ` and got <@&${item.roleId}>${item.roleDurationHours ? ` for ${item.roleDurationHours}h` : ""}` : "";
  const hint = item.useToGrant ? "Run /use when you want its role." : item.effect ? "Run /use when you want its effect." : null;
  const what = bought === 1 ? `**${item.name}**` : `**${bought.toLocaleString("en-US")}× ${item.name}**`;
  const partial = bought < plan.quantity ? `\n⚠️ Stopped after ${bought} of ${plan.quantity}: ${stop}` : "";
  return {
    ok: true,
    ephemeral: false,
    embed: economyEmbed(cfg, {
      tone: partial ? "warn" : "ok",
      title: "🛍️ Purchase complete",
      description: `You bought ${what} for ${formatCoins(cfg, item.price * bought)}${role}.${partial}`,
      balance: { wallet },
      fields: item.stock === null ? [] : [{ name: "Stock left", value: item.stock.toLocaleString("en-US"), inline: true }],
      footer: hint,
    }),
  };
}

/** Sell up to `quantity` of an item back; stops at the first refusal. */
export async function sellMany(guildId: string, userId: string, itemId: string, quantity: number, cfg: EconomyConfig, svc: EconomyService = economy()): Promise<TradeReply> {
  if (cfg.shopSellPercent <= 0) return { ok: false, ephemeral: true, content: "❌ Selling items back is turned off in this server." };
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_TRADE_QUANTITY) {
    return { ok: false, ephemeral: true, content: `❌ You can sell 1 to ${MAX_TRADE_QUANTITY} at a time.` };
  }
  const owned = (await svc.inventory(guildId, userId)).find(r => r.itemId === itemId);
  if (!owned) return { ok: false, ephemeral: true, content: "❌ You don't have that item. Pick one from your inventory." };
  if (owned.quantity < quantity) {
    return { ok: false, ephemeral: true, content: `❌ You only have ${owned.quantity.toLocaleString("en-US")} of **${owned.name}**.` };
  }
  let sold = 0;
  let earned = 0;
  let wallet: number | null = null;
  let name = owned.name;
  let stop: string | null = null;
  for (let i = 0; i < quantity; i++) {
    const r = await svc.sellItem(guildId, userId, itemId);
    if (!r.ok) {
      stop = r.reason === "off" ? "Selling items back is turned off in this server."
        : r.reason === "not_owned" ? "You don't have any more of that item."
        : r.reason === "not_sellable" ? "That item can't be sold back (it's no longer in the shop, or its role was given on purchase)."
        : "Your balance is at the maximum, so nothing more was sold.";
      break;
    }
    sold++;
    earned += r.price;
    wallet = r.balance;
    name = r.item.name;
  }
  if (sold === 0) return { ok: false, ephemeral: true, content: `❌ ${stop ?? "That didn't work."}` };
  const partial = sold < quantity ? `\n⚠️ Stopped after ${sold} of ${quantity}: ${stop}` : "";
  return {
    ok: true,
    ephemeral: true,
    embed: economyEmbed(cfg, {
      tone: partial ? "warn" : "ok",
      title: "💱 Sold",
      description: `You sold ${sold === 1 ? `**${name}**` : `**${sold}× ${name}**`} for ${formatCoins(cfg, earned)} (${cfg.shopSellPercent}% of the price).${partial}`,
      balance: { wallet },
    }),
  };
}

/** Shop item suggestions for /shop buy: price, stock, and whether the member can afford it now. */
export async function buyItemAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  if (!interaction.guildId) return interaction.respond([]);
  const [items, cfg, acct] = await Promise.all([
    economy().items(interaction.guildId).catch(() => [] as ShopItem[]),
    economy().config(interaction.guildId).catch(() => null),
    economy().balance(interaction.guildId, interaction.user.id).catch(() => null),
  ]);
  const wallet = acct?.balance ?? null;
  const choices = rankChoices(items.map(i => ({
    name: buyChoiceLabel(i, cfg?.currencyName ?? "coins", wallet),
    value: i.id,
    keywords: i.description,
  })), String(interaction.options.getFocused() ?? ""));
  await interaction.respond(choices).catch(() => undefined);
}

/** "VIP pass · 1,200 coins · role · 3 left · need 200 more". Pure, for tests. */
export function buyChoiceLabel(i: ShopItem, currency: string, wallet: number | null): string {
  const stock = i.stock === null ? "" : i.stock === 0 ? " · sold out" : ` · ${i.stock.toLocaleString("en-US")} left`;
  const afford = wallet === null || i.stock === 0 ? "" : wallet >= i.price ? "" : ` · need ${(i.price - wallet).toLocaleString("en-US")} more`;
  return `${i.name} · ${i.price.toLocaleString("en-US")} ${currency}${i.roleId ? " · role" : i.effect ? " · usable" : ""}${stock}${afford}`;
}

/** Quantity suggestions: how many the member can buy (or sell) right now, plus round numbers. */
export async function quantityAutocomplete(interaction: AutocompleteInteraction, mode: "buy" | "sell"): Promise<void> {
  const guildId = interaction.guildId;
  const itemId = interaction.options.getString("item");
  const typed = String(interaction.options.getFocused() ?? "");
  if (!guildId || !itemId) return interaction.respond(quantityChoices(1, typed, q => `${q}`)).catch(() => undefined);
  const [cfg, item, acct, inv] = await Promise.all([
    economy().config(guildId).catch(() => null),
    economy().item(guildId, itemId).catch(() => null),
    economy().balance(guildId, interaction.user.id).catch(() => null),
    mode === "sell" ? economy().inventory(guildId, interaction.user.id).catch(() => []) : Promise.resolve([]),
  ]);
  if (!cfg || !item) return interaction.respond(quantityChoices(1, typed, q => `${q}`)).catch(() => undefined);
  if (mode === "buy") {
    const most = mostBuyable(item, acct?.balance ?? 0);
    return interaction.respond(quantityChoices(most, typed, q => `${q} × ${item.name} = ${formatCoins(cfg, q * item.price)}${q === most && most > 1 ? " (most you can buy)" : ""}`, MAX_TRADE_QUANTITY)).catch(() => undefined);
  }
  const owned = inv.find(r => r.itemId === itemId)?.quantity ?? 0;
  const each = sellPrice(item, cfg.shopSellPercent) ?? 0;
  return interaction.respond(quantityChoices(owned, typed, q => `${q} × ${item.name} → ${formatCoins(cfg, q * each)}${q === owned && owned > 1 ? " (all you have)" : ""}`, MAX_TRADE_QUANTITY)).catch(() => undefined);
}

/** The most units of an item a wallet can buy in one go (role-on-purchase items: one). Pure, for tests. */
export function mostBuyable(item: Pick<ShopItem, "price" | "stock" | "perUserLimit" | "roleId" | "useToGrant">, wallet: number): number {
  if (grantsOnPurchase(item)) return wallet >= item.price ? 1 : 0;
  const caps = [MAX_TRADE_QUANTITY, Math.floor(wallet / Math.max(1, item.price))];
  if (item.stock !== null) caps.push(item.stock);
  if (item.perUserLimit !== null) caps.push(item.perUserLimit);
  return Math.max(0, Math.min(...caps));
}
