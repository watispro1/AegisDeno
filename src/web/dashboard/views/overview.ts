import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { CaseRecord, OverviewData, SettingsSnapshot } from "../data";
import type { OverviewExtras } from "../moduleData";
import { type GuildContext, copyId, head, moduleStatus, person, personId, relTime, shell } from "./layout";
import { AUTOMOD_RULE_KEYS, enabledAutomodRules } from "../../../services/automod";
import { MODULE_CATEGORIES, READINESS_LABEL, type ModuleCategory, type Readiness, moduleMeta } from "../moduleDataCatalog";

/* Overview */

function actionBadgeClass(action: string): string {
  const act = action.toLowerCase();
  if (act.includes("ban")) return "tag ban";
  if (act.includes("kick")) return "tag kick";
  if (act.includes("timeout")) return "tag timeout";
  if (act.includes("warn")) return "tag warning";
  return "tag";
}

function caseRows(ctx: GuildContext, cases: CaseRecord[]): string {
  const g = esc(ctx.guild.id);
  return cases
    .map(c => `<tr>
      <td data-label="When">${relTime(c.createdAt)}</td>
      <td data-label="Action"><a class="case-link" href="/dashboard/${g}/cases/${esc(c.id)}"><span class="${actionBadgeClass(c.action)}">${esc(c.action)}</span></a>${c.revoked ? ' <span class="tag warn">revoked</span>' : ""} ${copyId(c.id, "Copy case ID")}</td>
      <td data-label="Member">${personId(ctx, c.userId)}</td>
      <td data-label="Moderator">${person(ctx, c.moderatorId)}</td>
      <td data-label="Reason">${esc(c.reason.length > 120 ? c.reason.slice(0, 117) + "…" : c.reason)}</td>
    </tr>`)
    .join("");
}

export function caseTable(ctx: GuildContext, cases: CaseRecord[], caption: string): string {
  return `<div class="table-wrap"><table class="case-table">
    <caption class="visually-hidden">${esc(caption)}</caption>
    <thead><tr><th scope="col">When</th><th scope="col">Action</th><th scope="col">Member</th><th scope="col">Moderator</th><th scope="col">Reason</th></tr></thead>
    <tbody>${caseRows(ctx, cases)}</tbody>
  </table></div>`;
}

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
      <div class="mod-card-top"><span class="mod-icon" aria-hidden="true">${esc(c.icon)}</span><h3 class="module-name">${esc(c.label)}</h3>${pill}</div>
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

export interface CheckItem { level: "warn" | "info"; text: string; href?: string }

/** The /diagnostics-style setup checklist. */
export function setupChecklist(guildId: string, m: OverviewModel): CheckItem[] {
  const items: CheckItem[] = [];
  const b = `/dashboard/${guildId}`;
  const s = m.snapshot;
  const hidden = m.hidden ?? new Set<string>();
  if (m.missingBotPermissions?.length) {
    items.push({ level: "warn", text: `Aegis's role is missing ${m.missingBotPermissions.join(", ")}. Some modules will fail until it is given in Server Settings → Roles.` });
  }
  if (s) {
    const configured: Array<[string | null | undefined, string, string]> = [
      [s.guild.loggingChannelId, "log channel", `${b}/settings/logging`],
      [s.guild.welcomeChannelId, "welcome channel", `${b}/settings/welcome`],
      [s.guild.goodbyeChannelId, "goodbye channel", `${b}/settings/goodbye`],
      [s.guild.suggestionsChannelId, "suggestions channel", `${b}/suggestions`],
      [s.tickets.logChannelId, "ticket transcript channel", `${b}/settings/tickets`],
      [s.starboard.channelId, "starboard channel", `${b}/settings/starboard`],
      [s.verification?.channelId, "verification panel channel", `${b}/settings/verification`],
      ...Object.entries(s.guild.logChannels ?? {}).map(([k, id]) => [id, `log channel for ${k}`, `${b}/settings/logging`] as [string, string, string]),
    ];
    for (const [id, what, href] of configured) {
      if (id && hidden.has(id)) items.push({ level: "warn", text: `Aegis can't see the ${what}. Give Aegis View Channel there, or pick another channel.`, href });
    }
    if (!s.guild.loggingEnabled || !s.guild.loggingChannelId) items.push({ level: "info", text: "Logging is off. Pick a log channel so moderation actions are recorded.", href: `${b}/settings/logging` });
    if (!enabledAutomodRules(s.automod).length) items.push({ level: "info", text: "No automod rules are on.", href: `${b}/settings/automod` });
  }
  if (hidden.size > 0) {
    items.push({ level: "info", text: `${hidden.size} channel${hidden.size === 1 ? " is" : "s are"} hidden from Aegis. From 2026-11-16 Discord hides channels a bot can't view (View Channel); Aegis skips them and never posts there. Give Aegis View Channel in any it should use.` });
  }
  return items;
}

function checklistHtml(items: CheckItem[]): string {
  if (!items.length) return `<p class="check-ok">✓ Everything Aegis checks looks good.</p>`;
  return `<ul class="checklist">${items.map(i => `<li class="${i.level}"><span class="check-icon" aria-hidden="true">${i.level === "warn" ? "!" : "i"}</span><span>${esc(i.text)}${i.href ? ` <a href="${esc(i.href)}">Fix</a>` : ""}</span></li>`).join("")}</ul>`;
}

