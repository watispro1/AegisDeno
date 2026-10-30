/**
 * Server-rendered HTML for the web dashboard. Every dynamic value goes through
 * `esc()`; nothing here reads the request directly.
 */
import { layout } from "../layout";
import { escapeHtml as esc, type SiteConfig } from "../pages";
import type { ChannelOption, GuildSummary, RoleOption } from "./botView";
import type { AppealRecord, CaseRecord, OverviewData, RolePanelSummary, SettingsSnapshot } from "./data";
import type { AuditEntry } from "./audit";
import { DASHBOARD_VERSION } from "../../version";
import type { OAuthGuild } from "./permissions";
import {
  AUTOMOD_ACTIONS,
  CASE_REASON_MAX,
  CASE_TYPES,
  ESCALATION_ROWS,
  LOG_CATEGORY_LABELS,
  MAX_TIMEOUT_MINUTES,
  SECTION_TITLES,
  SETTINGS_SECTIONS,
  WELCOME_MESSAGE_MAX,
  AUTOMOD_WORD_MAX,
  AUTOMOD_WORDS_MAX_COUNT,
  AUTOMOD_WORDS_TEXT_MAX,
  APPEAL_FILTERS,
  APPEAL_REVIEW_NOTE_MAX,
  CASE_QUERY_MAX,
  PANEL_TITLE_MAX,
  TICKET_PANEL_DESCRIPTION_MAX,
  VERIFY_PANEL_DESCRIPTION_MAX,
  welcomePreview,
  type AppealFilter,
  type CaseFilter,
  type FormBody,
  type SettingsSection,
} from "./validation";
import { MAX_WARN_EXPIRY_DAYS } from "../../services/configuration";
import { MAX_TICKET_AUTOCLOSE_HOURS } from "../../services/ticketTranscript";
import { MAX_KICK_UNVERIFIED_MINUTES } from "../../services/verificationLogic";

export interface Viewer {
  userId: string;
  username: string;
  globalName: string | null;
  csrf: string;
}

export interface GuildContext {
  guild: GuildSummary;
  viewer: Viewer;
  /** Resolves a user ID to a cached username, if the bot has seen them. */
  nameOf: (userId: string) => string | null;
}

/* ── Shell ─────────────────────────────────────────────────────────── */

function shell(cfg: SiteConfig, o: { title: string; path: string; body: string; viewer?: Viewer; scripts?: boolean }): string {
  const v = cfg.assetVersion ? `?v=${encodeURIComponent(cfg.assetVersion)}` : "";
  const bar = o.viewer
    ? `<div class="dash-bar">
    <span>Signed in as <strong>${esc(o.viewer.globalName || o.viewer.username)}</strong> <span class="faint">(${esc(o.viewer.username)})</span></span>
    <form method="post" action="/dashboard/logout">
      ${csrfField(o.viewer)}
      <button class="btn ghost sm" type="submit">Log out</button>
    </form>
  </div>`
    : "";
  return layout({
    title: `${o.title} | Aegis dashboard`,
    description: "Manage Aegis for your Discord server: moderation cases and settings.",
    path: o.path,
    current: "/dashboard",
    body: `<div class="wrap">${bar}${o.body}
  <p class="muted">Dashboard v${esc(DASHBOARD_VERSION)}. <a href="/dashboard/changelog">Dashboard changelog</a>: what changed in the dashboard.</p></div>`,
    inviteUrl: cfg.inviteUrl,
    supportUrl: cfg.supportUrl,
    version: cfg.version,
    ogImage: "/assets/og.png",
    noindex: true,
    omitCanonical: true,
    assetVersion: cfg.assetVersion,
    scripts: o.scripts === false ? "" : `<script src="/assets/dashboard.js${v}" defer></script>`,
  });
}

function csrfField(viewer: Viewer): string {
  return `<input type="hidden" name="_csrf" value="${esc(viewer.csrf)}">`;
}

