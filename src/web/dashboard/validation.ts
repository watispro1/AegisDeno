/**
 * Server-side validation for every dashboard settings form. Each parser takes
 * the raw urlencoded body plus the channels and roles the bot can see, and
 * returns either a clean value ready for the matching service or a map of
 * field errors. Limits match the slash commands that set the same values.
 */
import { MAX_WARN_EXPIRY_DAYS, type GuildConfig } from "../../services/configuration";
import { MAX_TICKET_AUTOCLOSE_HOURS } from "../../services/ticketTranscript";
import { MAX_KICK_UNVERIFIED_MINUTES } from "../../services/verificationLogic";
import { renderWelcomeTemplate } from "../../services/communityLogic";

export type FormBody = Record<string, unknown>;

export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

export interface ValidationContext {
  textChannelIds: ReadonlySet<string>;
  /** Role ID → whether the bot can assign it. */
  roles: ReadonlyMap<string, { assignable: boolean }>;
}

export const SETTINGS_SECTIONS = ["logging", "escalation", "automod", "welcome", "tickets", "verification", "starboard"] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function isSettingsSection(value: unknown): value is SettingsSection {
  return typeof value === "string" && (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

export const SECTION_TITLES: Record<SettingsSection, string> = {
  logging: "Logging",
  escalation: "Escalation",
  automod: "Automod",
  welcome: "Welcome",
  tickets: "Tickets",
  verification: "Verification",
  starboard: "Starboard",
};

export const LOG_CATEGORY_LABELS: ReadonlyArray<[string, string]> = [
  ["modActions", "Moderation actions"],
  ["memberJoins", "Member joins"],
  ["memberLeaves", "Member leaves"],
  ["messageEdits", "Message edits"],
  ["messageDeletes", "Message deletes"],
  ["roleChanges", "Role changes"],
  ["channelEvents", "Channel events"],
];

export const ESCALATION_ROWS = 8;
export const MAX_TIMEOUT_MINUTES = 28 * 24 * 60;
export const AUTOMOD_ACTIONS = ["delete", "warn", "timeout"] as const;
export type AutomodAction = (typeof AUTOMOD_ACTIONS)[number];
export const WELCOME_MESSAGE_MAX = 1000;
export const CASE_REASON_MAX = 512;

/* ── Field readers ─────────────────────────────────────────────────── */

/** First value of a field as a trimmed string (urlencoded bodies can repeat keys). */
export function field(body: FormBody, key: string): string {
  const raw = body?.[key];
  const value = Array.isArray(raw) ? raw[raw.length - 1] : raw;
  return typeof value === "string" ? value.trim() : "";
}

/** Checkboxes post their value only when ticked; a hidden "0" may precede it. */
export function checkbox(body: FormBody, key: string): boolean {
  const raw = body?.[key];
  const values = Array.isArray(raw) ? raw : [raw];
  return values.some(v => v === "on" || v === "1" || v === "true");
}

class Errors {
  readonly map: Record<string, string> = {};
  add(key: string, message: string): void {
    if (!this.map[key]) this.map[key] = message;
  }
  get empty(): boolean {
    return Object.keys(this.map).length === 0;
  }
}

function integer(body: FormBody, key: string, min: number, max: number, label: string, errors: Errors, opts: { blank?: number } = {}): number {
  const raw = field(body, key);
  if (raw === "" && opts.blank !== undefined) return opts.blank;
  if (!/^-?\d{1,9}$/.test(raw)) {
    errors.add(key, `${label} must be a whole number between ${min} and ${max}.`);
    return min;
  }
  const n = Number(raw);
  if (n < min || n > max) {
    errors.add(key, `${label} must be between ${min} and ${max}.`);
    return Math.min(max, Math.max(min, n));
  }
  return n;
}

function channel(body: FormBody, key: string, ctx: ValidationContext, errors: Errors, required: boolean, label: string): string | null {
  const raw = field(body, key);
  if (raw === "") {
    if (required) errors.add(key, `Pick a ${label}.`);
    return null;
  }
  if (!ctx.textChannelIds.has(raw)) {
    errors.add(key, `That ${label} is not a text channel Aegis can see. Pick one from the list.`);
    return null;
  }
  return raw;
}

function role(body: FormBody, key: string, ctx: ValidationContext, errors: Errors, required: boolean, label: string, opts: { anyRole?: boolean } = {}): string | null {
  const raw = field(body, key);
  if (raw === "") {
    if (required) errors.add(key, `Pick a ${label}.`);
    return null;
  }
  const found = ctx.roles.get(raw);
  if (!found) {
    errors.add(key, `That ${label} does not exist in this server. Pick one from the list.`);
    return null;
  }
  if (!found.assignable && !opts.anyRole) {
    errors.add(key, `Aegis cannot assign that role. Move Aegis's role above it and make sure it has Manage Roles.`);
    return null;
  }
  return raw;
}

function finish<T>(errors: Errors, value: T): Parsed<T> {
  return errors.empty ? { ok: true, value } : { ok: false, errors: errors.map };
}

/* ── Sections ──────────────────────────────────────────────────────── */

export interface LoggingSettings {
  loggingEnabled: boolean;
  loggingChannelId: string | null;
  logCategories: Record<string, boolean>;
}

export function parseLogging(body: FormBody, ctx: ValidationContext): Parsed<LoggingSettings> {
  const errors = new Errors();
  const loggingEnabled = checkbox(body, "loggingEnabled");
  const loggingChannelId = channel(body, "loggingChannelId", ctx, errors, loggingEnabled, "log channel");
  const logCategories = Object.fromEntries(LOG_CATEGORY_LABELS.map(([key]) => [key, checkbox(body, `cat_${key}`)]));
  return finish(errors, { loggingEnabled, loggingChannelId, logCategories });
}

export type EscalationSettings = GuildConfig["escalation"];

export function parseEscalation(body: FormBody): Parsed<EscalationSettings> {
  const errors = new Errors();
  const enabled = checkbox(body, "enabled");
  const expiry = integer(body, "warnExpiryDays", 0, MAX_WARN_EXPIRY_DAYS, "Warning expiry", errors, { blank: 0 });
  const thresholds: EscalationSettings["thresholds"] = [];
  const seen = new Set<number>();

  for (let i = 0; i < ESCALATION_ROWS; i++) {
    const atRaw = field(body, `t_at_${i}`);
    const actionRaw = field(body, `t_action_${i}`);
    if (atRaw === "" && (actionRaw === "" || actionRaw === "none")) continue;

    const atWarnings = integer(body, `t_at_${i}`, 1, 100, "Warning count", errors);
    if (actionRaw !== "timeout" && actionRaw !== "kick" && actionRaw !== "ban") {
      errors.add(`t_action_${i}`, "Pick timeout, kick or ban.");
      continue;
    }
    if (seen.has(atWarnings)) {
      errors.add(`t_at_${i}`, `There is already a step at ${atWarnings} warnings.`);
      continue;
    }
    seen.add(atWarnings);

    if (actionRaw === "timeout") {
      const durationMinutes = integer(body, `t_duration_${i}`, 1, MAX_TIMEOUT_MINUTES, "Timeout length", errors);
      thresholds.push({ atWarnings, action: "timeout", durationMinutes });
    } else {
      thresholds.push({ atWarnings, action: actionRaw });
    }
  }

  if (enabled && thresholds.length === 0 && errors.empty) {
    errors.add("enabled", "Add at least one step before turning escalation on.");
  }

  thresholds.sort((a, b) => a.atWarnings - b.atWarnings);
  return finish(errors, { enabled, thresholds, warnExpiryDays: expiry === 0 ? null : expiry });
}

export interface AutomodSettings {
  words: { enabled: boolean; action: AutomodAction; list: string[] };
  links: { enabled: boolean; action: AutomodAction };
  mentions: { enabled: boolean; action: AutomodAction; threshold: number };
  spam: { enabled: boolean; action: AutomodAction; maxMessages: number; windowSeconds: number };
  caps: { enabled: boolean; action: AutomodAction; threshold: number };
  exemptRoleIds: string[];
  exemptChannelIds: string[];
}

export const AUTOMOD_WORD_MIN = 2;
export const AUTOMOD_WORD_MAX = 100;
export const AUTOMOD_WORDS_MAX_COUNT = 500;

/**
 * The blocked word list as typed: one word or phrase per line.
 * Same rules as `/automod words add`: trimmed, lower-cased, 2 to 100
 * characters. Duplicates are dropped silently.
 */
export function parseWordList(raw: string): { list: string[]; error: string | null } {
  const entries = raw.replace(/\r\n/g, "\n").split("\n").map(w => w.trim().toLowerCase()).filter(Boolean);
  const list: string[] = [];
  for (const word of entries) {
    if (word.length < AUTOMOD_WORD_MIN || word.length > AUTOMOD_WORD_MAX) {
      return { list, error: `Each blocked word must be ${AUTOMOD_WORD_MIN} to ${AUTOMOD_WORD_MAX} characters ("${word.slice(0, 30)}" is ${word.length}).` };
    }
    if (!list.includes(word)) list.push(word);
  }
  if (list.length > AUTOMOD_WORDS_MAX_COUNT) return { list, error: `Keep the list to ${AUTOMOD_WORDS_MAX_COUNT} words or fewer (it has ${list.length}).` };
  return { list, error: null };
}

/** Every value of a repeated field (checkbox groups), trimmed, without blanks. */
export function fieldValues(body: FormBody, key: string): string[] {
  const raw = body?.[key];
  const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  return values.filter((v): v is string => typeof v === "string").map(v => v.trim()).filter(Boolean);
}

/**
 * IDs ticked in a checkbox group. Each must be one Aegis can see now, or one
 * that was already saved (so a channel type the picker does not list, or a
 * role Aegis cannot see right now, is kept rather than rejected).
 */
function pickedIds(body: FormBody, key: string, known: (id: string) => boolean, previous: readonly string[], what: string, errors: Errors, max = 100): string[] {
  const out: string[] = [];
  for (const id of fieldValues(body, key)) {
    if (!/^\d{17,20}$/.test(id) || (!known(id) && !previous.includes(id))) {
      errors.add(key, `One of the ${what} is not in this server any more. Reload the page and pick again.`);
      continue;
    }
    if (!out.includes(id)) out.push(id);
  }
  if (out.length > max) errors.add(key, `Pick at most ${max} ${what}.`);
  return out;
}

function automodAction(body: FormBody, key: string, errors: Errors): AutomodAction {
  const raw = field(body, key);
  if ((AUTOMOD_ACTIONS as readonly string[]).includes(raw)) return raw as AutomodAction;
  errors.add(key, "Pick delete, warn or timeout.");
  return "delete";
}

export function parseAutomod(
  body: FormBody,
  ctx: ValidationContext,
  previous: { exemptRoleIds: readonly string[]; exemptChannelIds: readonly string[] } = { exemptRoleIds: [], exemptChannelIds: [] },
): Parsed<AutomodSettings> {
  const errors = new Errors();
  const rawWords = typeof body?.words_list === "string" ? body.words_list : "";
  const words = parseWordList(rawWords);
  if (words.error) errors.add("words_list", words.error);
  const value: AutomodSettings = {
    words: { enabled: checkbox(body, "words_enabled"), action: automodAction(body, "words_action", errors), list: words.list },
    links: { enabled: checkbox(body, "links_enabled"), action: automodAction(body, "links_action", errors) },
    mentions: {
      enabled: checkbox(body, "mentions_enabled"),
      action: automodAction(body, "mentions_action", errors),
      threshold: integer(body, "mentions_threshold", 2, 50, "Mention limit", errors),
    },
    spam: {
      enabled: checkbox(body, "spam_enabled"),
      action: automodAction(body, "spam_action", errors),
      maxMessages: integer(body, "spam_maxMessages", 2, 30, "Message limit", errors),
      windowSeconds: integer(body, "spam_windowSeconds", 2, 60, "Time window", errors),
    },
    caps: {
      enabled: checkbox(body, "caps_enabled"),
      action: automodAction(body, "caps_action", errors),
      threshold: integer(body, "caps_threshold", 50, 100, "Capitals percentage", errors),
    },
    exemptRoleIds: pickedIds(body, "exempt_roles", id => ctx.roles.has(id), previous.exemptRoleIds, "exempt roles", errors),
    exemptChannelIds: pickedIds(body, "exempt_channels", id => ctx.textChannelIds.has(id), previous.exemptChannelIds, "exempt channels", errors),
  };
  return finish(errors, value);
}

export interface WelcomeSettings {
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeMessage: string;
  welcomeRoleId: string | null;
}

export function parseWelcome(body: FormBody, ctx: ValidationContext): Parsed<WelcomeSettings> {
  const errors = new Errors();
  const welcomeEnabled = checkbox(body, "welcomeEnabled");
  const welcomeChannelId = channel(body, "welcomeChannelId", ctx, errors, welcomeEnabled, "welcome channel");
  // Keep the message's own line breaks; only trim the ends.
  const rawMessage = body?.welcomeMessage;
  const welcomeMessage = (typeof rawMessage === "string" ? rawMessage : "").replace(/\r\n/g, "\n").trim();
  if (welcomeMessage === "") errors.add("welcomeMessage", "Write a welcome message.");
  else if (welcomeMessage.length > WELCOME_MESSAGE_MAX) {
    errors.add("welcomeMessage", `Keep the message under ${WELCOME_MESSAGE_MAX} characters (it is ${welcomeMessage.length}).`);
  }
  const welcomeRoleId = role(body, "welcomeRoleId", ctx, errors, false, "join role");
  return finish(errors, { welcomeEnabled, welcomeChannelId, welcomeMessage, welcomeRoleId });
}

/** The welcome text as it would look for `username`; mentions are shown as plain @names. */
export function welcomePreview(template: string, sample: { username: string; serverName: string; memberCount: number | null }): string {
  const marker = "\u0000user\u0000";
  return renderWelcomeTemplate(template, { userId: marker, username: sample.username, serverName: sample.serverName, memberCount: sample.memberCount })
    .split(`<@${marker}>`)
    .join(`@${sample.username}`);
}

export interface TicketSettingsInput {
  logChannelId: string | null;
  autoCloseHours: number;
  transcriptLogging: boolean;
}

export function parseTickets(body: FormBody, ctx: ValidationContext): Parsed<TicketSettingsInput> {
  const errors = new Errors();
  const transcriptLogging = checkbox(body, "transcriptLogging");
  const logChannelId = channel(body, "logChannelId", ctx, errors, false, "transcript channel");
  const autoCloseHours = integer(body, "autoCloseHours", 0, MAX_TICKET_AUTOCLOSE_HOURS, "Auto-close", errors);
  return finish(errors, { logChannelId, autoCloseHours, transcriptLogging });
}

export interface VerificationSettingsInput {
  enabled: boolean;
  verifiedRoleId: string;
  type: "button" | "captcha";
  kickUnverifiedMinutes: number;
}

export function parseVerification(body: FormBody, ctx: ValidationContext): Parsed<VerificationSettingsInput> {
  const errors = new Errors();
  const enabled = checkbox(body, "enabled");
  const verifiedRoleId = role(body, "verifiedRoleId", ctx, errors, true, "verified role") ?? "";
  const typeRaw = field(body, "type");
  if (typeRaw !== "button" && typeRaw !== "captcha") errors.add("type", "Pick button or captcha.");
  const kickUnverifiedMinutes = integer(body, "kickUnverifiedMinutes", 0, MAX_KICK_UNVERIFIED_MINUTES, "Auto-kick delay", errors, { blank: 0 });
  return finish(errors, {
    enabled,
    verifiedRoleId,
    type: typeRaw === "captcha" ? "captcha" : "button",
    kickUnverifiedMinutes,
  });
}

export interface StarboardSettingsInput {
  enabled: boolean;
  channelId: string | null;
  threshold: number;
  selfStar: boolean;
  emoji: string;
  ignoredChannels: string[];
  ignoredRoles: string[];
}

/** A custom emoji (<:name:id> or <a:name:id>) or one Unicode emoji, as `/starboard emoji` takes. */
export function isStarboardEmoji(value: string): boolean {
  if (/^<a?:\w{2,32}:\d{17,20}>$/.test(value)) return true;
  if (value.length === 0 || value.length > 16 || /\s/.test(value)) return false;
  return /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]\uFE0F?\u20E3)/u.test(value) && !/[A-Za-z<>]/.test(value);
}

