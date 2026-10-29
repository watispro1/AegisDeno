/**
 * Where dashboard rate-limit counters live. Production uses Mongo
 * (DashboardRateLimitModel) so every process and restart shares one count;
 * tests and the fallback path use the in-memory RateLimiter.
 *
 * Windows are fixed and aligned to the clock (floor(now / window)), so two
 * processes agree on which window a request belongs to without talking to
 * each other.
 */
import { createHash } from "node:crypto";
import { DashboardRateLimitModel } from "../../database/mongo";
import { logger } from "../../utils/logger";
import { RateLimiter } from "./security";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimitStore {
  /** Count one request for `key` in `bucket`; `limit` requests per `windowMs` are allowed. */
  hit(bucket: string, key: string, limit: number, windowMs: number, nowMs: number): Promise<RateLimitResult>;
}

/** Pure decision from a window's count, shared by the stores and unit-tested. */
export function decide(count: number, limit: number, windowStart: number, windowMs: number, nowMs: number): RateLimitResult {
  if (count <= limit) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((windowStart + windowMs - nowMs) / 1000)) };
}

export function windowStartFor(nowMs: number, windowMs: number): number {
  return Math.floor(nowMs / windowMs) * windowMs;
}

/** Client addresses are hashed before they reach the database. */
export function hashClientKey(key: string): string {
  return createHash("sha256").update(`aegis-dashboard-rl\n${key}`).digest("hex").slice(0, 32);
}

export function memoryRateLimitStore(): RateLimitStore {
  const limiters = new Map<string, RateLimiter>();
  return {
    async hit(bucket, key, limit, windowMs, nowMs) {
      const id = `${bucket}:${limit}:${windowMs}`;
      let limiter = limiters.get(id);
      if (!limiter) {
        limiter = new RateLimiter(limit, windowMs);
        limiters.set(id, limiter);
      }
      return limiter.hit(key, nowMs);
    },
  };
}

/**
 * Mongo-backed counters with a TTL index. If Mongo is unreachable the request
 * is counted in memory instead, so an outage degrades to the old per-process
 * limits rather than refusing every request or dropping the limit entirely.
 */
export function mongoRateLimitStore(): RateLimitStore {
  const fallback = memoryRateLimitStore();
  let lastWarn = 0;
  return {
    async hit(bucket, key, limit, windowMs, nowMs) {
      const start = windowStartFor(nowMs, windowMs);
      const _id = `${bucket}:${hashClientKey(key)}:${start}`;
      const bump = () => DashboardRateLimitModel.findOneAndUpdate(
        { _id },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(start + windowMs + 60_000) } },
        { upsert: true, returnDocument: "after", lean: true },
      );
      try {
        let doc;
        try {
          doc = await bump();
        } catch (err) {
          // Two first requests in the same window can race on the upsert; the loser retries once.
          if ((err as { code?: number })?.code !== 11000) throw err;
          doc = await bump();
        }
        return decide(Number(doc?.count ?? 1), limit, start, windowMs, nowMs);
      } catch (err) {
        if (nowMs - lastWarn > 60_000) {
          lastWarn = nowMs;
          logger.warn(`Dashboard rate limit store unavailable, counting in memory: ${(err as Error)?.message ?? err}`);
        }
        return fallback.hit(bucket, key, limit, windowMs, nowMs);
      }
    },
  };
}
