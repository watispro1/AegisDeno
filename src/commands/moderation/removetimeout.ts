import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { Command } from "../../types/discord";
import { sendGuildLog } from "../../services/logging";
import { isRoleHierarchyValid } from "../../permissions/hierarchy";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("removetimeout")
    .setDescription("Remove a timeout from a member.")
    .addUserOption(opt =>
      opt.setName("user").setDescription("The member to untimeout").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  botPermissions:  [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target = interaction.options.getMember("user");
    const guildId = interaction.guildId!;

    if (!target) {
      return interaction.reply({ content: "❌ Member not found.", ephemeral: true });
    }
    const hierarchyOk = await isRoleHierarchyValid(
      interaction.client, guildId, interaction.user.id, target.id
    );
    if (!hierarchyOk) {
      return interaction.reply({
        content: "❌ You cannot remove this member's timeout — they have a higher or equal role.",
        ephemeral: true,
      });
    }

    if (!target.isCommunicationDisabled()) {
      return interaction.reply({ content: "❌ This member is not currently timed out.", ephemeral: true });
    }

    await interaction.deferReply();
    try {
      await target.timeout(null, `Timeout removed by ${interaction.user.tag}`);
      await interaction.editReply(`✅ Removed timeout from **${target.user.tag}**.`);
      await sendGuildLog(interaction.client, guildId, {
        title: "✅ Timeout Removed",
        color: 0x57F287,
        description: `**User:** ${target.user.tag} (<@${target.user.id}>)\n**Moderator:** ${interaction.user.tag}`,
      });
    } catch {
      await interaction.editReply("❌ Failed to remove the timeout.");
    }
  },
};
