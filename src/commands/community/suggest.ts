import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  AutocompleteInteraction,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { scopedModalId } from "../../utils/modal";
import { Command } from "../../types/discord";
import {
  createSuggestion,
  getSuggestion,
  updateSuggestion,
  deleteSuggestion,
  listSuggestionsForPicker,
} from "../../services/suggestions";
import { getGuildConfig, updateGuildConfig } from "../../services/configuration";
import { logger } from "../../utils/logger";
import { findSuggestions, suggestionListLine } from "../shared/suggestionList";
import { replyPagedList } from "../../utils/listPager";
import { messageLink } from "../shared/inputChecks";
import { footer } from "../../utils/embedStyle";

function jumpRow(guildId: string, s: { channelId: string | null; messageId: string | null }, label = "Jump to suggestion"): ActionRowBuilder<ButtonBuilder>[] {
  if (!s.channelId || !s.messageId) return [];
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setLabel(label).setStyle(ButtonStyle.Link).setURL(messageLink(guildId, s.channelId, s.messageId)).setEmoji("🔗"))];
}

const NOT_FOUND = "❌ I couldn't find that suggestion in this server. Pick one from the list as you type, or check the ID on the suggestion's footer.";
import { isObfuscatedChannel, hiddenChannelMessage, isSendableChannel } from "../../utils/channels";
import {
  SUGGESTION_CHANNEL_TYPES,
  isSuggestionChannelType,
  suggestionChoiceLabel,
  buildSuggestionComponents,
  applySuggestionReview,
  STATUS_COLORS,
  STATUS_LABELS,
} from "../../services/suggestionReview";
export {
  SUGGESTION_CHANNEL_TYPES,
  isSuggestionChannelType,
  suggestionChoiceLabel,
  buildSuggestionComponents,
  suggestionVotesField,
  applySuggestionReview,
  handleSuggestionReviewButton,
  handleSuggestionReviewModal,
} from "../../services/suggestionReview";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("suggest")
    .setDescription("Submit ideas, browse them, and (staff) approve, deny or consider them.")
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
          opt.setName("channel").setDescription("Suggestions channel (text or announcement)").addChannelTypes(...SUGGESTION_CHANNEL_TYPES).setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("approve")
        .setDescription("Approve a suggestion.")
        .addStringOption(opt => opt.setName("id").setDescription("Suggestion: pick one, or paste its ID").setRequired(true).setAutocomplete(true).setMaxLength(64))
        .addStringOption(opt => opt.setName("reason").setDescription("Reason or note for the author").setRequired(false).setMaxLength(1000))
    )
    .addSubcommand(sub =>
      sub
        .setName("deny")
        .setDescription("Deny a suggestion.")
        .addStringOption(opt => opt.setName("id").setDescription("Suggestion: pick one, or paste its ID").setRequired(true).setAutocomplete(true).setMaxLength(64))
        .addStringOption(opt => opt.setName("reason").setDescription("Reason for denial (sent to the author)").setRequired(false).setMaxLength(1000))
    )
    .addSubcommand(sub =>
      sub
        .setName("consider")
        .setDescription("Mark a suggestion as under consideration.")
        .addStringOption(opt => opt.setName("id").setDescription("Suggestion: pick one, or paste its ID").setRequired(true).setAutocomplete(true).setMaxLength(64))
        .addStringOption(opt => opt.setName("reason").setDescription("Staff note (sent to the author)").setRequired(false).setMaxLength(1000))
    )
    .addSubcommand(sub =>
      sub
        .setName("info")
        .setDescription("View vote counts, status, and full details for a suggestion.")
        .addStringOption(opt => opt.setName("id").setDescription("Suggestion: pick one, or paste its ID").setRequired(true).setAutocomplete(true).setMaxLength(64))
    )
    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription("Browse this server's suggestions, newest first, with votes and links.")
        .addStringOption(opt => opt.setName("status").setDescription("Which ones (default: open = pending or under consideration)").setRequired(false)
          .addChoices(
            { name: "Open (pending or under consideration)", value: "open" },
            { name: "Pending review", value: "pending" },
            { name: "Under consideration", value: "considered" },
            { name: "Approved", value: "approved" },
            { name: "Denied", value: "rejected" },
            { name: "All", value: "all" },
          ))
    ),

  guildOnly: true,
  botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],

  /** `id`: open suggestions for approve/deny/consider, any recent one for info. */
  autocomplete: async (interaction: AutocompleteInteraction) => {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== "id" || !interaction.guildId) return interaction.respond([]);
    const sub = interaction.options.getSubcommand(false);
    const openOnly = sub === "approve" || sub === "deny" || sub === "consider";
    // Review choices only for people who can review; info lists anyone's.
    if (openOnly && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return interaction.respond([]);
    const rows = await listSuggestionsForPicker(interaction.guildId, openOnly, String(focused.value ?? "")).catch(() => []);
    await interaction.respond(rows.map(r => ({ name: suggestionChoiceLabel(r), value: r.id })));
  },

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    // Setup
    if (sub === "setup") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: "❌ You need **Manage Server** permission to set up suggestions.", flags: MessageFlags.Ephemeral });
      }
      const channel = interaction.options.getChannel("channel", true);
      // Older clients (and API callers) can still send any channel type; the
      // option filter alone is not enforcement.
      if (!isSuggestionChannelType(channel.type)) {
        return interaction.reply({ content: "❌ Suggestions need a **text** or **announcement** channel. Voice channels, categories, forums and threads can't hold the suggestion posts.", flags: MessageFlags.Ephemeral });
      }
      const resolved = interaction.guild!.channels.cache.get(channel.id) ?? channel;
      if (isObfuscatedChannel(resolved)) {
        return interaction.reply({ content: `❌ ${hiddenChannelMessage(channel.id)}`, flags: MessageFlags.Ephemeral });
      }
      const me = interaction.guild!.members.me;
      const perms = me && "permissionsFor" in resolved && typeof resolved.permissionsFor === "function" ? resolved.permissionsFor(me) : null;
      const missing = perms
        ? ([["ViewChannel", "View Channel"], ["SendMessages", "Send Messages"], ["EmbedLinks", "Embed Links"]] as const).filter(([flag]) => !perms.has(PermissionFlagsBits[flag])).map(([, label]) => label)
        : [];
      if (missing.length) {
        return interaction.reply({ content: `❌ I need **${missing.join("**, **")}** in <#${channel.id}> before suggestions can be posted there.`, flags: MessageFlags.Ephemeral });
      }
      await updateGuildConfig(guildId, { suggestionsChannelId: channel.id });
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle("✅ Suggestions Configured")
            .setDescription(`Suggestions will now be posted to <#${channel.id}>.`)
            .setTimestamp(),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    // Submit (modal)
    if (sub === "submit") {
      const config = await getGuildConfig(guildId);
      if (!config.suggestionsChannelId) {
        return interaction.reply({
          content: "❌ Suggestions are not set up in this server. An admin must run `/suggest setup` first.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(scopedModalId("suggest_submit_modal", interaction.id))
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
        filter: (m) => m.user.id === interaction.user.id && m.customId === scopedModalId("suggest_submit_modal", interaction.id),
      }).catch(() => null);

      if (!modalResponse) return;
      await modalResponse.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const channel = await interaction.guild!.channels.fetch(config.suggestionsChannelId).catch(() => null);
        if (isObfuscatedChannel(channel) || isObfuscatedChannel(interaction.guild!.channels.cache.get(config.suggestionsChannelId))) {
          await modalResponse.editReply(`❌ The suggestions channel is set, but ${hiddenChannelMessage(config.suggestionsChannelId)}`);
          return;
        }
        if (!channel || !isSuggestionChannelType(channel.type) || !isSendableChannel(channel)) {
          await modalResponse.editReply("❌ The suggestions channel is missing or isn't a text channel any more. Ask an admin to run `/suggest setup` again.");
          return;
        }

        const title = modalResponse.fields.getTextInputValue("suggest_title").trim();
        const detail = modalResponse.fields.getTextInputValue("suggest_detail").trim();
        if (!title || !detail) {
          await modalResponse.editReply("❌ Give your suggestion a title and some details (not just spaces), then try `/suggest submit` again.");
          return;
        }
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

        const msg = await channel.send({ embeds: [embed], components: buildSuggestionComponents(suggestion) }).catch(async (err) => {
          // Don't leave a suggestion nobody can see or vote on.
          await deleteSuggestion(guildId, suggestion.id).catch(() => null);
          throw err;
        });
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
          components: jumpRow(guildId, { channelId: channel.id, messageId: msg.id }, "Jump to your suggestion"),
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
        return interaction.reply({ content: `❌ You need **Manage Server** to ${sub} suggestions.`, flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const id = interaction.options.getString("id", true);
      const reason = interaction.options.getString("reason")?.trim() || null;
      const result = await applySuggestionReview(interaction.client, interaction.guild!, id, sub, interaction.user, reason);
      if (!result.ok) {
        await interaction.editReply(`❌ ${result.error}`);
        return;
      }
      const label = result.suggestion.status.charAt(0).toUpperCase() + result.suggestion.status.slice(1);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(result.color)
            .setTitle(`Suggestion ${label}`)
            .addFields(
              { name: "🆔 ID",          value: `\`${id}\``, inline: true },
              { name: "📊 New Status",  value: result.statusText, inline: true },
              { name: "📋 Staff Note",  value: reason ?? "No reason provided.", inline: false },
            )
            .setFooter(footer("The author was sent a DM (if their DMs are open)."))
            .setTimestamp(),
        ],
        components: jumpRow(interaction.guildId!, result.suggestion),
      });
      return;
    }

    // Info
    if (sub === "info") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const id = interaction.options.getString("id", true);
      const suggestion = await getSuggestion(guildId, id);
      if (!suggestion) {
        await interaction.editReply(NOT_FOUND);
        return;
      }

      const totalVotes = suggestion.upvotes.length + suggestion.downvotes.length;
      const approvalPct = totalVotes > 0 ? Math.round((suggestion.upvotes.length / totalVotes) * 100) : 0;

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
        .setFooter(footer(suggestion.reviewReason ? `Staff note: ${suggestion.reviewReason.slice(0, 200)} · Submitted` : "Submitted"))
        .setTimestamp(new Date(suggestion.createdAt));

      await interaction.editReply({ embeds: [embed], components: jumpRow(guildId, suggestion), allowedMentions: { parse: [] } });
      return;
    }

    // List
    if (sub === "list") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const status = interaction.options.getString("status");
      const rows = await findSuggestions(guildId, status);
      await replyPagedList(interaction, {
        title: `💡 Suggestions (${rows.length}${rows.length >= 100 ? "+" : ""})`,
        lines: rows.map(r => suggestionListLine(r, guildId)),
        empty: "No suggestions match. Submit one with `/suggest submit`.",
        perPage: 6,
        note: "Newest first · /suggest info for the details",
        ephemeral: true,
      });
    }
  },
};

export default command;