function head(title: string, lead: string, crumbs: Array<[string, string | null]> = []): string {
  const trail = crumbs.length
    ? `<nav class="breadcrumbs" aria-label="Breadcrumb">${crumbs
        .map(([label, href]) => (href ? `<a href="${esc(href)}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`))
        .join(`<span class="sep" aria-hidden="true">/</span>`)}</nav>`
    : "";
  return `${trail}<div class="page-head"><h1>${esc(title)}</h1>${lead ? `<p class="lead">${lead}</p>` : ""}</div>`;
}

export type GuildSection = "overview" | "cases" | "appeals" | "panels" | "settings" | "activity";

function guildNav(guildId: string, active: GuildSection): string {
  const base = `/dashboard/${esc(guildId)}`;
  const item = (key: GuildSection, label: string, href: string) =>
    `<li><a href="${href}"${key === active ? ' aria-current="page"' : ""}>${label}</a></li>`;
  return `<nav aria-label="Server sections"><ul class="dash-nav">
    ${item("overview", "Overview", base)}
    ${item("cases", "Cases", `${base}/cases`)}
    ${item("appeals", "Appeals", `${base}/appeals`)}
    ${item("panels", "Panels", `${base}/panels`)}
    ${item("settings", "Settings", `${base}/settings`)}
    ${item("activity", "Activity", `${base}/activity`)}
  </ul></nav>`;
}

const NOTICES: Record<string, { text: string; bad?: boolean }> = {
  saved: { text: "Saved. Aegis uses the new settings from now on." },
  reason: { text: "Reason updated. The change was posted to your log channel if logging is on." },
  revoked: { text: "Marked as revoked. It stays in the record but no longer counts toward totals or escalation." },
  "already-revoked": { text: "That record was already revoked, or it no longer exists.", bad: true },
  "verification-missing": { text: "Verification is not set up yet. Post the verification panel from the Panels page (or run /verify setup in Discord) first.", bad: true },
  "revoked-unbanned": { text: "Revoked, and the member was unbanned in Discord. The unban was recorded as a new case and posted to your log channel." },
  "revoked-not-banned": { text: "Revoked. The member was not banned in Discord any more, so there was nothing to lift.", bad: true },
  "revoked-unban-failed": { text: "Revoked, but Discord refused the unban. Check that Aegis has Ban Members, then use /unban.", bad: true },
  "appeal-approved": { text: "Appeal approved. The member was unbanned and told by DM if their DMs are open." },
  "appeal-approved-unban-failed": { text: "Appeal approved, but Discord refused the unban. Check that Aegis has Ban Members, then use /unban.", bad: true },
  "appeal-denied": { text: "Appeal denied. The ban stays, and the member was told by DM if their DMs are open." },
  "appeal-reviewed": { text: "That appeal was already reviewed, so nothing changed.", bad: true },
  "panel-posted": { text: "Panel posted. Earlier Aegis panels of the same kind in that channel were removed." },
  "verification-posted": { text: "Verification panel posted and verification turned on. You can now change its settings here." },
  "rolepanel-posted": { text: "Role panel posted again. The old message was removed; members' roles are unchanged." },
  "panel-channel-missing": { text: "Aegis cannot see that channel any more. Give Aegis the View Channel permission there, or pick another one.", bad: true },
  "panel-not-found": { text: "That role panel no longer exists. It may have been deleted with /rolepanel.", bad: true },
  "panel-failed": { text: "Discord refused the message. Check that Aegis can view the channel, send messages, embed links and read message history there.", bad: true },
  refreshed: { text: "Server list refreshed from Discord." },
  "refresh-failed": { text: "Discord did not return your server list. Log out and back in to refresh it.", bad: true },
};

function notice(code: string | null | undefined): string {
  const n = code ? NOTICES[code] : undefined;
  if (!n) return "";
  return `<div class="notice${n.bad ? " bad" : ""}" role="status"><p>${esc(n.text)}</p></div>`;
}

function fmtDate(d: Date): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "unknown";
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function person(ctx: GuildContext, id: string): string {
  const name = ctx.nameOf(id);
  return name ? `${esc(name)} <span class="faint">${esc(id)}</span>` : `<code class="inline">${esc(id)}</code>`;
}

/* ── Public pages ──────────────────────────────────────────────────── */

export function renderNotConfigured(cfg: SiteConfig): string {
  return shell(cfg, {
    title: "Dashboard not configured",
    path: "/dashboard",
    scripts: false,
    body: `${head("The dashboard is not configured", "This copy of Aegis has the web dashboard turned off. Every setting is still available through slash commands in Discord.")}
  <ul class="notes">
    <li>Server owners: run <code class="inline">/config</code>, <code class="inline">/logging</code> or <code class="inline">/automod</code> in your server.</li>
    <li>Running your own copy? The setup steps are in <code class="inline">DEPLOYMENT.md</code> under Web dashboard.</li>
    <li><a href="/commands">Browse every command</a></li>
  </ul>`,
  });
}

export function renderLanding(cfg: SiteConfig, error: string | null): string {
  const errors: Record<string, string> = {
    denied: "Discord login was cancelled. Nothing was shared.",
    state: "That login link expired or was opened in a different browser. Try again from this page.",
    discord: "Discord did not complete the login. Try again in a minute.",
  };
  const message = error && errors[error] ? `<div class="notice bad" role="alert"><p>${esc(errors[error])}</p></div>` : "";
  return shell(cfg, {
    title: "Dashboard",
    path: "/dashboard",
    scripts: false,
    body: `${head("Aegis dashboard", "Look through moderation cases and change server settings from a browser. You need Manage Server or Administrator in the server.")}
  ${message}
  <div class="btn-row"><a class="btn" href="/dashboard/login">Log in with Discord</a></div>
  <h2 class="section-title">What it can see</h2>
  <ul class="notes">
    <li>Your Discord username and the list of servers you are in. Aegis asks for the <code class="inline">identify</code> and <code class="inline">guilds</code> scopes only. It cannot read your messages or act as you.</li>
    <li>A session cookie keeps you signed in for up to 7 days. Logging out deletes it.</li>
    <li>Every page re-checks with Discord that you still have Manage Server in that server.</li>
  </ul>`,
  });
}

export function renderError(cfg: SiteConfig, o: { status: number; title: string; message: string; viewer?: Viewer }): string {
  return shell(cfg, {
    title: o.title,
    path: "/dashboard",
    viewer: o.viewer,
    scripts: false,
    body: `${head(o.title, esc(o.message))}
  <div class="btn-row"><a class="btn ghost" href="/dashboard">Back to your servers</a></div>`,
  });
}

/* ── Server picker ─────────────────────────────────────────────────── */

export function renderPicker(
  cfg: SiteConfig,
  viewer: Viewer,
  manageable: OAuthGuild[],
  invitable: Array<{ guild: OAuthGuild; inviteUrl: string | null }>,
  noticeCode: string | null,
): string {
  const list = manageable.length
    ? `<ul class="guild-list">${manageable
        .map(g => `<li><a class="guild-item" href="/dashboard/${esc(g.id)}"><span class="name">${esc(g.name)}</span><span aria-hidden="true">&rarr;</span></a></li>`)
        .join("")}</ul>`
    : `<div class="empty-state"><strong>No servers to manage yet.</strong>Aegis is not in any server where you have Manage Server or Administrator.</div>`;

  const invites = invitable.length
    ? `<h2>Servers without Aegis</h2>
  <p class="muted">You manage these, but Aegis is not in them.</p>
  <ul class="guild-list">${invitable
        .map(({ guild, inviteUrl }) => `<li><div class="guild-item"><span class="name">${esc(guild.name)}</span>${
          inviteUrl ? `<a class="btn ghost sm" href="${esc(inviteUrl)}" rel="noopener noreferrer">Add Aegis<span class="visually-hidden"> to ${esc(guild.name)}</span></a>` : ""
        }</div></li>`)
        .join("")}</ul>`
    : "";

  return shell(cfg, {
    title: "Your servers",
    path: "/dashboard",
    viewer,
    body: `${head("Your servers", "Servers where you have Manage Server or Administrator and Aegis is a member.")}
  ${notice(noticeCode)}
  ${list}
  ${invites}
  <form class="dash-action" method="post" action="/dashboard/refresh">
    ${csrfField(viewer)}
    <p class="muted">Added Aegis somewhere or got a new role? <button class="btn ghost sm" type="submit">Refresh the list</button></p>
  </form>`,
  });
}

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

function caseTable(ctx: GuildContext, cases: CaseRecord[], caption: string): string {
  return `<div class="table-wrap"><table class="case-table">
    <caption class="visually-hidden">${esc(caption)}</caption>
    <thead><tr><th scope="col">When</th><th scope="col">Action</th><th scope="col">Member</th><th scope="col">Moderator</th><th scope="col">Reason</th></tr></thead>
    <tbody>${caseRows(ctx, cases)}</tbody>
  </table></div>`;
}

export function renderOverview(cfg: SiteConfig, ctx: GuildContext, data: OverviewData): string {
  const g = ctx.guild;
  const stat = (label: string, value: number, note = "") =>
    `<div class="stat"><dt>${esc(label)}</dt><dd>${value.toLocaleString("en-US")}${note ? ` <small>${esc(note)}</small>` : ""}</dd></div>`;
  const tickets = data.openTickets.length
    ? `<ul class="notes">${data.openTickets
        .map(t => `<li><strong>#${esc(t.id)}</strong> opened by ${person(ctx, t.userId)}, ${esc(fmtDate(t.createdAt))}${
          t.claimedBy ? `, claimed by ${person(ctx, t.claimedBy)}` : ", unclaimed"
        }</li>`)
        .join("")}</ul>${data.openTicketCount > data.openTickets.length ? `<p class="muted">Showing the newest ${data.openTickets.length} of ${data.openTicketCount}.</p>` : ""}`
    : `<p class="muted">No open tickets.</p>`;

  return shell(cfg, {
    title: g.name,
    path: `/dashboard/${g.id}`,
    viewer: ctx.viewer,
    body: `${head(g.name, "", [["Servers", "/dashboard"], [g.name, null]])}
  ${guildNav(g.id, "overview")}
  <h2>Last 7 and 30 days</h2>
  <dl class="stat-grid">
    ${stat("Members", g.memberCount)}
    ${stat("Cases, 7 days", data.cases7)}
    ${stat("Cases, 30 days", data.cases30)}
    ${stat("Warnings, 7 days", data.warnings7)}
    ${stat("Warnings, 30 days", data.warnings30)}
    ${stat("Open tickets", data.openTicketCount)}
    ${data.pendingAppeals > 0 ? stat("Pending appeals", data.pendingAppeals, "see Appeals") : ""}
  </dl>
  <h2>Recent cases</h2>
  ${data.recentCases.length ? caseTable(ctx, data.recentCases, "The 10 most recent cases and warnings") : `<p class="muted">No cases or warnings recorded yet.</p>`}
  <p><a class="text-link" href="/dashboard/${esc(g.id)}/cases">All cases &rarr;</a></p>
  ${data.pendingAppeals > 0 ? `<p><a class="text-link" href="/dashboard/${esc(g.id)}/appeals">Review ${data.pendingAppeals.toLocaleString("en-US")} pending appeal${data.pendingAppeals === 1 ? "" : "s"} &rarr;</a></p>` : ""}
  <h2>Open tickets</h2>
  ${tickets}`,
  });
}

/* ── Cases ─────────────────────────────────────────────────────────── */

export function casesQuery(filter: CaseFilter, page: number): string {
  const q = new URLSearchParams();
  if (filter.type) q.set("type", filter.type);
  if (filter.userId) q.set("user", filter.userId);
  if (filter.moderatorId) q.set("moderator", filter.moderatorId);
  if (filter.query) q.set("q", filter.query);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function renderCases(
  cfg: SiteConfig,
  ctx: GuildContext,
  filter: CaseFilter,
  result: { items: CaseRecord[]; total: number },
  perPage: number,
): string {
  const g = ctx.guild;
  const base = `/dashboard/${esc(g.id)}/cases`;
  const pages = Math.max(1, Math.ceil(result.total / perPage));
  const page = Math.min(filter.page, pages);
  const typeOptions = [`<option value="">All types</option>`]
    .concat(CASE_TYPES.map(t => `<option value="${t}"${filter.type === t ? " selected" : ""}>${t}</option>`))
    .join("");

  const pager = result.total > perPage
    ? `<nav class="pager" aria-label="Pages">
      <span>Page ${page} of ${pages}, ${result.total.toLocaleString("en-US")} records</span>
      <span class="btn-row">
        ${page > 1 ? `<a class="btn ghost sm" href="${base}${esc(casesQuery(filter, page - 1))}" rel="prev">Newer</a>` : ""}
        ${page < pages ? `<a class="btn ghost sm" href="${base}${esc(casesQuery(filter, page + 1))}" rel="next">Older</a>` : ""}
      </span>
    </nav>`
    : `<p class="muted">${result.total.toLocaleString("en-US")} record${result.total === 1 ? "" : "s"}.</p>`;

  return shell(cfg, {
    title: `Cases in ${g.name}`,
    path: `/dashboard/${g.id}/cases`,
    viewer: ctx.viewer,
    body: `${head("Cases", "Moderation cases and warnings, newest first. Records older than a year are deleted automatically.", [["Servers", "/dashboard"], [g.name, `/dashboard/${g.id}`], ["Cases", null]])}
  ${guildNav(g.id, "cases")}
  <form class="filter-bar" method="get" action="${base}" role="search" aria-label="Filter cases">
    <div><label for="f-type">Type</label><select id="f-type" name="type">${typeOptions}</select></div>
    <div><label for="f-user">Member ID</label><input id="f-user" name="user" type="text" inputmode="numeric" autocomplete="off" value="${esc(filter.userId ?? "")}" placeholder="123456789012345678"></div>
    <div><label for="f-mod">Moderator ID</label><input id="f-mod" name="moderator" type="text" inputmode="numeric" autocomplete="off" value="${esc(filter.moderatorId ?? "")}" placeholder="123456789012345678"></div>
    <div><label for="f-q">Reason contains</label><input id="f-q" name="q" type="search" maxlength="${CASE_QUERY_MAX}" autocomplete="off" value="${esc(filter.query ?? "")}" placeholder="spam"></div>
    <div class="btn-row"><button class="btn" type="submit">Filter</button>${filter.type || filter.userId || filter.moderatorId || filter.query ? `<a class="btn ghost" href="${base}">Clear</a>` : ""}</div>
  </form>
  ${result.items.length ? caseTable(ctx, result.items, "Cases matching the filter") : `<div class="empty-state"><strong>Nothing matches.</strong>Try a different filter, or clear it.</div>`}
  ${pager}`,
  });
}

export function renderCase(
  cfg: SiteConfig,
  ctx: GuildContext,
  record: CaseRecord,
  o: { noticeCode?: string | null; reasonError?: string | null; reasonValue?: string } = {},
): string {
  const g = ctx.guild;
  const action = `/dashboard/${esc(g.id)}/cases/${esc(record.id)}`;
  const kind = record.kind === "warning" ? "Warning" : "Case";
  const reasonValue = o.reasonValue ?? record.reason;
  const isBanCase = record.kind === "case" && record.action === "ban";
  const err = o.reasonError
    ? `<span class="field-error" id="reason-error">${esc(o.reasonError)}</span>`
    : "";

  const revoke = record.revoked
    ? `<p class="muted">Revoked${record.revokedBy ? ` by ${person(ctx, record.revokedBy)}` : ""}${record.revokedAt ? `, ${esc(fmtDate(record.revokedAt))}` : ""}.</p>`
    : `<form class="dash-action" method="post" action="${action}/revoke" data-confirm="Revoke this ${kind.toLowerCase()}? It stays in the record but stops counting.">
      ${csrfField(ctx.viewer)}
      <p class="muted">Revoking keeps the record but stops it counting toward totals, escalation and the trust score.${
        isBanCase ? "" : ` It does not lift a timeout in Discord; use <code class="inline">/removetimeout</code> for that.`
      }</p>
      ${isBanCase ? `<div class="field"><label class="check" for="f-unban">
        <input type="checkbox" id="f-unban" name="unban">
        <span>Also unban this member in Discord<small>Same as <code class="inline">/unban</code>: lifts the ban, records an unban case and posts it to your log channel. Needs Ban Members.</small></span>
      </label></div>` : ""}
      <button class="btn danger" type="submit">Revoke ${kind.toLowerCase()}</button>
    </form>`;

  return shell(cfg, {
    title: `${kind} ${record.id}`,
    path: action,
    viewer: ctx.viewer,
    body: `${head(`${kind}: ${record.action}`, "", [["Servers", "/dashboard"], [g.name, `/dashboard/${g.id}`], ["Cases", `/dashboard/${g.id}/cases`], [record.id, null]])}
  ${guildNav(g.id, "cases")}
  ${notice(o.noticeCode)}
  <dl class="detail-list">
    <dt>ID</dt><dd><code class="inline">${esc(record.id)}</code></dd>
    <dt>Action</dt><dd>${esc(record.action)}${record.revoked ? ' <span class="tag warn">revoked</span>' : ""}</dd>
    <dt>Member</dt><dd>${person(ctx, record.userId)} <a class="text-link" href="/dashboard/${esc(g.id)}/cases?user=${esc(record.userId)}">Their history</a></dd>
    <dt>Moderator</dt><dd>${person(ctx, record.moderatorId)}</dd>
    <dt>When</dt><dd>${esc(fmtDate(record.createdAt))}</dd>
    <dt>Reason</dt><dd>${esc(record.reason)}</dd>
    ${record.details ? `<dt>Details</dt><dd>${esc(record.details)}</dd>` : ""}
    ${record.proofUrl && /^https:\/\//i.test(record.proofUrl) ? `<dt>Proof</dt><dd><a href="${esc(record.proofUrl)}" rel="noopener noreferrer nofollow">Open attachment</a></dd>` : ""}
  </dl>
  <h2>Edit the reason</h2>
  <form class="dash-form" method="post" action="${action}/reason" novalidate>
    ${csrfField(ctx.viewer)}
    <div class="field">
      <label for="f-reason">Reason</label>
      <textarea id="f-reason" name="reason" maxlength="${CASE_REASON_MAX}" required${o.reasonError ? ' aria-invalid="true" aria-describedby="reason-error"' : ""}>${esc(reasonValue)}</textarea>
      ${err}
      <span class="field-help">Up to ${CASE_REASON_MAX} characters. Same as <code class="inline">/case edit</code>; the change is logged with your name.</span>
    </div>
    <button class="btn" type="submit">Save reason</button>
  </form>
  <h2>Revoke</h2>
  ${revoke}`,
  });
}

/* ── Settings ──────────────────────────────────────────────────────── */

type Values = Record<string, string | boolean>;

export interface FormState {
  values: Values;
  errors: Record<string, string>;
}

/** Flatten the stored settings into form field values. */
export function settingsValues(section: SettingsSection, s: SettingsSnapshot): Values {
  switch (section) {
    case "logging": {
      const v: Values = { loggingEnabled: s.guild.loggingEnabled, loggingChannelId: s.guild.loggingChannelId ?? "" };
      for (const [key] of LOG_CATEGORY_LABELS) v[`cat_${key}`] = s.guild.logCategories?.[key] !== false;
      return v;
    }
    case "escalation": {
      const v: Values = { enabled: s.guild.escalation.enabled, warnExpiryDays: String(s.guild.escalation.warnExpiryDays ?? 0) };
      s.guild.escalation.thresholds.slice(0, ESCALATION_ROWS).forEach((t, i) => {
        v[`t_at_${i}`] = String(t.atWarnings);
        v[`t_action_${i}`] = t.action;
        v[`t_duration_${i}`] = t.durationMinutes ? String(t.durationMinutes) : "";
      });
      return v;
    }
    case "automod": {
      const a = s.automod;
      return {
        words_enabled: a.words.enabled, words_action: a.words.action,
        links_enabled: a.links.enabled, links_action: a.links.action,
        mentions_enabled: a.mentions.enabled, mentions_action: a.mentions.action, mentions_threshold: String(a.mentions.threshold),
        spam_enabled: a.spam.enabled, spam_action: a.spam.action, spam_maxMessages: String(a.spam.maxMessages), spam_windowSeconds: String(a.spam.windowSeconds),
        caps_enabled: a.caps.enabled, caps_action: a.caps.action, caps_threshold: String(a.caps.threshold),
        words_list: a.words.list.join("\n"),
        exempt_roles: a.exemptRoleIds.join(","),
        exempt_channels: a.exemptChannelIds.join(","),
      };
    }
    case "welcome":
      return {
        welcomeEnabled: s.guild.welcomeEnabled,
        welcomeChannelId: s.guild.welcomeChannelId ?? "",
        welcomeMessage: s.guild.welcomeMessage,
        welcomeRoleId: s.guild.welcomeRoleId ?? "",
      };
    case "tickets":
      return {
        logChannelId: s.tickets.logChannelId ?? "",
        autoCloseHours: String(s.tickets.autoCloseHours),
        transcriptLogging: s.tickets.transcriptLogging,
      };
    case "verification":
      return s.verification
        ? {
            enabled: s.verification.enabled,
            verifiedRoleId: s.verification.verifiedRoleId,
            type: s.verification.type,
            kickUnverifiedMinutes: String(s.verification.kickUnverifiedMinutes),
            channelId: s.verification.channelId ?? "",
          }
        : {};
    case "starboard":
      return {
        enabled: s.starboard.enabled,
        channelId: s.starboard.channelId ?? "",
        threshold: String(s.starboard.threshold),
        selfStar: s.starboard.selfStar,
        emoji: s.starboard.emoji,
        ignoredChannels: (s.starboard.ignoredChannels ?? []).join(","),
        ignoredRoles: (s.starboard.ignoredRoles ?? []).join(","),
      };
  }
}

/** Checkbox groups: posted once per ticked item, kept as comma-joined IDs in form values. */
export const MULTI_FIELDS: Partial<Record<SettingsSection, string[]>> = {
  automod: ["exempt_roles", "exempt_channels"],
  starboard: ["ignoredChannels", "ignoredRoles"],
};
const MULTI_KEYS = new Set(Object.values(MULTI_FIELDS).flat());

/** Turn a submitted body back into form values, so a rejected form keeps what was typed. */
export function submittedValues(body: FormBody): Values {
  const v: Values = {};
  for (const [key, raw] of Object.entries(body ?? {})) {
    if (key === "_csrf") continue;
    if (MULTI_KEYS.has(key)) {
      v[key] = (Array.isArray(raw) ? raw : [raw]).filter((x): x is string => typeof x === "string").join(",");
      continue;
    }
    const value = Array.isArray(raw) ? raw[raw.length - 1] : raw;
    if (typeof value !== "string") continue;
    v[key] = value === "on" ? true : value;
  }
  return v;
}

class Form {
  constructor(private readonly state: FormState, private readonly px = "") {}

  str(key: string): string {
    const v = this.state.values[key];
    return typeof v === "string" ? v : "";
  }

  on(key: string): boolean {
    return this.state.values[key] === true;
  }

  private errAttrs(key: string, helpId?: string): string {
    const err = this.state.errors[key];
    const ids = [err ? `${this.px}${key}-error` : "", helpId ?? ""].filter(Boolean).join(" ");
    return `${err ? ' aria-invalid="true"' : ""}${ids ? ` aria-describedby="${ids}"` : ""}`;
  }

  private errText(key: string): string {
    const err = this.state.errors[key];
    return err ? `<span class="field-error" id="${this.px}${key}-error">${esc(err)}</span>` : "";
  }

  private help(key: string, text?: string): string {
    return text ? `<span class="field-help" id="${this.px}${key}-help">${text}</span>` : "";
  }

  checkbox(key: string, label: string, help?: string): string {
    return `<div class="field"><label class="check" for="f-${this.px}${key}">
      <input type="checkbox" id="f-${this.px}${key}" name="${key}"${this.on(key) ? " checked" : ""}${this.errAttrs(key)}>
      <span>${esc(label)}${help ? `<small>${help}</small>` : ""}</span>
    </label>${this.errText(key)}</div>`;
  }

  number(key: string, label: string, min: number, max: number, help?: string, extra = ""): string {
    return `<div class="field">
      <label for="f-${this.px}${key}">${esc(label)}</label>
      <input type="number" id="f-${this.px}${key}" name="${key}" min="${min}" max="${max}" step="1" inputmode="numeric" value="${esc(this.str(key))}"${this.errAttrs(key, help ? `${this.px}${key}-help` : undefined)}${extra}>
      ${this.errText(key)}${this.help(key, help)}
    </div>`;
  }

  select(key: string, label: string, options: Array<{ value: string; label: string; disabled?: boolean; group?: string | null }>, help?: string, extra = ""): string {
    const current = this.str(key);
    let html = "";
    let openGroup: string | null | undefined;
    for (const o of options) {
      if (o.group !== undefined && o.group !== openGroup) {
        if (openGroup) html += "</optgroup>";
        if (o.group) html += `<optgroup label="${esc(o.group)}">`;
        openGroup = o.group;
      }
      html += `<option value="${esc(o.value)}"${o.value === current ? " selected" : ""}${o.disabled ? " disabled" : ""}>${esc(o.label)}</option>`;
    }
    if (openGroup) html += "</optgroup>";
    return `<div class="field">
      <label for="f-${this.px}${key}">${esc(label)}</label>
      <select id="f-${this.px}${key}" name="${key}"${this.errAttrs(key, help ? `${this.px}${key}-help` : undefined)}${extra}>${html}</select>
      ${this.errText(key)}${this.help(key, help)}
    </div>`;
  }

  text(key: string, label: string, max: number, help?: string, extra = ""): string {
    return `<div class="field">
      <label for="f-${this.px}${key}">${esc(label)}</label>
      <input type="text" id="f-${this.px}${key}" name="${key}" maxlength="${max}" autocomplete="off" value="${esc(this.str(key))}"${this.errAttrs(key, help ? `${this.px}${key}-help` : undefined)}${extra}>
      ${this.errText(key)}${this.help(key, help)}
    </div>`;
  }

  /**
   * A group of checkboxes posting `key` once per ticked item. Saved IDs that
   * are not among the options are listed too (still ticked), so saving the
   * form never drops them silently.
   */
  multi(key: string, legend: string, options: Array<{ value: string; label: string; group?: string | null }>, help?: string): string {
    const picked = new Set(this.str(key).split(",").filter(Boolean));
    const all = options.slice();
    for (const id of picked) if (!all.some(o => o.value === id)) all.push({ value: id, label: `Unknown (${id})`, group: "Not visible to Aegis" });
    let html = "";
    let openGroup: string | null | undefined;
    all.forEach((o, i) => {
      const group = o.group ?? null;
      if (group !== openGroup) {
        if (openGroup) html += "</div>";
        if (group) html += `<div class="pick-group"><p class="pick-group-title">${esc(group)}</p>`;
        openGroup = group;
      }
      html += `<label class="check pick" for="f-${this.px}${key}-${i}"><input type="checkbox" id="f-${this.px}${key}-${i}" name="${key}" value="${esc(o.value)}"${picked.has(o.value) ? " checked" : ""}><span>${esc(o.label)}</span></label>`;
    });
    if (openGroup) html += "</div>";
    const err = this.state.errors[key];
    return `<fieldset class="pick-list" id="f-${this.px}${key}"${err ? ' aria-invalid="true"' : ""}${err || help ? ` aria-describedby="${[err ? `${this.px}${key}-error` : "", help ? `${this.px}${key}-help` : ""].filter(Boolean).join(" ")}"` : ""}>
      <legend>${esc(legend)} <span class="faint">(${picked.size} picked)</span></legend>
      ${all.length ? `<div class="pick-scroll">${html}</div>` : `<p class="muted">Nothing to pick from.</p>`}
      ${this.errText(key)}${this.help(key, help)}
    </fieldset>`;
  }

  textarea(key: string, label: string, max: number, help?: string, extra = ""): string {
    return `<div class="field">
      <label for="f-${this.px}${key}">${esc(label)}</label>
      <textarea id="f-${this.px}${key}" name="${key}" maxlength="${max}"${this.errAttrs(key, help ? `${this.px}${key}-help` : undefined)}${extra}>${esc(this.str(key))}</textarea>
      ${this.errText(key)}${this.help(key, help)}
    </div>`;
  }
}

function channelOptions(channels: ChannelOption[], noneLabel: string) {
  return [{ value: "", label: noneLabel, group: null as string | null }].concat(
    channels.map(c => ({ value: c.id, label: `#${c.name}`, group: c.parent ?? "No category" })),
  );
}

