import {
  SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../../types/discord";
import { economy, type AdjustAction } from "../../services/economyService";
import { postAdjustLog, NO_PINGS } from "../../services/economyDiscord";
import { ECONOMY_LIMITS, MAX_BALANCE, formatCoins, type EconomyConfig, type EconomySettingsInput } from "../../services/economyLogic";
import { requestConfirmation } from "../../utils/confirmation";
import { COLORS, footer } from "../../utils/embedStyle";
import type { EconomyStats, TransactionType } from "../../services/economyStore";
import { TX_NAMES } from "./transactions";

type OptionRow = [option: string, key: keyof typeof ECONOMY_LIMITS, description: string];

const CONFIG_OPTIONS: OptionRow[] = [
  ["daily_amount", "dailyAmount", "Coins from /daily"],
  ["streak_bonus", "dailyStreakBonus", "Extra coins per streak day"],
  ["streak_days", "dailyStreakCapDays", "Streak days that add a bonus (0 = no streak bonus)"],
  ["daily_cooldown_hours", "dailyCooldownHours", "Hours between /daily claims"],
  ["weekly_amount", "weeklyAmount", "Coins from /weekly (0 = off)"],
  ["work_min", "workMin", "Least coins from /work"],
  ["work_max", "workMax", "Most coins from /work"],
  ["work_cooldown_minutes", "workCooldownMinutes", "Minutes between /work uses"],
  ["bank_cap", "bankCap", "Most coins a member can keep in the bank (0 = no limit)"],
  ["pay_confirm_threshold", "payConfirmThreshold", "/pay asks to confirm at or above this (0 = never)"],
  ["pay_min_member_hours", "payMinMemberHours", "Hours in the server before a member can /pay"],
  ["pay_daily_limit", "payDailyLimit", "Most coins a member can send per day, UTC (0 = no limit)"],
  ["pay_tax_percent", "payTaxPercent", "Percent of each payment removed as tax"],
  ["sell_percent", "shopSellPercent", "Percent of the price /shop sell pays back (0 = off)"],
  ["work_level_bonus", "workLevelBonusPercent", "Extra /work pay per work level, in percent (0 = off)"],
  ["interest_bps", "bankInterestBps", "Daily bank interest in basis points, 100 = 1% (0 = off)"],
  ["interest_max", "bankInterestMaxDaily", "Most interest per /interest claim (0 = no cap)"],
];

const RISK_OPTIONS: OptionRow[] = [
  ["crime_success_percent", "crimeSuccessPercent", "Chance /crime succeeds"],
  ["crime_min", "crimeMin", "Least coins from a successful /crime"],
  ["crime_max", "crimeMax", "Most coins from a successful /crime"],
  ["crime_fine", "crimeFine", "Fine when caught (never more than the wallet)"],
  ["crime_cooldown_minutes", "crimeCooldownMinutes", "Minutes between /crime attempts"],
  ["min_bet", "gambleMinBet", "Smallest /gamble bet"],
  ["max_bet", "gambleMaxBet", "Largest /gamble bet"],
  ["daily_loss_cap", "gambleDailyLossCap", "Most a member can lose gambling per day, UTC (0 = no limit)"],
  ["gamble_cooldown_seconds", "gambleCooldownSeconds", "Seconds between bets"],
  ["rob_success_percent", "robSuccessPercent", "Chance /rob succeeds"],
  ["rob_max_percent", "robMaxStealPercent", "Most of the target's wallet one rob takes, in percent"],
  ["rob_max_steal", "robMaxSteal", "Most coins one rob can take"],
  ["rob_fine_percent", "robFinePercent", "Percent of the robber's wallet lost when caught"],
  ["rob_min_wallet", "robMinWallet", "Wallet a member needs before they can rob"],
  ["rob_min_target", "robMinTargetWallet", "Targets with less than this in their wallet can't be robbed"],
  ["rob_cooldown_minutes", "robCooldownMinutes", "Minutes between /rob attempts"],
  ["rob_protect_minutes", "robProtectMinutes", "Minutes a robbed member can't be robbed again (0 = off)"],
];

const n = (v: number) => v.toLocaleString("en-US");

export function configEmbed(cfg: EconomyConfig): EmbedBuilder {
  const streak = cfg.dailyStreakBonus > 0 && cfg.dailyStreakCapDays > 0 ? `, +${n(cfg.dailyStreakBonus)}/streak day up to ${cfg.dailyStreakCapDays} days` : "";
  return new EmbedBuilder()
    .setColor(cfg.enabled ? COLORS.ok : COLORS.muted)
    .setTitle(`💰 Economy: ${cfg.enabled ? "on" : "off"}`)
    .addFields(
      { name: "Currency", value: `${cfg.currencyEmoji} ${cfg.currencyName}`, inline: true },
      { name: "Daily", value: `${formatCoins(cfg, cfg.dailyAmount)} every ${cfg.dailyCooldownHours}h${streak}`, inline: true },
      { name: "Weekly", value: cfg.weeklyAmount > 0 ? formatCoins(cfg, cfg.weeklyAmount) : "off", inline: true },
      { name: "Work", value: `${n(cfg.workMin)}–${n(cfg.workMax)} every ${cfg.workCooldownMinutes} min`, inline: true },
      { name: "Bank", value: cfg.bankCap > 0 ? `up to ${formatCoins(cfg, cfg.bankCap)}` : "no limit", inline: true },
      { name: "Pay", value: [
        cfg.payConfirmThreshold > 0 ? `confirm at ${n(cfg.payConfirmThreshold)}+` : "no confirmation",
        `${cfg.payMinMemberHours}h in server`,
        cfg.payDailyLimit > 0 ? `${n(cfg.payDailyLimit)}/day` : "no daily limit",
        `${cfg.payTaxPercent}% tax`,
      ].join(" · "), inline: true },
      { name: "Shop", value: cfg.shopSellPercent > 0 ? `sell back at ${cfg.shopSellPercent}%` : "selling off", inline: true },
      { name: "Crime", value: cfg.crimeEnabled ? `${cfg.crimeSuccessPercent}% · ${n(cfg.crimeMin)}–${n(cfg.crimeMax)} · fine ${n(cfg.crimeFine)} · every ${cfg.crimeCooldownMinutes} min` : "off", inline: true },
      { name: "Work levels", value: cfg.workLevelBonusPercent > 0 ? `+${cfg.workLevelBonusPercent}% pay per level` : "no level bonus", inline: true },
      { name: "Interest", value: cfg.bankInterestBps > 0 ? `${(cfg.bankInterestBps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%/day${cfg.bankInterestMaxDaily > 0 ? `, max ${n(cfg.bankInterestMaxDaily)}` : ""}` : "off", inline: true },
      { name: "Rob", value: cfg.robEnabled ? `${cfg.robSuccessPercent}% · up to ${cfg.robMaxStealPercent}% (max ${n(cfg.robMaxSteal)}) · fine ${cfg.robFinePercent}% · every ${cfg.robCooldownMinutes} min` : "off", inline: true },
      { name: "Gambling", value: cfg.gamblingEnabled ? `bets ${n(cfg.gambleMinBet)}–${n(cfg.gambleMaxBet)} · loss cap ${cfg.gambleDailyLossCap > 0 ? `${n(cfg.gambleDailyLossCap)}/day` : "none"} · ${cfg.gambleCooldownSeconds}s apart` : "off", inline: true },
    )
    .setFooter(footer("Change with /economy config and /economy risk, or on the dashboard's Economy page"));
}

/** /economy stats: totals for this server only, and what happened in the last week. */
export function statsEmbed(cfg: EconomyConfig, s: EconomyStats): EmbedBuilder {
  const activity = s.activity.slice(0, 12).map(a => `${TX_NAMES[a.type] ?? a.type}: ${n(a.count)}× · ${a.total >= 0 ? "+" : "−"}${n(Math.abs(a.total))}`);
  const sum = (types: Set<TransactionType>) => s.activity.filter(a => types.has(a.type)).reduce((t, a) => t + a.total, 0);
  // Gambling nets out per bet (house edge removes coins); pay tax is what senders paid minus what recipients got.
  const gamble = s.activity.find(a => a.type === "gamble")?.total ?? 0;
  const tax = -sum(new Set<TransactionType>(["pay_in", "pay_out"]));
  const minted = sum(MINTED) + Math.max(0, gamble);
  const burned = sum(BURNED) + Math.min(0, gamble) - Math.max(0, tax);
  return new EmbedBuilder()
    .setColor(COLORS.brand)
    .setTitle("📊 Economy stats")
    .addFields(
      { name: "Members with coins", value: n(s.accounts), inline: true },
      { name: "In wallets", value: formatCoins(cfg, s.wallet), inline: true },
      { name: "In banks", value: formatCoins(cfg, s.bank), inline: true },
      { name: "Created (7 days)", value: formatCoins(cfg, minted), inline: true },
      { name: "Removed (7 days)", value: formatCoins(cfg, Math.abs(burned)), inline: true },
      { name: "Activity (7 days)", value: activity.length ? activity.join("\n") : "Nothing yet." },
    )
    .setFooter(footer(`Since ${s.since.toISOString().slice(0, 10)} · transfers between members aren't counted as created or removed`));
}

/** Transaction types that create coins, and ones that remove them from circulation. */
const MINTED = new Set<TransactionType>(["daily", "weekly", "work", "crime", "interest", "sell", "admin_give"]);
const BURNED = new Set<TransactionType>(["crime_fine", "rob_fine", "buy", "admin_take", "admin_reset"]);

function readOptions(interaction: ChatInputCommandInteraction, rows: OptionRow[], input: EconomySettingsInput): void {
  for (const [name, key] of rows) {
    const v = interaction.options.getInteger(name);
    if (v !== null) input[key] = v;
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("economy")
    .setDescription("Set up this server's economy (Manage Server).")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName("toggle").setDescription("Turn the economy on or off (off by default).")
      .addBooleanOption(o => o.setName("enabled").setDescription("On or off (default: flip)")))
    .addSubcommand(s => {
      s.setName("config").setDescription("Show or change economy settings. Run with no options to see them.")
        .addStringOption(o => o.setName("currency_name").setDescription("e.g. coins, gems").setMaxLength(24))
        .addStringOption(o => o.setName("currency_emoji").setDescription("One emoji, or a custom emoji").setMaxLength(64));
      for (const [name, key, description] of CONFIG_OPTIONS) {
        s.addIntegerOption(o => o.setName(name).setDescription(description).setMinValue(ECONOMY_LIMITS[key][0]).setMaxValue(ECONOMY_LIMITS[key][1]));
      }
      return s;
    })
    .addSubcommand(s => {
      s.setName("risk").setDescription("Show or change /crime and /gamble settings. Gambling is off until you turn it on.")
        .addBooleanOption(o => o.setName("crime").setDescription("Allow /crime"))
        .addBooleanOption(o => o.setName("gambling").setDescription("Allow /gamble (off by default)"))
        .addBooleanOption(o => o.setName("rob").setDescription("Allow /rob (off by default)"));
      for (const [name, key, description] of RISK_OPTIONS) {
        s.addIntegerOption(o => o.setName(name).setDescription(description).setMinValue(ECONOMY_LIMITS[key][0]).setMaxValue(ECONOMY_LIMITS[key][1]));
      }
      return s;
    })
    .addSubcommand(s => s.setName("stats").setDescription("Coins in circulation and the last 7 days of economy activity in this server."))
    .addSubcommand(s => s.setName("give").setDescription("Give coins to a member (logged to the mod log).")
      .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true))
      .addIntegerOption(o => o.setName("amount").setDescription("Coins").setRequired(true).setMinValue(1).setMaxValue(MAX_BALANCE))
      .addStringOption(o => o.setName("reason").setDescription("Why (shown in the mod log)").setMaxLength(200)))
    .addSubcommand(s => s.setName("take").setDescription("Take coins from a member (logged to the mod log).")
      .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true))
      .addIntegerOption(o => o.setName("amount").setDescription("Coins").setRequired(true).setMinValue(1).setMaxValue(MAX_BALANCE))
      .addStringOption(o => o.setName("reason").setDescription("Why (shown in the mod log)").setMaxLength(200)))
    .addSubcommand(s => s.setName("reset").setDescription("Set a member's wallet and bank to 0 (logged to the mod log).")
      .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Why (shown in the mod log)").setMaxLength(200))),
  category: "economy",
  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageGuild],
  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const svc = economy();
    const sub = interaction.options.getSubcommand();

    if (sub === "toggle") {
      const current = await svc.config(guildId);
      const enabled = interaction.options.getBoolean("enabled") ?? !current.enabled;
      const r = await svc.updateConfig(guildId, { enabled });
      if (!r.ok) return interaction.reply({ content: "❌ Couldn't save that.", flags: MessageFlags.Ephemeral });
      return interaction.reply({
        content: enabled
          ? "✅ The economy is **on**. Members can use `/daily`, `/weekly`, `/work`, `/crime`, `/pay`, the bank, `/shop` and `/leaderboard`. Tune it with `/economy config`; gambling stays off until you turn it on with `/economy risk`."
          : "💤 The economy is **off**. Balances and the shop are kept; members just can't use the commands until you turn it back on.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "config" || sub === "risk") {
      const input: EconomySettingsInput = sub === "config"
        ? { currencyName: interaction.options.getString("currency_name") ?? undefined, currencyEmoji: interaction.options.getString("currency_emoji") ?? undefined }
        : {
          crimeEnabled: interaction.options.getBoolean("crime") ?? undefined,
          gamblingEnabled: interaction.options.getBoolean("gambling") ?? undefined,
          robEnabled: interaction.options.getBoolean("rob") ?? undefined,
        };
      readOptions(interaction, sub === "config" ? CONFIG_OPTIONS : RISK_OPTIONS, input);
      const changed = Object.values(input).some(v => v !== undefined);
      if (!changed) return interaction.reply({ embeds: [configEmbed(await svc.config(guildId))], flags: MessageFlags.Ephemeral });
      const r = await svc.updateConfig(guildId, input);
      if (!r.ok) return interaction.reply({ content: `❌ Nothing was changed. ${Object.values(r.errors).join(" ")}`, flags: MessageFlags.Ephemeral });
      return interaction.reply({ content: "✅ Saved.", embeds: [configEmbed(r.value)], flags: MessageFlags.Ephemeral });
    }

    if (sub === "stats") {
      const cfg = await svc.config(guildId);
      return interaction.reply({ embeds: [statsEmbed(cfg, await svc.stats(guildId, 7))], flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });
    }

    // give / take / reset
    const user = interaction.options.getUser("user", true);
    if (user.bot) return interaction.reply({ content: "❌ Bots don't have balances.", flags: MessageFlags.Ephemeral });
    const action = sub as AdjustAction;
    const amount = action === "reset" ? 0 : interaction.options.getInteger("amount", true);
    const reason = interaction.options.getString("reason")?.trim() || null;
    const cfg = await svc.config(guildId);

    if (action === "reset") {
      const before = await svc.balance(guildId, user.id);
      const answer = await requestConfirmation(interaction, { content: `Reset ${user}'s wallet (${formatCoins(cfg, before.balance)}) and bank (${formatCoins(cfg, before.bank)}) to 0?`, confirmLabel: "Reset balance" });
      if (answer !== "confirmed") return;
    }
    const r = await svc.adjust(guildId, user.id, action, amount, interaction.user.id, reason);
    const say = async (content: string) => { await (interaction.deferred || interaction.replied
      ? interaction.editReply({ content, components: [], allowedMentions: NO_PINGS })
      : interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS })); };
    if (!r.ok) {
      return say(r.reason === "insufficient"
        ? `❌ ${user} only has ${formatCoins(cfg, r.balance)}. Take less, or use \`/economy reset\`.`
        : `❌ That would put ${user} over the ${formatCoins(cfg, MAX_BALANCE)} limit.`);
    }
    await postAdjustLog(interaction.client, { guildId, userId: user.id, actorId: interaction.user.id, action, amount: action === "reset" ? r.previous : amount, balance: r.balance, reason }, interaction.user.tag, "command");
    const verb = action === "give" ? `Gave ${formatCoins(cfg, amount)} to` : action === "take" ? `Took ${formatCoins(cfg, amount)} from` : "Reset the balance of";
    return say(`✅ ${verb} ${user}. New balance: ${formatCoins(cfg, r.balance)}. Logged to the mod log.`);
  },
};

export default command;
