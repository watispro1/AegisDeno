/**
 * Weekly staff digest: pure rules (config, time zones, scheduling, the embed).
 * Gathering lives in digestService.ts; scheduling uses the task scheduler.
 */
const SNOWFLAKE = /^\d{17,20}$/;

export interface DigestConfig {
  enabled: boolean;
  /** Where to post; null uses the main mod log channel. */
  channelId: string | null;
  /** 0 = Sunday … 6 = Saturday, in `timezone`. */
  day: number;
  /** 0–23, in `timezone`. */
  hour: number;
  /** IANA time zone, default UTC. */
  timezone: string;
}

export const DEFAULT_DIGEST_CONFIG: DigestConfig = { enabled: false, channelId: null, day: 1, hour: 9, timezone: "UTC" };
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export function isValidTimeZone(tz: unknown): boolean {
  if (typeof tz !== "string" || !tz || tz.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(tz)) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

export function normalizeDigestConfig(value: unknown): DigestConfig {
  const o = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const int = (v: unknown, min: number, max: number, d: number) => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : d);
  return {
    enabled: o.enabled === true,
    channelId: typeof o.channelId === "string" && SNOWFLAKE.test(o.channelId) ? o.channelId : null,
    day: int(o.day, 0, 6, DEFAULT_DIGEST_CONFIG.day),
    hour: int(o.hour, 0, 23, DEFAULT_DIGEST_CONFIG.hour),
    timezone: isValidTimeZone(o.timezone) ? o.timezone as string : "UTC",
  };
}

export interface ZonedParts { year: number; month: number; day: number; weekday: number; hour: number; minute: number }

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Wall-clock parts of an instant in a time zone. */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "0";
  return { year: +get("year"), month: +get("month"), day: +get("day"), weekday: WEEKDAYS[get("weekday")] ?? 0, hour: +get("hour") % 24, minute: +get("minute") };
}

/**
 * The next instant after `now` when it is `day` at `hour`:00 in the zone.
 * Steps in 15-minute increments so half- and quarter-hour zones work, and a
 * DST gap that skips the hour falls through to the next week instead of firing twice.
 */
export function nextDigestRun(c: Pick<DigestConfig, "day" | "hour" | "timezone">, now: Date): Date {
  const step = 15 * 60_000;
  let t = Math.floor(now.getTime() / step) * step + step;
  for (let i = 0; i < 9 * 24 * 4; i++, t += step) {
    const p = zonedParts(new Date(t), c.timezone);
    if (p.weekday === c.day && p.hour === c.hour && p.minute === 0) return new Date(t);
  }
  // Unreachable for a valid zone; fall back to a week from now.
  return new Date(now.getTime() + 7 * 86_400_000);
}

/** ISO week of the local date in the zone, e.g. "2026-W44". The idempotency key for one guild-week. */
export function digestWeekKey(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function describeSchedule(c: DigestConfig): string {
  return `${DAY_NAMES[c.day]}s at ${String(c.hour).padStart(2, "0")}:00 ${c.timezone}`;
}

/* ── Content ───────────────────────────────────────────────────────── */

export interface DigestStats {
  since: Date;
  until: Date;
  casesByType: Array<[string, number]>;
  casesByModerator: Array<[string, number]>;
  joins: number;
  leaves: number;
  automodHits: number;
  incidents: number;
  trust: { scored: number; average: number | null; low: number; previousLow: number | null };
  open: { tickets: number; appeals: number; modmail: number };
  lowest: Array<{ userId: string; name: string; score: number }>;
}

export interface DigestEmbedData {
  title: string;
  description: string;
  color: number;
  fields: Array<{ name: string; value: string; inline: boolean }>;
  footer: { text: string };
}

const fmt = (n: number) => n.toLocaleString("en-US");
const ts = (d: Date) => `<t:${Math.floor(d.getTime() / 1000)}:D>`;

/** Embed content for one week. Members are named by mention text only; allowedMentions on send keeps them silent. */
export function buildDigestEmbed(s: DigestStats, guildName: string, preview = false): DigestEmbedData {
  const totalCases = s.casesByType.reduce((a, [, n]) => a + n, 0);
  const list = (rows: Array<[string, number]>, label: (k: string) => string) =>
    rows.length ? rows.slice(0, 8).map(([k, n]) => `${label(k)} · **${fmt(n)}**`).join("\n") : "None";
  const lowDelta = s.trust.previousLow === null ? "" : ` (${s.trust.low - s.trust.previousLow >= 0 ? "+" : ""}${s.trust.low - s.trust.previousLow} vs last week)`;
  const fields = [
    { name: `Cases (${fmt(totalCases)})`, value: list(s.casesByType, k => k), inline: true },
    { name: "Top moderators", value: list(s.casesByModerator.slice(0, 5), k => (SNOWFLAKE.test(k) ? `<@${k}>` : k)), inline: true },
    { name: "Members", value: `Joins **${fmt(s.joins)}** · Leaves **${fmt(s.leaves)}** · Net **${s.joins - s.leaves >= 0 ? "+" : ""}${fmt(s.joins - s.leaves)}**`, inline: false },
    { name: "Automod & incidents", value: `Automod hits **${fmt(s.automodHits)}** · Incidents **${fmt(s.incidents)}**`, inline: false },
    { name: "Trust", value: s.trust.scored ? `Average **${s.trust.average ?? "—"}** across ${fmt(s.trust.scored)} · Low trust **${fmt(s.trust.low)}**${lowDelta}` : "Not scored yet", inline: false },
    { name: "Open now", value: `Tickets **${fmt(s.open.tickets)}** · Appeals **${fmt(s.open.appeals)}** · ModMail **${fmt(s.open.modmail)}**`, inline: false },
    { name: "Lowest trust", value: s.lowest.length ? s.lowest.slice(0, 5).map(m => `<@${m.userId}> · ${m.score}`).join("\n") : "None", inline: false },
  ].map(f => ({ ...f, value: f.value.slice(0, 1024) }));
  return {
    title: `${preview ? "Preview · " : ""}Weekly staff digest`,
    description: `**${guildName.slice(0, 100)}** · ${ts(s.since)} → ${ts(s.until)}`,
    color: 0x5865f2,
    fields,
    footer: { text: preview ? "Preview only · not counted as this week's digest" : "Aegis weekly digest · /digest disable to stop" },
  };
}

/** Never ping from a digest. */
export const DIGEST_MENTIONS = { parse: [] as [], users: [] as [], roles: [] as [] };
