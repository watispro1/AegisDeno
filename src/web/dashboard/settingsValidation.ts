/**
 * Validation for the settings sections (logging, escalation, welcome, tickets,
 * verification, starboard). Each parser takes the raw urlencoded body plus the
 * channels and roles the bot can see, and returns either a clean value ready
 * for the matching service or a map of field errors. Limits match the slash
 * commands that set the same values. Automod has its own module.
 */
import { MAX_WARN_EXPIRY_DAYS, type GuildConfig } from "../../services/configuration";
import { MAX_TICKET_AUTOCLOSE_HOURS } from "../../services/ticketTranscript";
import { MAX_KICK_UNVERIFIED_MINUTES } from "../../services/verificationLogic";
import { renderWelcomeTemplate } from "../../services/communityLogic";
import type { EmbedSpec } from "../../services/embedSpec";
import { Errors, channel, checkbox, field, finish, integer, pickedIds, role, type FormBody, type Parsed, type ValidationContext } from "./formFields";

export const SETTINGS_SECTIONS = ["logging", "escalation", "automod", "welcome", "tickets", "verification", "starboard", "goodbye"] as const;
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
  goodbye: "Goodbye",
};

export const LOG_CATEGORY_LABELS: ReadonlyArray<[string, string]> = [
  ["modActions", "Moderation actions"],
  ["memberJoins", "Member joins"],
  ["memberLeaves", "Member leaves"],
  ["messageEdits", "Message edits"],
  ["messageDeletes", "Message deletes"],
  ["roleChanges", "Role changes"],
  ["channelEvents", "Channel events"],
  ["voiceEvents", "Voice activity"],
];

export const ESCALATION_ROWS = 8;
export const MAX_TIMEOUT_MINUTES = 28 * 24 * 60;
export const WELCOME_MESSAGE_MAX = 1000;

export interface LoggingSettings {
  loggingEnabled: boolean;
  loggingChannelId: string | null;
  logCategories: Record<string, boolean>;
  /** Per-category channel overrides (dashboard only); absent keeps what is saved. */
  logChannels?: Record<string, string> | null;
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

export interface WelcomeSettings {
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeMessage: string;
  welcomeRoleId: string | null;
  /** Optional embed sent with the message (dashboard only); absent keeps what is saved. */
  welcomeEmbed?: EmbedSpec | null;
}

export function parseWelcome(body: FormBody, ctx: ValidationContext, saved: { welcomeRoleId?: string | null } = {}): Parsed<WelcomeSettings> {
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
  const welcomeRoleId = role(body, "welcomeRoleId", ctx, errors, false, "join role", { saved: saved.welcomeRoleId ?? null });
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

export function parseVerification(body: FormBody, ctx: ValidationContext, saved: { verifiedRoleId?: string | null } = {}): Parsed<VerificationSettingsInput> {
  const errors = new Errors();
  const enabled = checkbox(body, "enabled");
  const verifiedRoleId = role(body, "verifiedRoleId", ctx, errors, true, "verified role", { saved: saved.verifiedRoleId ?? null }) ?? "";
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
  if (value.length === 0 || value.length > 32) return false;
  // The whole value must be exactly one emoji sequence, so "⭐1" or "⭐x" is refused.
  return SINGLE_EMOJI.test(value);
}

/** One pictograph with optional variation selector / skin tone. */
const EMOJI_PART = String.raw`\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?`;
/**
 * Exactly one Unicode emoji sequence: a keycap, a flag (one or two regional
 * indicators), or pictographs joined by ZWJ with an optional tag sequence
 * (subdivision flags such as England).
 */
const SINGLE_EMOJI = new RegExp(
  String.raw`^(?:[#*0-9]\uFE0F?\u20E3|\p{Regional_Indicator}{1,2}|${EMOJI_PART}(?:\u200D${EMOJI_PART})*(?:[\u{E0020}-\u{E007E}]+\u{E007F})?)$`,
  "u",
);

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
