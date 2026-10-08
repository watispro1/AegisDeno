import { logger } from "../../utils/logger";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { Command } from "../../types/discord";
import { isBotHierarchyValid, isRoleHierarchyValid } from "../../permissions/hierarchy";
import { sendGuildLog } from "../../services/logging";
import { addModerationCase } from "../../services/moderationCases";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member from the server.")
    .addUserOption(opt =>
      opt.setName("user").setDescription("The member to ban").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("reason").setDescription("Reason for the ban").setMaxLength(512).setRequired(false)
    )
    .addIntegerOption(opt =>
      opt
        .setName("delete_messages")
        .setDescription("Delete messages from this many days (0–7)")
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.BanMembers],
  botPermissions: [PermissionFlagsBits.BanMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target       = interaction.options.getUser("user", true);
    const reason       = interaction.options.getString("reason") ?? "No reason provided.";
    const deleteDays   = interaction.options.getInteger("delete_messages") ?? 0;
    const guildId      = interaction.guildId!;

    if (target.id === interaction.user.id) {
      return interaction.reply({ content: "❌ You cannot ban yourself.", ephemeral: true });
    }
    if (target.id === interaction.client.user?.id) {
      return interaction.reply({ content: "❌ You cannot ban me.", ephemeral: true });
    }
    if (target.id === interaction.guild?.ownerId) {
      return interaction.reply({ content: "❌ You cannot ban the server owner.", ephemeral: true });
    }

    const member = await interaction.guild!.members.fetch(target.id).catch(() => null);
    if (member) {
      const [hierarchyOk, botHierarchyOk] = await Promise.all([
        isRoleHierarchyValid(interaction.client, guildId, interaction.user.id, target.id),
        isBotHierarchyValid(interaction.client, guildId, target.id),
      ]);
      if (!hierarchyOk) {
        return interaction.reply({ content: "❌ You cannot ban this user — they have a higher or equal role.", ephemeral: true });
      }
      if (!botHierarchyOk) {
        return interaction.reply({ content: "❌ I cannot ban this user because they are above my highest role.", ephemeral: true });
      }
    }

    await interaction.deferReply();

    try {
      const guild = interaction.guild!;
      await guild.members.ban(target.id, {
        reason: `${reason} | Banned by ${interaction.user.tag}`,
        deleteMessageSeconds: deleteDays * 86400,
      });
      await addModerationCase({
        guildId,
        userId: target.id,
        moderatorId: interaction.user.id,
        action: "ban",
        reason,
        details: `Deleted messages: ${deleteDays} day(s)`,
      });

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle("🔨 Member Banned")
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: "User",   value: `${target.tag} (<@${target.id}>)`, inline: false },
          { name: "Reason", value: reason, inline: false },
          { name: "Moderator", value: interaction.user.tag, inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      await sendGuildLog(interaction.client, guildId, {
        title: "🔨 Member Banned",
        color: 0xED4245,
        description: `**User:** ${target.tag} (<@${target.id}>)\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`,
      });
    } catch (err) {
      logger.error(`Failed to ban user ${target.id} in guild ${guildId}`, err);
      await interaction.editReply("❌ Failed to ban the user. Check my permissions and role hierarchy.");
    }
  },
};
