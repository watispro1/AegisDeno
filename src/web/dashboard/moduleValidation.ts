/**
 * Validation for the module pages and the embed builder. Same conventions as
 * validation.ts: every reader takes the raw urlencoded body, nothing is
 * trusted, and errors are keyed by field name so the form can point at them.
 * Limits match Discord's (services/embedSpec.ts).
 */
import { EMBED_BUILDER_FIELDS, EMBED_LIMITS, embedIsEmpty, embedLength, safeEmbedUrl, type EmbedSpec } from "../../services/embedSpec";
import { GOODBYE_MESSAGE_MAX } from "../../services/configuration";
import { parseFriendlyDuration } from "../../utils/duration";
import { Errors, channel, checkbox, field, finish, type FormBody, type Parsed, type ValidationContext } from "./validation";
import type { MatchType, SuggestionFilter } from "./moduleData";

/** A textarea's value with its own line breaks kept (CRLF folded), ends trimmed. */
export function multiline(body: FormBody, key: string): string {
  const raw = body?.[key];
  const value = Array.isArray(raw) ? raw[raw.length - 1] : raw;
  return (typeof value === "string" ? value : "").replace(/\r\n/g, "\n").trim();
}

function limited(body: FormBody, key: string, max: number, label: string, errors: Errors, multi = false): string | null {
  const v = multi ? multiline(body, key) : field(body, key);
  if (v.length > max) errors.add(key, `${label} can be at most ${max.toLocaleString("en-US")} characters (it is ${v.length.toLocaleString("en-US")}).`);
  return v ? v.slice(0, max) : null;
}

