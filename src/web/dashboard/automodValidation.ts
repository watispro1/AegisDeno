/**
 * Automod form validation: the rules, the blocked word list, the global
 * exemptions, and one rule's own exemptions (the per-rule form).
 */
import { Errors, checkbox, field, finish, integer, pickedIds, type FormBody, type Parsed, type ValidationContext } from "./formFields";
import { MAX_ALLOWLIST, MAX_AUTOMOD_TIMEOUT_MINUTES, cleanDomain, cleanInviteCode } from "../../services/automod";

export const AUTOMOD_ACTIONS = ["delete", "warn", "timeout"] as const;
export type AutomodAction = (typeof AUTOMOD_ACTIONS)[number];

export interface AutomodSettings {
  words: { enabled: boolean; action: AutomodAction; list: string[] };
  links: { enabled: boolean; action: AutomodAction; allowedDomains: string[] };
  invites: { enabled: boolean; action: AutomodAction; allowedCodes: string[] };
  mentions: { enabled: boolean; action: AutomodAction; threshold: number };
  spam: { enabled: boolean; action: AutomodAction; maxMessages: number; windowSeconds: number };
  duplicates: { enabled: boolean; action: AutomodAction; maxRepeats: number; windowSeconds: number };
  caps: { enabled: boolean; action: AutomodAction; threshold: number };
  emoji: { enabled: boolean; action: AutomodAction; maxEmoji: number; zalgo: boolean };
  timeoutMinutes: number;
  exemptRoleIds: string[];
  exemptChannelIds: string[];
}

export const AUTOMOD_WORD_MIN = 2;
export const AUTOMOD_WORD_MAX = 100;
export const AUTOMOD_WORDS_MAX_COUNT = 500;
/**
 * Longest blocked-word text the dashboard accepts: the advertised maximum list
 * (500 entries of 100 characters) plus a CRLF line break after each one.
 */
export const AUTOMOD_WORDS_TEXT_MAX = AUTOMOD_WORDS_MAX_COUNT * (AUTOMOD_WORD_MAX + 2);

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

/** Same bounds as the /automod limit subcommands and normalizeAutomodConfig. */
export const AUTOMOD_BOUNDS = {
  mentions: { min: 2, max: 50 },
  spamMessages: { min: 2, max: 30 },
  spamWindow: { min: 2, max: 60 },
  duplicatesRepeats: { min: 2, max: 10 },
  duplicatesWindow: { min: 10, max: 600 },
  caps: { min: 50, max: 100 },
  emoji: { min: 3, max: 50 },
  timeout: { min: 1, max: MAX_AUTOMOD_TIMEOUT_MINUTES },
} as const;

/** Allowed-list fields: what one line may be before cleaning (the slash options' max lengths). */
export const ALLOWED_DOMAIN_LINE_MAX = 253;
export const ALLOWED_INVITE_LINE_MAX = 100;
export const ALLOWED_LIST_MAX_COUNT = MAX_ALLOWLIST;
export const ALLOWED_DOMAINS_TEXT_MAX = ALLOWED_LIST_MAX_COUNT * (ALLOWED_DOMAIN_LINE_MAX + 2);
export const ALLOWED_INVITES_TEXT_MAX = ALLOWED_LIST_MAX_COUNT * (ALLOWED_INVITE_LINE_MAX + 2);

interface AllowListSpec {
  clean: (raw: unknown) => string | null;
  lineMax: number;
  textMax: number;
  /** What a bad line is called in the error, e.g. "domain". */
  noun: string;
  example: string;
}

const DOMAIN_LIST: AllowListSpec = { clean: cleanDomain, lineMax: ALLOWED_DOMAIN_LINE_MAX, textMax: ALLOWED_DOMAINS_TEXT_MAX, noun: "domain", example: "youtube.com" };
const INVITE_LIST: AllowListSpec = { clean: cleanInviteCode, lineMax: ALLOWED_INVITE_LINE_MAX, textMax: ALLOWED_INVITES_TEXT_MAX, noun: "invite", example: "discord.gg/partner" };

