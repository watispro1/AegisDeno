/**
 * Gateway and REST diagnostics for the Discord client.
 *
 * Without an "error" listener, an error the client emits (a WebSocket failure,
 * a shard error) is thrown by Node's EventEmitter and lands in the process
 * uncaughtException handler. Rate limits were invisible: discord.js queues and
 * retries them quietly, so a command that hammered one route (a big purge, a
 * lock across 200 channels) just looked slow. These listeners log both, with
 * rate-limit lines throttled per route so a burst does not flood the logs.
 */
import { Events, RESTEvents, type Client } from "discord.js";
import { logger } from "../utils/logger";

/** One rate-limit log line per route bucket per window; the rest are counted. */
export class RateLimitLogThrottle {
  private readonly lastLogged = new Map<string, { at: number; suppressed: number }>();

  constructor(private readonly windowMs = 60_000, private readonly maxKeys = 500) {}

  /**
   * Returns null when this hit should stay quiet, or the number of hits on the
   * same key that were suppressed since the last logged one.
   */
  shouldLog(key: string, now = Date.now()): number | null {
    const prev = this.lastLogged.get(key);
    if (prev && now - prev.at < this.windowMs) {
      prev.suppressed++;
      return null;
    }
    const suppressed = prev?.suppressed ?? 0;
    this.lastLogged.delete(key);
    this.lastLogged.set(key, { at: now, suppressed: 0 });
    while (this.lastLogged.size > this.maxKeys) {
      const oldest = this.lastLogged.keys().next().value;
      if (oldest === undefined) break;
      this.lastLogged.delete(oldest);
    }
    return suppressed;
  }

  get size(): number {
    return this.lastLogged.size;
  }
}

export interface RateLimitInfo {
  global: boolean;
  method: string;
  route: string;
  retryAfter: number;
  limit: number;
  scope?: string;
}

/** The log line for a rate limit, e.g. "rate limited on PATCH /channels/:id (retry in 1.2s, limit 5)". */
export function describeRateLimit(info: RateLimitInfo, suppressed = 0): string {
  const where = info.global ? "the global limit" : `${info.method.toUpperCase()} ${info.route}`;
  const retry = info.retryAfter >= 1000 ? `${(info.retryAfter / 1000).toFixed(1)}s` : `${Math.max(0, Math.round(info.retryAfter))}ms`;
  const extra = suppressed > 0 ? `; ${suppressed} more on this route since the last notice` : "";
  return `Discord rate limit on ${where} (retry in ${retry}, limit ${info.limit}${info.scope ? `, scope ${info.scope}` : ""}${extra})`;
}

export function registerClientDiagnostics(client: Client): void {
  const throttle = new RateLimitLogThrottle();

  client.on(Events.Error, (err) => logger.error("Discord client error:", err));
  client.on(Events.Warn, (msg) => logger.warn(`Discord client warning: ${msg}`));
  client.on(Events.ShardError, (err, shardId) => logger.error(`Shard ${shardId} error:`, err));
  client.on(Events.ShardDisconnect, (event, shardId) =>
    logger.warn(`Shard ${shardId} disconnected (code ${event.code}); discord.js will reconnect if it can.`));
  client.on(Events.ShardReconnecting, (shardId) => logger.info(`Shard ${shardId} reconnecting`));
  client.on(Events.ShardResume, (shardId, replayed) => logger.info(`Shard ${shardId} resumed (${replayed} event(s) replayed)`));

  client.rest.on(RESTEvents.RateLimited, (info) => {
    const key = info.global ? "global" : `${info.method}:${info.hash}:${info.majorParameter}`;
    const suppressed = throttle.shouldLog(key);
    if (suppressed === null) return;
    logger.warn(describeRateLimit({
      global: info.global,
      method: info.method,
      route: info.route,
      retryAfter: info.retryAfter,
      limit: info.limit,
      scope: info.scope,
    }, suppressed));
  });
  // Discord bans IPs that send 10,000 invalid (401/403/429) requests in 10 minutes.
  client.rest.on(RESTEvents.InvalidRequestWarning, (data) =>
    logger.warn(`${data.count} invalid Discord API requests in the current 10-minute window (${Math.round(data.remainingTime / 1000)}s left). Check for a loop retrying a missing permission.`));
}
