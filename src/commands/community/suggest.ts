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
  MessageFlags,
  ButtonInteraction,
  ModalSubmitInteraction,
  Client,
  Guild,
  User,
} from "discord.js";
import { scopedModalId } from "../../utils/modal";
import { Command } from "../../types/discord";
import {
  createSuggestion,
  getSuggestion,
  updateSuggestion,
  reviewSuggestion,
  type Suggestion,
} from "../../services/suggestions";
import {
  isSuggestionOpen,
  reviewTransition,
  type SuggestionReviewAction,
} from "../../services/communityLogic";
import { getGuildConfig, updateGuildConfig } from "../../services/configuration";
import { logger } from "../../utils/logger";
import { isObfuscatedChannel, hiddenChannelMessage } from "../../utils/channels";

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

// ─── Shared rendering and review logic ───────────────────────────────────────

const REVIEW_ACTIONS: readonly SuggestionReviewAction[] = ["approve", "deny", "consider"];

function isReviewAction(value: string): value is SuggestionReviewAction {
  return (REVIEW_ACTIONS as readonly string[]).includes(value);
}

/** Vote row plus the moderator review row for a suggestion post. */
export function buildSuggestionComponents(s: Pick<Suggestion, "id" | "status" | "upvotes" | "downvotes">): ActionRowBuilder<ButtonBuilder>[] {
  const open = isSuggestionOpen(s.status);
  const votes = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`suggest_up_${s.id}`).setLabel(`Upvote (${s.upvotes.length})`)
      .setStyle(ButtonStyle.Success).setEmoji("👍").setDisabled(!open),
    new ButtonBuilder().setCustomId(`suggest_down_${s.id}`).setLabel(`Downvote (${s.downvotes.length})`)
      .setStyle(ButtonStyle.Danger).setEmoji("👎").setDisabled(!open),
    new ButtonBuilder().setCustomId(`suggest_info_${s.id}`).setLabel("Details")
      .setStyle(ButtonStyle.Secondary).setEmoji("ℹ️"),
  );
  const review = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`suggest_approve_${s.id}`).setLabel("Approve")
      .setStyle(ButtonStyle.Success).setEmoji("✅").setDisabled(!open),
    new ButtonBuilder().setCustomId(`suggest_deny_${s.id}`).setLabel("Deny")
      .setStyle(ButtonStyle.Danger).setEmoji("❌").setDisabled(!open),
    new ButtonBuilder().setCustomId(`suggest_consider_${s.id}`).setLabel("Consider")
      .setStyle(ButtonStyle.Secondary).setEmoji("🟡").setDisabled(!open || s.status === "considered"),
  );
  return [votes, review];
}

export function suggestionVotesField(s: Pick<Suggestion, "upvotes" | "downvotes">) {
  return { name: "🗳️ Votes", value: `👍 **${s.upvotes.length}**  ·  👎 **${s.downvotes.length}**`, inline: true };
}

type ReviewResult =
  | { ok: true; suggestion: Suggestion; statusText: string; color: number }
  | { ok: false; error: string };

/**
 * Apply an approve / deny / consider review: update the record, restyle the
 * suggestion post, and DM the author (DM failures are ignored).
 */
