import { AutomodModel } from "../database/mongo";
import { TtlCache } from "../utils/ttlCache";

export interface AutomodRule {
  enabled: boolean;
  action: "delete" | "warn" | "timeout";
  /** Roles this rule alone skips (on top of the global exemptions). */
  exemptRoleIds?: string[];
  /** Channels where this rule alone is off. */
  exemptChannelIds?: string[];
}

export type AutomodRuleKey = "words" | "links" | "mentions" | "spam" | "caps" | "invites" | "duplicates" | "emoji";
export const AUTOMOD_RULE_KEYS: readonly AutomodRuleKey[] = ["words", "links", "mentions", "spam", "caps", "invites", "duplicates", "emoji"];
/** Most allowed domains or invite codes one rule keeps. */
export const MAX_ALLOWLIST = 50;
/** Default and bounds for the timeout automod hands out, in minutes (up to 7 days). */
export const DEFAULT_AUTOMOD_TIMEOUT_MINUTES = 5;
export const MAX_AUTOMOD_TIMEOUT_MINUTES = 10_080;
/** Most roles or channels one rule (or the global list) may exempt. */
export const MAX_EXEMPTIONS = 25;

export interface WordsRule extends AutomodRule {
  list: string[];
}

export interface MentionsRule extends AutomodRule {
  threshold: number;
}

export interface SpamRule extends AutomodRule {
  /** Maximum messages allowed within windowSeconds before enforcement. */
  maxMessages: number;
  windowSeconds: number;
}

export interface LinksRule extends AutomodRule {
  /** Domains (and their subdomains) whose links always pass, e.g. "youtube.com". */
  allowedDomains: string[];
}

export interface InvitesRule extends AutomodRule {
  /** Invite codes that always pass. The server's own vanity invite always passes too. */
  allowedCodes: string[];
}

export interface DuplicatesRule extends AutomodRule {
  /** Identical messages allowed within windowSeconds; the next one is acted on. */
  maxRepeats: number;
  windowSeconds: number;
}

export interface EmojiRule extends AutomodRule {
  /** Most emoji (Unicode and custom) one message may carry. */
  maxEmoji: number;
  /** Also catch "zalgo" text stacked with combining marks. */
  zalgo: boolean;
}

export interface CapsRule extends AutomodRule {
  /** Percentage of letters that must be uppercase before enforcement. */
  threshold: number;
}

export interface AutomodConfig {
  guildId: string;
  words: WordsRule;
  links: LinksRule;
  mentions: MentionsRule;
  spam: SpamRule;
  caps: CapsRule;
  invites: InvitesRule;
  duplicates: DuplicatesRule;
  emoji: EmojiRule;
  /** Length of the timeout for rules whose action is "timeout". */
  timeoutMinutes: number;
  /** Role IDs that bypass all automod checks. */
  exemptRoleIds: string[];
  /** Channel IDs where automod is fully disabled. */
  exemptChannelIds: string[];
}

/** A partial change: any rule may carry only the fields being changed. */
export type AutomodPatch = { [K in AutomodRuleKey]?: Partial<AutomodConfig[K]> }
  & Partial<Pick<AutomodConfig, "exemptRoleIds" | "exemptChannelIds" | "timeoutMinutes">>;

const DEFAULT_CONFIG: Omit<AutomodConfig, "guildId"> = {
  words:    { enabled: false, action: "delete", list: [] },
  links:    { enabled: false, action: "delete", allowedDomains: [] },
  mentions: { enabled: false, action: "timeout", threshold: 5 },
  spam:     { enabled: false, action: "timeout", maxMessages: 5, windowSeconds: 5 },
  caps:     { enabled: false, action: "delete", threshold: 80 },
  invites:  { enabled: false, action: "delete", allowedCodes: [] },
  duplicates: { enabled: false, action: "delete", maxRepeats: 3, windowSeconds: 60 },
  emoji:    { enabled: false, action: "delete", maxEmoji: 10, zalgo: true },
  timeoutMinutes: DEFAULT_AUTOMOD_TIMEOUT_MINUTES,
  exemptRoleIds:    [],
  exemptChannelIds: [],
};

const SNOWFLAKE = /^\d{17,20}$/;

