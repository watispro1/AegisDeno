/**
 * Buy, sell and use as reusable actions, so /shop buy, /shop sell, /use and
 * the shortcut menus on /shop view and /inventory run the exact same
 * guarded service calls and say the same thing. Each returns the reply text
 * and whether it should be private; the caller decides how to send it.
 */
import type { ChatInputCommandInteraction, Guild, MessageComponentInteraction } from "discord.js";
import { economy } from "./economyService";
import { ECONOMY_OFF, grantShopRole } from "./economyDiscord";
import { formatCoins, relativeTimestamp, type EconomyConfig, type ShopItem } from "./economyLogic";
import { requestConfirmation } from "../utils/confirmation";

export interface ActionReply { ok: boolean; content: string; ephemeral: boolean }

/** Role hooks for buy/use: whether the member already has a role, and how to grant one. */
async function roleHooks(guild: Guild, userId: string, channelId: string, itemId: string) {
  const member = await guild.members.fetch(userId).catch(() => null);
  return {
    ownsRole: (roleId: string) => Boolean(member?.roles.cache.has(roleId)),
    grantRole: async (roleId: string, hours: number | null) => {
      const name = (await economy().item(guild.id, itemId))?.name ?? "item";
      return grantShopRole(guild, userId, roleId, { hours, channelId, itemName: name });
    },
  };
}

export async function buyAction(guild: Guild, userId: string, channelId: string, itemId: string, cfg: EconomyConfig): Promise<ActionReply> {
  const r = await economy().buy(guild.id, userId, itemId, await roleHooks(guild, userId, channelId, itemId));
  if (!r.ok) {
    const msg = r.reason === "not_found" ? "That item isn't in the shop. Pick one from the list."
      : r.reason === "sold_out" ? "That item is sold out."
      : r.reason === "limit" ? `You've reached the limit for that item (${r.limit} per member).`
      : r.reason === "already_owned" ? "You already have that role."
      : r.reason === "insufficient" ? `It costs ${formatCoins(cfg, r.price)} and you have ${formatCoins(cfg, r.balance)}.`
      : r.reason === "role_failed" ? `${r.detail} You were not charged.` : "That didn't work.";
    return { ok: false, content: `❌ ${msg}`, ephemeral: true };
  }
  const got = r.item.roleId && !r.item.useToGrant ? ` and got <@&${r.item.roleId}>${r.item.roleDurationHours ? ` for ${r.item.roleDurationHours}h` : ""}` : "";
  const hint = r.item.useToGrant ? " Run `/use` when you want its role." : r.item.effect ? " Run `/use` when you want its effect." : "";
  return { ok: true, content: `🛍️ You bought **${r.item.name}** for ${formatCoins(cfg, r.item.price)}${got}. Balance: ${formatCoins(cfg, r.balance)}.${hint}`, ephemeral: false };
}

export async function sellAction(guildId: string, userId: string, itemId: string, cfg: EconomyConfig): Promise<ActionReply> {
  const r = await economy().sellItem(guildId, userId, itemId);
  if (!r.ok) {
    const msg = r.reason === "off" ? "Selling items back is turned off in this server."
      : r.reason === "not_owned" ? "You don't have that item. Pick one from your inventory."
      : r.reason === "not_sellable" ? "That item can't be sold back (it's no longer in the shop, or its role was given on purchase)."
      : "Your balance is at the maximum, so nothing was sold.";
    return { ok: false, content: `❌ ${msg}`, ephemeral: true };
  }
  return { ok: true, content: `💱 Sold **${r.item.name}** for ${formatCoins(cfg, r.price)} (${cfg.shopSellPercent}% of its price). Balance: ${formatCoins(cfg, r.balance)}.`, ephemeral: true };
}

export async function useAction(guild: Guild, userId: string, channelId: string, itemId: string): Promise<ActionReply> {
  const r = await economy().useItem(guild.id, userId, itemId, await roleHooks(guild, userId, channelId, itemId));
  if (!r.ok) {
    const msg = r.reason === "not_owned" ? "You don't have that item. Pick one from your inventory."
      : r.reason === "role_failed" ? `${r.detail} You kept the item.`
      : r.reason === "refused" ? r.detail
      : r.reason === "boost_active" ? `You already have a work boost running (ends ${relativeTimestamp(r.until)}). Boosts don't stack, so you kept the item.`
      : r.reason === "shield_max" ? "Your shield already lasts nearly 30 days, the most it can. You kept the item."
      : r.reason === "busy" ? "Your account changed while that was running. You kept the item; run it again."
      : "That item can't be used.";
    return { ok: false, content: `❌ ${msg}`, ephemeral: true };
  }
  if ("until" in r) {
    const what = r.item.effect === "rob_shield" ? "🛡️ You're shielded from /rob" : `⚡ Your /work pay is boosted by ${r.percent}%`;
    // Shields and boosts stay private so robbers can't read them off a public reply.
    return { ok: true, content: `${what} until ${relativeTimestamp(r.until.getTime())} (used **${r.item.name}**).`, ephemeral: true };
  }
  const length = r.item.roleDurationHours ? ` for ${r.item.roleDurationHours}h` : "";
  return { ok: true, content: `✨ You used **${r.item.name}** and got <@&${r.item.roleId}>${length}.`, ephemeral: false };
}

/** Run a shortcut only while the economy is still on (it may be switched off while a menu is open). */
export async function whileEnabled(guildId: string, action: () => Promise<ActionReply>): Promise<ActionReply> {
  const cfg = await economy().config(guildId);
  return cfg.enabled ? action() : { ok: false, content: ECONOMY_OFF, ephemeral: true };
}

/** The confirmation text for a shortcut-menu purchase. Pure, for tests. */
export function buyPrompt(cfg: EconomyConfig, item: Pick<ShopItem, "name" | "price">, balance: number): string {
  const after = balance - item.price;
  return after >= 0
    ? `Buy **${item.name}** for ${formatCoins(cfg, item.price)}? You'll have ${formatCoins(cfg, after)} left.`
    : `**${item.name}** costs ${formatCoins(cfg, item.price)}, but you only have ${formatCoins(cfg, balance)} in your wallet.`;
}

/**
 * Ask the member (privately) to confirm a shortcut-menu action, then run it
 * and show the result in the same private message. Returns the result, or
 * null when they cancelled or didn't answer.
 */
export async function confirmShortcut(
  i: MessageComponentInteraction,
  prompt: string,
  confirmLabel: string,
  action: () => Promise<ActionReply>,
): Promise<ActionReply | null> {
  // requestConfirmation only uses reply/editReply/id/user, which component interactions share.
  const answer = await requestConfirmation(i as unknown as ChatInputCommandInteraction, { content: prompt, confirmLabel });
  if (answer !== "confirmed") return null;
  const result = await action();
  await i.editReply({ content: result.content, components: [], allowedMentions: { parse: [] } }).catch(() => null);
  return result;
}
