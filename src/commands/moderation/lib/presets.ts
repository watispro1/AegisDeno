/**
 * Reason presets for moderation commands that had no suggestions yet
 * (/purge, /lock, /unban, /removetimeout, /clearwarnings, /case edit). The
 * moderator can always ignore them and type their own reason: whatever they
 * typed is offered first, keeping its casing. Pure; unit-tested.
 */
import { clipChoice, MAX_AUTOCOMPLETE_CHOICES, MAX_CHOICE_LENGTH } from "../../../utils/autocomplete";
import { buildReasonSuggestions } from "../../../utils/moderationPresets";

export interface Preset {
  name: string;
  value: string;
}

export const PURGE_REASON_PRESETS: readonly Preset[] = [
  { name: "Spam cleanup — floods, repeats, copypasta", value: "Spam cleanup" },
  { name: "Raid cleanup — coordinated join-and-spam", value: "Raid cleanup" },
  { name: "Rule-breaking content — NSFW, slurs, gore", value: "Removing rule-breaking content" },
  { name: "Scam or phishing links", value: "Scam / phishing links" },
  { name: "Off-topic clutter", value: "Off-topic cleanup" },
  { name: "Bot or command output cleanup", value: "Bot output cleanup" },
];

export const LOCK_REASON_PRESETS: readonly Preset[] = [
  { name: "Raid in progress", value: "Raid in progress" },
  { name: "Spam wave", value: "Spam wave" },
  { name: "Heated discussion — cooling off", value: "Heated discussion, cooling off" },
  { name: "Staff announcement or event", value: "Staff announcement or event" },
  { name: "Maintenance", value: "Maintenance" },
];

export const UNLOCK_REASON_PRESETS: readonly Preset[] = [
  { name: "Situation resolved", value: "Situation resolved" },
  { name: "Raid over", value: "Raid over" },
  { name: "Maintenance finished", value: "Maintenance finished" },
];

export const UNBAN_REASON_PRESETS: readonly Preset[] = [
  { name: "Appeal accepted", value: "Appeal accepted" },
  { name: "Ban issued by mistake", value: "Ban issued by mistake" },
  { name: "Ban period served", value: "Ban period served" },
  { name: "Account recovered (was compromised)", value: "Account recovered (was compromised)" },
];

export const UNTIMEOUT_REASON_PRESETS: readonly Preset[] = [
  { name: "Served enough time", value: "Served enough time" },
  { name: "Timeout issued by mistake", value: "Timeout issued by mistake" },
  { name: "Appeal accepted", value: "Appeal accepted" },
  { name: "Apologised / behaviour improved", value: "Apologised, behaviour improved" },
];

export const CLEARWARNINGS_REASON_PRESETS: readonly Preset[] = [
  { name: "Fresh start — good behaviour since", value: "Fresh start, good behaviour since" },
  { name: "Warnings issued by mistake", value: "Warnings issued by mistake" },
  { name: "Appeal accepted", value: "Appeal accepted" },
];

/**
 * Suggestions for a free-text reason: the typed text first (unless it is
 * exactly a preset), then the presets that match it. Values stay within
 * Discord's 100-character choice limit.
 */
export function presetSuggestions(typed: string, presets: readonly Preset[]): Preset[] {
  const raw = String(typed ?? "").trim();
  const q = raw.toLowerCase();
  const out: Preset[] = [];
  if (raw && !presets.some(p => p.value.toLowerCase() === q)) {
    out.push({ name: clipChoice(`Custom: ${raw}`), value: raw.slice(0, MAX_CHOICE_LENGTH) });
  }
  for (const p of presets) {
    if (!q || p.name.toLowerCase().includes(q) || p.value.toLowerCase().includes(q)) out.push({ name: clipChoice(p.name), value: p.value });
  }
  return out.slice(0, MAX_AUTOCOMPLETE_CHOICES);
}

/** The house reason presets (Spam, NSFW…) — for /case edit, where any action's reason can be rewritten. */
export function generalReasonSuggestions(typed: string): Preset[] {
  return buildReasonSuggestions(typed);
}
