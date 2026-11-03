import { chunk, isBulkDeletable } from "./purgeFilters";

/** Discord error code for a message that no longer exists. */
const UNKNOWN_MESSAGE = 10008;

export interface PurgeTarget {
  id: string;
  createdTimestamp: number;
}

export interface PurgeOps<T extends PurgeTarget> {
  /** Delete one message. Rejects with the Discord API error on failure. */
  deleteOne(message: T): Promise<unknown>;
  /** Bulk delete with filterOld=true. Resolves to the ids Discord removed. */
  bulkDelete(messages: T[]): Promise<Iterable<string>>;
  /** Called once per batch that throws, for logging. */
  onBatchError?(error: unknown, size: number): void;
}

export interface PurgeOutcome {
  requested: number;
  deleted: number;
  /** Already deleted by someone else between the preview and the confirm. */
  alreadyGone: number;
  /** Crossed the 14-day bulk-delete limit since the preview. */
  tooOld: number;
  /** The API call for these failed (permissions, rate limit, outage). */
  failed: number;
}

function errorCode(err: unknown): unknown {
  return err && typeof err === "object" && "code" in err ? (err as { code: unknown }).code : undefined;
}

/**
 * Delete the given messages in batches of 100. Each batch is attempted on its
 * own, so a failure part way through still reports what was removed before it.
 */
export async function runPurge<T extends PurgeTarget>(
  messages: readonly T[],
  ops: PurgeOps<T>,
  now: () => number = Date.now,
): Promise<PurgeOutcome> {
  const out: PurgeOutcome = { requested: messages.length, deleted: 0, alreadyGone: 0, tooOld: 0, failed: 0 };
  for (const batch of chunk(messages)) {
    if (batch.length === 1) {
      try {
        await ops.deleteOne(batch[0]);
        out.deleted++;
      } catch (err) {
        if (errorCode(err) === UNKNOWN_MESSAGE) out.alreadyGone++;
        else {
          out.failed++;
          ops.onBatchError?.(err, 1);
        }
      }
      continue;
    }
    const at = now();
    const tooOld = batch.filter((m) => !isBulkDeletable(m.createdTimestamp, at)).length;
    try {
      const removed = new Set(await ops.bulkDelete(batch));
      const deleted = batch.filter((m) => removed.has(m.id)).length;
      out.deleted += deleted;
      out.tooOld += tooOld;
      out.alreadyGone += Math.max(0, batch.length - deleted - tooOld);
    } catch (err) {
      out.failed += batch.length;
      ops.onBatchError?.(err, batch.length);
    }
  }
  return out;
}

/** One line explaining why some selected messages were not deleted, or "" when all were. */
export function describePurgeSkips(o: PurgeOutcome): string {
  return [
    o.alreadyGone > 0 ? `${o.alreadyGone} already gone` : null,
    o.tooOld > 0 ? `${o.tooOld} older than 14 days` : null,
    o.failed > 0 ? `${o.failed} failed` : null,
  ].filter(Boolean).join(", ");
}
