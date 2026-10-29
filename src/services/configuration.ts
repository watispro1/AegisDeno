import { GuildConfigModel, LegacyPluginSettingsModel } from "../database/mongo";
import { TtlCache } from "../utils/ttlCache";
import { logger } from "../utils/logger";
import { normalizeAutoCloseHours } from "./ticketTranscript";

/** Per-guild ticket settings (set with /ticket settings or the dashboard). */
export interface TicketSettings {
  /** Channel that receives HTML transcripts when a ticket closes. */
  logChannelId: string | null;
  /** Close a ticket after this many hours without messages; 0 disables. */
  autoCloseHours: number;
  /** Post transcripts to the log channel on close. */
  transcriptLogging: boolean;
}

/** Per-guild self-role panel settings. */
export interface RoleSettings {
  /** Most roles one /rolepanel may offer (Discord fits 25 buttons or select options). */
  maxRolesPerPanel: number;
}

export interface GuildConfig {
  guildId: string;
  prefix: string;
  language: string;
  loggingEnabled: boolean;
  loggingChannelId: string | null;
  /** Per-category audit log toggles keyed by category name; absent means default (on). */
  logCategories: Record<string, boolean> | null;
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeMessage: string;
  welcomeRoleId: string | null;
  suggestionsChannelId: string | null;
  escalation: {
    enabled: boolean;
    thresholds: Array<{ atWarnings: number; action: "timeout" | "kick" | "ban"; durationMinutes?: number }>;
    /** Warnings older than this many days stop counting toward thresholds; null = never expire. */
    warnExpiryDays?: number | null;
  };
  tickets: TicketSettings;
  roles: RoleSettings;
}

/** Fields of GuildConfig whose sub-keys are saved one by one, so a partial update keeps the rest. */
export type GuildConfigUpdate = Partial<Omit<GuildConfig, "guildId" | "tickets" | "roles">> & {
  tickets?: Partial<TicketSettings>;
  roles?: Partial<RoleSettings>;
};

const DEFAULT_CONFIG: Omit<GuildConfig, "guildId"> = {
  prefix: "!",
  language: "en",
  loggingEnabled: false,
  loggingChannelId: null,
  logCategories: null,
  welcomeEnabled: false,
  welcomeChannelId: null,
  welcomeMessage: "Welcome {user} to **{server}**! You are member #{member_count}.",
  welcomeRoleId: null,
  suggestionsChannelId: null,
  escalation: {
    enabled: false,
    thresholds: [],
    warnExpiryDays: null,
  },
  tickets: {
    logChannelId: null,
    autoCloseHours: 48,
    transcriptLogging: true,
  },
  roles: {
    maxRolesPerPanel: 25,
  },
};

export const MAX_ROLES_PER_PANEL = 25;

export function normalizeMaxRolesPerPanel(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_CONFIG.roles.maxRolesPerPanel;
  return Math.min(MAX_ROLES_PER_PANEL, Math.floor(n));
}

/** Longest configurable warning expiry; warnings are deleted after a year anyway. */
export const MAX_WARN_EXPIRY_DAYS = 365;

export function normalizeWarnExpiryDays(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const days = Number(value);
  return Number.isInteger(days) && days >= 1 && days <= MAX_WARN_EXPIRY_DAYS ? days : null;
}

const DISCORD_ID = /^\d{17,20}$/;
const LOG_CATEGORIES = new Set([
  "modActions", "memberJoins", "memberLeaves", "messageEdits",
  "messageDeletes", "roleChanges", "channelEvents",
]);
const ESCALATION_ACTIONS = new Set(["timeout", "kick", "ban"]);

function optionalId(value: unknown): string | null {
  return value === null || value === undefined ? null : DISCORD_ID.test(String(value)) ? String(value) : null;
}

export function normalizeThresholds(value: unknown): GuildConfig["escalation"]["thresholds"] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const atWarnings = Number(item.atWarnings);
    const action = String(item.action);
    if (!Number.isInteger(atWarnings) || atWarnings < 1 || atWarnings > 100 || !ESCALATION_ACTIONS.has(action)) return [];
    const duration = Number(item.durationMinutes);
    return [{
      atWarnings,
      action: action as "timeout" | "kick" | "ban",
      ...(action === "timeout" && Number.isInteger(duration) && duration >= 1 && duration <= 28 * 24 * 60
        ? { durationMinutes: duration }
        : {}),
    }];
  });
}

