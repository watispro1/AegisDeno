import { logger } from "../../utils/logger";
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { Command } from "../../types/discord";
import { clearWarningsForUser, getWarningsForUser } from "../../services/warnings";
import { sendGuildLog } from "../../services/logging";
import { isRoleHierarchyValid } from "../../permissions/hierarchy";
import { addModerationCase } from "../../services/moderationCases";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("clearwarnings")
    .setDescription("Clear all warnings for a user.")
    .addUserOption(opt =>
      opt.setName("user").setDescription("The user whose warnings to clear").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target  = interaction.options.getUser("user", true);
    const guildId = interaction.guildId!;

    const hierarchyOk = await isRoleHierarchyValid(
      interaction.client, guildId, interaction.user.id, target.id
    );
    if (!hierarchyOk) {
      return interaction.reply({
        content: "❌ You cannot clear warnings for this user — they have a higher or equal role.",
        ephemeral: true,
      });
    }

    await interaction.deferReply();
    try {
      const currentWarnings = await getWarningsForUser(guildId, target.id);
      if (currentWarnings.length === 0) {
        await interaction.editReply(`✅ **${target.tag}** has no warnings to clear.`);
        return;
      }

      await clearWarningsForUser(guildId, target.id);
      await addModerationCase({
        guildId,
        userId: target.id,
        moderatorId: interaction.user.id,
        action: "clearwarnings",
        reason: "Warnings cleared by moderator.",
        details: `Cleared ${currentWarnings.length} warning(s).`,
      });

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle("✅ Warnings Cleared")
        .addFields(
          { name: "User",      value: `${target.tag} (<@${target.id}>)` },
          { name: "Cleared",   value: `${currentWarnings.length} warning(s)` },
          { name: "Moderator", value: interaction.user.tag, inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      await sendGuildLog(interaction.client, guildId, {
        title: "✅ Warnings Cleared",
        color: 0x57F287,
        description: `**User:** ${target.tag} (<@${target.id}>)\n**Cleared:** ${currentWarnings.length} warning(s)\n**Moderator:** ${interaction.user.tag}`,
      });
    } catch (err) {
      logger.error(`Failed to clear warnings for user ${target.id} in guild ${guildId}`, err);
      await interaction.editReply("❌ Failed to clear warnings. Please try again.");
    }
  },
};