export function parseStarboard(
  body: FormBody,
  ctx: ValidationContext,
  previous: { ignoredChannels: readonly string[]; ignoredRoles: readonly string[] } = { ignoredChannels: [], ignoredRoles: [] },
): Parsed<StarboardSettingsInput> {
  const errors = new Errors();
  const enabled = checkbox(body, "enabled");
  const channelId = channel(body, "channelId", ctx, errors, enabled, "starboard channel");
  const threshold = integer(body, "threshold", 1, 100, "Star threshold", errors);
  const selfStar = checkbox(body, "selfStar");
  const emoji = field(body, "emoji") || "⭐";
  if (!isStarboardEmoji(emoji)) errors.add("emoji", "Use one emoji, such as ⭐ or 🌟, or a custom emoji written as <:name:id>.");
  const ignoredChannels = pickedIds(body, "ignoredChannels", id => ctx.textChannelIds.has(id), previous.ignoredChannels, "ignored channels", errors);
  const ignoredRoles = pickedIds(body, "ignoredRoles", id => ctx.roles.has(id), previous.ignoredRoles, "ignored roles", errors);
  return finish(errors, { enabled, channelId, threshold, selfStar, emoji, ignoredChannels, ignoredRoles });
}

/* ── Cases ─────────────────────────────────────────────────────────── */

