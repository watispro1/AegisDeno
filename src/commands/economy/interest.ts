import { SlashCommandBuilder, InteractionContextType, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate, NO_PINGS } from "../../services/economyDiscord";
import { formatCoins, relativeTimestamp } from "../../services/economyLogic";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("interest")
    .setDescription("Collect today's interest on the coins in your bank (once a day, if this server pays interest).")
    .setContexts(InteractionContextType.Guild),
  category: "economy",
  guildOnly: true,
  cooldownMs: 3000,
  async execute(interaction: ChatInputCommandInteraction) {
    const cfg = await economyGate(interaction);
    if (!cfg) return;
    const r = await economy().interest(interaction.guildId!, interaction.user.id);
    const rate = `${(cfg.bankInterestBps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
    if (!r.ok) {
      const content = r.reason === "off" ? "💤 This server doesn't pay bank interest."
        : r.reason === "cooldown" ? `⏳ You already collected interest today. Come back ${relativeTimestamp(r.retryAt)}.`
        : r.reason === "empty" ? "🏦 Your bank is empty. `/deposit` some coins first; interest is paid on the bank only."
        : r.reason === "bank_full" ? "🏦 Your bank is at its limit, so there's no room for interest."
        : r.reason === "too_small" ? `🏦 At ${rate} a day, your bank is too small to earn a whole coin yet.`
        : "❌ Your balance changed while that was running. Run it again.";
      return interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });
    }
    const cap = cfg.bankInterestMaxDaily > 0 ? ` (up to ${formatCoins(cfg, cfg.bankInterestMaxDaily)} a day)` : "";
    await interaction.reply({
      content: `💹 You collected **${formatCoins(cfg, r.amount)}** interest at ${rate}${cap}. Bank: ${formatCoins(cfg, r.bank)}.`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: NO_PINGS,
    });
  },
};

export default command;
