import { SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate, NO_PINGS } from "../../services/economyDiscord";
import { formatCoins, relativeTimestamp } from "../../services/economyLogic";
import { COLORS, footer } from "../../utils/embedStyle";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Claim your daily coins. Claim on consecutive days for a streak bonus.")
    .setContexts(InteractionContextType.Guild),
  category: "economy",
  guildOnly: true,
  async execute(interaction: ChatInputCommandInteraction) {
    const cfg = await economyGate(interaction);
    if (!cfg) return;
    const r = await economy().daily(interaction.guildId!, interaction.user.id);
    if (!r.ok) {
      const content = r.reason === "cooldown"
        ? `⏳ You already claimed your daily. Try again ${relativeTimestamp(r.retryAt)}.`
        : "❌ Your balance is at the maximum, so nothing was added.";
      return interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
    const bonus = r.amount - cfg.dailyAmount;
    const embed = new EmbedBuilder()
      .setColor(COLORS.ok)
      .setTitle("📅 Daily claimed")
      .setDescription(`You got **${formatCoins(cfg, r.amount)}**${bonus > 0 ? ` (includes a ${formatCoins(cfg, bonus)} streak bonus)` : ""}.`)
      .addFields(
        { name: "Balance", value: formatCoins(cfg, r.balance), inline: true },
        { name: "Streak", value: `🔥 ${r.streak} day${r.streak === 1 ? "" : "s"}`, inline: true },
        { name: "Next claim", value: relativeTimestamp(Date.now() + cfg.dailyCooldownHours * 3_600_000), inline: true },
      )
      .setFooter(footer(cfg.dailyStreakBonus > 0 && cfg.dailyStreakCapDays > 0
        ? `Streak bonus grows for ${cfg.dailyStreakCapDays} day${cfg.dailyStreakCapDays === 1 ? "" : "s"}. Miss a day and it starts over.`
        : null));
    await interaction.reply({ embeds: [embed], allowedMentions: NO_PINGS });
  },
};

export default command;
