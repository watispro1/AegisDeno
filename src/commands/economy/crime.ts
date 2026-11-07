import { SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate, NO_PINGS } from "../../services/economyDiscord";
import { formatCoins, relativeTimestamp } from "../../services/economyLogic";
import { COLORS } from "../../utils/embedStyle";

const HEISTS = [
  "swiped the last slice of the mods' pizza", "sold fake Nitro to a bot", "pickpocketed a lurker", "smuggled emojis into the server",
  "ran an off-the-books raffle", "hacked the vending machine",
];
const BUSTS = [
  "tripped over a role panel and got caught", "got spotted by a moderator", "left fingerprints on the pins",
  "bragged about it in #general", "set off the automod",
];
const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("crime")
    .setDescription("Risk it for more coins than /work. Get caught and you pay a fine.")
    .setContexts(InteractionContextType.Guild),
  category: "economy",
  guildOnly: true,
  async execute(interaction: ChatInputCommandInteraction) {
    const cfg = await economyGate(interaction);
    if (!cfg) return;
    const r = await economy().crime(interaction.guildId!, interaction.user.id);
    if (!r.ok) {
      const content = r.reason === "off" ? "💤 /crime is turned off in this server."
        : r.reason === "cooldown" ? `🚓 Lie low for a while. Try again ${relativeTimestamp(r.retryAt)}.`
        : r.reason === "busy" ? "❌ Your balance changed while that was running. Run it again."
        : "❌ Your balance is at the maximum, so nothing was added.";
      return interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
    const next = relativeTimestamp(Date.now() + cfg.crimeCooldownMinutes * 60_000);
    const embed = r.success
      ? new EmbedBuilder().setColor(COLORS.ok).setTitle("🦹 Got away with it")
        .setDescription(`You ${pick(HEISTS)} and made **${formatCoins(cfg, r.amount)}**.`)
      : new EmbedBuilder().setColor(COLORS.danger).setTitle("🚨 Busted")
        .setDescription(`You ${pick(BUSTS)}${r.fine > 0 ? ` and paid a **${formatCoins(cfg, r.fine)}** fine` : ", but your wallet was empty so there was nothing to fine"}.`);
    embed.addFields(
      { name: "Balance", value: formatCoins(cfg, r.balance), inline: true },
      { name: "Try again", value: next, inline: true },
      { name: "Odds", value: `${cfg.crimeSuccessPercent}% success`, inline: true },
    );
    await interaction.reply({ embeds: [embed], allowedMentions: NO_PINGS });
  },
};

export default command;
