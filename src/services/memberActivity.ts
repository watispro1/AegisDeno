/**
 * Lightweight per-member message activity: a running message count and the
 * last time the member spoke, per guild. No message content is stored.
 *
 * Writes are debounced: each message only bumps an in-memory counter, and the
 * buffer is flushed to Mongo in one bulkWrite every FLUSH_INTERVAL_MS. The
 * buffered counts are lost if the process dies between flushes (at most one
 * interval's worth), which is fine for a trust signal.
 */
import { UserActivityModel } from "../database/mongo";
import { logger } from "../utils/logger";

export const FLUSH_INTERVAL_MS = 30_000;
/** Bound on how many members' "last active day" we remember in memory. */
const MAX_DAY_CACHE = 50_000;

/** UTC calendar day, e.g. "2026-10-28". */
export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isFirstMessageOfDay(previousDay: string | null | undefined, nowMs: number): boolean {
  return previousDay !== utcDay(nowMs);
}

export interface PendingActivity {
  guildId: string;
  userId: string;
  count: number;
  lastAt: number;
}

/** Pure in-memory accumulator; the Mongo flushing lives outside it. */
export class ActivityBuffer {
  private pending = new Map<string, PendingActivity>();

  static key(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
  }

  record(guildId: string, userId: string, nowMs: number): void {
    const key = ActivityBuffer.key(guildId, userId);
    const entry = this.pending.get(key);
    if (entry) {
      entry.count++;
      entry.lastAt = Math.max(entry.lastAt, nowMs);
    } else {
      this.pending.set(key, { guildId, userId, count: 1, lastAt: nowMs });
    }
  }

  peek(guildId: string, userId: string): PendingActivity | undefined {
    return this.pending.get(ActivityBuffer.key(guildId, userId));
  }

  get size(): number {
    return this.pending.size;
  }

  /** Take everything buffered so far and reset. */
  drain(): PendingActivity[] {
    const out = [...this.pending.values()];
    this.pending.clear();
    return out;
  }

  /** Put entries back (after a failed flush), merging with anything recorded since. */
  restore(entries: readonly PendingActivity[]): void {
    for (const e of entries) {
      const key = ActivityBuffer.key(e.guildId, e.userId);
      const cur = this.pending.get(key);
      if (cur) {
        cur.count += e.count;
        cur.lastAt = Math.max(cur.lastAt, e.lastAt);
      } else {
        this.pending.set(key, { ...e });
      }
    }
  }
}

/** Days kept in the active-day counter (recentDays). */
export const ACTIVE_DAY_WINDOW = 30;

/**
 * The upsert for one flushed entry, as an update pipeline: bumps the count,
 * keeps the latest timestamp, and adds today to recentDays while dropping days
 * older than the window, so the array never grows past ~31 entries.
 */
export function activityUpdate(e: PendingActivity): Record<string, unknown>[] {
  const day = utcDay(e.lastAt);
  const cutoff = utcDay(e.lastAt - ACTIVE_DAY_WINDOW * 86_400_000);
  return [{
    $set: {
      messageCount: { $add: [{ $ifNull: ["$messageCount", 0] }, e.count] },
      lastMessageAt: { $max: [{ $ifNull: ["$lastMessageAt", new Date(0)] }, new Date(e.lastAt)] },
      lastMessageDate: day,
      recentDays: {
        $filter: {
          input: { $setUnion: [{ $ifNull: ["$recentDays", []] }, [day]] },
          as: "d",
          cond: { $gte: ["$$d", cutoff] },
        },
      },
    },
  }];
}

const buffer = new ActivityBuffer();
const lastDay = new Map<string, string>();
const loadingDay = new Map<string, Promise<string | null>>();
let flushTimer: ReturnType<typeof setInterval> | null = null;

function rememberDay(key: string, day: string): void {
  lastDay.delete(key);
  lastDay.set(key, day);
  if (lastDay.size > MAX_DAY_CACHE) {
    const oldest = lastDay.keys().next().value;
    if (oldest !== undefined) lastDay.delete(oldest);
  }
}

async function loadStoredDay(guildId: string, userId: string, key: string): Promise<string | null> {
  const inflight = loadingDay.get(key);
  if (inflight) return inflight;
  const p = UserActivityModel.findOne({ guildId, userId })
    .select("lastMessageDate")
    .lean()
    .then((doc) => (doc && typeof doc.lastMessageDate === "string" ? doc.lastMessageDate : null))
    .catch(() => null)
    .finally(() => loadingDay.delete(key));
  loadingDay.set(key, p);
  return p;
}

export async function flushMemberActivity(): Promise<void> {
  const entries = buffer.drain();
  if (entries.length === 0) return;
  try {
    // The native driver takes update pipelines as-is (Mongoose would refuse the array).
    await UserActivityModel.collection.bulkWrite(
      entries.map((e) => ({
        updateOne: {
          filter: { guildId: e.guildId, userId: e.userId },
          update: activityUpdate(e),
          upsert: true,
        },
      })),
      { ordered: false },
    );
  } catch (err) {
    logger.warn(`Member activity flush failed for ${entries.length} member(s); will retry.`, err);
    buffer.restore(entries);
  }
}

function ensureFlushTimer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    flushMemberActivity().catch(() => null);
  }, FLUSH_INTERVAL_MS);
  flushTimer.unref?.();
}

/**
 * Count one message for a member. Resolves to true when it is their first
 * message of the (UTC) day in this guild. Reads Mongo at most once per member
 * per process lifetime (to learn the stored last day); never writes inline.
 */
export async function recordMemberMessage(guildId: string, userId: string, nowMs: number = Date.now()): Promise<boolean> {
  ensureFlushTimer();
  const key = ActivityBuffer.key(guildId, userId);
  buffer.record(guildId, userId, nowMs);

  let previous = lastDay.get(key);
  if (previous === undefined) {
    previous = (await loadStoredDay(guildId, userId, key)) ?? "";
    // Another message may have landed while we waited.
    const raced = lastDay.get(key);
    if (raced !== undefined) previous = raced;
  }
  const first = isFirstMessageOfDay(previous, nowMs);
  rememberDay(key, utcDay(nowMs));
  return first;
}

export interface ActivitySnapshot {
  messageCount: number;
  lastActiveAt: Date | null;
}

/** Stored activity plus anything still waiting in the buffer. */
export async function getMemberActivity(guildId: string, userId: string): Promise<ActivitySnapshot> {
  const doc = await UserActivityModel.findOne({ guildId, userId })
    .select("messageCount lastMessageAt")
    .lean()
    .catch(() => null);
  const pending = buffer.peek(guildId, userId);
  const storedCount = doc && typeof doc.messageCount === "number" ? doc.messageCount : 0;
  const storedLast = doc?.lastMessageAt ? new Date(doc.lastMessageAt).getTime() : 0;
  const last = Math.max(storedLast, pending?.lastAt ?? 0);
  return {
    messageCount: storedCount + (pending?.count ?? 0),
    lastActiveAt: last > 0 ? new Date(last) : null,
  };
}
