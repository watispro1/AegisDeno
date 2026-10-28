import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import type { Command } from "../../types/discord";
import {
  closeTicket,
  addUserToTicket,
  removeUserFromTicket,
  canCloseTicket,
  canManageTicket,
  claimTicket,
  buildTicketTranscript,
  getTicketSettings,
  updateTicketSettings,
  ensureAutoCloseChecks,
} from "../../services/ticketService";
import { MAX_TICKET_AUTOCLOSE_HOURS } from "../../services/ticketTranscript";

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
    )
    .addSubcommand(sub =>
      sub
        .setName("claim")
        .setDescription("Claim responsibility for managing this ticket.")
    )
    .addSubcommand(sub =>
      sub
        .setName("transcript")
        .setDescription("Generate and fetch an HTML transcript of this ticket.")
    )
    .addSubcommand(sub =>
      sub
        .setName("settings")
        .setDescription("View or change the transcript log channel and inactivity auto-close.")
        .addChannelOption(opt =>
          opt.setName("log_channel").setDescription("Channel that receives transcripts when tickets close").addChannelTypes(ChannelType.GuildText).setRequired(false)
        )
        .addIntegerOption(opt =>
          opt
            .setName("autoclose_hours")
            .setDescription("Close tickets after this many hours without messages (0 = off, default 48)")
            .setMinValue(0)
            .setMaxValue(MAX_TICKET_AUTOCLOSE_HOURS)
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt.setName("transcripts").setDescription("Post transcripts to the log channel on close (default on)").setRequired(false)
        )
        .addBooleanOption(opt =>
          opt.setName("clear_log_channel").setDescription("Stop posting transcripts to a log channel").setRequired(false)
        )
    ),

  category: "tickets",
  guildOnly: true,

  async execute(interaction) {
    if (!interaction.guild) return;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "setup") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({ content: "❌ You need `Manage Channels` permission to set up ticket panels.", flags: MessageFlags.Ephemeral });
        return;
      }

      const channel = interaction.options.getChannel("channel", true) as TextChannel;
      const staffRole = interaction.options.getRole("staff_role");
      const title = interaction.options.getString("title") || "🎫 Support Tickets";
      const description = interaction.options.getString("description") || "Need assistance? Click the button below to open a private support ticket with our team.";

      // Purge previous Aegis ticket panel messages in the channel to prevent duplicates
      const fetchedMsgs = await channel.messages.fetch({ limit: 50 }).catch(() => null);
      if (fetchedMsgs) {
        const oldPanels = fetchedMsgs.filter(
          (m) =>
            m.author.id === interaction.client.user?.id &&
            m.components.some((row: any) => row.components?.some((c: any) => c.customId?.startsWith("ticket_create_")))
        );
        for (const [, msg] of oldPanels) {
          await msg.delete().catch(() => null);
        }
      }

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
      await interaction.reply({ content: `✅ Support ticket panel successfully created in ${channel}! (Previous panels in channel purged)`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (subcommand === "close") {
      const reason = interaction.options.getString("reason") || "Resolved";
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (!await canCloseTicket(interaction.guild, interaction.channelId, interaction.user.id)) {
        await interaction.editReply("❌ Only the ticket opener or support staff can close this ticket.");
        return;
      }

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
      const channel = interaction.channel as TextChannel | null;
      if (!channel || !("name" in channel) || !await canManageTicket(interaction.guild, channel.id, interaction.user.id)) {
        await interaction.reply({ content: "❌ This command can only be used inside an active ticket channel.", flags: MessageFlags.Ephemeral });
        return;
      }
      const ok = await addUserToTicket(channel, targetUser.id);
      await interaction.reply({
        content: ok ? `✅ Added <@${targetUser.id}> to the ticket.` : "❌ Failed to add user.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === "remove") {
      const targetUser = interaction.options.getUser("user", true);
      const channel = interaction.channel as TextChannel | null;
      if (!channel || !("name" in channel) || !await canManageTicket(interaction.guild, channel.id, interaction.user.id)) {
        await interaction.reply({ content: "❌ This command can only be used inside an active ticket channel.", flags: MessageFlags.Ephemeral });
        return;
      }
      const ok = await removeUserFromTicket(channel, targetUser.id);
      await interaction.reply({
        content: ok ? `✅ Removed <@${targetUser.id}> from the ticket.` : "❌ Failed to remove user.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === "claim") {
      const result = await claimTicket(interaction.guild, interaction.channelId, interaction.user.id);
      if (result.status === "not_ticket") {
        await interaction.reply({ content: "❌ This command can only be used inside an active ticket channel.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (result.status === "forbidden") {
        await interaction.reply({ content: "❌ Only support staff can claim tickets.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (result.status === "already") {
        await interaction.reply({ content: `ℹ️ This ticket is already claimed by <@${result.claimedBy}>.`, flags: MessageFlags.Ephemeral });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle("🙋 Ticket Claimed")
        .setDescription(`This ticket is now being handled by <@${interaction.user.id}>.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
      return;
    }

    if (subcommand === "settings") {
      const logChannel = interaction.options.getChannel("log_channel");
      const autoCloseHours = interaction.options.getInteger("autoclose_hours");
      const transcripts = interaction.options.getBoolean("transcripts");
      const clearLog = interaction.options.getBoolean("clear_log_channel") ?? false;
      const changing = Boolean(logChannel) || autoCloseHours !== null || transcripts !== null || clearLog;

      if (changing && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({ content: "❌ You need `Manage Channels` permission to change ticket settings.", flags: MessageFlags.Ephemeral });
        return;
      }

      const patch: Parameters<typeof updateTicketSettings>[1] = {};
      if (logChannel) patch.logChannelId = logChannel.id;
      if (clearLog) patch.logChannelId = null;
      if (autoCloseHours !== null) patch.autoCloseHours = autoCloseHours;
      if (transcripts !== null) patch.transcriptLogging = transcripts;

      const settings = changing
        ? await updateTicketSettings(interaction.guild.id, patch)
        : await getTicketSettings(interaction.guild.id);
      if (changing && settings.autoCloseHours > 0) {
        // Queue checks for tickets opened before auto-close was on; runs after the reply.
        void ensureAutoCloseChecks(interaction.guild).catch(() => 0);
      }

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle(changing ? "✅ Ticket Settings Updated" : "🎫 Ticket Settings")
        .addFields(
          { name: "📄 Transcript log channel", value: settings.logChannelId ? `<#${settings.logChannelId}>` : "Not set", inline: true },
          { name: "📨 Post transcripts", value: settings.transcriptLogging ? "On" : "Off", inline: true },
          { name: "⏳ Auto-close", value: settings.autoCloseHours > 0 ? `After ${settings.autoCloseHours}h without messages` : "Off", inline: true },
        )
        .setFooter({ text: "The ticket opener always gets a transcript by DM when a ticket closes (if their DMs are open). Auto-close changes apply to the next check of each ticket." })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (subcommand === "transcript") {
      const channel = interaction.channel as TextChannel | null;
      if (!channel || !("name" in channel) || !await canManageTicket(interaction.guild, channel.id, interaction.user.id)) {
        await interaction.reply({ content: "❌ This command can only be used inside an active ticket channel.", flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const { TicketModel } = await import("../../database/mongo");
      const ticket = await TicketModel.findOne({ guildId: interaction.guild.id, channelId: channel.id, status: "open" }).lean();
      const { file, messageCount } = await buildTicketTranscript(channel, {
        ticketId: ticket?.id ?? channel.id,
        openerId: ticket?.userId ?? "unknown",
      });
      if (messageCount === 0) {
        await interaction.editReply("❌ No messages found in this ticket to export.");
        return;
      }

      await interaction.editReply({
        content: `📄 **Ticket Transcript Generated** (${messageCount} messages)`,
        files: [file],
      });
      return;
    }
  },
};

export default command;
