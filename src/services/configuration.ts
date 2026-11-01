import { GuildConfigModel, LegacyPluginSettingsModel } from "../database/mongo";
import { TtlCache } from "../utils/ttlCache";
import { logger } from "../utils/logger";
import {
  DISCORD_ID, asRecord, guildConfigSetPaths, normalizeGuildConfig, normalizeMaxRolesPerPanel,
  type GuildConfig, type GuildConfigUpdate, type StoredGuildConfig,
} from "./guildConfigNormalize";

export * from "./guildConfigNormalize";

// ─── Retired per-feature settings (one-time copy) ─────────────────────────────

/**
 * Before v3.6 ticket and role-panel settings lived in separate per-feature
 * documents (the `pluginconfigs` collection, one per guild and feature). They
 * are copied into the guild config the first time a guild's config is read or
 * written. Only fields the guild config does not already have are copied, and
 * the old documents are left untouched.
 */
export interface LegacySettingsDoc {
  pluginName: string;
  enabled?: unknown;
  config?: unknown;
}

const LEGACY_TICKET_FIELDS = ["logChannelId", "autoCloseHours", "transcriptLogging"] as const;

/** `$set` paths that carry legacy values into a guild config, skipping anything already set. */
export function legacySettingsPatch(current: StoredGuildConfig | null, docs: readonly LegacySettingsDoc[]): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const byName = new Map(docs.map((d) => [d.pluginName, asRecord(d.config)]));

  const tickets = byName.get("tickets");
  if (tickets) {
    const have = asRecord(current?.tickets);
    for (const field of LEGACY_TICKET_FIELDS) {
      if (have[field] !== undefined || tickets[field] === undefined) continue;
      const value = tickets[field];
      if (field === "logChannelId" && !(value === null || (typeof value === "string" && DISCORD_ID.test(value)))) continue;
      if (field === "autoCloseHours" && !(typeof value === "number" && Number.isFinite(value))) continue;
      if (field === "transcriptLogging" && typeof value !== "boolean") continue;
      patch[`tickets.${field}`] = value;
    }
  }

  const roles = byName.get("roles");
  if (roles && asRecord(current?.roles).maxRolesPerPanel === undefined && typeof roles.maxRolesPerPanel === "number") {
    patch["roles.maxRolesPerPanel"] = normalizeMaxRolesPerPanel(roles.maxRolesPerPanel);
  }
  return patch;
}

/** Features a guild had switched off with the removed per-feature toggle. */
export function disabledLegacyFeatures(docs: readonly LegacySettingsDoc[]): string[] {
  return docs.filter((d) => d.enabled === false).map((d) => d.pluginName).sort();
}

// ─── Storage and caching ──────────────────────────────────────────────────────

export interface GuildConfigStore {
  load(guildId: string): Promise<StoredGuildConfig | null>;
  /** Upsert `$set` paths and return the stored document after the update. */
  save(guildId: string, set: Record<string, unknown>): Promise<StoredGuildConfig | null>;
  loadLegacy(guildId: string): Promise<LegacySettingsDoc[]>;
}

function stripMeta(doc: unknown): StoredGuildConfig | null {
  if (!doc) return null;
  const { _id, __v, ...rest } = doc as StoredGuildConfig & { _id?: unknown; __v?: unknown };
  return rest;
}

export const mongoGuildConfigStore: GuildConfigStore = {
  async load(guildId) {
    return stripMeta(await GuildConfigModel.findOne({ guildId }).lean());
  },
  async save(guildId, set) {
    return stripMeta(await GuildConfigModel.findOneAndUpdate(
      { guildId },
      { $set: set },
      { new: true, upsert: true },
    ).lean());
  },
  async loadLegacy(guildId) {
    // At most one small document per feature, so read them all in one go.
    const docs = await LegacyPluginSettingsModel.find({ guildId }).select("pluginName enabled config").lean();
    return docs.map((d) => ({ pluginName: String(d.pluginName), enabled: d.enabled, config: d.config }));
  },
};

