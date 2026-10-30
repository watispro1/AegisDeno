/**
 * Ticket panel and in-ticket buttons.
 *
 * customIds (unchanged): ticket_create_<staffRoleId|general>, ticket_claim_<ticketId>, ticket_close_<ticketId>
 */
import { EmbedBuilder, MessageFlags } from "discord.js";
import type { ComponentRoute } from "./router";
import {
  buildTicketControls,
  canCloseTicket,
  claimTicket,
  closeTicket,
  createTicketChannel,
} from "../../services/ticketService";
import { hiddenChannelMessage, isObfuscatedChannel } from "../../utils/channels";

export const ticketRoutes: ComponentRoute[] = [
  {
    name: "ticket-create",
    match: /^ticket_create_/,
    async handle(interaction) {
      if (!interaction.isButton() || !interaction.guild) return;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const staffRoleId = interaction.customId.replace("ticket_create_", "");
      const result = await createTicketChannel(
        interaction.guild,
        interaction.user.id,
        "General Support",
        staffRoleId === "general" ? null : staffRoleId,
      );

      await interaction.editReply({
        content: result
          ? `✅ Ticket created! Please head to ${result.channel}.`
          : "❌ You already have an open ticket or an error occurred.",
      });
    },
  },
  {
    name: "ticket-claim",
    match: /^ticket_claim_(.+)$/,
    async handle(interaction, match) {
      if (!interaction.isButton() || !interaction.guild || !interaction.channel) return;
      const ticketId = match?.[1] ?? "";

      const result = await claimTicket(interaction.guild, interaction.channelId, interaction.user.id);
      if (result.status === "forbidden") {
        await interaction.reply({ content: "❌ Only support staff can claim tickets.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (result.status === "not_ticket") {
        await interaction.reply({ content: "❌ This ticket is no longer open.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (result.status === "already") {
        await interaction.reply({ content: `ℹ️ This ticket is already claimed by <@${result.claimedBy}>.`, flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.update({ components: [buildTicketControls(ticketId, interaction.user.tag ?? interaction.user.username)] });
      if ("send" in interaction.channel) {
        await interaction.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xF1C40F)
              .setTitle("🙋 Ticket Claimed")
              .setDescription(`This ticket is now being handled by <@${interaction.user.id}>.`)
              .setTimestamp(),
          ],
          allowedMentions: { parse: [] },
        }).catch(() => null);
      }
    },
  },
  {
    name: "ticket-close",
    match: /^ticket_close_/,
    async handle(interaction) {
      if (!interaction.isButton() || !interaction.guild) return;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (!(await canCloseTicket(interaction.guild, interaction.channelId, interaction.user.id))) {
        await interaction.editReply({ content: "❌ Only the ticket opener or support staff can close this ticket." });
        return;
      }

      if (isObfuscatedChannel(interaction.channel)) {
        await interaction.editReply({ content: `❌ ${hiddenChannelMessage(interaction.channelId)} The ticket stays open until then.` });
        return;
      }

      const closed = await closeTicket(interaction.guild, interaction.channelId, interaction.user.id, "Closed via button");
      await interaction.editReply({ content: closed ? "🔒 Ticket closure initiated." : "❌ Unable to close ticket." });
    },
  },
];
