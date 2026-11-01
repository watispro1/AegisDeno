import { TaskModel } from "../database/mongo";

const MAX_RESTORED_TASKS = 10_000;
const OVERDUE_RESTORE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * - reminder / scheduled: `/automation` channel posts (payload is the message text)
 * - personal_reminder: `/remindme` DM reminders (payload is JSON, see timedActions.ts)
 * - channel_unlock: `/lock channel duration_minutes` auto-unlock (payload is JSON)
 * - ticket_autoclose: ticket inactivity check (payload is JSON, see ticketTranscript.ts)
 * - verify_kick: kick a member still unverified after the configured delay (payload is JSON)
 * - poll_close: timed `/poll` auto-close (payload is JSON `{ messageId }`)
 * - timed_unban: lift a `/ban duration:` ban (creatorId is the banned user, payload is JSON, see timedActions.ts)
 * - staff_digest: the weekly staff digest (one per guild, see digestService.ts; each run schedules the next)
 */
export type TaskType =
  | "reminder"
  | "scheduled"
  | "personal_reminder"
  | "channel_unlock"
  | "ticket_autoclose"
  | "verify_kick"
  | "poll_close"
  | "timed_unban"
  | "staff_digest";

/** Restored on boot however overdue: each re-checks current state before acting. */
const ALWAYS_RESTORE_TYPES: readonly TaskType[] = ["channel_unlock", "ticket_autoclose", "verify_kick", "poll_close", "timed_unban", "staff_digest"];

/** Most tasks one listing returns (a guild's automation list, a user's reminders). */
export const MAX_LISTED_TASKS = 200;

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
    const doc = await TaskModel.findOne({ _id: id, guildId }).lean();
    if (!doc) return null;
    return toTask(doc);
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
    ).lean();
    if (!doc) return null;
    return toTask(doc);
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

  const docs = await TaskModel.find(filter).sort({ executeAt: 1 }).limit(MAX_LISTED_TASKS).lean();
  return docs.map(doc => toTask(doc));
}

/** All tasks of one type created by a user, across every guild and DM. */
export async function getTasksForCreator(creatorId: string, type: TaskType): Promise<ScheduledTask[]> {
  const docs = await TaskModel.find({ creatorId, type }).sort({ executeAt: 1 }).limit(MAX_LISTED_TASKS).lean();
  return docs.map(doc => toTask(doc));
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

/** Delete every task of one type for a creator in a guild (e.g. a member's pending verification kick). */
export async function deleteTasksForCreatorInGuild(guildId: string, creatorId: string, type: TaskType): Promise<string[]> {
  try {
    const docs = await TaskModel.find({ guildId, creatorId, type }).select("_id").lean();
    const ids = docs.map(d => String(d._id));
    if (ids.length) await TaskModel.deleteMany({ _id: { $in: ids } });
    return ids;
  } catch {
    return [];
  }
}

/** Tasks of one type targeting a specific channel (e.g. pending auto-unlocks). */
export async function getTasksForChannel(guildId: string, channelId: string, type: TaskType): Promise<ScheduledTask[]> {
  const docs = await TaskModel.find({ guildId, channelId, type }).sort({ executeAt: 1 }).limit(MAX_LISTED_TASKS).lean();
  return docs.map(doc => toTask(doc));
}

export async function deleteTask(guildId: string, id: string): Promise<boolean> {
  try {
    const res = await TaskModel.deleteOne({ _id: id, guildId });
    return res.deletedCount > 0;
  } catch {
    return false;
  }
}

export type RestorePlan = { kind: "schedule" } | { kind: "fire" } | { kind: "reschedule"; at: Date } | { kind: "drop" };

/**
 * What boot does with a saved task. Future → schedule. Overdue within a day, or
 * a type that re-checks state → fire now. A recurring task overdue by more than
 * a day skips the missed runs and resumes at its next slot (no burst of stale
 * posts). Anything else is stale and dropped from the database.
 */
export function planRestore(task: Pick<ScheduledTask, "type" | "executeAt" | "intervalMs">, nowMs: number): RestorePlan {
  const at = new Date(task.executeAt).getTime();
  if (at > nowMs) return { kind: "schedule" };
  if (ALWAYS_RESTORE_TYPES.includes(task.type)) return { kind: "fire" };
  const overdue = nowMs - at;
  if (task.intervalMs && task.intervalMs > 0 && overdue > OVERDUE_RESTORE_WINDOW_MS) {
    const skips = Math.floor(overdue / task.intervalMs) + 1;
    return { kind: "reschedule", at: new Date(at + skips * task.intervalMs) };
  }
  if (overdue <= OVERDUE_RESTORE_WINDOW_MS) return { kind: "fire" };
  return { kind: "drop" };
}

/** Delete one-off tasks too old to ever run (they used to stay in the database forever). */
export async function deleteStaleTasks(nowMs = Date.now()): Promise<number> {
  const cutoff = new Date(nowMs - OVERDUE_RESTORE_WINDOW_MS);
  const r = await TaskModel.deleteMany({ executeAt: { $lt: cutoff }, type: { $nin: [...ALWAYS_RESTORE_TYPES] }, $or: [{ intervalMs: null }, { intervalMs: { $lte: 0 } }] });
  return r.deletedCount ?? 0;
}

export async function getAllPendingTasks(): Promise<ScheduledTask[]> {
  const cutoff = new Date(Date.now() - OVERDUE_RESTORE_WINDOW_MS);
  // Auto-unlocks and poll closes are always restored, however overdue: a channel
  // must never stay locked (or a poll open) forever because the bot was down a day.
  // Ticket inactivity checks and verification kicks re-check state, so they are too.
  const docs = await TaskModel.find({
    // Recurring tasks are restored too: before 3.7.0 a repeating message whose run
    // was missed by more than a day was never loaded again and silently stopped.
    $or: [{ executeAt: { $gte: cutoff } }, { type: { $in: [...ALWAYS_RESTORE_TYPES] } }, { intervalMs: { $gt: 0 } }],
  })
    .select("guildId channelId creatorId type payload executeAt intervalMs createdAt")
    .sort({ executeAt: 1 })
    .limit(MAX_RESTORED_TASKS)
    .lean();
  return docs.map(doc => toTask(doc));
}
