import {
  ChannelType,
  Guild,
  Message,
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
import { autoCloseDecision } from "./ticketTranscript";
import { getTicketSettings } from "./ticketSettings";
import { scheduleAutoCloseCheck } from "./ticketClose";
import { isObfuscatedChannel } from "../utils/channels";
import {
  canCreateTicketChannels,
  ticketPermissionOverwrites,
  type TicketCreationFailure,
} from "./ticketPermissions";

export type { TicketSettings } from "./configuration";
// Split modules, re-exported so existing imports keep working.
export { getTicketSettings, updateTicketSettings } from "./ticketSettings";
export { buildTicketTranscript, closeTicket, ensureAutoCloseChecks, runTicketAutoClose } from "./ticketClose";

export const TICKET_PANEL_DEFAULT_TITLE = "🎫 Support Tickets";
export const TICKET_PANEL_DEFAULT_DESCRIPTION = "Need assistance? Click the button below to open a private support ticket with our team.";

/**
 * Post the "Create Ticket" panel in a channel, deleting earlier Aegis ticket
 * panels among its last 50 messages first. Shared by `/ticket setup` and the
 * web dashboard. Throws when Discord refuses the send (missing permissions).
 */
export async function postTicketPanel(
  channel: TextChannel,
  opts: { staffRoleId?: string | null; title?: string | null; description?: string | null } = {},
): Promise<Message> {
  const botId = channel.client.user?.id;
  const fetchedMsgs = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  if (fetchedMsgs) {
    const oldPanels = fetchedMsgs.filter(
      (m) =>
        m.author.id === botId &&
        m.components.some((row) => "components" in row && row.components.some((c) => "customId" in c && c.customId?.startsWith("ticket_create_"))),
    );
    for (const [, msg] of oldPanels) {
      await msg.delete().catch(() => null);
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(opts.title || TICKET_PANEL_DEFAULT_TITLE)
    .setColor(0x3498DB)
    .setDescription(opts.description || TICKET_PANEL_DEFAULT_DESCRIPTION)
    .setFooter({ text: "Aegis Ticket System" });

  const customId = opts.staffRoleId ? `ticket_create_${opts.staffRoleId}` : "ticket_create_general";
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(customId)
      .setLabel("Create Ticket")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🎫"),
  );

  return channel.send({ embeds: [embed], components: [row] });
}

/** The opener's channel button row: Claim (staff only) and Close. */
export function buildTicketControls(ticketId: string, claimedByTag?: string | null): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_claim_${ticketId}`)
      .setLabel(claimedByTag ? `Claimed by ${claimedByTag}`.slice(0, 80) : "Claim")
      .setStyle(claimedByTag ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setEmoji("🙋")
      .setDisabled(Boolean(claimedByTag)),
    new ButtonBuilder()
      .setCustomId(`ticket_close_${ticketId}`)
      .setLabel("Close Ticket")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔒"),
  );
}

export interface TicketConfig {
  guildId: string;
  channelId: string;
  staffRoleId: string | null;
  categoryName: string;
}

const pendingTicketCreations = new Set<string>();

/** Returns whether a member is ticket staff or a server channel manager. */
export async function canManageTicket(guild: Guild, channelId: string, userId: string): Promise<boolean> {
  const ticket = await TicketModel.findOne({ guildId: guild.id, channelId, status: "open" }).lean();
  if (!ticket) return false;

  const member = await guild.members.fetch(userId).catch(() => null);
  return Boolean(
    member?.permissions.has(PermissionFlagsBits.ManageChannels) ||
    (ticket.staffRoleId && member?.roles.cache.has(ticket.staffRoleId)),
  );
}

/** The ticket opener may close their own ticket; changing access remains staff-only. */
export async function canCloseTicket(guild: Guild, channelId: string, userId: string): Promise<boolean> {
  const ticket = await TicketModel.findOne({ guildId: guild.id, channelId, status: "open" }).lean();
  return Boolean(ticket?.userId === userId) || canManageTicket(guild, channelId, userId);
}

export type CreateTicketResult =
  | { ok: true; channel: TextChannel; ticketId: string; reused: boolean }
  | { ok: false; reason: TicketCreationFailure };

export async function createTicketChannel(
  guild: Guild,
  userId: string,
  category = "General Support",
  staffRoleId?: string | null
): Promise<CreateTicketResult> {
  const lockKey = `${guild.id}:${userId}`;
  if (pendingTicketCreations.has(lockKey)) {
    logger.warn(`Ticket creation already in progress for user ${userId} in guild ${guild.id}`);
    return { ok: false, reason: "pending" };
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
        return { ok: true, channel, ticketId: existingOpen.id, reused: true };
      } else {
        await TicketModel.updateOne({ _id: existingOpen._id }, { status: "closed", reason: "Channel deleted" });
      }
    }

    const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
    if (!canCreateTicketChannels(me)) {
      logger.warn(`Ticket creation refused in guild ${guild.id}: Aegis is missing Manage Channels`);
      return { ok: false, reason: "missing_permissions" };
    }

    const ticketId = `ticket-${crypto.randomUUID()}`;
    const member = await guild.members.fetch(userId).catch(() => null);
    const username = member?.user.username.toLowerCase().replace(/[^a-z0-9]/g, "") || "user";

    const permissionOverwrites = ticketPermissionOverwrites({
      guildId: guild.id,
      userId,
      botId: guild.members.me?.id || clientMeId(guild),
      staffRoleId: staffRoleId && guild.roles.cache.has(staffRoleId) ? staffRoleId : null,
      me,
    });

    const channel = await guild.channels.create({
      name: `ticket-${username}`,
      type: ChannelType.GuildText,
      topic: `Support ticket for <@${userId}> | Category: ${category}`,
      permissionOverwrites,
    });

    try {
      await TicketModel.create({
        id: ticketId,
        guildId: guild.id,
        channelId: channel.id,
        userId,
        staffRoleId: staffRoleId ?? null,
        category,
        status: "open",
      });
    } catch (error: unknown) {
      // A second instance can win the unique-index race after this process has
      // already created a channel. Remove the orphan and direct the user to
      // the winning ticket rather than leaving duplicate private channels.
      if ((error as { code?: unknown } | null)?.code === 11000) {
        await channel.delete("Duplicate ticket creation prevented").catch(() => null);
        const existing = await TicketModel.findOne({ guildId: guild.id, userId, status: "open" });
        const existingChannel = existing
          ? await guild.channels.fetch(existing.channelId).catch(() => null) as TextChannel | null
          : null;
        return existing && existingChannel
          ? { ok: true, channel: existingChannel, ticketId: existing.id, reused: true }
          : { ok: false, reason: "failed" };
      }
      throw error;
    }

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

    const settings = await getTicketSettings(guild.id);
    if (settings.autoCloseHours > 0) {
      embed.setFooter({ text: `Closes automatically after ${settings.autoCloseHours}h without messages.` });
    }

    const row = buildTicketControls(ticketId);

    try {
      await channel.send({
        content: `<@${userId}> ${staffRoleId ? `<@&${staffRoleId}>` : ""}`,
        embeds: [embed],
        components: [row],
        // Ping exactly the opener and the configured staff role, nothing else.
        allowedMentions: { users: [userId], roles: staffRoleId ? [staffRoleId] : [] },
      });
    } catch {
      await channel.send({
        content: `<@${userId}> ${staffRoleId ? `<@&${staffRoleId}>` : ""}\n\n**🎫 Support Ticket — ${category}**\nWelcome <@${userId}>! Thank you for creating a ticket.\nStaff will assist you shortly. Use the button below to close this ticket when finished.`,
        components: [row],
        allowedMentions: { users: [userId], roles: staffRoleId ? [staffRoleId] : [] },
      });
    }

    if (settings.autoCloseHours > 0) {
      const decision = autoCloseDecision(Date.now(), settings.autoCloseHours, Date.now());
      if (decision.action === "recheck") {
        await scheduleAutoCloseCheck(guild.client, guild.id, channel.id, ticketId, new Date(decision.at))
          .catch(err => logger.warn(`Ticket ${ticketId}: failed to schedule auto-close`, err));
      }
    }

    await sendGuildLog(guild.client, guild.id, {
      title: "🎫 Ticket Created",
      color: 0x3498DB,
      description: `Ticket **${channel.name}** (\`${ticketId}\`) opened by <@${userId}>.`,
    }, "modActions");

    return { ok: true, channel, ticketId, reused: false };
  } catch (err) {
    logger.error("Failed to create ticket channel:", err);
    const code = (err as { code?: unknown } | null)?.code;
    // 50001 is Missing Access, 50013 is Missing Permissions: both mean an admin
    // has to fix Aegis's role rather than the member retrying forever.
    return { ok: false, reason: code === 50001 || code === 50013 ? "missing_permissions" : "failed" };
  } finally {
    pendingTicketCreations.delete(lockKey);
  }
}

