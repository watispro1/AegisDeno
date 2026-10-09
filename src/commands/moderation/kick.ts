import { logger } from "../../utils/logger";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  GuildMember,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { Command } from "../../types/discord";
import { sendGuildLog } from "../../services/logging";
import { isRoleHierarchyValid, isBotHierarchyValid } from "../../permissions/hierarchy";
import { addModerationCase } from "../../services/moderationCases";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server with confirmation.")
    .addUserOption(opt =>
      opt.setName("user").setDescription("The member to kick").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("reason").setDescription("Reason for the kick").setMaxLength(512).setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName("silent").setDescription("Skip DM notification to the member (default: false)").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.KickMembers],
  botPermissions:  [PermissionFlagsBits.KickMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target  = interaction.options.getMember("user") as GuildMember | null;
    const reason  = interaction.options.getString("reason") ?? "No reason provided.";
    const silent  = interaction.options.getBoolean("silent") ?? false;
    const guildId = interaction.guildId!;

    if (!target || typeof target === "string") {
      return interaction.reply({ content: "❌ Member not found in this server.", ephemeral: true });
    }
    if (target.id === interaction.user.id) {
      return interaction.reply({ content: "❌ You cannot kick yourself.", ephemeral: true });
    }
    if (target.id === interaction.client.user?.id) {
      return interaction.reply({ content: "❌ You cannot kick me.", ephemeral: true });
    }
    if (target.id === interaction.guild?.ownerId) {
      return interaction.reply({ content: "❌ You cannot kick the server owner.", ephemeral: true });
    }
    if (!target.kickable) {
      return interaction.reply({ content: "❌ I cannot kick this member — check my role hierarchy.", ephemeral: true });
    }

    const [hierarchyOk, botHierarchyOk] = await Promise.all([
      isRoleHierarchyValid(interaction.client, guildId, interaction.user.id, target.id),
      isBotHierarchyValid(interaction.client, guildId, target.id),
    ]);

    if (!hierarchyOk) {
      return interaction.reply({ content: "❌ You cannot kick this member — they have a higher or equal role.", ephemeral: true });
    }
    if (!botHierarchyOk) {
      return interaction.reply({ content: "❌ I cannot kick this member — they are above my highest role.", ephemeral: true });
    }

    // Show confirmation embed with details
    const confirmEmbed = new EmbedBuilder()
      .setColor(0xE67E22)
      .setTitle("⚠️ Kick Confirmation")
      .setThumbnail(target.user.displayAvatarURL())
      .setDescription(
        `You are about to **kick** ${target.user.tag} from this server.\n\nThey will be able to rejoin with an invite link.`
      )
      .addFields(
        { name: "👤 Member",     value: `${target.user.tag} (<@${target.user.id}>)`, inline: false },
        { name: "📝 Reason",     value: reason, inline: false },
        { name: "🔕 Silent",     value: silent ? "Yes — no DM will be sent" : "No — member will be notified by DM", inline: true },
        { name: "🛡️ Moderator", value: interaction.user.tag, inline: true },
      )
      .setFooter({ text: "This prompt expires in 30 seconds." })
      .setTimestamp();

    const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("kick_confirm")
        .setLabel("Kick Member")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("👢"),
      new ButtonBuilder()
        .setCustomId("kick_edit_reason")
        .setLabel("Edit Reason")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("✏️"),
      new ButtonBuilder()
        .setCustomId("kick_cancel")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("✖️"),
    );

    const prompt = await interaction.reply({
      embeds: [confirmEmbed],
      components: [confirmRow],
      ephemeral: true,
      fetchReply: true,
    });

    let finalReason = reason;

    const collector = prompt.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30_000,
      filter: (i) => i.user.id === interaction.user.id,
      max: 5,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "kick_cancel") {
        collector.stop("cancelled");
        await i.update({ content: "❌ Kick cancelled.", embeds: [], components: [] });
        return;
      }

      if (i.customId === "kick_edit_reason") {
        const modal = new ModalBuilder()
          .setCustomId("kick_reason_modal")
          .setTitle("Edit Kick Reason");
        const reasonInput = new TextInputBuilder()
          .setCustomId("kick_reason_input")
          .setLabel("New reason")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(512)
          .setRequired(true)
          .setValue(finalReason);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
        await i.showModal(modal);

        const modalResponse = await i.awaitModalSubmit({ time: 60_000, filter: (m) => m.user.id === interaction.user.id }).catch(() => null);
        if (modalResponse) {
          finalReason = modalResponse.fields.getTextInputValue("kick_reason_input");
          const updatedEmbed = EmbedBuilder.from(confirmEmbed).spliceFields(1, 1, { name: "📝 Reason", value: finalReason, inline: false });
          await modalResponse.deferUpdate();
          await interaction.editReply({ embeds: [updatedEmbed], components: [confirmRow] });
        }
        return;
      }

      if (i.customId === "kick_confirm") {
        collector.stop("confirmed");
        await i.deferUpdate();

        try {
          // DM before kicking so message can still be delivered
          if (!silent) {
            const dmEmbed = new EmbedBuilder()
              .setColor(0xE67E22)
              .setTitle(`👢 You have been kicked from **${interaction.guild!.name}**`)
              .addFields(
                { name: "📝 Reason", value: finalReason },
                { name: "ℹ️ Note", value: "You may rejoin using an invite link." },
              )
              .setFooter({ text: "If you believe this was a mistake, please contact server staff." })
              .setTimestamp();
            await target.user.send({ embeds: [dmEmbed] }).catch(() => null);
          }

          await target.kick(`${finalReason} | Kicked by ${interaction.user.tag}`);

          await addModerationCase({
            guildId,
            userId: target.id,
            moderatorId: interaction.user.id,
            action: "kick",
            reason: finalReason,
            details: `Silent: ${silent}`,
          });

          const resultEmbed = new EmbedBuilder()
            .setColor(0xE67E22)
            .setTitle("👢 Member Kicked")
            .setThumbnail(target.user.displayAvatarURL())
            .addFields(
              { name: "👤 Member",     value: `${target.user.tag} (<@${target.user.id}>)`, inline: false },
              { name: "📝 Reason",     value: finalReason, inline: false },
              { name: "🛡️ Moderator", value: interaction.user.tag, inline: true },
              { name: "🔕 DM Sent",   value: !silent ? "✅ Yes" : "❌ No (silent)", inline: true },
            )
            .setTimestamp();

          await i.editReply({ content: null, embeds: [resultEmbed], components: [] });

          await sendGuildLog(interaction.client, guildId, {
            title: "👢 Member Kicked",
            color: 0xE67E22,
            description: `**User:** ${target.user.tag} (<@${target.user.id}>)\n**Reason:** ${finalReason}\n**Moderator:** ${interaction.user.tag}\n**DM Sent:** ${!silent ? "Yes" : "No (silent)"}`,
          });
        } catch (err) {
          logger.error(`Failed to kick user ${target.user.id} in guild ${guildId}`, err);
          await i.editReply({ content: "❌ Failed to kick the member. Check my permissions and role hierarchy.", embeds: [], components: [] });
        }
      }
    });

    collector.on("end", async (_, stopReason) => {
      if (stopReason === "time") {
        await interaction.editReply({ content: "⏰ Kick confirmation timed out.", embeds: [], components: [] }).catch(() => null);
      }
    });
  },
};

export default command;
