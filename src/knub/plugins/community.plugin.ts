import { definePlugin } from "../definePlugin";
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder } from "discord.js";

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
      pattern: /^giveaway_(?:enter|entrants)$/,
      async handler(interaction) {
        if (!interaction.isButton()) return;
        const { handleGiveawayButton } = await import("../../commands/community/giveaway");
        await handleGiveawayButton(interaction);
      },
    },
    {
      pattern: /^suggest_/,
      async handler(interaction) {
        if (!interaction.isButton()) return;
        const [, action, id] = interaction.customId.split("_");
        if (!id || !interaction.guildId || !["up", "down", "info"].includes(action)) return;

        if (action === "info") {
          const { getSuggestion } = await import("../../services/suggestions");
          const suggestion = await getSuggestion(interaction.guildId, id);
          if (!suggestion) {
            await interaction.reply({ content: "❌ This suggestion no longer exists.", ephemeral: true }).catch(() => null);
            return;
          }
          await interaction.reply({
            content: `**Suggestion details**\nStatus: **${suggestion.status}**\n👍 ${suggestion.upvotes.length} · 👎 ${suggestion.downvotes.length}\n\n${suggestion.content}`,
            ephemeral: true,
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

        const newEmbed = EmbedBuilder.from(oldEmbed)
          .spliceFields(1, 1, { name: "Votes", value: `👍 ${suggestion.upvotes.length} | 👎 ${suggestion.downvotes.length}`, inline: true });

        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`suggest_up_${suggestion.id}`)
              .setLabel(`Upvote (${suggestion.upvotes.length})`)
              .setStyle(3)
              .setEmoji("👍"),
            new ButtonBuilder()
              .setCustomId(`suggest_down_${suggestion.id}`)
              .setLabel(`Downvote (${suggestion.downvotes.length})`)
              .setStyle(4)
              .setEmoji("👎"),
          );

        await msg.edit({ embeds: [newEmbed], components: [row] }).catch(() => null);
      },
    },
  ],
});
