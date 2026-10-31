/**
 * Short duration strings used by /remindme: "<number><unit>" where unit is
 * s, m, h, d or w (case-insensitive, optional whitespace before the unit).
 */
const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };

/** Parse "30m", "2h", "1w"… into seconds. Returns null for anything else. */
export function parseDuration(raw: string): number | null {
  const match = raw.trim().match(/^(\d+)\s*(s|m|h|d|w)$/i);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  const seconds = n * UNIT_SECONDS[match[2].toLowerCase()];
  return Number.isSafeInteger(seconds) ? seconds : null;
}

/** Compact human label for a number of seconds ("45s", "5m 30s", "3h", "2d", "1w"). */
export function formatDuration(seconds: number): string {
  if (seconds < 60)    return `${seconds}s`;
  if (seconds < 3600)  return `${Math.floor(seconds / 60)}m ${seconds % 60 > 0 ? `${seconds % 60}s` : ""}`.trim();
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return `${Math.floor(seconds / 604800)}w`;
}

const FRIENDLY_UNITS: Record<string, number> = {
  s: 1, sec: 1, secs: 1, second: 1, seconds: 1,
  m: 60, min: 60, mins: 60, minute: 60, minutes: 60,
  h: 3600, hr: 3600, hrs: 3600, hour: 3600, hours: 3600,
  d: 86400, day: 86400, days: 86400,
  w: 604800, wk: 604800, wks: 604800, week: 604800, weeks: 604800,
};

/**
 * Friendlier duration parsing for moderation commands: everything
 * `parseDuration` accepts, plus compound and spelled-out forms such as
 * "1h30m", "1d 12h", "90 minutes", "2 days" or "1 week, 2 days".
 * Whole numbers only; returns null for anything else (including 0).
 */
export function parseFriendlyDuration(raw: string): number | null {
  const text = String(raw ?? "").trim().toLowerCase().replace(/,|\band\b/g, " ");
  if (!text || text.length > 64) return null;
  const re = /(\d+)\s*([a-z]+)/g;
  let total = 0;
  let consumed = "";
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const unit = FRIENDLY_UNITS[match[2]];
    if (!unit) return null;
    total += parseInt(match[1], 10) * unit;
    consumed += match[0];
  }
  // Every non-space character must belong to a number+unit pair.
  if (consumed.replace(/\s+/g, "") !== text.replace(/\s+/g, "")) return null;
  if (!Number.isSafeInteger(total) || total <= 0) return null;
  return total;
}

/** Long human label: "1 day 2 hours", "30 minutes", "1 week". Shows at most two units. */
export function formatDurationLong(seconds: number): string {
  const parts: string[] = [];
  let rest = Math.max(0, Math.floor(seconds));
  for (const [name, size] of [["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]] as const) {
    if (rest >= size) {
      const n = Math.floor(rest / size);
      rest -= n * size;
      parts.push(`${n} ${name}${n === 1 ? "" : "s"}`);
    }
    if (parts.length === 2) break;
  }
  return parts.length ? parts.join(" ") : "0 seconds";
}
