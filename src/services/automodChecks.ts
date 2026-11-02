/**
 * The content checks behind automod, as pure functions. The live handler
 * (automodExecution.ts) and the dashboard's "Test a message" preview both use
 * them, so the preview can't drift from what automod actually does.
 */
import type { AutomodConfig } from "./automod";

const LINK_REGEX = /https?:\/\/[^\s]+/i;
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF\u00AD]/g;

/** A blocked word or phrase appears in the message (case-insensitive, zero-width characters ignored). */
export function blockedWordHit(list: readonly string[], content: string): string | null {
  const raw = content.toLowerCase();
  const normalized = raw.replace(ZERO_WIDTH, "");
  for (const w of list) {
    const needle = w.toLowerCase().trim();
    if (needle && (raw.includes(needle) || normalized.includes(needle))) return needle;
  }
  return null;
}

export function hasLink(content: string): boolean {
  return LINK_REGEX.test(content);
}

/** "Excessive Caps" (8+ letters, at least `threshold`% capitals), "Character Flood" (5+ of one character in a row) or null. */
export function capsOrFlood(content: string, threshold: number | undefined): "Excessive Caps" | "Character Flood" | null {
  const letters = content.match(/[a-z]/gi) ?? [];
  const uppercase = letters.filter(letter => letter === letter.toUpperCase()).length;
  const percentage = letters.length ? (uppercase / letters.length) * 100 : 0;
  if (letters.length >= 8 && percentage >= (threshold ?? 70)) return "Excessive Caps";
  if (/(.)\1{4,}/i.test(content)) return "Character Flood";
  return null;
}

/** Pings written in message text: distinct users, distinct roles, and @everyone/@here once. */
export function textMentionCount(content: string): number {
  const users = new Set([...content.matchAll(/<@!?(\d{17,20})>/g)].map(m => m[1]));
  const roles = new Set([...content.matchAll(/<@&(\d{17,20})>/g)].map(m => m[1]));
  return users.size + roles.size + (/@(everyone|here)\b/.test(content) ? 1 : 0);
}

export type AutomodRuleKey = "words" | "mentions" | "links" | "caps";

export interface AutomodPreviewHit {
  rule: AutomodRuleKey;
  label: string;
  action: string;
  detail: string;
}

export interface AutomodPreview {
  /** Every enabled rule the message breaks, in the order automod checks them. */
  hits: AutomodPreviewHit[];
  /** Rules that are switched off but would have matched. */
  offButWouldMatch: string[];
  /** The rule automod would act on (the first hit), or null when the message passes. */
  acting: AutomodPreviewHit | null;
}

/**
 * What automod would do with this text for a member with no exempt role, in
 * a channel that isn't exempt. Message spam is rate-based and can't be judged
 * from one message; the Trust Score link exception is not applied either.
 */
export function previewAutomod(config: Omit<AutomodConfig, "guildId">, content: string): AutomodPreview {
  const hits: AutomodPreviewHit[] = [];
  const off: string[] = [];
  const consider = (enabled: boolean, hit: AutomodPreviewHit | null) => {
    if (!hit) return;
    if (enabled) hits.push(hit);
    else off.push(hit.label);
  };

  const word = config.words.list.length ? blockedWordHit(config.words.list, content) : null;
  consider(config.words.enabled, word ? { rule: "words", label: "Blocked words", action: config.words.action, detail: `matches “${word}”` } : null);

  const pings = textMentionCount(content);
  consider(config.mentions.enabled, pings >= config.mentions.threshold
    ? { rule: "mentions", label: "Mention spam", action: config.mentions.action, detail: `${pings} mentions (acts at ${config.mentions.threshold})` }
    : null);

  consider(config.links.enabled, hasLink(content) ? { rule: "links", label: "Links", action: config.links.action, detail: "contains a link" } : null);

  const caps = capsOrFlood(content, config.caps?.threshold);
  consider(Boolean(config.caps?.enabled), caps
    ? { rule: "caps", label: caps === "Excessive Caps" ? "Capitals" : "Character flood", action: config.caps.action, detail: caps === "Excessive Caps" ? `at least ${config.caps.threshold}% capitals` : "5 or more of one character in a row" }
    : null);

  return { hits, offButWouldMatch: off, acting: hits[0] ?? null };
}
