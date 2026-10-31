/**
 * Temporary bans (`/ban duration:`): a persisted `timed_unban` task lifts the
 * ban when it runs out. The task's creatorId is the banned user, so every
 * pending unban for a member can be found and cancelled when the ban changes.
 */
import type { Client } from "discord.js";
import { createTask, deleteTasksForCreatorInGuild } from "./scheduler";
import { cancelTask, scheduleTask } from "./schedulerRunner";
import { encodeTimedUnban, type TimedUnbanPayload } from "./timedActions";

/**
 * Cancel any pending automatic unban for a member: a new ban replaces a
 * temporary one, and a manual unban or undo makes it moot. Without this an old
 * temporary ban's timer could lift a later permanent ban.
 */
export async function clearTimedUnbans(guildId: string, userId: string): Promise<number> {
  const ids = await deleteTasksForCreatorInGuild(guildId, userId, "timed_unban");
  for (const id of ids) cancelTask(id);
  return ids.length;
}

export async function scheduleTimedUnban(
  client: Client,
  input: { guildId: string; channelId: string; userId: string; executeAt: Date; payload: TimedUnbanPayload },
): Promise<void> {
  const task = await createTask(input.guildId, input.channelId, input.userId, "timed_unban", encodeTimedUnban(input.payload), input.executeAt);
  scheduleTask(client, task);
}
