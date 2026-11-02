import { SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate, NO_PINGS } from "../../services/economyDiscord";
import { formatCoins, relativeTimestamp } from "../../services/economyLogic";
import { COLORS } from "../../utils/embedStyle";

const JOBS = [
  "walked the server's dogs", "fixed a broken role panel", "moderated a heated debate", "organised the emoji list",
  "answered a pile of tickets", "baked cookies for the mods", "reviewed some suggestions", "cleaned up the pins",
  "wrote the weekly announcement", "tested a new bot feature",
];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("work")
    .setDescription("Do a quick job for some coins (cooldown applies).")
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
    const job = JOBS[Math.floor(Math.random() * JOBS.length)];
    const embed = new EmbedBuilder()
      .setColor(COLORS.ok)
      .setTitle("💼 Work done")
      .setDescription(`You ${job} and earned **${formatCoins(cfg, r.amount)}**.`)
      .addFields(
        { name: "Balance", value: formatCoins(cfg, r.balance), inline: true },
        { name: "Work again", value: relativeTimestamp(Date.now() + cfg.workCooldownMinutes * 60_000), inline: true },
      );
    await interaction.reply({ embeds: [embed], allowedMentions: NO_PINGS });
  },
};

export default command;
