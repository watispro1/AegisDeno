import { ChatInputCommandInteraction, PermissionFlagsBits, PermissionResolvable } from "discord.js";

/**
 * Checks if the member who triggered an interaction has all of the given permissions.
 */
export function hasUserPermission(
  interaction: ChatInputCommandInteraction,
  ...permissions: PermissionResolvable[]
): boolean {
  if (!interaction.memberPermissions) return false;
  return permissions.every(p => interaction.memberPermissions!.has(p));
}

/**
 * Checks if the bot has all of the given permissions in the interaction context.
 */
export function hasBotPermission(
  interaction: ChatInputCommandInteraction,
  ...permissions: PermissionResolvable[]
): boolean {
  if (!interaction.appPermissions) return false;
  return permissions.every(p => interaction.appPermissions!.has(p));
}

/** Returns true if the user is a server administrator. */
export function isAdmin(interaction: ChatInputCommandInteraction): boolean {
  return hasUserPermission(interaction, PermissionFlagsBits.Administrator);
}

/** Returns true if the user is the guild owner. */
export async function isGuildOwner(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!interaction.guild) return false;
  const guild = await interaction.guild.fetch().catch(() => null);
  return guild?.ownerId === interaction.user.id;
}