/** "#5865f2" / "5865F2" → 0x5865f2; blank → null. */
export function parseColor(raw: string): number | null | "bad" {
  const s = raw.trim().replace(/^#/, "");
  if (!s) return null;
  return /^[0-9a-f]{6}$/i.test(s) ? parseInt(s, 16) : "bad";
}

/**
 * The embed builder's fields under `p` (e_title, e_description, …, e_fname_0).
 * Returns null when every field is blank. Field rows need both a name and a
 * value; a half-filled row is an error rather than silently dropped.
 */
export function readEmbed(body: FormBody, p: string, errors: Errors): EmbedSpec | null {
  const color = parseColor(field(body, `${p}color`));
  if (color === "bad") errors.add(`${p}color`, "Colour must be a hex code such as #5865F2.");
  const url = (key: string, label: string): string | null => {
    const raw = field(body, key);
    if (!raw) return null;
    const ok = safeEmbedUrl(raw);
    if (!ok) errors.add(key, `${label} must be a full https:// link to an image.`);
    return ok;
  };
  const fields: EmbedSpec["fields"] = [];
  for (let i = 0; i < EMBED_BUILDER_FIELDS; i++) {
    const name = limited(body, `${p}fname_${i}`, EMBED_LIMITS.fieldName, `Field ${i + 1} name`, errors);
    const value = limited(body, `${p}fvalue_${i}`, EMBED_LIMITS.fieldValue, `Field ${i + 1} value`, errors, true);
    if (!name && !value) continue;
    if (!name) { errors.add(`${p}fname_${i}`, `Field ${i + 1} needs a name as well as a value.`); continue; }
    if (!value) { errors.add(`${p}fvalue_${i}`, `Field ${i + 1} needs a value as well as a name.`); continue; }
    fields.push({ name, value, inline: checkbox(body, `${p}finline_${i}`) });
  }
  const spec: EmbedSpec = {
    title: limited(body, `${p}title`, EMBED_LIMITS.title, "Title", errors),
    description: limited(body, `${p}description`, EMBED_LIMITS.description, "Description", errors, true),
    color: color === "bad" ? null : color,
    authorName: limited(body, `${p}author`, EMBED_LIMITS.author, "Author", errors),
    footerText: limited(body, `${p}footer`, EMBED_LIMITS.footer, "Footer", errors),
    imageUrl: url(`${p}image`, "Image"),
    thumbnailUrl: url(`${p}thumbnail`, "Thumbnail"),
    fields,
  };
  if (embedIsEmpty(spec)) return null;
  const total = embedLength(spec);
  if (total > EMBED_LIMITS.total) errors.add(`${p}description`, `Discord allows ${EMBED_LIMITS.total.toLocaleString("en-US")} characters across the whole embed; this one has ${total.toLocaleString("en-US")}.`);
  return spec;
}

/* ── Announcements ─────────────────────────────────────────────────── */

export interface AnnouncementInput {
  channelId: string;
  content: string | null;
  embed: EmbedSpec;
}

export function parseAnnouncement(body: FormBody, ctx: ValidationContext): Parsed<AnnouncementInput> {
  const errors = new Errors();
  const channelId = channel(body, "channelId", ctx, errors, true, "channel");
  const content = limited(body, "content", EMBED_LIMITS.content, "Message text", errors, true);
  const embed = readEmbed(body, "e_", errors);
  if (!embed) errors.add("e_title", "Give the embed at least a title, a description, a field or an image.");
  return finish(errors, { channelId: channelId ?? "", content, embed: embed as EmbedSpec });
}

/* ── Goodbye and the welcome embed ─────────────────────────────────── */

export interface GoodbyeSettings {
  goodbyeEnabled: boolean;
  goodbyeChannelId: string | null;
  goodbyeMessage: string;
  goodbyeEmbed: EmbedSpec | null;
}

export function parseGoodbye(body: FormBody, ctx: ValidationContext): Parsed<GoodbyeSettings> {
  const errors = new Errors();
  const goodbyeEnabled = checkbox(body, "goodbyeEnabled");
  const goodbyeChannelId = channel(body, "goodbyeChannelId", ctx, errors, goodbyeEnabled, "goodbye channel");
  const goodbyeMessage = multiline(body, "goodbyeMessage");
  if (goodbyeMessage.length > GOODBYE_MESSAGE_MAX) errors.add("goodbyeMessage", `Keep the message under ${GOODBYE_MESSAGE_MAX} characters (it is ${goodbyeMessage.length}).`);
  const goodbyeEmbed = checkbox(body, "ge_on") ? readEmbed(body, "ge_", errors) : null;
  if (goodbyeEnabled && !goodbyeMessage && !goodbyeEmbed) errors.add("goodbyeMessage", "Write a goodbye message or turn on the embed.");
  return finish(errors, { goodbyeEnabled, goodbyeChannelId, goodbyeMessage: goodbyeMessage.slice(0, GOODBYE_MESSAGE_MAX), goodbyeEmbed });
}

/** The welcome section's optional embed (we_ prefix, switched on by we_on). */
export function parseWelcomeEmbed(body: FormBody, errors: Errors = new Errors()): EmbedSpec | null {
  return checkbox(body, "we_on") ? readEmbed(body, "we_", errors) : null;
}

/** Per-category log channel overrides (chan_<category>); blank means the main channel. */
export function parseLogChannels(body: FormBody, ctx: ValidationContext, categories: readonly string[], errors: Errors): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const key of categories) {
    const id = channel(body, `chan_${key}`, ctx, errors, false, "log channel");
    if (id) out[key] = id;
  }
  return Object.keys(out).length ? out : null;
}

/* ── Autoresponders ────────────────────────────────────────────────── */

export const AUTORESPONDER_TRIGGER_MAX = 100;
export const AUTORESPONDER_RESPONSE_MAX = 2000;
const MATCH_TYPES: readonly MatchType[] = ["contains", "exact", "startsWith"];

export function parseAutoResponder(body: FormBody): Parsed<{ trigger: string; response: string; matchType: MatchType }> {
  const errors = new Errors();
  const trigger = field(body, "trigger");
  if (trigger.length < 1) errors.add("trigger", "Type the text that triggers the response.");
  else if (trigger.length > AUTORESPONDER_TRIGGER_MAX) errors.add("trigger", `Keep the trigger under ${AUTORESPONDER_TRIGGER_MAX} characters.`);
  const response = multiline(body, "response");
  if (!response) errors.add("response", "Write the response Aegis sends.");
  else if (response.length > AUTORESPONDER_RESPONSE_MAX) errors.add("response", `Keep the response under ${AUTORESPONDER_RESPONSE_MAX} characters (it is ${response.length}).`);
  const rawType = field(body, "matchType");
  const matchType = (MATCH_TYPES as readonly string[]).includes(rawType) ? rawType as MatchType : null;
  if (!matchType) errors.add("matchType", "Pick how the trigger is matched.");
  return finish(errors, { trigger, response, matchType: matchType ?? "contains" });
}