/** A 30-day bar chart as plain SVG (no scripts, no external libraries). */
export function casesChart(series: number[], endMs: number): string {
  const max = Math.max(1, ...series);
  const w = 600, h = 140, gap = 2, bw = (w - gap * (series.length - 1)) / series.length;
  const day = (i: number) => new Date(Math.floor(endMs / 86_400_000) * 86_400_000 - (series.length - 1 - i) * 86_400_000).toISOString().slice(0, 10);
  const total = series.reduce((a, n) => a + n, 0);
  const bars = series.map((n, i) => {
    const bh = n === 0 ? 1 : Math.max(3, Math.round((n / max) * (h - 10)));
    return `<rect class="bar${n === 0 ? " zero" : ""}" x="${(i * (bw + gap)).toFixed(1)}" y="${h - bh}" width="${bw.toFixed(1)}" height="${bh}"><title>${day(i)}: ${n} case${n === 1 ? "" : "s"}</title></rect>`;
  }).join("");
  return `<figure class="chart">
    <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Cases and warnings per day for the last 30 days, ${total} in total, at most ${max} on one day" preserveAspectRatio="none">${bars}</svg>
    <figcaption><span>${esc(day(0))}</span><span>${total.toLocaleString("en-US")} in 30 days · peak ${max.toLocaleString("en-US")}/day</span><span>today</span></figcaption>
  </figure>`;
}

export function renderOverview(cfg: SiteConfig, ctx: GuildContext, data: OverviewData, model: OverviewModel = {}): string {
  const g = ctx.guild;
  const base = `/dashboard/${esc(g.id)}`;
  const card = (label: string, value: number, note = "", href?: string) => {
    const inner = `<dt>${esc(label)}</dt><dd>${value.toLocaleString("en-US")}${note ? ` <small>${esc(note)}</small>` : ""}</dd>`;
    return `<div class="stat">${href ? `<a class="stat-link" href="${esc(href)}">${inner}</a>` : inner}</div>`;
  };
  const x = model.extras;
  const tickets = data.openTickets.length
    ? `<ul class="feed">${data.openTickets
        .map(t => `<li><strong>#${esc(t.id)}</strong> ${copyId(String(t.id), "Copy ticket ID")} opened by ${personId(ctx, t.userId)}, ${relTime(t.createdAt)}${
          t.claimedBy ? `, claimed by ${person(ctx, t.claimedBy)}` : ", unclaimed"
        }</li>`)
        .join("")}</ul>${data.openTicketCount > data.openTickets.length ? `<p class="muted">Showing the newest ${data.openTickets.length} of ${data.openTicketCount}.</p>` : ""}`
    : `<p class="muted">No open tickets.</p>`;
  const states = moduleCards(g.id, data, model);
  const checks = setupChecklist(g.id, model);

  return shell(cfg, {
    title: g.name,
    path: `/dashboard/${g.id}`,
    viewer: ctx.viewer,
    guild: ctx,
    active: "overview",
    body: `${head(g.name, "Overview of moderation and modules in this server.", [["Servers", "/dashboard"], [g.name, null]])}
  <h2 class="visually-hidden">Last 7 and 30 days</h2>
  <dl class="stat-grid">
    ${card("Members", g.memberCount)}
    ${card("Cases, 7 days", data.cases7, "", `${base}/cases`)}
    ${card("Cases, 30 days", data.cases30, "", `${base}/cases`)}
    ${card("Warnings, 7 days", data.warnings7)}
    ${card("Warnings, 30 days", data.warnings30)}
    ${card("Open tickets", data.openTicketCount)}
    ${model.pingMs !== undefined && model.pingMs !== null && model.pingMs >= 0 ? card("Bot latency", model.pingMs, "ms") : ""}
    ${card("Pending appeals", data.pendingAppeals, data.pendingAppeals > 0 ? "see Appeals" : "", `${base}/appeals`)}
    ${x ? card("Active giveaways", x.activeGiveaways, "", `${base}/giveaways`) : ""}
    ${x ? card("Automod hits, 7 days", x.automodHits7, "", `${base}/settings/automod`) : ""}
  </dl>
  <div class="overview-grid">
    <section class="panel-card span-2" aria-labelledby="chart-h">
      <h2 id="chart-h">Cases per day</h2>
      ${x ? casesChart(x.casesPerDay, Date.now()) : `<p class="muted">The chart appears once Aegis can read case history.</p>`}
    </section>
    <section class="panel-card" aria-labelledby="checklist-h">
      <h2 id="checklist-h">Setup checklist</h2>
      ${checklistHtml(checks)}
    </section>
  </div>
  <section class="panel-card" aria-labelledby="quick-actions-h">
    <h2 id="quick-actions-h">Quick Actions</h2>
    <div class="btn-row">
      <a class="btn ghost sm" href="${base}/cases">View Recent Cases</a>
      <a class="btn ghost sm" href="${base}/settings/automod">Automod Rules</a>
      <a class="btn ghost sm" href="${base}/settings/logging">Configure Logging</a>
      <a class="btn ghost sm" href="${base}/incident">Incident Mode</a>
    </div>
  </section>
  ${states.length ? `<section class="mod-section" aria-labelledby="modules-h"><h2 id="modules-h">Modules</h2>${moduleGrid(states, model)}</section>` : ""}
  <h2>Recent cases</h2>
  ${data.recentCases.length ? caseTable(ctx, data.recentCases, "The 10 most recent cases and warnings") : `<div class="empty-state"><strong>No cases yet.</strong> Cases and warnings appear here as moderators use /warn, /timeout, /kick and /ban.</div>`}
  <p><a class="text-link" href="${base}/cases">All cases &rarr;</a></p>
  ${data.pendingAppeals > 0 ? `<p><a class="text-link" href="${base}/appeals">Review ${data.pendingAppeals.toLocaleString("en-US")} pending appeal${data.pendingAppeals === 1 ? "" : "s"} &rarr;</a></p>` : ""}
  <h2>Open tickets</h2>
  ${tickets}`,
  });
}
