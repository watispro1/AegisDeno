/**
 * `/welcome test`: posts the saved welcome or goodbye message for real, in its
 * channel, with the moderator standing in for the member. Catches a missing
 * permission or a broken template before a real member joins.
 */
import { PermissionFlagsBits, type GuildMember } from "discord.js";
import { buildEmbedFromSpec, type EmbedSpec } from "./embedSpec";
import { describeStay, renderTemplate, type TemplateValues } from "./templateText";
import { getGuildConfig } from "./configuration";
import { isObfuscatedChannel } from "../utils/channels";

export type GreetingKind = "welcome" | "goodbye";

export interface GreetingSettings {
  enabled: boolean;
  channelId: string | null;
  message: string | null;
  embed: EmbedSpec | null;
}

export function greetingSettings(config: Record<string, unknown>, kind: GreetingKind): GreetingSettings {
  const key = (suffix: string) => config[`${kind}${suffix}`];
  return {
    enabled: key("Enabled") === true,
    channelId: typeof key("ChannelId") === "string" ? key("ChannelId") as string : null,
    message: typeof key("Message") === "string" ? key("Message") as string : null,
    embed: (key("Embed") as EmbedSpec | null | undefined) ?? null,
  };
}

/** Why the test can't run, or null when it can. A turned-off message still tests, with a note. */
export function greetingTestBlock(s: GreetingSettings, kind: GreetingKind): string | null {
  if (!s.channelId) return `❌ No ${kind} channel is set. Set one first${kind === "welcome" ? " with `/welcome channel`" : " on the dashboard"}.`;
  if (!s.message?.trim() && !s.embed) return `❌ The ${kind} message is empty. Write one first${kind === "welcome" ? " with `/welcome message`" : " on the dashboard"}.`;
  return null;
}

/** The template values for a test: the moderator as the member. */
export function testValues(member: Pick<GuildMember, "id" | "joinedTimestamp"> & { user: { username: string }; guild: { name: string; memberCount: number } }, kind: GreetingKind, now = Date.now()): TemplateValues {
  return {
    // Goodbyes never ping (the member has left), so they use the plain name.
    user: kind === "welcome" ? `<@${member.id}>` : member.user.username,
    username: member.user.username,
    server: member.guild.name,
    memberCount: member.guild.memberCount,
    timeInServer: describeStay(member.joinedTimestamp, now),
  };
}

/** What a real greeting needs in its channel: Embed Links only when it carries an embed. */
export function greetingTestPermissions(hasEmbed: boolean): Array<readonly [bigint, string]> {
  return [
    [PermissionFlagsBits.ViewChannel, "View Channel"],
    [PermissionFlagsBits.SendMessages, "Send Messages"],
    ...(hasEmbed ? [[PermissionFlagsBits.EmbedLinks, "Embed Links"] as const] : []),
  ];
}

/** Post the test. Returns the reply for the moderator. */
export async function sendGreetingTest(member: GuildMember, kind: GreetingKind): Promise<string> {
  const config = await getGuildConfig(member.guild.id) as unknown as Record<string, unknown>;
  const s = greetingSettings(config, kind);
  const blocked = greetingTestBlock(s, kind);
  if (blocked) return blocked;

  const channel = member.guild.channels.cache.get(s.channelId!) ?? await member.guild.channels.fetch(s.channelId!).catch(() => null);
  if (!channel || !channel.isTextBased() || !("send" in channel)) return `❌ The ${kind} channel no longer exists. Pick a new one.`;
  if (isObfuscatedChannel(channel)) return `❌ Aegis can't see <#${channel.id}> (no View Channel there).`;
  const me = member.guild.members.me;
  const perms = me ? channel.permissionsFor(me) : null;
  const missing = greetingTestPermissions(Boolean(s.embed)).filter(([bit]) => !perms?.has(bit)).map(([, name]) => name);
  if (missing.length) return `❌ Aegis is missing **${missing.join(", ")}** in <#${channel.id}>, so real ${kind} messages would fail too.`;

  const values = testValues(member, kind);
  const content = renderTemplate(s.message ?? "", values).slice(0, 1900);
  const embeds = s.embed ? [buildEmbedFromSpec(s.embed, values)] : [];
  const header = `-# Test ${kind} message sent with /welcome test by ${member.user.username}`;
  try {
    // A test never pings anyone, not even the moderator.
    await channel.send({ content: [header, content].filter(Boolean).join("\n"), embeds, allowedMentions: { parse: [] } });
  } catch {
    return `❌ Discord refused the message in <#${channel.id}>. Check the embed's image links and Aegis's permissions there.`;
  }
  return `✅ Sent a test ${kind} message to <#${channel.id}>.${s.enabled ? "" : ` ${kind === "welcome" ? "Welcome" : "Goodbye"} messages are turned **off**, so real members won't see it until you turn them on.`}`;
}
