import { SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate, NO_PINGS } from "../../services/economyDiscord";
import { formatCoins, relativeTimestamp, dailyClaim, workClaim } from "../../services/economyLogic";
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
      .setDescription(`**Balance:** ${formatCoins(cfg, acct.balance)}`)
      .setFooter(footer(self ? "Earn more with /daily and /work" : null));
    if (self) {
      const now = Date.now();
      const d = dailyClaim(acct.lastDaily, acct.dailyStreak, now, cfg);
      const w = workClaim(acct.lastWork, now, cfg, () => 0);
      embed.addFields(
        { name: "Daily", value: d.ok ? "✅ Ready, run `/daily`" : `⏳ ${relativeTimestamp(d.retryAt)}`, inline: true },
        { name: "Work", value: w.ok ? "✅ Ready, run `/work`" : `⏳ ${relativeTimestamp(w.retryAt)}`, inline: true },
        { name: "Streak", value: acct.dailyStreak > 0 ? `🔥 ${acct.dailyStreak} day${acct.dailyStreak === 1 ? "" : "s"}` : "—", inline: true },
      );
    }
    await interaction.reply({ embeds: [embed], allowedMentions: NO_PINGS });
  },
};

export default command;
