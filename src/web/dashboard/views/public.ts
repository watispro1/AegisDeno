import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { OAuthGuild } from "../permissions";
import { guildIconUrl, isDiscordCdnUrl } from "../cdn";
import { fmtNum, statStrip } from "../../pages/shared";
import { type Viewer, csrfField, head, notice, shell } from "./layout";

/* Public pages */

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
  const facts: Array<[string, string, string]> = [
    ["◎", "Only what it needs", `Your Discord username and the list of servers you are in. Aegis asks for the <code class="inline">identify</code> and <code class="inline">guilds</code> scopes only. It cannot read your messages or act as you.`],
    ["◷", "Seven-day sessions", "A session cookie keeps you signed in for up to 7 days. Logging out deletes the session."],
    ["⛨", "Checked on every page", "Every page checks that you have Manage Server or Administrator in that server, using a server list re-read from Discord at least every 10 minutes."],
    ["⟲", "Every change is logged", "Changes you make are recorded on the server's Activity page for 180 days."],
  ];
  return shell(cfg, {
    title: "Dashboard",
    path: "/dashboard",
    scripts: false,
    body: `<section class="dash-landing">
    <div class="dash-landing-text">
      <span class="eyebrow">Aegis dashboard</span>
      <h1>Run your server's moderation from a browser</h1>
      <p class="lead">Look through moderation cases and change server settings from a browser. You need Manage Server or Administrator in the server.</p>
      ${message}
      <div class="btn-row"><a class="btn" href="/dashboard/login">Log in with Discord</a><a class="btn ghost" href="/docs">Read the docs</a></div>
    </div>
    <ul class="dash-landing-preview" aria-hidden="true">
      <li><span class="lp-dot on"></span>Automod <span class="lp-n">6 of 8 rules on</span></li>
      <li><span class="lp-dot on"></span>Logging <span class="lp-n">Log channel set</span></li>
      <li><span class="lp-dot"></span>Escalation <span class="lp-n">3 steps</span></li>
      <li><span class="lp-dot on"></span>Tickets <span class="lp-n">2 open</span></li>
    </ul>
  </section>
  <h2 class="section-title">What it can see</h2>
  <ul class="notes dash-facts">
    ${facts.map(([icon, title, text]) => `<li class="dash-fact"><span class="dash-fact-icon" aria-hidden="true">${icon}</span><strong>${esc(title)}</strong><span>${text}</span></li>`).join("\n    ")}
  </ul>
  <p class="muted">Details are in the <a href="/privacy#discord-login">privacy policy</a>. By logging in you accept the <a href="/terms">terms</a>.</p>`,
  });
}

/** What usually causes an error page's status, and what to try. Shown under the message. */
export function errorHints(status: number): { label: string; hints: string[] } {
  switch (status) {
    case 400: return { label: "Bad request", hints: ["Go back and send the form again without editing the address.", "If you pasted a link, open the page from the menu instead."] };
    case 401: return { label: "Signed out", hints: ["Sessions last 7 days, and logging out anywhere ends this one.", "Log in again; anything you had typed was not saved."] };
    case 403: return { label: "No access", hints: ["You need Manage Server or Administrator in the server, or to own it.", "Roles changed in Discord can take a minute to reach the dashboard; reload after that.", "A form open for a long time expires: reload the page, then save again."] };
    case 404: return { label: "Not found", hints: ["The server, case or item may have been removed.", "Check that Aegis is still in the server, then refresh your server list."] };
    case 429: return { label: "Slow down", hints: ["The dashboard limits how fast pages and saves can be sent.", "Wait for the time above, then try again. Nothing is lost by waiting."] };
    case 503: return { label: "Temporarily unavailable", hints: ["Aegis could not reach its database or Discord just now.", "Your settings are safe. Try again in a minute, and check the status page if it continues."] };
    default: return status >= 500
      ? { label: "Something went wrong", hints: ["This one is on our side. Try again in a minute.", "If it keeps happening, the status page shows whether Aegis is having trouble."] }
      : { label: "Error", hints: [] };
  }
}

export function renderError(
  cfg: SiteConfig,
  o: { status: number; title: string; message: string; viewer?: Viewer; action?: { label: string; href: string; external?: boolean } },
): string {
  const action = o.action
    ? `<a class="btn" href="${esc(o.action.href)}"${o.action.external ? ' rel="noopener noreferrer" target="_blank"' : ""}>${esc(o.action.label)}</a>`
    : "";
  const info = errorHints(o.status);
  const status = Number.isInteger(o.status) && o.status >= 100 && o.status <= 599 ? String(o.status) : "";
  const hints = info.hints.length
    ? `<div class="dash-error-hints"><h2>What to try</h2><ul>${info.hints.map(h => `<li>${esc(h)}</li>`).join("")}</ul></div>`
    : "";
  return shell(cfg, {
    title: o.title,
    path: "/dashboard",
    viewer: o.viewer,
    scripts: false,
    body: `<section class="dash-error" data-status="${esc(status)}">
    <div class="dash-error-code" aria-hidden="true"><span>${esc(status || "!")}</span><small>${esc(info.label)}</small></div>
    <div class="dash-error-body">
      ${head(o.title, esc(o.message))}
      <div class="btn-row">${action}<a class="btn ghost" href="/dashboard">Back to your servers</a><a class="btn ghost" href="/status">Service status</a></div>
      ${hints}
    </div>
  </section>`,
  });
}

