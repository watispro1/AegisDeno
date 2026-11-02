/**
 * What Aegis needs to lock or unlock a channel.
 *
 * A lock only changes the @everyone permission overwrite on the channel
 * (Send Messages deny, or back to inherit). Discord's Edit Channel Permissions
 * endpoint requires **Manage Roles** (shown as "Manage Permissions" in a
 * channel's own settings); it does not require Manage Channels, which is only
 * needed to edit the channel itself (name, topic, slowmode).
 *
 * Discord also only lets a bot allow or deny a permission it holds itself in
 * the server or the channel's category (or with Administrator), so Aegis needs
 * Send Messages to deny or restore @everyone's Send Messages, and View Channel
 * to reach the channel at all.
 */
import { DiscordAPIError, PermissionFlagsBits, PermissionsBitField, type PermissionResolvable } from "discord.js";
import { permissionName } from "../utils/embedStyle";

/** Server-wide permission /lock declares (checked before the command runs). */
export const LOCK_BOT_PERMISSION = PermissionFlagsBits.ManageRoles;

/** Every permission a lock needs in the channel it changes. */
export const LOCK_CHANNEL_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.SendMessages,
] as const;

type PermsLike = { has(p: PermissionResolvable, checkAdmin?: boolean): boolean } | null | undefined;

/**
 * Names of the permissions Aegis lacks to lock a channel, given its
 * permissions in that channel and (optionally) in the server. Send Messages
 * counts when Aegis holds it in either place, matching Discord's rule.
 */
export function lockMissing(channelPerms: PermsLike, guildPerms?: PermsLike): string[] {
  if (!channelPerms) return LOCK_CHANNEL_PERMISSIONS.map(flagName);
  if (channelPerms.has(PermissionFlagsBits.Administrator)) return [];
  const missing: string[] = [];
  if (!channelPerms.has(PermissionFlagsBits.ViewChannel)) missing.push(flagName(PermissionFlagsBits.ViewChannel));
  if (!channelPerms.has(PermissionFlagsBits.ManageRoles)) missing.push(flagName(PermissionFlagsBits.ManageRoles));
  if (!channelPerms.has(PermissionFlagsBits.SendMessages) && !guildPerms?.has(PermissionFlagsBits.SendMessages)) {
    missing.push(flagName(PermissionFlagsBits.SendMessages));
  }
  return missing;
}

function flagName(bit: bigint): string {
  return permissionName(new PermissionsBitField(bit).toArray()[0] ?? String(bit));
}

/** "Aegis needs Manage Roles (…) in #channel to lock it." */
export function lockPermissionMessage(channelId: string, missing: readonly string[], verb: "lock" | "unlock" = "lock"): string {
  const names = missing.map(n => `**${n}**`).join(", ");
  const manageRolesNote = missing.includes("Manage Roles")
    ? " (it is called *Manage Permissions* in a channel's own settings)"
    : "";
  return `❌ Aegis needs ${names}${manageRolesNote} in <#${channelId}> to ${verb} it. ` +
    "Discord only lets Aegis change @everyone's Send Messages there if Aegis can manage permissions and send messages itself. " +
    "Fix it in the channel's settings → Permissions → Aegis, or on Aegis's role in Server Settings → Roles.";
}

/** A user-facing reason for a failed overwrite edit; Missing Permissions and Missing Access get specific advice. */
export function lockFailureMessage(channelId: string, err: unknown, verb: "lock" | "unlock" = "lock"): string {
  const code = err instanceof DiscordAPIError ? Number(err.code) : (err as { code?: unknown } | null)?.code;
  if (code === 50013) {
    return `❌ Discord refused to ${verb} <#${channelId}> (Missing Permissions). Aegis needs **Manage Roles** and **Send Messages** there, ` +
      "and Aegis's role must hold every permission already set on @everyone's override in that channel. " +
      "Check the channel's settings → Permissions → Aegis.";
  }
  if (code === 50001) {
    return `❌ Aegis can't reach <#${channelId}> (Missing Access). Give Aegis **View Channel** there.`;
  }
  return `❌ Failed to ${verb} <#${channelId}>. Check Aegis's permissions there and try again.`;
}
