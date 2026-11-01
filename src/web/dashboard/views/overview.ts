import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { CaseRecord, OverviewData, SettingsSnapshot } from "../data";
import type { OverviewExtras } from "../moduleData";
import { type GuildContext, fmtDate, head, moduleStatus, person, shell } from "./layout";

/* ── Overview ──────────────────────────────────────────────────────── */

function caseRows(ctx: GuildContext, cases: CaseRecord[]): string {
  const g = esc(ctx.guild.id);
  return cases
    .map(c => `<tr>
      <td data-label="When">${esc(fmtDate(c.createdAt))}</td>
      <td data-label="Action"><a class="case-link" href="/dashboard/${g}/cases/${esc(c.id)}">${esc(c.action)}</a>${c.revoked ? ' <span class="tag warn">revoked</span>' : ""}</td>
      <td data-label="Member">${person(ctx, c.userId)}</td>
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
}

export interface ModuleState {
  key: string;
  label: string;
  href: string;
  /** null: the module has no single on/off switch. */
  on: boolean | null;
  detail: string;
}

export function moduleStates(guildId: string, data: OverviewData, m: OverviewModel): ModuleState[] {
  const s = m.snapshot;
  const x = m.extras;
  const b = `/dashboard/${guildId}`;
  if (!s) return [];
  const a = s.automod;
  const rules = [a.words, a.links, a.mentions, a.spam, a.caps].filter(r => r.enabled).length;
  // Module switches from the Modules & backup page (absent means on).
  const sw = (key: "tickets" | "giveaways" | "scheduled" | "appeals") => s.guild.modules?.[key] !== false;
  const auto = s.guild.incident?.autoTrigger;
  return [
    { key: "incident", label: "Incident Mode", href: `${b}/incident`, on: null, detail: auto?.enabled ? `Auto-trigger: ${auto.joins} joins / ${auto.seconds}s` : "Ready; auto-trigger off" },
    { key: "moderation", label: "Moderation", href: `${b}/settings/escalation`, on: s.guild.escalation.enabled, detail: s.guild.escalation.enabled ? `${s.guild.escalation.thresholds.length} escalation step${s.guild.escalation.thresholds.length === 1 ? "" : "s"}` : "Escalation off" },
    { key: "automod", label: "Automod", href: `${b}/settings/automod`, on: rules > 0, detail: `${rules} of 5 rules on` },
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

export function moduleGrid(states: ModuleState[]): string {
  if (!states.length) return "";
  return `<ul class="module-grid">${states.map(st => `<li class="module-card">
      <a href="${esc(st.href)}"><span class="module-name">${esc(st.label)}</span>
      ${st.on === null ? `<span class="status-pill neutral">Available</span>` : moduleStatus(st.on)}
      <span class="module-detail">${esc(st.detail)}</span></a>
    </li>`).join("")}</ul>`;
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
    const a = s.automod;
    if (![a.words, a.links, a.mentions, a.spam, a.caps].some(r => r.enabled)) items.push({ level: "info", text: "No automod rules are on.", href: `${b}/settings/automod` });
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
        .map(t => `<li><strong>#${esc(t.id)}</strong> opened by ${person(ctx, t.userId)}, ${esc(fmtDate(t.createdAt))}${
          t.claimedBy ? `, claimed by ${person(ctx, t.claimedBy)}` : ", unclaimed"
        }</li>`)
        .join("")}</ul>${data.openTicketCount > data.openTickets.length ? `<p class="muted">Showing the newest ${data.openTickets.length} of ${data.openTicketCount}.</p>` : ""}`
    : `<p class="muted">No open tickets.</p>`;
  const states = moduleStates(g.id, data, model);
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
  ${states.length ? `<h2>Modules</h2>${moduleGrid(states)}` : ""}
  <h2>Recent cases</h2>
  ${data.recentCases.length ? caseTable(ctx, data.recentCases, "The 10 most recent cases and warnings") : `<div class="empty-state"><strong>No cases yet.</strong> Cases and warnings appear here as moderators use /warn, /timeout, /kick and /ban.</div>`}
  <p><a class="text-link" href="${base}/cases">All cases &rarr;</a></p>
  ${data.pendingAppeals > 0 ? `<p><a class="text-link" href="${base}/appeals">Review ${data.pendingAppeals.toLocaleString("en-US")} pending appeal${data.pendingAppeals === 1 ? "" : "s"} &rarr;</a></p>` : ""}
  <h2>Open tickets</h2>
  ${tickets}`,
  });
}
