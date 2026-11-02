/**
 * The permissions Aegis asks for on its invite, and why. The invite bitfield
 * itself is computed from every command's `botPermissions` and
 * `featurePermissions` (see web/catalog.ts); this file explains each bit, so
 * the docs, /diagnostics and the tests all read from one place.
 *
 * Discord API requirements these follow:
 * - Edit Channel Permissions (lock, ticket members): Manage Roles; a bot can
 *   only allow or deny permissions it holds itself.
 * - Modify Channel (slowmode): Manage Channels. Create Channel (tickets):
 *   Manage Channels; overwrites on a new channel may only grant what the bot has.
 * - Timeout: Moderate Members. Nickname: Manage Nicknames. Roles: Manage Roles
 *   (below Aegis's highest role). Ban/unban: Ban Members. Kick: Kick Members.
 * - Bulk delete: Manage Messages + Read Message History (to fetch them).
 * - Private threads: Create Private Threads; posting in threads: Send Messages
 *   in Threads; locking/archiving others' threads: Manage Threads.
 * - Embeds in channel messages: Embed Links; files: Attach Files.
 */
import { PermissionFlagsBits } from "discord.js";

/** Needed by everything that reads or posts in a channel; always on the invite. */
export const IMPLICIT_BOT_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.EmbedLinks,
] as const;

/**
 * Used by an optional part of a feature and deliberately not requested on the
 * invite. Aegis works without them and says so where they matter.
 */
export const OPTIONAL_BOT_PERMISSIONS: { flag: bigint; name: string; why: string }[] = [
  { flag: PermissionFlagsBits.ManageGuild, name: "Manage Server", why: "Incident Mode's optional \"pause invites\". Without it the incident still runs and the report says invites were left alone." },
];

/** Why Aegis asks for each invite permission, keyed by discord.js flag name. */
export const BOT_PERMISSION_WHY: Record<string, string> = {
  ViewChannel: "Seeing the channels it works in. Without it Discord hides the channel from Aegis.",
  SendMessages: "Replies, logs, notices and panels. Also needed to deny @everyone's Send Messages in a lock.",
  ReadMessageHistory: "Purge, starboard, ticket transcripts and replacing its own panels.",
  EmbedLinks: "Every card Aegis posts in a channel.",
  AttachFiles: "Ticket transcripts, and letting ticket openers attach files.",
  BanMembers: "/ban, /unban, approved appeals and ban escalations.",
  KickMembers: "/kick, kick escalations, verification auto-kick and the Incident Mode join gate.",
  ModerateMembers: "Timeouts: /timeout, /removetimeout, automod, escalations, the /warn quick timeout and the join gate.",
  ManageMessages: "/purge and automod deleting messages.",
  ManageNicknames: "/nickname.",
  ManageChannels: "/slowmode, Incident Mode slowmode, and creating and deleting ticket channels.",
  ManageRoles: "Locks (/lock and Incident Mode change @everyone's override), adding members to tickets, verification, role panels, welcome and low-trust roles, shop roles.",
  CreatePrivateThreads: "ModMail threads in a text channel.",
  SendMessagesInThreads: "Replying in ModMail threads and forum posts.",
  ManageThreads: "Locking and archiving ModMail threads when they close.",
};
