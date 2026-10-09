import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
} from "discord.js";
import { Command } from "../../types/discord";
import { createSuggestion, getSuggestion, updateSuggestion } from "../../services/suggestions";
import { getGuildConfig, updateGuildConfig } from "../../services/configuration";
import { logger } from "../../utils/logger";

const STATUS_COLORS: Record<string, number> = {
  pending:    0x5865F2,
  approved:   0x2ECC71,
  rejected:   0xE74C3C,
  considered: 0xF1C40F,
};

const STATUS_LABELS: Record<string, string> = {
  pending:    "⏳ Pending Review",
  approved:   "✅ Approved",
  rejected:   "❌ Rejected",
  considered: "🟡 Under Consideration",
};

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("suggest")
    .setDescription("Submit ideas or manage server suggestions.")
    .addSubcommand(sub =>
      sub
        .setName("submit")
        .setDescription("Open a form to submit a new suggestion.")
    )
    .addSubcommand(sub =>
      sub
        .setName("setup")
        .setDescription("Set the channel where suggestions will be posted.")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Suggestions channel").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("approve")
        .setDescription("Approve a suggestion.")
        .addStringOption(opt => opt.setName("id").setDescription("Suggestion ID").setRequired(true))
        .addStringOption(opt => opt.setName("reason").setDescription("Reason or note for the author").setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName("deny")
        .setDescription("Deny a suggestion.")
        .addStringOption(opt => opt.setName("id").setDescription("Suggestion ID").setRequired(true))
        .addStringOption(opt => opt.setName("reason").setDescription("Reason for denial").setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName("consider")
        .setDescription("Mark a suggestion as under consideration.")
        .addStringOption(opt => opt.setName("id").setDescription("Suggestion ID").setRequired(true))
        .addStringOption(opt => opt.setName("reason").setDescription("Staff note").setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName("info")
        .setDescription("View vote counts, status, and full details for a suggestion.")
        .addStringOption(opt => opt.setName("id").setDescription("Suggestion ID").setRequired(true))
    ),

  guildOnly: true,
  botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    // Setup
    if (sub === "setup") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: "❌ You need **Manage Server** permission to set up suggestions.", ephemeral: true });
      }
      const channel = interaction.options.getChannel("channel", true);
      await updateGuildConfig(guildId, { suggestionsChannelId: channel.id });
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle("✅ Suggestions Configured")
            .setDescription(`Suggestions will now be posted to <#${channel.id}>.`)
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }

    // Submit — opens a modal form
    if (sub === "submit") {
      const config = await getGuildConfig(guildId);
      if (!config.suggestionsChannelId) {
        return interaction.reply({
          content: "❌ Suggestions are not set up in this server. An admin must run `/suggest setup` first.",
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId("suggest_submit_modal")
        .setTitle("Submit a Suggestion");

      const titleInput = new TextInputBuilder()
        .setCustomId("suggest_title")
        .setLabel("Title (short summary)")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(true)
        .setPlaceholder("e.g. Add a #resources channel");

      const detailInput = new TextInputBuilder()
        .setCustomId("suggest_detail")
        .setLabel("Details (explain your idea)")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1000)
        .setRequired(true)
        .setPlaceholder("Describe your suggestion in more detail…");

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(detailInput),
      );

      await interaction.showModal(modal);

      const modalResponse = await interaction.awaitModalSubmit({
        time: 300_000,
        filter: (m) => m.user.id === interaction.user.id && m.customId === "suggest_submit_modal",
      }).catch(() => null);

      if (!modalResponse) return;
      await modalResponse.deferReply({ ephemeral: true });

      try {
        const channel = await interaction.guild!.channels.fetch(config.suggestionsChannelId).catch(() => null);
        if (!(channel instanceof TextChannel)) {
          await modalResponse.editReply("❌ The configured suggestions channel is invalid or missing.");
          return;
        }

        const title = modalResponse.fields.getTextInputValue("suggest_title");
        const detail = modalResponse.fields.getTextInputValue("suggest_detail");
        const content = `**${title}**\n\n${detail}`;

        const suggestion = await createSuggestion(guildId, interaction.user.id, content);

        const embed = new EmbedBuilder()
          .setColor(STATUS_COLORS.pending)
          .setAuthor({ name: `${interaction.user.tag} suggests:`, iconURL: interaction.user.displayAvatarURL() })
          .setTitle(title)
          .setDescription(detail)
          .addFields(
            { name: "📊 Status", value: STATUS_LABELS.pending, inline: true },
            { name: "🗳️ Votes",  value: "👍 **0**  ·  👎 **0**", inline: true },
          )
          .setFooter({ text: `ID: ${suggestion.id} · Submit your vote below!` })
          .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`suggest_up_${suggestion.id}`)
            .setLabel("Upvote (0)")
            .setStyle(ButtonStyle.Success)
            .setEmoji("👍"),
          new ButtonBuilder()
            .setCustomId(`suggest_down_${suggestion.id}`)
            .setLabel("Downvote (0)")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("👎"),
          new ButtonBuilder()
            .setCustomId(`suggest_info_${suggestion.id}`)
            .setLabel("Details")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("ℹ️"),
        );

        const msg = await channel.send({ embeds: [embed], components: [row] });
        await updateSuggestion(guildId, suggestion.id, { messageId: msg.id, channelId: channel.id });

        await modalResponse.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle("✅ Suggestion Submitted")
              .setDescription(`Your suggestion has been posted in <#${channel.id}>.`)
              .addFields({ name: "🆔 ID", value: `\`${suggestion.id}\``, inline: true })
              .setTimestamp(),
          ],
        });
      } catch (err) {
        logger.error(`Failed to submit suggestion for guild ${guildId}`, err);
        await modalResponse.editReply("❌ Failed to post your suggestion. Please try again.");
      }
      return;
    }

    // Approve / deny / consider
    if (sub === "approve" || sub === "deny" || sub === "consider") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: `❌ You need **Manage Server** to ${sub} suggestions.`, ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      const id = interaction.options.getString("id", true);
      const reason = interaction.options.getString("reason") || "No reason provided.";

      const suggestion = await getSuggestion(guildId, id);
      if (!suggestion) {
        await interaction.editReply("❌ Suggestion not found. Double-check the ID.");
        return;
      }

      let newStatus: "approved" | "rejected" | "considered";
      let statusColor: number;
      let statusText: string;
      let lockVoting = true;

      if (sub === "approve") {
        newStatus = "approved";  statusColor = STATUS_COLORS.approved;
        statusText = `✅ Approved by ${interaction.user.tag}`;
      } else if (sub === "consider") {
        newStatus = "considered"; statusColor = STATUS_COLORS.considered;
        statusText = `🟡 Under Consideration — ${interaction.user.tag}`;
        lockVoting = false;
      } else {
        newStatus = "rejected";  statusColor = STATUS_COLORS.rejected;
        statusText = `❌ Denied by ${interaction.user.tag}`;
      }

      await updateSuggestion(guildId, id, { status: newStatus });

      if (suggestion.channelId && suggestion.messageId) {
        const channel = await interaction.guild!.channels.fetch(suggestion.channelId).catch(() => null) as TextChannel | null;
        if (channel) {
          const msg = await channel.messages.fetch(suggestion.messageId).catch(() => null);
          if (msg && msg.embeds.length > 0) {
            const newEmbed = EmbedBuilder.from(msg.embeds[0])
              .setColor(statusColor)
              .spliceFields(0, 1, { name: "📊 Status", value: statusText, inline: true });

            if (reason !== "No reason provided.") {
              newEmbed.addFields({ name: "📋 Staff Note", value: reason, inline: false });
            }

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(`suggest_up_${id}`)
                .setLabel(`Upvote (${suggestion.upvotes.length})`)
                .setStyle(ButtonStyle.Success)
                .setEmoji("👍")
                .setDisabled(lockVoting),
              new ButtonBuilder()
                .setCustomId(`suggest_down_${id}`)
                .setLabel(`Downvote (${suggestion.downvotes.length})`)
                .setStyle(ButtonStyle.Danger)
                .setEmoji("👎")
                .setDisabled(lockVoting),
              new ButtonBuilder()
                .setCustomId(`suggest_info_${id}`)
                .setLabel("Details")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji("ℹ️"),
            );

            await msg.edit({ embeds: [newEmbed], components: [row] }).catch(() => null);
          }
        }
      }

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(statusColor)
            .setTitle(`Suggestion ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`)
            .addFields(
              { name: "🆔 ID",          value: `\`${id}\``, inline: true },
              { name: "📊 New Status",  value: statusText, inline: true },
              { name: "📋 Staff Note",  value: reason, inline: false },
            )
            .setTimestamp(),
        ],
      });
      return;
    }

    // Info
    if (sub === "info") {
      await interaction.deferReply({ ephemeral: true });

      const id = interaction.options.getString("id", true);
      const suggestion = await getSuggestion(guildId, id);
      if (!suggestion) {
        await interaction.editReply("❌ Suggestion not found.");
        return;
      }

      const totalVotes = suggestion.upvotes.length + suggestion.downvotes.length;
      const approvalPct = totalVotes > 0 ? Math.round((suggestion.upvotes.length / totalVotes) * 100) : 0;

      // Visual vote bar
      const barFilled = Math.round(approvalPct / 10);
      const voteBar = `👍 ${"█".repeat(barFilled)}${"░".repeat(10 - barFilled)} 👎`;

      const embed = new EmbedBuilder()
        .setColor(STATUS_COLORS[suggestion.status] ?? 0x5865F2)
        .setTitle("💡 Suggestion Details")
        .setDescription(suggestion.content)
        .addFields(
          { name: "🆔 ID",         value: `\`${suggestion.id}\``, inline: true },
          { name: "📊 Status",     value: STATUS_LABELS[suggestion.status] ?? suggestion.status, inline: true },
          { name: "👤 Author",     value: `<@${suggestion.authorId}>`, inline: true },
          { name: "👍 Upvotes",    value: `**${suggestion.upvotes.length}**`, inline: true },
          { name: "👎 Downvotes", value: `**${suggestion.downvotes.length}**`, inline: true },
          { name: "📈 Approval",  value: `**${approvalPct}%** (${totalVotes} vote${totalVotes !== 1 ? "s" : ""})`, inline: true },
          { name: "🗳️ Vote Bar",  value: `\`${voteBar}\` **${approvalPct}%**`, inline: false },
          {
            name: "📌 Message",
            value: suggestion.channelId && suggestion.messageId
              ? `[Jump to suggestion](https://discord.com/channels/${guildId}/${suggestion.channelId}/${suggestion.messageId})`
              : "Not linked",
            inline: false,
          },
        )
        .setFooter({ text: `Submitted` })
        .setTimestamp(new Date(suggestion.createdAt));

      await interaction.editReply({ embeds: [embed] });
    }
  },
};

export default command;
