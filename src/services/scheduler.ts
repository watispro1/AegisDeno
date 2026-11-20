import { TaskModel } from "../database/mongo";

/** Most non-critical tasks restored on boot (MUST_RUN_TYPES are not counted). */
export const MAX_RESTORED_TASKS = 10_000;
const OVERDUE_RESTORE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * - reminder / scheduled: `/automation` channel posts (payload is the message text)
 * - personal_reminder: `/remindme` DM reminders (payload is JSON, see timedActions.ts)
 * - channel_unlock: `/lock channel duration_minutes` auto-unlock (payload is JSON)
 * - ticket_autoclose: ticket inactivity check (payload is JSON, see ticketTranscript.ts)
 * - verify_kick: kick a member still unverified after the configured delay (payload is JSON)
 * - poll_close: timed `/poll` auto-close (payload is JSON `{ messageId }`)
 * - timed_unban: lift a `/ban duration:` ban (creatorId is the banned user, payload is JSON, see timedActions.ts)
 * - temprole_remove: take a `/temprole` role off (creatorId is the member, payload is JSON, see tempRoleLogic.ts)
 * - staff_digest: the weekly staff digest (one per guild, see digestService.ts; each run schedules the next)
 * - slowmode_revert: end a timed `/slowmode ... for:` (creatorId is the channel, payload is JSON, see slowmodeRevert.ts)
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
  | "temprole_remove"
  | "staff_digest"
  | "slowmode_revert";

export const ALL_TASK_TYPES: readonly TaskType[] = [
  "timed_unban", "temprole_remove", "slowmode_revert",
  "channel_unlock", "poll_close", "verify_kick", "ticket_autoclose", "staff_digest",
  "scheduled", "reminder", "personal_reminder",
];

/**
 * Undo a punishment or restriction. Always restored and run when overdue,
 * however old, and never subject to MAX_RESTORED_TASKS: a ban, temp role or
 * slowmode must never outlive its duration because the bot was down.
 */
export const MUST_RUN_TYPES: readonly TaskType[] = ["timed_unban", "temprole_remove", "slowmode_revert"];

/** Restored on boot however overdue: each re-checks current state before acting. */
export const ALWAYS_RESTORE_TYPES: readonly TaskType[] = [...MUST_RUN_TYPES, "channel_unlock", "ticket_autoclose", "verify_kick", "poll_close", "staff_digest"];

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
      { returnDocument: "after" }
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

