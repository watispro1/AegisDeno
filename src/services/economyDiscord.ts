/**
 * Discord glue for the economy commands: the "economy is off" gate, the
 * mod-log entry for staff adjustments, role checks for role items, and
 * shop autocomplete.
 */
import {
  MessageFlags,
  PermissionFlagsBits,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type Guild,
} from "discord.js";
import { sendGuildLog } from "./logging";
import { economy, type AdjustAction, type AdjustEvent } from "./economyService";
import { dangerousPermissionNames, formatCoins, roleItemRefusal, type EconomyConfig } from "./economyLogic";
import { rankChoices } from "../utils/autocomplete";
import { logger } from "../utils/logger";
import { scheduleTempRoleRemoval } from "./tempRole";

/** Replies to economy commands never ping anyone unless a command opts in. */
export const NO_PINGS = { parse: [] as never[] };

export const ECONOMY_OFF =
  "💤 The economy is switched off in this server. A server manager can turn it on with `/economy toggle` or on the dashboard's Economy page.";

/** The server's economy settings when the economy is on; otherwise replies (ephemeral) and returns null. */
export async function economyGate(interaction: ChatInputCommandInteraction): Promise<EconomyConfig | null> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: "❌ The economy only works in a server.", flags: MessageFlags.Ephemeral });
    return null;
  }
  const cfg = await economy().config(guildId);
  if (!cfg.enabled) {
    await interaction.reply({ content: ECONOMY_OFF, flags: MessageFlags.Ephemeral });
    return null;
  }
  return cfg;
}

const ACTION_TITLE: Record<AdjustAction, string> = { give: "➕ Coins given", take: "➖ Coins taken", reset: "♻️ Balance reset" };

/** Mod-log entry for a staff balance change (no pings). */
export async function postAdjustLog(client: Client, event: AdjustEvent, actorTag: string, source: "command" | "dashboard"): Promise<void> {
  const cfg = await economy().config(event.guildId).catch(() => null);
  const fmt = (n: number) => (cfg ? formatCoins(cfg, n) : n.toLocaleString("en-US"));
  await sendGuildLog(client, event.guildId, {
    title: ACTION_TITLE[event.action],
    color: event.action === "give" ? 0x57f287 : 0xfee75c,
    description: [
      `**Member:** <@${event.userId}> (\`${event.userId}\`)`,
      `**${event.action === "reset" ? "Removed" : "Amount"}:** ${fmt(event.amount)}`,
      `**New balance:** ${fmt(event.balance)}`,
      `**By:** ${actorTag} (\`${event.actorId}\`)${source === "dashboard" ? " on the dashboard" : ""}`,
      event.reason ? `**Reason:** ${event.reason}` : null,
    ].filter(Boolean).join("\n"),
  }, "modActions");
}

/** Hand a dashboard adjustment to the mod log. */
export function dashboardAdjustLogger(client: Client) {
  return async (event: AdjustEvent) => {
    const actor = await client.users.fetch(event.actorId).catch(() => null);
    await postAdjustLog(client, event, actor?.tag ?? event.actorId, "dashboard");
  };
}

/** Whether Aegis may sell `roleId` in this guild, with the staff member's rank. Returns a refusal or null. */
export async function shopRoleRefusal(guild: Guild, roleId: string, actorId: string): Promise<string | null> {
  const role = guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
  if (!role) return "That role no longer exists.";
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) return "Aegis needs the Manage Roles permission to sell roles.";
  const actor = await guild.members.fetch(actorId).catch(() => null);
  return roleItemRefusal(
    { id: role.id, position: role.position, managed: role.managed, permissions: role.permissions.bitfield },
    { guildId: guild.id, botTopPosition: me.roles.highest.position, actorTopPosition: actor?.roles.highest.position ?? null, actorIsOwner: guild.ownerId === actorId },
  );
}

/**
 * Give a role from the shop (on purchase or /use). Re-checks that Aegis can
 * still assign it right now (the role may have moved since it was listed).
 * A timed role gets a temprole_remove task, so it shows in /temprole list
 * and comes off like any temporary role; if that task can't be saved the
 * role is taken back and the caller refunds.
 */
