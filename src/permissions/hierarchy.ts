import { Client, GuildMember } from "discord.js";

/**
 * Checks if the moderator's highest role is above the target's highest role.
 * Returns false if either member is not found.
 */
export async function isRoleHierarchyValid(
  client: Client,
  guildId: string,
  moderatorId: string,
  targetId: string
): Promise<boolean> {
  if (moderatorId === targetId) return false;

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return false;

  if (guild.ownerId === moderatorId) return true;
  if (guild.ownerId === targetId) return false;

  const [moderator, target] = await Promise.all([
    guild.members.fetch(moderatorId).catch(() => null),
    guild.members.fetch(targetId).catch(() => null),
  ]);

  if (!moderator || !target) return false;

  return moderator.roles.highest.position > target.roles.highest.position;
}

/**
 * Checks whether the bot can act on the given member (hierarchy check).
 */
export async function isBotHierarchyValid(
  client: Client,
  guildId: string,
  targetId: string
): Promise<boolean> {
  if (!client.user) return false;
  return isRoleHierarchyValid(client, guildId, client.user.id, targetId);
}
