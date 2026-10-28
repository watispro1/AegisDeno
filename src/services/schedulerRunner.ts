import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { getAllPendingTasks, deleteTask, updateTaskNextRun, ScheduledTask } from "./scheduler";
import {
  decodeChannelUnlock,
  decodePersonalReminder,
  nextTimerDelay,
  reminderSnoozeCustomId,
  SNOOZE_OPTIONS_MINUTES,
} from "./timedActions";
import { sendGuildLog } from "./logging";
import { isSendableChannel } from "../utils/channels";
import { logger } from "../utils/logger";

const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** After this many failed attempts, give up and delete the task from the DB. */
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 60_000;

/** Track how many times each task has failed so we can cap retries. */
const retryCount = new Map<string, number>();

/**
 * Deliver a `/remindme` reminder: DM the user, and optionally ping them in the
 * channel the reminder was set from. Delivery failures are swallowed (as before
 * persistence was added) so a user with closed DMs is not retried and spammed.
 */
async function deliverPersonalReminder(client: Client, task: ScheduledTask): Promise<void> {
  const payload = decodePersonalReminder(task.payload);
  if (!payload) {
    logger.warn(`Task ${task.id}: unreadable personal reminder payload — removing task.`);
    return;
  }

  try {
    const dmEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("⏰ Reminder!")
      .setDescription(`You asked me to remind you about:\n\n**${payload.text}**`)
      .addFields(
        { name: "📝 Reminder", value: payload.text.slice(0, 1024) },
        { name: "⏳ Set",  value: `<t:${Math.floor(payload.setAt / 1000)}:R>` },
        { name: "📌 From", value: payload.sourceName },
      )
      .setFooter({
        text: payload.repeat
          ? `Repeats ${payload.repeat} · ID ${task.id} · stop with /remindme cancel`
          : "Set with /remindme",
      })
      .setTimestamp();

    const snoozeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...SNOOZE_OPTIONS_MINUTES.map(min =>
        new ButtonBuilder()
          .setCustomId(reminderSnoozeCustomId(task.creatorId, min))
          .setLabel(min >= 60 ? `Snooze ${min / 60}h` : `Snooze ${min}m`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("💤"),
      ),
    );

    const user = await client.users.fetch(task.creatorId).catch(() => null);
    if (user) {
      await user.send({ embeds: [dmEmbed], components: [snoozeRow] }).catch(() => null);
    }

    if (payload.inChannel) {
      const channel = await client.channels.fetch(task.channelId).catch(() => null);
      if (isSendableChannel(channel)) {
        await channel.send({
          content: `<@${task.creatorId}> ⏰ **Reminder:** ${payload.text}`,
        }).catch(() => null);
      }
    }
  } catch (err) {
    logger.warn(`Reminder delivery failed for user ${task.creatorId}`, err);
  }
}

/**
 * Lift a timed `/lock channel` lock. Throws if the permission edit fails so the
 * normal retry path runs; a missing channel just drops the task.
 */
async function performChannelUnlock(client: Client, task: ScheduledTask): Promise<void> {
  const { moderatorTag, durationMinutes } = decodeChannelUnlock(task.payload);
  const channel = await client.channels.fetch(task.channelId).catch(() => null);

  if (!channel || channel.isDMBased() || channel.isThread() || !("permissionOverwrites" in channel)) {
    logger.warn(`Task ${task.id}: unlock target ${task.channelId} is gone or not lockable — removing task.`);
    return;
  }
  if (channel.guild.id !== task.guildId) {
    logger.error(`Task ${task.id}: unlock target ${task.channelId} is not in guild ${task.guildId} — removing task.`);
    return;
  }

  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: null });

  await sendGuildLog(client, task.guildId, {
    title: "🔓 Auto-Unlock",
    color: 0x57F287,
    description: `**Channel:** <#${channel.id}> was automatically unlocked after ${durationMinutes} minute(s).\n**Original Moderator:** ${moderatorTag}`,
  }).catch(err => logger.warn(`Task ${task.id}: auto-unlock log failed`, err));

  if (isSendableChannel(channel)) {
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle("🔓 Channel Unlocked")
          .setDescription(`This channel has been automatically unlocked after a ${durationMinutes}-minute lockdown.`)
          .setTimestamp(),
      ],
    }).catch(() => null);
  }
}

