import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from "discord.js";
import { Command } from "../../types/discord";
import { createSuggestion, getSuggestion, updateSuggestion } from "../../services/suggestions";
import { getGuildConfig, updateGuildConfig } from "../../services/configuration";
import { logger } from "../../utils/logger";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("suggest")
    .setDescription("Submit or manage server suggestions.")
    .addSubcommand(sub =>
      sub.setName("submit")
        .setDescription("Submit a new suggestion.")
        .addStringOption(opt => opt.setName("suggestion").setDescription("Your suggestion").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("setup")
        .setDescription("Set the channel where suggestions will be posted.")
        .addChannelOption(opt => opt.setName("channel").setDescription("Suggestions channel").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("approve")
        .setDescription("Approve a suggestion.")
        .addStringOption(opt => opt.setName("id").setDescription("Suggestion ID").setRequired(true))
        .addStringOption(opt => opt.setName("reason").setDescription("Reason for approval").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("reject")
        .setDescription("Reject a suggestion.")
        .addStringOption(opt => opt.setName("id").setDescription("Suggestion ID").setRequired(true))
        .addStringOption(opt => opt.setName("reason").setDescription("Reason for rejection").setRequired(false))
    ),

  guildOnly: true,
  botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    await interaction.deferReply({ ephemeral: true });

    const config = await getGuildConfig(guildId);

    if (sub === "setup") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.editReply("❌ You need **Manage Server** to setup suggestions.");
        return;
      }
      const channel = interaction.options.getChannel("channel", true);
      await updateGuildConfig(guildId, { suggestionsChannelId: channel.id });
      await interaction.editReply(`✅ Suggestions will now be posted to <#${channel.id}>.`);
      return;
    }

    if (sub === "submit") {
      if (!config.suggestionsChannelId) {
        await interaction.editReply("❌ Suggestions are not set up in this server. An admin must run `/suggest setup` first.");
        return;
      }
      
      const channel = await interaction.guild!.channels.fetch(config.suggestionsChannelId).catch(() => null);
      if (!(channel instanceof TextChannel)) {
        await interaction.editReply("❌ The configured suggestions channel is invalid or missing.");
        return;
      }

      const content = interaction.options.getString("suggestion", true);
      const suggestion = await createSuggestion(guildId, interaction.user.id, content);

      const embed = new EmbedBuilder()
        .setColor(0x57F287) // Green-ish (default pending)
        .setAuthor({ name: `${interaction.user.tag} suggests:`, iconURL: interaction.user.displayAvatarURL() })
        .setDescription(content)
        .addFields(
          { name: "Status", value: "⏳ Pending Review", inline: true },
          { name: "Votes", value: "👍 0 | 👎 0", inline: true }
        )
        .setFooter({ text: `ID: ${suggestion.id}` })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`suggest_up_${suggestion.id}`)
            .setLabel("Upvote (0)")
            .setStyle(ButtonStyle.Success)
            .setEmoji("👍"),
          new ButtonBuilder()
            .setCustomId(`suggest_down_${suggestion.id}`)
            .setLabel("Downvote (0)")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("👎")
        );

      const msg = await channel.send({ embeds: [embed], components: [row] });
      await updateSuggestion(guildId, suggestion.id, { messageId: msg.id, channelId: channel.id });

      await interaction.editReply(`✅ Your suggestion has been posted in <#${channel.id}>. ID: \`${suggestion.id}\``);
      return;
    }

    if (sub === "approve" || sub === "reject") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.editReply(`❌ You need **Manage Server** to ${sub} suggestions.`);
        return;
      }

      const id = interaction.options.getString("id", true);
      const reason = interaction.options.getString("reason") || "No reason provided.";
      
      const suggestion = await getSuggestion(guildId, id);
      if (!suggestion) {
        await interaction.editReply("❌ Suggestion not found.");
        return;
      }
      if (suggestion.status !== "pending") {
        await interaction.editReply(`❌ This suggestion is already ${suggestion.status}.`);
        return;
      }

      const newStatus = sub === "approve" ? "approved" : "rejected";
      await updateSuggestion(guildId, id, { status: newStatus });

      await interaction.editReply(`✅ Suggestion \`${id}\` marked as ${newStatus}.`);

      if (suggestion.channelId && suggestion.messageId) {
        const channel = await interaction.guild!.channels.fetch(suggestion.channelId).catch(() => null) as TextChannel;
        if (channel) {
          const msg = await channel.messages.fetch(suggestion.messageId).catch(() => null);
          if (msg && msg.embeds.length > 0) {
            const oldEmbed = msg.embeds[0];
            const newEmbed = EmbedBuilder.from(oldEmbed)
              .setColor(sub === "approve" ? 0x2ECC71 : 0xE74C3C)
              .spliceFields(0, 1, { name: "Status", value: sub === "approve" ? `✅ Approved by ${interaction.user.tag}` : `❌ Rejected by ${interaction.user.tag}`, inline: true });

            if (reason && reason !== "No reason provided.") {
              newEmbed.addFields({ name: "Moderator Note", value: reason, inline: false });
            }
            
            // Re-create components to disable them
            const row = new ActionRowBuilder<ButtonBuilder>()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(`suggest_up_${id}`)
                  .setLabel(`Upvote (${suggestion.upvotes.length})`)
                  .setStyle(ButtonStyle.Success)
                  .setEmoji("👍")
                  .setDisabled(true),
                new ButtonBuilder()
                  .setCustomId(`suggest_down_${id}`)
                  .setLabel(`Downvote (${suggestion.downvotes.length})`)
                  .setStyle(ButtonStyle.Danger)
                  .setEmoji("👎")
                  .setDisabled(true)
              );

            await msg.edit({ embeds: [newEmbed], components: [row] }).catch(() => null);
          }
        }
      }
    }
  },
};
