/**
 * The overview's module model: each module's on/off state, readiness and
 * catalog facts, and the filterable module grid (also used on Settings).
 */
import { escapeHtml as esc } from "../../pages";
import type { OverviewData, SettingsSnapshot } from "../data";
import type { OverviewExtras } from "../moduleData";
import type { AuditEntry } from "../audit";
import { moduleStatus } from "./layout";
import { hasIcon, icon } from "./icons";
import { AUTOMOD_RULE_KEYS, enabledAutomodRules } from "../../../services/automod";
import { MODULE_CATEGORIES, READINESS_LABEL, type ModuleCategory, type Readiness, moduleMeta } from "../moduleDataCatalog";

/** Everything the richer overview, module grid and checklist read. All optional parts degrade to the old overview. */
export interface OverviewModel {
  extras?: OverviewExtras | null;
  snapshot?: SettingsSnapshot | null;
  rolePanels?: number;
  hidden?: ReadonlySet<string>;
  /** Permissions Aegis's role is missing server-wide (labels). */
  missingBotPermissions?: string[];
  /** Bot websocket ping in ms, or null if unavailable. */
  pingMs?: number | null;
  /** Newest dashboard changes for "Recent activity"; null when the read failed, undefined to hide the card. */
  audit?: AuditEntry[] | null;
  /** The data layer can store the "Get started" dismissal. */
  canDismissOnboarding?: boolean;
  /** ?notice= code from a redirect (e.g. after Dismiss). */
  noticeCode?: string | null;
}

export interface ModuleState {
  key: string;
  label: string;
  href: string;
  /** null: the module has no single on/off switch. */
  on: boolean | null;
  detail: string;
}

/** A module card on the overview: the state plus its catalog facts and readiness. */
export interface ModuleCard extends ModuleState {
  icon: string;
  description: string;
  category: ModuleCategory;
  readiness: Readiness;
  /** Short reason shown under the readiness label ("" when configured). */
  note: string;
}

/**
 * Readiness from the same facts the setup checklist reads: a saved channel
 * Aegis can't see (or a missing role permission) is a problem; a switched-on
 * module with nothing to post to needs setup; a switched-off one is not in use.
 */
export function moduleReadiness(st: ModuleState, m: OverviewModel): { readiness: Readiness; note: string } {
  const s = m.snapshot;
  const hidden = m.hidden ?? new Set<string>();
  const missing = m.missingBotPermissions ?? [];
  if (!s) return { readiness: st.on === false ? "off" : "ready", note: "" };
  const channelOf: Record<string, string | null | undefined> = {
    logging: s.guild.loggingChannelId,
    welcome: s.guild.welcomeChannelId,
    goodbye: s.guild.goodbyeChannelId,
    tickets: s.tickets.logChannelId,
    starboard: s.starboard.channelId,
    verification: s.verification?.channelId,
    suggestions: s.guild.suggestionsChannelId,
  };
  const ch = channelOf[st.key];
  if (ch && hidden.has(ch)) return { readiness: "problem", note: "Aegis can't see its channel" };
  if (st.key === "logging" && Object.values(s.guild.logChannels ?? {}).some(id => id && hidden.has(id))) {
    return { readiness: "problem", note: "A log channel is hidden from Aegis" };
  }
  const needsRoles = st.key === "verification" || st.key === "panels" || (st.key === "welcome" && Boolean(s.guild.welcomeRoleId));
  if (needsRoles && st.on !== false && missing.some(p => /manage roles/i.test(p))) return { readiness: "problem", note: "Aegis is missing Manage Roles" };
  if (st.key === "verification" && !s.verification) return { readiness: "setup", note: "Post the verification panel" };
  if (st.on === false) return { readiness: "off", note: "" };
  const needsChannel: Record<string, string> = {
    logging: "Pick a log channel", welcome: "Pick a welcome channel", goodbye: "Pick a goodbye channel", starboard: "Pick a starboard channel",
  };
  if (needsChannel[st.key] && !ch) return { readiness: "setup", note: needsChannel[st.key] };
  if (st.key === "tickets" && s.tickets.transcriptLogging && !s.tickets.logChannelId) return { readiness: "setup", note: "Pick a transcript channel" };
  if (st.key === "panels" && !m.rolePanels) return { readiness: "setup", note: "No panels posted yet" };
  if (st.key === "moderation" && !s.guild.escalation.thresholds.length) return { readiness: "setup", note: "Add an escalation step" };
  return { readiness: "ready", note: "" };
}

