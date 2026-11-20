/**
 * Best-effort mirroring of MongoDB writes into AegisDB.
 *
 * MongoDB stays the source of truth: callers mirror only after their Mongo
 * write succeeded, and a mirror failure never reaches the caller. Failures are
 * logged and retried from a small in-memory queue with exponential backoff.
 *
 * Jobs sharing a key (one guild) run strictly in order, one at a time: a job
 * whose key has an earlier job queued *or still running* waits behind it, so a
 * revoke never overtakes the create it depends on and an older config snapshot
 * never lands after a newer one. Jobs marked `supersedes` (full snapshots such
 * as a guild config) replace older queued jobs for the same key instead of
 * piling up behind them.
 */
import { logger } from "../utils/logger";

export interface MirrorJob {
  /** Ordering key: jobs with the same key run first-in, first-out, never concurrently. */
  key: string;
  /** Short description for logs, e.g. "createCase 1234/65f…". */
  label: string;
  run: () => Promise<unknown>;
  /**
   * The job writes a complete snapshot for its key, so it makes every older
   * queued (not yet running) job for the same key redundant.
   */
  supersedes?: boolean;
}

interface Pending extends MirrorJob {
  attempts: number;
  nextAt: number;
  queuedAt: number;
}

export const MIRROR_MAX_ATTEMPTS = 5;
export const MIRROR_MAX_QUEUE = 500;
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 60_000;

const queue: Pending[] = [];
/** Keys with a job running right now (first attempt or a retry). */
const running = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let drainPromise: Promise<void> | null = null;

/** Counters and the last outcome, for /developer stats and health checks. */
const counters = { succeeded: 0, failedAttempts: 0, dropped: 0, superseded: 0 };
let lastFailure: { label: string; error: string; at: number } | null = null;
let lastSuccessAt: number | null = null;

function backoff(attempts: number): number {
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempts - 1));
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** At most one line per level per minute, so a down backend can't flood the logs. */
const LOG_EVERY_MS = 60_000;
const lastLog = { warn: 0, error: 0 };
const suppressed = { warn: 0, error: 0 };
function log(level: "warn" | "error", message: string): void {
  const now = Date.now();
  if (now - lastLog[level] < LOG_EVERY_MS) {
    suppressed[level]++;
    return;
  }
  const extra = suppressed[level] ? ` (${suppressed[level]} similar message(s) suppressed)` : "";
  lastLog[level] = now;
  suppressed[level] = 0;
  logger[level](message + extra);
}

function noteSuccess(): void {
  counters.succeeded++;
  lastSuccessAt = Date.now();
}

function noteFailure(job: MirrorJob, err: unknown): void {
  counters.failedAttempts++;
  lastFailure = { label: job.label, error: errorText(err).slice(0, 300), at: Date.now() };
}

function enqueue(job: Pending): void {
  if (job.supersedes) {
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].key === job.key && queue[i].supersedes) {
        queue.splice(i, 1);
        counters.superseded++;
      }
    }
  }
  if (queue.length >= MIRROR_MAX_QUEUE) {
    const evicted = queue.shift();
    counters.dropped++;
    if (evicted) log("error", `AegisDB mirror queue full; dropped ${evicted.label}. Mongo still has it.`);
  }
  queue.push(job);
  schedule();
}

/** Queue a failed first attempt ahead of any later job for the same key. */
function insertRetry(job: Pending): void {
  const firstSameKey = queue.findIndex((q) => q.key === job.key);
  if (firstSameKey < 0) {
    enqueue(job);
    return;
  }
  queue.splice(firstSameKey, 0, job);
  if (queue.length > MIRROR_MAX_QUEUE) {
    const evicted = queue.shift();
    counters.dropped++;
    if (evicted) log("error", `AegisDB mirror queue full; dropped ${evicted.label}. Mongo still has it.`);
  }
}

function schedule(): void {
  if (timer) return;
  // A key with a write in flight is picked up again when that write finishes
  // (its finally calls schedule), so it never needs a timer of its own.
  const ready = queue.filter((j) => !running.has(j.key));
  if (ready.length === 0) return;
  const wait = Math.max(0, Math.min(...ready.map((j) => j.nextAt)) - Date.now());
  timer = setTimeout(() => {
    timer = null;
    void drainMirrorQueue();
  }, wait);
  timer.unref?.();
}

/**
 * Runs a mirror write now, or queues it behind earlier writes for the same
 * key. Resolves when the first attempt finished (or was queued); never rejects.
 */
export async function mirrorToAegis(job: MirrorJob): Promise<void> {
  const now = Date.now();
  if (running.has(job.key) || queue.some((q) => q.key === job.key)) {
    enqueue({ ...job, attempts: 0, nextAt: now, queuedAt: now });
    return;
  }
  running.add(job.key);
  try {
    await job.run();
    noteSuccess();
  } catch (err) {
    noteFailure(job, err);
    log("warn", `AegisDB mirror failed (${job.label}): ${errorText(err)}; will retry.`);
    // Jobs for this key that arrived meanwhile are already queued; the retry
    // goes ahead of them so the key keeps its order, unless a newer snapshot
    // is already waiting and makes this one redundant.
    if (job.supersedes && queue.some((q) => q.key === job.key && q.supersedes)) {
      counters.superseded++;
    } else {
      insertRetry({ ...job, attempts: 1, nextAt: Date.now() + backoff(1), queuedAt: now });
    }
  } finally {
    running.delete(job.key);
    schedule();
  }
}

