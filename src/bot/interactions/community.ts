/**
 * Giveaway, poll and suggestion buttons, and the suggestion review modal.
 *
 * customIds (unchanged, old messages depend on them):
 *   giveaway_enter | giveaway_entrants | giveaway_reroll
 *   poll_vote_<n> | poll_end | poll_results
 *   suggest_<up|down|info|approve|deny|consider>_<suggestionId>
 *   suggestreview_<approve|deny|consider>_<suggestionId>   (modal)
 */
import { EmbedBuilder, MessageFlags, type ButtonInteraction } from "discord.js";
import type { ComponentRoute } from "./router";
import { handleGiveawayButton } from "../../commands/community/giveaway";
import {
  buildSuggestionComponents,
  handleSuggestionReviewButton,
  handleSuggestionReviewModal,
  suggestionVotesField,
} from "../../commands/community/suggest";
import { handlePollButton } from "../../services/polls";
import { getSuggestion, voteOnSuggestion } from "../../services/suggestions";

async function handleSuggestionButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split("_");
  const action = parts[1];
  const id = parts.slice(2).join("_");
  if (!id || !interaction.guildId) return;

  if (action === "approve" || action === "deny" || action === "consider") {
    await handleSuggestionReviewButton(interaction, action, id);
    return;
  }

  if (action === "info") {
    const suggestion = await getSuggestion(interaction.guildId, id);
    if (!suggestion) {
      await interaction.reply({ content: "❌ This suggestion no longer exists.", flags: MessageFlags.Ephemeral }).catch(() => null);
      return;
    }
    await interaction.reply({
      content: `**Suggestion details**\nStatus: **${suggestion.status}**\n👍 ${suggestion.upvotes.length} · 👎 ${suggestion.downvotes.length}${suggestion.reviewReason ? `\nStaff note: ${suggestion.reviewReason}` : ""}\n\n${suggestion.content}`,
      flags: MessageFlags.Ephemeral,
    }).catch(() => null);
    return;
  }

  if (action !== "up" && action !== "down") return;

  await interaction.deferUpdate().catch(() => null);
  const suggestion = await voteOnSuggestion(interaction.guildId, id, interaction.user.id, action);
  if (!suggestion) return;

  const msg = interaction.message;
  const oldEmbed = msg.embeds[0];
  if (!oldEmbed) return;

  const newEmbed = EmbedBuilder.from(oldEmbed).spliceFields(1, 1, suggestionVotesField(suggestion));
  await msg.edit({ embeds: [newEmbed], components: buildSuggestionComponents(suggestion) }).catch(() => null);
}

export const communityRoutes: ComponentRoute[] = [
  {
    name: "giveaway",
    match: /^giveaway_(?:enter|entrants|reroll)$/,
    async handle(interaction) {
      if (!interaction.isButton()) return;
      await handleGiveawayButton(interaction);
    },
  },
  {
    name: "poll",
    match: /^poll_(?:vote_\d+|end|results)$/,
    async handle(interaction) {
      if (!interaction.isButton()) return;
      await handlePollButton(interaction);
    },
  },
  {
    name: "suggestion",
    match: /^suggest_/,
    async handle(interaction) {
      if (!interaction.isButton()) return;
      await handleSuggestionButton(interaction);
    },
  },
  {
    // Optional-reason modal opened by the Approve / Deny / Consider buttons.
    name: "suggestion-review",
    match: /^suggestreview_(?:approve|deny|consider)_/,
    async handle(interaction) {
      if (!interaction.isModalSubmit()) return;
      await handleSuggestionReviewModal(interaction);
    },
  },
];
