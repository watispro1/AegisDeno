import { SlashCommandBuilder, InteractionContextType, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate } from "../../services/economyDiscord";
import { MAX_BALANCE, formatCoins, needsPayConfirmation, payRefusal } from "../../services/economyLogic";
import { requestConfirmation } from "../../utils/confirmation";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("pay")
    .setDescription("Send some of your coins to another member.")
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
    if (!interaction.options.getMember("user")) {
      return interaction.reply({ content: "❌ They aren't in this server.", flags: MessageFlags.Ephemeral });
    }

    let confirmed = false;
    if (needsPayConfirmation(amount, cfg)) {
      const answer = await requestConfirmation(interaction, {
        content: `Send **${formatCoins(cfg, amount)}** to ${to}? This can't be undone.`,
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
        ? `❌ You only have ${formatCoins(cfg, r.balance)}, not enough to send ${formatCoins(cfg, amount)}.`
        : `❌ ${to.username}'s balance is at the maximum, so nothing was sent.`);
    }
    const announcement = `💸 ${interaction.user} paid ${to} **${formatCoins(cfg, amount)}**. Your balance: ${formatCoins(cfg, r.from.balance)}.`;
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
