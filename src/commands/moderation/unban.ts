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
  MessageFlags,
} from "discord.js";
import { Command } from "../../types/discord";
import { unbanMember } from "../../services/unban";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user and view their ban details before confirming.")
    .addStringOption(opt =>
      opt.setName("user_id").setDescription("The banned user's Discord ID").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("reason").setDescription("Reason for the unban").setMaxLength(512).setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.BanMembers],
  botPermissions:  [PermissionFlagsBits.BanMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const rawUserId = interaction.options.getString("user_id", true).trim();
    const userId    = rawUserId.replace(/[<@!>]/g, "").trim();
    const reason    = interaction.options.getString("reason") ?? "No reason provided.";
    const guildId   = interaction.guildId!;

    if (!/^\d{17,20}$/.test(userId)) {
      return interaction.reply({ content: "❌ That doesn't look like a valid Discord user ID (17-20 digits).", flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const ban = await interaction.guild!.bans.fetch(userId).catch(() => null);

      if (!ban) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFEE75C)
              .setTitle("⚠️ User Not Banned")
              .setDescription(`No active ban found for user ID \`${userId}\`.`)
              .addFields({ name: "💡 Tip", value: "The user may have already been unbanned or was never banned.", inline: false })
              .setTimestamp(),
          ],
        });
        return;
      }

      // Show full ban details before confirming unban
      const banReason = ban.reason ?? "No reason recorded.";
      const confirmEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle("🔓 Unban Confirmation")
        .setThumbnail(ban.user.displayAvatarURL())
        .setDescription(
          `You are about to **unban** ${ban.user.tag}.\n\nThe user will **not** receive an automatic invite — you will need to send one manually if desired.`
        )
        .addFields(
          { name: "👤 User",         value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: false },
          { name: "📋 Ban Reason",   value: banReason, inline: false },
          { name: "📝 Unban Reason", value: reason, inline: false },
          { name: "🛡️ Moderator",   value: interaction.user.tag, inline: true },
        )
        .setFooter({ text: "This prompt expires in 30 seconds." })
        .setTimestamp();

      const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("unban_confirm")
          .setLabel("Confirm Unban")
          .setStyle(ButtonStyle.Success)
          .setEmoji("🔓"),
        new ButtonBuilder()
          .setCustomId("unban_cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("✖️"),
      );

      const sent = await interaction.editReply({ embeds: [confirmEmbed], components: [confirmRow] });

      const collector = sent.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30_000,
        filter: (i) => i.user.id === interaction.user.id,
        max: 1,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "unban_cancel") {
          await i.update({ content: "❌ Unban cancelled.", embeds: [], components: [] });
          return;
        }

        await i.deferUpdate();
        const result = await unbanMember(interaction.guild!, userId, { id: interaction.user.id, tag: interaction.user.tag }, reason);
        if (!result.ok) {
          await i.editReply({
            content: result.reason === "not_banned" ? "⚠️ That user is no longer banned." : "❌ Failed to unban the user. Check my permissions.",
            embeds: [],
            components: [],
          });
          return;
        }

        const resultEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle("🔓 User Unbanned")
          .setThumbnail(ban.user.displayAvatarURL())
          .addFields(
            { name: "👤 User",         value: `${ban.user.tag} (<@${userId}>)`, inline: false },
            { name: "📋 Was Banned For", value: banReason.slice(0, 512), inline: false },
            { name: "📝 Unban Reason",  value: reason, inline: false },
            { name: "🛡️ Unbanned By",  value: interaction.user.tag, inline: true },
          )
          .setTimestamp();

        await i.editReply({ content: null, embeds: [resultEmbed], components: [] });
      });

      collector.on("end", async (_, stopReason) => {
        if (stopReason === "time") {
          await interaction.editReply({ content: "⏰ Unban confirmation timed out.", embeds: [], components: [] }).catch(() => null);
        }
      });
    } catch (err) {
      logger.error(`Failed to lookup ban for ${userId} in guild ${guildId}`, err);
      await interaction.editReply("❌ Failed to look up the ban. Ensure the ID is correct and I have Ban Members permission.");
    }
  },
};

export default command;