export async function grantShopRole(guild: Guild, userId: string, roleId: string, timed?: { hours: number | null; channelId: string; itemName: string }): Promise<string | null> {
  const role = guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
  if (!role) return "The role for this item was deleted. Ask staff to fix the shop.";
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles) || role.managed || role.position >= me.roles.highest.position) {
    return "Aegis can't hand out that role any more (it is above Aegis's role, or Aegis lacks Manage Roles). Ask staff to fix the shop.";
  }
  // Checked again at grant time: staff may have given the role new permissions after it was listed.
  if (dangerousPermissionNames(role.permissions.bitfield).length) {
    return "That item's role now has staff permissions, so Aegis won't hand it out. Ask staff to fix the shop.";
  }
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return "Couldn't find you in this server.";
  try {
    await member.roles.add(role, "Bought in the Aegis economy shop");
  } catch {
    return "Discord refused to add the role. Ask staff to check Aegis's permissions.";
  }
  if (!timed?.hours) return null;
  const now = Date.now();
  try {
    await scheduleTempRoleRemoval(guild.client, {
      guildId: guild.id, channelId: timed.channelId, userId, executeAt: new Date(now + timed.hours * 3_600_000),
      payload: {
        roleId, moderatorId: guild.client.user?.id ?? "", moderatorTag: "Aegis shop", reason: `Shop item: ${timed.itemName}`.slice(0, 200),
        durationSeconds: timed.hours * 3600, caseId: null, setAt: now,
      },
    });
    return null;
  } catch (err) {
    logger.warn(`Economy: could not schedule removal of shop role ${roleId} for ${userId} in ${guild.id}`, err);
    await member.roles.remove(role, "Shop role timer could not be saved").catch(() => undefined);
    return "Couldn't start the timer for that role, so it wasn't given.";
  }
}

/** Autocomplete for items in the member's own inventory (/use, /shop sell); value is the item ID. */
export async function inventoryAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  if (!interaction.guildId) return interaction.respond([]);
  const rows = await economy().inventory(interaction.guildId, interaction.user.id).catch(() => []);
  const choices = rankChoices(rows.map(r => ({
    name: `${r.name}${r.quantity > 1 ? ` ×${r.quantity}` : ""}${r.roleId ? " · role" : ""}`,
    value: r.itemId,
  })), String(interaction.options.getFocused() ?? ""));
  await interaction.respond(choices).catch(() => undefined);
}

/** Autocomplete for shop item options: name, price and stock; value is the item ID. */
export async function shopItemAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  if (!interaction.guildId) return interaction.respond([]);
  const [items, cfg] = await Promise.all([
    economy().items(interaction.guildId).catch(() => []),
    economy().config(interaction.guildId).catch(() => null),
  ]);
  const choices = rankChoices(items.map(i => ({
    name: `${i.name} · ${cfg ? `${i.price.toLocaleString("en-US")} ${cfg.currencyName}` : i.price}${i.roleId ? " · role" : ""}${i.stock === null ? "" : i.stock === 0 ? " · sold out" : ` · ${i.stock} left`}`,
    value: i.id,
    keywords: i.description,
  })), String(interaction.options.getFocused() ?? ""));
  await interaction.respond(choices).catch(() => undefined);
}

/**
 * "🪙 1,250 coins" for /userinfo when the economy is on, else null. Bounded
 * by `timeoutMs` so a slow database never delays the reply past Discord's
 * 3-second window.
 */
export async function balanceSummary(guildId: string, userId: string, timeoutMs = 1200): Promise<string | null> {
  const lookup = (async () => {
    const cfg = await economy().config(guildId);
    if (!cfg.enabled) return null;
    return formatCoins(cfg, (await economy().balance(guildId, userId)).balance);
  })().catch(() => null);
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), timeoutMs); });
  try {
    return await Promise.race([lookup, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