/** Responder IDs as minted by addAutoResponder ("ar-" + UUID). */
export function isResponderId(id: string): boolean {
  return /^ar-[0-9a-f-]{1,64}$/i.test(id);
}

/* ── Scheduled messages ────────────────────────────────────────────── */

export const SCHEDULED_MESSAGE_MAX = 2000;
const MIN_DELAY_S = 60;
const MAX_DELAY_S = 28 * 86_400;

export function parseAutomation(body: FormBody, ctx: ValidationContext): Parsed<{ channelId: string; message: string; delayMs: number; intervalMs: number | null }> {
  const errors = new Errors();
  const channelId = channel(body, "channelId", ctx, errors, true, "channel");
  const message = multiline(body, "message");
  if (!message) errors.add("message", "Write the message to post.");
  else if (message.length > SCHEDULED_MESSAGE_MAX) errors.add("message", `Keep the message under ${SCHEDULED_MESSAGE_MAX} characters (it is ${message.length}).`);
  const delay = parseFriendlyDuration(field(body, "delay"));
  if (delay === null || delay < MIN_DELAY_S || delay > MAX_DELAY_S) errors.add("delay", "Post it in 1 minute to 28 days, such as 30m, 2h or 1d 12h.");
  const rawRepeat = field(body, "repeat");
  let intervalMs: number | null = null;
  if (rawRepeat) {
    const repeat = parseFriendlyDuration(rawRepeat);
    if (repeat === null || repeat < 10 * 60 || repeat > MAX_DELAY_S) errors.add("repeat", "Repeat every 10 minutes to 28 days, or leave it blank to post once.");
    else intervalMs = repeat * 1000;
  }
  return finish(errors, { channelId: channelId ?? "", message, delayMs: (delay ?? 0) * 1000, intervalMs });
}

/** Task IDs are Mongo ObjectIds. */
export function isTaskId(id: string): boolean {
  return /^[0-9a-f]{24}$/i.test(id);
}

/* ── Giveaways, suggestions, watchlist ─────────────────────────────── */

export function isMessageId(id: string): boolean {
  return /^\d{17,20}$/.test(id);
}

export function isSuggestionId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export const SUGGESTION_NOTE_MAX = 1000;

export function parseSuggestionReview(body: FormBody): Parsed<{ action: "approve" | "deny" | "consider"; note: string | null }> {
  const errors = new Errors();
  const raw = field(body, "action");
  const action = raw === "approve" || raw === "deny" || raw === "consider" ? raw : null;
  if (!action) errors.add("action", "Pick approve, consider or deny.");
  const note = multiline(body, "note");
  if (note.length > SUGGESTION_NOTE_MAX) errors.add("note", `Keep the note under ${SUGGESTION_NOTE_MAX} characters.`);
  return finish(errors, { action: action ?? "consider", note: note || null });
}

export const SUGGESTION_FILTERS: readonly SuggestionFilter[] = ["open", "approved", "rejected", "all"];

export function parseSuggestionFilter(query: Record<string, unknown>): { filter: SuggestionFilter; page: number } {
  const f = typeof query.status === "string" ? query.status : "";
  const p = typeof query.page === "string" && /^\d{1,4}$/.test(query.page) ? Math.max(1, Number(query.page)) : 1;
  return { filter: (SUGGESTION_FILTERS as readonly string[]).includes(f) ? f as SuggestionFilter : "open", page: p };
}

/** The suggestions channel picker on the Suggestions page (/suggest setup). */
export function parseSuggestionChannel(body: FormBody, ctx: ValidationContext): Parsed<{ suggestionsChannelId: string | null }> {
  const errors = new Errors();
  const suggestionsChannelId = channel(body, "suggestionsChannelId", ctx, errors, false, "suggestions channel");
  return finish(errors, { suggestionsChannelId });
}