/** Distinct snowflake IDs, capped. */
export function cleanIdList(value: unknown, max = MAX_EXEMPTIONS): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).filter(id => SNOWFLAKE.test(id)))].slice(0, max);
}

const ACTIONS: ReadonlySet<string> = new Set(["delete", "warn", "timeout"]);

function normalizeRule<T extends AutomodRule>(rule: Partial<T> | undefined, fallback: T): T {
  const merged = { ...fallback, ...(rule ?? {}) };
  return {
    ...merged,
    enabled: merged.enabled === true,
    action: ACTIONS.has(String(merged.action)) ? merged.action : fallback.action,
    exemptRoleIds: cleanIdList(merged.exemptRoleIds),
    exemptChannelIds: cleanIdList(merged.exemptChannelIds),
  };
}

/** A whole number clamped to [min, max], or the fallback when the value is not a finite number. */
export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
}

const DOMAIN = /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/**
 * Turn what a moderator typed ("https://www.YouTube.com/watch", "*.github.io")
 * into a bare lowercase domain, or null when it is not one.
 */
export function cleanDomain(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let d = raw.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/^\*\./, "");
  d = d.split(/[/?#:]/)[0].replace(/^www\./, "").replace(/\.$/, "");
  return DOMAIN.test(d) ? d : null;
}

const INVITE_CODE = /^[a-z0-9-]{2,32}$/i;

/** An invite code from a code or a full invite URL, or null. Codes are case-sensitive on Discord, so case is kept. */
export function cleanInviteCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().replace(/^(?:https?:\/\/)?(?:www\.)?(?:discord(?:app)?\.com\/invite|discord\.gg)\//i, "").split(/[/?#]/)[0];
  return INVITE_CODE.test(code) ? code : null;
}

function cleanList(value: unknown, clean: (v: unknown) => string | null): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(clean).filter((v): v is string => v !== null))].slice(0, MAX_ALLOWLIST);
}

/**
 * Apply a partial change to a saved config. Rules are merged field by field,
 * so a caller that only knows some fields (the dashboard form, a preset)
 * never wipes the rest, such as per-rule exemptions, caps or the global
 * exemption lists.
 */
export function mergeAutomodConfig(current: AutomodConfig, patch: AutomodPatch): AutomodConfig {
  const out: AutomodConfig = { ...current };
  for (const key of AUTOMOD_RULE_KEYS) {
    if (patch[key]) (out as unknown as Record<string, unknown>)[key] = { ...current[key], ...patch[key] };
  }
  if (patch.timeoutMinutes !== undefined) out.timeoutMinutes = patch.timeoutMinutes;
  if (patch.exemptRoleIds) out.exemptRoleIds = patch.exemptRoleIds;
  if (patch.exemptChannelIds) out.exemptChannelIds = patch.exemptChannelIds;
  return normalizeAutomodConfig(current.guildId, out);
}

function normalizeWordsRule(rule: Partial<WordsRule> | undefined): WordsRule {
  const normalized = normalizeRule(rule, DEFAULT_CONFIG.words);
  return {
    ...normalized,
    list: Array.isArray(rule?.list)
      ? rule.list.map(item => String(item).trim().toLowerCase()).filter(Boolean)
      : DEFAULT_CONFIG.words.list,
  };
}

function normalizeMentionsRule(rule: Partial<MentionsRule> | undefined): MentionsRule {
  const normalized = normalizeRule(rule, DEFAULT_CONFIG.mentions);
  const thresholdValue =
    typeof rule?.threshold === "number" && Number.isFinite(rule.threshold)
      ? Number(rule.threshold)
      : DEFAULT_CONFIG.mentions.threshold;

  return {
    ...normalized,
    threshold: Math.max(1, Math.min(50, thresholdValue)),
  };
}

function normalizeSpamRule(rule: Partial<SpamRule> | undefined): SpamRule {
  const normalized = normalizeRule(rule, DEFAULT_CONFIG.spam);
  const maxMessages =
    typeof rule?.maxMessages === "number" && Number.isFinite(rule.maxMessages)
      ? Math.max(2, Math.min(30, rule.maxMessages))
      : DEFAULT_CONFIG.spam.maxMessages;
  const windowSeconds =
    typeof rule?.windowSeconds === "number" && Number.isFinite(rule.windowSeconds)
      ? Math.max(2, Math.min(60, rule.windowSeconds))
      : DEFAULT_CONFIG.spam.windowSeconds;

  return { ...normalized, maxMessages, windowSeconds };
}