function roleOptions(roles: RoleOption[], noneLabel: string | null) {
  const opts: Array<{ value: string; label: string; disabled?: boolean }> = noneLabel ? [{ value: "", label: noneLabel }] : [{ value: "", label: "Pick a role" }];
  for (const r of roles) opts.push({ value: r.id, label: r.assignable ? `@${r.name}` : `@${r.name} (Aegis cannot assign)`, disabled: !r.assignable });
  return opts;
}

function channelPicks(channels: ChannelOption[], hidden: ReadonlySet<string> = new Set(), saved = "") {
  const opts: Array<{ value: string; label: string; group: string | null }> =
    channels.map(c => ({ value: c.id, label: `#${c.name}`, group: c.parent ?? "No category" }));
  // Saved channels Discord now hides from Aegis stay ticked, with the fix spelled out.
  for (const id of saved.split(",").filter(Boolean)) {
    if (hidden.has(id) && !opts.some(o => o.value === id)) {
      opts.push({ value: id, label: `Hidden channel (${id}): give Aegis View Channel`, group: "Aegis can't see these channels" });
    }
  }
  return opts;
}

function rolePicks(roles: RoleOption[]) {
  return roles.map(r => ({ value: r.id, label: `@${r.name}`, group: null }));
}

/** Shown where a saved channel is one Discord now hides from Aegis (obfuscated). */
export function hiddenChannelNote(id: string, what: string): string {
  return `<p class="callout warn" data-hidden-channel>Aegis can't see the saved ${what} (<code class="inline">${esc(id)}</code>). Give Aegis the <strong>View Channel</strong> permission there, or pick a new one.</p>`;
}

