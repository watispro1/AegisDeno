import { layout, themePicker } from "../../layout";
import { icon } from "./icons";
import { APP_CHROME, userMenu } from "./appChrome";
import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { GuildSummary, ViewerRoleLimit } from "../botView";
import { DASHBOARD_VERSION } from "../../../version";
import { NOTICES } from "./notices";
import { isDiscordCdnUrl } from "../cdn";
import { premiumPageAvailable } from "../../../config/stripe";
import { PREMIUM_BADGE } from "../../../config/premium";

export interface Viewer {
  userId: string;
  username: string;
  globalName: string | null;
  csrf: string;
  /** Discord CDN avatar URL, when the user has one. */
  avatarUrl?: string | null;
}

/** A server in the switcher: one the viewer can manage and Aegis is in. */
export interface SwitcherServer {
  id: string;
  name: string;
  iconUrl?: string | null;
}

export interface GuildContext {
  guild: GuildSummary;
  viewer: Viewer;
  /** Resolves a user ID to a cached username, if the bot has seen them. */
  nameOf: (userId: string) => string | null;
  /**
   * The viewer's highest role position and the server owner, read live for
   * this request. Role pickers only offer roles below it (owner exempt).
   * Missing means unknown, which fails closed.
   */
  roleLimit?: ViewerRoleLimit;
  /** Other servers for the sidebar switcher (from the login's server list). */
  servers?: SwitcherServer[];
  /** Whether the server has Aegis Premium (for the badge). Missing means no. */
  premium?: boolean;
}

export type GuildSection =
  | "overview" | "settings"
  | "moderation" | "automod" | "cases" | "appeals" | "watchlist" | "logging"
  | "welcome" | "verification" | "panels" | "tickets" | "starboard" | "suggestions" | "giveaways" | "polls"
  | "autoresponders" | "automations" | "announce"
  | "activity" | "incident" | "trust" | "members" | "analytics" | "tools" | "modmail" | "digest" | "economy" | "premium";

interface NavItem { key: GuildSection; label: string; href: string; icon: string }

/** The sidebar, grouped like the bot's modules. Hrefs are relative to /dashboard/:guildId. */
export const MODULE_NAV: ReadonlyArray<{ group: string; items: ReadonlyArray<NavItem> }> = [
  { group: "General", items: [
    { key: "overview", label: "Overview", href: "", icon: "◎" },
    { key: "activity", label: "Activity", href: "/activity", icon: "⟲" },
    { key: "settings", label: "Settings", href: "/settings", icon: "⚙" },
    { key: "tools", label: "Modules & backup", href: "/tools", icon: "⇄" },
  ] },
  { group: "Moderation", items: [
    { key: "incident", label: "Incident Mode", href: "/incident", icon: "⚠" },
    { key: "members", label: "Members", href: "/members", icon: "☻" },
    { key: "trust", label: "Trust Score", href: "/trust", icon: "◈" },
    { key: "moderation", label: "Moderation", href: "/settings/escalation", icon: "⚖" },
    { key: "automod", label: "Automod", href: "/settings/automod", icon: "⛨" },
    { key: "cases", label: "Cases", href: "/cases", icon: "▤" },
    { key: "appeals", label: "Appeals", href: "/appeals", icon: "✉" },
    { key: "modmail", label: "ModMail", href: "/modmail", icon: "✆" },
    { key: "digest", label: "Staff digest", href: "/digest", icon: "☰" },
    { key: "watchlist", label: "Ghost Watch", href: "/watchlist", icon: "◉" },
    { key: "logging", label: "Logging", href: "/settings/logging", icon: "≡" },
  ] },
  { group: "Community", items: [
    { key: "welcome", label: "Welcome & Goodbye", href: "/settings/welcome", icon: "☺" },
    { key: "verification", label: "Verification", href: "/settings/verification", icon: "✓" },
    { key: "panels", label: "Role panels", href: "/panels", icon: "▦" },
    { key: "tickets", label: "Tickets", href: "/settings/tickets", icon: "✎" },
    { key: "starboard", label: "Starboard", href: "/settings/starboard", icon: "★" },
    { key: "suggestions", label: "Suggestions", href: "/suggestions", icon: "?" },
    { key: "giveaways", label: "Giveaways", href: "/giveaways", icon: "✦" },
    { key: "polls", label: "Polls", href: "/polls", icon: "▮" },
    { key: "economy", label: "Economy", href: "/economy", icon: "¤" },
  ] },
  { group: "Automation", items: [
    { key: "autoresponders", label: "Autoresponders", href: "/autoresponders", icon: "↩" },
    { key: "automations", label: "Scheduled messages", href: "/automations", icon: "◷" },
    { key: "announce", label: "Announcements", href: "/announce", icon: "✺" },
  ] },
  { group: "Records", items: [
    { key: "analytics", label: "Analytics", href: "/analytics", icon: "▥" },
  ] },
];

