import { TaskModel } from "../database/mongo";

const MAX_RESTORED_TASKS = 10_000;
const OVERDUE_RESTORE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * - reminder / scheduled: `/automation` channel posts (payload is the message text)
 * - personal_reminder: `/remindme` DM reminders (payload is JSON, see timedActions.ts)
 * - channel_unlock: `/lock channel duration_minutes` auto-unlock (payload is JSON)
 * - poll_close: timed `/poll` auto-close (payload is JSON `{ messageId }`)
 */
export type TaskType = "reminder" | "scheduled" | "personal_reminder" | "channel_unlock" | "poll_close";

/** Task types managed through `/automation list|cancel`. */
export const AUTOMATION_TASK_TYPES: readonly TaskType[] = ["reminder", "scheduled"];

export interface ScheduledTask {
  _id: string;
  id?: string;
  guildId: string;
  channelId: string;
  creatorId: string;
  type: TaskType;
  payload: string;
  executeAt: Date;
  intervalMs?: number | null;
  createdAt: Date;
}

function toTask(doc: unknown): ScheduledTask {
  const obj = doc as Record<string, unknown>;
  const id = String(obj._id);
  return {
    _id: id,
    id,
    guildId: String(obj.guildId),
    channelId: String(obj.channelId),
    creatorId: String(obj.creatorId),
    type: obj.type as TaskType,
    payload: String(obj.payload),
    executeAt: new Date(obj.executeAt as string | number | Date),
    intervalMs: typeof obj.intervalMs === "number" ? obj.intervalMs : null,
    createdAt: new Date(obj.createdAt as string | number | Date),
  };
}

export async function createTask(
  guildId: string,
  channelId: string,
  creatorId: string,
  type: TaskType,
  payload: string,
  executeAt: Date,
  intervalMs?: number | null
): Promise<ScheduledTask> {
  const task = await TaskModel.create({
    guildId,
    channelId,
    creatorId,
    type,
    payload,
    executeAt,
    intervalMs,
  });

  return toTask(task.toObject());
}

export async function getTask(guildId: string, id: string): Promise<ScheduledTask | null> {
  try {
    const doc = await TaskModel.findOne({ _id: id, guildId });
    if (!doc) return null;
    return toTask(doc.toObject());
  } catch {
    return null;
  }
}

export async function updateTaskNextRun(guildId: string, id: string, nextExecuteAt: Date): Promise<ScheduledTask | null> {
  try {
    const doc = await TaskModel.findOneAndUpdate(
      { _id: id, guildId },
      { $set: { executeAt: nextExecuteAt } },
      { new: true }
    );
    if (!doc) return null;
    return toTask(doc.toObject());
  } catch {
    return null;
  }
}

export async function getTasksForGuild(
  guildId: string,
  creatorId?: string,
  types?: readonly TaskType[],
): Promise<ScheduledTask[]> {
  const filter: { guildId: string; creatorId?: string; type?: { $in: TaskType[] } } = { guildId };
  if (creatorId) filter.creatorId = creatorId;
  if (types) filter.type = { $in: [...types] };

  const docs = await TaskModel.find(filter).sort({ executeAt: 1 });
  return docs.map(doc => toTask(doc.toObject()));
}

/** All tasks of one type created by a user, across every guild and DM. */
export async function getTasksForCreator(creatorId: string, type: TaskType): Promise<ScheduledTask[]> {
  const docs = await TaskModel.find({ creatorId, type }).sort({ executeAt: 1 });
  return docs.map(doc => toTask(doc.toObject()));
}

/** Delete a task only if it belongs to the given creator and type. */
export async function deleteTaskForCreator(creatorId: string, type: TaskType, id: string): Promise<boolean> {
  try {
    const res = await TaskModel.deleteOne({ _id: id, creatorId, type });
    return res.deletedCount > 0;
  } catch {
    return false;
  }
}

/** Tasks of one type targeting a specific channel (e.g. pending auto-unlocks). */
export async function getTasksForChannel(guildId: string, channelId: string, type: TaskType): Promise<ScheduledTask[]> {
  const docs = await TaskModel.find({ guildId, channelId, type }).sort({ executeAt: 1 });
  return docs.map(doc => toTask(doc.toObject()));
}

export async function deleteTask(guildId: string, id: string): Promise<boolean> {
  try {
    const res = await TaskModel.deleteOne({ _id: id, guildId });
    return res.deletedCount > 0;
  } catch {
    return false;
  }
}

export async function getAllPendingTasks(): Promise<ScheduledTask[]> {
  const cutoff = new Date(Date.now() - OVERDUE_RESTORE_WINDOW_MS);
  // Auto-unlocks and poll closes are always restored, however overdue: a channel
  // must never stay locked (or a poll open) forever because the bot was down a day.
  const docs = await TaskModel.find({
    $or: [{ executeAt: { $gte: cutoff } }, { type: { $in: ["channel_unlock", "poll_close"] } }],
  })
    .select("guildId channelId creatorId type payload executeAt intervalMs createdAt")
    .sort({ executeAt: 1 })
    .limit(MAX_RESTORED_TASKS)
    .lean();
  return docs.map(doc => toTask(doc));
}
