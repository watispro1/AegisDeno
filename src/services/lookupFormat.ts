/** Pure text helpers for /avatar, /roleinfo and /channelinfo (tested without Discord). */
import { ChannelType, PermissionFlagsBits, PermissionsBitField } from "discord.js";

/** Image formats offered as download links; gif only when the avatar is animated. */
export function avatarFormats(animated: boolean): string[] {
  return animated ? ["gif", "png", "webp", "jpg"] : ["png", "webp", "jpg"];
}

/** "PNG · WEBP · JPG" style markdown links built from a URL factory. */
export function avatarLinkLine(urlFor: (extension: string) => string, animated: boolean): string {
  return avatarFormats(animated).map(ext => `[${ext.toUpperCase()}](${urlFor(ext)})`).join(" · ");
}

/** Role colour as #RRGGBB, or "Default" for colour 0. */
export function colorHex(color: number): string {
  if (!Number.isInteger(color) || color <= 0) return "Default";
  return `#${color.toString(16).padStart(6, "0").toUpperCase()}`;
}

const CHANNEL_TYPE_LABELS: Partial<Record<ChannelType, string>> = {
  [ChannelType.GuildText]: "Text channel",
  [ChannelType.GuildVoice]: "Voice channel",
  [ChannelType.GuildCategory]: "Category",
  [ChannelType.GuildAnnouncement]: "Announcement channel",
  [ChannelType.AnnouncementThread]: "Announcement thread",
  [ChannelType.PublicThread]: "Public thread",
  [ChannelType.PrivateThread]: "Private thread",
  [ChannelType.GuildStageVoice]: "Stage channel",
  [ChannelType.GuildForum]: "Forum channel",
  [ChannelType.GuildMedia]: "Media channel",
};

export function channelTypeLabel(type: ChannelType): string {
  return CHANNEL_TYPE_LABELS[type] ?? "Channel";
}

/** Slowmode as words: "Off", "30 seconds", "2 minutes", "1 hour 30 minutes". */
export function slowmodeLabel(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.floor(seconds ?? 0));
  if (s === 0) return "Off";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const part = (n: number, unit: string) => (n ? `${n} ${unit}${n === 1 ? "" : "s"}` : "");
  return [part(h, "hour"), part(m, "minute"), part(sec, "second")].filter(Boolean).join(" ");
}

/** The permissions worth calling out on a role, in a fixed order. */
const NOTABLE_PERMISSIONS: Array<[bigint, string]> = [
  [PermissionFlagsBits.Administrator, "Administrator"],
  [PermissionFlagsBits.ManageGuild, "Manage Server"],
  [PermissionFlagsBits.ManageRoles, "Manage Roles"],
  [PermissionFlagsBits.ManageChannels, "Manage Channels"],
  [PermissionFlagsBits.BanMembers, "Ban Members"],
  [PermissionFlagsBits.KickMembers, "Kick Members"],
  [PermissionFlagsBits.ModerateMembers, "Timeout Members"],
  [PermissionFlagsBits.ManageMessages, "Manage Messages"],
  [PermissionFlagsBits.ManageWebhooks, "Manage Webhooks"],
  [PermissionFlagsBits.MentionEveryone, "Mention Everyone"],
  [PermissionFlagsBits.ViewAuditLog, "View Audit Log"],
];

export function notablePermissions(bits: bigint): string[] {
  const field = new PermissionsBitField(bits);
  if (field.has(PermissionFlagsBits.Administrator)) return ["Administrator (every permission)"];
  return NOTABLE_PERMISSIONS.filter(([flag]) => field.has(flag)).map(([, name]) => name);
}

/** "Yes"/"No" for embed fields. */
export function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

/** Member count text for a role, flagging that it only counts members Aegis has cached. */
export function roleMemberCount(cached: number, everyoneRole: boolean, guildMemberCount: number): string {
  if (everyoneRole) return guildMemberCount.toLocaleString("en-US");
  return `${cached.toLocaleString("en-US")} (members Aegis has loaded)`;
}
