/**
 * Server-rendered HTML for the web dashboard. Every dynamic value goes through
 * `esc()`; nothing here reads the request directly.
 */
import { layout } from "../layout";
import { escapeHtml as esc, type SiteConfig } from "../pages";
import type { ChannelOption, GuildSummary, RoleOption } from "./botView";
import type { CaseRecord, OverviewData, SettingsSnapshot } from "./data";
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
  welcomePreview,
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
  <p class="muted"><a href="/dashboard/changelog">Dashboard changelog</a>: what changed in the dashboard.</p></div>`,
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

function guildNav(guildId: string, active: "overview" | "cases" | "settings"): string {
  const base = `/dashboard/${esc(guildId)}`;
  const item = (key: string, label: string, href: string) =>
    `<li><a href="${href}"${key === active ? ' aria-current="page"' : ""}>${label}</a></li>`;
  return `<nav aria-label="Server sections"><ul class="dash-nav">
    ${item("overview", "Overview", base)}
    ${item("cases", "Cases", `${base}/cases`)}
    ${item("settings", "Settings", `${base}/settings`)}
  </ul></nav>`;
}

const NOTICES: Record<string, { text: string; bad?: boolean }> = {
  saved: { text: "Saved. Aegis uses the new settings from now on." },
  reason: { text: "Reason updated. The change was posted to your log channel if logging is on." },
  revoked: { text: "Marked as revoked. It stays in the record but no longer counts toward totals or escalation." },
  "already-revoked": { text: "That record was already revoked, or it no longer exists.", bad: true },
  "verification-missing": { text: "Run /verify setup in Discord first. It posts the panel members click; after that you can change the settings here.", bad: true },
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
    ${data.pendingAppeals > 0 ? stat("Pending appeals", data.pendingAppeals, "review with /appeal") : ""}
  </dl>
  <h2>Recent cases</h2>
  ${data.recentCases.length ? caseTable(ctx, data.recentCases, "The 10 most recent cases and warnings") : `<p class="muted">No cases or warnings recorded yet.</p>`}
  <p><a class="text-link" href="/dashboard/${esc(g.id)}/cases">All cases &rarr;</a></p>
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
    <div class="btn-row"><button class="btn" type="submit">Filter</button>${filter.type || filter.userId || filter.moderatorId ? `<a class="btn ghost" href="${base}">Clear</a>` : ""}</div>
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
  const err = o.reasonError
    ? `<span class="field-error" id="reason-error">${esc(o.reasonError)}</span>`
    : "";

  const revoke = record.revoked
    ? `<p class="muted">Revoked${record.revokedBy ? ` by ${person(ctx, record.revokedBy)}` : ""}${record.revokedAt ? `, ${esc(fmtDate(record.revokedAt))}` : ""}.</p>`
    : `<form class="dash-action" method="post" action="${action}/revoke" data-confirm="Revoke this ${kind.toLowerCase()}? It stays in the record but stops counting.">
      ${csrfField(ctx.viewer)}
      <p class="muted">Revoking keeps the record but stops it counting toward totals, escalation and the trust score. It does not lift a ban or timeout in Discord; use <code class="inline">/unban</code> or <code class="inline">/removetimeout</code> for that.</p>
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
    <dt>Member</dt><dd>${person(ctx, record.userId)}</dd>
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
        words_count: String(a.words.list.length),
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
      };
  }
}

/** Turn a submitted body back into form values, so a rejected form keeps what was typed. */
export function submittedValues(body: FormBody): Values {
  const v: Values = {};
  for (const [key, raw] of Object.entries(body ?? {})) {
    if (key === "_csrf") continue;
    const value = Array.isArray(raw) ? raw[raw.length - 1] : raw;
    if (typeof value !== "string") continue;
    v[key] = value === "on" ? true : value;
  }
  return v;
}

class Form {
  constructor(private readonly state: FormState) {}

  str(key: string): string {
    const v = this.state.values[key];
    return typeof v === "string" ? v : "";
  }

  on(key: string): boolean {
    return this.state.values[key] === true;
  }

  private errAttrs(key: string, helpId?: string): string {
    const err = this.state.errors[key];
    const ids = [err ? `${key}-error` : "", helpId ?? ""].filter(Boolean).join(" ");
    return `${err ? ' aria-invalid="true"' : ""}${ids ? ` aria-describedby="${ids}"` : ""}`;
  }