/* Server picker */

export function renderPicker(
  cfg: SiteConfig,
  viewer: Viewer,
  manageable: OAuthGuild[],
  invitable: Array<{ guild: OAuthGuild; inviteUrl: string | null }>,
  noticeCode: string | null,
  lastGuildId: string | null = null,
): string {
  // The last server opened goes first, tagged, when the viewer still manages it.
  const ordered = lastGuildId && manageable.some(g => g.id === lastGuildId)
    ? [...manageable.filter(g => g.id === lastGuildId), ...manageable.filter(g => g.id !== lastGuildId)]
    : manageable;
  const role = (g: OAuthGuild) => (g.owner ? "Owner" : isAdministrator(g.permissions) ? "Administrator" : "Manage Server");
  const filter = manageable.length > 6
    ? `<div class="table-tools picker-tools" data-js-only><label class="visually-hidden" for="picker-q">Find a server</label>
    <input class="table-search" type="search" id="picker-q" placeholder="Find a server…" data-list-filter="picker-list" autocomplete="off">
    <span class="faint" data-list-filter-count="picker-list" aria-live="polite"></span></div>`
    : "";
  const list = manageable.length
    ? `${filter}<ul class="guild-list" id="picker-list">${ordered
        .map(g => `<li data-filter-text="${esc(g.name.toLowerCase())}"><a class="guild-item${g.id === lastGuildId ? " last-used" : ""}" href="/dashboard/${esc(g.id)}">${pickerIcon(g)}<span class="guild-text"><span class="name">${esc(g.name)}</span><span class="guild-role">${esc(role(g))}</span></span>${g.id === lastGuildId ? `<span class="tag">Last opened</span>` : ""}<span class="guild-go" aria-hidden="true">&rarr;</span></a></li>`)
        .join("")}</ul>
  <p class="empty-state" data-list-filter-empty="picker-list" hidden>No server matches that name.</p>`
    : `<div class="empty-state"><span class="empty-icon" aria-hidden="true">∅</span><div class="empty-body"><strong>No servers to manage yet.</strong> Aegis is not in any server where you have Manage Server or Administrator.${cfg.inviteUrl && /^https:\/\//.test(cfg.inviteUrl) ? ` <a class="text-link" href="${esc(cfg.inviteUrl)}" rel="noopener noreferrer">Add Aegis to a server</a>` : ""}</div></div>`;

  const invites = invitable.length
    ? `<h2 class="section-title">Servers without Aegis</h2>
  <p class="muted">You manage these, but Aegis is not in them.</p>
  <ul class="guild-list guild-list-invite">${invitable
        .map(({ guild, inviteUrl }) => `<li><div class="guild-item">${pickerIcon(guild)}<span class="guild-text"><span class="name">${esc(guild.name)}</span></span>${
          inviteUrl
            ? `<span class="guild-actions"><a class="btn ghost sm" href="${esc(inviteUrl)}" rel="noopener noreferrer">Add Aegis<span class="visually-hidden"> to ${esc(guild.name)}</span></a> <button class="copy-btn" type="button" data-copy="${esc(inviteUrl)}" aria-label="Copy the invite link for ${esc(guild.name)}">Copy link</button></span>`
            : ""
        }</div></li>`)
        .join("")}</ul>
  <p class="muted invite-help">The button opens Discord's own page in your browser, where you pick the permissions and confirm. Discord may offer to open its app; if that stalls, choose to continue in the browser, or copy the link and open it in a browser where you are signed in to discord.com. When you are done, come back and refresh the list below.</p>`
    : "";

  const strip = statStrip([
    { label: "Ready to manage", value: fmtNum(manageable.length), note: manageable.length === 1 ? "server" : "servers" },
    { label: "Without Aegis", value: fmtNum(invitable.length), note: invitable.length ? "add it below" : "" },
  ], "Your servers at a glance");

  return shell(cfg, {
    title: "Your servers",
    path: "/dashboard",
    viewer,
    body: `${head("Your servers", "Servers where you have Manage Server or Administrator and Aegis is a member.", [], { eyebrow: "Dashboard" })}
  ${notice(noticeCode)}
  ${manageable.length + invitable.length > 0 ? strip : ""}
  ${list}
  ${invites}
  <form class="dash-action" method="post" action="/dashboard/refresh">
    ${csrfField(viewer)}
    <p class="muted">Added Aegis somewhere or got a new role? <button class="btn ghost sm" type="submit">Refresh the list</button></p>
  </form>`,
  });
}

/** True when a Discord permission bitfield (decimal string) holds Administrator. */
export function isAdministrator(permissions: string | null | undefined): boolean {
  return typeof permissions === "string" && /^\d{1,30}$/.test(permissions) && (BigInt(permissions) & 8n) !== 0n;
}

/** A server icon from Discord's CDN for the picker, else its initial. */
function pickerIcon(g: { id: string; name: string; icon?: string | null }): string {
  const url = guildIconUrl(g.id, g.icon ?? null, 96);
  if (url && isDiscordCdnUrl(url)) return `<img class="g-icon picker-icon has-img" src="${esc(url)}" alt="" width="40" height="40" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
  const ch = Array.from(g.name.trim())[0] ?? "?";
  return `<span class="g-icon picker-icon" aria-hidden="true">${esc(ch.toUpperCase())}</span>`;
}