export function moduleCards(guildId: string, data: OverviewData, m: OverviewModel): ModuleCard[] {
  return moduleStates(guildId, data, m).map(st => {
    const meta = moduleMeta(st.key);
    return { ...st, icon: meta.icon, description: meta.description, category: meta.category, ...moduleReadiness(st, m) };
  });
}

export function moduleStates(guildId: string, data: OverviewData, m: OverviewModel): ModuleState[] {
  const s = m.snapshot;
  const x = m.extras;
  const b = `/dashboard/${guildId}`;
  if (!s) return [];
  const rules = enabledAutomodRules(s.automod).length;
  // Module switches from the Modules & backup page (absent means on).
  const sw = (key: "tickets" | "giveaways" | "scheduled" | "appeals") => s.guild.modules?.[key] !== false;
  const auto = s.guild.incident?.autoTrigger;
  return [
    { key: "incident", label: "Incident Mode", href: `${b}/incident`, on: null, detail: auto?.enabled ? `Auto-trigger: ${auto.joins} joins / ${auto.seconds}s` : "Ready; auto-trigger off" },
    { key: "moderation", label: "Moderation", href: `${b}/settings/escalation`, on: s.guild.escalation.enabled, detail: s.guild.escalation.enabled ? `${s.guild.escalation.thresholds.length} escalation step${s.guild.escalation.thresholds.length === 1 ? "" : "s"}` : "Escalation off" },
    { key: "automod", label: "Automod", href: `${b}/settings/automod`, on: rules > 0, detail: `${rules} of ${AUTOMOD_RULE_KEYS.length} rules on` },
    { key: "logging", label: "Logging", href: `${b}/settings/logging`, on: s.guild.loggingEnabled && Boolean(s.guild.loggingChannelId), detail: s.guild.loggingChannelId ? "Log channel set" : "No log channel" },
    { key: "welcome", label: "Welcome", href: `${b}/settings/welcome`, on: s.guild.welcomeEnabled, detail: s.guild.welcomeEmbed ? "Message and embed" : "Message" },
    { key: "goodbye", label: "Goodbye", href: `${b}/settings/goodbye`, on: s.guild.goodbyeEnabled === true, detail: s.guild.goodbyeChannelId ? "Channel set" : "No channel" },
    { key: "verification", label: "Verification", href: `${b}/settings/verification`, on: s.verification?.enabled ?? false, detail: s.verification ? s.verification.type : "Not set up" },
    { key: "panels", label: "Role panels", href: `${b}/panels`, on: null, detail: `${m.rolePanels ?? 0} panel${m.rolePanels === 1 ? "" : "s"}` },
    { key: "tickets", label: "Tickets", href: `${b}/settings/tickets`, on: sw("tickets"), detail: `${data.openTicketCount} open` },
    { key: "starboard", label: "Starboard", href: `${b}/settings/starboard`, on: s.starboard.enabled && Boolean(s.starboard.channelId), detail: `${s.starboard.threshold} × ${s.starboard.emoji}` },
    { key: "suggestions", label: "Suggestions", href: `${b}/suggestions`, on: Boolean(s.guild.suggestionsChannelId), detail: x ? `${x.openSuggestions} open` : "" },
    { key: "giveaways", label: "Giveaways", href: `${b}/giveaways`, on: sw("giveaways"), detail: x ? `${x.activeGiveaways} running` : "" },
    { key: "autoresponders", label: "Autoresponders", href: `${b}/autoresponders`, on: s.guild.autorespondersEnabled !== false, detail: x ? `${x.autoresponders} saved` : "" },
    { key: "automations", label: "Scheduled messages", href: `${b}/automations`, on: sw("scheduled"), detail: x ? `${x.scheduled} pending` : "" },
    { key: "appeals", label: "Appeals", href: `${b}/appeals`, on: sw("appeals"), detail: `${data.pendingAppeals} pending` },
  ];
}