function missingNote(id: string, list: Array<{ id: string }>, what: string, hidden: ReadonlySet<string> = new Set()): string {
  if (!id || list.some(x => x.id === id)) return "";
  if (hidden.has(id)) return hiddenChannelNote(id, what);
  return `<p class="callout warn">The saved ${what} (<code class="inline">${esc(id)}</code>) no longer exists or Aegis cannot see it. Pick a new one.</p>`;
}

const ACTION_OPTIONS = AUTOMOD_ACTIONS.map(a => ({ value: a, label: a === "delete" ? "Delete the message" : a === "warn" ? "Delete and warn" : "Delete and time out" }));

function sectionForm(
  section: SettingsSection,
  f: Form,
  ctx: GuildContext,
  channels: ChannelOption[],
  roles: RoleOption[],
  snapshot: SettingsSnapshot,
  hidden: ReadonlySet<string> = new Set(),
): string {
  switch (section) {
    case "logging":
      return `${missingNote(f.str("loggingChannelId"), channels, "log channel", hidden)}
      <fieldset><legend>Audit log</legend>
        ${f.checkbox("loggingEnabled", "Post moderation and server events to a log channel")}
        ${f.select("loggingChannelId", "Log channel", channelOptions(channels, "No channel"), "Aegis needs View Channel, Send Messages and Embed Links there.")}
      </fieldset>
      <fieldset><legend>What to log</legend>
        ${LOG_CATEGORY_LABELS.map(([key, label]) => f.checkbox(`cat_${key}`, label)).join("")}
      </fieldset>`;

    case "escalation": {
      const rows = Array.from({ length: ESCALATION_ROWS }, (_, i) => `
        <fieldset data-escalation-row><legend>Step ${i + 1}</legend>
          <div class="field-row">
            ${f.number(`t_at_${i}`, "At this many warnings", 1, 100)}
            ${f.select(`t_action_${i}`, "Do this", [
              { value: "none", label: "Nothing (unused step)" },
              { value: "timeout", label: "Time out" },
              { value: "kick", label: "Kick" },
              { value: "ban", label: "Ban" },
            ], undefined, " data-escalation-action")}
            ${f.number(`t_duration_${i}`, "Timeout length (minutes)", 1, MAX_TIMEOUT_MINUTES, "Only used for time outs.")}
          </div>
        </fieldset>`).join("");
      return `<fieldset><legend>Escalation</legend>
        ${f.checkbox("enabled", "Act automatically when a member reaches a warning count", "A step fires once, when the count is reached exactly. Revoked warnings never count.")}
        ${f.number("warnExpiryDays", "Warnings stop counting after (days)", 0, MAX_WARN_EXPIRY_DAYS, "0 means warnings never expire for escalation. They are still deleted after a year.")}
      </fieldset>
      ${rows}`;
    }

    case "automod":
      return `<fieldset><legend>Blocked words</legend>
        ${f.checkbox("words_enabled", "Filter blocked words")}
        ${f.select("words_action", "When it matches", ACTION_OPTIONS)}
        ${f.textarea("words_list", "Blocked words", AUTOMOD_WORDS_TEXT_MAX,
          `One word or phrase per line, 2 to ${AUTOMOD_WORD_MAX} characters, up to ${AUTOMOD_WORDS_MAX_COUNT}. Matching ignores case. Same list as <code class="inline">/automod words add</code>.`,
          ' spellcheck="false" autocapitalize="off"')}
      </fieldset>
      <fieldset><legend>Links</legend>
        ${f.checkbox("links_enabled", "Filter links")}
        ${f.select("links_action", "When it matches", ACTION_OPTIONS)}
      </fieldset>
      <fieldset><legend>Mention spam</legend>
        ${f.checkbox("mentions_enabled", "Limit mentions per message")}
        ${f.number("mentions_threshold", "Mentions allowed", 2, 50)}
        ${f.select("mentions_action", "When it matches", ACTION_OPTIONS)}
      </fieldset>
      <fieldset><legend>Message spam</legend>
        ${f.checkbox("spam_enabled", "Limit how fast one member can post")}
        <div class="field-row">
          ${f.number("spam_maxMessages", "Messages", 2, 30)}
          ${f.number("spam_windowSeconds", "Within (seconds)", 2, 60)}
        </div>
        ${f.select("spam_action", "When it matches", ACTION_OPTIONS)}
      </fieldset>
      <fieldset><legend>Capitals</legend>
        ${f.checkbox("caps_enabled", "Filter messages that are mostly capitals")}
        ${f.number("caps_threshold", "Percentage of capitals", 50, 100)}
        ${f.select("caps_action", "When it matches", ACTION_OPTIONS)}
      </fieldset>
      <h2 class="section-title">Exemptions</h2>
      <p class="muted">Members with an exempt role, and messages in an exempt channel, skip every automod rule.</p>
      ${f.multi("exempt_roles", "Exempt roles", rolePicks(roles))}
      ${f.multi("exempt_channels", "Exempt channels", channelPicks(channels, hidden, f.str("exempt_channels")), "Text and announcement channels are listed. Other channels exempted with /automod stay exempt and show as Unknown.")}`;

    case "welcome": {
      const sample = { username: ctx.viewer.username, serverName: ctx.guild.name, memberCount: ctx.guild.memberCount };
      return `${missingNote(f.str("welcomeChannelId"), channels, "welcome channel", hidden)}
      <fieldset><legend>Welcome message</legend>
        ${f.checkbox("welcomeEnabled", "Post a message when someone joins")}
        ${f.select("welcomeChannelId", "Channel", channelOptions(channels, "No channel"))}
        ${f.textarea("welcomeMessage", "Message", WELCOME_MESSAGE_MAX,
          `Placeholders: <code class="inline">{user}</code> mentions them, <code class="inline">{username}</code>, <code class="inline">{server}</code>, <code class="inline">{count}</code> is the member count.`,
          ` data-welcome-input data-sample-user="${esc(sample.username)}" data-sample-server="${esc(sample.serverName)}" data-sample-count="${sample.memberCount}"`)}
        <p class="field-help" id="welcome-preview-label">Preview, with you as the new member:</p>
        <div class="preview" data-welcome-preview aria-live="polite" aria-labelledby="welcome-preview-label">${esc(welcomePreview(f.str("welcomeMessage"), sample))}</div>
      </fieldset>
      <fieldset><legend>Join role</legend>
        ${f.select("welcomeRoleId", "Give new members this role", roleOptions(roles, "No role"), "Roles above Aegis's own role cannot be assigned and are greyed out.")}
      </fieldset>`;
    }

    case "tickets":
      return `${missingNote(f.str("logChannelId"), channels, "transcript channel", hidden)}
      <fieldset><legend>Transcripts</legend>
        ${f.checkbox("transcriptLogging", "Post a transcript to a staff channel when a ticket closes", "The member who opened the ticket also gets one by DM if their DMs are open.")}
        ${f.select("logChannelId", "Transcript channel", channelOptions(channels, "No channel"))}
      </fieldset>
      <fieldset><legend>Auto-close</legend>
        ${f.number("autoCloseHours", "Close a ticket after this many hours without messages", 0, MAX_TICKET_AUTOCLOSE_HOURS, "0 turns auto-close off.")}
      </fieldset>
      <p class="muted">The ticket panel itself is posted with <code class="inline">/ticket setup</code>.</p>`;

    case "verification":
      if (!snapshot.verification) {
        return `<div class="empty-state"><strong>Verification is not set up yet.</strong>
          New members need a panel to click before verification can work. <a class="text-link" href="/dashboard/${esc(ctx.guild.id)}/panels#verification">Post the verification panel</a> from the Panels page, or run <code class="inline">/verify setup</code> in Discord. After that you can change the settings here.</div>`;
      }
      return `${missingNote(f.str("verifiedRoleId"), roles, "verified role")}
      <fieldset><legend>Verification</legend>
        ${f.checkbox("enabled", "Verification is on")}
        ${f.select("verifiedRoleId", "Role given after verifying", roleOptions(roles, null))}
        ${f.select("type", "Challenge", [
          { value: "button", label: "Button: one click" },
          { value: "captcha", label: "Captcha: a short sum to solve" },
        ], "Changing this takes effect on the next click; the posted panel does not need re-posting.")}
        ${f.number("kickUnverifiedMinutes", "Kick members who have not verified after (minutes)", 0, MAX_KICK_UNVERIFIED_MINUTES, "0 turns auto-kick off. Applies to members who join after you save.")}
      </fieldset>
      ${snapshot.verification.channelId && hidden.has(snapshot.verification.channelId) ? hiddenChannelNote(snapshot.verification.channelId, "verification panel channel") : ""}
      <p class="muted">The panel is in ${snapshot.verification.channelId ? `<code class="inline">#${esc(channels.find(c => c.id === snapshot.verification?.channelId)?.name ?? snapshot.verification.channelId)}</code>` : "an unknown channel"}. To move it or change its text, <a href="/dashboard/${esc(ctx.guild.id)}/panels#verification">post it again from Panels</a>.</p>`;

    case "starboard":
      return `${missingNote(f.str("channelId"), channels, "starboard channel", hidden)}
      <fieldset><legend>Starboard</legend>
        ${f.checkbox("enabled", "Starboard is on")}
        ${f.select("channelId", "Starboard channel", channelOptions(channels, "No channel"))}
        ${f.text("emoji", "Emoji that stars a message", 64, `One emoji such as ⭐ or 🌟, or a custom emoji written as <code class="inline">&lt;:name:id&gt;</code>. Same as <code class="inline">/starboard emoji</code>.`, ' spellcheck="false" autocapitalize="off"')}
        ${f.number("threshold", "Reactions needed", 1, 100)}
        ${f.checkbox("selfStar", "Count the author's own star")}
      </fieldset>
      <h2 class="section-title">Ignored</h2>
      <p class="muted">Messages in ignored channels, or from members with an ignored role, are never posted to the starboard.</p>
      ${f.multi("ignoredChannels", "Ignored channels", channelPicks(channels, hidden, f.str("ignoredChannels")))}
      ${f.multi("ignoredRoles", "Ignored roles", rolePicks(roles))}`;
  }
}

