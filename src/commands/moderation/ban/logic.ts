/** Temp-ban duration presets and parsing for /ban. */
import { formatDurationLong, parseFriendlyDuration } from "../../../utils/duration";
import { TEMP_BAN_MAX_SECONDS, TEMP_BAN_MIN_SECONDS } from "../../../services/timedActions";

export const TEMP_BAN_PRESETS = [
  { name: "1 day", value: "1d" },
  { name: "3 days", value: "3d" },
  { name: "1 week", value: "7d" },
  { name: "2 weeks", value: "14d" },
  { name: "30 days", value: "30d" },
  { name: "90 days", value: "90d" },
] as const;

/**
 * Read `/ban duration:`. Empty means a permanent ban; otherwise the length in
 * seconds, or an error message for the moderator.
 */
export function parseBanDuration(raw: string | null): { ok: true; seconds: number | null } | { ok: false; error: string } {
  const text = raw?.trim() ?? "";
  if (!text || /^(perm|permanent|forever|never)$/i.test(text)) return { ok: true, seconds: null };
  const seconds = parseFriendlyDuration(text);
  if (seconds === null) return { ok: false, error: "❌ I couldn't read that duration. Try `12h`, `7d`, `2 weeks` or `1d 12h`, or leave it empty for a permanent ban." };
  if (seconds < TEMP_BAN_MIN_SECONDS || seconds > TEMP_BAN_MAX_SECONDS) {
    return { ok: false, error: `❌ A temporary ban must last between ${formatDurationLong(TEMP_BAN_MIN_SECONDS)} and ${formatDurationLong(TEMP_BAN_MAX_SECONDS)}.` };
  }
  return { ok: true, seconds };
}