/**
 * An allowed list as typed: one entry per line, each cleaned the same way as
 * /automod links allow and /automod invites allow (so pasted URLs work).
 * Duplicates are dropped, ignoring case like the slash commands do.
 */
function parseAllowList(raw: string, spec: AllowListSpec): { list: string[]; error: string | null } {
  if (raw.length > spec.textMax) return { list: [], error: `The allowed ${spec.noun} list is too long. Keep it to ${ALLOWED_LIST_MAX_COUNT} entries.` };
  const entries = raw.replace(/\r\n/g, "\n").split("\n").map(line => line.trim()).filter(Boolean);
  const list: string[] = [];
  for (const line of entries) {
    const cleaned = line.length <= spec.lineMax ? spec.clean(line) : null;
    if (!cleaned) return { list, error: `"${line.slice(0, 40)}" doesn't look like ${spec.noun === "invite" ? "an invite" : "a domain"}. Use one per line, like ${spec.example}.` };
    if (!list.some(v => v.toLowerCase() === cleaned.toLowerCase())) list.push(cleaned);
  }
  if (list.length > ALLOWED_LIST_MAX_COUNT) return { list, error: `Keep the list to ${ALLOWED_LIST_MAX_COUNT} ${spec.noun}s or fewer (it has ${list.length}).` };
  return { list, error: null };
}

export const parseDomainList = (raw: string) => parseAllowList(raw, DOMAIN_LIST);
export const parseInviteList = (raw: string) => parseAllowList(raw, INVITE_LIST);

function allowList(body: FormBody, key: string, parse: (raw: string) => { list: string[]; error: string | null }, errors: Errors): string[] {
  const raw = body?.[key];
  const r = parse(typeof raw === "string" ? raw : "");
  if (r.error) errors.add(key, r.error);
  return r.list;
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
  const words = rawWords.length > AUTOMOD_WORDS_TEXT_MAX
    ? { list: [] as string[], error: `The blocked word list is too long. Keep it to ${AUTOMOD_WORDS_MAX_COUNT} words of up to ${AUTOMOD_WORD_MAX} characters.` }
    : parseWordList(rawWords);
  if (words.error) errors.add("words_list", words.error);
  const b = AUTOMOD_BOUNDS;
  const value: AutomodSettings = {
    words: { enabled: checkbox(body, "words_enabled"), action: automodAction(body, "words_action", errors), list: words.list },
    links: {
      enabled: checkbox(body, "links_enabled"),
      action: automodAction(body, "links_action", errors),
      allowedDomains: allowList(body, "links_allowedDomains", parseDomainList, errors),
    },
    invites: {
      enabled: checkbox(body, "invites_enabled"),
      action: automodAction(body, "invites_action", errors),
      allowedCodes: allowList(body, "invites_allowedCodes", parseInviteList, errors),
    },
    mentions: {
      enabled: checkbox(body, "mentions_enabled"),
      action: automodAction(body, "mentions_action", errors),
      threshold: integer(body, "mentions_threshold", b.mentions.min, b.mentions.max, "Mention limit", errors),
    },
    spam: {
      enabled: checkbox(body, "spam_enabled"),
      action: automodAction(body, "spam_action", errors),
      maxMessages: integer(body, "spam_maxMessages", b.spamMessages.min, b.spamMessages.max, "Message limit", errors),
      windowSeconds: integer(body, "spam_windowSeconds", b.spamWindow.min, b.spamWindow.max, "Time window", errors),
    },
    duplicates: {
      enabled: checkbox(body, "duplicates_enabled"),
      action: automodAction(body, "duplicates_action", errors),
      maxRepeats: integer(body, "duplicates_maxRepeats", b.duplicatesRepeats.min, b.duplicatesRepeats.max, "Identical messages allowed", errors),
      windowSeconds: integer(body, "duplicates_windowSeconds", b.duplicatesWindow.min, b.duplicatesWindow.max, "Duplicate time window", errors),
    },
    caps: {
      enabled: checkbox(body, "caps_enabled"),
      action: automodAction(body, "caps_action", errors),
      threshold: integer(body, "caps_threshold", b.caps.min, b.caps.max, "Capitals percentage", errors),
    },
    emoji: {
      enabled: checkbox(body, "emoji_enabled"),
      action: automodAction(body, "emoji_action", errors),
      maxEmoji: integer(body, "emoji_maxEmoji", b.emoji.min, b.emoji.max, "Emoji allowed", errors),
      zalgo: checkbox(body, "emoji_zalgo"),
    },
    timeoutMinutes: integer(body, "timeoutMinutes", b.timeout.min, b.timeout.max, "Timeout length", errors),
    exemptRoleIds: pickedIds(body, "exempt_roles", id => ctx.roles.has(id), previous.exemptRoleIds, "exempt roles", errors),
    exemptChannelIds: pickedIds(body, "exempt_channels", id => ctx.textChannelIds.has(id), previous.exemptChannelIds, "exempt channels", errors),
  };
  return finish(errors, value);
}

