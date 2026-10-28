import { layout } from "./layout";
import {
  buildCatalog,
  groupByCategory,
  catalogStats,
  permissionMatrix,
  type CommandInfo,
  type OptionInfo,
} from "./catalog";
import { features, faqs, quickstart } from "./content";

export interface SiteConfig {
  inviteUrl: string;
  supportUrl: string;
  version: string;
  contactEmail: string;
  assetVersion: string;
}

export interface Stats {
  guilds: number;
  users: number;
  commands: number;
  ping: number;
  uptime: number;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Emit an href only for same-site or http(s) URLs. */
function safeUrl(url: string): string {
  const value = (url ?? "").trim();
  if (value === "" || value === "#") return "#";
  if (value.startsWith("/")) return escapeHtml(value);
  if (/^https?:\/\//i.test(value)) return escapeHtml(value);
  return "#";
}

function fmtUptime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

function statusWord(ping: number, online: boolean): { label: string; cls: string } {
  if (!online) return { label: "Offline", cls: "warn" };
  if (ping === 0) return { label: "Connecting", cls: "warn" };
  if (ping < 150) return { label: "Operational", cls: "ok" };
  if (ping < 350) return { label: "Degraded", cls: "warn" };
  return { label: "Unstable", cls: "danger" };
}

function page(cfg: SiteConfig, opts: {
  title: string;
  description: string;
  path: string;
  body: string;
  ogImage?: string;
  noindex?: boolean;
  omitCanonical?: boolean;
  headExtra?: string;
  scripts?: string;
}): string {
  return layout({
    title: opts.title,
    description: opts.description,
    path: opts.path,
    body: opts.body,
    current: opts.path,
    inviteUrl: cfg.inviteUrl,
    supportUrl: cfg.supportUrl,
    version: cfg.version,
    assetVersion: cfg.assetVersion,
    ogImage: opts.ogImage ?? "/assets/og.svg",
    noindex: opts.noindex,
    omitCanonical: opts.omitCanonical,
    headExtra: opts.headExtra,
    scripts: opts.scripts,
  });
}

/** JSON-LD graph injected into a page head. */
function jsonLd(data: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

/* ── Shared bits ───────────────────────────────────────────────────── */

function breadcrumb(label: string): string {
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span class="sep">/</span><span>${label}</span></nav>`;
}

function faqBlock(items: { q: string; a: string }[]): string {
  return `<div class="accordion" data-faq>
    ${items.map(item => `<details class="acc">
      <summary>${escapeHtml(item.q)}</summary>
      <div class="acc-body">${item.a}</div>
    </details>`).join("\n    ")}
  </div>`;
}

/** Closing line at the bottom of most pages: one button, no banner. */
function endNote(cfg: SiteConfig, text: string): string {
  return `<div class="end-note">
    <p>${text}</p>
    <div class="btn-row">
      <a class="btn" href="${safeUrl(cfg.inviteUrl)}">Add to Discord</a>
      ${cfg.supportUrl ? `<a class="btn ghost" href="${safeUrl(cfg.supportUrl)}" rel="noopener noreferrer">Support server</a>` : ""}
    </div>
  </div>`;
}

/**
 * Discord's slash-command input, as it looks while you fill in options.
 * `opts` are [name, value] pairs.
 */
function slashInput(name: string, opts: [string, string][]): string {
  return `<div class="dc-input" aria-label="${escapeHtml(`/${name} ${opts.map(([k, v]) => `${k}:${v}`).join(" ")}`)}">
      <span class="dc-cmd">/${escapeHtml(name)}</span>
      ${opts.map(([k, v]) => `<span class="dc-opt"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(v)}</span></span>`).join("\n      ")}
    </div>`;
}

/** A shell-style block of commands. */
function cmdBlock(lines: string): string {
  return `<pre class="block"><code>${escapeHtml(lines)}</code></pre>`;
}

/* ── Home ──────────────────────────────────────────────────────────── */

export function renderHome(cfg: SiteConfig, stats: Stats, online: boolean): string {
  const st = statusWord(stats.ping, online);
  const cs = catalogStats();

  const refRows = features.map(f => {
    return `<div class="ref-row">
      <h3><a href="/features#${f.id}">${escapeHtml(f.title)}</a></h3>
      <p>${escapeHtml(f.short)}</p>
      <div class="ref-cmd"><code>${escapeHtml(f.start)}</code></div>
    </div>`;
  }).join("\n    ");

  const steps = quickstart.map(s => `<li>
        <div>
          <h3>${escapeHtml(s.title)}</h3>
          <p>${s.body}</p>
          ${s.cmd ? cmdBlock(s.cmd) : ""}
        </div>
      </li>`).join("\n      ");

  const body = `
<div class="wrap">
  <section class="hero" aria-labelledby="hero-title">
    <div>
      <div class="hero-meta">
        <span><span class="dot${st.cls === "ok" ? "" : " danger"}" data-status-dot aria-hidden="true"></span><span data-status-state>${escapeHtml(st.label)}</span></span>
        <span>gateway <span data-live="ping" data-suffix=" ms">${stats.ping} ms</span></span>
        <span>v${escapeHtml(cfg.version)}</span>
      </div>
      <h1 id="hero-title">A moderation bot for Discord, run from slash commands.</h1>
      <p class="lead">Aegis handles warnings, timeouts, bans and the case log behind them, plus automod, ban appeals, tickets, verification and logging. There is no dashboard to sign in to. You type a command in your server and it does the thing.</p>
      <div class="btn-row">
        <a class="btn" href="${safeUrl(cfg.inviteUrl)}">Add to Discord</a>
        <a class="text-link" href="/commands">See all ${cs.commands} commands &rarr;</a>
      </div>
    </div>

    <div class="hero-aside">
      <div class="dc" role="img" aria-label="Example: a moderator runs /warn and Aegis replies with the warning details">
        <div class="dc-bar"><span aria-hidden="true">#</span><b>mod-chat</b></div>
        <div class="dc-body">
          <div class="dc-msg">
            <div class="dc-avatar bot" aria-hidden="true">A</div>
            <div>
              <div class="dc-used">@sam used <code>/warn</code></div>
              <div class="dc-name">Aegis<span class="dc-tag">BOT</span><small>Today at 21:14</small></div>
              <div class="dc-embed yellow">
                <div class="dc-embed-title">Warning issued: medium severity</div>
                <div class="dc-fields">
                  <div class="dc-field"><b>User</b>@quickcash99</div>
                  <div class="dc-field"><b>Moderator</b>sam</div>
                  <div class="dc-field"><b>Total warnings</b>2 on record</div>
                </div>
                <div class="dc-field dc-reason"><b>Reason</b>Posting invite links in #general</div>
              </div>
            </div>
          </div>
        </div>
        ${slashInput("trustscore", [["user", "@quickcash99"]])}
      </div>
      <p class="hero-caption">Simplified example. The names are made up; the fields match the real reply.</p>
    </div>
  </section>
</div>

<section class="section" aria-labelledby="what-title">
  <div class="wrap">
    <div class="section-head">
      <h2 id="what-title">What it does</h2>
      <p>Each line links to the details. The command on the right is where you would start.</p>
    </div>
    <div class="ref">
    ${refRows}
    </div>
  </div>
</section>

<section class="section" aria-labelledby="setup-title">
  <div class="wrap two-col">
    <div>
      <div class="section-head">
        <h2 id="setup-title">Setting it up</h2>
        <p>About five minutes. The <a href="/docs">docs</a> cover the rest.</p>
      </div>
      <ol class="steps">
      ${steps}
      </ol>
    </div>
    <div>
      <div class="section-head">
        <h2>Good to know</h2>
      </div>
      <ul class="notes">
        <li><strong>No Administrator.</strong> The invite asks only for the permissions its commands use. You can read the <a href="/docs#permissions">full list</a> before inviting.</li>
        <li><strong>Role order matters.</strong> Discord will not let a bot act on someone whose top role is above its own. Drag the Aegis role above the roles it should moderate.</li>
        <li><strong>Records expire.</strong> Warnings, cases and staff notes are deleted after a year.</li>
        <li><strong>Per-server data.</strong> Nothing is shared between servers. See the <a href="/privacy">privacy policy</a>.</li>
        <li><strong>Free.</strong> No paid tier, no locked features.</li>
      </ul>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="faq-title">
  <div class="wrap">
    <div class="section-head">
      <h2 id="faq-title">Questions</h2>
    </div>
    ${faqBlock(faqs)}
    ${endNote(cfg, `By adding Aegis you accept the <a href="/terms">terms</a> and <a href="/privacy">privacy policy</a>.`)}
  </div>
</section>`;

  return page(cfg, {
    title: "Aegis: a Discord moderation bot",
    description:
      "Aegis is a Discord moderation bot: warnings, timeouts, bans and case logs, plus automod, ban appeals, tickets, verification and logging. Configured with slash commands.",
    path: "/",
    body,
    headExtra: jsonLd({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "SoftwareApplication",
          name: "Aegis",
          applicationCategory: "SocialNetworkingApplication",
          operatingSystem: "Discord",
          description:
            "A Discord moderation bot: cases, automod, ban appeals, tickets, verification and logging, configured with slash commands.",
          softwareVersion: cfg.version,
          url: process.env.SITE_URL || "/",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          featureList: features.map(f => f.title),
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${process.env.SITE_URL || ""}/` },
          ],
        },
      ],
    }),
  });
}

/* ── Features ──────────────────────────────────────────────────────── */