export interface DrainOptions {
  /** Retry every queued job now, ignoring its backoff (shutdown, tests). */
  force?: boolean;
  /** Stop starting new attempts after this many ms (shutdown has a hard deadline). */
  budgetMs?: number;
}

/**
 * Retries every due job once, in order. Exposed for shutdown and tests. A
 * call made while a drain is running waits for it and then drains again, so
 * a forced drain at shutdown is never silently skipped.
 */
export async function drainMirrorQueue(opts: DrainOptions = {}): Promise<void> {
  while (drainPromise) await drainPromise.catch(() => undefined);
  drainPromise = drainOnce(opts);
  try {
    await drainPromise;
  } finally {
    drainPromise = null;
    schedule();
  }
}

async function drainOnce(opts: DrainOptions): Promise<void> {
  const stopAt = opts.budgetMs === undefined ? Infinity : Date.now() + opts.budgetMs;
  const blocked = new Set<string>();
  for (const job of [...queue]) {
    if (Date.now() >= stopAt) break;
    // Superseded or evicted while an earlier job was running.
    if (!queue.includes(job)) continue;
    if (blocked.has(job.key) || running.has(job.key)) {
      blocked.add(job.key);
      continue;
    }
    if (!opts.force && job.nextAt > Date.now()) {
      blocked.add(job.key);
      continue;
    }
    running.add(job.key);
    try {
      await job.run();
      noteSuccess();
      const at = queue.indexOf(job);
      if (at >= 0) queue.splice(at, 1);
    } catch (err) {
      noteFailure(job, err);
      job.attempts++;
      if (job.attempts >= MIRROR_MAX_ATTEMPTS) {
        const at = queue.indexOf(job);
        if (at >= 0) queue.splice(at, 1);
        counters.dropped++;
        log("error", `AegisDB mirror gave up after ${job.attempts} attempts (${job.label}): ${errorText(err)}. Mongo still has it.`);
      } else {
        job.nextAt = Date.now() + backoff(job.attempts);
        blocked.add(job.key);
      }
    } finally {
      running.delete(job.key);
    }
  }
}

export interface MirrorQueueStats {
  /** Jobs waiting for a (re)try. */
  pending: number;
  /** Keys with a write in progress right now. */
  inFlight: number;
  /** Jobs given up on (max attempts or queue overflow). Mongo still has them. */
  dropped: number;
  /** Older snapshots replaced by a newer one before they were sent. */
  superseded: number;
  succeeded: number;
  failedAttempts: number;
  /** Age of the oldest waiting job, ms (0 when empty). */
  oldestPendingMs: number;
  lastFailure: { label: string; error: string; at: number } | null;
  lastSuccessAt: number | null;
}

export function mirrorQueueStats(now = Date.now()): MirrorQueueStats {
  const oldest = queue.reduce((min, j) => Math.min(min, j.queuedAt), Infinity);
  return {
    pending: queue.length,
    inFlight: running.size,
    dropped: counters.dropped,
    superseded: counters.superseded,
    succeeded: counters.succeeded,
    failedAttempts: counters.failedAttempts,
    oldestPendingMs: Number.isFinite(oldest) ? Math.max(0, now - oldest) : 0,
    lastFailure: lastFailure ? { ...lastFailure } : null,
    lastSuccessAt,
  };
}

/**
 * One-line summary for owner tools: "ok", or "3 pending, 1 dropped · last
 * failure 2m ago: createCase …". Pure apart from reading the stats.
 */
export function describeMirrorHealth(stats: MirrorQueueStats = mirrorQueueStats(), now = Date.now()): string {
  const parts: string[] = [];
  if (stats.pending) parts.push(`${stats.pending} pending (oldest ${Math.round(stats.oldestPendingMs / 1000)}s)`);
  if (stats.inFlight) parts.push(`${stats.inFlight} in flight`);
  if (stats.dropped) parts.push(`${stats.dropped} dropped`);
  const head = parts.length ? parts.join(", ") : "ok";
  if (!stats.lastFailure) return head;
  const ago = Math.max(0, Math.round((now - stats.lastFailure.at) / 1000));
  return `${head} · last failure ${ago}s ago: ${stats.lastFailure.label}: ${stats.lastFailure.error}`.slice(0, 1000);
}

/** Test helper: forget every queued job and reset the counters. */
export function resetMirrorQueue(): void {
  queue.length = 0;
  running.clear();
  counters.succeeded = counters.failedAttempts = counters.dropped = counters.superseded = 0;
  lastFailure = null;
  lastSuccessAt = null;
  lastLog.warn = lastLog.error = 0;
  suppressed.warn = suppressed.error = 0;
  if (timer) clearTimeout(timer);
  timer = null;
}
