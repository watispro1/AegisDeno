import { definePlugin } from "../definePlugin";
import { EmbedBuilder, MessageFlags } from "discord.js";

export interface TicketsPluginConfig {
  maxOpenTicketsPerUser: number;
  transcriptLogging: boolean;
  /** Channel that receives HTML transcripts when a ticket closes (set with /ticket settings). */
  logChannelId: string | null;
  /** Close a ticket after this many hours without messages; 0 disables. */
  autoCloseHours: number;
}

export const TicketsPlugin = definePlugin<TicketsPluginConfig>({
  name: "tickets",
  description: "Interactive support tickets with dedicated channel creation, staff claiming, and transcripts",
  version: "1.0.0",
  defaultConfig: {
    maxOpenTicketsPerUser: 1,
    transcriptLogging: true,
    logChannelId: null,
    autoCloseHours: 48,
  },
  customIdHandlers: [
    {
      pattern: /^ticket_create_/,
      async handler(interaction) {
        if (!interaction.isButton() || !interaction.guild) return;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const staffRoleId = interaction.customId.replace("ticket_create_", "");
        const cleanStaffRole = staffRoleId === "general" ? null : staffRoleId;

        const { createTicketChannel } = await import("../../services/ticketService");
        const result = await createTicketChannel(
          interaction.guild,
          interaction.user.id,
          "General Support",
          cleanStaffRole,
        );

        if (result) {
          await interaction.editReply({ content: `✅ Ticket created! Please head to ${result.channel}.` });
        } else {
          await interaction.editReply({ content: "❌ You already have an open ticket or an error occurred." });
        }
      },
    },
    {
      pattern: /^ticket_claim_(.+)$/,
      async handler(interaction, match) {
        if (!interaction.isButton() || !interaction.guild || !interaction.channel) return;
        const ticketId = match?.[1] ?? "";

        const { claimTicket, buildTicketControls } = await import("../../services/ticketService");
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
      pattern: /^ticket_close_/,
      async handler(interaction) {
        if (!interaction.isButton() || !interaction.guild) return;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const { canCloseTicket, closeTicket } = await import("../../services/ticketService");
        if (!(await canCloseTicket(interaction.guild, interaction.channelId, interaction.user.id))) {
          await interaction.editReply({ content: "❌ Only the ticket opener or support staff can close this ticket." });
          return;
        }

        const closed = await closeTicket(
          interaction.guild,
          interaction.channelId,
          interaction.user.id,
          "Closed via button",
        );

        if (closed) {
          await interaction.editReply({ content: "🔒 Ticket closure initiated." });
        } else {
          await interaction.editReply({ content: "❌ Unable to close ticket." });
        }
      },
    },
  ],
});