export function renderFeatures(cfg: SiteConfig): string {
  const toc = features.map(f => `<li><a href="#${f.id}">${escapeHtml(f.title)}</a></li>`).join("\n        ");

  const sections = features.map(f => `<section class="feature" id="${f.id}" aria-labelledby="${f.id}-title">
      <h2 id="${f.id}-title">${escapeHtml(f.title)}</h2>
      <p>${escapeHtml(f.text)}</p>
      <ul>
        ${f.points.map(p => `<li>${escapeHtml(p)}</li>`).join("\n        ")}
      </ul>
      <div class="feature-cmds">
        ${f.commands.map(([c, d]) => `<div><code>${escapeHtml(c)}</code><span>${escapeHtml(d)}</span></div>`).join("\n        ")}
      </div>
      ${f.docs ? `<p class="feature-links"><a href="/docs#${f.docs}">Setup notes in the docs</a></p>` : ""}
    </section>`).join("\n\n    ");

  const body = `
<div class="wrap">
  ${breadcrumb("Features")}
  <div class="page-head">
    <h1>Features</h1>
    <p class="lead">What Aegis does, one area at a time, with the commands you would actually type. For every option on every command, see the <a href="/commands">command reference</a>.</p>
  </div>

  <details class="toc-mobile">
    <summary>Jump to a section</summary>
    <ul>
      ${toc}
    </ul>
  </details>

  <div class="split">
    <aside class="toc" aria-label="Sections">
      <p class="side-title">On this page</p>
      <ul>
        ${toc}
      </ul>
    </aside>
    <div>
    ${sections}
    ${endNote(cfg, "Want to try it on a test server first? That works too.")}
    </div>
  </div>
</div>`;

  return page(cfg, {
    title: "Features | Aegis",
    description:
      "Moderation and cases, automod, trust score, ban appeals, watchlist, mod reports, logging, tickets, verification and community tools in the Aegis Discord bot.",
    path: "/features",
    body,
  });
}

/* ── Commands ──────────────────────────────────────────────────────── */

function optHint(o: OptionInfo): string {
  return `${o.name}:${o.type.toLowerCase()}`;
}

/** One usage line per subcommand (or one for the command), optional options in brackets. */
function synopsis(cmd: CommandInfo): string {
  const line = (prefix: string, opts: OptionInfo[]) =>
    [
      escapeHtml(prefix),
      ...opts.map(o => (o.required ? escapeHtml(optHint(o)) : `<span class="opt">[${escapeHtml(optHint(o))}]</span>`)),
    ].join(" ");

  const lines = cmd.subcommands.length
    ? cmd.subcommands.map(s => line(`/${cmd.name} ${s.path}`, s.options))
    : [line(`/${cmd.name}`, cmd.options)];

  return `<pre class="synopsis">${lines.join("\n")}</pre>`;
}

function optionsTable(cmd: CommandInfo): string {
  const all: OptionInfo[] = [
    ...cmd.options,
    ...cmd.subcommands.flatMap(s =>
      s.options.map(o => ({ ...o, name: `${s.path} ${o.name}` }))
    ),
  ];

  if (all.length === 0) return `<p class="faint">No options.</p>`;

  return `<div class="table-wrap">
    <table class="opt-table">
      <thead><tr><th>Option</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
      <tbody>
        ${all.map(o => `<tr>
          <td><code>${escapeHtml(o.name)}</code></td>
          <td>${escapeHtml(o.type)}</td>
          <td>${o.required ? `<span class="opt-req">yes</span>` : `<span class="opt-opt">no</span>`}</td>
          <td>${escapeHtml(o.description)}${o.choices.length ? `<br><span class="faint">Choices: ${o.choices.map(escapeHtml).join(", ")}</span>` : ""}</td>
        </tr>`).join("\n        ")}
      </tbody>
    </table>
  </div>`;
}

function commandCard(cmd: CommandInfo): string {
  const options = [
    ...cmd.options,
    ...cmd.subcommands.flatMap(s => s.options.map(o => ({ ...o, name: `${s.path} ${o.name}` }))),
  ];

  const searchBlob = [
    cmd.name,
    cmd.category,
    cmd.description,
    ...cmd.subcommands.map(s => `${s.path} ${s.description}`),
    ...options.map(o => `${o.name} ${o.description} ${o.choices.join(" ")}`),
    ...cmd.declaredPermissions,
    ...cmd.enforcedPermissions,
  ]
    .join(" ")
    .toLowerCase();

  const perms = [...new Set([...cmd.declaredPermissions, ...cmd.enforcedPermissions])];
  const anchor = `cmd-${cmd.name}`;
  const name = escapeHtml(cmd.name);

  return `<details class="cmd-card" id="${anchor}" data-category="${escapeHtml(cmd.category)}" data-search="${escapeHtml(searchBlob)}">
  <summary>
    <a class="cmd-anchor" href="#${anchor}" aria-label="Link to /${name}">#</a>
    <span class="cmd-slash" data-cmd-name>/${name}</span>
    <span class="cmd-summary-text"><span class="cmd-desc">${escapeHtml(cmd.description)}</span></span>
    <span class="cmd-meta">
      ${cmd.subcommands.length ? `<span class="tag">${cmd.subcommands.length} sub</span>` : ""}
      ${perms.length ? `<span class="tag warn">${escapeHtml(perms[0])}${perms.length > 1 ? ` +${perms.length - 1}` : ""}</span>` : ""}
    </span>
    <span class="cmd-chevron" aria-hidden="true"></span>
  </summary>
  <div class="cmd-body">
    <div>
      <div class="cmd-section-title">Usage</div>
      ${synopsis(cmd)}
    </div>
    <div class="cmd-run">
      <button class="copy-btn" type="button" data-copy="/${name}" aria-label="Copy /${name}">Copy /${name}</button>
      <a class="copy-btn" href="/api/commands/${encodeURIComponent(cmd.name)}">JSON</a>
    </div>
    ${cmd.subcommands.length ? `<div>
      <div class="cmd-section-title">Subcommands</div>
      <div class="table-wrap">
        <table>
          <tbody>
            ${cmd.subcommands.map(s => `<tr><td><code>/${name} ${escapeHtml(s.path)}</code></td><td>${escapeHtml(s.description)}</td></tr>`).join("\n            ")}
          </tbody>
        </table>
      </div>
    </div>` : ""}
    <div>
      <div class="cmd-section-title">Options</div>
      ${optionsTable(cmd)}
    </div>
    <div>
      <div class="cmd-section-title">Permissions</div>
      <p class="cmd-perms">${perms.length ? `Members need ${perms.map(p => `<strong>${escapeHtml(p)}</strong>`).join(", ")}.` : "Anyone in the server can run it."}${cmd.botPermissions.length ? ` Aegis needs ${cmd.botPermissions.map(escapeHtml).join(", ")}.` : ""}${cmd.guildOnly ? " Server only, not in DMs." : ""}</p>
    </div>
  </div>
</details>`;
}

export function renderCommands(cfg: SiteConfig): string {
  const cat = groupByCategory();
  const s = catalogStats();

  const filterChips = [
    `<button class="tab" type="button" data-cat="all" aria-pressed="true">All<span class="n">${s.commands}</span></button>`,
    ...cat.map(
      g => `<button class="tab" type="button" data-cat="${escapeHtml(g.category)}" aria-pressed="false">${escapeHtml(g.label)}<span class="n">${g.commands.length}</span></button>`
    ),
  ].join("\n    ");

  const groups = cat.map(g => `<section class="cmd-group" data-cmd-group="${escapeHtml(g.category)}" id="${escapeHtml(g.category)}" aria-labelledby="${escapeHtml(g.category)}-title">
  <div class="cmd-group-head">
    <h2 id="${escapeHtml(g.category)}-title">${escapeHtml(g.label)}</h2>
    <span class="blurb">${escapeHtml(g.blurb)}</span>
    <span class="n">${g.commands.length}</span>
  </div>
  ${g.commands.map(commandCard).join("\n  ")}
</section>`).join("\n\n");

  const body = `
<div class="wrap">
  ${breadcrumb("Commands")}
  <div class="page-head">
    <h1>Commands</h1>
    <p class="lead">${s.commands} commands, ${s.subcommands} subcommands, ${s.options} options. This page is generated from the command definitions at startup, so it matches what the bot registers. Open a command for its usage line, options and permissions.</p>
  </div>

  <div class="cmd-toolbar">
    <div class="search">
      <span class="icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      </span>
      <label class="visually-hidden" for="cmd-search">Search commands</label>
      <input id="cmd-search" type="search" placeholder="Filter by name, option or permission" autocomplete="off" spellcheck="false">
      <span class="hint" aria-hidden="true"><kbd>/</kbd></span>
    </div>
    <span class="cmd-count" id="cmd-count" role="status">${s.commands} commands</span>
  </div>

  <div class="tabs" id="cmd-filter" role="group" aria-label="Filter by category">
    ${filterChips}
  </div>

  <div id="cmd-empty" class="empty-state" hidden>
    <strong>No commands match.</strong>
    Try a shorter word, or set the filter back to All.
  </div>

  ${groups}

  <p class="faint">Each command is also available as JSON at <code class="inline">/api/commands/ban</code> (swap in any name), and the full list at <a href="/api/commands">/api/commands</a>. Release notes are in the <a href="/changelog.xml">Atom feed</a>.</p>
  ${endNote(cfg, "In Discord, type <code class=\"inline\">/</code> to see the same list with autocomplete.")}
</div>`;

  return page(cfg, {
    title: "Commands | Aegis",
    description:
      "Searchable reference for every Aegis slash command: usage, subcommands, options and required permissions.",
    path: "/commands",
    body,
    headExtra: jsonLd({
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: "Aegis command reference",
      description:
        "Searchable reference for every Aegis slash command, including subcommands, options, and required permissions.",
      url: `${process.env.SITE_URL || ""}/commands`,
      softwareVersion: cfg.version,
    }),
  });
}

/* ── Docs ──────────────────────────────────────────────────────────── */

const DOC_SECTIONS = [
  { id: "quickstart", label: "Quickstart" },
  { id: "moderation", label: "Moderation" },
  { id: "automod", label: "Automod" },
  { id: "trustscore", label: "Trust score" },
  { id: "appeal", label: "Ban appeals" },
  { id: "watchlist", label: "Watchlist" },
  { id: "modreport", label: "Mod reports" },
  { id: "logging", label: "Logging" },
  { id: "tickets", label: "Tickets" },
  { id: "verification", label: "Verification" },
  { id: "community", label: "Community tools" },
  { id: "automation", label: "Reminders" },
  { id: "configuration", label: "Configuration" },
  { id: "permissions", label: "Permissions" },
  { id: "data", label: "Data and storage" },
];

const PERMISSION_WHY: Record<string, string> = {
  "Ban Members": "Banning and unbanning, and approving appeals.",
  "Kick Members": "Removing a member without a ban.",
  "Moderate Members": "Applying and lifting timeouts; most staff-only views.",
  "Manage Messages": "Bulk deletes, automod deletes and panel messages.",
  "Manage Channels": "Ticket channels, channel locks and slowmode.",
  "Manage Roles": "Verification roles and role panels.",
  "Manage Server": "Server-wide settings and automod rules.",
  "Manage Nicknames": "Changing member nicknames.",
};