export async function applySuggestionReview(
  client: Client,
  guild: Guild,
  id: string,
  action: SuggestionReviewAction,
  moderator: User,
  reason: string | null,
): Promise<ReviewResult> {
  const existing = await getSuggestion(guild.id, id);
  if (!existing) return { ok: false, error: "Suggestion not found. Double-check the ID." };

  const check = reviewTransition(existing.status, action);
  if (!check.ok) {
    return {
      ok: false,
      error: check.reason === "final"
        ? `This suggestion is already **${existing.status}** and has been finalized.`
        : "This suggestion is already marked as **under consideration**.",
    };
  }

  const suggestion = await reviewSuggestion(guild.id, id, check.next, moderator.id, reason);
  if (!suggestion) return { ok: false, error: "Another moderator reviewed this suggestion first." };

  const color = STATUS_COLORS[check.next];
  const statusText = check.next === "approved"
    ? `✅ Approved by ${moderator.tag}`
    : check.next === "considered"
      ? `🟡 Under Consideration — ${moderator.tag}`
      : `❌ Denied by ${moderator.tag}`;

  if (suggestion.channelId && suggestion.messageId) {
    const channel = await guild.channels.fetch(suggestion.channelId).catch(() => null);
    if (channel?.isTextBased() && !isObfuscatedChannel(channel)) {
      const msg = await channel.messages.fetch(suggestion.messageId).catch(() => null);
      if (msg && msg.embeds.length > 0) {
        const embed = EmbedBuilder.from(msg.embeds[0]).setColor(color);
        const fields = (embed.data.fields ?? []).filter(f => f.name !== "📋 Staff Note");
        embed.setFields(fields);
        embed.spliceFields(0, 1, { name: "📊 Status", value: statusText, inline: true });
        embed.spliceFields(1, 1, suggestionVotesField(suggestion));
        if (reason) embed.addFields({ name: "📋 Staff Note", value: reason.slice(0, 1024), inline: false });
        await msg.edit({ embeds: [embed], components: buildSuggestionComponents(suggestion) }).catch(() => null);
      }
    }
  }

  // Let the author know. Closed DMs are common and not an error.
  const author = await client.users.fetch(suggestion.authorId).catch(() => null);
  if (author) {
    const title = suggestion.content.split("\n")[0].replace(/\*\*/g, "").slice(0, 200);
    const dm = new EmbedBuilder()
      .setColor(color)
      .setTitle(`Your suggestion in ${guild.name} was updated`)
      .setDescription(`**${title}**`)
      .addFields({ name: "📊 Status", value: STATUS_LABELS[check.next], inline: true })
      .setTimestamp();
    if (reason) dm.addFields({ name: "📋 Staff Note", value: reason.slice(0, 1024), inline: false });
    if (suggestion.channelId && suggestion.messageId) {
      dm.addFields({ name: "📌 Message", value: `[Jump to suggestion](https://discord.com/channels/${guild.id}/${suggestion.channelId}/${suggestion.messageId})`, inline: false });
    }
    await author.send({ embeds: [dm] }).catch(() => null);
  }

  return { ok: true, suggestion, statusText, color };
}

function canReview(interaction: ButtonInteraction | ModalSubmitInteraction | ChatInputCommandInteraction): boolean {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}

/** Approve / Deny / Consider buttons: permission check, then an optional-reason modal. */
export async function handleSuggestionReviewButton(interaction: ButtonInteraction, action: string, id: string): Promise<void> {
  if (!isReviewAction(action) || !interaction.guild) return;
  if (!canReview(interaction)) {
    await interaction.reply({ content: "❌ You need **Manage Server** to review suggestions.", flags: MessageFlags.Ephemeral });
    return;
  }
  const verb = action === "approve" ? "Approve" : action === "deny" ? "Deny" : "Consider";
  const modal = new ModalBuilder()
    .setCustomId(`suggestreview_${action}_${id}`)
    .setTitle(`${verb} suggestion`)
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("Reason or note for the author (optional)")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1000)
        .setRequired(false),
    ));
  await interaction.showModal(modal);
}

/** Submit handler for the review modal opened by the buttons above. */
export async function handleSuggestionReviewModal(interaction: ModalSubmitInteraction): Promise<void> {
  const [, action, id] = interaction.customId.split("_");
  if (!action || !id || !isReviewAction(action) || !interaction.guild) return;
  if (!canReview(interaction)) {
    await interaction.reply({ content: "❌ You need **Manage Server** to review suggestions.", flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const reason = interaction.fields.getTextInputValue("reason").trim() || null;
  const result = await applySuggestionReview(interaction.client, interaction.guild, id, action, interaction.user, reason);
  await interaction.editReply(result.ok ? `Done: ${result.statusText}.` : `❌ ${result.error}`);
}

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
        return interaction.reply({ content: "❌ You need **Manage Server** permission to set up suggestions.", flags: MessageFlags.Ephemeral });
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
        flags: MessageFlags.Ephemeral,
      });
    }

    // Submit — opens a modal form
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

        const msg = await channel.send({ embeds: [embed], components: buildSuggestionComponents(suggestion) });
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
            .setFooter({ text: "The author was sent a DM (if their DMs are open)." })
            .setTimestamp(),
        ],
      });
      return;
    }

    // Info
    if (sub === "info") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
