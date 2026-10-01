import { AutomodModel } from "../database/mongo";

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

export interface AutomodConfig {
  guildId: string;
  words: WordsRule;
  links: AutomodRule;
  mentions: MentionsRule;
}

const DEFAULT_CONFIG: Omit<AutomodConfig, "guildId"> = {
  words: { enabled: false, action: "delete", list: [] },
  links: { enabled: false, action: "delete" },
  mentions: { enabled: false, action: "timeout", threshold: 5 },
};

export async function getAutomodConfig(guildId: string): Promise<AutomodConfig> {
  const doc = await AutomodModel.findOne({ guildId });
  if (!doc) {
    return { ...DEFAULT_CONFIG, guildId };
  }
  const config = doc.toObject() as AutomodConfig;
  // Older records can predate newer nested defaults. Normalize them on read so
  // every rule remains safe to execute after an upgrade.
  return {
    ...DEFAULT_CONFIG,
    ...config,
    words: { ...DEFAULT_CONFIG.words, ...config.words, list: config.words?.list ?? [] },
    links: { ...DEFAULT_CONFIG.links, ...config.links },
    mentions: { ...DEFAULT_CONFIG.mentions, ...config.mentions },
  };
}

export async function updateAutomodConfig(
  guildId: string,
  config: Partial<AutomodConfig>
): Promise<AutomodConfig> {
  const updated = await AutomodModel.findOneAndUpdate(
    { guildId },
    { $set: config },
    { new: true, upsert: true }
  );
  return updated.toObject() as AutomodConfig;
}

export async function resetAutomodConfig(guildId: string): Promise<void> {
  await AutomodModel.deleteOne({ guildId });
}
