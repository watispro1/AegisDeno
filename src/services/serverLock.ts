/**
 * /lock server: which channels an emergency lockdown touches, and locking them.
 * Only the @everyone Send Messages overwrite changes, so Aegis needs Manage
 * Roles (plus View Channel and Send Messages) in each channel, never Manage
 * Channels. Channels where it lacks those are skipped and counted, not failed.
 */
import { PermissionFlagsBits, type Guild, type GuildBasedChannel } from "discord.js";
import { isObfuscatedChannel } from "../utils/channels";
import { lockMissing } from "../permissions/lockPermissions";
import type { LockableChannel } from "./channelLock";

/**
 * Whether /lock server should lock this channel: visible to Aegis, a text-capable
 * non-thread channel, public (@everyone can view it) and not already locked.
 */
export function serverLockTarget(ch: GuildBasedChannel, guild: Guild): boolean {
  if (isObfuscatedChannel(ch) || !ch.isTextBased() || ch.isThread() || !("permissionOverwrites" in ch)) return false;
  const everyone = guild.roles.everyone;
  const view = ch.permissionsFor(everyone)?.has(PermissionFlagsBits.ViewChannel) ?? false;
  if (!view) return false;
  return !ch.permissionOverwrites.cache.get(everyone.id)?.deny.has(PermissionFlagsBits.SendMessages);
}

export interface ServerLockResult {
  locked: number;
  /** Aegis lacked Manage Roles, View Channel or Send Messages there, so it did not try. */
  skipped: number;
  /** Discord refused the edit anyway. */
  failed: number;
}

export async function lockServerChannels(guild: Guild, channels: Iterable<GuildBasedChannel | null>): Promise<ServerLockResult> {
  const result: ServerLockResult = { locked: 0, skipped: 0, failed: 0 };
  const me = guild.members.me;
  for (const ch of channels) {
    if (!ch || !serverLockTarget(ch, guild)) continue;
    const channel = ch as LockableChannel;
    if (lockMissing(me ? channel.permissionsFor(me) : null, me?.permissions).length) {
      result.skipped++;
      continue;
    }
    const ok = await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }).then(() => true, () => false);
    if (ok) result.locked++; else result.failed++;
  }
  return result;
}

/** The warning line under the lockdown result, or "" when every channel locked. */
export function serverLockWarning(r: ServerLockResult): string {
  const parts: string[] = [];
  if (r.skipped) parts.push(`${r.skipped} channel(s) skipped: Aegis needs **Manage Roles** (Manage Permissions) and **Send Messages** there`);
  if (r.failed) parts.push(`${r.failed} channel(s) could not be locked (Discord refused; check Aegis's permissions there)`);
  return parts.length ? `\n⚠️ ${parts.join(". ")}.` : "";
}
