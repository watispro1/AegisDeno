import {
  AttachmentBuilder,
  ChannelType,
  Client,
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
import { defaultGuildConfig, getGuildConfig, updateGuildConfig, type TicketSettings } from "./configuration";
import { createTask, deleteTask, getTasksForChannel, type ScheduledTask } from "./scheduler";
import {
  autoCloseDecision,
  decodeTicketTask,
  encodeTicketTask,
  renderTranscriptHtml,
  type TranscriptMessage,
} from "./ticketTranscript";
import { isObfuscatedChannel } from "../utils/channels";

export type { TicketSettings } from "./configuration";

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
        m.components.some((row: any) => row.components?.some((c: any) => c.customId?.startsWith("ticket_create_"))),
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

/** Most messages fetched into a transcript (Discord pages are 100 each). */
const TRANSCRIPT_MESSAGE_LIMIT = 1000;

/** Ticket settings live in the guild config (`tickets`). */
export async function getTicketSettings(guildId: string): Promise<TicketSettings> {
  return (await getGuildConfig(guildId).catch(() => defaultGuildConfig(guildId))).tickets;
}

export async function updateTicketSettings(guildId: string, patch: Partial<TicketSettings>): Promise<TicketSettings> {
  return (await updateGuildConfig(guildId, { tickets: patch })).tickets;
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

async function scheduleAutoCloseCheck(client: Client, guildId: string, channelId: string, ticketId: string, at: Date): Promise<void> {
  const task = await createTask(guildId, channelId, client.user?.id ?? "system", "ticket_autoclose", encodeTicketTask({ ticketId }), at);
  const { scheduleTask } = await import("./schedulerRunner");
  scheduleTask(client, task);
}

/**
 * Make sure every open ticket in a guild has an inactivity check queued, e.g. after
 * auto-close is turned on or for tickets opened before it existed. Returns how many were queued.
 */
export async function ensureAutoCloseChecks(guild: Guild): Promise<number> {
  const settings = await getTicketSettings(guild.id);
  if (settings.autoCloseHours <= 0) return 0;
  const open = await TicketModel.find({ guildId: guild.id, status: "open" }).lean();
  let queued = 0;
  for (const t of open) {
    const pending = await getTasksForChannel(guild.id, t.channelId, "ticket_autoclose").catch(() => []);
    if (pending.length) continue;
    const last = new Date(t.lastActivityAt ?? t.createdAt ?? Date.now()).getTime();
    const decision = autoCloseDecision(last, settings.autoCloseHours, Date.now());
    const at = decision.action === "recheck" ? new Date(decision.at) : new Date();
    await scheduleAutoCloseCheck(guild.client, guild.id, t.channelId, t.id, at)
      .then(() => queued++)
      .catch(err => logger.warn(`Ticket ${t.id}: failed to queue auto-close check`, err));
  }
  return queued;
}

/** Drop pending inactivity checks for a ticket channel (after it closes). */
async function clearAutoCloseChecks(guildId: string, channelId: string): Promise<void> {
  const tasks = await getTasksForChannel(guildId, channelId, "ticket_autoclose").catch(() => []);
  if (!tasks.length) return;
  const { cancelTask } = await import("./schedulerRunner");
  for (const t of tasks) {
    cancelTask(t.id!);
    await deleteTask(guildId, t.id!).catch(() => null);
  }
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

    const ticketId = `ticket-${crypto.randomUUID()}`;
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
        return existing && existingChannel ? { channel: existingChannel, ticketId: existing.id } : null;
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

    await channel.send({ content: `<@${userId}> ${staffRoleId ? `<@&${staffRoleId}>` : ""}`, embeds: [embed], components: [row] });

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

    let channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
    if (!channel) {
      channel = (await guild.channels.fetch(channelId).catch(() => null)) as TextChannel | null ?? undefined;
    }

    // Leave a ticket Aegis cannot see open: it could not post the notice,
    // build the transcript or delete the channel, and members may still use it.
    if (channel && isObfuscatedChannel(channel)) {
      logger.warn(`Ticket ${ticket.id}: not closing, channel ${channelId} is hidden from Aegis.`);
      return false;
    }

    // Claim the close atomically: the Close button, /ticket close and the
    // auto-close check can race, and only one of them may post the notice,
    // send the transcript and delete the channel.
    const claimed = await TicketModel.updateOne(
      { _id: ticket._id, status: "open" },
      { $set: { status: "closed", closedBy: closedByUserId, closedAt: new Date(), reason } },
    );
    if (claimed.modifiedCount === 0) return false;

    await clearAutoCloseChecks(guild.id, channelId);

    if (channel) {
      await deliverCloseTranscript(guild, channel, {
        ticketId: ticket.id,
        openerId: ticket.userId,
        closedById: closedByUserId,
        reason,
      }).catch(err => logger.warn(`Ticket ${ticket.id}: transcript delivery failed`, err));

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

/** Fetch up to `limit` messages from a channel, oldest first. */
async function fetchChannelHistory(channel: TextChannel, limit = TRANSCRIPT_MESSAGE_LIMIT): Promise<Message[]> {
  const out: Message[] = [];
  let before: string | undefined;
  while (out.length < limit) {
    const batch = await channel.messages.fetch({ limit: Math.min(100, limit - out.length), before }).catch(() => null);
    if (!batch || batch.size === 0) break;
    out.push(...batch.values());
    before = batch.last()?.id;
    if (batch.size < 100) break;
  }
  return out.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

/** Build an HTML transcript attachment for a ticket channel. */
export async function buildTicketTranscript(
  channel: TextChannel,
  meta: { ticketId: string; openerId: string; closedById?: string | null; reason?: string | null },
): Promise<{ file: AttachmentBuilder; messageCount: number }> {
  const history = await fetchChannelHistory(channel);
  const messages: TranscriptMessage[] = history.map(m => ({
    authorTag: m.author.tag ?? m.author.username,
    authorId: m.author.id,
    bot: m.author.bot,
    timestamp: m.createdTimestamp,
    content: m.content ?? "",
    attachments: [...m.attachments.values()].map(a => ({ name: a.name ?? "attachment", url: a.url })),
    embedCount: m.embeds.length,
  }));
  const html = renderTranscriptHtml(
    {
      guildName: channel.guild.name,
      channelName: channel.name,
      ticketId: meta.ticketId,
      openerId: meta.openerId,
      closedById: meta.closedById ?? null,
      reason: meta.reason ?? null,
      generatedAt: Date.now(),
    },
    messages,
  );
  const file = new AttachmentBuilder(Buffer.from(html, "utf-8"), { name: `transcript-${channel.name}.html` });
  return { file, messageCount: messages.length };
}

/** Post the transcript to the ticket log channel (if set) and DM the opener (failures ignored). */
async function deliverCloseTranscript(
  guild: Guild,
  channel: TextChannel,
  meta: { ticketId: string; openerId: string; closedById: string; reason: string },
): Promise<void> {
  const settings = await getTicketSettings(guild.id);
  const { file, messageCount } = await buildTicketTranscript(channel, meta);
  const summary = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle("📄 Ticket Transcript")
    .addFields(
      { name: "Ticket", value: `\`${meta.ticketId}\``, inline: false },
      { name: "Opened by", value: `<@${meta.openerId}>`, inline: true },
      { name: "Closed by", value: `<@${meta.closedById}>`, inline: true },
      { name: "Messages", value: String(messageCount), inline: true },
      { name: "Reason", value: meta.reason.slice(0, 1024), inline: false },
    )
    .setTimestamp();

  if (settings.transcriptLogging && settings.logChannelId) {
    const logChannel = await guild.channels.fetch(settings.logChannelId).catch(() => null);
    if (logChannel && !isObfuscatedChannel(logChannel) && logChannel.isTextBased() && "send" in logChannel) {
      await logChannel.send({ embeds: [summary], files: [file] }).catch(err =>
        logger.warn(`Ticket ${meta.ticketId}: could not post transcript to log channel`, err),
      );
    }
  }

  const opener = await guild.client.users.fetch(meta.openerId).catch(() => null);
  if (opener) {
    await opener
      .send({
        content: `Your ticket in **${guild.name}** was closed. Here is a copy of the conversation.`,
        embeds: [summary],
        files: [file],
      })
      .catch(() => null);
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

/** Scheduler handler for `ticket_autoclose`: close quiet tickets, otherwise re-arm the check. */
export async function runTicketAutoClose(client: Client, task: ScheduledTask): Promise<void> {
  const payload = decodeTicketTask(task.payload);
  if (!payload) return;

  const ticket = await TicketModel.findOne({ id: payload.ticketId, guildId: task.guildId, status: "open" }).lean();
  if (!ticket) return;

  const guild = client.guilds.cache.get(task.guildId) ?? await client.guilds.fetch(task.guildId).catch(() => null);
  if (!guild) return;

  const settings = await getTicketSettings(task.guildId);
  const lastActivity = new Date(ticket.lastActivityAt ?? ticket.createdAt ?? Date.now()).getTime();
  // A ticket channel hidden from Aegis gets no activity writes, so its stored
  // time is stale. Check visibility before touching ticket state.
  const channel = guild.channels.cache.get(ticket.channelId)
    ?? await guild.channels.fetch(ticket.channelId).catch(() => null);
  const now = Date.now();
  const decision = autoCloseDecision(lastActivity, settings.autoCloseHours, now, {
    channelHidden: isObfuscatedChannel(channel),
  });

  if (decision.action === "disabled") return;
  if (decision.action === "defer") {
    await TicketModel.updateOne(
      { id: ticket.id, guildId: task.guildId, status: "open" },
      { $set: { lastActivityAt: new Date(now) } },
    ).catch(err => logger.warn(`Ticket ${ticket.id}: could not refresh activity while hidden`, err));
    logger.info(`Ticket ${ticket.id}: channel hidden from Aegis, auto-close deferred.`);
    await scheduleAutoCloseCheck(client, task.guildId, ticket.channelId, ticket.id, new Date(decision.at));
    return;
  }
  if (decision.action === "recheck") {
    await scheduleAutoCloseCheck(client, task.guildId, ticket.channelId, ticket.id, new Date(decision.at));
    return;
  }

  const closerId = client.user?.id ?? "system";
  await closeTicket(guild, ticket.channelId, closerId, `Closed automatically after ${settings.autoCloseHours}h without activity`);
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
