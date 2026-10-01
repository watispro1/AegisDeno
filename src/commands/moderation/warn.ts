import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { Command } from "../../types/discord";
import { addWarning, getWarningsForUser } from "../../services/warnings";
import { isRoleHierarchyValid } from "../../permissions/hierarchy";
import { sendGuildLog } from "../../services/logging";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Issue a formal warning to a member.")
    .addUserOption(opt =>
      opt.setName("user").setDescription("The member to warn").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("reason").setDescription("Reason for the warning").setRequired(true).setMaxLength(512)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target  = interaction.options.getUser("user", true);
    const reason  = interaction.options.getString("reason", true);
    const guildId = interaction.guildId!;

    if (target.bot) {
      return interaction.reply({ content: "❌ You cannot warn a bot.", ephemeral: true });
    }

    const hierarchyOk = await isRoleHierarchyValid(
      interaction.client, guildId, interaction.user.id, target.id
    );
    if (!hierarchyOk) {
      return interaction.reply({
        content: "❌ You cannot warn this user — they have a higher or equal role.",
        ephemeral: true,
      });
    }

    await addWarning(guildId, target.id, interaction.user.id, reason);
    const totalWarnings = (await getWarningsForUser(guildId, target.id)).length;

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle("⚠️ Warning Issued")
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "User",     value: `${target.tag} (<@${target.id}>)`, inline: false },
        { name: "Reason",   value: reason, inline: false },
        { name: "Moderator",  value: interaction.user.tag, inline: true },
        { name: "Total Warnings", value: `${totalWarnings}`, inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await sendGuildLog(interaction.client, guildId, {
      title: "⚠️ Warning Issued",
      color: 0xFEE75C,
      description: `**User:** ${target.tag} (<@${target.id}>)\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}\n**Total Warnings:** ${totalWarnings}`,
    });
  },
};
