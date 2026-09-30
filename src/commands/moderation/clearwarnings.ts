import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { Command } from "../../types/discord";
import { clearWarningsForUser, getWarningsForUser } from "../../services/warnings";
import { sendGuildLog } from "../../services/logging";
import { isRoleHierarchyValid } from "../../permissions/hierarchy";

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

    const currentWarnings = await getWarningsForUser(guildId, target.id);
    if (currentWarnings.length === 0) {
      return interaction.reply({ content: `✅ **${target.tag}** has no warnings to clear.`, ephemeral: true });
    }

    await clearWarningsForUser(guildId, target.id);

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle("✅ Warnings Cleared")
      .addFields(
        { name: "User",      value: `${target.tag} (<@${target.id}>)` },
        { name: "Cleared",   value: `${currentWarnings.length} warning(s)` },
        { name: "Moderator", value: interaction.user.tag, inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await sendGuildLog(interaction.client, guildId, {
      title: "✅ Warnings Cleared",
      color: 0x57F287,
      description: `**User:** ${target.tag} (<@${target.id}>)\n**Cleared:** ${currentWarnings.length} warning(s)\n**Moderator:** ${interaction.user.tag}`,
    });
  },
};