export type ClaimResult =
  | { status: "claimed"; ticketId: string }
  | { status: "already"; claimedBy: string }
  | { status: "not_ticket" }
  | { status: "forbidden" };

/** Staff-only, first-come claim. Stored on the ticket so it survives restarts. */
export async function claimTicket(guild: Guild, channelId: string, userId: string): Promise<ClaimResult> {
  const ticket = await TicketModel.findOne({ guildId: guild.id, channelId, status: "open" }).lean();
  if (!ticket) return { status: "not_ticket" };
  if (!(await canManageTicket(guild, channelId, userId))) return { status: "forbidden" };
  if (ticket.claimedBy) return { status: "already", claimedBy: ticket.claimedBy };

  const updated = await TicketModel.findOneAndUpdate(
    { _id: ticket._id, status: "open", claimedBy: null },
    { $set: { claimedBy: userId, lastActivityAt: new Date() } },
    { new: true },
  ).lean();
  if (!updated) {
    const fresh = await TicketModel.findById(ticket._id).lean();
    return fresh?.claimedBy ? { status: "already", claimedBy: fresh.claimedBy } : { status: "not_ticket" };
  }
  return { status: "claimed", ticketId: ticket.id };
}

export async function addUserToTicket(channel: TextChannel, userId: string): Promise<boolean> {
  // Never edit overwrites on a channel hidden from Aegis: they are a placeholder.
  if (isObfuscatedChannel(channel)) return false;
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
  if (isObfuscatedChannel(channel)) return false;
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