function permissionTable(): string {
  const rows = permissionMatrix();

  return `<div class="table-wrap">
    <table>
      <thead><tr><th>Permission</th><th>Commands</th><th>Why</th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td><strong>${escapeHtml(r.permission)}</strong></td>
          <td>${r.commands.map(c => `<code class="inline">${escapeHtml(c)}</code>`).join(" ")}</td>
          <td>${PERMISSION_WHY[r.permission] ?? "Needed to carry out the command."}</td>
        </tr>`).join("\n        ")}
      </tbody>
    </table>
  </div>`;
}

export function renderDocs(cfg: SiteConfig): string {
  const toc = DOC_SECTIONS.map(sec => `<li><a href="#${sec.id}">${escapeHtml(sec.label)}</a></li>`).join("\n        ");

  const body = `
<div class="wrap">
  ${breadcrumb("Docs")}
  <div class="page-head">
    <h1>Docs</h1>
    <p class="lead">How to set Aegis up and what each part expects. Commands are written the way you would type them in Discord. Exact options for every command are on the <a href="/commands">commands page</a>.</p>
  </div>

  <details class="toc-mobile">
    <summary>Jump to a section</summary>
    <ul>
      ${toc}
    </ul>
  </details>

  <div class="split">
    <aside class="toc" aria-label="On this page">
      <p class="side-title">On this page</p>
      <ul>
        ${toc}
      </ul>
      <p class="side-title">Elsewhere</p>
      <ul>
        <li><a href="/commands">Commands</a></li>
        <li><a href="/troubleshooting">Troubleshooting</a></li>
        <li><a href="/changelog">Changelog</a></li>
      </ul>
    </aside>

    <article class="prose">
      <h2 id="quickstart">Quickstart</h2>
      <ol>
        <li>Invite Aegis with the <a href="${safeUrl(cfg.inviteUrl)}">Add to Discord</a> link. Commands register when it joins.</li>
        <li>In <strong>Server Settings &rarr; Roles</strong>, drag the Aegis role above the roles it should moderate.</li>
        <li>Pick a log channel, then turn on the automod filters you want.</li>
        <li>Run diagnostics. It lists missing permissions and role-order problems.</li>
      </ol>
      ${cmdBlock(`/logging channel channel:#mod-log
/automod links toggle enabled:true
/automod words toggle enabled:true
/diagnostics`)}
      <div class="callout"><p>If commands do not show up, restart your Discord client. If they still do not, the bot was probably invited without the <code>applications.commands</code> scope; invite it again with the link above.</p></div>

      <h2 id="moderation">Moderation</h2>
      <p>Warn, timeout, kick and ban each check that both you and Aegis rank above the target, ask for confirmation, and create a case. Add <code>silent:true</code> to skip the DM to the member. The <code>reason</code> option suggests presets (Spam, NSFW, Harassment, Advertising, Raiding, Other) but takes any text, and <code>proof</code> attaches a screenshot to the case. Warn, timeout and ban show an Undo button for five minutes; it reverses the action and marks the case revoked.</p>
      ${cmdBlock(`/warn user:@member reason:Spam severity:Low
/timeout user:@member duration:1 hour reason:Arguing with staff proof:screenshot.png
/kick user:@member reason:Alt account
/ban user:@member reason:Raid account delete_messages:1
/unban user_id:123456789012345678`)}
      <h3>Cases and history</h3>
      ${cmdBlock(`/case view case_id:142
/case user user:@member
/case edit case_id:142 reason:Updated reason
/infractions user:@member
/note add user:@member`)}
      <h3>Escalation</h3>
      <p>Escalation rules act automatically when a member reaches a warning count. Timeout durations are in minutes. Set an expiry and warnings older than that many days stop counting; revoked warnings never count.</p>
      ${cmdBlock(`/escalation add warnings:3 action:Timeout duration:60
/escalation add warnings:5 action:Ban
/escalation expiry days:30
/escalation toggle enabled:true`)}
      <h3>Channels</h3>
      <p><code>/purge</code> can combine a filter with <code>user</code> and <code>keyword</code>, leaves pinned messages alone, and reports how many were deleted and how many were skipped for being older than 14 days.</p>
      ${cmdBlock(`/purge amount:50 filter:Bot messages only
/purge amount:200 filter:Messages with links user:@member
/lock channel channel:#general duration_minutes:15 message:Back in 15 minutes
/lock category category:Events duration_minutes:30
/lock unlock channel:#general
/slowmode custom seconds:10`)}

      <h2 id="automod">Automod</h2>
      <p>Five filters: blocked words, links, mentions, spam rate and caps. Each one is toggled separately and has its own action (delete, warn or timeout). Exempt your staff roles before turning filters on.</p>
      ${cmdBlock(`/automod status
/automod exempt addrole role:@Staff
/automod words add word:free nitro
/automod words action action:Delete and warn
/automod mentions limit count:5
/automod spam limit max:6 window:5
/automod caps limit percent:70`)}

      <h2 id="trustscore">Trust score</h2>
      <p><code>/trustscore user:@member</code> returns a score from 0 to 100 and shows how it was reached. Only you see the reply unless you set <code>ephemeral:false</code>.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Part</th><th>Points</th><th>How</th></tr></thead>
          <tbody>
            <tr><td>Account age</td><td>0 to 25</td><td>Scales up to two years old.</td></tr>
            <tr><td>Time in server</td><td>0 to 25</td><td>Scales up to one year.</td></tr>
            <tr><td>Long-tenure bonus</td><td>0, 6, 12 or 20</td><td>At 180 days, one year and two years in the server.</td></tr>
            <tr><td>Warnings</td><td>0 to &minus;30</td><td>&minus;5 per active warning.</td></tr>
            <tr><td>Infractions</td><td>0 to &minus;20</td><td>&minus;4 per timeout, kick or ban that was not undone.</td></tr>
            <tr><td>Message count</td><td>0, 2, 4, 7 or 10</td><td>At 10, 50, 250 and 1,000 messages in the server.</td></tr>
            <tr><td>Recent activity</td><td>0, 2 or 5</td><td>Active in the last 30 days or the last 7.</td></tr>
          </tbody>
        </table>
      </div>
      <p>The reply opens with a short list of why, biggest factor first. Aegis keeps only a message count and last-active time per member for this, never message content. The total is clamped to 0&ndash;100. 80 and up is <em>trusted</em>, 60 <em>established</em>, 40 <em>caution</em>, 20 <em>elevated risk</em>, below 20 <em>high risk</em>.</p>

      <h2 id="appeal">Ban appeals</h2>
      <p>Every ban that can DM the member sends them a code like <code>AGS-K7X2</code> with instructions. Since they are no longer in your server, they run the submit command from any other server Aegis is in; the DM tells them this.</p>
      ${cmdBlock(`/appeal submit code:AGS-K7X2
/appeal list status:Pending
/appeal view code:AGS-K7X2
/appeal review code:AGS-K7X2 decision:Approve note:Account secured`)}
      <p>Approving lifts the ban and DMs the member. Reviewing needs Ban Members; submitting does not.</p>

      <h2 id="watchlist">Watchlist</h2>
      <p>Adds a member to a private watch. You get DMs for the events you picked. Add <code>alert_channel</code> to also post them in a staff channel; the member is never told.</p>
      ${cmdBlock(`/watchlist add user:@member duration:7 Days events:All Events reason:Alt of a banned user
/watchlist add user:@member events:First Message of the Day + Voice Joins alert_channel:#mod-alerts
/watchlist list
/watchlist info user:@member
/watchlist remove user:@member`)}

      <h2 id="modreport">Mod reports</h2>
      ${cmdBlock(`/modreport period:Last 24 Hours
/modreport period:Last 7 Days ephemeral:false
/modstats period:Last 30 days`)}
      <p>The report has four views (overview, top offenders, staff, automod) behind buttons on the reply.</p>

      <h2 id="logging">Logging</h2>
      ${cmdBlock(`/logging channel channel:#mod-log
/logging status
/logging test
/logging toggle enabled:false`)}
      <p>Logs are posted to your channel and not stored anywhere else.</p>

      <h2 id="tickets">Tickets</h2>
      ${cmdBlock(`/ticket setup channel:#support staff_role:@Staff
/ticket claim
/ticket add user:@member
/ticket transcript
/ticket close reason:Solved`)}
      <p>Members can have one open ticket at a time. Aegis needs Manage Channels in the category where tickets are created.</p>

      <h2 id="verification">Verification</h2>
      ${cmdBlock(`/verify setup channel:#verify verified_role:@Member type:One-Click Button
/verify info
/verify user target:@member
/verify disable`)}
      <p>Set your other channels so that only the verified role can see them. The Aegis role has to sit above the verified role to grant it.</p>

      <h2 id="community">Community tools</h2>
      <h3>Starboard</h3>
      ${cmdBlock(`/starboard setup channel:#starboard
/starboard threshold count:5
/starboard emoji emoji:⭐
/starboard selfstar allowed:false
/starboard ignore action:add channel:#staff`)}
      <h3>Giveaways and polls</h3>
      ${cmdBlock(`/giveaway start prize:Nitro duration:24h winners:1
/giveaway reroll message_id:123456789012345678
/poll question:Next game night? option1:Friday option2:Saturday anonymous:true`)}
      <h3>Suggestions, welcome messages, role panels</h3>
      ${cmdBlock(`/suggest setup channel:#suggestions
/suggest approve id:12 reason:Doing it
/welcome channel channel:#welcome
/welcome message
/rolepanel create channel:#roles role1:@Events role2:@Updates`)}
      <p><code>/welcome message</code> opens a form. Placeholders: <code>{user}</code>, <code>{username}</code>, <code>{server}</code>, <code>{member_count}</code>.</p>

      <h2 id="automation">Reminders and schedules</h2>
      ${cmdBlock(`/remindme set reminder:Review appeals duration:2h
/remindme list
/remindme cancel id:abc123
/automation message in:1d channel:#announcements message:Event starts in an hour
/automation repeat interval:7d channel:#general message:Weekly thread is up
/automation list
/automation cancel id:abc123`)}
      <p>Durations use <code>30s</code>, <code>10m</code>, <code>2h</code>, <code>1d</code> (<code>/remindme</code> also takes <code>1w</code> and goes up to a year). Reminders, scheduled tasks and <code>/lock</code> auto-unlocks are restored after a restart.</p>

      <h2 id="configuration">Configuration</h2>
      ${cmdBlock(`/config view
/config logging channel:#mod-log enabled:true
/config welcome channel:#welcome enabled:true
/preset view
/plugins list`)}
      <p>Presets apply a bundle of automod and escalation settings in one go. Run <code>/preset view</code> to see what each one changes before applying it.</p>

      <h2 id="permissions">Permissions</h2>
      <p>Who can run what. Discord hides commands from members without the permission; Aegis checks again when the command runs, and checks its own permissions too.</p>
      ${permissionTable()}

      <h2 id="data">Data and storage</h2>
      <p>Settings, cases, warnings, tickets and appeals are stored in MongoDB, keyed by server ID. Warnings, cases and staff notes expire after one year. Audit logs live only in your log channel. The <a href="/privacy">privacy policy</a> has the full list.</p>
    </article>
  </div>
