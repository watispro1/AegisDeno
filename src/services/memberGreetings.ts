/** Welcome auto-role and goodbye message helpers, split out of bot/client.ts. */
import type { GuildMember, PartialGuildMember } from "discord.js";
import { logger } from "../utils/logger";
import { getGuildConfig } from "./configuration";
import { buildEmbedFromSpec, renderTemplate } from "./embedSpec";
import { isObfuscatedChannel } from "../utils/channels";

/**
 * Gives a new member the welcome auto-role. Adding a role during membership
 * screening would skip the server's rules gate, so pending members wait; a
 * role above Aegis is skipped with a warning instead of an API error per join.
 */
export async function assignWelcomeRole(member: GuildMember, roleId: string): Promise<void> {
  const role = member.guild.roles.cache.get(roleId);
  if (role && !role.editable) {
    logger.warn(`Auto-role ${roleId} in ${member.guild.id} is above Aegis's highest role (or managed); skipping it.`);
    return;
  }
  if (member.roles.cache.has(roleId)) return;
  await member.roles.add(roleId, "Welcome auto-role").catch(err =>
    logger.warn(`Failed to assign auto-role ${roleId} to ${member.user?.tag ?? member.id} in ${member.guild.id}:`, err),
  );
}

/** Posts the goodbye message for a member who left, if the server turned it on. */
export async function sendGoodbye(member: GuildMember | PartialGuildMember): Promise<void> {
  const config = await getGuildConfig(member.guild.id);
  if (!config.goodbyeEnabled || !config.goodbyeChannelId) return;
  const channel = member.guild.channels.cache.get(config.goodbyeChannelId)
    ?? await member.guild.channels.fetch(config.goodbyeChannelId).catch(() => null);
  if (!channel || isObfuscatedChannel(channel)) {
    if (channel) logger.warn(`Goodbye channel ${config.goodbyeChannelId} in ${member.guild.id} is hidden from Aegis (no View Channel); skipping the goodbye message.`);
    return;
  }
  if (!channel.isTextBased() || !("send" in channel)) return;
  const name = member.user?.username ?? "A member";
  const values = { user: name, username: name, server: member.guild.name, memberCount: member.guild.memberCount };
  const content = renderTemplate(config.goodbyeMessage ?? "", values).slice(0, 2000);
  const embeds = config.goodbyeEmbed ? [buildEmbedFromSpec(config.goodbyeEmbed, values)] : [];
  if (!content && embeds.length === 0) return;
  await channel.send({ content: content || undefined, embeds, allowedMentions: { parse: [] } }).catch(() => null);
}
