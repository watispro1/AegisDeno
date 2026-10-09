import { logger } from "../../utils/logger";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { Command } from "../../types/discord";
import { isBotHierarchyValid, isRoleHierarchyValid } from "../../permissions/hierarchy";
import { sendGuildLog } from "../../services/logging";
import { addModerationCase } from "../../services/moderationCases";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member from the server with confirmation prompt.")
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
    .addBooleanOption(opt =>
      opt.setName("silent").setDescription("Skip DM notification to the banned user").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.BanMembers],
  botPermissions: [PermissionFlagsBits.BanMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target     = interaction.options.getUser("user", true);
    const reason     = interaction.options.getString("reason") ?? "No reason provided.";
    const deleteDays = interaction.options.getInteger("delete_messages") ?? 0;
    const silent     = interaction.options.getBoolean("silent") ?? false;
    const guildId    = interaction.guildId!;

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
        return interaction.reply({ content: "❌ I cannot ban this user — they are above my highest role.", ephemeral: true });
      }
    }

    // Confirmation prompt
    const confirmEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle("⚠️ Ban Confirmation Required")
      .setThumbnail(target.displayAvatarURL())
      .setDescription(`You are about to **permanently ban** ${target.tag} from this server.\n\nThis action will be logged and cannot be undone without manually unbanning.`)
      .addFields(
        { name: "👤 User",         value: `${target.tag} (<@${target.id}>)`, inline: false },
        { name: "📝 Reason",       value: reason, inline: false },
        { name: "🗑️ Msg Deletion", value: `${deleteDays} day(s)`, inline: true },
        { name: "🔕 Silent",       value: silent ? "Yes" : "No", inline: true },
      )
      .setFooter({ text: "This confirmation expires in 30 seconds." })
      .setTimestamp();

    const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("ban_confirm")
        .setLabel("✅ Confirm Ban")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("ban_cancel")
        .setLabel("❌ Cancel")
        .setStyle(ButtonStyle.Secondary),
    );

    const prompt = await interaction.reply({
      embeds: [confirmEmbed],
      components: [confirmRow],
      ephemeral: true,
      fetchReply: true,
    });

    const collector = prompt.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30_000,
      filter: (i) => i.user.id === interaction.user.id,
      max: 1,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "ban_cancel") {
        await i.update({ content: "❌ Ban cancelled.", embeds: [], components: [] });
        return;
      }

      await i.deferUpdate();

      try {
        const guild = interaction.guild!;

        // DM the user before banning (so message can still be delivered)
        if (!silent && member) {
          const dmEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle(`🔨 You have been banned from **${guild.name}**`)
            .addFields({ name: "📝 Reason", value: reason })
            .setFooter({ text: "If you believe this was a mistake, please contact server staff." })
            .setTimestamp();
          await target.send({ embeds: [dmEmbed] }).catch(() => null);
        }

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

        const resultEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle("🔨 Member Banned")
          .setThumbnail(target.displayAvatarURL())
          .addFields(
            { name: "👤 User",         value: `${target.tag} (<@${target.id}>)`, inline: false },
            { name: "📝 Reason",       value: reason, inline: false },
            { name: "🛡️ Moderator",   value: interaction.user.tag, inline: true },
            { name: "🗑️ Msg Deletion", value: `${deleteDays} day(s)`, inline: true },
            { name: "🔕 DM Sent",      value: (!silent && member) ? "✅ Yes" : "❌ No / Silent", inline: true },
          )
          .setTimestamp();

        await i.editReply({ content: null, embeds: [resultEmbed], components: [] });

        await sendGuildLog(interaction.client, guildId, {
          title: "🔨 Member Banned",
          color: 0xED4245,
          description: `**User:** ${target.tag} (<@${target.id}>)\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}\n**Msg Deletion:** ${deleteDays}d`,
        });
      } catch (err) {
        logger.error(`Failed to ban user ${target.id} in guild ${guildId}`, err);
        await i.editReply({ content: "❌ Failed to ban the user. Check my permissions and role hierarchy.", embeds: [], components: [] });
      }
    });

    collector.on("end", async (_, reason) => {
      if (reason === "time") {
        await interaction.editReply({ content: "⏰ Ban confirmation timed out.", embeds: [], components: [] }).catch(() => null);
      }
    });
  },
};

export default command;
