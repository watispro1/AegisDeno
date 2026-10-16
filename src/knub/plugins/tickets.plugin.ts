import { definePlugin } from "../definePlugin";

export interface TicketsPluginConfig {
  maxOpenTicketsPerUser: number;
  transcriptLogging: boolean;
}

export const TicketsPlugin = definePlugin<TicketsPluginConfig>({
  name: "tickets",
  description: "Interactive support tickets with dedicated channel creation, staff claiming, and transcripts",
  version: "1.0.0",
  defaultConfig: {
    maxOpenTicketsPerUser: 1,
    transcriptLogging: true,
  },
  customIdHandlers: [
    {
      pattern: /^ticket_create_/,
      async handler(interaction) {
        if (!interaction.isButton() || !interaction.guild) return;
        await interaction.deferReply({ ephemeral: true });

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
      pattern: /^ticket_close_/,
      async handler(interaction) {
        if (!interaction.isButton() || !interaction.guild) return;
        await interaction.deferReply({ ephemeral: true });

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
