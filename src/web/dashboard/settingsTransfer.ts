/**
 * Settings export and import for the dashboard (Manage Server / owner only).
 *
 * Export is a JSON snapshot of the guild config and automod rules. Import is
 * strict: the file must be an Aegis export, it may not carry Mongo operators,
 * every value is re-normalised by the same functions the bot uses, and every
 * channel or role it names is checked against this server: hidden or unknown
 * channels and roles the viewer could not pick are dropped with a warning
 * instead of being saved. Pure, so the whole rule set is unit-tested.
 */
import { hasOperatorKeys } from "../../utils/mongoSafe";
import { normalizeGuildConfig, type GuildConfig, type GuildConfigUpdate } from "../../services/guildConfigNormalize";
import { normalizeEconomyConfig, type EconomyConfig } from "../../services/economyLogic";
import type { AutomodConfig, AutomodRuleKey } from "../../services/automod";
import type { ValidationContext } from "./validation";

export const SETTINGS_FORMAT = "aegis-settings";
export const SETTINGS_FORMAT_VERSION = 1;
/** Largest import accepted (a full blocked-word list is about 60 KB of JSON). */
export const SETTINGS_IMPORT_MAX_CHARS = 200_000;

export interface SettingsExport {
  format: typeof SETTINGS_FORMAT;
  version: number;
  exportedAt: string;
  source: { guildId: string; guildName: string };
  config: Omit<GuildConfig, "guildId" | "prefix" | "language">;
  automod: Omit<AutomodConfig, "guildId">;
  /** Economy settings only; balances, inventory and shop items are not exported. */
  economy: EconomyConfig;
}

export function exportSettings(guildId: string, guildName: string, config: GuildConfig, automod: AutomodConfig, economy: EconomyConfig, nowMs = Date.now()): SettingsExport {
  const { guildId: _g, prefix: _p, language: _l, ...rest } = config;
  const { guildId: _a, ...rules } = automod;
  return { format: SETTINGS_FORMAT, version: SETTINGS_FORMAT_VERSION, exportedAt: new Date(nowMs).toISOString(), source: { guildId, guildName }, config: rest, automod: rules, economy };
}

export type ImportResult =
  | { ok: true; update: GuildConfigUpdate; automod: Partial<Omit<AutomodConfig, "guildId">> | null; economy: EconomyConfig | null; warnings: string[] }
  | { ok: false; error: string };

