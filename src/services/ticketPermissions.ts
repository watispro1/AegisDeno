/**
 * Permission rules for creating a ticket channel.
 *
 * Discord refuses a permission overwrite that allows a permission the bot does
 * not hold itself, so the ticket channel's overwrites are filtered against
 * Aegis's own permissions. A server invited before Attach Files was added still
 * gets a working ticket instead of the whole creation failing.
 */
import { PermissionFlagsBits } from "discord.js";

/** What the ticket opener is allowed to do in their channel. */
export const TICKET_OPENER_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles,
] as const;

/** What Aegis needs inside the channel it just created. */
export const TICKET_BOT_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
] as const;

/** What the configured staff role may do in a ticket. */
export const TICKET_STAFF_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
] as const;

/** The part of a guild member this module needs (kept structural for tests). */
export interface PermissionHolder {
  permissions: { has(permission: bigint): boolean };
}

export interface TicketOverwrite {
  id: string;
  allow?: bigint[];
  deny?: bigint[];
}

/** The subset of `wanted` Aegis may grant in an overwrite. */
export function grantablePermissions(me: PermissionHolder | null | undefined, wanted: readonly bigint[]): bigint[] {
  if (!me) return [...wanted];
  return wanted.filter(permission => me.permissions.has(permission));
}

/** Overwrites for a brand-new ticket channel: private, open to the opener and staff. */
export function ticketPermissionOverwrites(opts: {
  guildId: string;
  userId: string;
  botId: string;
  staffRoleId?: string | null;
  me?: PermissionHolder | null;
}): TicketOverwrite[] {
  const overwrites: TicketOverwrite[] = [
    // Hidden from @everyone, including the opener until their own overwrite allows it.
    { id: opts.guildId, deny: [PermissionFlagsBits.ViewChannel] },
    { id: opts.userId, allow: grantablePermissions(opts.me, TICKET_OPENER_PERMISSIONS) },
    { id: opts.botId, allow: grantablePermissions(opts.me, TICKET_BOT_PERMISSIONS) },
  ];
  if (opts.staffRoleId) {
    overwrites.push({ id: opts.staffRoleId, allow: grantablePermissions(opts.me, TICKET_STAFF_PERMISSIONS) });
  }
  return overwrites;
}

/** Making any channel requires Manage Channels, so this is the one hard requirement. */
export function canCreateTicketChannels(me: PermissionHolder | null | undefined): boolean {
  return Boolean(me?.permissions.has(PermissionFlagsBits.ManageChannels));
}

export type TicketCreationFailure = "pending" | "missing_permissions" | "failed";

/** What to tell the member when a ticket could not be created, without a vague catch-all. */
export function ticketCreationFailureMessage(reason: TicketCreationFailure): string {
  switch (reason) {
    case "pending":
      return "⏳ A ticket is already being created for you. Check your ticket channel in a moment.";
    case "missing_permissions":
      return (
        "❌ Aegis couldn't create a ticket because it is missing the **Manage Channels** permission. " +
        "Ask a server admin to give it to Aegis's role (Server Settings → Roles), then press the button again."
      );
    default:
      return (
        "❌ Aegis couldn't create your ticket. Ask a server admin to check that Aegis has " +
        "**Manage Channels**, **View Channel** and **Send Messages**, then press the button again."
      );
  }
}
