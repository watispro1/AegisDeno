/**
 * Heartbeat samples behind the public status page's uptime history.
 *
 * Every minute the process notes whether the Discord gateway and the database
 * are up. Samples live in memory (8 days at one per minute is about 11,500
 * small objects) and one every five minutes is written to Mongo, where a TTL
 * index removes it after 8 days, so history survives deploys. Storage is
 * capped by design: at most 2,304 documents per process.
 */
import mongoose from "mongoose";
import { logger } from "../utils/logger";

export interface HeartbeatSample {
  at: number;
  gateway: boolean;
  db: boolean;
  /** Gateway heartbeat round trip in ms (0 when unknown). */
  ping: number;
}

export interface UptimeBucket {
  start: number;
  end: number;
  samples: number;
  /** 0–1, or null when there are no samples in the bucket (the bot was not running). */
  uptime: number | null;
}

export const SAMPLE_INTERVAL_MS = 60_000;
export const PERSIST_EVERY = 5;
export const HISTORY_SPAN_MS = 8 * 86_400_000;

const StatusSampleSchema = new mongoose.Schema({
  at: { type: Date, required: true },
  gateway: { type: Boolean, required: true },
  db: { type: Boolean, required: true },
  ping: { type: Number, default: 0 },
}, { versionKey: false });
StatusSampleSchema.index({ at: 1 }, { expireAfterSeconds: 8 * 86_400 });
export const StatusSampleModel = mongoose.models.StatusSample ?? mongoose.model("StatusSample", StatusSampleSchema);

/** Splits [now - span, now] into equal buckets and reports the share of healthy samples in each. */
export function bucketize(samples: readonly HeartbeatSample[], nowMs: number, spanMs: number, count: number): UptimeBucket[] {
  const size = spanMs / count;
  const start = nowMs - spanMs;
  const buckets: UptimeBucket[] = Array.from({ length: count }, (_, i) => ({ start: Math.round(start + i * size), end: Math.round(start + (i + 1) * size), samples: 0, uptime: null }));
  const up = new Array<number>(count).fill(0);
  for (const s of samples) {
    if (s.at < start || s.at > nowMs) continue;
    const i = Math.min(count - 1, Math.floor((s.at - start) / size));
    buckets[i].samples++;
    if (s.gateway && s.db) up[i]++;
  }
  for (let i = 0; i < count; i++) if (buckets[i].samples) buckets[i].uptime = up[i] / buckets[i].samples;
  return buckets;
}

/** Share of healthy samples over a whole window, or null with no samples. */
export function uptimeRatio(samples: readonly HeartbeatSample[], nowMs: number, spanMs: number): number | null {
  const inWindow = samples.filter(s => s.at >= nowMs - spanMs && s.at <= nowMs);
  if (!inWindow.length) return null;
  return inWindow.filter(s => s.gateway && s.db).length / inWindow.length;
}

export interface CommandRegistration {
  ok: boolean | null;
  count: number;
  at: number | null;
}

export function databaseConnected(): boolean {
  return mongoose.connection?.readyState === 1;
}

/** Measures one database round trip; null when it is down or slower than 2 s. */
export async function databaseLatency(): Promise<number | null> {
  if (!databaseConnected() || !mongoose.connection.db) return null;
  const started = Date.now();
  try {
    await Promise.race([
      mongoose.connection.db.admin().ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
    ]);
    return Date.now() - started;
  } catch {
    return null;
  }
}

export function createStatusMonitor(opts: { probe: () => { gateway: boolean; ping: number }; now?: () => number; persist?: boolean }) {
  const now = () => opts.now?.() ?? Date.now();
  const samples: HeartbeatSample[] = [];
  let ticks = 0;
  let timer: NodeJS.Timeout | null = null;
  let dbLatency: number | null = null;
  const registration: CommandRegistration = { ok: null, count: 0, at: null };

  function add(sample: HeartbeatSample): void {
    samples.push(sample);
    const cutoff = now() - HISTORY_SPAN_MS;
    while (samples.length && samples[0].at < cutoff) samples.shift();
  }

  async function tick(): Promise<HeartbeatSample> {
    const probe = opts.probe();
    dbLatency = await databaseLatency();
    const sample: HeartbeatSample = { at: now(), gateway: probe.gateway, db: dbLatency !== null, ping: Math.max(0, Math.round(probe.ping)) };
    add(sample);
    if (opts.persist !== false && ticks++ % PERSIST_EVERY === 0 && databaseConnected()) {
      await StatusSampleModel.create({ ...sample, at: new Date(sample.at) }).catch((err: unknown) => logger.debug(`Status sample write failed: ${(err as Error)?.message ?? err}`));
    }
    return sample;
  }

  /** Loads the last 8 days from Mongo (once), then samples every minute. */
  async function start(): Promise<void> {
    if (opts.persist !== false && databaseConnected()) {
      try {
        const docs = (await StatusSampleModel.find({ at: { $gte: new Date(now() - HISTORY_SPAN_MS) } }).sort({ at: 1 }).limit(3000).lean()) as Array<{ at: Date; gateway: boolean; db: boolean; ping?: number }>;
        for (const d of docs) samples.push({ at: new Date(d.at).getTime(), gateway: d.gateway, db: d.db, ping: d.ping ?? 0 });
        samples.sort((a, b) => a.at - b.at);
      } catch (err) {
        logger.debug(`Status history load failed: ${(err as Error)?.message ?? err}`);
      }
    }
    if (timer) return;
    timer = setInterval(() => { tick().catch(() => undefined); }, SAMPLE_INTERVAL_MS);
    timer.unref?.();
  }

  return {
    start,
    tick,
    add,
    stop: () => { if (timer) clearInterval(timer); timer = null; },
    samples: (): readonly HeartbeatSample[] => samples,
    lastDbLatency: () => dbLatency,
    registration: (): CommandRegistration => ({ ...registration }),
    setRegistration(ok: boolean, count: number): void {
      registration.ok = ok; registration.count = count; registration.at = now();
    },
  };
}

export type StatusMonitor = ReturnType<typeof createStatusMonitor>;

let shared: StatusMonitor | null = null;
let sharedProbe: () => { gateway: boolean; ping: number } = () => ({ gateway: false, ping: 0 });

/** The process-wide monitor. Passing a probe (the web server does) sets how the gateway is checked. */
export function statusMonitor(probe?: () => { gateway: boolean; ping: number }): StatusMonitor {
  if (probe) sharedProbe = probe;
  if (!shared) shared = createStatusMonitor({ probe: () => sharedProbe() });
  return shared;
}
