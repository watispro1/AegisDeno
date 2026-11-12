import {
  SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits, type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate } from "../../services/economyDiscord";
import { formatCoins, type EconomyConfig } from "../../services/economyLogic";
import type { Transaction, TransactionType } from "../../services/economyStore";
import { COLORS, footer } from "../../utils/embedStyle";
import { truncate } from "../../utils/safeText";
import { runPager } from "../../services/economyPager";
import {
  HISTORY_GROUPS, HISTORY_PAGE_SIZE, HISTORY_PERIODS, isHistoryGroup, isHistoryPeriod, periodSince, summarizeHistory,
  type HistoryGroup, type HistoryPeriod, type HistorySummary,
} from "../../services/economyHistory";
import { HISTORY_BROWSE_MAX } from "../../services/economyService";

/** "Earned +1,200 · Spent −300 · Net +900": the summary line for the loaded period. */
export function summaryText(cfg: EconomyConfig, s: HistorySummary): string {
  const net = s.net === 0 ? formatCoins(cfg, 0) : `${s.net > 0 ? "+" : "−"}${formatCoins(cfg, Math.abs(s.net))}`;
  return `📥 Earned **+${formatCoins(cfg, s.earned)}** · 📤 Spent **−${formatCoins(cfg, s.spent)}** · Net **${net}**`;
}

export const TX_NAMES: Record<TransactionType, string> = {
  daily: "📅 Daily", weekly: "🗓️ Weekly", work: "💼 Work", crime: "🦹 Crime", crime_fine: "🚓 Crime fine", deposit: "🏦 Deposit",
  withdraw: "👛 Withdrawal", gamble: "🎰 Gamble", pay_in: "📥 Received", pay_out: "📤 Sent", buy: "🛍️ Bought", sell: "💱 Sold",
  use: "✨ Used", refund: "↩️ Refund", admin_give: "➕ Staff gave", admin_take: "➖ Staff took", admin_reset: "♻️ Staff reset",
  rob: "🦹 Robbed someone", robbed: "💸 Was robbed", rob_fine: "🚓 Rob fine", interest: "💹 Interest",
};

/** One history line. Other members are shown as mentions, which never ping (allowedMentions is empty). */
export function transactionLine(cfg: EconomyConfig, t: Transaction): string {
  const sign = t.amount > 0 ? "+" : t.amount < 0 ? "−" : "";
  const amount = t.amount === 0 ? "" : ` **${sign}${formatCoins(cfg, Math.abs(t.amount))}**`;
  const other = t.otherUserId ? ` · <@${t.otherUserId}>` : "";
  const note = t.note && (t.type === "buy" || t.type === "sell" || t.type === "use" || t.type.startsWith("admin_")) ? ` · ${truncate(t.note, 60)}` : "";
  return `<t:${Math.floor(t.createdAt.getTime() / 1000)}:R> ${TX_NAMES[t.type] ?? t.type}${amount}${other}${note}`;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("transactions")
    .setDescription("Your recent coin history in this server (staff can check a member's).")
    .setContexts(InteractionContextType.Guild)
    .addUserOption(o => o.setName("user").setDescription("Staff (Manage Server): whose history to show"))
    .addStringOption(o => o.setName("type").setDescription("Only one kind of transaction (default: everything)")
      .addChoices(...(Object.keys(HISTORY_GROUPS) as HistoryGroup[]).map(v => ({ name: HISTORY_GROUPS[v].label, value: v }))))
    .addStringOption(o => o.setName("period").setDescription("How far back (default: everything kept, 90 days)")
      .addChoices(...(Object.keys(HISTORY_PERIODS) as HistoryPeriod[]).map(v => ({ name: HISTORY_PERIODS[v].label, value: v })))),
  category: "economy",
  guildOnly: true,
  cooldownMs: 3000,
  async execute(interaction: ChatInputCommandInteraction) {
    const cfg = await economyGate(interaction);
    if (!cfg) return;
    const user = interaction.options.getUser("user") ?? interaction.user;
    const self = user.id === interaction.user.id;
    // A member's history is private: only they, or staff, can see it.
    if (!self && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: "❌ You can only see your own history. Staff with **Manage Server** can check other members.", flags: MessageFlags.Ephemeral });
    }
    if (user.bot) return interaction.reply({ content: "🤖 Bots don't have balances.", flags: MessageFlags.Ephemeral });
    const typeRaw = interaction.options.getString("type");
    const periodRaw = interaction.options.getString("period");
    const group: HistoryGroup = isHistoryGroup(typeRaw) ? typeRaw : "all";
    const period: HistoryPeriod = isHistoryPeriod(periodRaw) ? periodRaw : "all";
    const types = HISTORY_GROUPS[group].types;
    const rows = await economy().browseHistory(interaction.guildId!, user.id, { types: types ?? undefined, since: periodSince(period, Date.now()) });
    const summary = summarizeHistory(rows);
    const capped = rows.length >= HISTORY_BROWSE_MAX;
    const scope = [group === "all" ? null : HISTORY_GROUPS[group].label, HISTORY_PERIODS[period].label].filter(Boolean).join(" · ");
    await runPager(interaction, {
      prefix: "tx",
      commandName: "transactions",
      pageSize: HISTORY_PAGE_SIZE,
      ephemeral: true,
      total: () => rows.length,
      render: (info) => {
        const page = rows.slice(info.start, info.end);
        const embed = new EmbedBuilder()
          .setColor(COLORS.brand)
          .setAuthor({ name: `${user.displayName ?? user.username}'s transactions`, iconURL: user.displayAvatarURL() })
          .setDescription(page.length
            ? truncate(`${summaryText(cfg, summary)}\n\n${page.map(t => transactionLine(cfg, t)).join("\n")}`, 4000)
            : group === "all" && period === "all" ? "No transactions yet." : "No transactions match that filter. Try a longer period or another type.")
          .setFooter(footer(`${scope} · ${rows.length.toLocaleString("en-US")}${capped ? "+" : ""} transaction${rows.length === 1 ? "" : "s"}${capped ? ` (summary covers the newest ${HISTORY_BROWSE_MAX})` : ""}\nPage ${info.page + 1} of ${info.totalPages} · Newest first · bank moves aren't counted as earned or spent`));
        return { embed };
      },
    });
  },
};

export default command;