function normalizeCapsRule(rule: Partial<CapsRule> | undefined): CapsRule {
  const normalized = normalizeRule(rule, DEFAULT_CONFIG.caps);
  const threshold = typeof rule?.threshold === "number" && Number.isFinite(rule.threshold)
    ? Math.max(50, Math.min(100, Math.round(rule.threshold)))
    : DEFAULT_CONFIG.caps.threshold;
  return { ...normalized, threshold };
}

function normalizeLinksRule(rule: Partial<LinksRule> | undefined): LinksRule {
  return { ...normalizeRule(rule, DEFAULT_CONFIG.links), allowedDomains: cleanList(rule?.allowedDomains, cleanDomain) };
}

function normalizeInvitesRule(rule: Partial<InvitesRule> | undefined): InvitesRule {
  return { ...normalizeRule(rule, DEFAULT_CONFIG.invites), allowedCodes: cleanList(rule?.allowedCodes, cleanInviteCode) };
}

function normalizeDuplicatesRule(rule: Partial<DuplicatesRule> | undefined): DuplicatesRule {
  const d = DEFAULT_CONFIG.duplicates;
  return {
    ...normalizeRule(rule, d),
    maxRepeats: clampInt(rule?.maxRepeats, 2, 10, d.maxRepeats),
    windowSeconds: clampInt(rule?.windowSeconds, 10, 600, d.windowSeconds),
  };
}

function normalizeEmojiRule(rule: Partial<EmojiRule> | undefined): EmojiRule {
  const d = DEFAULT_CONFIG.emoji;
  return { ...normalizeRule(rule, d), maxEmoji: clampInt(rule?.maxEmoji, 3, 50, d.maxEmoji), zalgo: rule?.zalgo !== false };
}

export function normalizeAutomodConfig(guildId: string, source?: Partial<AutomodConfig>): AutomodConfig {
  const config = source ?? {};
  return {
    guildId,
    words:    normalizeWordsRule(config.words),
    links:    normalizeLinksRule(config.links),
    mentions: normalizeMentionsRule(config.mentions),
    spam:     normalizeSpamRule(config.spam),
    caps:     normalizeCapsRule(config.caps),
    invites:  normalizeInvitesRule(config.invites),
    duplicates: normalizeDuplicatesRule(config.duplicates),
    emoji:    normalizeEmojiRule(config.emoji),
    timeoutMinutes: clampInt(config.timeoutMinutes, 1, MAX_AUTOMOD_TIMEOUT_MINUTES, DEFAULT_AUTOMOD_TIMEOUT_MINUTES),
    exemptRoleIds:    cleanIdList(config.exemptRoleIds, 100),
    exemptChannelIds: cleanIdList(config.exemptChannelIds, 100),
  };
}

/**
 * Read on every message, so cached. Saves through updateAutomodConfig refresh
 * the entry at once; the TTL only bounds edits made around this module.
 */
const automodCache = new TtlCache<AutomodConfig>(60_000);

async function loadAutomodConfig(guildId: string): Promise<AutomodConfig> {
  const doc = await AutomodModel.findOne({ guildId }).lean();
  if (!doc) return normalizeAutomodConfig(guildId);
  const { _id, __v, ...config } = doc as Partial<AutomodConfig> & { _id?: unknown; __v?: unknown };
  return normalizeAutomodConfig(guildId, config);
}

export async function getAutomodConfig(guildId: string): Promise<AutomodConfig> {
  return structuredClone(await automodCache.getOrLoad(guildId, () => loadAutomodConfig(guildId)));
}

export async function updateAutomodConfig(
  guildId: string,
  config: AutomodPatch
): Promise<AutomodConfig> {
  const normalized = mergeAutomodConfig(await getAutomodConfig(guildId), config);

  automodCache.delete(guildId);
  await AutomodModel.updateOne(
    { guildId },
    { $set: normalized },
    { upsert: true }
  );
  automodCache.delete(guildId);
  automodCache.set(guildId, structuredClone(normalized));

  return normalized;
}
