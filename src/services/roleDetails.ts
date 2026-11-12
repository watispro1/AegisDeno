/**
 * Pure helpers behind /roleinfo's extra views: every permission a role has,
 * grouped the way Discord's role editor groups them, what kind of role it is
 * (bot, booster, linked, subscription), and the member list lines.
 */
import { PermissionsBitField } from "discord.js";
import { permissionName } from "../utils/embedStyle";

/** Permission groups in the order Discord's role editor shows them. */
export const PERMISSION_GROUPS: ReadonlyArray<{ name: string; flags: readonly string[] }> = [
  { name: "⚠️ Dangerous", flags: ["Administrator", "ManageGuild", "ManageRoles", "ManageChannels", "ManageWebhooks", "BanMembers", "KickMembers", "ModerateMembers", "MentionEveryone", "ManageGuildExpressions", "ManageEvents", "ManageThreads", "ManageMessages", "ManageNicknames", "ViewAuditLog", "ViewGuildInsights", "ViewCreatorMonetizationAnalytics"] },
  { name: "General", flags: ["ViewChannel", "CreateInstantInvite", "ChangeNickname", "CreateGuildExpressions", "CreateEvents"] },
  { name: "Text", flags: ["SendMessages", "SendMessagesInThreads", "CreatePublicThreads", "CreatePrivateThreads", "EmbedLinks", "AttachFiles", "AddReactions", "UseExternalEmojis", "UseExternalStickers", "ReadMessageHistory", "SendTTSMessages", "SendVoiceMessages", "SendPolls", "UseApplicationCommands", "UseEmbeddedActivities", "UseExternalApps", "PinMessages", "BypassSlowmode"] },
  { name: "Voice", flags: ["Connect", "Speak", "Stream", "UseVAD", "PrioritySpeaker", "MuteMembers", "DeafenMembers", "MoveMembers", "UseSoundboard", "UseExternalSounds", "RequestToSpeak", "SetVoiceChannelStatus"] },
];

export interface PermissionGroupView {
  name: string;
  granted: string[];
}

/**
 * Every permission in the bitfield, grouped. Flags not in a known group land
 * in "Other" so a permission Discord adds later is never hidden. Administrator
 * is reported on its own because it implies everything else.
 */
export function groupedPermissions(bits: bigint): PermissionGroupView[] {
  const field = new PermissionsBitField(bits);
  const names = field.toArray() as string[];
  if (names.includes("Administrator")) return [{ name: "⚠️ Dangerous", granted: ["Administrator (grants every permission and bypasses channel overrides)"] }];
  const known = new Set(PERMISSION_GROUPS.flatMap(g => g.flags));
  const groups = PERMISSION_GROUPS.map(g => ({ name: g.name, granted: g.flags.filter(f => names.includes(f)).map(permissionName) }));
  const other = names.filter(n => !known.has(n)).map(permissionName);
  if (other.length) groups.push({ name: "Other", granted: other });
  return groups.filter(g => g.granted.length > 0);
}

/** The text of the "All permissions" view. */
export function permissionsText(bits: bigint): string {
  const groups = groupedPermissions(bits);
  if (!groups.length) return "This role grants no permissions of its own; members get what @everyone and their other roles allow.";
  const total = groups.reduce((n, g) => n + g.granted.length, 0);
  return [`**${total}** permission${total === 1 ? "" : "s"} granted server-wide (channel overrides can change them per channel).`, ""]
    .concat(groups.map(g => `**${g.name}** (${g.granted.length})\n${g.granted.map(p => `• ${p}`).join("\n")}`))
    .join("\n")
    .slice(0, 4000);
}

export interface RoleTagsLike {
  botId?: string | null;
  integrationId?: string | null;
  premiumSubscriberRole?: true | null;
  subscriptionListingId?: string | null;
  availableForPurchase?: true | null;
  guildConnections?: true | null;
}

/** What kind of role this is, from Discord's role tags. Pure. */
export function roleKind(tags: RoleTagsLike | null | undefined, isEveryone: boolean): string {
  if (isEveryone) return "@everyone (every member has it)";
  if (!tags) return "Regular role";
  if (tags.botId) return `Bot role for <@${tags.botId}>`;
  if (tags.premiumSubscriberRole) return "Server Booster role";
  if (tags.subscriptionListingId) return tags.availableForPurchase ? "Server Subscription role (for sale)" : "Server Subscription role";
  if (tags.guildConnections) return "Linked role (needs a connected account)";
  if (tags.integrationId) return "Integration role";
  return "Regular role";
}

/** One member line: mention, tag and ID. Mentions render without pinging (the pager sends with no allowed mentions). */
export function memberLine(member: { id: string; tag: string; bot: boolean }, index: number): string {
  return `\`${String(index + 1).padStart(3, " ")}\` <@${member.id}> · ${member.tag.slice(0, 40)}${member.bot ? " 🤖" : ""}`;
}

/** Members sorted the way people scan a list: humans first, then by name. */
export function sortMembersForList<T extends { tag: string; bot: boolean }>(members: readonly T[]): T[] {
  return [...members].sort((a, b) => Number(a.bot) - Number(b.bot) || a.tag.localeCompare(b.tag, "en", { sensitivity: "base" }));
}