/** The rules that can carry their own exemptions, as the per-rule form posts them. */
export const EXEMPTION_RULES = ["words", "links", "invites", "mentions", "spam", "duplicates", "caps", "emoji"] as const;
export type ExemptionRule = (typeof EXEMPTION_RULES)[number];
export const EXEMPTION_RULE_LABELS: Record<ExemptionRule, string> = {
  words: "Blocked words", links: "Links", invites: "Invites", mentions: "Mention spam", spam: "Message spam",
  duplicates: "Duplicate messages", caps: "Capitals", emoji: "Emoji and zalgo",
};
/** Same cap as /automod exempt: 25 roles and 25 channels per rule. */
export const RULE_EXEMPTIONS_MAX = 25;

export function isExemptionRule(value: unknown): value is ExemptionRule {
  return typeof value === "string" && (EXEMPTION_RULES as readonly string[]).includes(value);
}

export interface RuleExemptionsInput {
  rule: ExemptionRule;
  exemptRoleIds: string[];
  exemptChannelIds: string[];
}

/**
 * Shown when a viewer adds or removes a role at or above their own highest
 * role. Exempting such a role changes how automod treats people above them,
 * so it follows the same rule as handing a role out.
 */
export const EXEMPT_ROLE_ABOVE_VIEWER_ERROR =
  "One of those roles is equal to or above your highest role, so you can't change its exemption. Ask someone above it (or the server owner).";

/**
 * One rule's exemption lists from the per-rule form. Each ID must be a role or
 * text channel Aegis can see, or one already on the list (so an exemption set
 * with /automod on a channel the picker does not show is kept). Roles at or
 * above the viewer's highest role may stay as they are but can't be added or
 * removed by that viewer.
 */
export function parseRuleExemptions(
  body: FormBody,
  ctx: ValidationContext,
  saved: { exemptRoleIds?: readonly string[]; exemptChannelIds?: readonly string[] },
): Parsed<RuleExemptionsInput> {
  const errors = new Errors();
  const ruleRaw = field(body, "rule");
  if (!isExemptionRule(ruleRaw)) {
    errors.add("rule", "Pick one of the automod rules.");
    return finish(errors, { rule: "words", exemptRoleIds: [], exemptChannelIds: [] });
  }
  const savedRoles = saved.exemptRoleIds ?? [];
  const savedChannels = saved.exemptChannelIds ?? [];
  const exemptRoleIds = pickedIds(body, "roles", id => ctx.roles.has(id), savedRoles, "roles", errors, RULE_EXEMPTIONS_MAX);
  const exemptChannelIds = pickedIds(body, "channels", id => ctx.textChannelIds.has(id), savedChannels, "channels", errors, RULE_EXEMPTIONS_MAX);
  const changed = [...exemptRoleIds.filter(id => !savedRoles.includes(id)), ...savedRoles.filter(id => !exemptRoleIds.includes(id))];
  if (changed.some(id => ctx.roles.get(id)?.aboveViewer)) errors.add("roles", EXEMPT_ROLE_ABOVE_VIEWER_ERROR);
  return finish(errors, { rule: ruleRaw, exemptRoleIds, exemptChannelIds });
}
