import { SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import type { GambleGame } from "../../services/economyFlows";
import { economyGate, NO_PINGS } from "../../services/economyDiscord";
import { formatCoins, relativeTimestamp, type EconomyConfig } from "../../services/economyLogic";
import {
  COINFLIP_RETURN_PERCENT, SLOT_PAIR_TENTHS, SLOT_SYMBOLS, SLOT_TRIPLE_TENTHS, utcDay, type BetRefusal,
} from "../../services/economyRules";
import { DICE_RETURN_PERCENT } from "../../services/economyProgress";
import { COLORS, footer } from "../../utils/embedStyle";

const BET_MAX = 10_000_000;
const x = (tenths: number) => `${(tenths / 10).toLocaleString("en-US")}×`;

/** The paytable and limits, shown by /gamble info. */
export function gambleInfoLines(cfg: EconomyConfig): string[] {
  return [
    `**Coinflip:** call it right and get ${COINFLIP_RETURN_PERCENT / 100}× your bet back (2% house edge).`,
    `**Dice:** pick a face from 1 to 6; the right face pays ${DICE_RETURN_PERCENT / 100}× your bet (2% house edge).`,
    `**Slots:** three of a kind ${SLOT_SYMBOLS.map(s => `${s} ${x(SLOT_TRIPLE_TENTHS[s])}`).join(" · ")}`,
    `any two matching ${SLOT_SYMBOLS.map(s => `${s} ${x(SLOT_PAIR_TENTHS[s])}`).join(" · ")} (about 3.6% house edge).`,
    `**Bets:** ${formatCoins(cfg, cfg.gambleMinBet)} to ${formatCoins(cfg, cfg.gambleMaxBet)}, one every ${cfg.gambleCooldownSeconds}s.`,
    cfg.gambleDailyLossCap > 0 ? `**Daily loss limit:** ${formatCoins(cfg, cfg.gambleDailyLossCap)} (resets at 00:00 UTC).` : "**Daily loss limit:** none.",
  ];
}

export function betRefusalText(cfg: EconomyConfig, refusal: BetRefusal, resetsAt: number): string {
  switch (refusal.reason) {
    case "off": return "💤 Gambling is turned off in this server. A server manager can turn it on with `/economy risk`.";
    case "min": return `❌ The minimum bet is ${formatCoins(cfg, refusal.limit ?? cfg.gambleMinBet)}.`;
    case "max": return `❌ The maximum bet is ${formatCoins(cfg, refusal.limit ?? cfg.gambleMaxBet)}.`;
    case "insufficient": return "❌ You don't have that much in your wallet.";
    case "cap": return "❌ A win could push your wallet past the maximum. Deposit some coins first.";
    case "invalid": return "❌ That bet isn't valid. Bets are whole coins, and dice faces are 1 to 6.";
    case "loss_cap": return refusal.limit
      ? `🛑 That would pass today's loss limit. You can bet up to ${formatCoins(cfg, refusal.limit)} until it resets ${relativeTimestamp(resetsAt)}.`
      : `🛑 You've hit today's loss limit. It resets ${relativeTimestamp(resetsAt)}.`;
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("gamble")
    .setDescription("Bet coins on a coinflip, dice or the slots (if this server allows it).")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand(s => s.setName("coinflip").setDescription("Call heads or tails. A right call pays 1.96× your bet.")
      .addIntegerOption(o => o.setName("bet").setDescription("Coins to bet").setRequired(true).setMinValue(1).setMaxValue(BET_MAX))
      .addStringOption(o => o.setName("call").setDescription("Heads or tails").setRequired(true)
        .addChoices({ name: "Heads", value: "heads" }, { name: "Tails", value: "tails" })))
    .addSubcommand(s => s.setName("slots").setDescription("Spin three reels. Matching symbols pay out.")
      .addIntegerOption(o => o.setName("bet").setDescription("Coins to bet").setRequired(true).setMinValue(1).setMaxValue(BET_MAX)))
    .addSubcommand(s => s.setName("dice").setDescription(`Pick a face from 1 to 6. The right face pays ${DICE_RETURN_PERCENT / 100}× your bet.`)
      .addIntegerOption(o => o.setName("bet").setDescription("Coins to bet").setRequired(true).setMinValue(1).setMaxValue(BET_MAX))
      .addIntegerOption(o => o.setName("face").setDescription("The face you think it lands on").setRequired(true).setMinValue(1).setMaxValue(6)))
    .addSubcommand(s => s.setName("info").setDescription("Payouts, bet limits and how much you can still lose today.")),
  category: "economy",
  guildOnly: true,
  cooldownMs: 2000,
  async execute(interaction: ChatInputCommandInteraction) {
    const cfg = await economyGate(interaction);
    if (!cfg) return;
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();
    if (sub === "info") {
      const acct = await economy().balance(guildId, interaction.user.id);
      const loss = acct.gambleDay === utcDay(Date.now()) ? acct.gambleLoss : 0;
      const embed = new EmbedBuilder().setColor(COLORS.brand).setTitle("🎰 Gambling")
        .setDescription(gambleInfoLines(cfg).join("\n"))
        .addFields({ name: "Today", value: loss > 0 ? `Down ${formatCoins(cfg, loss)}` : loss < 0 ? `Up ${formatCoins(cfg, -loss)}` : "Even", inline: true })
        .setFooter(footer(cfg.gamblingEnabled ? "Only bet what you're happy to lose." : "Gambling is off in this server."));
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });
    }
    const bet = interaction.options.getInteger("bet", true);
    const game: GambleGame = sub === "coinflip"
      ? { game: "coinflip", call: interaction.options.getString("call", true) === "tails" ? "tails" : "heads" }
      : sub === "dice" ? { game: "dice", guess: interaction.options.getInteger("face", true) }
      : { game: "slots" };
    const r = await economy().gamble(guildId, interaction.user.id, bet, game);
    if (!r.ok) {
      const content = r.reason === "refused" ? betRefusalText(cfg, r.refusal, r.resetsAt)
        : r.reason === "cooldown" ? `⏳ Slow down. Bet again ${relativeTimestamp(r.retryAt)}.`
        : "❌ Your balance changed while that was running. Run it again.";
      return interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });
    }
    const net = r.result.payout - r.bet;
    const headline = game.game === "coinflip" ? `🪙 It landed on **${r.result.detail}**.`
      : game.game === "dice" ? `🎲 You picked **${game.guess}** and it rolled **${r.result.detail}**.`
      : `🎰 **[ ${r.result.detail} ]**`;
    const outcome = net > 0 ? `You won **${formatCoins(cfg, net)}**.`
      : r.result.payout > 0 ? `You got ${formatCoins(cfg, r.result.payout)} back (down ${formatCoins(cfg, -net)}).`
      : `You lost **${formatCoins(cfg, r.bet)}**.`;
    const embed = new EmbedBuilder()
      .setColor(net > 0 ? COLORS.ok : net === 0 ? COLORS.muted : COLORS.danger)
      .setDescription(`${headline}\n${outcome}`)
      .addFields({ name: "Balance", value: formatCoins(cfg, r.balance), inline: true });
    if (cfg.gambleDailyLossCap > 0) {
      embed.addFields({ name: "Loss limit left today", value: formatCoins(cfg, Math.max(0, cfg.gambleDailyLossCap - Math.max(0, r.lossToday))), inline: true });
    }
    embed.setFooter(footer("Loss limit resets at 00:00 UTC · /gamble info for odds"));
    await interaction.reply({ embeds: [embed], allowedMentions: NO_PINGS });
  },
};

export default command;