</div>`;

  return page(cfg, {
    title: "Docs | Aegis",
    description:
      "Setup and configuration for the Aegis Discord bot: moderation, automod, trust score, ban appeals, watchlist, logging, tickets, verification and permissions.",
    path: "/docs",
    body,
  });
}

/* ── Troubleshooting ───────────────────────────────────────────────── */

const ISSUES: { group: string; id: string; items: { q: string; a: string }[] }[] = [
  {
    group: "Permissions and role order",
    id: "cat-hierarchy",
    items: [
      {
        q: "Ban, timeout or role changes fail with “Missing Permissions”",
        a: `<p>Almost always role order. Discord does not let a bot act on a member whose highest role is equal to or above the bot's.</p>
        <ol>
          <li>Open <strong>Server Settings &rarr; Roles</strong>.</li>
          <li>Drag the Aegis role above every role it should moderate or assign.</li>
          <li>Check that the moderator running the command also outranks the target.</li>
          <li>Run <code>/diagnostics</code> to confirm.</li>
        </ol>`,
      },
      {
        q: "“Interaction failed” when pressing a button",
        a: `<p>Discord gives a bot three seconds to answer a button press. Confirmation buttons also expire after a short window.</p>
        <ol>
          <li>Run the command again to get fresh buttons.</li>
          <li>Check the <a href="/status">status page</a> for high latency.</li>
          <li>For old ticket or verification panels, run the setup command again to replace them.</li>
        </ol>`,
      },
    ],
  },
  {
    group: "Commands",
    id: "cat-commands",
    items: [
      {
        q: "Slash commands do not appear",
        a: `<ol>
          <li>Restart Discord (<kbd>Ctrl</kbd> + <kbd>R</kbd> on desktop).</li>
          <li>Re-invite Aegis with the <a href="/">Add to Discord</a> link; the <code>applications.commands</code> scope must be ticked.</li>
          <li>Check <strong>Server Settings &rarr; Integrations &rarr; Aegis</strong> for channel or role restrictions.</li>
        </ol>`,
      },
      {
        q: "Commands show up twice",
        a: `<p>Only relevant if you host your own copy: commands were registered both globally and for a test server. Set <code>DISCORD_CLEAR_GUILD_IDS</code> to the server ID, start the bot once, then remove the variable.</p>`,
      },
    ],
  },
  {
    group: "Automod",
    id: "cat-automod",
    items: [
      {
        q: "Automod is not deleting messages",
        a: `<ol>
          <li>Aegis needs <strong>Manage Messages</strong> and <strong>Read Message History</strong> in that channel.</li>
          <li>Run <code>/automod status</code> and check the filter is on.</li>
          <li>Check the author's roles and the channel against the exemptions in the same output.</li>
        </ol>`,
      },
      {
        q: "Automod keeps catching staff",
        a: `<p>Exempt the staff role, or the channel:</p><p><code>/automod exempt addrole role:@Staff</code><br><code>/automod exempt addchannel channel:#staff</code></p>`,
      },
    ],
  },
  {
    group: "Tickets and verification",
    id: "cat-tickets",
    items: [
      {
        q: "Tickets will not open",
        a: `<ol>
          <li>Aegis needs <strong>Manage Channels</strong> and <strong>Manage Roles</strong> in the ticket category.</li>
          <li>Discord caps a server at 500 channels; check you are under it.</li>
          <li>The member may already have an open ticket.</li>
        </ol>`,
      },
      {
        q: "Verification does not give the role",
        a: `<p>The Aegis role must be above the verified role, and Aegis needs <strong>Manage Roles</strong>. Run <code>/verify info</code> to see the current setup.</p>`,
      },
    ],
  },
  {
    group: "Reminders and welcome messages",
    id: "cat-automation",
    items: [
      {
        q: "Welcome messages or reminders do not arrive",
        a: `<ol>
          <li>Check the channel still exists with <code>/welcome status</code> or <code>/automation list</code>.</li>
          <li>Run <code>/welcome preview</code> to test delivery.</li>
          <li>Self-hosting: enable the Server Members and Message Content intents in the Discord Developer Portal.</li>
        </ol>`,
      },
    ],
  },
  {
    group: "Self-hosting",
    id: "cat-hosting",
    items: [
      {
        q: "The bot crashes on start with MongoServerSelectionError",
        a: `<ol>
          <li>In MongoDB Atlas, allow your host's IP under <strong>Network Access</strong>. Hosts with changing IPs (Fly.io and similar) need <code>0.0.0.0/0</code>.</li>
          <li>URL-encode special characters such as <code>@</code>, <code>#</code> and <code>/</code> in the password.</li>
          <li>Check the connection string starts with <code>mongodb+srv://</code>.</li>
        </ol>`,
      },
    ],
  },
];

export function renderTroubleshooting(cfg: SiteConfig): string {
  const groups = ISSUES.map(g => `<section class="issue-group" aria-labelledby="${g.id}">
      <h2 id="${g.id}">${escapeHtml(g.group)}</h2>
      ${g.items.map(i => `<details class="issue">
        <summary>${escapeHtml(i.q)}</summary>
        <div class="issue-body">${i.a}</div>
      </details>`).join("\n      ")}
    </section>`).join("\n\n    ");

  const body = `
<div class="wrap">
  ${breadcrumb("Troubleshooting")}
  <div class="page-head">
    <h1>Troubleshooting</h1>
    <p class="lead">Start with <code class="inline">/diagnostics</code> in your server. It checks permissions, configured channels and role order, and usually names the problem.</p>
  </div>

  <h2>Role order, the usual culprit</h2>
  <p class="muted">Discord only lets a role act on roles below it. That applies to bots even with every permission ticked.</p>
  <div class="hierarchy">
    <div class="bad">
      <span class="hierarchy-label">Does not work</span>
      <ol><li>Owner</li><li>Moderator</li><li><strong>Aegis</strong> (cannot touch moderators)</li><li>Member</li></ol>
    </div>
    <div class="good">
      <span class="hierarchy-label">Works</span>
      <ol><li>Owner</li><li><strong>Aegis</strong></li><li>Moderator</li><li>Member</li></ol>
    </div>
  </div>

  <div class="search help-search">
    <span class="icon" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    </span>
    <label class="visually-hidden" for="help-search">Filter problems</label>
    <input id="help-search" type="search" placeholder="Filter: permissions, automod, tickets…" autocomplete="off" spellcheck="false">
  </div>

  <div id="help-issue-list">
    ${groups}
  </div>
  <div id="help-empty" class="empty-state" hidden>
    <strong>Nothing matches.</strong>
    Ask in the support server and include the output of /diagnostics.
  </div>

  ${endNote(cfg, "Still stuck? The support server is the fastest way to reach a person.")}
</div>`;

  return page(cfg, {
    title: "Troubleshooting | Aegis",
    description: "Fixes for common Aegis problems: missing permissions, role order, missing slash commands, automod, tickets and self-hosting.",
    path: "/troubleshooting",
    body,
  });
}

/* ── Changelog ─────────────────────────────────────────────────────── */

export interface Release {
  version: string;
  date: string;
  tag?: string;
  summary?: string;
  highlights: string[];
}

