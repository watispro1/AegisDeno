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

/** Brackets, quotes and commas never belong to a hostname, so the host ends at the first one. */
const HOST_END = /[()[\]{}'",;!*|`].*$/;
/** Sentence punctuation left at the end of a link. */
const TRAILING_PUNCTUATION = /[.:_~]+$/;

/** Hostnames of every http(s) link in the text, lowercased, without "www.". */
export function linkHosts(content: string): string[] {
  return [...content.replace(ZERO_WIDTH, "").matchAll(/https?:\/\/([^\s/?#<>]+)/gi)]
    .map(m => m[1].toLowerCase()
      .replace(/^[^@]*@/, "")
      .replace(HOST_END, "")
      .replace(TRAILING_PUNCTUATION, "")
      .replace(/:\d*$/, "")
      .replace(/^www\./, "")
      .replace(/\.$/, ""))
    .filter(Boolean);
}

/** Whether a host is one of the allowed domains or a subdomain of one. */
export function hostAllowed(host: string, allowedDomains: readonly string[]): boolean {
  return allowedDomains.some(d => host === d || host.endsWith(`.${d}`));
}

/** The first link whose host is not allow-listed, or null when every link is allowed (or there are none). */
export function blockedLinkHost(content: string, allowedDomains: readonly string[] = []): string | null {
  return linkHosts(content).find(h => !hostAllowed(h, allowedDomains)) ?? null;
}

const INVITE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:discord(?:app)?\.com\/invite|discord\.gg|dsc\.gg)\/([a-z0-9-]{2,32})/gi;

/** Discord invite codes in the text, with zero-width characters stripped first so "disc\u200Bord.gg" still counts. */
export function inviteCodes(content: string): string[] {
  return [...content.replace(ZERO_WIDTH, "").matchAll(INVITE_REGEX)].map(m => m[1]);
}

/** The first invite code that is neither allow-listed nor the server's own vanity code, or null. */
export function blockedInvite(content: string, allowedCodes: readonly string[] = [], vanityCode: string | null = null): string | null {
  const allowed = new Set(allowedCodes.map(c => c.toLowerCase()));
  if (vanityCode) allowed.add(vanityCode.toLowerCase());
  return inviteCodes(content).find(code => !allowed.has(code.toLowerCase())) ?? null;
}

const CUSTOM_EMOJI = /<a?:\w{2,32}:\d{17,20}>/g;
const PICTOGRAPHIC = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Custom emoji plus Unicode emoji, counting a joined sequence (family, flag, skin tone) once. */
export function emojiCount(content: string): number {
  const custom = content.match(CUSTOM_EMOJI)?.length ?? 0;
  let unicode = 0;
  for (const { segment } of segmenter.segment(content.replace(CUSTOM_EMOJI, " "))) {
    if (PICTOGRAPHIC.test(segment)) unicode++;
  }
  return custom + unicode;
}

/**
 * "Zalgo" text: four or more combining diacritical marks stacked on one
 * character. Scripts that use combining marks normally (Vietnamese, Hindi,
 * Thai) stay well under that.
 */
export function isZalgo(content: string): boolean {
  return /[\u0300-\u036F\u0483-\u0489\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]{4,}/.test(content);
}

/** "Emoji Spam", "Zalgo Text" or null. */
export function emojiOrZalgo(content: string, rule: { maxEmoji: number; zalgo: boolean }): "Emoji Spam" | "Zalgo Text" | null {
  if (rule.zalgo && isZalgo(content)) return "Zalgo Text";
  if (emojiCount(content) > rule.maxEmoji) return "Emoji Spam";
  return null;
}

/** Text compared by the duplicate-message rule: case, spacing and zero-width characters ignored. */
export function duplicateKey(content: string): string {
  return content.replace(ZERO_WIDTH, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Counts identical messages per member inside a sliding window. Kept in
 * memory and bounded; a restart simply starts the count again.
 */
export class DuplicateTracker {
  private readonly seen = new Map<string, { text: string; times: number[] }>();
  constructor(private readonly maxKeys = 5000) {}

  /** Record a message and return how many times this exact text was sent inside the window (including this one). */
  record(memberKey: string, content: string, windowMs: number, now = Date.now()): number {
    const text = duplicateKey(content);
    if (!text) return 0;
    const prev = this.seen.get(memberKey);
    const times = prev && prev.text === text ? prev.times.filter(t => t > now - windowMs) : [];
    times.push(now);
    this.seen.delete(memberKey);
    this.seen.set(memberKey, { text, times });
    if (this.seen.size > this.maxKeys) {
      const oldest = this.seen.keys().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
    return times.length;
  }
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

export type AutomodRuleKey = "words" | "mentions" | "invites" | "links" | "caps" | "emoji";

/** The invite, duplicate and emoji rules are optional here so older callers and saved exports still preview. */
export type PreviewConfig = Omit<AutomodConfig, "guildId" | "invites" | "duplicates" | "emoji" | "timeoutMinutes" | "links">
  & Partial<Pick<AutomodConfig, "invites" | "emoji">>
  & { links: AutomodConfig["links"] | Omit<AutomodConfig["links"], "allowedDomains"> };

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
export function previewAutomod(config: PreviewConfig, content: string, vanityCode: string | null = null): AutomodPreview {
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

  if (config.invites) {
    const invite = blockedInvite(content, config.invites.allowedCodes, vanityCode);
    consider(config.invites.enabled, invite ? { rule: "invites", label: "Invites", action: config.invites.action, detail: `invite \`${invite}\` is not allowed` } : null);
  }

  const allowed = "allowedDomains" in config.links ? config.links.allowedDomains : [];
  const host = blockedLinkHost(content, allowed);
  consider(config.links.enabled, host ? { rule: "links", label: "Links", action: config.links.action, detail: allowed.length ? `${host} is not on the allowed list` : "contains a link" } : null);

  const caps = capsOrFlood(content, config.caps?.threshold);
  consider(Boolean(config.caps?.enabled), caps
    ? { rule: "caps", label: caps === "Excessive Caps" ? "Capitals" : "Character flood", action: config.caps.action, detail: caps === "Excessive Caps" ? `at least ${config.caps.threshold}% capitals` : "5 or more of one character in a row" }
    : null);

  if (config.emoji) {
    const e = emojiOrZalgo(content, config.emoji);
    consider(config.emoji.enabled, e
      ? { rule: "emoji", label: e === "Zalgo Text" ? "Zalgo text" : "Emoji spam", action: config.emoji.action, detail: e === "Zalgo Text" ? "stacked combining marks" : `more than ${config.emoji.maxEmoji} emoji` }
      : null);
  }

  return { hits, offButWouldMatch: off, acting: hits[0] ?? null };
}