/** Change one of a creator's own tasks (payload, time, repeat). Null when it is not theirs or is gone. */
export async function updateTaskForCreator(
  creatorId: string,
  type: TaskType,
  id: string,
  patch: { payload?: string; executeAt?: Date; intervalMs?: number | null },
): Promise<ScheduledTask | null> {
  try {
    const set: Record<string, unknown> = {};
    if (patch.payload !== undefined) set.payload = patch.payload;
    if (patch.executeAt !== undefined) set.executeAt = patch.executeAt;
    if (patch.intervalMs !== undefined) set.intervalMs = patch.intervalMs;
    const doc = await TaskModel.findOneAndUpdate({ _id: id, creatorId, type }, { $set: set }, { returnDocument: "after" }).lean();
    return doc ? toTask(doc) : null;
  } catch {
    return null;
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

/** One-off tasks (reminders, one-off scheduled posts) overdue by more than a day: skipped on boot. */
function staleFilter(nowMs: number) {
  const cutoff = new Date(nowMs - OVERDUE_RESTORE_WINDOW_MS);
  return { executeAt: { $lt: cutoff }, type: { $nin: [...ALWAYS_RESTORE_TYPES] }, $or: [{ intervalMs: null }, { intervalMs: { $lte: 0 } }] };
}

export type CountByType = Partial<Record<TaskType, number>>;

/** "reminder=3, personal_reminder=1" (types with a zero count left out), or "none". */
export function formatCounts(counts: CountByType): string {
  const parts = Object.entries(counts).filter(([, n]) => (n ?? 0) > 0).map(([t, n]) => `${t}=${n}`);
  return parts.length ? parts.join(", ") : "none";
}

/**
 * Delete one-off tasks too old to ever run (only reminder-like types: every
 * type that undoes an action is restored instead) and report how many of each
 * type were skipped, so the startup log says what was dropped.
 */
export async function deleteStaleTasks(nowMs = Date.now()): Promise<{ total: number; byType: CountByType }> {
  const filter = staleFilter(nowMs);
  const groups = await TaskModel.aggregate<{ _id: TaskType; n: number }>([{ $match: filter }, { $group: { _id: "$type", n: { $sum: 1 } } }]);
  const byType: CountByType = {};
  for (const g of groups) byType[g._id] = g.n;
  const r = await TaskModel.deleteMany(filter);
  return { total: r.deletedCount ?? 0, byType };
}

export interface PendingTaskSource {
  /** Restorable tasks of one type, oldest first; `limit` null means all of them. */
  find(type: TaskType, limit: number | null): Promise<ScheduledTask[]>;
  /** How many restorable tasks of one type exist. */
  count(type: TaskType): Promise<number>;
}

export interface PendingTasks {
  tasks: ScheduledTask[];
  loaded: CountByType;
  /** Restorable tasks left unloaded because MAX_RESTORED_TASKS was reached (they stay in the database). */
  capped: CountByType;
  capHit: boolean;
}

/** Which saved tasks of one type boot restores. */
function restorableFilter(type: TaskType, nowMs: number) {
  if (ALWAYS_RESTORE_TYPES.includes(type)) return { type };
  const cutoff = new Date(nowMs - OVERDUE_RESTORE_WINDOW_MS);
  // Recurring tasks are restored too: before 3.7.0 a repeating message whose run
  // was missed by more than a day was never loaded again and silently stopped.
  return { type, $or: [{ executeAt: { $gte: cutoff } }, { intervalMs: { $gt: 0 } }] };
}

function mongoSource(nowMs: number): PendingTaskSource {
  return {
    async find(type, limit) {
      let q = TaskModel.find(restorableFilter(type, nowMs))
        .select("guildId channelId creatorId type payload executeAt intervalMs createdAt")
        .sort({ executeAt: 1 });
      if (limit !== null) q = q.limit(limit);
      const docs = await q.lean();
      return docs.map(doc => toTask(doc));
    },
    count: type => TaskModel.countDocuments(restorableFilter(type, nowMs)),
  };
}

/**
 * Load the tasks boot restores, one type at a time so a flood of one type
 * (say 10,000 reminders) can never crowd out another. MUST_RUN_TYPES load in
 * full and do not count against MAX_RESTORED_TASKS; the remaining types share
 * it in ALL_TASK_TYPES order (state-checking types, then recurring posts, then
 * reminders). When the cap is reached, how many of each type were left
 * unloaded is returned for the startup log instead of being dropped silently.
 */
export async function loadPendingTasks(nowMs = Date.now(), source: PendingTaskSource = mongoSource(nowMs), maxTasks = MAX_RESTORED_TASKS): Promise<PendingTasks> {
  const tasks: ScheduledTask[] = [];
  const loaded: CountByType = {};
  const capped: CountByType = {};
  let budget = maxTasks;
  for (const type of ALL_TASK_TYPES) {
    const mustRun = MUST_RUN_TYPES.includes(type);
    const limit = mustRun ? null : budget;
    const found = limit === 0 ? [] : await source.find(type, limit);
    tasks.push(...found);
    if (found.length) loaded[type] = found.length;
    if (!mustRun) {
      budget -= found.length;
      if (limit !== null && found.length >= limit) {
        const left = (await source.count(type)) - found.length;
        if (left > 0) capped[type] = left;
      }
    }
  }
  return { tasks, loaded, capped, capHit: Object.keys(capped).length > 0 };
}
