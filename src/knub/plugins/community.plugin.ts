import { definePlugin } from "../definePlugin";
import { EmbedBuilder, MessageFlags } from "discord.js";

export interface CommunityPluginConfig {
  maxGiveawayDurationDays: number;
  suggestionsAutoVote: boolean;
}

export const CommunityPlugin = definePlugin<CommunityPluginConfig>({
  name: "community",
  description: "Community engagement: giveaways, suggestions, polls, announcements, and rich embeds",
  version: "1.0.0",
  defaultConfig: {
    maxGiveawayDurationDays: 30,
    suggestionsAutoVote: true,
  },
  customIdHandlers: [
    {
      pattern: /^giveaway_(?:enter|entrants|reroll)$/,
      async handler(interaction) {
        if (!interaction.isButton()) return;
        const { handleGiveawayButton } = await import("../../commands/community/giveaway");
        await handleGiveawayButton(interaction);
      },
    },
    {
      pattern: /^poll_(?:vote_\d+|end|results)$/,
      async handler(interaction) {
        if (!interaction.isButton()) return;
        const { handlePollButton } = await import("../../services/polls");
        await handlePollButton(interaction);
      },
    },
    {
      pattern: /^suggest_/,
      async handler(interaction) {
        if (!interaction.isButton()) return;
        const [, action, id] = interaction.customId.split("_");
        if (!id || !interaction.guildId) return;

        if (action === "approve" || action === "deny" || action === "consider") {
          const { handleSuggestionReviewButton } = await import("../../commands/community/suggest");
          await handleSuggestionReviewButton(interaction, action, id);
          return;
        }
        if (!["up", "down", "info"].includes(action)) return;

        if (action === "info") {
          const { getSuggestion } = await import("../../services/suggestions");
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

        await interaction.deferUpdate().catch(() => null);

        const { voteOnSuggestion } = await import("../../services/suggestions");
        const suggestion = await voteOnSuggestion(interaction.guildId, id, interaction.user.id, action as "up" | "down");
        if (!suggestion) return;

        const msg = interaction.message;
        const oldEmbed = msg.embeds[0];
        if (!oldEmbed) return;

        const { buildSuggestionComponents, suggestionVotesField } = await import("../../commands/community/suggest");
        const newEmbed = EmbedBuilder.from(oldEmbed).spliceFields(1, 1, suggestionVotesField(suggestion));
        await msg.edit({ embeds: [newEmbed], components: buildSuggestionComponents(suggestion) }).catch(() => null);
      },
    },
    {
      // Optional-reason modal opened by the Approve / Deny / Consider buttons.
      pattern: /^suggestreview_(?:approve|deny|consider)_/,
      async handler(interaction) {
        if (!interaction.isModalSubmit()) return;
        const { handleSuggestionReviewModal } = await import("../../commands/community/suggest");
        await handleSuggestionReviewModal(interaction);
      },
    },
  ],
});
