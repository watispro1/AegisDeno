import type { AutocompleteInteraction } from "discord.js";
import { formatDurationLong, parseFriendlyDuration } from "./duration";

/**
 * Reason presets offered by autocomplete on /warn, /timeout and /ban.
 * The moderator can always ignore them and type a free-text reason.
 */
export const MOD_REASON_PRESETS = [
  { name: "Spam — flooding, repeat messages or unsolicited DMs", value: "Spam" },
  { name: "NSFW — inappropriate media or discussion", value: "NSFW" },
  { name: "Harassment — insults, toxicity or targeting members", value: "Harassment" },
  { name: "Advertising — server invites or self-promotion", value: "Advertising" },
  { name: "Raiding — coordinated disruption or raid account", value: "Raiding" },
  { name: "Other — see notes", value: "Other" },
] as const;

export interface ReasonSuggestion {
  name: string;
  value: string;
}

/** Discord limits: choice name and value are both capped at 100 characters. */
const CHOICE_MAX = 100;

/**
 * Build autocomplete suggestions for a reason option. Presets matching the
 * typed text come first; whatever the moderator typed is always offered as a
 * free-text choice (original casing kept) unless it is exactly a preset.
 */
export function buildReasonSuggestions(typed: string): ReasonSuggestion[] {
  const raw = typed.trim();
  const query = raw.toLowerCase();

  const presets = MOD_REASON_PRESETS.filter(
    (p) => !query || p.name.toLowerCase().includes(query) || p.value.toLowerCase().includes(query),
  ).map((p) => ({ name: p.name, value: p.value }));

  const results: ReasonSuggestion[] = [];
  if (raw && !MOD_REASON_PRESETS.some((p) => p.value.toLowerCase() === query)) {
    const label = `Custom: ${raw}`;
    results.push({
      name: label.length > CHOICE_MAX ? `${label.slice(0, CHOICE_MAX - 1)}…` : label,
      value: raw.slice(0, CHOICE_MAX),
    });
  }
  results.push(...presets);
  return results.slice(0, 25);
}

/** Autocomplete handler for any command whose focused option is a reason. */
export async function handleReasonAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== "reason") {
    await interaction.respond([]);
    return;
  }
  await interaction.respond(buildReasonSuggestions(String(focused.value ?? "")));
}

/** Combine an optional legacy preset choice with a free-text/autocompleted reason. */
export function combineReason(preset: string | null, reason: string | null): string | null {
  const p = preset?.trim() || null;
  const r = reason?.trim() || null;
  if (p && r) return p === r ? r : `[${p}] ${r}`;
  return p ?? r;
}

/**
 * Autocomplete for a free-text duration option. What the moderator typed is
 * offered first with how it reads ("1d12h → 1 day 12 hours"), or a hint when
 * it can't be read or is out of range; the presets follow. Values stay the raw
 * text so the command parses them the same way as a typed value.
 */
export function buildDurationSuggestions(
  typed: string,
  presets: ReadonlyArray<{ name: string; value: string }>,
  bounds: { minSeconds: number; maxSeconds: number },
): ReasonSuggestion[] {
  const raw = typed.trim().slice(0, CHOICE_MAX);
  const out: ReasonSuggestion[] = [];
  if (raw) {
    const seconds = parseFriendlyDuration(raw);
    const label = seconds === null
      ? `"${raw}" isn't a duration — try 30m, 2h, 1d 12h, 3 days`
      : seconds < bounds.minSeconds || seconds > bounds.maxSeconds
        ? `${raw} → ${formatDurationLong(seconds)} (allowed: ${formatDurationLong(bounds.minSeconds)} to ${formatDurationLong(bounds.maxSeconds)})`
        : `${raw} → ${formatDurationLong(seconds)}`;
    out.push({ name: label.length > CHOICE_MAX ? `${label.slice(0, CHOICE_MAX - 1)}…` : label, value: raw });
  }
  const q = raw.toLowerCase();
  for (const p of presets) {
    if (out.length >= 25) break;
    if (p.value.toLowerCase() === q) continue;
    if (!q || p.name.toLowerCase().includes(q) || p.value.toLowerCase().startsWith(q)) out.push({ name: p.name, value: p.value });
  }
  return out.slice(0, 25);
}
