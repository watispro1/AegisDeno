import { SlashCommandBuilder, InteractionContextType, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate, NO_PINGS } from "../../services/economyDiscord";
import { formatCoins, type EconomyConfig } from "../../services/economyLogic";
import { INTEREST_COOLDOWN_MS } from "../../services/economyProgress";
import { economyEmbed, waitText } from "./lib/ui";

/** "1.5%": the daily rate from basis points. */
export function interestRate(cfg: Pick<EconomyConfig, "bankInterestBps">): string {
  return `${(cfg.bankInterestBps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

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
    const rate = interestRate(cfg);
    if (!r.ok) {
      const content = r.reason === "off" ? "💤 This server doesn't pay bank interest. A server manager can turn it on with `/economy config interest_bps`."
        : r.reason === "cooldown" ? `⏳ You already collected interest today. Come back ${waitText(r.retryAt)}.`
        : r.reason === "empty" ? "🏦 Your bank is empty. `/deposit` some coins first; interest is paid on the bank only."
        : r.reason === "bank_full" ? "🏦 Your bank is at its limit, so there's no room for interest."
        : r.reason === "too_small" ? `🏦 At ${rate} a day, your bank is too small to earn a whole coin yet.`
        : "❌ Your balance changed while that was running. Run it again.";
      return interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });
    }
    const cap = cfg.bankInterestMaxDaily > 0 ? ` (up to ${formatCoins(cfg, cfg.bankInterestMaxDaily)} a day)` : "";
    await interaction.reply({
      embeds: [economyEmbed(cfg, {
        tone: "ok",
        title: "💹 Interest collected",
        description: `You collected **${formatCoins(cfg, r.amount)}** interest at ${rate}${cap}.`,
        balance: { wallet: r.wallet, bank: r.bank, bankCap: cfg.bankCap },
        fields: [{ name: "Next collection", value: `<t:${Math.ceil((Date.now() + INTEREST_COOLDOWN_MS) / 1000)}:R>`, inline: true }],
      })],
      flags: MessageFlags.Ephemeral,
      allowedMentions: NO_PINGS,
    });
  },
};

export default command;