export function renderSettings(
  cfg: SiteConfig,
  ctx: GuildContext,
  section: SettingsSection,
  snapshot: SettingsSnapshot,
  state: FormState,
  channels: ChannelOption[],
  roles: RoleOption[],
  noticeCode: string | null,
  hiddenChannelIds: ReadonlySet<string> = new Set(),
): string {
  const g = ctx.guild;
  const base = `/dashboard/${esc(g.id)}/settings`;
  const f = new Form(state);
  const errorKeys = Object.keys(state.errors);
  const summary = errorKeys.length
    ? `<div class="error-summary" role="alert" tabindex="-1" data-error-summary>
      <h2>Nothing was saved. Fix ${errorKeys.length === 1 ? "this" : "these"} first:</h2>
      <ul>${errorKeys.map(k => `<li><a href="#f-${esc(k)}">${esc(state.errors[k])}</a></li>`).join("")}</ul>
    </div>`
    : "";
  const canSave = !(section === "verification" && !snapshot.verification);

  return shell(cfg, {
    title: `${SECTION_TITLES[section]} settings, ${g.name}`,
    path: `${base}/${section}`,
    viewer: ctx.viewer,
    body: `${head(`${SECTION_TITLES[section]} settings`, "", [["Servers", "/dashboard"], [g.name, `/dashboard/${g.id}`], ["Settings", null]])}
  ${guildNav(g.id, "settings")}
  <nav aria-label="Settings sections"><ul class="dash-nav">
    ${SETTINGS_SECTIONS.map(s => `<li><a href="${base}/${s}"${s === section ? ' aria-current="page"' : ""}>${SECTION_TITLES[s]}</a></li>`).join("")}
  </ul></nav>
  ${notice(noticeCode)}
  ${summary}
  <form class="dash-form" method="post" action="${base}/${section}" novalidate>
    ${csrfField(ctx.viewer)}
    ${sectionForm(section, f, ctx, channels, roles, snapshot, hiddenChannelIds)}
    ${canSave ? `<button class="btn" type="submit">Save ${SECTION_TITLES[section].toLowerCase()} settings</button>` : ""}
  </form>`,
  });
}