/** How long a guild config stays cached. Saves through this module invalidate at once. */
export const GUILD_CONFIG_TTL_MS = 60_000;

export function createGuildConfigService(store: GuildConfigStore, ttlMs = GUILD_CONFIG_TTL_MS) {
  const cache = new TtlCache<GuildConfig>(ttlMs);
  /** Guilds whose legacy settings were already checked in this process. */
  const legacyChecked = new Set<string>();

  async function loadAndMigrate(guildId: string): Promise<GuildConfig> {
    let doc = await store.load(guildId);
    if (doc?.legacySettingsMigratedAt) legacyChecked.add(guildId);
    if (!legacyChecked.has(guildId)) {
      try {
        const legacy = await store.loadLegacy(guildId);
        const patch = legacySettingsPatch(doc, legacy);
        const disabled = disabledLegacyFeatures(legacy);
        if (disabled.length) {
          logger.warn(
            `Guild ${guildId} had these features switched off with the removed /plugins toggle; they are now always on: ${disabled.join(", ")}`,
          );
        }
        if (doc || Object.keys(patch).length) {
          // Read fallback first, so the guild gets its old values even if the write fails.
          const merged = applySetPaths(doc ?? {}, patch);
          try {
            doc = (await store.save(guildId, { ...patch, legacySettingsMigratedAt: new Date() })) ?? merged;
            legacyChecked.add(guildId);
          } catch (err) {
            logger.warn(`Could not save migrated settings for guild ${guildId}; using them unsaved for now:`, err);
            doc = merged;
          }
        } else {
          legacyChecked.add(guildId);
        }
      } catch (err) {
        logger.warn(`Could not read retired settings for guild ${guildId}:`, err);
      }
    }
    return normalizeGuildConfig(guildId, doc);
  }

  async function getGuildConfig(guildId: string): Promise<GuildConfig> {
    return structuredClone(await cache.getOrLoad(guildId, () => loadAndMigrate(guildId)));
  }

  async function updateGuildConfig(guildId: string, update: GuildConfigUpdate): Promise<GuildConfig> {
    // Copy any legacy values in first, so they never overwrite this newer change later.
    if (!legacyChecked.has(guildId)) await cache.getOrLoad(guildId, () => loadAndMigrate(guildId));
    const set = guildConfigSetPaths(update);
    cache.delete(guildId);
    if (Object.keys(set).length === 0) return getGuildConfig(guildId);
    const saved = await store.save(guildId, set);
    cache.delete(guildId);
    const config = normalizeGuildConfig(guildId, saved ?? applySetPaths({}, set));
    cache.set(guildId, config);
    return structuredClone(config);
  }

  function invalidate(guildId?: string): void {
    if (guildId) cache.delete(guildId);
    else cache.clear();
  }

  return { getGuildConfig, updateGuildConfig, invalidate };
}

/** Applies dotted `$set` paths to a plain object copy (for read fallbacks and tests). */
export function applySetPaths(doc: StoredGuildConfig, set: Record<string, unknown>): StoredGuildConfig {
  const out = structuredClone(doc) as Record<string, unknown>;
  for (const [path, value] of Object.entries(set)) {
    const parts = path.split(".");
    let node = out;
    for (const part of parts.slice(0, -1)) {
      node[part] = asRecord(node[part]);
      node = node[part] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = value;
  }
  return out as StoredGuildConfig;
}

const service = createGuildConfigService(mongoGuildConfigStore);

export const getGuildConfig = service.getGuildConfig;
export const updateGuildConfig = service.updateGuildConfig;
export const invalidateGuildConfig = service.invalidate;

/** Defaults for a guild with nothing saved. */
export function defaultGuildConfig(guildId: string): GuildConfig {
  return normalizeGuildConfig(guildId);
}