export const RELEASES: Release[] = [
  {
    version: "3.4.0",
    date: "2026-10-26",
    tag: "Watchlist, trust score, ban appeals, mod reports",
    summary: "Four new moderation tools: /watchlist, /trustscore, /appeal and /modreport. Aegis also became closed source in this release.",
    highlights: [
      "[NEW] Ghost Watch (/watchlist): Silent member surveillance tracking messages, edits, deletes, joins, leaves, and role changes via gateway events with direct DM alerts to staff.",
      "[PERF] Ghost Watch High-Throughput Engine: In-memory O(1) active target Set rejection bypassing 99.99% of database queries on high-traffic servers.",
      "[NEW] Algorithmic Trust Score (/trustscore): 0–100 composite member integrity score factoring account age, server tenure, warning deductions, case history, and veteran bonuses.",
      "[FIXED] Trust Score: Parallelized database aggregation queries, added ephemeral privacy toggle, and fixed dynamic live refresh reactivity.",
      "[NEW] Automated Ban Appeal Workflow (/appeal): Generates unique 8-character appeal codes (AGS-XXXX) on /ban, delivers via DM, supports modal submissions, and automates unbanning upon staff approval.",
      "[FIXED] Appeal Access: Decoupled /appeal submit permissions so banned and regular members can file appeals without requiring staff permissions.",
      "[NEW] Moderation Analytics Digest (/modreport): Multi-tab interactive digest with Overview KPIs, Top Offenders leaderboard, Moderator activity rankings, and AutoMod rule triggers.",
      "[PERF] Mod Report Tab Caching: In-memory session embed caching providing instant (<5ms) tab switching and live on-demand re-querying.",
      "[WEB] High-Performance Solid Surfaces: Completely eliminated all -webkit-backdrop-filter and glassmorphism blurs for crisp, GPU-efficient 60fps rendering across all devices.",
      "[WEB] Navigation: Added direct Changelog link to the primary navigation bar across desktop and mobile layouts.",
      "[FIXED] Web Portal CSS: Repaired unclosed rules for .docs-mobile-nav and .back-to-top (restoring scroll return button) and added .ft-showcase-card[hidden] selector.",
      "[PERF] Web Portal Runtime: Deduplicated catalogStats() computation on home page, tightened command search debounce to 80ms, and removed duplicate escapeHtml closure.",
      "[UI] Web Portal Polish: Added interactive hover/active states for preview tab buttons and command pills with tactile micro-interactions and copy pill styling.",
      "[SYSTEM] Proprietary Architecture: Fully closed-source distribution with private package licensing.",
    ],
  },
  {
    version: "3.3.3",
    date: "2026-10-27",
    tag: "Core Moderation Overhaul & Production Hardening",
    summary: "Overhauled core moderation commands, removed experimental beta command lab bloat, and strengthened scheduler isolation, data validation, public telemetry, webhook handling, and moderation-data retention.",
    highlights: [
      "[ENHANCED] /warn: Quick rule violation presets, instant 10m timeout quick-escalation button, and interactive warning history.",
      "[ENHANCED] /timeout: Reason presets, dynamic remaining time extension, remove timeout, and on-demand case history inspector.",
      "[ENHANCED] /ban: Severe infraction presets, account age and join date audit metrics in confirmation embed, and 1-click ban revocation button.",
      "[ENHANCED] /case: Added /case user subcommand to browse member infraction history with action icons, and richer single-case cards.",
      "[ENHANCED] /purge: Added audit reason logging, case tracking in ModerationCaseModel, and visual progress bar.",
      "[CLEANUP] Pruned developer/beta bloat: completely removed experimental /beta Command Lab simulation suite and beta feedback models.",
      "[ENHANCED] AutoMod: Decoupled caps percentage and character flood detection from beta, enabling them universally via /automod caps.",
      "[SECURITY] Scheduler now validates channel ownership before delivering a message, preventing cross-guild delivery from stale or malformed tasks.",
      "[SECURITY] Command cooldowns reserve atomically before execution, blocking concurrent bypasses while releasing failed-command reservations.",
      "[SECURITY] Public telemetry no longer exposes Node.js version, heap usage, exact startup time, or plugin inventory.",
      "[SECURITY] Public API routes now have per-client rate limiting, and the Top.gg webhook rejects oversized request bodies.",
      "[RELIABILITY] Scheduler startup restoration is bounded, projected, indexed, and limited to valid recent tasks.",
      "[DATA] Guild configuration values are validated and bounded at the service boundary, including IDs, escalation rules, messages, and log categories.",
      "[DATA] Warnings, moderation cases, and staff notes now expire automatically after one year through MongoDB retention indexes.",
      "[MODERATION] Case exports are capped at 5,000 records and export only the fields required for an audit archive.",
      "[MAINTENANCE] Removed committed SQLite runtime databases and sidecar files; production dependency audit is clean.",
    ],
  },
  {
    version: "3.3.2",
    date: "2026-10-20",
    tag: "Starboard & Simulation Suite",
    summary: "Introduces the modular Starboard plugin, multi-guild beta network authorization, and structured feedback triage workflows.",
    highlights: [
      "[NEW] Starboard plugin v1.0.0: automatic message starboard powered by messageReactionAdd/Remove events with partial-data hydration.",
      "[NEW] /starboard suite: 8 subcommands for threshold, emoji, selfstar, ignore, and live star count synchronization.",
      "[ENHANCED] /beta program: multi-guild enrollment and feedback triage workflows.",
      "[NEW] Structured feedback ticketing with category, severity ratings, and staff triage (/beta feedback-triage, /beta feedback-view).",
      "[NEW] Tester honors and contributor leaderboard (/beta profile, /beta leaderboard) with earned diagnostic badges.",
      "[WEB] Documentation manual overhauled with interactive mobile navigation, reading progress indicator, and code copy tools.",
    ],
  },
  {
    version: "3.3.1",
    date: "2026-10-20",
    tag: "UI Performance & QoL Patch",
    summary: "Streamlined design system with crisp high-contrast theme tokens, quick command clipboard tools, and key bot reliability fixes.",
    highlights: [
      "[WEB] High-Contrast Themes: refreshed color palette tokens across dark, light, cyberpunk, emerald, and gold themes.",
      "[WEB] Command reference: integrated one-click command string clipboard copy with toast notifications.",
      "[WEB] Theme dots sync bug fix: resolved missing syncThemeDots reference on theme toggle.",
      "[BOT] /timeout command: quick action extend button now dynamically calculates remaining duration instead of overriding to flat 1 hour, with full audit logging.",
      "[BOT] /lock command: hardened channel iteration against thread channel exceptions during emergency server lockdown.",
      "[BOT] AutoResponder service: expanded token interpolation with {tag}, {user_id}, {server_id}, and {channel_id}.",
      "[BOT] Verification plugin: safe optional chaining on guild member resolution preventing unhandled interaction drops.",
    ],
  },
  {
    version: "3.3.0",
    date: "2026-10-17",
    tag: "Web Redesign & Knub v1.1",
    summary: "Complete design overhaul across the web portal, Knub framework v1.1.0 with high-throughput in-memory TTL caching, guild lifecycle hooks, and critical bot stability fixes.",
    highlights: [
      "[WEB] Portal redesign: clean editorial layout with high-contrast surfaces, responsive navigation, and instant search modal.",
      "[WEB] Respects accessibility via @media (prefers-reduced-motion) and clean high-contrast fallbacks.",
      "[NEW] Knub Plugin Framework v1.1.0: in-memory 30s TTL caching for plugin enablement and guild configuration to eliminate redundant MongoDB lookups.",
      "[NEW] Knub Framework: added setGuildConfig API allowing plugins to mutate and persist per-server plugin configurations dynamically.",
      "[NEW] Knub Framework: integrated onGuildLoaded lifecycle hook triggered on client startup and real-time Events.GuildCreate joins.",
      "[NEW] Knub Framework: added plugin dependency validation to catch missing prerequisite plugins at registration time.",
      "[FIXED] Role panel button handler upgraded to robust regex pattern matching preventing malformed customId splits.",
      "[FIXED] Bot client: safe navigation guards on GuildMemberRemove event preventing unhandled crashes when uncached members leave.",
      "[FIXED] Bot client: welcome message channel delivery fetches uncached channels from Discord API rather than silently dropping messages.",
      "[HARDENED] Bot client: streamlined component interaction routing directly through Knub plugin dispatcher, removing redundant legacy branches.",
    ],
  },
  {
    version: "3.2.0",
    date: "2026-10-15",
    tag: "Status Overhaul",
    summary: "Overhauled /about command with multi-panel telemetry navigation, rewrote the live status page with SLA tier visualization and uptime history, and promoted 3.1.1 reliability fixes.",
    highlights: [
      "[ENHANCED] /about completely redesigned with 4 navigable views (Overview, Runtime, Network, Database) via Discord select menu.",
      "[NEW] /about Runtime view shows heap usage bar graph, RSS, external memory, Node platform and PID.",
      "[NEW] /about Network view shows WebSocket shard status and top 5 largest guilds by member count.",
      "[NEW] /about Database view probes MongoDB round-trip latency and lists all registered Mongoose models.",
      "[ENHANCED] /about Refresh button disables after the 2-minute interaction window expires.",
      "[QOL] /help command now features direct action buttons to Web Documentation, Command Reference, and Live Status.",
      "[QOL] /dashboard command features a direct link button into the Web Dashboard control panel.",
      "[QOL] /remindme now supports week durations (1w) and provides smart interactive autocomplete presets.",
      "[QOL] /serverinfo surfaces instant links for high-resolution Server Icon and Banner.",
      "[WEB] Status page redesigned: SLA tier legend, 30-day uptime history bar, component health grid, endpoint directory.",
      "[WEB] Status page adds on-demand live refresh button with spin animation and toast feedback.",
      "[WEB] Added floating Back-to-Top smooth navigation button on long documentation and command pages.",
      "[WEB] Added keyboard shortcut (/) to instantly jump to and focus command search on /commands.",
      "[WEB] Copy-to-clipboard buttons now trigger toast feedback across all commands and code blocks.",
      "[WEB] Changelog updated to v3.2.0.",
    ],
  },
  {
    version: "3.1.1",
    date: "2026-10-13",
    tag: "Reliability & Safety Patch",
    summary: "A stability-focused release that secures interactive workflows, restores persistent giveaway controls after restarts, and strengthens the public website.",
    highlights: [
      "[FIXED] Giveaway Enter and View Entries controls now work persistently after the originating command completes, including after a bot restart.",
      "[HARDENED] Giveaway entry is atomic, honors required roles, prevents duplicate entrants, and keeps the visible entry total current.",
      "[HARDENED] Ticket controls now distinguish ticket owners from support staff; participant management, claims, and transcripts are staff-only.",
      "[HARDENED] Role panel interactions are verified against their stored panel and configured roles before a role can be changed.",
      "[FIXED] Suggestion Details controls display information instead of accidentally recording a downvote; concurrent votes no longer overwrite each other.",
      "[WEB] Top.gg webhook traffic is rejected until its authentication secret is configured, and dynamic website notices avoid unsafe HTML insertion.",
      "[WEB] Added global command and site search with keyboard shortcut support (Ctrl/Cmd + K), live command data, accessible dialog behavior, and mobile-ready results.",
      "[WEB] Simplified the interface with a focused light/dark theme switch, softer motion, flatter cards, and reduced background decoration.",
      "[ENHANCED] /help now provides command autocomplete, readable permission requirements, and safe long-form command details; /diagnostics now checks tickets, role panels, transcripts, and welcome-role readiness.",
      "[HARDENED] Timeout quick actions re-check the acting moderator's role hierarchy before changing another member's timeout.",
      "[WEB] Added a dedicated /troubleshooting support guide with structured fixes for commands, moderation, AutoMod, tickets, automation, website status, and deployment.",
      "[NEW] /beta program management: persistent tester roster, controlled feature flags, tester-only feedback, staff review, and home-server protections.",
      "[BETA] Experimental AutoMod caps detection adds a configurable uppercase threshold/action and a safe Command Lab preview for enrolled testers.",
      "[FIXED] Interactive polls retain their original deadline while live results update.",
    ],
  },
  {
    version: "3.1.0",
    date: "2026-10-09",
    tag: "Feature Drop",
    summary: "Giveaway system, redesigned polls, /infractions dashboard, /remindme, upgraded /slowmode, and a richer /announce with live preview editing.",
    highlights: [
      "[NEW] /giveaway suite — start, end, reroll, and list giveaways with role requirements, multi-winner support, auto-end timer, and DM notifications to winners.",
      "[NEW] /infractions — paginated staff dashboard showing per-user warnings and mod cases in one tabbed view with page navigation.",
      "[NEW] /remindme — personal DM reminder with flexible duration strings (30m, 2h, 1d) and optional channel ping delivery.",
      "[ENHANCED] /poll completely rewritten with interactive buttons, live vote progress bars, anonymous mode, multi-select toggle, image attachments, configurable duration, and an End Poll button for moderators.",
      "[ENHANCED] /announce upgraded with a live embed preview before sending, in-place title/body edit modal, 8-color palette picker, image and thumbnail URL fields, crosspost support for Announcement channels, and author brand suppression.",
      "[ENHANCED] /slowmode upgraded from a single integer input to a set/custom/check subcommand tree with friendly presets, quick-adjust action buttons, reason tracking, and current-rate checker.",
      "[WEB] Website changelog updated to v3.1.0 with all new command entries.",
    ],
  },
  {
    version: "3.0.0",
    date: "2026-10-09",
    tag: "Major Milestone",
    summary: "Enterprise Suite & Discovery Launch introducing emergency lockdown controls, staff member notes, severity-based warnings with undo buttons, interactive embed builder, content purge filters, Top.gg webhook, and live browser playground.",
    highlights: [
      "[NEW] /lock command suite — /lock channel, /lock unlock, and /lock server emergency raid lockdown control.",
      "[NEW] /note staff annotation suite — /note add, view, delete, clear backed by MongoDB StaffNoteModel.",
      "[ENHANCED] /warn command upgraded with Low/Medium/High severity choices, DM warning dispatch, silent flag, and instant undo button.",
      "[ENHANCED] /ban command updated with interactive 30s confirmation modal, pre-ban DM notification, and silent flag.",
      "[ENHANCED] /timeout command updated with duration parser (15m, 2h, 1d), DM notification, and silent flag.",
      "[ENHANCED] /userinfo updated with live presence/activity badges, mod cases button, and avatar link.",
      "[ENHANCED] /modstats interactive staff analytics dashboard with 7d/30d period selector & refresh button.",
      "[ENHANCED] /embed upgraded with interactive modal builder (builder subcommand) and fast mode (quick).",
      "[ENHANCED] /purge filter choices (all, bots, humans, links, images, embeds) with 14-day API age validation.",
      "[ENHANCED] /config structure converted to subcommand tree: view, logging, welcome, suggestions, language.",
      "[WEB] Built interactive Web Dashboard (/dashboard) and browser Command Playground (/playground) with 5 color themes.",
      "[WEB] Implemented Top.gg webhook handler endpoint (/api/topgg/webhook) with secret token authentication.",
    ],
  },
  {
    version: "2.1.1",
    date: "2026-10-08",
    tag: "Interactive Update",
    summary: "Interactive control panels, suggestion review states, manual member verification, and server blueprint permissions.",
    highlights: [
      "[NEW] /dashboard interactive server control panel with live metric counters & action buttons.",
      "[NEW] /suggest consider subcommand — marks suggestions as under active review (🟡 Under Consideration).",
      "[NEW] /verify user command — staff manual member verification bypass.",
      "[ENHANCED] Interactive warning action buttons (📜 Warning History, ❌ Undo Warn).",
      "[ENHANCED] Auto-responder subcommand aliases for create and delete.",
    ],
  },
  {
    version: "2.0.0",
    date: "2026-10-06",
    summary: "Repeated-offense escalation, telemetry dashboards, and automated recurring announcements.",
    highlights: [
      "[NEW] Repeated-offense escalation: automatically timeout, kick, or ban members when they hit configurable warning thresholds via /escalation.",
      "[NEW] Staff moderation dashboard via /modstats: guild-wide case count, recent actions, and top offenders in one embed.",
      "[NEW] Recurring announcements via /automation repeat — scheduled messages re-fire on an interval and survive restarts.",
      "[ENHANCED] Suggestions fully rewritten: /suggest setup, submit, approve, reject with live 👍/👎 vote buttons that update in real time.",
      "[ENHANCED] Polls upgraded to Discord's native poll API with configurable duration (1h–7d) and multi-select support.",
      "[ENHANCED] Welcome auto-role: /welcome role assigns a role to every new member on join.",
      "[SECURITY] Server diagnostics via /diagnostics: checks bot permissions, channel accessibility, and automod config with actionable recommendations.",
      "[SECURITY] Spam rate-limiting added to automod, along with message-edit checking and role/channel exemption lists.",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-10-01",
    summary: "Command permission overhaul and message scheduling safety.",
    highlights: [
      "[NEW] Added /nickname and persisted /automation message scheduling for safer server operations.",
      "[ENHANCED] Reworked command permission checks for selected welcome, logging, and announcement channels.",
      "[SECURITY] Hardened polls, moderation reasons, and external-user bans with validation that matches Discord behavior.",
      "[SECURITY] Reduced /config from Administrator to the least-privilege Manage Server permission.",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-10-01",
    summary: "Member diagnostics and AutoMod action flexibility.",
    highlights: [
      "[NEW] Added /userinfo and /serverinfo for quick, self-service member and server diagnostics.",
      "[ENHANCED] Expanded automod with mention-spam controls and per-rule delete, warn, or timeout actions.",
      "[FIX] Made automod warning writes reliable and normalized older automod records after upgrades.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-09-29",
    summary: "Public launch release.",
    highlights: [
      "[NEW] Public launch with moderation, auto moderation, logging, welcome, community, and automation command groups.",
      "[NEW] Slash commands are registered in a single scope to eliminate duplicate entries in the Discord client.",
      "[WEB] Introduced public website: home, features, searchable command reference, documentation, changelog, and status pages.",
    ],
  },
];

export const KNUB_RELEASES: Release[] = [
  {
    version: "1.1.0",
    date: "2026-10-17",
    tag: "Performance & Lifecycle",
    summary: "High-throughput in-memory TTL caching, dynamic guild config mutation API, guild discovery lifecycle hooks, and plugin dependency validation.",
    highlights: [
      "[NEW] In-memory 30s sliding TTL cache for isPluginEnabledForGuild and getGuildPluginConfig to avoid repeated MongoDB queries during high interaction volume.",
      "[NEW] Dynamic setGuildPluginConfig / ctx.setGuildConfig API for runtime persistent plugin configuration updates.",
      "[NEW] onGuildLoaded lifecycle dispatching on bot ready and Discord Events.GuildCreate server joins.",
      "[NEW] Plugin dependency validation during registerPlugin with early warning logs for missing required plugins.",
      "[ENHANCED] Clean component dispatch pipeline with regex capture group extraction and per-guild enablement enforcement.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-10-15",
    tag: "Framework Milestone",
    summary: "Production launch of the Knub TypeScript modular plugin architecture for the Aegis Discord bot.",
    highlights: [
      "[NEW] KnubPlugin & definePlugin modular framework organizing bot domains with typed configs, lifecycle hooks (onLoad, onUnload, onGuildLoaded), and event listeners.",
      "[NEW] Pre-Filter Command Pipeline: guildOnlyFilter, userPermissionsFilter, botPermissionsFilter, cooldownFilter, and per-guild plugin enablement guards.",
      "[NEW] Post-Execution Telemetry Hooks: execution latency tracking (telemetryHook) and automated cooldown timestamp recording (cooldownUpdateHook).",
      "[NEW] Interactive Component Dispatcher: routes button clicks, modals, and select menus matching plugin regex patterns with seamless fallback.",
      "[NEW] 9 Core Domain Plugins: Moderation, Community, Tickets, Roles, Verification, Automod, General, Config, and Autoresponder.",
      "[NEW] Server admin command /plugins: /plugins list with interactive StringSelectMenu toggle, /plugins toggle, and /plugins info.",
      "[ENHANCED] Server diagnostics via /diagnostics: added Knub Plugins health overview and asynchronous channel/role fetch fallbacks.",
      "[WEB] Public /api/plugins endpoint exposing plugin metadata, handler tallies, and live plugin counts on /health and /api/stats.",
    ],
  },
];


function renderHighlightItem(h: string): string {
  const match = h.match(/^\[([A-Z]+)\]\s*(.*)$/);
  if (!match) return `<li><span class="kind">note</span><span>${escapeHtml(h)}</span></li>`;

  const tag = match[1].toLowerCase();
  const kindClass =
    tag === "new" ? "new" :
    tag === "fix" || tag === "fixed" ? "fix" :
    tag === "security" || tag === "hardened" ? "security" : "";
  const label = tag === "fixed" ? "fix" : tag;

  return `<li><span class="kind${kindClass ? ` ${kindClass}` : ""}">${escapeHtml(label)}</span><span>${escapeHtml(match[2])}</span></li>`;
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

function releaseBlock(r: Release, idPrefix: string, label: string): string {
  const id = `${idPrefix}${r.version}`;
  return `<article class="release" id="${escapeHtml(id)}">
      <div class="release-meta">
        <a href="#${escapeHtml(id)}">${escapeHtml(label)}${escapeHtml(r.version)}</a>
        <time datetime="${r.date}">${fmtDate(r.date)}</time>
      </div>
      <div>
        ${r.tag ? `<h3>${escapeHtml(r.tag)}</h3>` : `<h3>${escapeHtml(label)}${escapeHtml(r.version)}</h3>`}
        ${r.summary ? `<p class="release-summary">${escapeHtml(r.summary)}</p>` : ""}
        <ul class="changes">
          ${r.highlights.map(renderHighlightItem).join("\n          ")}
        </ul>
      </div>
    </article>`;
}

export function renderChangelog(cfg: SiteConfig): string {
  const botToc = RELEASES.map(r => `<li><a href="#v${escapeHtml(r.version)}">${escapeHtml(r.version)}</a></li>`).join("\n        ");
  const knubToc = KNUB_RELEASES.map(r => `<li><a href="#knub-v${escapeHtml(r.version)}">Knub ${escapeHtml(r.version)}</a></li>`).join("\n        ");

  const body = `
<div class="wrap">
  ${breadcrumb("Changelog")}
  <div class="page-head">
    <h1>Changelog</h1>
    <p class="lead">Every release of the bot, newest first, followed by the Knub plugin framework it runs on. Subscribe with the <a href="/changelog.xml">Atom feed</a>.</p>
  </div>

  <div class="split">
    <aside class="toc" aria-label="Releases">
      <p class="side-title">Bot</p>
      <ul>
        ${botToc}
      </ul>
      <p class="side-title">Knub</p>
      <ul>
        ${knubToc}
      </ul>
    </aside>
    <div>
      <div class="track-head" id="bot"><h2>Aegis</h2><span>${RELEASES.length} releases</span></div>
      ${RELEASES.map(r => releaseBlock(r, "v", "v")).join("\n      ")}

      <div class="track-head" id="knub"><h2>Knub framework</h2><span>${KNUB_RELEASES.length} releases</span></div>
      ${KNUB_RELEASES.map(r => releaseBlock(r, "knub-v", "Knub ")).join("\n      ")}

      ${endNote(cfg, `Currently on v${escapeHtml(cfg.version)}.`)}
    </div>
  </div>
</div>`;

  return page(cfg, {
    title: "Changelog | Aegis",
    description: "Release history for the Aegis Discord bot and the Knub plugin framework.",
    path: "/changelog",
    body,
    headExtra: jsonLd({
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "Aegis changelog",
      url: `${process.env.SITE_URL || ""}/changelog`,
      blogPost: RELEASES.map(r => ({
        "@type": "BlogPosting",
        headline: `Aegis ${r.version}`,
        datePublished: r.date,
        url: `${process.env.SITE_URL || ""}/changelog#v${r.version}`,
        description: r.highlights.join(" "),
      })),
    }),
  });
}

/* ── Status ────────────────────────────────────────────────────────── */

export function renderStatus(cfg: SiteConfig, stats: Stats, online: boolean, startedAt: number): string {
  const st = statusWord(stats.ping, online);
  const good = st.cls === "ok";
  const startedDate = new Date(startedAt);
  const startedISO = startedDate.toISOString();
  const startedFmt = startedDate.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
  });

  const tier = (min: number, max: number) => online && stats.ping > 0 && stats.ping >= min && stats.ping < max;
  const tiers: [string, string, boolean][] = [
    ["Operational", "under 150 ms", tier(0, 150)],
    ["Degraded", "150 to 350 ms", tier(150, 350)],
    ["Unstable", "350 ms or more", tier(350, Infinity)],
    ["Connecting", "no heartbeat yet", online && stats.ping === 0],
    ["Offline", "not connected to Discord", !online],
  ];

  const body = `
<div class="wrap">
  ${breadcrumb("Status")}
  <div class="page-head">
    <h1>Status</h1>
    <p class="lead">Read live from the running bot when the page loads, then every 30 seconds.</p>
  </div>

  <div class="status-line${good ? "" : " bad"}" data-status-banner>
    <span class="dot${good ? "" : " danger"}" data-status-dot aria-hidden="true"></span>
    <h2 data-status-title>${good ? "Everything is running" : escapeHtml(st.label)}</h2>
    <p data-status-description>${good
      ? "Connected to Discord and answering commands."
      : "Commands may be slow or failing. Numbers below are live."}</p>
    <button class="btn ghost sm" type="button" data-status-refresh-btn>Check again</button>
  </div>

  <h2>Numbers</h2>
  <div class="table-wrap">
    <table class="metrics">
      <tbody>
        <tr><td>State</td><td data-status-state>${escapeHtml(st.label)}</td><td class="faint">Derived from gateway latency</td></tr>
        <tr><td>Gateway latency</td><td class="${good ? "good" : "warn"}" data-live="ping" data-suffix=" ms">${stats.ping} ms</td><td class="faint">Discord WebSocket heartbeat round trip</td></tr>
        <tr><td>Uptime</td><td data-uptime-from="${stats.uptime}">${fmtUptime(stats.uptime)}</td><td class="faint">Since <time datetime="${startedISO}">${escapeHtml(startedFmt)}</time></td></tr>
        <tr><td>Servers</td><td data-live="guilds">${stats.guilds.toLocaleString()}</td><td class="faint">Servers the bot is in right now</td></tr>
        <tr><td>Cached members</td><td data-live="users">${stats.users.toLocaleString()}</td><td class="faint">Sum of member counts across those servers</td></tr>
        <tr><td>Commands</td><td data-live="commands">${stats.commands}</td><td class="faint">Registered slash commands</td></tr>
        <tr><td>Version</td><td>v${escapeHtml(cfg.version)}</td><td class="faint"><a href="/changelog">Changelog</a></td></tr>
      </tbody>
    </table>
  </div>

  <h2>What the states mean</h2>
  <div class="table-wrap">
    <table class="metrics">
      <thead><tr><th>State</th><th>Gateway latency</th></tr></thead>
      <tbody>
        ${tiers.map(([name, range, current]) => `<tr${current ? ` class="current"` : ""}><td>${name}${current ? ` <span class="tag">now</span>` : ""}</td><td>${range}</td></tr>`).join("\n        ")}
      </tbody>
    </table>
  </div>

  <h2>Endpoints</h2>
  <p class="muted">For your own monitoring. All return JSON except the feed.</p>
  <div class="table-wrap">
    <table class="endpoints">
      <tbody>
        <tr><td><a href="/health"><code class="inline">/health</code></a></td><td>Up or down, version, uptime, server count, latency. Good for uptime checks.</td></tr>
        <tr><td><a href="/api/stats"><code class="inline">/api/stats</code></a></td><td>The numbers on this page.</td></tr>
        <tr><td><a href="/api/commands"><code class="inline">/api/commands</code></a></td><td>The command catalog with options and permissions.</td></tr>
        <tr><td><a href="/api/plugins"><code class="inline">/api/plugins</code></a></td><td>Registered Knub plugins.</td></tr>
        <tr><td><a href="/changelog.xml"><code class="inline">/changelog.xml</code></a></td><td>Atom feed of releases.</td></tr>
      </tbody>
    </table>
  </div>

  <p class="faint"><span data-status-refreshed>Values refresh every 30 seconds while this tab is open.</span></p>
</div>`;

  return page(cfg, {
    title: "Status | Aegis",
    description: "Live status for the Aegis Discord bot: gateway latency, uptime and health endpoints.",
    path: "/status",
    body,
  });
}

/* ── Legal ─────────────────────────────────────────────────────────── */

const EFFECTIVE_DATE = "October 1, 2026";


export function renderTerms(cfg: SiteConfig): string {
  const support = cfg.supportUrl
    ? `<a href="${safeUrl(cfg.supportUrl)}" rel="noopener noreferrer">support server</a>`
    : "support server";

  const body = `
<div class="wrap">
  ${breadcrumb("Terms")}
  <div class="page-head">
    <h1>Terms of Service</h1>
    <p class="lead">These terms govern your use of the Aegis Discord bot and this website. By adding Aegis to a server or using this site, you agree to them.</p>
    <p class="faint">Effective ${EFFECTIVE_DATE}.</p>
  </div>
</div>

<section>
  <div class="wrap">
    <div class="legal">
      <h2 id="acceptance">1. Acceptance of terms</h2>
      <p>These Terms of Service ("Terms") form a binding agreement between you and the Aegis maintainers ("we", "us"). If you do not agree with these Terms, do not invite Aegis to your server or otherwise use the service.</p>

      <h2 id="service">2. What Aegis is</h2>
      <p>Aegis is a software service delivered as a Discord application. It provides moderation, auto moderation, audit logging, welcome messaging, community, and automation tooling. Aegis is not affiliated with, endorsed by, or sponsored by Discord Inc.</p>

      <h2 id="eligibility">3. Eligibility and account responsibility</h2>
      <p>You must meet Discord's minimum age requirement to use Discord, and therefore to use Aegis. You are responsible for all activity that occurs under your Discord account, including any action Aegis takes that you or your server's moderators trigger.</p>

      <h2 id="acceptable-use">4. Acceptable use</h2>
      <p>You agree not to use Aegis to:</p>
      <ul>
        <li>Violate Discord's Terms of Service or Community Guidelines.</li>
        <li>Abuse, harass, threaten, or target any person, group, or the Discord platform.</li>
        <li>Conduct automated spam, mass mentions, or unsolicited advertising through the bot.</li>
        <li>Attempt to gain unauthorized access to the service, its host, or its data.</li>
        <li>Interfere with, overload, or disrupt the service or its infrastructure.</li>
        <li>Use the service to store or process content that is unlawful in your jurisdiction.</li>
      </ul>

      <h2 id="permissions">5. Server permissions and responsibility</h2>
      <p>Aegis acts strictly under the permissions and authority granted to it by each server. You are solely responsible for:</p>
      <ul>
        <li>Reviewing the permission list on the OAuth2 authorization screen before inviting Aegis.</li>
        <li>Placing Aegis' role at an appropriate height in your server's role hierarchy.</li>
        <li>Configuring moderation rules, blocked word lists, and log channels.</li>
        <li>Reviewing and appealing moderation actions taken by your moderators.</li>
      </ul>
      <p>Aegis is a tool. Decisions about who to punish, and how, remain with your server's moderation team.</p>

      <h2 id="availability">6. Availability</h2>
      <p>The service is provided "as is" and "as available". We do not guarantee uninterrupted, timely, or error-free operation. Scheduled maintenance, upstream Discord API changes, network failures, and events beyond our reasonable control may cause downtime. The <a href="/status">status page</a> reflects current availability but is not a service level agreement.</p>

      <h2 id="ip">7. Intellectual property</h2>
      <p>Aegis, including its source code, name, branding, and documentation, is owned by the maintainers and protected by applicable intellectual property law. These Terms grant you a limited, revocable, non-exclusive, non-transferable license to use the service as intended. Reverse engineering, reselling, or redistributing the service is not permitted.</p>

      <h2 id="third-party">8. Third-party services</h2>
      <p>Aegis depends on Discord, and may depend on infrastructure providers such as Fly.io. Your use of those services is governed by their own terms, over which we have no control. We are not responsible for the content, availability, or practices of any third party.</p>

      <h2 id="warranty">9. Disclaimer of warranties</h2>
      <p>To the maximum extent permitted by law, the service is provided without warranties of any kind, whether express or implied, including implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement. We do not warrant that the service will be uninterrupted, secure, or error-free.</p>

      <h2 id="liability">10. Limitation of liability</h2>
      <p>To the maximum extent permitted by law, the maintainers shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, data, goodwill, or server activity, arising out of or related to your use of the service. This includes losses resulting from misconfigured automod rules, unintended moderation actions, or reliance on the service as your sole moderation safeguard.</p>
      <p>Where liability cannot be excluded by law, it is limited to the greater of the amount you paid for the service (which is zero) or USD 50.</p>

      <h2 id="indemnity">11. Indemnification</h2>
      <p>You agree to indemnify and hold harmless the maintainers from any claim or demand, including reasonable legal fees, arising from your use of the service, your violation of these Terms, or your violation of Discord's policies.</p>

      <h2 id="changes">12. Modifications</h2>
      <p>We may update these Terms to reflect changes in the service or applicable law. The effective date at the top of this page indicates the current version. Continuing to use Aegis after an update constitutes acceptance of the revised Terms.</p>

      <h2 id="termination">13. Termination</h2>
      <p>You may stop using Aegis at any time by removing it from your server. We may suspend or terminate access, with or without notice, if you breach these Terms, if required by law, or if continued operation poses a security or abuse risk. Terminating access does not delete data already stored; see the <a href="/privacy">Privacy Policy</a> for retention.</p>

      <h2 id="governing-law">14. Severability and governing law</h2>
      <p>If any provision of these Terms is found unenforceable, the remaining provisions remain in effect. These Terms are governed by the laws applicable in the maintainers' principal place of operation, without regard to conflict of law rules. Any dispute will be handled through good-faith negotiation, and where that fails, through the courts of that jurisdiction.</p>

      <h2 id="contact">15. Contact</h2>
      <p>Questions about these Terms can be raised on our ${support} or by email at <a href="mailto:${escapeHtml(cfg.contactEmail)}">${escapeHtml(cfg.contactEmail)}</a>.</p>
    </div>
  </div>
</section>`;

  return page(cfg, {
    title: "Terms of Service | Aegis",
    description: "Terms governing use of the Aegis Discord bot and this website.",
    path: "/terms",
    body,
  });
}

export function renderPrivacy(cfg: SiteConfig): string {
  const support = cfg.supportUrl
    ? `<a href="${safeUrl(cfg.supportUrl)}" rel="noopener noreferrer">support server</a>`
    : "support server";

  const body = `
<div class="wrap">
  ${breadcrumb("Privacy")}
  <div class="page-head">
    <h1>Privacy Policy</h1>
    <p class="lead">What Aegis collects, why it collects it, and what it never does with it.</p>
    <p class="faint">Effective ${EFFECTIVE_DATE}.</p>
  </div>
</div>

<section>
  <div class="wrap">
    <div class="legal">
      <h2 id="summary">1. Summary</h2>
      <p>Aegis stores the minimum needed to run moderation and logging in each server. It does not build advertising profiles, it does not sell data, and it does not share data between servers. This website sets no cookies and runs no trackers.</p>

      <h2 id="controller">2. Who is responsible</h2>
      <p>The Aegis maintainers operate the service. Individual Discord servers that invite Aegis are separate controllers of the data they configure Aegis to process, and their own privacy policies apply to their members.</p>

      <h2 id="collected">3. Data we collect</h2>
      <p>Data is collected only as a consequence of a server owner or moderator configuring or using Aegis.</p>

      <h3>Server configuration</h3>
      <ul>
        <li>Guild ID, and the channel IDs selected for logging and welcome messages.</li>
        <li>Settings toggles: logging enabled, welcome enabled, automod rule states, slowmode, and similar.</li>
        <li>Blocked word and link filter lists, which you control.</li>
        <li>Scheduled automation jobs, including the channel, content, and interval.</li>
      </ul>

      <h3>Moderation records</h3>
      <ul>
        <li>User IDs of warned members, the warning reason, the moderator who issued it, and the timestamp.</li>
        <li>Details of moderation actions in audit log channels, including the moderator, target, and reason.</li>
        <li>Message content, but only when a moderation action deletes that message or an automod rule matches it, and only as needed to enforce the rule.</li>
      </ul>

      <h3>Operational data</h3>
      <ul>
        <li>Uptime and gateway latency, used for the <a href="/status">status page</a> and the homepage counters.</li>
        <li>Server logs containing error messages, used to diagnose faults.</li>
      </ul>

      <h2 id="not-collected">4. What we do not collect</h2>
      <ul>
        <li>Direct messages. Aegis is not built to act in DMs and does not store their contents.</li>
        <li>Passwords, payment details, or any Discord account credentials. Aegis only ever holds its own bot token.</li>
        <li>Advertising identifiers, cross-site tracking data, or behavioural profiles.</li>
        <li>Data harvested from servers where Aegis has not been invited.</li>
      </ul>

      <h2 id="use">5. How data is used</h2>
      <ul>
        <li>To execute the moderation, logging, and automation features a server has enabled.</li>
        <li>To maintain guild, member, and channel caches required for role hierarchy checks and routing.</li>
        <li>To detect and respond to abuse, including rate limit and permission errors.</li>
        <li>To publish aggregate counts on the homepage and status page, such as total servers and total members.</li>
      </ul>
      <p>Your data is never used for advertising, profiling, or model training.</p>

      <h2 id="website">6. Website privacy</h2>
      <p>The pages on this site are static and self-contained. They set no cookies, embed no analytics or advertising scripts, and transmit nothing about you to us. The only personal data this site processes is standard web server request logs, such as IP address and user agent, retained briefly for security and diagnostics.</p>
      <p>The site does store one local preference: your light or dark theme choice, kept in your browser's local storage. It is never transmitted and clearing site data removes it.</p>
      <p>The <a href="/health">status endpoint</a> returns bot metrics only and holds no requester data. <a href="/api/stats">/api/stats</a> does the same in JSON form.</p>

      <h2 id="retention">7. Data retention</h2>
      <ul>
        <li><strong>Configuration and automod rules:</strong> retained while Aegis is in the server, then deleted on removal or after a defined period.</li>
        <li><strong>Warnings, moderation cases, and staff notes:</strong> automatically expire after one year, or may be deleted earlier by an authorized moderator.</li>
        <li><strong>Audit log entries:</strong> written to your own Discord channel and governed by your message retention settings; we do not keep a separate copy.</li>
        <li><strong>Operational logs:</strong> retained for a short period for debugging, then discarded.</li>
      </ul>

      <h2 id="isolation">8. Data isolation between servers</h2>
      <p>All stored records are keyed by guild ID. Configuration, warnings, and rules in one server are never visible to, or mixed with, another server. This isolation is enforced in the application layer and is a design requirement, not a configuration option.</p>

      <h2 id="sharing">9. Sharing and disclosure</h2>
      <p>We do not sell, rent, or trade your data. We disclose data only in these cases:</p>
      <ul>
        <li>To Discord, as required to operate the service. Discord receives commands, messages, and member events under its own privacy policy.</li>
        <li>To infrastructure providers, such as Fly.io, strictly to host and run the service under our instructions.</li>
        <li>When required by law, or in good faith to protect the rights, safety, and integrity of the service, its users, or the public.</li>
      </ul>

      <h2 id="security">10. Security</h2>
      <p>Secrets are held in environment variables and are never written to source control, logs, or this website. Access to production systems is limited to the maintainers. No system is perfectly secure, so we do not claim that data held in connection with the service can be guaranteed breach-free.</p>

      <h2 id="rights">11. Your rights</h2>
      <p>Because the relevant data is largely held by Discord servers rather than by us, most requests are best directed at the server operator. A server moderator can remove data by clearing warnings, resetting configuration, or removing Aegis entirely.</p>
      <p>If you are a Discord user and want data removed concerning you, contact the operator of the relevant server, or reach us and we will assist where the data sits with us.</p>

      <h2 id="children">12. Children</h2>
      <p>The service is not directed at children under Discord's minimum age, and we do not knowingly collect personal information from them.</p>

      <h2 id="transfers">13. International transfers</h2>
      <p>The service is hosted on infrastructure that may be located outside your country. By using it you consent to the transfer and processing of data in those locations under the safeguards described here.</p>

      <h2 id="policy-changes">14. Changes to this policy</h2>
      <p>We may revise this policy as the service changes. The effective date at the top of this page indicates the current version, and material changes will be announced in the support server and on the <a href="/changelog">changelog</a>.</p>

      <h2 id="contact">15. Contact</h2>
      <p>Privacy questions and data requests can go to our ${support} or to <a href="mailto:${escapeHtml(cfg.contactEmail)}">${escapeHtml(cfg.contactEmail)}</a>.</p>
    </div>
  </div>
</section>`;

  return page(cfg, {
    title: "Privacy Policy | Aegis",
    description: "What data the Aegis Discord bot collects, how it is used, and how it is retained.",
    path: "/privacy",
    body,
  });
}

/* ── 404 ───────────────────────────────────────────────────────────── */

/* ── 404 ───────────────────────────────────────────────────────────── */

export function renderNotFound(cfg: SiteConfig): string {
  const body = `
<div class="wrap">
  <div class="page-head">
    <p class="eyebrow">404</p>
    <h1>Nothing here.</h1>
    <p class="lead">The page may have moved. Try one of these:</p>
  </div>
  <ul class="notes">
    <li><a href="/commands">Commands</a>: every slash command and its options</li>
    <li><a href="/docs">Docs</a>: setup and configuration</li>
    <li><a href="/">Home</a></li>
  </ul>
</div>`;

  return page(cfg, {
    title: "Page not found | Aegis",
    description: "The requested page could not be found.",
    path: "/404",
    body,
    noindex: true,
    omitCanonical: true,
  });
}

/* ── Legacy routes ─────────────────────────────────────────────────── */

export function renderDashboard(cfg: SiteConfig, _stats?: Stats, _online?: boolean): string {
  return renderFeatures(cfg);
}

export function renderPlayground(cfg: SiteConfig): string {
  return renderFeatures(cfg);
}
