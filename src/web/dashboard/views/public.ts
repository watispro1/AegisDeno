import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { OAuthGuild } from "../permissions";
import { type Viewer, csrfField, head, notice, shell } from "./layout";

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
    <li>A session cookie keeps you signed in for up to 7 days. Logging out deletes the session.</li>
    <li>Every page checks that you have Manage Server or Administrator in that server, using a server list re-read from Discord at least every 10 minutes.</li>
    <li>Changes you make are recorded on the server's Activity page for 180 days.</li>
  </ul>
  <p class="muted">Details are in the <a href="/privacy#discord-login">privacy policy</a>. By logging in you accept the <a href="/terms">terms</a>.</p>`,
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
          inviteUrl
            ? `<span class="guild-actions"><a class="btn ghost sm" href="${esc(inviteUrl)}" rel="noopener noreferrer">Add Aegis<span class="visually-hidden"> to ${esc(guild.name)}</span></a> <button class="copy-btn" type="button" data-copy="${esc(inviteUrl)}" aria-label="Copy the invite link for ${esc(guild.name)}">Copy link</button></span>`
            : ""
        }</div></li>`)
        .join("")}</ul>
  <p class="muted invite-help">The button opens Discord's own page in your browser, where you pick the permissions and confirm. Discord may offer to open its app; if that stalls, choose to continue in the browser, or copy the link and open it in a browser where you are signed in to discord.com. When you are done, come back and refresh the list below.</p>`
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
