/**
 * Best-effort mirroring of MongoDB writes into AegisDB.
 *
 * MongoDB stays the source of truth: callers mirror only after their Mongo
 * write succeeded, and a mirror failure never reaches the caller. Failures are
 * logged and retried from a small in-memory queue with exponential backoff.
 * Jobs sharing a key (one guild) run in order, so a revoke never overtakes the
 * create it depends on.
 */
import { logger } from "../utils/logger";

export interface MirrorJob {
  /** Ordering key: jobs with the same key run first-in, first-out. */
  key: string;
  /** Short description for logs, e.g. "createCase 1234/65f…". */
  label: string;
  run: () => Promise<unknown>;
}

interface Pending extends MirrorJob {
  attempts: number;
  nextAt: number;
}

export const MIRROR_MAX_ATTEMPTS = 5;
export const MIRROR_MAX_QUEUE = 500;
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 60_000;

const queue: Pending[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let draining = false;
let dropped = 0;

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

function enqueue(job: Pending): void {
  if (queue.length >= MIRROR_MAX_QUEUE) {
    const evicted = queue.shift();
    dropped++;
    if (evicted) log("error", `AegisDB mirror queue full; dropped ${evicted.label}. Mongo still has it.`);
  }
  queue.push(job);
  schedule();
}

function schedule(): void {
  if (timer || queue.length === 0) return;
  const wait = Math.max(0, Math.min(...queue.map((j) => j.nextAt)) - Date.now());
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
  if (queue.some((q) => q.key === job.key)) {
    enqueue({ ...job, attempts: 0, nextAt: Date.now() });
    return;
  }
  try {
    await job.run();
  } catch (err) {
    log("warn", `AegisDB mirror failed (${job.label}): ${errorText(err)}; will retry.`);
    enqueue({ ...job, attempts: 1, nextAt: Date.now() + backoff(1) });
  }
}

/** Retries every due job once, in order. Exposed for shutdown and tests. */
export async function drainMirrorQueue(opts: { force?: boolean } = {}): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    const blocked = new Set<string>();
    for (const job of [...queue]) {
      if (blocked.has(job.key)) continue;
      if (!opts.force && job.nextAt > Date.now()) {
        blocked.add(job.key);
        continue;
      }
      try {
        await job.run();
        queue.splice(queue.indexOf(job), 1);
      } catch (err) {
        job.attempts++;
        if (job.attempts >= MIRROR_MAX_ATTEMPTS) {
          queue.splice(queue.indexOf(job), 1);
          dropped++;
          log("error", `AegisDB mirror gave up after ${job.attempts} attempts (${job.label}): ${errorText(err)}. Mongo still has it.`);
        } else {
          job.nextAt = Date.now() + backoff(job.attempts);
          blocked.add(job.key);
        }
      }
    }
  } finally {
    draining = false;
    schedule();
  }
}

export function mirrorQueueStats(): { pending: number; dropped: number } {
  return { pending: queue.length, dropped };
}

/** Test helper: forget every queued job. */
export function resetMirrorQueue(): void {
  queue.length = 0;
  dropped = 0;
  lastLog.warn = lastLog.error = 0;
  suppressed.warn = suppressed.error = 0;
  if (timer) clearTimeout(timer);
  timer = null;
}