function normalizeLogCategories(value: unknown): Record<string, boolean> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value)
    .filter(([key, val]) => LOG_CATEGORIES.has(key) && typeof val === "boolean")
    .map(([key, val]) => [key, val]));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** A guild config document as stored (sub-objects may be missing or partial). */
export type StoredGuildConfig = Omit<Partial<GuildConfig>, "tickets" | "roles"> & {
  tickets?: Partial<TicketSettings> | null;
  roles?: Partial<RoleSettings> | null;
  /** Set once the retired per-feature settings documents were copied in. */
  legacySettingsMigratedAt?: Date | null;
};

export function normalizeGuildConfig(guildId: string, source?: StoredGuildConfig | null): GuildConfig {
  const config = source ?? {};
  const tickets = asRecord(config.tickets);
  const roles = asRecord(config.roles);
  return {
    guildId,
    prefix: typeof config.prefix === "string" && config.prefix.length <= 16 ? config.prefix : DEFAULT_CONFIG.prefix,
    language: typeof config.language === "string" && config.language.length <= 10 ? config.language : DEFAULT_CONFIG.language,
    loggingEnabled: config.loggingEnabled === true,
    loggingChannelId: optionalId(config.loggingChannelId),
    logCategories: normalizeLogCategories(config.logCategories),
    welcomeEnabled: config.welcomeEnabled === true,
    welcomeChannelId: optionalId(config.welcomeChannelId),
    welcomeMessage: typeof config.welcomeMessage === "string" && config.welcomeMessage.length <= 1000 ? config.welcomeMessage : DEFAULT_CONFIG.welcomeMessage,
    welcomeRoleId: optionalId(config.welcomeRoleId),
    suggestionsChannelId: optionalId(config.suggestionsChannelId),
    escalation: {
      enabled: Boolean(config.escalation && typeof config.escalation === "object" && config.escalation.enabled === true),
      thresholds: normalizeThresholds(config.escalation && typeof config.escalation === "object" ? config.escalation.thresholds : []),
      warnExpiryDays: normalizeWarnExpiryDays(config.escalation && typeof config.escalation === "object" ? config.escalation.warnExpiryDays : null),
    },
    tickets: {
      logChannelId: optionalId(tickets.logChannelId),
      autoCloseHours: normalizeAutoCloseHours(tickets.autoCloseHours),
      transcriptLogging: tickets.transcriptLogging !== false,
    },
    roles: {
      maxRolesPerPanel: normalizeMaxRolesPerPanel(roles.maxRolesPerPanel),
    },
  };
}

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

/** Turns `{ tickets: { autoCloseHours: 5 } }` into `{ "tickets.autoCloseHours": 5 }` for the nested settings. */
export function guildConfigSetPaths(update: GuildConfigUpdate): Record<string, unknown> {
  const flat = new Set([
    "prefix", "language", "loggingEnabled", "loggingChannelId", "logCategories",
    "welcomeEnabled", "welcomeChannelId", "welcomeMessage", "welcomeRoleId",
    "suggestionsChannelId", "escalation",
  ]);
  // Nested settings are normalised on the way in: their schema paths are typed.
  const nested: Record<string, Record<string, (value: unknown) => unknown>> = {
    tickets: {
      logChannelId: optionalId,
      autoCloseHours: normalizeAutoCloseHours,
      transcriptLogging: (v) => v !== false,
    },
    roles: {
      maxRolesPerPanel: normalizeMaxRolesPerPanel,
    },
  };
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(update)) {
    if (value === undefined) continue;
    if (flat.has(key)) {
      set[key] = value;
    } else if (nested[key]) {
      const sub = asRecord(value);
      for (const [field, normalize] of Object.entries(nested[key])) {
        if (sub[field] !== undefined) set[`${key}.${field}`] = normalize(sub[field]);
      }
    }
  }
  return set;
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
