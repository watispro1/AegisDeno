/** Suggestion posts: buttons, vote field and the approve/deny/consider review flow shared by /suggest and its buttons. */
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
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
  ChannelType,
} from "discord.js";
import { getSuggestion, reviewSuggestion, type Suggestion } from "./suggestions";
import { isSuggestionOpen, reviewTransition, type SuggestionReviewAction } from "./communityLogic";
import { isObfuscatedChannel } from "../utils/channels";
import { truncate } from "../utils/safeText";
import { softFail } from "../utils/softFail";

/** Channel types that can hold suggestion posts. */
export const SUGGESTION_CHANNEL_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement] as const;

export function isSuggestionChannelType(type: unknown): boolean {
  return (SUGGESTION_CHANNEL_TYPES as readonly unknown[]).includes(type);
}

/** Autocomplete label for a suggestion: its title line, status and short ID. */
export function suggestionChoiceLabel(s: { id: string; content: string; status: string }): string {
  const title = s.content.split("\n")[0].replace(/\*\*/g, "").trim() || "Untitled";
  return truncate(`${title} · ${s.status} · ${s.id.slice(0, 8)}`, 100);
}

export const STATUS_COLORS: Record<string, number> = {
  pending:    0x5865F2,
  approved:   0x2ECC71,
  rejected:   0xE74C3C,
  considered: 0xF1C40F,
};

export const STATUS_LABELS: Record<string, string> = {
  pending:    "⏳ Pending Review",
  approved:   "✅ Approved",
  rejected:   "❌ Rejected",
  considered: "🟡 Under Consideration",
};

// Shared rendering and review logic

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
    await author.send({ embeds: [dm] }).catch(softFail(`Suggestion review DM to ${author.id}`, "debug"));
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
  const parts = interaction.customId.split("_");
  const action = parts[1];
  const id = parts.slice(2).join("_");
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