/* ── Shared bits for the newer pages ───────────────────────────────── */

function errorSummary(errors: Record<string, string>, prefix = "f-"): string {
  // prefix matches the Form's id prefix: "f-" + its own prefix.
  const keys = Object.keys(errors);
  if (!keys.length) return "";
  return `<div class="error-summary" role="alert" tabindex="-1" data-error-summary>
      <h2>Nothing was changed. Fix ${keys.length === 1 ? "this" : "these"} first:</h2>
      <ul>${keys.map(k => `<li><a href="#${prefix}${esc(k)}">${esc(errors[k])}</a></li>`).join("")}</ul>
    </div>`;
}

function permissionNote(missing: string | null): string {
  return missing
    ? `<p class="callout warn">You need <strong>${esc(missing)}</strong> in this server for this, the same as the slash command. You can look, but the buttons will be refused.</p>`
    : "";
}

function pagerNav(base: string, query: (page: number) => string, page: number, pages: number, total: number, noun: string): string {
  if (pages <= 1) return `<p class="muted">${total.toLocaleString("en-US")} ${noun}${total === 1 ? "" : "s"}.</p>`;
  return `<nav class="pager" aria-label="Pages">
      <span>Page ${page} of ${pages}, ${total.toLocaleString("en-US")} ${noun}s</span>
      <span class="btn-row">
        ${page > 1 ? `<a class="btn ghost sm" href="${base}${esc(query(page - 1))}" rel="prev">Newer</a>` : ""}
        ${page < pages ? `<a class="btn ghost sm" href="${base}${esc(query(page + 1))}" rel="next">Older</a>` : ""}
      </span>
    </nav>`;
}

/* ── Appeals ───────────────────────────────────────────────────────── */

