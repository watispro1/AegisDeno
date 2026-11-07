/**
 * Discord's content-scanning flags on attachments and embeds, and the rules
 * for what Aegis does when it reposts media Discord has flagged.
 *
 * discord.js and discord-api-types do not name these bits yet, so they are
 * defined here and read from the raw values: `attachment.flags.bitfield`
 * keeps unknown bits, and `embed.data.flags` is the raw API value.
 * Scanning can finish after a message is sent, so the flags may only appear
 * in a later message update. Attachments resolved from an interaction
 * (an attachment command option) never carry them.
 *
 * Pure: no Discord or Mongo calls, so every rule is unit-tested directly.
 */

/** Bits shared by attachment flags and embed flags. */
export const MEDIA_SCAN_FLAGS = {
  explicit: 1 << 4,
  gore: 1 << 6,
  self_harm: 1 << 7,
} as const;

export type MediaFlagReason = keyof typeof MEDIA_SCAN_FLAGS;

const REASON_ORDER: readonly MediaFlagReason[] = ["explicit", "gore", "self_harm"];

const REASON_LABELS: Record<MediaFlagReason, string> = {
  explicit: "explicit",
  gore: "gore",
  self_harm: "self-harm",
};

export type MediaSafetyMode = "placeholder" | "spoiler";
export const MEDIA_SAFETY_MODES: readonly MediaSafetyMode[] = ["placeholder", "spoiler"];

export interface MediaSafetyConfig {
  /** Keep media Discord flagged out of reposts in channels that are not age-restricted. Default on. */
  enabled: boolean;
  /** placeholder: drop the media and say why. spoiler: keep a link behind a spoiler. */
  mode: MediaSafetyMode;
}

export const DEFAULT_MEDIA_SAFETY: MediaSafetyConfig = { enabled: true, mode: "placeholder" };

export function normalizeMediaSafety(value: unknown): MediaSafetyConfig {
  const o = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    enabled: o.enabled !== false,
    mode: o.mode === "spoiler" ? "spoiler" : "placeholder",
  };
}

/** Which scanning reasons a raw flags value carries, in a fixed order. */
export function mediaFlagReasons(flags: number | bigint | null | undefined): MediaFlagReason[] {
  if (flags === null || flags === undefined) return [];
  const bits = typeof flags === "bigint" ? Number(flags & 0xffffffffn) : flags;
  if (!Number.isFinite(bits)) return [];
  return REASON_ORDER.filter(r => (bits & MEDIA_SCAN_FLAGS[r]) !== 0);
}

/** An attachment as discord.js hands it over (flags is a BitField) or as raw API data (a number). */
export interface FlaggableAttachment {
  flags?: { bitfield: number | bigint } | number | null;
}

/** An embed as discord.js hands it over (raw data under `data`) or as raw API data. */
export interface FlaggableEmbed {
  data?: { flags?: number | null };
  flags?: number | null;
}

export function attachmentFlagReasons(a: FlaggableAttachment): MediaFlagReason[] {
  const f = a.flags;
  if (f === null || f === undefined) return [];
  return mediaFlagReasons(typeof f === "object" ? f.bitfield : f);
}

export function embedFlagReasons(e: FlaggableEmbed): MediaFlagReason[] {
  return mediaFlagReasons(e.data?.flags ?? e.flags ?? null);
}

export const attachmentIsFlagged = (a: FlaggableAttachment): boolean => attachmentFlagReasons(a).length > 0;
export const embedIsFlagged = (e: FlaggableEmbed): boolean => embedFlagReasons(e).length > 0;

export interface FlaggedMediaSummary {
  flagged: boolean;
  /** Every reason found, merged and in a fixed order. */
  reasons: MediaFlagReason[];
  /** Indexes into the attachment list (in iteration order) that are flagged. */
  attachments: number[];
  /** Indexes into the embed list that are flagged. */
  embeds: number[];
}

/** What media on a message Discord flagged. */
export function summarizeFlaggedMedia(message: {
  attachments: Iterable<FlaggableAttachment> | { values(): Iterable<FlaggableAttachment> };
  embeds: readonly FlaggableEmbed[];
}): FlaggedMediaSummary {
  const list = "values" in message.attachments && typeof message.attachments.values === "function"
    ? [...message.attachments.values()]
    : [...(message.attachments as Iterable<FlaggableAttachment>)];
  const found = new Set<MediaFlagReason>();
  const attachments: number[] = [];
  const embeds: number[] = [];
  list.forEach((a, i) => {
    const r = attachmentFlagReasons(a);
    if (r.length) { attachments.push(i); r.forEach(x => found.add(x)); }
  });
  message.embeds.forEach((e, i) => {
    const r = embedFlagReasons(e);
    if (r.length) { embeds.push(i); r.forEach(x => found.add(x)); }
  });
  const reasons = REASON_ORDER.filter(r => found.has(r));
  return { flagged: reasons.length > 0, reasons, attachments, embeds };
}

/** "explicit", "explicit and gore", "explicit, gore and self-harm". */
export function reasonsText(reasons: readonly MediaFlagReason[]): string {
  const words = REASON_ORDER.filter(r => reasons.includes(r)).map(r => REASON_LABELS[r]);
  if (words.length <= 1) return words[0] ?? "unsafe";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** The line shown where flagged media would have been. */
export function hiddenMediaLine(reasons: readonly MediaFlagReason[], name?: string | null): string {
  const what = name ? `${cleanName(name)} hidden` : "Image hidden";
  return `${what}: flagged by Discord as ${reasonsText(reasons)}`;
}

/** A link kept behind a spoiler, for spoiler mode. */
export function spoilerMediaLine(reasons: readonly MediaFlagReason[], name: string, url: string): string {
  return `||[${cleanName(name)}](${url})|| (flagged by Discord as ${reasonsText(reasons)})`;
}

function cleanName(name: string): string {
  return name.replace(/[[\]()|`\n]/g, "_").slice(0, 80) || "file";
}

/**
 * How a repost should treat flagged media: null when it is reposted as today
 * (guard off, or the target channel is age-restricted), else the mode.
 */
export function guardModeFor(config: MediaSafetyConfig | null | undefined, targetIsNsfw: boolean): MediaSafetyMode | null {
  const c = normalizeMediaSafety(config);
  if (!c.enabled || targetIsNsfw) return null;
  return c.mode;
}

/** A channel's age restriction; a thread takes its parent's. DMs are never age-restricted. */
export function channelIsNsfw(channel: unknown): boolean {
  if (!channel || typeof channel !== "object") return false;
  const c = channel as { nsfw?: unknown; parent?: { nsfw?: unknown } | null; isThread?: () => boolean };
  const thread = typeof c.isThread === "function" ? c.isThread() : false;
  if (thread) return c.parent?.nsfw === true;
  return c.nsfw === true;
}

/** A URL without its query string, so a re-signed CDN link still matches. */
export function mediaUrlKey(url: string | null | undefined): string {
  return (url ?? "").split(/[?#]/)[0];
}

/** One line describing the setting, for /config, /diagnostics and the overview. */
export function mediaSafetySummary(config: MediaSafetyConfig | null | undefined): string {
  const c = normalizeMediaSafety(config);
  if (!c.enabled) return "Off: media Discord flagged is reposted as is";
  return c.mode === "spoiler"
    ? "On: flagged media is reposted only as a spoilered link outside age-restricted channels"
    : "On: flagged media is replaced with a note outside age-restricted channels";
}
