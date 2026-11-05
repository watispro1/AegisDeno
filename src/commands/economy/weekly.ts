import { SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate, NO_PINGS } from "../../services/economyDiscord";
import { formatCoins, relativeTimestamp } from "../../services/economyLogic";
import { WEEKLY_COOLDOWN_MS } from "../../services/economyRules";
import { COLORS } from "../../utils/embedStyle";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("weekly")
    .setDescription("Claim your weekly coins (once every 7 days).")
    .setContexts(InteractionContextType.Guild),
  category: "economy",
  guildOnly: true,
  async execute(interaction: ChatInputCommandInteraction) {
    const cfg = await economyGate(interaction);
    if (!cfg) return;
    const r = await economy().weekly(interaction.guildId!, interaction.user.id);
    if (!r.ok) {
      const content = r.reason === "off" ? "💤 Weekly rewards are turned off in this server."
        : r.reason === "cooldown" ? `⏳ You already claimed this week's coins. Try again ${relativeTimestamp(r.retryAt)}.`
        : "❌ Your balance is at the maximum, so nothing was added.";
      return interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
    const embed = new EmbedBuilder()
      .setColor(COLORS.ok)
      .setTitle("🗓️ Weekly claimed")
      .setDescription(`You got **${formatCoins(cfg, r.amount)}**.`)
      .addFields(
        { name: "Balance", value: formatCoins(cfg, r.balance), inline: true },
        { name: "Next claim", value: relativeTimestamp(Date.now() + WEEKLY_COOLDOWN_MS), inline: true },
      );
    await interaction.reply({ embeds: [embed], allowedMentions: NO_PINGS });
  },
};

export default command;
