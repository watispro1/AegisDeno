import { Client, TextChannel, EmbedBuilder } from "discord.js";
import { getAllPendingTasks, deleteTask, ScheduledTask } from "./scheduler";
import { logger } from "../utils/logger";

const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

async function executeTask(client: Client, task: ScheduledTask): Promise<void> {
  try {
    const channel = await client.channels.fetch(task.channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      logger.warn(`Task ${task.id!}: channel ${task.channelId} not found or not a text channel.`);
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
  } catch (err) {
    logger.warn(`Failed to deliver task ${task.id!}: ${err}`);
  } finally {
    deleteTask(task.guildId, task.id!);
    activeTimers.delete(task.id!);
    logger.debug(`Task ${task.id!} executed and removed.`);
  }
}

export function scheduleTask(client: Client, task: ScheduledTask): void {
  const delay = Math.max(0, new Date(task.executeAt).getTime() - Date.now());
  const handle = setTimeout(() => executeTask(client, task), delay);
  activeTimers.set(task.id!, handle);
  logger.debug(`Task ${task.id!} (${task.type}) scheduled in ${Math.round(delay / 1000)}s.`);
}

export function cancelTask(id: string): boolean {
  const handle = activeTimers.get(id);
  if (handle === undefined) return false;
  clearTimeout(handle);
  activeTimers.delete(id);
  return true;
}

export async function initScheduler(client: Client): Promise<void> {
  const tasks = await getAllPendingTasks();
  let scheduled = 0;
  let expired = 0;

  for (const task of tasks) {
    const executeAt = new Date(task.executeAt);
    if (executeAt <= new Date()) {
      await executeTask(client, task);
      expired++;
    } else {
      scheduleTask(client, task);
      scheduled++;
    }
  }

  logger.info(`Scheduler initialised: ${scheduled} pending, ${expired} overdue tasks processed.`);
}

export function shutdownScheduler(): void {
  for (const [id, handle] of activeTimers) {
    clearTimeout(handle);
    activeTimers.delete(id);
  }
  logger.info("Scheduler shut down cleanly.");
}
