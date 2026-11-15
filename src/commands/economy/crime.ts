import { SlashCommandBuilder, InteractionContextType, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { randomInt } from "node:crypto";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate, NO_PINGS } from "../../services/economyDiscord";
import { formatCoins, relativeTimestamp, type EconomyConfig } from "../../services/economyLogic";
import { economyEmbed, waitText } from "./lib/ui";

const HEISTS = [
  "swiped the last slice of the mods' pizza", "sold fake Nitro to a bot", "pickpocketed a lurker", "smuggled emojis into the server",
  "ran an off-the-books raffle", "hacked the vending machine",
];
const BUSTS = [
  "tripped over a role panel and got caught", "got spotted by a moderator", "left fingerprints on the pins",
  "bragged about it in #general", "set off the automod",
];
const pick = (list: string[]) => list[randomInt(list.length)];

export function crimeOffText(): string {
  return "💤 /crime is turned off in this server. A server manager can turn it on with `/economy risk crime:true`.";
}

/** "Try again" and "Odds" fields for a /crime result. */
export function crimeFields(cfg: EconomyConfig, now: number) {
  return [
    { name: "Try again", value: relativeTimestamp(now + cfg.crimeCooldownMinutes * 60_000), inline: true },
    { name: "Odds", value: `${cfg.crimeSuccessPercent}% success · fine up to ${formatCoins(cfg, cfg.crimeFine)}`, inline: true },
  ];
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("crime")
    .setDescription("Risk it for more coins than /work. Get caught and you pay a fine from your wallet.")
    .setContexts(InteractionContextType.Guild),
  category: "economy",
  guildOnly: true,
  async execute(interaction: ChatInputCommandInteraction) {
    const cfg = await economyGate(interaction);
    if (!cfg) return;
    const r = await economy().crime(interaction.guildId!, interaction.user.id);
    if (!r.ok) {
      const content = r.reason === "off" ? crimeOffText()
        : r.reason === "cooldown" ? `🚓 Lie low for a while. Try again ${waitText(r.retryAt)}.`
        : r.reason === "busy" ? "❌ Your balance changed while that was running. Run it again."
        : "❌ Your wallet is at the maximum, so nothing was added. `/deposit` some coins first.";
      return interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
    const embed = economyEmbed(cfg, {
      tone: r.success ? "ok" : "danger",
      title: r.success ? "🦹 Got away with it" : "🚨 Busted",
      description: r.success
        ? `You ${pick(HEISTS)} and made **${formatCoins(cfg, r.amount)}**.`
        : `You ${pick(BUSTS)}${r.fine > 0 ? ` and paid a **${formatCoins(cfg, r.fine)}** fine` : ", but your wallet was empty so there was nothing to fine"}.`,
      balance: { wallet: r.balance },
      fields: crimeFields(cfg, Date.now()),
    });
    await interaction.reply({ embeds: [embed], allowedMentions: NO_PINGS });
  },
};

export default command;
