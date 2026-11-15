/**
 * Shared helpers for the server-setup commands (/automod, /logging, /ticket,
 * /verify, /welcome, /rolepanel, /config…): dashboard deep links, up-front
 * checks that Aegis can post in a channel or hand out a role, and private
 * error replies that work whether or not the interaction was deferred.
 *
 * The checks are deliberately tolerant: when Aegis can't tell (its own member
 * isn't cached, a channel object has no permission data) they return null and
 * let the action itself report a failure, rather than refusing a valid setup.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { dashboardUrl } from "../../../config/links";
import { hiddenChannelMessage, isObfuscatedChannel } from "../../../utils/channels";

/** Dashboard pages the setup commands link to. */
export type DashboardPage =
  | ""
  | "settings"
  | "settings/logging"
  | "settings/automod"
  | "settings/welcome"
  | "settings/goodbye"
  | "settings/tickets"
  | "settings/verification"
  | "autoresponders"
  | "automations"
  | "panels"
  | "tools";

/** Absolute link to one page of this server's dashboard. */
export function dashboardPageUrl(guildId: string, page: DashboardPage = ""): string {
  const base = dashboardUrl(guildId);
  return page ? `${base}/${page}` : base;
}

/** A link button to a dashboard page. */
export function dashboardButton(guildId: string, page: DashboardPage, label = "Open on dashboard"): ButtonBuilder {
  return new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label.slice(0, 80)).setEmoji("🧭").setURL(dashboardPageUrl(guildId, page));
}

/** One row holding a single dashboard link button. */
export function dashboardRow(guildId: string, page: DashboardPage, label?: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(dashboardButton(guildId, page, label));
}

export type PermissionList = ReadonlyArray<readonly [bigint, string]>;

/** What Aegis needs to post embeds in a channel. */
export const POST_EMBED_PERMISSIONS: PermissionList = [
  [PermissionFlagsBits.ViewChannel, "View Channel"],
  [PermissionFlagsBits.SendMessages, "Send Messages"],
  [PermissionFlagsBits.EmbedLinks, "Embed Links"],
];

/** Posting plus file uploads (ticket transcripts). */
export const POST_FILE_PERMISSIONS: PermissionList = [...POST_EMBED_PERMISSIONS, [PermissionFlagsBits.AttachFiles, "Attach Files"]];

/** Names of the permissions in `check` that `perms` lacks. Pure. */
export function missingFrom(perms: { has(bit: bigint): boolean } | null | undefined, check: PermissionList): string[] {
  if (!perms) return [];
  return check.filter(([bit]) => !perms.has(bit)).map(([, name]) => name);
}

/** "❌ Aegis needs **A**, **B** in <#id>…" with where to fix it. Pure. */
export function channelPermissionMessage(channelId: string, missing: readonly string[]): string {
  return `❌ Aegis needs **${missing.join("**, **")}** in <#${channelId}>. Give Aegis's role those permissions in the channel's settings → Permissions, then try again.`;
}

interface GuildLike {
  id: string;
  members: {
    me?: { permissions?: { has(bit: bigint): boolean }; roles?: { highest?: { position: number } } } | null;
    fetchMe?: () => Promise<unknown>;
  };
  channels?: { cache?: { get(id: string): unknown } };
}

/** Aegis's own member, cached or fetched; null when it can't be read. */
export async function botMember(guild: GuildLike): Promise<GuildLike["members"]["me"]> {
  if (guild.members.me) return guild.members.me;
  const fetched = await guild.members.fetchMe?.().catch(() => null);
  return (fetched as GuildLike["members"]["me"]) ?? null;
}

/**
 * Why Aegis can't use a channel (hidden from it, or missing permissions), or
 * null when it can or when that can't be determined.
 */
export async function botChannelProblem(guild: GuildLike, channel: { id: string } & Record<string, unknown>, check: PermissionList = POST_EMBED_PERMISSIONS): Promise<string | null> {
  const cached = guild.channels?.cache?.get(channel.id) as Record<string, unknown> | undefined;
  if (isObfuscatedChannel(channel) || isObfuscatedChannel(cached)) return `❌ ${hiddenChannelMessage(channel.id)}`;
  const me = await botMember(guild);
  const target = (cached ?? channel) as { permissionsFor?: (m: unknown) => { has(bit: bigint): boolean } | null };
  if (!me || typeof target.permissionsFor !== "function") return null;
  const missing = missingFrom(target.permissionsFor(me), check);
  return missing.length ? channelPermissionMessage(channel.id, missing) : null;
}

export interface RoleLike {
  id: string;
  name?: string;
  managed?: boolean;
  editable?: boolean;
  position?: number;
}

/**
 * Why Aegis can't hand out (or take away) a role, or null when it can or when
 * that can't be determined. `use` finishes the sentence, e.g. "as the verified role".
 */
export function botRoleProblem(guild: GuildLike, role: RoleLike, use = "here"): string | null {
  if (role.id === guild.id) return `❌ @everyone can't be used ${use}. Pick a real role.`;
  if (role.managed === true) return `❌ <@&${role.id}> is managed by an integration (a bot or boost role), so it can't be used ${use}.`;
  const me = guild.members.me;
  if (me?.permissions && !me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return "❌ Aegis needs **Manage Roles** to hand out roles. Give Aegis's role that permission in Server Settings → Roles.";
  }
  const top = me?.roles?.highest?.position;
  const aboveBot = role.editable === false || (typeof top === "number" && typeof role.position === "number" && role.position >= top);
  if (aboveBot) {
    return `❌ <@&${role.id}> is at or above Aegis's highest role, so Aegis can't hand it out. Drag the Aegis role above it in Server Settings → Roles, then try again.`;
  }
  return null;
}

/** Whether Aegis holds a server-wide permission; true when it can't be read. */
export function botHas(guild: GuildLike, bit: bigint): boolean {
  const perms = guild.members.me?.permissions;
  return perms ? perms.has(bit) : true;
}

/** Answer privately with an error, however far the interaction has got. */
export async function replyError(interaction: ChatInputCommandInteraction, content: string): Promise<void> {
  const payload = { content, allowedMentions: { parse: [] as never[] } };
  if (interaction.deferred && !interaction.replied) await interaction.editReply({ ...payload, embeds: [], components: [] }).catch(() => null);
  else if (interaction.replied) await interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => null);
  else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => null);
}

export const onOff = (on: boolean): string => (on ? "✅ On" : "❌ Off");
