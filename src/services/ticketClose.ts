/**
 * Closing tickets: the atomic close, the HTML transcript and its delivery,
 * and the inactivity auto-close checks. Split out of ticketService.ts, which
 * re-exports everything here.
 */
import { AttachmentBuilder, Client, EmbedBuilder, Guild, Message, TextChannel } from "discord.js";
import { TicketModel } from "../database/mongo";
import { logger } from "../utils/logger";
import { sendGuildLog } from "./logging";
import { createTask, deleteTask, getTasksForChannel, type ScheduledTask } from "./scheduler";
import { autoCloseDecision, decodeTicketTask, encodeTicketTask, renderTranscriptHtml, type TranscriptMessage } from "./ticketTranscript";
import { getTicketSettings } from "./ticketSettings";
import { isObfuscatedChannel } from "../utils/channels";
import { getGuildConfig } from "./configuration";
import { attachmentFlagReasons, guardModeFor } from "./mediaSafety";
import { guardTranscriptAttachment } from "./mediaSafetyRepost";

/** Most messages fetched into a transcript (Discord pages are 100 each). */
const TRANSCRIPT_MESSAGE_LIMIT = 1000;

/** Queue one inactivity check for a ticket channel. */
export async function scheduleAutoCloseCheck(client: Client, guildId: string, channelId: string, ticketId: string, at: Date): Promise<void> {
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
    }, "modActions");

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
  // The same file goes to the opener by DM, which is never age-restricted, so the guard always applies.
  const guard = guardModeFor((await getGuildConfig(channel.guild.id)).mediaSafety, false);
  const messages: TranscriptMessage[] = history.map(m => ({
    authorTag: m.author.tag ?? m.author.username,
    authorId: m.author.id,
    bot: m.author.bot,
    timestamp: m.createdTimestamp,
    content: m.content ?? "",
    attachments: [...m.attachments.values()].map(a =>
      guardTranscriptAttachment({ name: a.name ?? "attachment", url: a.url, reasons: attachmentFlagReasons(a) }, guard)),
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