const APPEAL_FILTER_LABELS: Record<AppealFilter, string> = {
  pending: "Pending", approved: "Approved", denied: "Denied", expired: "Expired", all: "All",
};

function appealTag(status: string): string {
  const cls = status === "approved" ? "ok" : status === "pending" ? "warn" : "";
  return `<span class="tag${cls ? ` ${cls}` : ""}">${esc(status)}</span>`;
}

export function renderAppeals(
  cfg: SiteConfig,
  ctx: GuildContext,
  filter: { status: AppealFilter; page: number },
  result: { items: AppealRecord[]; total: number },
  perPage: number,
  o: { missingPermission?: string | null; noticeCode?: string | null } = {},
): string {
  const g = ctx.guild;
  const base = `/dashboard/${esc(g.id)}/appeals`;
  const pages = Math.max(1, Math.ceil(result.total / perPage));
  const page = Math.min(filter.page, pages);
  const query = (p: number) => {
    const q = new URLSearchParams();
    if (filter.status !== "pending") q.set("status", filter.status);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `?${s}` : "";
  };
  const tabs = `<nav aria-label="Appeal status"><ul class="dash-nav">${APPEAL_FILTERS.map(s =>
    `<li><a href="${base}${s === "pending" ? "" : `?status=${s}`}"${s === filter.status ? ' aria-current="page"' : ""}>${APPEAL_FILTER_LABELS[s]}</a></li>`).join("")}</ul></nav>`;

  const rows = result.items.map(a => `<tr>
      <td data-label="Filed">${esc(fmtDate(a.createdAt))}</td>
      <td data-label="Code"><a class="case-link" href="${base}/${esc(a.code)}">${esc(a.code)}</a> ${appealTag(a.status)}</td>
      <td data-label="Member">${person(ctx, a.userId)}</td>
      <td data-label="Banned by">${person(ctx, a.moderatorId)}</td>
      <td data-label="Statement">${a.appealText ? esc(a.appealText.length > 120 ? a.appealText.slice(0, 117) + "…" : a.appealText) : `<span class="faint">Not submitted yet</span>`}</td>
    </tr>`).join("");

  return shell(cfg, {
    title: `Appeals in ${g.name}`,
    path: `/dashboard/${g.id}/appeals`,
    viewer: ctx.viewer,
    body: `${head("Ban appeals", "Members banned by Aegis get an appeal code by DM and send their statement with <code class=\"inline\">/appeal submit</code>. Review them here or with <code class=\"inline\">/appeal review</code>.", [["Servers", "/dashboard"], [g.name, `/dashboard/${g.id}`], ["Appeals", null]])}
  ${guildNav(g.id, "appeals")}
  ${notice(o.noticeCode)}
  ${permissionNote(o.missingPermission ?? null)}
  ${tabs}
  ${result.items.length ? `<div class="table-wrap"><table class="case-table">
    <caption class="visually-hidden">${esc(APPEAL_FILTER_LABELS[filter.status])} ban appeals</caption>
    <thead><tr><th scope="col">Filed</th><th scope="col">Code</th><th scope="col">Member</th><th scope="col">Banned by</th><th scope="col">Statement</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>` : `<div class="empty-state"><strong>No ${filter.status === "all" ? "" : `${filter.status} `}appeals.</strong>${filter.status === "pending" ? "Nothing is waiting for review." : "Try another status."}</div>`}
  ${pagerNav(base, query, page, pages, result.total, "appeal")}`,
  });
}

export function renderAppeal(
  cfg: SiteConfig,
  ctx: GuildContext,
  appeal: AppealRecord,
  o: { missingPermission?: string | null; noticeCode?: string | null; errors?: Record<string, string>; noteValue?: string } = {},
): string {
  const g = ctx.guild;
  const action = `/dashboard/${esc(g.id)}/appeals/${esc(appeal.code)}`;
  const errors = o.errors ?? {};
  const review = appeal.status === "pending"
    ? `<h2>Review</h2>
  ${errorSummary(errors)}
  <form class="dash-form" method="post" action="${action}/review" novalidate>
    ${csrfField(ctx.viewer)}
    <div class="field">
      <label for="f-note">Note to the member (optional)</label>
      <textarea id="f-note" name="note" maxlength="${APPEAL_REVIEW_NOTE_MAX}"${errors.note ? ' aria-invalid="true" aria-describedby="note-error"' : ""}>${esc(o.noteValue ?? "")}</textarea>
      ${errors.note ? `<span class="field-error" id="note-error">${esc(errors.note)}</span>` : ""}
      <span class="field-help">Up to ${APPEAL_REVIEW_NOTE_MAX} characters. Sent to them by DM with the decision, and posted to your log channel.</span>
    </div>
    <div class="btn-row review-buttons" id="f-decision">
      <button class="btn" type="submit" name="decision" value="approved" data-confirm-button="Approve and unban this member?">Approve and unban</button>
      <button class="btn danger" type="submit" name="decision" value="denied" data-confirm-button="Deny this appeal? The ban stays.">Deny</button>
    </div>
  </form>`
    : `<h2>Decision</h2>
  <dl class="detail-list">
    <dt>Status</dt><dd>${appealTag(appeal.status)}</dd>
    ${appeal.reviewedBy ? `<dt>Reviewed by</dt><dd>${person(ctx, appeal.reviewedBy)}</dd>` : ""}
    ${appeal.reviewedAt ? `<dt>Reviewed</dt><dd>${esc(fmtDate(appeal.reviewedAt))}</dd>` : ""}
    <dt>Note</dt><dd>${appeal.reviewNote ? esc(appeal.reviewNote) : `<span class="faint">None</span>`}</dd>
  </dl>`;

  return shell(cfg, {
    title: `Appeal ${appeal.code}`,
    path: action,
    viewer: ctx.viewer,
    body: `${head(`Appeal ${appeal.code}`, "", [["Servers", "/dashboard"], [g.name, `/dashboard/${g.id}`], ["Appeals", `/dashboard/${g.id}/appeals`], [appeal.code, null]])}
  ${guildNav(g.id, "appeals")}
  ${notice(o.noticeCode)}
  ${permissionNote(o.missingPermission ?? null)}
  <dl class="detail-list">
    <dt>Code</dt><dd><code class="inline">${esc(appeal.code)}</code> ${appealTag(appeal.status)}</dd>
    <dt>Member</dt><dd>${person(ctx, appeal.userId)} <a class="text-link" href="/dashboard/${esc(g.id)}/cases?user=${esc(appeal.userId)}">Their history</a></dd>
    <dt>Banned by</dt><dd>${person(ctx, appeal.moderatorId)}</dd>
    <dt>Filed</dt><dd>${esc(fmtDate(appeal.createdAt))}</dd>
    <dt>Ban reason</dt><dd>${esc(appeal.banReason)}</dd>
    <dt>Statement</dt><dd class="prewrap">${appeal.appealText ? esc(appeal.appealText) : `<span class="faint">Not submitted yet. They send it with /appeal submit.</span>`}</dd>
  </dl>
  ${review}`,
  });
}

/* ── Panels ────────────────────────────────────────────────────────── */

export interface PanelsState {
  form: "ticket" | "verification" | null;
  values: Values;
  errors: Record<string, string>;
}

