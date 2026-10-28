import { Client, GuildMember } from "discord.js";

/**
 * Pure hierarchy rule behind isRoleHierarchyValid(): nobody can act on
 * themselves, the owner can act on anyone, nobody can act on the owner, and
 * otherwise the actor's top role must be strictly above the target's.
 */
export function outranks(input: {
  ownerId: string;
  actorId: string;
  targetId: string;
  actorTopPosition: number;
  targetTopPosition: number;
}): boolean {
  if (input.actorId === input.targetId) return false;
  if (input.ownerId === input.actorId) return true;
  if (input.ownerId === input.targetId) return false;
  return input.actorTopPosition > input.targetTopPosition;
}

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

  return outranks({
    ownerId: guild.ownerId,
    actorId: moderatorId,
    targetId,
    actorTopPosition: moderator.roles.highest.position,
    targetTopPosition: target.roles.highest.position,
  });
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
