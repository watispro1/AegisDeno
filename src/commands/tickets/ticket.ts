import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import type { Command } from "../../types/discord";
import { createTicketChannel, closeTicket, addUserToTicket, removeUserFromTicket } from "../../services/ticketService";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Support ticket system operations and panel setup.")
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName("setup")
        .setDescription("Create a support ticket panel in a channel.")
        .addChannelOption(opt => opt.setName("channel").setDescription("Target channel for the panel").addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addRoleOption(opt => opt.setName("staff_role").setDescription("Support staff role to notify").setRequired(false))
        .addStringOption(opt => opt.setName("title").setDescription("Embed title for ticket panel").setRequired(false))
        .addStringOption(opt => opt.setName("description").setDescription("Embed description").setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName("close")
        .setDescription("Close the current support ticket.")
        .addStringOption(opt => opt.setName("reason").setDescription("Reason for closing").setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("Add a member to this ticket.")
        .addUserOption(opt => opt.setName("user").setDescription("User to add").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription("Remove a member from this ticket.")
        .addUserOption(opt => opt.setName("user").setDescription("User to remove").setRequired(true))
    ),

  category: "tickets",
  guildOnly: true,

  async execute(interaction) {
    if (!interaction.guild) return;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "setup") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({ content: "❌ You need `Manage Channels` permission to set up ticket panels.", ephemeral: true });
        return;
      }

      const channel = interaction.options.getChannel("channel", true) as TextChannel;
      const staffRole = interaction.options.getRole("staff_role");
      const title = interaction.options.getString("title") || "🎫 Support Tickets";
      const description = interaction.options.getString("description") || "Need assistance? Click the button below to open a private support ticket with our team.";

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(0x3498DB)
        .setDescription(description)
        .setFooter({ text: "Aegis Ticket System" });

      const customId = staffRole ? `ticket_create_${staffRole.id}` : "ticket_create_general";
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(customId)
          .setLabel("Create Ticket")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🎫")
      );

      await channel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: `✅ Support ticket panel successfully created in ${channel}!`, ephemeral: true });
      return;
    }

    if (subcommand === "close") {
      const reason = interaction.options.getString("reason") || "Resolved";
      await interaction.deferReply({ ephemeral: true });

      const closed = await closeTicket(interaction.guild, interaction.channelId, interaction.user.id, reason);
      if (closed) {
        await interaction.editReply({ content: "🔒 Ticket closure initiated." });
      } else {
        await interaction.editReply({ content: "❌ This channel is not an active support ticket." });
      }
      return;
    }

    if (subcommand === "add") {
      const targetUser = interaction.options.getUser("user", true);
      const channel = interaction.channel as TextChannel;
      if (!channel.name.startsWith("ticket-")) {
        await interaction.reply({ content: "❌ This command can only be used inside a ticket channel.", ephemeral: true });
        return;
      }
      const ok = await addUserToTicket(channel, targetUser.id);
      await interaction.reply({
        content: ok ? `✅ Added <@${targetUser.id}> to the ticket.` : "❌ Failed to add user.",
        ephemeral: true,
      });
      return;
    }

    if (subcommand === "remove") {
      const targetUser = interaction.options.getUser("user", true);
      const channel = interaction.channel as TextChannel;
      if (!channel.name.startsWith("ticket-")) {
        await interaction.reply({ content: "❌ This command can only be used inside a ticket channel.", ephemeral: true });
        return;
      }
      const ok = await removeUserFromTicket(channel, targetUser.id);
      await interaction.reply({
        content: ok ? `✅ Removed <@${targetUser.id}> from the ticket.` : "❌ Failed to remove user.",
        ephemeral: true,
      });
      return;
    }
  },
};

export default command;
