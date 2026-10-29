import { AutomodModel } from "../database/mongo";
import { TtlCache } from "../utils/ttlCache";

export interface AutomodRule {
  enabled: boolean;
  action: "delete" | "warn" | "timeout";
}

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

export interface CapsRule extends AutomodRule {
  /** Percentage of letters that must be uppercase before enforcement. */
  threshold: number;
}

export interface AutomodConfig {
  guildId: string;
  words: WordsRule;
  links: AutomodRule;
  mentions: MentionsRule;
  spam: SpamRule;
  caps: CapsRule;
  /** Role IDs that bypass all automod checks. */
  exemptRoleIds: string[];
  /** Channel IDs where automod is fully disabled. */
  exemptChannelIds: string[];
}

const DEFAULT_CONFIG: Omit<AutomodConfig, "guildId"> = {
  words:    { enabled: false, action: "delete", list: [] },
  links:    { enabled: false, action: "delete" },
  mentions: { enabled: false, action: "timeout", threshold: 5 },
  spam:     { enabled: false, action: "timeout", maxMessages: 5, windowSeconds: 5 },
  caps:     { enabled: false, action: "delete", threshold: 80 },
  exemptRoleIds:    [],
  exemptChannelIds: [],
};

function normalizeRule<T extends AutomodRule>(rule: Partial<T> | undefined, fallback: T): T {
  return { ...fallback, ...(rule ?? {}) };
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

function normalizeAutomodConfig(guildId: string, source?: Partial<AutomodConfig>): AutomodConfig {
  const config = source ?? {};
  return {
    guildId,
    words:    normalizeWordsRule(config.words),
    links:    normalizeRule(config.links, DEFAULT_CONFIG.links),
    mentions: normalizeMentionsRule(config.mentions),
    spam:     normalizeSpamRule(config.spam),
    caps:     normalizeCapsRule(config.caps),
    exemptRoleIds:    Array.isArray(config.exemptRoleIds)    ? config.exemptRoleIds.filter(Boolean)    : [],
    exemptChannelIds: Array.isArray(config.exemptChannelIds) ? config.exemptChannelIds.filter(Boolean) : [],
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
  config: Partial<Omit<AutomodConfig, "guildId">>
): Promise<AutomodConfig> {
  const normalized = normalizeAutomodConfig(guildId, { guildId, ...config });

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
