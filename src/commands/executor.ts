import type { ChatInputCommandInteraction, PermissionResolvable } from "discord.js";
import type { Command } from "../types/discord";
import { logger } from "../utils/logger";

function formatPermissions(permissions: PermissionResolvable[]): string {
  return permissions.map(String).join(", ");
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

  if (command.userPermissions?.length) {
    const missing = command.userPermissions.filter(
      (permission) => !interaction.memberPermissions?.has(permission),
    );

    if (missing.length) {
      await replyError(
        interaction,
        `❌ You need: ${formatPermissions(missing)}.`,
      );
      return;
    }
  }

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
      await replyError(
        interaction,
        `❌ I need: ${formatPermissions(missing)}.`,
      );
      return;
    }
  }

  logger.debug(
    `Command: /${interaction.commandName} by ${interaction.user.tag} (${interaction.user.id})`,
  );

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error(`Error in /${interaction.commandName}:`, error);
    await replyError(
      interaction,
      "❌ An error occurred while executing this command.",
    );
  }
}
