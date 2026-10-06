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

  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(payload).catch(() => undefined);
  } else {
    await interaction.reply(payload).catch(() => undefined);
  }
}

export async function executeCommand(
  command: Command,
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (command.guildOnly && !interaction.guildId) {
    await replyError(
      interaction,
      "❌ This command can only be used in a server.",
    );
    return;
  }

  // Check user permissions
  if (command.userPermissions?.length) {
    // memberPermissions is null in DMs; already guarded by guildOnly above
    if (!interaction.memberPermissions) {
      await replyError(interaction, "❌ Could not verify your server permissions.");
      return;
    }

    const missing = command.userPermissions.filter(
      (permission) => !interaction.memberPermissions!.has(permission),
    );

    if (missing.length) {
      logger.warn(
        `Permission denied: /${interaction.commandName} by ${interaction.user.tag} ` +
        `(${interaction.user.id}) in guild ${interaction.guildId ?? "DM"} — missing: ${formatPermissions(missing)}`
      );
      await replyError(
        interaction,
        `❌ You are missing the following permission(s): **${formatPermissions(missing)}**.`,
      );
      return;
    }
  }

  // Check bot permissions
  if (command.botPermissions?.length) {
    const botMember = interaction.guild?.members.me;

    if (!botMember) {
      await replyError(
        interaction,
        "❌ I couldn't verify my permissions in this server.",
      );
      return;
    }

    const missing = command.botPermissions.filter(
      (permission) => !botMember.permissions.has(permission),
    );

    if (missing.length) {
      logger.warn(
        `Bot missing permissions for /${interaction.commandName} in guild ${interaction.guildId}: ` +
        formatPermissions(missing)
      );
      await replyError(
        interaction,
        `❌ I am missing the following permission(s): **${formatPermissions(missing)}**. ` +
        `Please ask a server admin to grant these to my role.`,
      );
      return;
    }
  }

  logger.debug(
    `Command: /${interaction.commandName} by ${interaction.user.tag} (${interaction.user.id}) ` +
    `in guild ${interaction.guildId ?? "DM"}`,
  );

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error(`Unhandled error in /${interaction.commandName} by ${interaction.user.tag}:`, error);
    await replyError(
      interaction,
      "❌ An unexpected error occurred while running this command. Please try again.",
    );
  }
}
