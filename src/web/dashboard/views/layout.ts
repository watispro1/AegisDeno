import { layout } from "../../layout";
import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { GuildSummary, ViewerRoleLimit } from "../botView";
import { DASHBOARD_VERSION } from "../../../version";
import { NOTICES } from "./notices";
import { isDiscordCdnUrl } from "../cdn";

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
}

export type GuildSection =
  | "overview" | "settings"
  | "moderation" | "automod" | "cases" | "appeals" | "watchlist" | "logging"
  | "welcome" | "verification" | "panels" | "tickets" | "starboard" | "suggestions" | "giveaways"
  | "autoresponders" | "automations" | "announce"
  | "activity" | "incident" | "trust" | "members" | "analytics" | "tools" | "modmail" | "digest";

interface NavItem { key: GuildSection; label: string; href: string; icon: string }

/** The sidebar, grouped like the bot's modules. Hrefs are relative to /dashboard/:guildId. */
export const MODULE_NAV: ReadonlyArray<{ group: string; items: ReadonlyArray<NavItem> }> = [
  { group: "General", items: [
    { key: "overview", label: "Overview", href: "", icon: "◎" },
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
  ] },
  { group: "Automation", items: [
    { key: "autoresponders", label: "Autoresponders", href: "/autoresponders", icon: "↩" },
    { key: "automations", label: "Scheduled messages", href: "/automations", icon: "◷" },
    { key: "announce", label: "Announcements", href: "/announce", icon: "✺" },
  ] },
  { group: "Records", items: [
    { key: "activity", label: "Activity", href: "/activity", icon: "⟲" },
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

function sidebar(ctx: GuildContext, active: GuildSection): string {
  const g = ctx.guild;
  const base = `/dashboard/${esc(g.id)}`;
  const others = (ctx.servers ?? []).filter(s => s.id !== g.id).slice(0, 50);
  const switcher = `<details class="switcher" data-menu>
      <summary class="switcher-current" aria-label="Switch server, current: ${esc(g.name)}">
        ${iconOrInitial(g.iconUrl, g.name, "g-icon")}
        <span class="g-name">${esc(g.name)}</span>
        <span class="caret" aria-hidden="true">▾</span>
      </summary>
      <ul class="switcher-list">
        ${others.map(s => `<li><a href="/dashboard/${esc(s.id)}">${iconOrInitial(s.iconUrl, s.name, "g-icon sm")}${esc(s.name)}</a></li>`).join("")}
        <li class="switcher-all"><a href="/dashboard">All servers</a></li>
      </ul>
    </details>`;
  const groups = MODULE_NAV.map(grp => `<li class="nav-group"><span class="nav-group-title">${esc(grp.group)}</span><ul>
      ${grp.items.map(i => `<li><a class="side-link" href="${base}${i.href}"${i.key === active ? ' aria-current="page"' : ""}><span class="side-icon" aria-hidden="true">${i.icon}</span>${esc(i.label)}</a></li>`).join("")}
    </ul></li>`).join("");
  return `<aside class="app-side" id="dash-sidebar" data-drawer aria-label="Server menu">
    ${switcher}
    <nav aria-label="Modules"><ul class="side-nav">${groups}</ul></nav>
  </aside>`;
}

function userMenu(viewer: Viewer): string {
  const shown = viewer.globalName || viewer.username;
  return `<details class="user-menu" data-menu>
      <summary aria-label="Account menu">${iconOrInitial(viewer.avatarUrl, shown, "avatar")}<span class="user-name">${esc(shown)}</span></summary>
      <div class="user-panel">
        <p>Signed in as <strong>${esc(shown)}</strong> <span class="faint">(${esc(viewer.username)})</span></p>
        <p><a href="/dashboard">Your servers</a> · <a href="/dashboard/changelog">What's new</a></p>
        <form method="post" action="/dashboard/logout">
          ${csrfField(viewer)}
          <button class="btn ghost sm" type="submit">Log out</button>
        </form>
      </div>
    </details>`;
}

/** Shared page furniture: toasts, the unsaved-changes bar and the confirm dialog (all driven by dashboard.js). */
const APP_CHROME = `<div class="toast-region" data-toasts aria-live="polite" aria-atomic="false"></div>
  <div class="unsaved-bar" data-unsaved-bar hidden role="region" aria-label="Unsaved changes">
    <span>You have unsaved changes</span>
    <span class="btn-row"><button class="btn ghost sm" type="button" data-unsaved-reset>Reset</button><button class="btn sm" type="button" data-unsaved-save>Save</button></span>
  </div>
  <dialog class="palette" data-palette aria-label="Jump to a page">
    <label class="visually-hidden" for="palette-q">Jump to</label>
    <input type="search" id="palette-q" data-palette-input placeholder="Jump to a module or setting… (Enter to search cases)" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-autocomplete="list">
    <ul id="palette-list" class="palette-list" role="listbox" data-palette-list></ul>
    <p class="faint palette-hint">↑ ↓ to move · Enter to open · Esc to close</p>
  </dialog>
  <dialog class="palette shortcuts" data-shortcuts aria-labelledby="shortcuts-h">
    <h2 id="shortcuts-h">Keyboard shortcuts</h2>
    <dl class="shortcut-list">
      <div><dt><kbd>Ctrl</kbd> <kbd>K</kbd> / <kbd>⌘</kbd> <kbd>K</kbd></dt><dd>Jump to a page or search cases</dd></div>
      <div><dt><kbd>/</kbd></dt><dd>Focus the table filter on this page</dd></div>
      <div><dt><kbd>Ctrl</kbd> <kbd>S</kbd> / <kbd>⌘</kbd> <kbd>S</kbd></dt><dd>Save the form you changed</dd></div>
      <div><dt><kbd>?</kbd></dt><dd>Show this list</dd></div>
      <div><dt><kbd>Esc</kbd></dt><dd>Close dialogs and menus</dd></div>
    </dl>
    <form method="dialog"><button class="btn sm" type="submit">Close</button></form>
  </dialog>
  <dialog class="confirm-dialog" data-confirm-dialog aria-labelledby="confirm-title">
    <form method="dialog">
      <h2 id="confirm-title">Are you sure?</h2>
      <p data-confirm-text></p>
      <div class="btn-row"><button class="btn ghost" value="cancel" type="submit">Cancel</button><button class="btn danger" value="ok" type="submit" data-confirm-ok>Confirm</button></div>
    </form>
  </dialog>`;

/* ── Shell ─────────────────────────────────────────────────────────── */

export function shell(cfg: SiteConfig, o: { title: string; path: string; body: string; viewer?: Viewer; scripts?: boolean; guild?: GuildContext; active?: GuildSection }): string {
  const v = cfg.assetVersion ? `?v=${encodeURIComponent(cfg.assetVersion)}` : "";
  const footer = `<p class="muted dash-foot">Dashboard v${esc(DASHBOARD_VERSION)}. <a href="/dashboard/changelog">Dashboard changelog</a>: what changed in the dashboard.</p>`;
  let body: string;
  if (o.guild && o.viewer) {
    body = `<div class="app" data-app>
    ${sidebar(o.guild, o.active ?? "overview")}
    <div class="app-main">
      <div class="app-top">
        <button class="btn ghost sm drawer-toggle" type="button" aria-controls="dash-sidebar" aria-expanded="false" data-drawer-toggle>☰ <span>Menu</span></button>
        <span class="app-top-title">${esc(o.guild.guild.name)}</span>
        <form class="top-search" method="get" action="/dashboard/${esc(o.guild.guild.id)}/search" role="search">
          <label class="visually-hidden" for="top-q">Search cases and members</label>
          <input type="search" id="top-q" name="q" maxlength="64" placeholder="Search cases, members…" autocomplete="off">
        </form>
        <button class="btn ghost sm palette-btn" type="button" data-palette-open aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K" title="Jump to (Ctrl+K)">⌘K</button>
        <button class="btn ghost sm" type="button" data-shortcuts-open aria-haspopup="dialog" aria-keyshortcuts="Shift+Slash" title="Keyboard shortcuts (?)">?</button>
        ${userMenu(o.viewer)}
      </div>
      <div class="app-content">${o.body}</div>
      ${footer}
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
    scripts: o.scripts === false ? "" : `<script src="/assets/dashboard.js${v}" defer></script>`,
  });
}

export function csrfField(viewer: Viewer): string {
  return `<input type="hidden" name="_csrf" value="${esc(viewer.csrf)}">`;
}

export function head(title: string, lead: string, crumbs: Array<[string, string | null]> = []): string {
  const trail = crumbs.length
    ? `<nav class="breadcrumbs" aria-label="Breadcrumb">${crumbs
        .map(([label, href]) => (href ? `<a href="${esc(href)}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`))
        .join(`<span class="sep" aria-hidden="true">/</span>`)}</nav>`
    : "";
  return `${trail}<div class="page-head"><h1>${esc(title)}</h1>${lead ? `<p class="lead">${lead}</p>` : ""}</div>`;
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

/** "3 days ago" with the exact UTC time as a tooltip, in a <time> element. */
export function relTime(d: Date | null | undefined, now = Date.now()): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "unknown";
  const diff = now - d.getTime();
  const abs = Math.abs(diff);
  const units: Array<[number, string]> = [[31_536_000_000, "year"], [2_592_000_000, "month"], [604_800_000, "week"], [86_400_000, "day"], [3_600_000, "hour"], [60_000, "minute"]];
  let text = "just now";
  for (const [ms, name] of units) {
    if (abs >= ms) { const n = Math.floor(abs / ms); text = diff >= 0 ? `${n} ${name}${n === 1 ? "" : "s"} ago` : `in ${n} ${name}${n === 1 ? "" : "s"}`; break; }
  }
  return `<time datetime="${d.toISOString()}" title="${fmtDate(d)}">${text}</time>`;
}

/** A small button that copies an ID (dashboard.js); the ID stays selectable without JavaScript. */
export function copyId(id: string, label = "Copy ID"): string {
  return `<button class="btn sm ghost copy-id" type="button" data-copy="${esc(id)}" aria-label="${esc(label)} ${esc(id)}">⧉</button>`;
}

export function person(ctx: GuildContext, id: string): string {
  const name = ctx.nameOf(id);
  return name ? `${esc(name)} <span class="faint">${esc(id)}</span>` : `<code class="inline">${esc(id)}</code>`;
}

/** A friendly empty state block. */
export function emptyState(title: string, text: string): string {
  return `<div class="empty-state"><strong>${esc(title)}</strong> ${text}</div>`;
}
