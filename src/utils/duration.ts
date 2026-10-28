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
