import type { ChatInputCommandInteraction, PermissionResolvable } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import type { Command } from "../types/discord";
import { logger } from "../utils/logger";

/** Maps Discord permission bit flags to human-readable names. */
const PERMISSION_NAMES: Partial<Record<string, string>> = {
  [String(PermissionFlagsBits.Administrator)]:     "Administrator",
  [String(PermissionFlagsBits.BanMembers)]:        "Ban Members",
  [String(PermissionFlagsBits.KickMembers)]:       "Kick Members",
  [String(PermissionFlagsBits.ManageChannels)]:    "Manage Channels",
  [String(PermissionFlagsBits.ManageGuild)]:       "Manage Server",
  [String(PermissionFlagsBits.ManageMessages)]:    "Manage Messages",
  [String(PermissionFlagsBits.ManageRoles)]:       "Manage Roles",
  [String(PermissionFlagsBits.MentionEveryone)]:   "Mention @everyone",
  [String(PermissionFlagsBits.ModerateMembers)]:   "Moderate Members (Timeout)",
  [String(PermissionFlagsBits.MuteMembers)]:       "Mute Members",
  [String(PermissionFlagsBits.SendMessages)]:      "Send Messages",
  [String(PermissionFlagsBits.ViewChannel)]:       "View Channel",
  [String(PermissionFlagsBits.ViewAuditLog)]:      "View Audit Log",
  [String(PermissionFlagsBits.EmbedLinks)]:        "Embed Links",
  [String(PermissionFlagsBits.AttachFiles)]:       "Attach Files",
  [String(PermissionFlagsBits.ReadMessageHistory)]:"Read Message History",
};

function formatPermissions(permissions: PermissionResolvable[]): string {
  return permissions
    .map(p => PERMISSION_NAMES[String(p)] ?? String(p))
    .join(", ");
}

async function replyError(
  interaction: ChatInputCommandInteraction,
  content: string,
): Promise<void> {
  const payload = { content, ephemeral: true };

  if (interaction.replied) {
    await interaction.followUp(payload).catch(() => undefined);
  } else if (interaction.deferred) {
    await interaction.editReply(payload).catch(() => undefined);
  } else {
    await interaction.reply(payload).catch(() => undefined);
  }
}

import { knubManager } from "../knub";

export async function executeCommand(
  command: Command,
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await knubManager.executeCommandPipeline(command, interaction);
}
