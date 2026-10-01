import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { Command } from "../../types/discord";
import { sendGuildLog } from "../../services/logging";
import { addModerationCase } from "../../services/moderationCases";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user from the server.")
    .addStringOption(opt =>
      opt.setName("user_id").setDescription("The user's ID to unban").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("reason").setDescription("Reason for the unban").setMaxLength(512).setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.BanMembers],
  botPermissions:  [PermissionFlagsBits.BanMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const userId  = interaction.options.getString("user_id", true).trim();
    const reason  = interaction.options.getString("reason") ?? "No reason provided.";
    const guildId = interaction.guildId!;

    if (!/^\d{17,20}$/.test(userId)) {
      await interaction.reply({ content: "❌ That doesn't look like a valid user ID.", ephemeral: true });
      return;
    }

    await interaction.deferReply();
    try {
      const ban = await interaction.guild!.bans.fetch(userId).catch(() => null);
      if (!ban) {
        await interaction.editReply("❌ That user is not banned.");
        return;
      }

      await interaction.guild!.members.unban(userId, `${reason} | Unbanned by ${interaction.user.tag}`);
      await addModerationCase({
        guildId,
        userId,
        moderatorId: interaction.user.id,
        action: "unban",
        reason,
      });

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle("✅ User Unbanned")
        .addFields(
          { name: "User",      value: `${ban.user.tag} (<@${userId}>)` },
          { name: "Reason",    value: reason },
          { name: "Moderator", value: interaction.user.tag, inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      await sendGuildLog(interaction.client, guildId, {
        title: "✅ User Unbanned",
        color: 0x57F287,
        description: `**User:** ${ban.user.tag} (<@${userId}>)\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`,
      });
    } catch {
      await interaction.editReply("❌ Failed to unban the user.");
    }
  },
};