  private errText(key: string): string {
    const err = this.state.errors[key];
    return err ? `<span class="field-error" id="${key}-error">${esc(err)}</span>` : "";
  }

  private help(key: string, text?: string): string {
    return text ? `<span class="field-help" id="${key}-help">${text}</span>` : "";
  }

  checkbox(key: string, label: string, help?: string): string {
    return `<div class="field"><label class="check" for="f-${key}">
      <input type="checkbox" id="f-${key}" name="${key}"${this.on(key) ? " checked" : ""}${this.errAttrs(key)}>
      <span>${esc(label)}${help ? `<small>${help}</small>` : ""}</span>
    </label>${this.errText(key)}</div>`;
  }

  number(key: string, label: string, min: number, max: number, help?: string, extra = ""): string {
    return `<div class="field">
      <label for="f-${key}">${esc(label)}</label>
      <input type="number" id="f-${key}" name="${key}" min="${min}" max="${max}" step="1" inputmode="numeric" value="${esc(this.str(key))}"${this.errAttrs(key, help ? `${key}-help` : undefined)}${extra}>
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
      <label for="f-${key}">${esc(label)}</label>
      <select id="f-${key}" name="${key}"${this.errAttrs(key, help ? `${key}-help` : undefined)}${extra}>${html}</select>
      ${this.errText(key)}${this.help(key, help)}
    </div>`;
  }

  textarea(key: string, label: string, max: number, help?: string, extra = ""): string {
    return `<div class="field">
      <label for="f-${key}">${esc(label)}</label>
      <textarea id="f-${key}" name="${key}" maxlength="${max}"${this.errAttrs(key, help ? `${key}-help` : undefined)}${extra}>${esc(this.str(key))}</textarea>
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

function missingNote(id: string, list: Array<{ id: string }>, what: string): string {
  return id && !list.some(x => x.id === id)
    ? `<p class="callout warn">The saved ${what} (<code class="inline">${esc(id)}</code>) no longer exists or Aegis cannot see it. Pick a new one.</p>`
    : "";
}

const ACTION_OPTIONS = AUTOMOD_ACTIONS.map(a => ({ value: a, label: a === "delete" ? "Delete the message" : a === "warn" ? "Delete and warn" : "Delete and time out" }));

function sectionForm(
  section: SettingsSection,
  f: Form,
  ctx: GuildContext,
  channels: ChannelOption[],
  roles: RoleOption[],
  snapshot: SettingsSnapshot,
): string {
  switch (section) {
    case "logging":
      return `${missingNote(f.str("loggingChannelId"), channels, "log channel")}
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
      return `<p class="muted">The blocked word list (${esc(f.str("words_count") || "0")} words) and exemptions are edited with <code class="inline">/automod</code> in Discord.</p>
      <fieldset><legend>Blocked words</legend>
        ${f.checkbox("words_enabled", "Filter blocked words")}
        ${f.select("words_action", "When it matches", ACTION_OPTIONS)}
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
      </fieldset>`;

    case "welcome": {
      const sample = { username: ctx.viewer.username, serverName: ctx.guild.name, memberCount: ctx.guild.memberCount };
      return `${missingNote(f.str("welcomeChannelId"), channels, "welcome channel")}
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
      return `${missingNote(f.str("logChannelId"), channels, "transcript channel")}
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
        return `<div class="empty-state"><strong>Verification is not set up.</strong>Run <code class="inline">/verify setup</code> in Discord to post the panel members click. After that you can change the settings here.</div>`;
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
      </fieldset>`;

    case "starboard":
      return `${missingNote(f.str("channelId"), channels, "starboard channel")}
      <fieldset><legend>Starboard</legend>
        ${f.checkbox("enabled", "Starboard is on")}
        ${f.select("channelId", "Starboard channel", channelOptions(channels, "No channel"))}
        ${f.number("threshold", `${f.str("emoji") || "⭐"} reactions needed`, 1, 100)}
        ${f.checkbox("selfStar", "Count the author's own star")}
      </fieldset>
      <p class="muted">The emoji and ignored channels are set with <code class="inline">/starboard</code>.</p>`;
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
    ${sectionForm(section, f, ctx, channels, roles, snapshot)}
    ${canSave ? `<button class="btn" type="submit">Save ${SECTION_TITLES[section].toLowerCase()} settings</button>` : ""}
  </form>`,
  });
}
