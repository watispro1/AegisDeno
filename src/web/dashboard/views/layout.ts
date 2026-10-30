import { layout } from "../../layout";
import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { GuildSummary } from "../botView";
import { DASHBOARD_VERSION } from "../../../version";

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

export function shell(cfg: SiteConfig, o: { title: string; path: string; body: string; viewer?: Viewer; scripts?: boolean }): string {
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

export type GuildSection = "overview" | "cases" | "appeals" | "panels" | "settings" | "activity";

export function guildNav(guildId: string, active: GuildSection): string {
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

export function notice(code: string | null | undefined): string {
  const n = code ? NOTICES[code] : undefined;
  if (!n) return "";
  return `<div class="notice${n.bad ? " bad" : ""}" role="status"><p>${esc(n.text)}</p></div>`;
}

export function fmtDate(d: Date): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "unknown";
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function person(ctx: GuildContext, id: string): string {
  const name = ctx.nameOf(id);
  return name ? `${esc(name)} <span class="faint">${esc(id)}</span>` : `<code class="inline">${esc(id)}</code>`;
}