export function parseCaseReason(body: FormBody): Parsed<string> {
  const reason = field(body, "reason");
  if (reason === "") return { ok: false, errors: { reason: "Write a reason." } };
  if (reason.length > CASE_REASON_MAX) {
    return { ok: false, errors: { reason: `Keep the reason under ${CASE_REASON_MAX} characters (it is ${reason.length}).` } };
  }
  return { ok: true, value: reason };
}

export const CASE_TYPES = ["warn", "kick", "ban", "timeout", "untimeout", "unban", "clearwarnings", "purge", "lock", "unlock"] as const;

export interface CaseFilter {
  type: string | null;
  userId: string | null;
  moderatorId: string | null;
  /** Case-insensitive text the reason must contain. */
  query?: string | null;
  page: number;
}

export const CASE_QUERY_MAX = 100;

/** Filters from the query string. Anything malformed is dropped rather than rejected. */
export function parseCaseFilter(query: Record<string, unknown>): CaseFilter {
  const pick = (key: string) => {
    const raw = query?.[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === "string" ? value.trim() : "";
  };
  // Accept a pasted mention (<@123> or <@!123>) as well as a bare ID.
  const id = (value: string) => value.replace(/^<@!?(\d+)>$/, "$1");
  const type = pick("type");
  const user = id(pick("user"));
  const mod = id(pick("moderator"));
  const page = Number(pick("page"));
  const q = pick("q").replace(/\s+/g, " ").slice(0, CASE_QUERY_MAX);
  return {
    type: (CASE_TYPES as readonly string[]).includes(type) ? type : null,
    userId: /^\d{17,20}$/.test(user) ? user : null,
    moderatorId: /^\d{17,20}$/.test(mod) ? mod : null,
    query: q || null,
    page: Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1,
  };
}

/** Revoke form: whether to also lift the ban in Discord. */
export function parseRevoke(body: FormBody): { unban: boolean } {
  return { unban: checkbox(body, "unban") };
}

/* ── Panels ────────────────────────────────────────────────────────── */

export const PANEL_TITLE_MAX = 100;
export const TICKET_PANEL_DESCRIPTION_MAX = 2000;
export const VERIFY_PANEL_DESCRIPTION_MAX = 2000;

export interface TicketPanelInput {
  channelId: string;
  staffRoleId: string | null;
  title: string | null;
  description: string | null;
}

function text(body: FormBody, key: string, max: number, label: string, errors: Errors): string | null {
  const raw = body?.[key];
  const value = (typeof raw === "string" ? raw : "").replace(/\r\n/g, "\n").trim();
  if (value.length > max) errors.add(key, `Keep the ${label} under ${max} characters (it is ${value.length}).`);
  return value || null;
}

export function parseTicketPanel(body: FormBody, ctx: ValidationContext): Parsed<TicketPanelInput> {
  const errors = new Errors();
  const channelId = channel(body, "channelId", ctx, errors, true, "channel") ?? "";
  const staffRoleId = role(body, "staffRoleId", ctx, errors, false, "staff role", { anyRole: true });
  const title = text(body, "title", PANEL_TITLE_MAX, "title", errors);
  const description = text(body, "description", TICKET_PANEL_DESCRIPTION_MAX, "description", errors);
  return finish(errors, { channelId, staffRoleId, title, description });
}

export interface VerificationPanelInput {
  channelId: string;
  verifiedRoleId: string;
  type: "button" | "captcha";
  kickUnverifiedMinutes: number;
  title: string | null;
  description: string | null;
}

export function parseVerificationPanel(body: FormBody, ctx: ValidationContext): Parsed<VerificationPanelInput> {
  const errors = new Errors();
  const channelId = channel(body, "channelId", ctx, errors, true, "channel") ?? "";
  const verifiedRoleId = role(body, "verifiedRoleId", ctx, errors, true, "verified role") ?? "";
  const typeRaw = field(body, "type");
  if (typeRaw !== "button" && typeRaw !== "captcha") errors.add("type", "Pick button or captcha.");
  const kickUnverifiedMinutes = integer(body, "kickUnverifiedMinutes", 0, MAX_KICK_UNVERIFIED_MINUTES, "Auto-kick delay", errors, { blank: 0 });
  const title = text(body, "title", PANEL_TITLE_MAX, "title", errors);
  const description = text(body, "description", VERIFY_PANEL_DESCRIPTION_MAX, "description", errors);
  return finish(errors, { channelId, verifiedRoleId, type: typeRaw === "captcha" ? "captcha" : "button", kickUnverifiedMinutes, title, description });
}

export function parseRolePanelRepost(body: FormBody, ctx: ValidationContext): Parsed<{ channelId: string }> {
  const errors = new Errors();
  const channelId = channel(body, "channelId", ctx, errors, true, "channel") ?? "";
  return finish(errors, { channelId });
}

/* ── Appeals ───────────────────────────────────────────────────────── */

export const APPEAL_FILTERS = ["pending", "approved", "denied", "expired", "all"] as const;
export type AppealFilter = (typeof APPEAL_FILTERS)[number];

export function parseAppealFilter(query: Record<string, unknown>): { status: AppealFilter; page: number } {
  const raw = query?.status;
  const value = typeof raw === "string" ? raw : "";
  const page = Number(typeof query?.page === "string" ? query.page : "");
  return {
    status: (APPEAL_FILTERS as readonly string[]).includes(value) ? (value as AppealFilter) : "pending",
    page: Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1,
  };
}

export const APPEAL_REVIEW_NOTE_MAX = 512;

export function parseAppealReview(body: FormBody): Parsed<{ decision: "approved" | "denied"; note: string | null }> {
  const errors = new Errors();
  const decisionRaw = field(body, "decision");
  if (decisionRaw !== "approved" && decisionRaw !== "denied") errors.add("decision", "Pick approve or deny.");
  const note = text(body, "note", APPEAL_REVIEW_NOTE_MAX, "note", errors);
  return finish(errors, { decision: decisionRaw === "approved" ? "approved" : "denied", note });
}
