/**
 * Autocomplete for `/unban user_id`: the server's banned users, searchable by
 * name, ID or ban reason, so moderators no longer need Developer Mode to copy
 * an ID. The ban list is cached for 30 seconds per guild so typing does not
 * hit Discord on every keystroke.
 */
import { PermissionFlagsBits, type AutocompleteInteraction, type Guild } from "discord.js";
import { rankChoices, type AutocompleteItem } from "../../../utils/autocomplete";
import { TtlCache } from "../../../utils/ttlCache";
import { stripTempBanMarker } from "./prompt";

export interface BanLike {
  user: { id: string; username: string; tag?: string; globalName?: string | null };
  reason?: string | null;
}

/** One choice: "name (id) · reason", with the ID as the value. Pure. */
export function banChoice(ban: BanLike): AutocompleteItem {
  const reason = stripTempBanMarker(ban.reason).replace(/\s+/g, " ").trim();
  const temp = /^\[temp:/i.test(ban.reason ?? "");
  const display = ban.user.globalName && ban.user.globalName !== ban.user.username
    ? `${ban.user.globalName} (@${ban.user.username})`
    : `@${ban.user.username}`;
  return {
    name: `${display} · ${ban.user.id}${temp ? " · temp" : ""}${reason ? ` · ${reason.slice(0, 40)}` : ""}`,
    value: ban.user.id,
    keywords: `${ban.user.username} ${ban.user.globalName ?? ""} ${reason}`,
  };
}

const banCache = new TtlCache<AutocompleteItem[]>(30_000, 500);

async function loadBans(guild: Guild): Promise<AutocompleteItem[]> {
  // One page of 1,000 is plenty for picking by name; an ID can always be pasted.
  const bans = await guild.bans.fetch({ limit: 1000, cache: false }).catch(() => null);
  if (!bans) return [];
  return [...bans.values()].map(b => banChoice({ user: b.user, reason: b.reason }));
}

/** Forget a guild's cached ban list (after an unban, so it drops out of the list). */
export function forgetBanList(guildId: string): void {
  banCache.delete(guildId);
}

export async function respondBannedUsers(interaction: AutocompleteInteraction): Promise<void> {
  // Autocomplete skips the executor's permission check: ban reasons are staff-only.
  if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
    await interaction.respond([]);
    return;
  }
  const guild = interaction.guild;
  const items = await banCache.getOrLoad(guild.id, () => loadBans(guild)).catch(() => []);
  const typed = String(interaction.options.getFocused() ?? "").replace(/[<@!>]/g, "");
  await interaction.respond(rankChoices(items, typed));
}
