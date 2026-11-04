/** Duration parsing, presets and labels for /timeout. */
import { parseFriendlyDuration } from "../../../utils/duration";

/** Discord's longest timeout: 28 days. */
export const MAX_TIMEOUT_SECONDS = 28 * 86_400;

/**
 * The timeout length from `/timeout`: the `custom_duration` text when given
 * (e.g. "90m", "1d 12h", "2 weeks"), otherwise the `duration` choice. One of
 * the two is required; the result is 1 minute to 28 days.
 */
export function resolveTimeoutSeconds(choice: number | null, custom: string | null): { ok: true; seconds: number } | { ok: false; error: string } {
  const text = custom?.trim() ?? "";
  if (text) {
    const seconds = parseFriendlyDuration(text);
    if (seconds === null) return { ok: false, error: "❌ I couldn't read that duration. Try `90m`, `2h`, `1d 12h` or `2 weeks`." };
    if (seconds < 60 || seconds > MAX_TIMEOUT_SECONDS) return { ok: false, error: "❌ A timeout must last between 1 minute and 28 days (Discord's limit)." };
    return { ok: true, seconds };
  }
  if (choice === null || !Number.isInteger(choice) || choice <= 0) {
    return { ok: false, error: "❌ Pick a `duration`, or type one in `custom_duration` (e.g. `90m`, `1d 12h`)." };
  }
  return { ok: true, seconds: Math.min(choice, MAX_TIMEOUT_SECONDS) };
}

export const CUSTOM_DURATION_PRESETS = [
  { name: "15 minutes", value: "15m" },
  { name: "2 hours", value: "2h" },
  { name: "1 day 12 hours", value: "1d 12h" },
  { name: "2 weeks", value: "2w" },
  { name: "28 days (maximum)", value: "28d" },
] as const;

export const DURATION_CHOICES = [
  { name: "60 seconds",  value: 60 },
  { name: "5 minutes",   value: 300 },
  { name: "10 minutes",  value: 600 },
  { name: "30 minutes",  value: 1800 },
  { name: "1 hour",      value: 3600 },
  { name: "6 hours",     value: 21600 },
  { name: "12 hours",    value: 43200 },
  { name: "1 day",       value: 86400 },
  { name: "3 days",      value: 259200 },
  { name: "1 week",      value: 604800 },
];

export function formatDuration(seconds: number): string {
  if (seconds < 60)     return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  if (seconds < 3600)   return `${seconds / 60} minute${seconds / 60 !== 1 ? "s" : ""}`;
  if (seconds < 86400)  return `${seconds / 3600} hour${seconds / 3600 !== 1 ? "s" : ""}`;
  if (seconds < 604800) return `${seconds / 86400} day${seconds / 86400 !== 1 ? "s" : ""}`;
  return `${seconds / 604800} week${seconds / 604800 !== 1 ? "s" : ""}`;
}

/**
 * The "Extend (+1h)" quick action: one more hour from the current expiry (or
 * from now if the timeout already ended), capped at 28 days from now.
 */
export function extendedTimeout(currentUntil: Date | null, nowMs: number, addMs = 3_600_000): { untilMs: number; durationMs: number } {
  const currentEnd = currentUntil && currentUntil.getTime() > nowMs ? currentUntil.getTime() : nowMs;
  const untilMs = Math.min(currentEnd + addMs, nowMs + MAX_TIMEOUT_SECONDS * 1000);
  return { untilMs, durationMs: Math.max(untilMs - nowMs, 60_000) };
}