export function renderPanels(
  cfg: SiteConfig,
  ctx: GuildContext,
  o: {
    channels: ChannelOption[];
    roles: RoleOption[];
    rolePanels: RolePanelSummary[];
    verificationSetUp: boolean;
    state?: PanelsState;
    noticeCode?: string | null;
    missing: { tickets: string | null; roles: string | null };
    /** Channels Discord hides from Aegis (obfuscated); see BotView.hiddenChannelIds. */
    hiddenChannelIds?: ReadonlySet<string>;
  },
): string {
  const hidden = o.hiddenChannelIds ?? new Set<string>();
  const g = ctx.guild;
  const base = `/dashboard/${esc(g.id)}/panels`;
  const state = o.state ?? { form: null, values: {}, errors: {} };
  const formFor = (which: "ticket" | "verification", defaults: Values) =>
    new Form(state.form === which ? { values: state.values, errors: state.errors } : { values: defaults, errors: {} }, `${which}-`);
  const t = formFor("ticket", {});
  const v = formFor("verification", { type: "button", kickUnverifiedMinutes: "0" });
  const anyRole = [{ value: "", label: "No staff role" }].concat(o.roles.map(r => ({ value: r.id, label: `@${r.name}` })));
  const summaryFor = (which: "ticket" | "verification") => (state.form === which ? errorSummary(state.errors, `f-${which}-`) : "");
  const channelName = (id: string) => o.channels.find(c => c.id === id)?.name;

  const rolePanels = o.rolePanels.length
    ? `<ul class="panel-list">${o.rolePanels.map(p => `<li class="panel-item">
        <div class="panel-meta"><strong>${esc(p.title)}</strong>
          <span class="faint">${p.roleCount} role${p.roleCount === 1 ? "" : "s"}, ${esc(p.style)}, in ${channelName(p.channelId) ? `#${esc(channelName(p.channelId)!)}` : `<code class="inline">${esc(p.channelId)}</code>`}</span></div>
        ${hidden.has(p.channelId) ? hiddenChannelNote(p.channelId, "role panel channel") : ""}
        <form class="panel-repost" method="post" action="${base}/roles/${esc(p.id)}" novalidate>
          ${csrfField(ctx.viewer)}
          <div class="field"><label for="f-rp-${esc(p.id)}">Post to</label>
            <select id="f-rp-${esc(p.id)}" name="channelId">${channelOptions(o.channels, "Pick a channel").map(c => `<option value="${esc(c.value)}"${c.value === p.channelId ? " selected" : ""}>${esc(c.label)}</option>`).join("")}</select></div>
          <button class="btn ghost" type="submit">Re-post</button>
        </form>
      </li>`).join("")}</ul>`
    : `<div class="empty-state"><strong>No role panels yet.</strong>Create one with <code class="inline">/rolepanel create</code> in Discord; it will show up here to re-post.</div>`;

  return shell(cfg, {
    title: `Panels in ${g.name}`,
    path: `/dashboard/${g.id}/panels`,
    viewer: ctx.viewer,
    body: `${head("Panels", "Post the messages members click: the ticket button, the verification button and role panels. Each uses the same code as its slash command.", [["Servers", "/dashboard"], [g.name, `/dashboard/${g.id}`], ["Panels", null]])}
  ${guildNav(g.id, "panels")}
  ${notice(o.noticeCode)}

  <h2 id="tickets">Ticket panel</h2>
  <p class="muted">Same as <code class="inline">/ticket setup</code>. Earlier Aegis ticket panels in the channel are removed first.</p>
  ${permissionNote(o.missing.tickets)}
  ${summaryFor("ticket")}
  <form class="dash-form" method="post" action="${base}/tickets" novalidate>
    ${csrfField(ctx.viewer)}
    <fieldset><legend>Ticket panel</legend>
      ${t.select("channelId", "Channel", channelOptions(o.channels, "Pick a channel"))}
      ${t.select("staffRoleId", "Staff role to notify", anyRole, "Optional. Members of this role are added to each new ticket.")}
      ${t.text("title", "Title", PANEL_TITLE_MAX, "Optional. Default: 🎫 Support Tickets")}
      ${t.textarea("description", "Description", TICKET_PANEL_DESCRIPTION_MAX, "Optional. Default: Need assistance? Click the button below…")}
    </fieldset>
    <button class="btn" type="submit">Post ticket panel</button>
  </form>

  <h2 id="verification">Verification panel</h2>
  <p class="muted">Same as <code class="inline">/verify setup</code>. ${o.verificationSetUp
    ? "Verification is set up; posting again moves the panel or changes its text and turns verification on."
    : "<strong>Verification is not set up yet.</strong> Posting the panel turns it on."} Earlier Aegis verification panels in the channel are removed first.</p>
  ${permissionNote(o.missing.roles)}
  ${summaryFor("verification")}
  <form class="dash-form" method="post" action="${base}/verification" novalidate>
    ${csrfField(ctx.viewer)}
    <fieldset><legend>Verification panel</legend>
      ${v.select("channelId", "Channel", channelOptions(o.channels, "Pick a channel"))}
      ${v.select("verifiedRoleId", "Role given after verifying", roleOptions(o.roles, null), "Roles above Aegis's own role cannot be assigned and are greyed out.")}
      ${v.select("type", "Challenge", [
        { value: "button", label: "Button: one click" },
        { value: "captcha", label: "Captcha: a short sum to solve" },
      ])}
      ${v.number("kickUnverifiedMinutes", "Kick members who have not verified after (minutes)", 0, MAX_KICK_UNVERIFIED_MINUTES, "0 turns auto-kick off.")}
      ${v.text("title", "Title", PANEL_TITLE_MAX, "Optional. Default: 🛡️ Server Verification Required")}
      ${v.textarea("description", "Description", VERIFY_PANEL_DESCRIPTION_MAX, "Optional. Default: Click the button below to verify your account…")}
    </fieldset>
    <button class="btn" type="submit">Post verification panel</button>
  </form>

  <h2 id="roles">Role panels</h2>
  <p class="muted">Re-post a panel made with <code class="inline">/rolepanel create</code>, in the same channel or another one. The new message replaces the old one; the roles and options stay the same.</p>
  ${permissionNote(o.missing.roles)}
  ${rolePanels}`,
  });
}

/* ── Activity ──────────────────────────────────────────────────────── */

const AUDIT_LABELS: Record<string, string> = {
  "case.reason": "Edited a case reason",
  "case.revoke": "Revoked a case",
  "case.revoke+unban": "Revoked a ban and unbanned",
  "appeal.approved": "Approved an appeal",
  "appeal.denied": "Denied an appeal",
  "panel.ticket": "Posted the ticket panel",
  "panel.verification": "Posted the verification panel",
  "panel.role": "Re-posted a role panel",
};

export function auditLabel(action: string): string {
  if (AUDIT_LABELS[action]) return AUDIT_LABELS[action];
  const m = action.match(/^settings\.(\w+)$/);
  if (m && (SETTINGS_SECTIONS as readonly string[]).includes(m[1])) return `Changed ${SECTION_TITLES[m[1] as SettingsSection].toLowerCase()} settings`;
  return action;
}

export function renderActivity(
  cfg: SiteConfig,
  ctx: GuildContext,
  page: number,
  result: { items: AuditEntry[]; total: number },
  perPage: number,
): string {
  const g = ctx.guild;
  const base = `/dashboard/${esc(g.id)}/activity`;
  const pages = Math.max(1, Math.ceil(result.total / perPage));
  const current = Math.min(page, pages);
  const rows = result.items.map(e => `<tr>
      <td data-label="When">${esc(fmtDate(e.createdAt))}</td>
      <td data-label="Who">${esc(e.username)} <span class="faint">${esc(e.userId)}</span></td>
      <td data-label="What">${esc(auditLabel(e.action))}${e.target ? ` <code class="inline">${esc(e.target)}</code>` : ""}</td>
      <td data-label="Details">${e.summary ? esc(e.summary) : `<span class="faint">No field changed</span>`}</td>
    </tr>`).join("");

  return shell(cfg, {
    title: `Dashboard activity in ${g.name}`,
    path: `/dashboard/${g.id}/activity`,
    viewer: ctx.viewer,
    body: `${head("Dashboard activity", "Every change made through this dashboard for this server, newest first. Kept for 180 days. Changes made with slash commands are in your log channel instead.", [["Servers", "/dashboard"], [g.name, `/dashboard/${g.id}`], ["Activity", null]])}
  ${guildNav(g.id, "activity")}
  ${result.items.length ? `<div class="table-wrap"><table class="case-table">
    <caption class="visually-hidden">Dashboard changes</caption>
    <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">What</th><th scope="col">Details</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>` : `<div class="empty-state"><strong>No dashboard changes yet.</strong>Saves, revokes, appeal decisions and posted panels show up here.</div>`}
  ${pagerNav(base, p => (p > 1 ? `?page=${p}` : ""), current, pages, result.total, "change")}`,
  });
}
