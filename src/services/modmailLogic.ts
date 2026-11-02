/**
 * ModMail: pure rules (config, rate limits, relay formatting, transcripts).
 * No Discord or Mongo here, so every rule is unit-tested directly.
 * The Discord side lives in modmailService.ts.
 */
import { normalizeEmbedSpec, type EmbedSpec } from "./embedSpec";

const SNOWFLAKE = /^\d{17,20}$/;

export interface ModmailConfig {
  enabled: boolean;
  /** Text channel (private threads) or forum channel (one post per ticket). */
  channelId: string | null;
  /** Staff who may answer. Members with Manage Server always may. */
  staffRoleId: string | null;
  /** Ping the staff role when a new thread opens (the only ping ModMail ever sends). */
  pingStaff: boolean;
  /** Staff messages in a thread starting with this are relayed to the member. Empty turns it off. */
  relayPrefix: string;
  /** Replies hide the staff member's name unless they choose otherwise. */
  anonymousByDefault: boolean;
  greeting: EmbedSpec | null;
  closeMessage: EmbedSpec | null;
  blockedUserIds: string[];
}

export const MODMAIL_MAX_BLOCKED = 1000;
export const MODMAIL_PREFIX_MAX = 8;
export const MODMAIL_MAX_SNIPPETS = 50;
export const MODMAIL_SNIPPET_NAME = /^[a-z0-9][a-z0-9_-]{0,31}$/;
export const MODMAIL_SNIPPET_MAX = 1800;
/** Transcript lines kept per ticket. */
export const MODMAIL_MAX_TRANSCRIPT = 500;
/** Transcripts are deleted this long after the ticket closes. */
export const MODMAIL_TRANSCRIPT_TTL_DAYS = 90;
/** Largest attachment relayed as a link (Discord's default upload cap). */
export const MODMAIL_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
export const MODMAIL_REPLY_MAX = 1800;

const plain = (title: string, description: string): EmbedSpec => ({
  title, description, color: 0x5865f2, authorName: null, footerText: null, imageUrl: null, thumbnailUrl: null, fields: [],
});
export const DEFAULT_GREETING = plain("Message received", "Thanks for reaching out to the **{server}** staff. A moderator will reply here soon. Every message you send in this DM is passed on.");
export const DEFAULT_CLOSE = plain("Conversation closed", "The **{server}** staff closed this conversation. Send another message any time to open a new one.");

export const DEFAULT_MODMAIL_CONFIG: ModmailConfig = {
  enabled: false, channelId: null, staffRoleId: null, pingStaff: false, relayPrefix: "=",
  anonymousByDefault: false, greeting: null, closeMessage: null, blockedUserIds: [],
};

export function normalizeModmailConfig(value: unknown): ModmailConfig {
  const o = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const id = (v: unknown) => (typeof v === "string" && SNOWFLAKE.test(v) ? v : null);
  const prefix = typeof o.relayPrefix === "string" ? o.relayPrefix.replace(/[\s\u0000-\u001f]/g, "").slice(0, MODMAIL_PREFIX_MAX) : DEFAULT_MODMAIL_CONFIG.relayPrefix;
  const blocked = Array.isArray(o.blockedUserIds) ? [...new Set(o.blockedUserIds.filter((x): x is string => typeof x === "string" && SNOWFLAKE.test(x)))].slice(0, MODMAIL_MAX_BLOCKED) : [];
  return {
    enabled: o.enabled === true,
    channelId: id(o.channelId),
    staffRoleId: id(o.staffRoleId),
    pingStaff: o.pingStaff === true,
    relayPrefix: prefix,
    anonymousByDefault: o.anonymousByDefault === true,
    greeting: normalizeEmbedSpec(o.greeting),
    closeMessage: normalizeEmbedSpec(o.closeMessage),
    blockedUserIds: blocked,
  };
}

/** Whether ModMail can take tickets: on, with a channel. */
export function modmailReady(c: ModmailConfig): boolean {
  return c.enabled && Boolean(c.channelId);
}

export function isBlocked(c: ModmailConfig, userId: string): boolean {
  return c.blockedUserIds.includes(userId);
}

export function withBlocked(c: ModmailConfig, userId: string, blocked: boolean): ModmailConfig {
  const rest = c.blockedUserIds.filter(id => id !== userId);
  return { ...c, blockedUserIds: blocked ? [userId, ...rest].slice(0, MODMAIL_MAX_BLOCKED) : rest };
}

/** Staff check: Manage Server, or the configured staff role. */
export function isModmailStaff(c: ModmailConfig, member: { roleIds: readonly string[]; manageGuild: boolean }): boolean {
  return member.manageGuild || (Boolean(c.staffRoleId) && member.roleIds.includes(c.staffRoleId!));
}

/** allowedMentions for the thread's opening message: the staff role only, and only when asked. */
export function openingMentions(c: ModmailConfig): { parse: []; roles: string[]; users: [] } {
  return { parse: [], roles: c.pingStaff && c.staffRoleId ? [c.staffRoleId] : [], users: [] };
}

/** Relay messages never ping anyone. */
export const RELAY_MENTIONS = { parse: [] as [], users: [] as [], roles: [] as [], repliedUser: false };

/* ── Rate limits ───────────────────────────────────────────────────── */

