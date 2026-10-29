/**
 * Who may use the dashboard for a server: its owner, or anyone holding
 * Administrator or Manage Server. Pure helpers, unit-tested.
 */
import { PermissionFlagsBits } from "discord.js";

export const DASHBOARD_PERMISSION_BITS = PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild;

/** A guild as returned by Discord's GET /users/@me/guilds. */
export interface OAuthGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  /** Permission bitfield as a decimal string. */
  permissions: string;
}

function toBigInt(value: string | bigint | number | null | undefined): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : 0n;
  if (typeof value === "string" && /^\d{1,30}$/.test(value)) return BigInt(value);
  return 0n;
}

/** True when the bitfield includes Administrator or Manage Server, or the user owns the server. */
export function canManageGuild(permissions: string | bigint | number | null | undefined, isOwner = false): boolean {
  if (isOwner) return true;
  return (toBigInt(permissions) & DASHBOARD_PERMISSION_BITS) !== 0n;
}

const SNOWFLAKE = /^\d{17,20}$/;

export function isSnowflake(value: unknown): value is string {
  return typeof value === "string" && SNOWFLAKE.test(value);
}

export interface GuildPartition {
  /** Servers the user manages and Aegis is in: open these in the dashboard. */
  manageable: OAuthGuild[];
  /** Servers the user manages without Aegis: offer the invite. */
  invitable: OAuthGuild[];
}

/** Split the user's guild list into dashboard servers and invite candidates; everything else is dropped. */
export function partitionGuilds(guilds: readonly OAuthGuild[], botHasGuild: (id: string) => boolean): GuildPartition {
  const manageable: OAuthGuild[] = [];
  const invitable: OAuthGuild[] = [];
  for (const g of guilds) {
    if (!g || !isSnowflake(g.id) || !canManageGuild(g.permissions, g.owner === true)) continue;
    (botHasGuild(g.id) ? manageable : invitable).push(g);
  }
  const byName = (a: OAuthGuild, b: OAuthGuild) => a.name.localeCompare(b.name);
  return { manageable: manageable.sort(byName), invitable: invitable.sort(byName) };
}

/** Invite URL preselecting one server. Returns null when no base invite is configured. */
export function guildInviteUrl(baseInviteUrl: string, guildId: string): string | null {
  if (!baseInviteUrl || baseInviteUrl === "#") return null;
  try {
    const url = new URL(baseInviteUrl);
    url.searchParams.set("guild_id", guildId);
    url.searchParams.set("disable_guild_select", "true");
    return url.toString();
  } catch {
    return null;
  }
}
