import { SlashCommandBuilder, InteractionContextType, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate } from "../../services/economyDiscord";
import { MAX_BALANCE, formatCoins, needsPayConfirmation, payRefusal, relativeTimestamp } from "../../services/economyLogic";
import { payTax, payTenureRefusal } from "../../services/economyRules";
import { requestConfirmation } from "../../utils/confirmation";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("pay")
    .setDescription("Send some of your coins to another member (daily limit and tax may apply).")
    .setContexts(InteractionContextType.Guild)
    .addUserOption(o => o.setName("user").setDescription("Who to pay").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("How many coins").setRequired(true).setMinValue(1).setMaxValue(MAX_BALANCE)),
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
      return interaction.reply({ content: `❌ New members can send coins ${cfg.payMinMemberHours}h after joining. You can pay ${relativeTimestamp(tenure.readyAt)}.`, flags: MessageFlags.Ephemeral });
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

    const r = await economy().pay(guildId, interaction.user.id, to.id, amount);
    const fail = async (content: string) => { await (confirmed
      ? interaction.editReply({ content, embeds: [], components: [] })
      : interaction.reply({ content, flags: MessageFlags.Ephemeral })); };
    if (!r.ok) {
      return fail(r.reason === "insufficient"
        ? `❌ You only have ${formatCoins(cfg, r.balance)} in your wallet, not enough to send ${formatCoins(cfg, amount)}.`
        : r.reason === "limit"
          ? `❌ That's over today's sending limit of ${formatCoins(cfg, cfg.payDailyLimit)}. You can send ${formatCoins(cfg, r.room)} more until it resets ${relativeTimestamp(r.resetsAt)}.`
          : r.reason === "busy" ? "❌ Your balance changed while that was running. Run it again."
          : `❌ ${to.username}'s balance is at the maximum, so nothing was sent.`);
    }
    const taxed = r.tax > 0 ? ` (${formatCoins(cfg, r.tax)} tax, ${formatCoins(cfg, r.sent)} received)` : "";
    const announcement = `💸 ${interaction.user} paid ${to} **${formatCoins(cfg, amount)}**${taxed}. Your balance: ${formatCoins(cfg, r.from.balance)}.`;
    // Only the recipient is pinged, so they notice the payment.
    const mentions = { parse: [] as never[], users: [to.id] };
    if (confirmed) {
      await interaction.editReply({ content: `✅ Sent. Your balance: ${formatCoins(cfg, r.from.balance)}.`, components: [] });
      await interaction.followUp({ content: announcement, allowedMentions: mentions });
    } else {
      await interaction.reply({ content: announcement, allowedMentions: mentions });
    }
  },
};

export default command;
