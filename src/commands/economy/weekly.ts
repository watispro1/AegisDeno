import { SlashCommandBuilder, InteractionContextType, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate, NO_PINGS } from "../../services/economyDiscord";
import { formatCoins, relativeTimestamp } from "../../services/economyLogic";
import { WEEKLY_COOLDOWN_MS } from "../../services/economyRules";
import { economyEmbed, waitText } from "./lib/ui";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("weekly")
    .setDescription("Claim your weekly coins, once every 7 days (if this server pays a weekly reward).")
    .setContexts(InteractionContextType.Guild),
  category: "economy",
  guildOnly: true,
  async execute(interaction: ChatInputCommandInteraction) {
    const cfg = await economyGate(interaction);
    if (!cfg) return;
    const r = await economy().weekly(interaction.guildId!, interaction.user.id);
    if (!r.ok) {
      const content = r.reason === "off" ? "💤 Weekly rewards are turned off in this server. A server manager can set an amount with `/economy config weekly_amount`."
        : r.reason === "cooldown" ? `⏳ You already claimed this week's coins. Try again ${waitText(r.retryAt)}.`
        : "❌ Your wallet is at the maximum, so nothing was added. `/deposit` some coins first.";
      return interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
    const embed = economyEmbed(cfg, {
      tone: "ok",
      title: "🗓️ Weekly claimed",
      description: `You got **${formatCoins(cfg, r.amount)}**.`,
      balance: { wallet: r.balance },
      fields: [{ name: "Next claim", value: relativeTimestamp(Date.now() + WEEKLY_COOLDOWN_MS), inline: true }],
    });
    await interaction.reply({ embeds: [embed], allowedMentions: NO_PINGS });
  },
};

export default command;