/** Automod rule keys in an export (the AUTOMOD_RULE_KEYS list, repeated so this file stays free of Mongo imports). */
const IMPORT_RULE_KEYS = ["words", "links", "mentions", "spam", "caps", "invites", "duplicates", "emoji"] as const satisfies readonly AutomodRuleKey[];

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function parseSettingsImport(text: string, ctx: ValidationContext): ImportResult {
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "Paste the contents of an Aegis settings export, or choose the file." };
  if (text.length > SETTINGS_IMPORT_MAX_CHARS) return { ok: false, error: `That file is too large (over ${SETTINGS_IMPORT_MAX_CHARS.toLocaleString("en-US")} characters).` };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: "That is not valid JSON. Use the file the Export button downloads." }; }
  if (hasOperatorKeys(raw, 8)) return { ok: false, error: "That file contains keys Aegis does not accept (names starting with $ or containing dots)." };
  const doc = rec(raw);
  if (doc.format !== SETTINGS_FORMAT) return { ok: false, error: "That is not an Aegis settings export." };
  if (doc.version !== SETTINGS_FORMAT_VERSION) return { ok: false, error: `Unsupported export version (expected ${SETTINGS_FORMAT_VERSION}).` };

  const warnings: string[] = [];
  const cfg = normalizeGuildConfig("import", rec(doc.config) as never);
  const channelOk = (id: string | null | undefined, label: string): string | null => {
    if (!id) return null;
    if (ctx.hiddenChannelIds?.has(id)) { warnings.push(`${label}: Aegis can't see that channel here, so it was left empty.`); return null; }
    if (!ctx.textChannelIds.has(id)) { warnings.push(`${label}: that channel does not exist in this server, so it was left empty.`); return null; }
    return id;
  };
  const roleOk = (id: string | null | undefined, label: string): string | null => {
    if (!id) return null;
    const r = ctx.roles.get(id);
    if (!r) { warnings.push(`${label}: that role does not exist in this server, so it was left empty.`); return null; }
    if (!r.assignable || r.aboveViewer) { warnings.push(`${label}: that role is above Aegis or above your highest role, so it was left empty.`); return null; }
    return id;
  };

  const logChannels = cfg.logChannels
    ? Object.fromEntries(Object.entries(cfg.logChannels).flatMap(([k, v]) => { const ok = channelOk(v, `Log channel for ${k}`); return ok ? [[k, ok]] : []; }))
    : null;
  const incident = cfg.incident!;
  const keepChannels = (ids: string[], label: string) => ids.filter(id => channelOk(id, label) !== null);
  const update: GuildConfigUpdate = {
    loggingEnabled: cfg.loggingEnabled,
    loggingChannelId: channelOk(cfg.loggingChannelId, "Log channel"),
    logCategories: cfg.logCategories,
    logChannels: logChannels && Object.keys(logChannels).length ? logChannels : null,
    welcomeEnabled: cfg.welcomeEnabled,
    welcomeChannelId: channelOk(cfg.welcomeChannelId, "Welcome channel"),
    welcomeMessage: cfg.welcomeMessage,
    welcomeRoleId: roleOk(cfg.welcomeRoleId, "Welcome role"),
    welcomeEmbed: cfg.welcomeEmbed ?? null,
    goodbyeEnabled: cfg.goodbyeEnabled,
    goodbyeChannelId: channelOk(cfg.goodbyeChannelId ?? null, "Goodbye channel"),
    goodbyeMessage: cfg.goodbyeMessage,
    goodbyeEmbed: cfg.goodbyeEmbed ?? null,
    suggestionsChannelId: channelOk(cfg.suggestionsChannelId, "Suggestions channel"),
    escalation: cfg.escalation,
    tickets: { ...cfg.tickets, logChannelId: channelOk(cfg.tickets.logChannelId, "Ticket transcript channel") },
    roles: cfg.roles,
    autorespondersEnabled: cfg.autorespondersEnabled,
    incident: {
      ...incident,
      defaults: {
        ...incident.defaults,
        slowmodeChannelIds: keepChannels(incident.defaults.slowmodeChannelIds, "Incident slowmode channel"),
        lockChannelIds: keepChannels(incident.defaults.lockChannelIds, "Incident lock channel"),
      },
    },
    modules: cfg.modules,
  };
  // Turning logging or welcome on without a channel would do nothing; say so.
  if (update.loggingEnabled && !update.loggingChannelId) warnings.push("Logging stays on but has no channel yet; pick one on the Logging page.");
  if (update.welcomeEnabled && !update.welcomeChannelId) warnings.push("Welcome messages stay on but have no channel yet; pick one on the Welcome page.");

  let automod: Partial<Omit<AutomodConfig, "guildId">> | null = null;
  if (doc.automod !== undefined) {
    const a = rec(doc.automod);
    const channelHere = (id: unknown): id is string => typeof id === "string" && ctx.textChannelIds.has(id) && !ctx.hiddenChannelIds?.has(id);
    const roleHere = (id: unknown): id is string => typeof id === "string" && ctx.roles.has(id);
    let dropped = 0;
    const keep = (list: unknown, ok: (id: unknown) => id is string): string[] => {
      const all = Array.isArray(list) ? list : [];
      const kept = all.filter(ok);
      dropped += all.length - kept.length;
      return kept;
    };
    const exemptChannelIds = keep(a.exemptChannelIds, channelHere);
    const exemptRoleIds = keep(a.exemptRoleIds, roleHere);
    // Each rule can carry its own exemptions; they get the same check.
    const rules = Object.fromEntries(IMPORT_RULE_KEYS.map(key => {
      const rule = a[key];
      if (!rule || typeof rule !== "object" || Array.isArray(rule)) return [key, rule];
      const r = rule as Record<string, unknown>;
      return [key, {
        ...r,
        ...(r.exemptChannelIds !== undefined ? { exemptChannelIds: keep(r.exemptChannelIds, channelHere) } : {}),
        ...(r.exemptRoleIds !== undefined ? { exemptRoleIds: keep(r.exemptRoleIds, roleHere) } : {}),
      }];
    }));
    if (dropped > 0) warnings.push(`Automod: ${dropped} exempt channel(s) or role(s) don't exist in this server and were skipped.`);
    // updateAutomodConfig re-normalises every rule (actions, thresholds, word list caps).
    automod = {
      ...rules,
      ...(a.timeoutMinutes !== undefined ? { timeoutMinutes: a.timeoutMinutes } : {}),
      exemptChannelIds, exemptRoleIds,
    } as Partial<Omit<AutomodConfig, "guildId">>;
  }
  const economy = doc.economy === undefined ? null : normalizeEconomyConfig(rec(doc.economy));
  return { ok: true, update, automod, economy, warnings };
}
