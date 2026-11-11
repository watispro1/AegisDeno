import { SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { randomInt } from "node:crypto";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate, NO_PINGS } from "../../services/economyDiscord";
import { formatCoins, relativeTimestamp } from "../../services/economyLogic";
import { WORK_MAX_LEVEL, pickJob, workTitle, xpForLevel } from "../../services/economyProgress";
import { COLORS, footer } from "../../utils/embedStyle";

/** "Level 3 · Regular · 18/30 XP" (or "max level"). */
export function levelLine(level: number, xp: number): string {
  if (level >= WORK_MAX_LEVEL) return `Level ${level} · ${workTitle(level)} · max level`;
  return `Level ${level} · ${workTitle(level)} · ${xp}/${xpForLevel(level + 1)} XP`;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("work")
    .setDescription("Do a quick job for some coins. Working levels you up for better pay (cooldown applies).")
    .setContexts(InteractionContextType.Guild),
  category: "economy",
  guildOnly: true,
  async execute(interaction: ChatInputCommandInteraction) {
    const cfg = await economyGate(interaction);
    if (!cfg) return;
    const r = await economy().work(interaction.guildId!, interaction.user.id);
    if (!r.ok) {
      const content = r.reason === "cooldown"
        ? `⏳ You're still tired from your last job. Try again ${relativeTimestamp(r.retryAt)}.`
        : "❌ Your balance is at the maximum, so nothing was added.";
      return interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
    const job = pickJob(r.level, max => randomInt(max));
    const extras = [
      r.levelBonus > 0 ? `+${r.levelBonus}% level bonus` : null,
      r.boost > 0 ? `+${r.boost}% boost` : null,
    ].filter(Boolean).join(", ");
    const embed = new EmbedBuilder()
      .setColor(COLORS.ok)
      .setTitle(r.leveledUp ? `🎉 Level up! You're now a ${workTitle(r.level)}` : "💼 Work done")
      .setDescription(`You ${job} and earned **${formatCoins(cfg, r.amount)}**${extras ? ` (${extras})` : ""}.`)
      .addFields(
        { name: "Balance", value: formatCoins(cfg, r.balance), inline: true },
        { name: "Work again", value: relativeTimestamp(Date.now() + cfg.workCooldownMinutes * 60_000), inline: true },
        { name: "Career", value: levelLine(r.level, r.xp), inline: false },
      );
    if (cfg.workLevelBonusPercent > 0 && r.level < WORK_MAX_LEVEL) {
      embed.setFooter(footer(`Each level adds ${cfg.workLevelBonusPercent}% to your pay, up to level ${WORK_MAX_LEVEL}.`));
    }
    await interaction.reply({ embeds: [embed], allowedMentions: NO_PINGS });
  },
};

export default command;
