/**
 * Shared embed styling so every command looks the same: brand colours,
 * a consistent "Aegis · …" footer, and actionable error text.
 */
export const COLORS = { brand: 0x5865f2, ok: 0x57f287, warn: 0xfee75c, danger: 0xed4245, muted: 0x99aab5 } as const;

/** Footer in the house style: "Aegis · <text>". Text is capped to Discord's 2048. */
export function footer(text?: string | null): { text: string } {
  const t = (text ?? "").trim();
  return { text: (t ? `Aegis · ${t}` : "Aegis").slice(0, 2048) };
}

/** Human names for the permissions commands most often lack. */
const PERMISSION_NAMES: Record<string, string> = {
  ManageGuild: "Manage Server", ModerateMembers: "Timeout Members", KickMembers: "Kick Members", BanMembers: "Ban Members",
  ManageMessages: "Manage Messages", ManageChannels: "Manage Channels", ManageRoles: "Manage Roles", ManageThreads: "Manage Threads",
  SendMessages: "Send Messages", EmbedLinks: "Embed Links", ViewChannel: "View Channel", ReadMessageHistory: "Read Message History",
  CreatePrivateThreads: "Create Private Threads", SendMessagesInThreads: "Send Messages in Threads", AddReactions: "Add Reactions",
  ManageNicknames: "Manage Nicknames", Administrator: "Administrator",
};

export function permissionName(flag: string): string {
  return PERMISSION_NAMES[flag] ?? flag.replace(/([a-z])([A-Z])/g, "$1 $2");
}

/** "You need Manage Server. Ask an admin…" / "Aegis needs …" with where to fix it. */
export function missingPermissionHint(who: "you" | "bot", flags: readonly string[], where = "this channel"): string {
  const names = flags.map(permissionName).map(n => `**${n}**`).join(", ");
  return who === "you"
    ? `❌ You need ${names} to use this. An admin can grant it in Server Settings → Roles.`
    : `❌ Aegis needs ${names} in ${where}. Fix it in the channel's settings → Permissions → Aegis (or Aegis's role in Server Settings → Roles).`;
}
