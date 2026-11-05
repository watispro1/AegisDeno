import { SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate, NO_PINGS } from "../../services/economyDiscord";
import { formatCoins, relativeTimestamp, dailyClaim, workClaim } from "../../services/economyLogic";
import { WEEKLY_COOLDOWN_MS, cooldownLeft } from "../../services/economyRules";
import { COLORS, footer } from "../../utils/embedStyle";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Show your coins (or another member's) in this server's economy.")
    .setContexts(InteractionContextType.Guild)
    .addUserOption(o => o.setName("user").setDescription("Whose balance to show (default: you)")),
  category: "economy",
  guildOnly: true,
  async execute(interaction: ChatInputCommandInteraction) {
    const cfg = await economyGate(interaction);
    if (!cfg) return;
    const user = interaction.options.getUser("user") ?? interaction.user;
    if (user.bot) return interaction.reply({ content: "🤖 Bots don't have balances.", flags: MessageFlags.Ephemeral });
    const acct = await economy().balance(interaction.guildId!, user.id);
    const self = user.id === interaction.user.id;
    const embed = new EmbedBuilder()
      .setColor(COLORS.brand)
      .setAuthor({ name: user.displayName ?? user.username, iconURL: user.displayAvatarURL() })
      .setDescription([
        `**Wallet:** ${formatCoins(cfg, acct.balance)}`,
        `**Bank:** ${formatCoins(cfg, acct.bank)}${cfg.bankCap > 0 ? ` / ${formatCoins(cfg, cfg.bankCap)}` : ""}`,
        `**Total:** ${formatCoins(cfg, acct.balance + acct.bank)}`,
        `**Streak:** ${acct.dailyStreak > 0 ? `🔥 ${acct.dailyStreak} day${acct.dailyStreak === 1 ? "" : "s"}` : "—"}`,
      ].join("\n"))
      .setFooter(footer(self ? "Coins in the bank are safe from /crime fines. Move them with /deposit and /withdraw." : null));
    if (self) {
      const now = Date.now();
      const d = dailyClaim(acct.lastDaily, acct.dailyStreak, now, cfg);
      const w = workClaim(acct.lastWork, now, cfg, () => 0);
      const ready = (cmd: string, at: number | null) => (at === null ? `✅ Ready, run \`/${cmd}\`` : `⏳ ${relativeTimestamp(at)}`);
      embed.addFields(
        { name: "Daily", value: ready("daily", d.ok ? null : d.retryAt), inline: true },
        { name: "Work", value: ready("work", w.ok ? null : w.retryAt), inline: true },
      );
      if (cfg.weeklyAmount > 0) embed.addFields({ name: "Weekly", value: ready("weekly", cooldownLeft(acct.lastWeekly, WEEKLY_COOLDOWN_MS, now)), inline: true });
      if (cfg.crimeEnabled) embed.addFields({ name: "Crime", value: ready("crime", cooldownLeft(acct.lastCrime, cfg.crimeCooldownMinutes * 60_000, now)), inline: true });
    }
    await interaction.reply({ embeds: [embed], allowedMentions: NO_PINGS });
  },
};

export default command;
