import { decodeScheduledPayload } from "./scheduledPayload";
import { buildEmbedFromSpec } from "./embedSpec";
import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { getAllPendingTasks, deleteTask, updateTaskNextRun, ScheduledTask, planRestore, deleteStaleTasks } from "./scheduler";
import {
  afterTaskFailure,
  decodeTimedUnban,
  isUnknownBanError,
  shouldLiftTimedBan,
  decodeChannelUnlock,
  decodePersonalReminder,
  nextTimerDelay,
  reminderSnoozeCustomId,
  SNOOZE_OPTIONS_MINUTES,
} from "./timedActions";
import { sendGuildLog } from "./logging";
import { isSendableChannel, isObfuscatedChannel } from "../utils/channels";
import { logger } from "../utils/logger";
import { auditReason } from "../utils/safeText";
import { formatDurationLong } from "../utils/duration";
import { addModerationCase } from "./moderationCases";
import { deliverPersonalReminder, performChannelUnlock, performTimedUnban } from "./scheduledActions";
import { runDigestTask } from "./digestService";

const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** After this many failed attempts, give up and delete the task from the DB. */
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 60_000;

/** Track how many times each task has failed so we can cap retries. */
const retryCount = new Map<string, number>();

async function executeTask(client: Client, task: ScheduledTask): Promise<void> {
  const taskId = task.id!;
  let shouldRetry = false;

  try {
    if (task.type === "staff_digest") {
      // Never throws and always chains next week's task, so the retry path is not used.
      await runDigestTask(client, task);
      return;
    }

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

    if (task.type === "timed_unban") {
      await performTimedUnban(client, task);
      retryCount.delete(taskId);
      return;
    }

    if (task.type === "poll_close") {
      // Lazy import: polls.ts imports this module to arm its timers.
      const { closePollFromTask } = await import("./polls");
      await closePollFromTask(client, task);
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

    if (isObfuscatedChannel(channel)) {
      // Keep the task: the send fails and the normal retry path runs, in case View Channel is given back.
      throw new Error(`Channel ${task.channelId} is hidden from Aegis (no View Channel).`);
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

    // A scheduled message built with the dashboard's embed builder carries its own embed.
    const custom = task.type === "scheduled" ? decodeScheduledPayload(task.payload) : null;
    if (custom?.embed) {
      await channel.send({ content: custom.text || undefined, embeds: [buildEmbedFromSpec(custom.embed)], allowedMentions: { parse: ["users"] } });
      retryCount.delete(taskId);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(task.type === "reminder" ? 0x5865F2 : 0x57F287)
      .setTitle(task.type === "reminder" ? "⏰ Reminder" : "📅 Scheduled Message")
      .setDescription(custom ? custom.text || "(empty message)" : task.payload)
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

      const next = afterTaskFailure(attempts, MAX_RETRY_ATTEMPTS, Boolean(task.intervalMs));
      if (next === "skip-to-next") {
        // A recurring task keeps its schedule: skip this run, try again next time.
        retryCount.delete(taskId);
        const nextTime = new Date(Date.now() + task.intervalMs!);
        const updated = await updateTaskNextRun(task.guildId, taskId, nextTime);
        logger.warn(`Task ${taskId}: failed ${attempts} time(s); skipping this run, next at ${nextTime.toISOString()}.`);
        if (updated) scheduleTask(client, updated);
      } else if (next === "delete") {
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

    const plan = planRestore(task, now.getTime());
    if (plan.kind === "fire") {
      // Fire overdue tasks immediately in the background; don't block init
      void executeTask(client, task);
      expired++;
    } else if (plan.kind === "reschedule") {
      const updated = await updateTaskNextRun(task.guildId, task.id, plan.at).catch(() => null);
      if (updated) { scheduleTask(client, updated); scheduled++; } else failed++;
    } else if (plan.kind === "schedule") {
      scheduleTask(client, task);
      scheduled++;
    }
  }

  const pruned = await deleteStaleTasks(now.getTime()).catch(() => 0);
  if (pruned) logger.info(`Scheduler: removed ${pruned} stale one-off task(s) older than a day.`);
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
