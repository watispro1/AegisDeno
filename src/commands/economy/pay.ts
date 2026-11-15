import { SlashCommandBuilder, InteractionContextType, MessageFlags, type AutocompleteInteraction, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate } from "../../services/economyDiscord";
import { MAX_BALANCE, formatCoins, needsPayConfirmation, payRefusal } from "../../services/economyLogic";
import { payRoomToday, payTax, payTenureRefusal, utcDay } from "../../services/economyRules";
import { requestConfirmation } from "../../utils/confirmation";
import { integerAmountChoices } from "./lib/amounts";
import { withMemberLock } from "./lib/memberLock";
import { STILL_RUNNING, economyEmbed, waitText } from "./lib/ui";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("pay")
    .setDescription("Send coins from your wallet to another member (this server's daily limit and tax may apply).")
    .setContexts(InteractionContextType.Guild)
    .addUserOption(o => o.setName("user").setDescription("Who to pay").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("How many coins; suggestions show all, half and a quarter of your wallet").setRequired(true).setMinValue(1).setMaxValue(MAX_BALANCE).setAutocomplete(true)),
  category: "economy",
  guildOnly: true,
  cooldownMs: 3000,
  async execute(interaction: ChatInputCommandInteraction) {
    const cfg = await economyGate(interaction);
    if (!cfg) return;
    const guildId = interaction.guildId!;
    const to = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);
    const refusal = payRefusal({ fromId: interaction.user.id, toId: to.id, toBot: to.bot, amount: Number.isSafeInteger(amount) && amount >= 1 && amount <= MAX_BALANCE ? amount : null });
    if (refusal) return interaction.reply({ content: `❌ ${refusal}`, flags: MessageFlags.Ephemeral });
    // getMember() only reads the cache, which is empty for members who have not
    // spoken; fetch so a real member is never told they are not in the server.
    const recipient = await interaction.guild!.members.fetch(to.id).catch(() => null);
    if (!recipient) {
      return interaction.reply({ content: "❌ They aren't in this server.", flags: MessageFlags.Ephemeral });
    }
    // New members can't send coins right away, so throwaway accounts can't farm /daily for a main.
    const sender = await interaction.guild!.members.fetch(interaction.user.id).catch(() => null);
    const tenure = payTenureRefusal(sender?.joinedTimestamp ?? null, Date.now(), cfg.payMinMemberHours);
    if (tenure) {
      return interaction.reply({ content: `❌ New members can send coins ${cfg.payMinMemberHours}h after joining. You can pay ${waitText(tenure.readyAt)}.`, flags: MessageFlags.Ephemeral });
    }
    const tax = payTax(amount, cfg.payTaxPercent);
    const taxNote = tax > 0 ? ` They get ${formatCoins(cfg, amount - tax)} after the ${cfg.payTaxPercent}% tax.` : "";

    let confirmed = false;
    if (needsPayConfirmation(amount, cfg)) {
      const answer = await requestConfirmation(interaction, {
        content: `Send **${formatCoins(cfg, amount)}** to ${to}?${taxNote} This can't be undone.`,
        confirmLabel: `Pay ${amount.toLocaleString("en-US")}`,
      });
      if (answer !== "confirmed") return;
      confirmed = true;
    }

    const fail = async (content: string) => { await (confirmed
      ? interaction.editReply({ content, embeds: [], components: [] })
      : interaction.reply({ content, flags: MessageFlags.Ephemeral })); };
    const locked = await withMemberLock(guildId, interaction.user.id, () => economy().pay(guildId, interaction.user.id, to.id, amount));
    if (!locked.ok) return fail(STILL_RUNNING);
    const r = locked.value;
    if (!r.ok) {
      return fail(r.reason === "insufficient"
        ? `❌ You only have ${formatCoins(cfg, r.balance)} in your wallet, not enough to send ${formatCoins(cfg, amount)}.`
        : r.reason === "limit"
          ? `❌ That's over today's sending limit of ${formatCoins(cfg, cfg.payDailyLimit)}. ${r.room > 0 ? `You can send ${formatCoins(cfg, r.room)} more today.` : "You've used it all today."} It resets ${waitText(r.resetsAt)}.`
          : r.reason === "busy" ? "❌ Your balance changed while that was running. Run it again."
          : `❌ ${to.username}'s balance is at the maximum, so nothing was sent.`);
    }
    const taxed = r.tax > 0 ? ` (${formatCoins(cfg, r.tax)} tax, ${formatCoins(cfg, r.sent)} received)` : "";
    const embed = economyEmbed(cfg, {
      tone: "ok",
      title: "💸 Payment sent",
      description: `${interaction.user} paid ${to} **${formatCoins(cfg, amount)}**${taxed}.`,
      balance: { wallet: r.from.balance },
      fields: cfg.payDailyLimit > 0 ? [{ name: "Left to send today", value: formatCoins(cfg, sendRoomAfter(cfg.payDailyLimit, r.from.payDay, r.from.payTotal, Date.now())), inline: true }] : [],
    });
    // Only the recipient is pinged, so they notice the payment.
    const mentions = { parse: [] as never[], users: [to.id] };
    const announcement = { content: `${to}`, embeds: [embed], allowedMentions: mentions };
    if (confirmed) {
      await interaction.editReply({ content: `✅ Sent. Your wallet: ${formatCoins(cfg, r.from.balance)}.`, components: [] });
      await interaction.followUp(announcement);
    } else {
      await interaction.reply(announcement);
    }
  },
  async autocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guildId) return interaction.respond([]);
    const [cfg, acct] = await Promise.all([economy().config(interaction.guildId).catch(() => null), economy().balance(interaction.guildId, interaction.user.id).catch(() => null)]);
    if (!cfg || !acct) return interaction.respond([]).catch(() => undefined);
    const room = sendRoomAfter(cfg.payDailyLimit, acct.payDay, acct.payTotal, Date.now());
    const max = Math.min(MAX_BALANCE, Number.isFinite(room) ? room : MAX_BALANCE);
    await interaction.respond(integerAmountChoices(cfg, { available: acct.balance, min: 1, max: Math.max(1, max), typed: String(interaction.options.getFocused() ?? ""), noun: cfg.currencyName })).catch(() => undefined);
  },
};

/** How much more a member can send today after a payment (UTC day; Infinity with no limit). */
export function sendRoomAfter(limit: number, payDay: string | null, payTotal: number, now: number): number {
  return payRoomToday(limit, payDay, payTotal, utcDay(now));
}

export default command;