function moduleCardHtml(c: ModuleCard): string {
  const pill = c.on === null ? `<span class="status-pill neutral">Available</span>` : moduleStatus(c.on, c.on ? "On" : "Off");
  const filterText = [c.label, c.description, c.category, READINESS_LABEL[c.readiness]].join(" ").toLowerCase();
  return `<li class="module-card mod-card" data-filter-text="${esc(filterText)}" data-module-key="${esc(c.key)}" data-readiness="${c.readiness}">
      <div class="mod-card-top"><span class="mod-icon" aria-hidden="true">${hasIcon(c.key) ? icon(c.key) : esc(c.icon)}</span><h3 class="module-name">${esc(c.label)}</h3>${pill}</div>
      ${c.description ? `<p class="mod-desc">${esc(c.description)}</p>` : ""}
      <p class="mod-state ${c.readiness}"><span class="mod-state-dot" aria-hidden="true"></span><span class="mod-state-label">${esc(READINESS_LABEL[c.readiness])}</span>${c.note ? `<span class="mod-state-note">${esc(c.note)}</span>` : ""}</p>
      ${c.detail ? `<p class="module-detail">${esc(c.detail)}</p>` : ""}
      <a class="mod-configure" href="${esc(c.href)}">Configure<span class="visually-hidden"> ${esc(c.label)}</span> <span aria-hidden="true">&rarr;</span></a>
    </li>`;
}

/** Totals for the summary line above the grid. */
export function moduleTotals(cards: ModuleCard[]): Record<Readiness, number> & { on: number } {
  const t = { ready: 0, setup: 0, problem: 0, off: 0, on: 0 };
  for (const c of cards) { t[c.readiness]++; if (c.on === true) t.on++; }
  return t;
}

/**
 * The overview's module grid: cards grouped by category, each with its own
 * on/off pill, readiness and Configure link. A search box and category /
 * readiness buttons (clientModules.ts) filter it; without JavaScript the
 * toolbar stays hidden and every card shows.
 */
export function moduleGrid(states: ModuleState[] | ModuleCard[], m: OverviewModel = {}): string {
  if (!states.length) return "";
  const cards: ModuleCard[] = states.map(st => ("readiness" in st ? st : { ...st, ...moduleMeta(st.key), ...moduleReadiness(st, m) }) as ModuleCard);
  const t = moduleTotals(cards);
  const groups = MODULE_CATEGORIES.map(cat => [cat, cards.filter(c => c.category === cat)] as const).filter(([, list]) => list.length);
  const btn = (value: string, label: string, n?: number) =>
    `<button class="mod-chip" type="button" data-module-chip="${esc(value)}" aria-pressed="${value === "all" ? "true" : "false"}">${esc(label)}${n === undefined ? "" : ` <span class="mod-chip-n">${n}</span>`}</button>`;
  const summary = [`${t.on} on`, t.setup ? `${t.setup} need${t.setup === 1 ? "s" : ""} setup` : "", t.problem ? `${t.problem} with a problem` : ""].filter(Boolean).join(" · ");
  return `<div class="mod-board" data-module-board>
    <div class="mod-board-head"><p class="mod-summary">${esc(summary)} <span class="faint">of ${cards.length} modules</span></p>
    <div class="mod-tools" data-module-tools hidden>
      <label class="visually-hidden" for="module-filter">Filter modules</label>
      <input class="mod-filter" type="search" id="module-filter" placeholder="Filter modules…" autocomplete="off" data-module-filter>
      <div class="mod-chips" role="group" aria-label="Show">${btn("all", "All")}${groups.map(([cat, list]) => btn(cat, cat, list.length)).join("")}${t.setup || t.problem ? btn("attention", "Needs attention", t.setup + t.problem) : ""}</div>
      <span class="faint mod-count" data-module-count aria-live="polite"></span>
    </div></div>
    ${groups.map(([cat, list]) => `<section class="mod-group" data-module-group="${esc(cat)}" aria-labelledby="mod-group-${esc(cat.toLowerCase())}">
      <h3 class="mod-group-title" id="mod-group-${esc(cat.toLowerCase())}">${esc(cat)} <span class="faint">${list.length}</span></h3>
      <ul class="module-grid">${list.map(moduleCardHtml).join("")}</ul>
    </section>`).join("")}
    <p class="muted mod-empty" data-module-empty hidden>No modules match.</p>
  </div>`;
}

