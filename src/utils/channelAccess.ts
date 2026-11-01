/**
 * Whether the member running a command may post into a channel they picked:
 * Aegis posts on their behalf, so it must not reach channels they can't see or
 * post in, or ping @everyone/@here for someone without Mention Everyone.
 */
import { PermissionFlagsBits, type ChatInputCommandInteraction, type PermissionsBitField } from "discord.js";

export function postRefusal(perms: Pick<PermissionsBitField, "has"> | null, channelId: string, o: { pingEveryone?: boolean } = {}): string | null {
  if (!perms) return "Your permissions in that channel could not be checked. Try again.";
  if (!perms.has(PermissionFlagsBits.ViewChannel) || !perms.has(PermissionFlagsBits.SendMessages)) {
    return `You can't post in <#${channelId}> yourself, so Aegis won't post there for you.`;
  }
  if (o.pingEveryone && !perms.has(PermissionFlagsBits.MentionEveryone)) {
    return `Pinging @everyone or @here needs **Mention Everyone** in <#${channelId}>.`;
  }
  return null;
}

/** The invoking member's permissions in a channel (fetching the member when not cached). */
export async function memberPermsIn(interaction: ChatInputCommandInteraction, channelId: string): Promise<Readonly<PermissionsBitField> | null> {
  if (interaction.inCachedGuild()) return interaction.member.permissionsIn(channelId);
  const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
  return member ? member.permissionsIn(channelId) : null;
}
