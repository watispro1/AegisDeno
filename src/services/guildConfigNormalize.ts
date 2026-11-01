/**
 * Guild config shape, defaults and normalisers. Pure: no database access, so
 * every rule here is unit-tested directly. Storage, caching and the one-time
 * legacy copy live in configuration.ts, which re-exports everything here.
 */
import { normalizeAutoCloseHours } from "./ticketTranscript";
import { normalizeEmbedSpec, type EmbedSpec } from "./embedSpec";
import { normalizeIncidentConfig, type IncidentConfig } from "./incidentLogic";
import { normalizeTrustConfig, type TrustConfig } from "./trustEngine";
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
  /*
   * Added in 3.6.2 with the dashboard overhaul. Optional in the type so older
   * fixtures stay valid; normalizeGuildConfig always fills them.
   */
  /** Optional embed sent with the welcome message. */
  welcomeEmbed?: EmbedSpec | null;
  /** Post a message when a member leaves. */
  goodbyeEnabled?: boolean;
  goodbyeChannelId?: string | null;
  goodbyeMessage?: string;
  goodbyeEmbed?: EmbedSpec | null;
  /** Master switch for autoresponders (each responder also has its own). Default on. */
  autorespondersEnabled?: boolean;
  /** Per-category log channel overrides; a category without one uses loggingChannelId. */
  logChannels?: Record<string, string> | null;
  /** Incident Mode defaults and the optional join-burst auto-trigger (off by default). */
  incident?: IncidentConfig;
  /** Module switches the dashboard can flip; every module defaults to on. */
  modules?: ModuleSwitches;
  /** Trust Score v2 settings and opt-in integrations (all off by default). */
  trust?: TrustConfig;
}

/** Modules a server can switch off as a whole. The bot refuses new use of an off module. */
export interface ModuleSwitches {
  tickets: boolean;
  giveaways: boolean;
  scheduled: boolean;
  appeals: boolean;
}

export const MODULE_SWITCH_KEYS = ["tickets", "giveaways", "scheduled", "appeals"] as const;
export type ModuleSwitchKey = typeof MODULE_SWITCH_KEYS[number];

export function normalizeModuleSwitches(value: unknown): ModuleSwitches {
  const o = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return { tickets: o.tickets !== false, giveaways: o.giveaways !== false, scheduled: o.scheduled !== false, appeals: o.appeals !== false };
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
  welcomeEmbed: null,
  goodbyeEnabled: false,
  goodbyeChannelId: null,
  goodbyeMessage: "**{username}** left {server}. We now have {memberCount} members.",
  goodbyeEmbed: null,
  autorespondersEnabled: true,
  logChannels: null,
  incident: normalizeIncidentConfig(undefined),
  modules: normalizeModuleSwitches(undefined),
  trust: normalizeTrustConfig(undefined),
};

export const GOODBYE_MESSAGE_MAX = 1000;

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

export const DISCORD_ID = /^\d{17,20}$/;
const LOG_CATEGORIES = new Set([
  "modActions", "memberJoins", "memberLeaves", "messageEdits",
  "messageDeletes", "roleChanges", "channelEvents",
]);
const ESCALATION_ACTIONS = new Set(["timeout", "kick", "ban"]);

export function optionalId(value: unknown): string | null {
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

/** Per-category log channel overrides: known categories and snowflakes only. */
export function normalizeLogChannels(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out = Object.fromEntries(Object.entries(value)
    .filter(([key, val]) => LOG_CATEGORIES.has(key) && typeof val === "string" && DISCORD_ID.test(val)));
  return Object.keys(out).length ? out as Record<string, string> : null;
}

export function asRecord(value: unknown): Record<string, unknown> {
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
    welcomeEmbed: normalizeEmbedSpec(config.welcomeEmbed),
    goodbyeEnabled: config.goodbyeEnabled === true,
    goodbyeChannelId: optionalId(config.goodbyeChannelId),
    goodbyeMessage: typeof config.goodbyeMessage === "string" && config.goodbyeMessage.length <= GOODBYE_MESSAGE_MAX ? config.goodbyeMessage : DEFAULT_CONFIG.goodbyeMessage,
    goodbyeEmbed: normalizeEmbedSpec(config.goodbyeEmbed),
    autorespondersEnabled: config.autorespondersEnabled !== false,
    logChannels: normalizeLogChannels(config.logChannels),
    incident: normalizeIncidentConfig(config.incident),
    modules: normalizeModuleSwitches(config.modules),
    trust: normalizeTrustConfig(config.trust),
  };
}

/** Turns `{ tickets: { autoCloseHours: 5 } }` into `{ "tickets.autoCloseHours": 5 }` for the nested settings. */
export function guildConfigSetPaths(update: GuildConfigUpdate): Record<string, unknown> {
  const flat = new Set([
    "prefix", "language", "loggingEnabled", "loggingChannelId", "logCategories",
    "welcomeEnabled", "welcomeChannelId", "welcomeMessage", "welcomeRoleId",
    "suggestionsChannelId", "escalation",
    "goodbyeEnabled", "goodbyeChannelId", "goodbyeMessage", "autorespondersEnabled",
  ]);
  // Stored as whole sub-documents, so they are normalised here rather than per field.
  const whole: Record<string, (value: unknown) => unknown> = {
    welcomeEmbed: (v) => (v === null ? null : normalizeEmbedSpec(v)),
    goodbyeEmbed: (v) => (v === null ? null : normalizeEmbedSpec(v)),
    logChannels: normalizeLogChannels,
    incident: normalizeIncidentConfig,
    modules: normalizeModuleSwitches,
    trust: normalizeTrustConfig,
  };
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
    } else if (whole[key]) {
      set[key] = whole[key](value);
    } else if (nested[key]) {
      const sub = asRecord(value);
      for (const [field, normalize] of Object.entries(nested[key])) {
        if (sub[field] !== undefined) set[`${key}.${field}`] = normalize(sub[field]);
      }
    }
  }
  return set;
}

