import { Client, TextChannel, EmbedBuilder } from "discord.js";
import { getAllPendingTasks, deleteTask, updateTaskNextRun, ScheduledTask } from "./scheduler";
import { logger } from "../utils/logger";

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

    const embed = new EmbedBuilder()
      .setColor(task.type === "reminder" ? 0x5865F2 : 0x57F287)
      .setTitle(task.type === "reminder" ? "⏰ Reminder" : "📅 Scheduled Message")
      .setDescription(task.payload)
      .setTimestamp();

    if (task.type === "reminder") {
      embed.setFooter({ text: `Reminder set by <@${task.creatorId}>` });
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
  const delay = Math.max(0, new Date(task.executeAt).getTime() - Date.now());

  // Don't double-schedule a task that's already in the timer map
  if (activeTimers.has(taskId)) {
    logger.warn(`Task ${taskId}: already scheduled, skipping duplicate.`);
    return;
  }

  const handle = setTimeout(() => void executeTask(client, task), delay);
  activeTimers.set(taskId, handle);
  logger.debug(`Task ${taskId} (${task.type}) scheduled in ${Math.round(delay / 1000)}s.`);
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