/** Sliding-window limiter keyed by user. In memory: a restart only resets the window. */
export class SlidingLimiter {
  private readonly hits = new Map<string, number[]>();
  constructor(private readonly max: number, private readonly windowMs: number, private readonly maxKeys = 50_000) {}

  /** Records a hit and says whether it is allowed. */
  take(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter(t => now - t < this.windowMs);
    if (recent.length >= this.max) { this.hits.set(key, recent); return false; }
    recent.push(now);
    this.hits.delete(key);
    this.hits.set(key, recent);
    if (this.hits.size > this.maxKeys) this.hits.delete(this.hits.keys().next().value as string);
    return true;
  }
}

/* ── Relaying ──────────────────────────────────────────────────────── */

export interface RelayAttachment { name: string; url: string; size: number }

/** Attachment lines for a relay: links up to the size cap, a note for anything larger. */
export function attachmentLines(atts: readonly RelayAttachment[], maxBytes = MODMAIL_ATTACHMENT_MAX_BYTES): string[] {
  return atts.slice(0, 10).map(a => {
    const name = a.name.replace(/[\[\]()\n`]/g, "_").slice(0, 80) || "file";
    if (a.size > maxBytes) return `📎 ${name} (${(a.size / 1048576).toFixed(1)} MB, too large to relay)`;
    if (!/^https:\/\/(cdn|media)\.discordapp\.(com|net)\//.test(a.url)) return `📎 ${name} (not relayed: unexpected link)`;
    return `📎 [${name}](${a.url})`;
  });
}

/** The relayed text: trimmed, capped, with attachment links underneath. */
export function relayBody(content: string, atts: readonly RelayAttachment[]): string {
  const text = content.trim().slice(0, MODMAIL_REPLY_MAX);
  const lines = attachmentLines(atts);
  return [text, ...lines].filter(Boolean).join("\n").slice(0, 4000) || "*(empty message)*";
}

/** A staff message in a thread that should be relayed, with the prefix removed; null otherwise. */
export function stripRelayPrefix(c: ModmailConfig, content: string): string | null {
  if (!c.relayPrefix || !content.startsWith(c.relayPrefix)) return null;
  const rest = content.slice(c.relayPrefix.length).trim();
  return rest ? rest : null;
}

/** How the member sees the reply's author. */
export function staffSignature(o: { anonymous: boolean; staffTag: string; guildName: string }): string {
  return o.anonymous ? `Staff · ${o.guildName}` : `${o.staffTag} · ${o.guildName}`;
}

/* ── Transcripts ───────────────────────────────────────────────────── */

export interface TranscriptLine {
  authorId: string;
  authorTag: string;
  fromStaff: boolean;
  anonymous: boolean;
  content: string;
  at: Date;
}

export function transcriptText(lines: readonly TranscriptLine[], header: string): string {
  const body = lines.map(l => {
    const who = l.fromStaff ? `[staff${l.anonymous ? ", anonymous" : ""}] ${l.authorTag}` : `[member] ${l.authorTag}`;
    return `${l.at.toISOString()} ${who} (${l.authorId}): ${l.content}`;
  });
  return [header, "", ...body].join("\n");
}

export function transcriptExpiry(closedAt: Date): Date {
  return new Date(closedAt.getTime() + MODMAIL_TRANSCRIPT_TTL_DAYS * 86_400_000);
}

/* ── Choosing a server ─────────────────────────────────────────────── */

export type DmRoute =
  | { kind: "relay"; guildId: string }
  | { kind: "pick"; guildIds: string[]; reason: "open" | "new" }
  | { kind: "open"; guildId: string }
  | { kind: "none" };

/**
 * Where a DM goes. An open ticket wins; with several open, the member picks.
 * Otherwise a new ticket in the one eligible server, or a pick among several.
 */
export function routeDm(openGuildIds: readonly string[], eligibleGuildIds: readonly string[]): DmRoute {
  if (openGuildIds.length === 1) return { kind: "relay", guildId: openGuildIds[0] };
  if (openGuildIds.length > 1) return { kind: "pick", guildIds: openGuildIds.slice(0, 25), reason: "open" };
  if (eligibleGuildIds.length === 1) return { kind: "open", guildId: eligibleGuildIds[0] };
  if (eligibleGuildIds.length > 1) return { kind: "pick", guildIds: eligibleGuildIds.slice(0, 25), reason: "new" };
  return { kind: "none" };
}

export const MODMAIL_PICK_ID = "mm_pick";
export const MODMAIL_REPLY_BUTTON = "mm_reply";
export const MODMAIL_REPLY_MODAL = "mm_replymodal";
export const MODMAIL_CLOSE_BUTTON = "mm_close";
export const MODMAIL_CLOSE_CONFIRM = "mm_closeyes";

export function snippetNameProblem(name: string): string | null {
  return MODMAIL_SNIPPET_NAME.test(name) ? null : "Snippet names are 1–32 lowercase letters, digits, - or _, starting with a letter or digit.";
}

/** Thread name: the member's name and the last 4 of their ID, Discord-safe. */
export function threadName(username: string, userId: string): string {
  const clean = username.replace(/[^\p{L}\p{N}_.-]/gu, "").slice(0, 80) || "member";
  return `modmail-${clean}-${userId.slice(-4)}`;
}
