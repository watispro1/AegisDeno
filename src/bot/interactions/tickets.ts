import { moduleEnabled, moduleOffMessage } from "../../services/moduleSwitches";
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
import { ticketCreationFailureMessage } from "../../services/ticketPermissions";
import { describeCommandError, newErrorId } from "../../utils/errorReport";
import { logger } from "../../utils/logger";

export const ticketRoutes: ComponentRoute[] = [
  {
    name: "ticket-create",
    match: /^ticket_create_/,
    async handle(interaction) {
      if (!interaction.isButton() || !interaction.guild) return;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (!(await moduleEnabled(interaction.guild.id, "tickets"))) {
        await interaction.editReply(moduleOffMessage("tickets"));
        return;
      }

      const staffRoleId = interaction.customId.replace("ticket_create_", "");
      const result = await createTicketChannel(
        interaction.guild,
        interaction.user.id,
        "General Support",
        staffRoleId === "general" ? null : staffRoleId,
      );

      await interaction.editReply({
        content: result.ok
          ? result.reused
            ? `ℹ️ You already have an open ticket: ${result.channel}.`
            : `✅ Ticket created! Please head to ${result.channel}.`
          : ticketCreationFailureMessage(result.reason),
      });
    },
  },
  {
    name: "ticket-claim",
    match: /^ticket_claim_(.+)$/,
    async handle(interaction, match) {
      if (!interaction.isButton() || !interaction.guild || !interaction.channel) return;
      const ticketId = match?.[1] ?? "";
      // Acknowledge first: the claim reads and writes the database and checks
      // permissions, which can take longer than Discord's 3-second window.
      await interaction.deferUpdate();

      let result: Awaited<ReturnType<typeof claimTicket>>;
      try {
        result = await claimTicket(interaction.guild, interaction.channelId, interaction.user.id);
      } catch (err) {
        // Answer here: after deferUpdate the router's editReply would overwrite the ticket message.
        const errorId = newErrorId();
        logger.child({ errorId, component: "ticket-claim" }).error(`[${errorId}] Ticket claim failed in ${interaction.channelId}:`, err);
        const report = describeCommandError(err, "Claim ticket", errorId);
        if (!report.silent) await interaction.followUp({ content: report.message, flags: MessageFlags.Ephemeral }).catch(() => null);
        return;
      }
      if (result.status === "forbidden") {
        await interaction.followUp({ content: "❌ Only support staff can claim tickets.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (result.status === "not_ticket") {
        await interaction.followUp({ content: "❌ This ticket is no longer open.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (result.status === "already") {
        await interaction.followUp({ content: `ℹ️ This ticket is already claimed by <@${result.claimedBy}>.`, flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.editReply({ components: [buildTicketControls(ticketId, interaction.user.tag ?? interaction.user.username)] });
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