async function executeTask(client: Client, task: ScheduledTask): Promise<void> {
  const taskId = task.id!;
  let shouldRetry = false;

  try {
    if (task.type === "personal_reminder") {
      await deliverPersonalReminder(client, task);
      retryCount.delete(taskId);
      return;
    }

    if (task.type === "channel_unlock") {
      await performChannelUnlock(client, task);
      retryCount.delete(taskId);
      return;
    }

    if (task.type === "ticket_autoclose") {
      const { runTicketAutoClose } = await import("./ticketService");
      await runTicketAutoClose(client, task);
      retryCount.delete(taskId);
      return;
    }

    if (task.type === "verify_kick") {
      const { runVerifyKick } = await import("./verificationService");
      await runVerifyKick(client, task);
      retryCount.delete(taskId);
      return;
    }

    const channel = await client.channels.fetch(task.channelId).catch(() => null);

    if (!channel) {
      // Channel deleted or inaccessible — no point retrying, just clean up
      logger.warn(`Task ${taskId}: channel ${task.channelId} not accessible — removing task.`);
      await deleteTask(task.guildId, taskId).catch(err =>
        logger.error(`Task ${taskId}: failed to delete undeliverable task`, err)
      );
      return;
    }

    if (!(channel instanceof TextChannel)) {
      logger.warn(`Task ${taskId}: channel ${task.channelId} is not a text channel — removing task.`);
      await deleteTask(task.guildId, taskId).catch(err =>
        logger.error(`Task ${taskId}: failed to delete invalid-channel task`, err)
      );
      return;
    }

    if (channel.guild.id !== task.guildId) {
      logger.error(
        `Task ${taskId}: channel ${task.channelId} belongs to guild ${channel.guild.id}, not ${task.guildId} — removing task.`,
      );
      await deleteTask(task.guildId, taskId).catch(err =>
        logger.error(`Task ${taskId}: failed to delete cross-guild task`, err)
      );
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(task.type === "reminder" ? 0x5865F2 : 0x57F287)
      .setTitle(task.type === "reminder" ? "⏰ Reminder" : "📅 Scheduled Message")
      .setDescription(task.payload)
      .setTimestamp();

    if (task.type === "reminder") {
      const creator = client.users.cache.get(task.creatorId) ?? await client.users.fetch(task.creatorId).catch(() => null);
      embed.setFooter({ text: creator ? `Reminder for ${creator.tag ?? creator.username}` : `Reminder ID: ${taskId}` });
    }

    await channel.send({
      content: task.type === "reminder" ? `<@${task.creatorId}>` : undefined,
      embeds: [embed],
    });

    // Successful — clear retry tracking
    retryCount.delete(taskId);
  } catch (err) {
    shouldRetry = true;
    logger.warn(`Task ${taskId}: failed to deliver — ${err}`);
  } finally {
    activeTimers.delete(taskId);

    if (shouldRetry) {
      const attempts = (retryCount.get(taskId) ?? 0) + 1;
      retryCount.set(taskId, attempts);

      if (attempts >= MAX_RETRY_ATTEMPTS) {
        // Exhausted retries — log and delete to prevent zombie tasks
        logger.error(
          `Task ${taskId} failed after ${attempts} attempt(s) — giving up and removing from DB.`
        );
        retryCount.delete(taskId);
        await deleteTask(task.guildId, taskId).catch(err2 =>
          logger.error(`Task ${taskId}: also failed to delete after max retries`, err2)
        );
      } else {
        const handle = setTimeout(() => void executeTask(client, task), RETRY_DELAY_MS);
        activeTimers.set(taskId, handle);
        logger.info(
          `Task ${taskId} will retry in ${RETRY_DELAY_MS / 1000}s (attempt ${attempts}/${MAX_RETRY_ATTEMPTS}).`
        );
      }
    } else {
      if (task.intervalMs) {
        // Reschedule recurring task
        const nextTime = new Date(Date.now() + task.intervalMs);
        const updated = await updateTaskNextRun(task.guildId, taskId, nextTime);
        if (updated) {
          scheduleTask(client, updated);
          logger.debug(`Task ${taskId} delivered and rescheduled for ${nextTime.toISOString()}.`);
        } else {
          logger.error(`Task ${taskId}: delivered but failed to update next run time in DB`);
        }
      } else {
        // Delete one-off task
        await deleteTask(task.guildId, taskId).catch(err =>
          logger.error(`Task ${taskId}: delivered but failed to remove from DB`, err)
        );
        logger.debug(`Task ${taskId} delivered and removed.`);
      }
    }
  }
}

export function scheduleTask(client: Client, task: ScheduledTask): void {
  const taskId = task.id!;
  const { waitMs, final } = nextTimerDelay(new Date(task.executeAt).getTime(), Date.now());

  // Don't double-schedule a task that's already in the timer map
  if (activeTimers.has(taskId)) {
    logger.warn(`Task ${taskId}: already scheduled, skipping duplicate.`);
    return;
  }

  // Node clamps timers beyond ~24.8 days to 1 ms. Re-check long-lived tasks
  // in chunks so monthly reminders and recurring jobs cannot fire immediately.
  const handle = setTimeout(
    () => {
      if (!final) {
        activeTimers.delete(taskId);
        scheduleTask(client, task);
      } else {
        void executeTask(client, task);
      }
    },
    waitMs,
  );
  activeTimers.set(taskId, handle);
  logger.debug(`Task ${taskId} (${task.type}) scheduled in ${Math.round(waitMs / 1000)}s${final ? "" : " (chunked)"}.`);
}

export function cancelTask(id: string): boolean {
  const handle = activeTimers.get(id);
  if (handle === undefined) return false;
  clearTimeout(handle);
  activeTimers.delete(id);
  retryCount.delete(id);
  return true;
}

/** Returns a snapshot of currently active timer IDs for monitoring. */
export function getActiveTaskIds(): string[] {
  return [...activeTimers.keys()];
}

export async function initScheduler(client: Client): Promise<void> {
  let scheduled = 0;
  let expired = 0;
  let failed = 0;

  let tasks: ScheduledTask[];
  try {
    tasks = await getAllPendingTasks();
  } catch (err) {
    logger.error("Scheduler: failed to load pending tasks from DB — scheduler will not start.", err);
    return;
  }

  const now = new Date();

  for (const task of tasks) {
    const executeAt = new Date(task.executeAt);

    // Sanity-check: skip tasks with malformed data
    if (!task.id || !task.channelId || !task.guildId || isNaN(executeAt.getTime())) {
      logger.warn(`Scheduler: skipping malformed task ${task.id ?? "(no id)"}`);
      failed++;
      continue;
    }

    if (executeAt <= now) {
      // Fire overdue tasks immediately in the background; don't block init
      void executeTask(client, task);
      expired++;
    } else {
      scheduleTask(client, task);
      scheduled++;
    }
  }

  logger.info(
    `Scheduler initialised: ${scheduled} pending, ${expired} overdue (fired), ${failed} skipped (malformed).`
  );
}

export function shutdownScheduler(): void {
  const count = activeTimers.size;
  for (const [, handle] of activeTimers) {
    clearTimeout(handle);
  }
  activeTimers.clear();
  retryCount.clear();
  logger.info(`Scheduler shut down cleanly (cancelled ${count} timer(s)).`);
}
