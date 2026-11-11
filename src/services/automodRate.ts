/**
 * In-memory rate state for automod: the message-rate (spam) counter and the
 * per-member penalty cooldown. Both are bounded and sweep themselves.
 */

/**
 * Counts events per key inside a sliding window.
 *
 * The old tracker scanned every key on every message once it held more than
 * 5,000 members, so in a busy server each message cost a full pass over the
 * map. This one sweeps at most once per `sweepEveryMs` and caps the map size
 * by dropping the least recently used keys.
 */
export class SlidingWindowCounter {
  private readonly hits = new Map<string, number[]>();
  private lastSweep = 0;

  constructor(
    private readonly maxKeys = 10_000,
    private readonly sweepEveryMs = 60_000,
    /** Longest window any caller uses; entries older than this are always stale. */
    private readonly maxWindowMs = 10 * 60_000,
  ) {}

  /** Record one event and return how many fall inside the last `windowMs` (this one included). */
  record(key: string, windowMs: number, now = Date.now()): number {
    this.sweep(now);
    const since = now - windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > since);
    list.push(now);
    // Re-insert so Map order stays least-recently-used first.
    this.hits.delete(key);
    this.hits.set(key, list);
    while (this.hits.size > this.maxKeys) {
      const oldest = this.hits.keys().next().value;
      if (oldest === undefined) break;
      this.hits.delete(oldest);
    }
    return list.length;
  }

  get size(): number {
    return this.hits.size;
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < this.sweepEveryMs) return;
    this.lastSweep = now;
    const cutoff = now - this.maxWindowMs;
    for (const [key, list] of this.hits) {
      if (!list.length || list[list.length - 1] <= cutoff) this.hits.delete(key);
    }
  }
}

/** How long after a warn or timeout automod only deletes, without punishing again. */
export const AUTOMOD_PENALTY_COOLDOWN_MS = 60_000;

export interface PenaltyDecision {
  /** Warn / time out the member (false: delete only). */
  punish: boolean;
  /** Post a log entry for this hit (false: counted and folded into the next entry). */
  log: boolean;
  /** Hits that were not logged since the last log entry for this member. */
  suppressed: number;
}

/**
 * Stops one burst from becoming many penalties.
 *
 * Once a member crossed the spam threshold, every further message in the
 * window tripped the rule again: ten quick messages gave ten warnings (and,
 * through escalation, could reach a ban in seconds), ten timeout cases and ten
 * log embeds. Now the first hit punishes and logs; hits within the cooldown are
 * still deleted, but they neither punish nor post, and the next log entry says
 * how many were folded in.
 */
export class PenaltyCooldown {
  private readonly state = new Map<string, { until: number; suppressed: number }>();

  constructor(private readonly cooldownMs = AUTOMOD_PENALTY_COOLDOWN_MS, private readonly maxKeys = 10_000) {}

  decide(key: string, now = Date.now()): PenaltyDecision {
    const prev = this.state.get(key);
    if (prev && now < prev.until) {
      prev.suppressed++;
      return { punish: false, log: false, suppressed: prev.suppressed };
    }
    const suppressed = prev?.suppressed ?? 0;
    this.state.delete(key);
    this.state.set(key, { until: now + this.cooldownMs, suppressed: 0 });
    while (this.state.size > this.maxKeys) {
      const oldest = this.state.keys().next().value;
      if (oldest === undefined) break;
      this.state.delete(oldest);
    }
    return { punish: true, log: true, suppressed };
  }

  get size(): number {
    return this.state.size;
  }
}
