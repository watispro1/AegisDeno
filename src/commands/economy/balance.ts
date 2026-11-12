import { SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate, NO_PINGS } from "../../services/economyDiscord";
import { formatCoins, relativeTimestamp, dailyClaim, workClaim } from "../../services/economyLogic";
import { WEEKLY_COOLDOWN_MS, cooldownLeft } from "../../services/economyRules";
import { INTEREST_COOLDOWN_MS, activeBoost, earnedBadges, workLevel } from "../../services/economyProgress";
import { levelLine } from "./work";
import { nextDailyAmount, rankLine, streakLine } from "../../services/economyStatus";
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
    const [acct, items, rank] = await Promise.all([
      economy().balance(interaction.guildId!, user.id),
      economy().inventory(interaction.guildId!, user.id),
      economy().rank(interaction.guildId!, user.id).catch(() => null),
    ]);
    const now = Date.now();
    const self = user.id === interaction.user.id;
    const level = workLevel(acct.workXp);
    const badges = earnedBadges({ total: acct.balance + acct.bank, bank: acct.bank, streak: acct.dailyStreak, workLevel: level, distinctItems: items.length });
    const embed = new EmbedBuilder()
      .setColor(COLORS.brand)
      .setAuthor({ name: user.displayName ?? user.username, iconURL: user.displayAvatarURL() })
      .setDescription([
        `**Wallet:** ${formatCoins(cfg, acct.balance)}`,
        `**Bank:** ${formatCoins(cfg, acct.bank)}${cfg.bankCap > 0 ? ` / ${formatCoins(cfg, cfg.bankCap)}` : ""}`,
        `**Total:** ${formatCoins(cfg, acct.balance + acct.bank)}${rankLine(rank) ? ` · 🏆 ${rankLine(rank)}` : ""}`,
        `**Streak:** ${streakLine(acct.lastDaily, acct.dailyStreak, now, cfg)}`,
        `**Work:** ${levelLine(level, acct.workXp)}`,
        badges.length ? `**Badges:** ${badges.map(b => `${b.emoji} ${b.name}`).join(" · ")}` : null,
      ].filter(Boolean).join("\n"))
      .setFooter(footer(self ? "Coins in the bank are safe from /crime fines. Move them with /deposit and /withdraw." : null));
    let effects: string[] = [];
    if (self) {
      const d = dailyClaim(acct.lastDaily, acct.dailyStreak, now, cfg);
      const w = workClaim(acct.lastWork, now, cfg, () => 0);
      const ready = (cmd: string, at: number | null) => (at === null ? `✅ Ready, run \`/${cmd}\`` : `⏳ ${relativeTimestamp(at)}`);
      embed.addFields(
        { name: "Daily", value: `${ready("daily", d.ok ? null : d.retryAt)}\nPays ${formatCoins(cfg, nextDailyAmount(acct.lastDaily, acct.dailyStreak, now, cfg))}`, inline: true },
        { name: "Work", value: ready("work", w.ok ? null : w.retryAt), inline: true },
      );
      if (cfg.weeklyAmount > 0) embed.addFields({ name: "Weekly", value: ready("weekly", cooldownLeft(acct.lastWeekly, WEEKLY_COOLDOWN_MS, now)), inline: true });
      if (cfg.crimeEnabled) embed.addFields({ name: "Crime", value: ready("crime", cooldownLeft(acct.lastCrime, cfg.crimeCooldownMinutes * 60_000, now)), inline: true });
      if (cfg.robEnabled) embed.addFields({ name: "Rob", value: ready("rob", cooldownLeft(acct.lastRob, cfg.robCooldownMinutes * 60_000, now)), inline: true });
      if (cfg.bankInterestBps > 0) embed.addFields({ name: "Interest", value: ready("interest", cooldownLeft(acct.lastInterest, INTEREST_COOLDOWN_MS, now)), inline: true });
      // Shields and boosts are only shown to their owner (in a private follow-up), so robbers can't read them off a public reply.
      effects = [
        acct.shieldUntil && acct.shieldUntil.getTime() > now ? `🛡️ Rob shield until ${relativeTimestamp(acct.shieldUntil.getTime())}` : null,
        activeBoost(acct.workBoostUntil, acct.workBoostPercent, now) > 0 ? `⚡ +${acct.workBoostPercent}% work pay until ${relativeTimestamp(acct.workBoostUntil!.getTime())}` : null,
      ].filter((x): x is string => Boolean(x));

    }
    await interaction.reply({ embeds: [embed], allowedMentions: NO_PINGS });
    if (effects.length) await interaction.followUp({ content: `**Active effects** (only you can see this)\n${effects.join("\n")}`, flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });
  },
};

export default command;