function initial(name: string): string {
  const ch = Array.from(name.trim())[0] ?? "?";
  return esc(ch.toUpperCase());
}

/** A server icon or avatar from Discord's CDN (the only image host the CSP allows), else the initial. */
function iconOrInitial(url: string | null | undefined, name: string, cls: string): string {
  return isDiscordCdnUrl(url)
    ? `<img class="${cls} has-img" src="${esc(url)}" alt="" width="32" height="32" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : `<span class="${cls}" aria-hidden="true">${initial(name)}</span>`;
}

export function serverSwitcher(ctx: GuildContext, cls = "switcher", meta = ""): string {
  const g = ctx.guild;
  const others = (ctx.servers ?? []).filter(s => s.id !== g.id).slice(0, 50);
  const idBase = cls.split(" ")[0];
  return `<details class="${cls}" data-menu>
      <summary class="switcher-current" aria-label="Switch server, current: ${esc(g.name)}">
        ${iconOrInitial(g.iconUrl, g.name, "g-icon")}
        ${meta ? `<span class="g-text"><span class="g-name">${esc(g.name)}</span><span class="g-meta">${meta}</span></span>` : `<span class="g-name">${esc(g.name)}</span>`}
        <span class="caret" aria-hidden="true">▾</span>
      </summary>
      <ul class="switcher-list" data-switcher-list>
        ${others.length > 6 ? `<li class="switcher-filter" data-js-only><label class="visually-hidden" for="${idBase}-q">Find a server</label><input type="search" id="${idBase}-q" data-switcher-filter placeholder="Find a server…" autocomplete="off"></li>` : ""}
        ${others.length ? `<li class="switcher-heading" aria-hidden="true">Switch to</li>` : ""}
        ${others.map(s => `<li><a href="/dashboard/${esc(s.id)}">${iconOrInitial(s.iconUrl, s.name, "g-icon sm")}${esc(s.name)}</a></li>`).join("")}
        <li class="switcher-all"><a href="/dashboard">All servers</a></li>
      </ul>
    </details>`;
}

/** "1,284 members" for the sidebar and overview header. */
export function memberLabel(n: number): string {
  const v = Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  return `${v.toLocaleString("en-US")} member${v === 1 ? "" : "s"}`;
}

/** Shown at the end of General when Premium is sold on Discord, or Stripe is configured for earlier website subscribers. */
export const PREMIUM_NAV_ITEM: NavItem = { key: "premium", label: "Premium", href: "/premium", icon: "✦" };

function sidebar(ctx: GuildContext, active: GuildSection): string {
  const g = ctx.guild;
  const base = `/dashboard/${esc(g.id)}`;
  const offered = premiumPageAvailable();
  const groups = MODULE_NAV.map(group => {
    const grp = offered && group.group === "General" ? { ...group, items: [...group.items, PREMIUM_NAV_ITEM] } : group;
    const hasActive = grp.items.some(i => i.key === active);
    return `<li class="nav-group"><details class="nav-group-details" open data-nav-group="${esc(grp.group)}"${hasActive ? ' data-active-group=""' : ""}>
      <summary class="nav-group-title"><span>${esc(grp.group)}</span><span class="nav-caret" aria-hidden="true">▾</span></summary>
      <ul class="nav-group-items">
        ${grp.items.map(i => `<li data-nav-item><a class="side-link" data-nav-key="${esc(i.key)}" title="${esc(i.label)}" href="${base}${i.href}"${i.key === active ? ' aria-current="page"' : ""}><span class="side-icon" aria-hidden="true">${icon(i.key)}</span>${esc(i.label)}</a></li>`).join("")}
      </ul>
    </details></li>`;
  }).join("");
  const meta = `${esc(memberLabel(g.memberCount))}${ctx.premium ? ` · <span class="premium-badge">${esc(PREMIUM_BADGE)}</span>` : ""}`;

  return `<aside class="app-side" id="dash-sidebar" data-drawer aria-label="Server menu">
    <div class="side-head">
      <a class="side-logo" href="/dashboard" title="All servers"><span class="brand-mark" aria-hidden="true">A</span><span class="side-logo-text">Aegis<span class="side-logo-tag">Dashboard</span></span></a>
      <button class="drawer-close" type="button" data-drawer-close aria-label="Close menu">${icon("close")}</button>
    </div>
    <div class="side-server">
      <a class="side-brand" href="${base}" title="${esc(g.name)} overview">${iconOrInitial(g.iconUrl, g.name, "g-icon")}<span class="side-brand-text"><span class="side-brand-name">${esc(g.name)}</span><span class="side-brand-meta">${meta}</span></span></a>
    </div>
    <div class="side-filter" data-js-only>
      <label class="visually-hidden" for="side-filter-q">Filter the menu</label>
      <input type="search" id="side-filter-q" class="side-filter-input" data-nav-filter placeholder="Filter menu…" autocomplete="off" aria-controls="dash-side-nav">
      <p class="side-filter-empty faint" data-nav-filter-empty hidden>No page matches.</p>
    </div>
    <nav class="side-scroll" aria-label="Modules"><ul class="side-nav" id="dash-side-nav">${groups}</ul></nav>
    <div class="side-foot">
      <a class="side-foot-link" href="/docs">Docs</a>
      <a class="side-foot-link" href="/status">Status</a>
      <a class="side-foot-link" href="/dashboard/changelog">v${esc(DASHBOARD_VERSION)}</a>
    </div>
  </aside>
  <div class="drawer-backdrop" data-drawer-close aria-hidden="true"></div>`;
}

/* Shell */

export function shell(cfg: SiteConfig, o: { title: string; path: string; body: string; viewer?: Viewer; scripts?: boolean; guild?: GuildContext; active?: GuildSection; extraScripts?: string }): string {
  const v = cfg.assetVersion ? `?v=${encodeURIComponent(cfg.assetVersion)}` : "";
  const support = cfg.supportUrl && /^https:\/\//.test(cfg.supportUrl) ? ` · <a href="${esc(cfg.supportUrl)}" rel="noopener noreferrer">Support server</a>` : "";
  const footer = `<p class="muted dash-foot"><span class="dash-foot-v">Dashboard v${esc(DASHBOARD_VERSION)}</span>. <a href="/dashboard/changelog">Dashboard changelog</a>: what changed in the dashboard. <span class="dash-foot-links"><a href="/docs">Docs</a> · <a href="/status">Status</a>${support}</span></p>`;
  let body: string;
  if (o.guild && o.viewer) {
    body = `<div class="app" data-app data-guild="${esc(o.guild.guild.id)}">
    ${sidebar(o.guild, o.active ?? "overview")}
    <div class="app-main">
      <header class="app-top">
        <button class="btn ghost sm drawer-toggle" type="button" aria-controls="dash-sidebar" aria-expanded="false" data-drawer-toggle>${icon("menu")}<span>Menu</span></button>
        <button class="icon-btn side-collapse" type="button" data-side-collapse aria-controls="dash-sidebar" aria-pressed="false" aria-keyshortcuts="BracketLeft" title="Collapse sidebar ([)">${icon("collapse")}<span class="visually-hidden">Collapse sidebar</span></button>
        <div class="app-top-switcher">${serverSwitcher(o.guild, "top-switcher")}</div>
        <form class="top-search" method="get" action="/dashboard/${esc(o.guild.guild.id)}/search" role="search">
          <label class="visually-hidden" for="top-q">Search cases and members</label>
          <span class="top-search-icon" aria-hidden="true">${icon("search")}</span>
          <input type="search" id="top-q" name="q" maxlength="64" placeholder="Search cases, members…" autocomplete="off">
        </form>
        <div class="app-top-actions">
          <button class="btn ghost sm palette-btn" type="button" data-palette-open aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K" title="Jump to (Ctrl+K)">${icon("command")}<span class="palette-btn-text">Jump to</span><kbd class="palette-kbd">Ctrl K</kbd></button>
          <button class="icon-btn shortcuts-btn" type="button" data-shortcuts-open aria-haspopup="dialog" aria-keyshortcuts="Shift+Slash" title="Keyboard shortcuts (?)">${icon("keyboard")}<span class="visually-hidden">Keyboard shortcuts</span></button>
          ${themePicker()}
          ${userMenu(o.viewer)}
        </div>
      </header>
      <main class="app-content" id="main" tabindex="-1">${o.body}</main>
      <footer class="dash-foot-wrap">${footer}</footer>
    </div>
  </div>${APP_CHROME}`;
  } else {
    const bar = o.viewer
      ? `<div class="dash-bar">
    <span>Signed in as <strong>${esc(o.viewer.globalName || o.viewer.username)}</strong> <span class="faint">(${esc(o.viewer.username)})</span></span>
    <form method="post" action="/dashboard/logout">
      ${csrfField(o.viewer)}
      <button class="btn ghost sm" type="submit">Log out</button>
    </form>
  </div>`
      : "";
    body = `<div class="wrap">${bar}${o.body}
  ${footer}</div>${o.viewer ? APP_CHROME : ""}`;
  }
  return layout({
    title: `${o.title} | Aegis dashboard`,
    description: "Manage Aegis for your Discord server: moderation cases and settings.",
    path: o.path,
    current: "/dashboard",
    body,
    inviteUrl: cfg.inviteUrl,
    supportUrl: cfg.supportUrl,
    version: cfg.version,
    ogImage: "/assets/og.png",
    noindex: true,
    omitCanonical: true,
    assetVersion: cfg.assetVersion,
    app: Boolean(o.guild && o.viewer),
    scripts: o.scripts === false ? "" : `<script src="/assets/dashboard.js${v}" defer></script>${o.extraScripts ?? ""}`,
  });
}

export function csrfField(viewer: Viewer): string {
  return `<input type="hidden" name="_csrf" value="${esc(viewer.csrf)}">`;
}

export interface HeadOptions {
  /** Small mono line above the title (the server name on module pages). */
  eyebrow?: string;
  /** Already-escaped HTML shown at the right of the header (buttons, pills). */
  actions?: string;
}

export function head(title: string, lead: string, crumbs: Array<[string, string | null]> = [], o: HeadOptions = {}): string {
  const trail = crumbs.length
    ? `<nav class="breadcrumbs" aria-label="Breadcrumb">${crumbs
        .map(([label, href]) => (href ? `<a href="${esc(href)}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`))
        .join(`<span class="sep" aria-hidden="true">/</span>`)}</nav>`
    : "";
  // Module pages name their server above the title, like the public pages' eyebrow.
  const eyebrow = o.eyebrow ?? (crumbs.length >= 3 ? crumbs[1][0] : "");
  return `${trail}<header class="page-head dash-head"><div class="dash-head-text">${eyebrow ? `<span class="eyebrow dash-eyebrow">${esc(eyebrow)}</span>` : ""}<h1>${esc(title)}</h1>${lead ? `<p class="lead">${lead}</p>` : ""}</div>${o.actions ? `<div class="dash-head-actions">${o.actions}</div>` : ""}</header>`;
}

/**
 * Kept for callers from before the sidebar: the sidebar now carries the
 * server's navigation, so this renders nothing.
 */
export function guildNav(_guildId: string, _active: GuildSection): string {
  return "";
}

/** Module on/off switch shown at the top of a module page. */
export function moduleStatus(on: boolean, label = on ? "Enabled" : "Disabled"): string {
  return `<span class="status-pill ${on ? "on" : "off"}">${esc(label)}</span>`;
}

export function notice(code: string | null | undefined): string {
  const n = code ? NOTICES[code] : undefined;
  if (!n) return "";
  return `<div class="notice${n.bad ? " bad" : ""}" role="status" data-toast-source${n.bad ? ' data-toast-bad' : ""}><p>${esc(n.text)}</p></div>`;
}

export function fmtDate(d: Date): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "unknown";
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

/**
 * "3 days ago" with the exact UTC time as a tooltip, in a <time> element.
 * `data-rel` lets dashboard.js keep the wording current on a page left open.
 */
export function relTime(d: Date | null | undefined, now = Date.now()): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "unknown";
  const diff = now - d.getTime();
  const abs = Math.abs(diff);
  const units: Array<[number, string]> = [[31_536_000_000, "year"], [2_592_000_000, "month"], [604_800_000, "week"], [86_400_000, "day"], [3_600_000, "hour"], [60_000, "minute"]];
  let text = "just now";
  for (const [ms, name] of units) {
    if (abs >= ms) { const n = Math.floor(abs / ms); text = diff >= 0 ? `${n} ${name}${n === 1 ? "" : "s"} ago` : `in ${n} ${name}${n === 1 ? "" : "s"}`; break; }
  }
  return `<time datetime="${d.toISOString()}" title="${fmtDate(d)}" data-rel>${text}</time>`;
}

/** A small button that copies an ID (dashboard.js); the ID stays selectable without JavaScript. */
export function copyId(id: string, label = "Copy ID"): string {
  return `<button class="btn sm ghost copy-id" type="button" data-copy="${esc(id)}" aria-label="${esc(label)} ${esc(id)}">${icon("copy")}</button>`;
}

/** relTime for an optional date, with a dash when there is none. */
export function relTimeOr(d: Date | null | undefined, fallback = "—"): string {
  return d instanceof Date && !Number.isNaN(d.getTime()) ? relTime(d) : fallback;
}

/** person() followed by a copy button for the user ID. */
export function personId(ctx: GuildContext, id: string): string {
  return `${person(ctx, id)} ${copyId(id, "Copy user ID")}`;
}

/** An ID as inline code with a copy button. */
export function idCode(id: string, label = "Copy ID"): string {
  return `<code class="inline">${esc(id)}</code> ${copyId(id, label)}`;
}

export function person(ctx: GuildContext, id: string): string {
  const name = ctx.nameOf(id);
  return name ? `${esc(name)} <span class="faint">${esc(id)}</span>` : `<code class="inline">${esc(id)}</code>`;
}

export interface EmptyAction { label: string; href: string }

/**
 * A friendly empty state block: icon, a bold title, an explanation (already
 * escaped HTML) and up to two next steps. Every dashboard "nothing here yet"
 * goes through this so they look and read the same.
 */
export function emptyState(title: string, text: string, action?: EmptyAction, o: { icon?: string; secondary?: EmptyAction } = {}): string {
  const link = (a: EmptyAction, ghost: boolean) => `<a class="btn ${ghost ? "ghost " : ""}sm empty-action" href="${esc(a.href)}">${esc(a.label)}</a>`;
  const actions = action || o.secondary
    ? `<span class="empty-actions">${action ? link(action, Boolean(o.secondary) === false) : ""}${o.secondary ? link(o.secondary, true) : ""}</span>`
    : "";
  return `<div class="empty-state"><span class="empty-icon" aria-hidden="true">${esc(o.icon ?? "∅")}</span><div class="empty-body"><strong>${esc(title)}</strong> ${text}${actions}</div></div>`;
}
