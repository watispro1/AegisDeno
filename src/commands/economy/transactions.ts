import {
  SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits, type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate, NO_PINGS } from "../../services/economyDiscord";
import { formatCoins, type EconomyConfig } from "../../services/economyLogic";
import type { Transaction, TransactionType } from "../../services/economyStore";
import { COLORS, footer } from "../../utils/embedStyle";
import { truncate } from "../../utils/safeText";

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
    .addIntegerOption(o => o.setName("count").setDescription("How many to show (default 10)").setMinValue(1).setMaxValue(25)),
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
    const rows = await economy().history(interaction.guildId!, user.id, interaction.options.getInteger("count") ?? 10);
    const embed = new EmbedBuilder()
      .setColor(COLORS.brand)
      .setAuthor({ name: `${user.displayName ?? user.username}'s transactions`, iconURL: user.displayAvatarURL() })
      .setDescription(rows.length ? truncate(rows.map(t => transactionLine(cfg, t)).join("\n"), 4000) : "No transactions yet.")
      .setFooter(footer("Newest first · kept for 90 days"));
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });
  },
};

export default command;
