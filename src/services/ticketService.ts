import {
  ChannelType,
  Client,
  Guild,
  PermissionFlagsBits,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { TicketModel } from "../database/mongo";
import { logger } from "../utils/logger";
import { sendGuildLog } from "./logging";

export interface TicketConfig {
  guildId: string;
  channelId: string;
  staffRoleId: string | null;
  categoryName: string;
}

const pendingTicketCreations = new Set<string>();

export async function createTicketChannel(
  guild: Guild,
  userId: string,
  category = "General Support",
  staffRoleId?: string | null
): Promise<{ channel: TextChannel; ticketId: string } | null> {
  const lockKey = `${guild.id}:${userId}`;
  if (pendingTicketCreations.has(lockKey)) {
    logger.warn(`Ticket creation already in progress for user ${userId} in guild ${guild.id}`);
    return null;
  }

  pendingTicketCreations.add(lockKey);

  try {
    const existingOpen = await TicketModel.findOne({ guildId: guild.id, userId, status: "open" });
    if (existingOpen) {
      let channel = guild.channels.cache.get(existingOpen.channelId) as TextChannel | undefined;
      if (!channel) {
        channel = (await guild.channels.fetch(existingOpen.channelId).catch(() => null)) as TextChannel | null ?? undefined;
      }
      if (channel) {
        return { channel, ticketId: existingOpen.id };
      } else {
        await TicketModel.updateOne({ _id: existingOpen._id }, { status: "closed", reason: "Channel deleted" });
      }
    }

    const ticketId = `ticket-${Math.random().toString(36).substring(2, 8)}`;
    const member = await guild.members.fetch(userId).catch(() => null);
    const username = member?.user.username.toLowerCase().replace(/[^a-z0-9]/g, "") || "user";

    const permissionOverwrites = [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: userId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      {
        id: guild.members.me?.id || clientMeId(guild),
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages,
        ],
      },
    ];

    if (staffRoleId && guild.roles.cache.has(staffRoleId)) {
      permissionOverwrites.push({
        id: staffRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      });
    }

    const channel = await guild.channels.create({
      name: `ticket-${username}`,
      type: ChannelType.GuildText,
      topic: `Support ticket for <@${userId}> | Category: ${category}`,
      permissionOverwrites,
    });

    await TicketModel.create({
      id: ticketId,
      guildId: guild.id,
      channelId: channel.id,
      userId,
      staffRoleId: staffRoleId ?? null,
      category,
      status: "open",
    });

    const embed = new EmbedBuilder()
      .setTitle(`🎫 Support Ticket — ${category}`)
      .setColor(0x3498DB)
      .setDescription(
        `Welcome <@${userId}>! Thank you for creating a ticket.\nStaff will assist you shortly. Use the button below to close this ticket when finished.`
      )
      .addFields(
        { name: "Ticket ID", value: `\`${ticketId}\``, inline: true },
        { name: "Created By", value: `<@${userId}>`, inline: true },
        { name: "Category", value: category, inline: true }
      )
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_close_${ticketId}`)
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🔒")
    );

    await channel.send({ content: `<@${userId}> ${staffRoleId ? `<@&${staffRoleId}>` : ""}`, embeds: [embed], components: [row] });

    await sendGuildLog(guild.client, guild.id, {
      title: "🎫 Ticket Created",
      color: 0x3498DB,
      description: `Ticket **${channel.name}** (\`${ticketId}\`) opened by <@${userId}>.`,
    });

    return { channel, ticketId };
  } catch (err) {
    logger.error("Failed to create ticket channel:", err);
    return null;
  } finally {
    pendingTicketCreations.delete(lockKey);
  }
}

export async function closeTicket(
  guild: Guild,
  channelId: string,
  closedByUserId: string,
  reason = "Resolved"
): Promise<boolean> {
  try {
    const ticket = await TicketModel.findOne({ guildId: guild.id, channelId, status: "open" });
    if (!ticket) return false;

    ticket.status = "closed";
    ticket.closedBy = closedByUserId;
    ticket.closedAt = new Date();
    ticket.reason = reason;
    await ticket.save();

    const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
    if (channel) {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔒 Ticket Closed")
            .setColor(0xE74C3C)
            .setDescription(`This ticket has been closed by <@${closedByUserId}>.\n**Reason:** ${reason}\n\n*Channel will be deleted in 5 seconds...*`)
            .setTimestamp(),
        ],
      }).catch(() => null);

      setTimeout(() => {
        channel.delete(`Ticket closed by ${closedByUserId}`).catch(err => logger.warn("Failed to delete closed ticket channel:", err));
      }, 5000);
    }

    await sendGuildLog(guild.client, guild.id, {
      title: "🔒 Ticket Closed",
      color: 0xE74C3C,
      description: `Ticket \`${ticket.id}\` closed by <@${closedByUserId}>.\n**Reason:** ${reason}`,
    });

    return true;
  } catch (err) {
    logger.error("Failed to close ticket:", err);
    return false;
  }
}

export async function addUserToTicket(channel: TextChannel, userId: string): Promise<boolean> {
  try {
    await channel.permissionOverwrites.edit(userId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });
    return true;
  } catch {
    return false;
  }
}

export async function removeUserFromTicket(channel: TextChannel, userId: string): Promise<boolean> {
  try {
    await channel.permissionOverwrites.delete(userId);
    return true;
  } catch {
    return false;
  }
}

function clientMeId(guild: Guild): string {
  return guild.client.user?.id || "";
}
