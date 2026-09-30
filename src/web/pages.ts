import { layout } from "./layout";
import {
  buildCatalog,
  groupByCategory,
  catalogStats,
  permissionMatrix,
  type CommandInfo,
  type OptionInfo,
} from "./catalog";
import { features, faqs, quickstart, type Feature } from "./content";

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

/* ── Shared components ─────────────────────────────────────────────── */

function statCard(label: string, value: string, attr?: string): string {
  return `<div class="stat">
    <div class="stat-value"${attr ? ` ${attr}` : ""}>${value}</div>
    <div class="stat-label">${label}</div>
  </div>`;
}

function featureCard(f: Feature, compact = false): string {
  return `<article class="card reveal">
    <div class="card-icon" aria-hidden="true">${f.icon}</div>
    <h3>${escapeHtml(f.title)}</h3>
    <p>${escapeHtml(f.text)}</p>
    ${compact ? "" : `<ul>${f.points.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>`}
    ${f.href ? `<a class="card-link" href="${f.href}">Learn more</a>` : ""}
  </article>`;
}

function faqBlock(items: { q: string; a: string }[]): string {
  return `<div class="accordion" data-faq>
    ${items.map(item => `<details class="acc">
      <summary>${escapeHtml(item.q)}</summary>
      <div class="acc-body">${item.a}</div>
    </details>`).join("\n    ")}
  </div>`;
}

function ctaBox(cfg: SiteConfig, heading: string, sub: string): string {
  return `<div class="cta-box">
    <h2>${escapeHtml(heading)}</h2>
    <p>${sub}</p>
    <div class="btn-row center">
      <a class="btn lg" href="${safeUrl(cfg.inviteUrl)}">Add to Discord</a>
      ${cfg.supportUrl ? `<a class="btn ghost lg" href="${safeUrl(cfg.supportUrl)}">Join the support server</a>` : ""}
      <a class="btn ghost lg" href="/docs">Read the docs</a>
    </div>
  </div>`;
}

function homeHero(cfg: SiteConfig, stats: Stats, online: boolean): string {
  const st = statusWord(stats.ping, online);

  return `<section class="hero">
    <div class="wrap">
      <div class="badge ${st.cls === "ok" ? "" : "warn"}">
        <span class="dot" aria-hidden="true"></span>
        ${st.label}
      </div>
      <h1><span class="gradient-text">Moderation that keeps up</span><br>with your community.</h1>
      <p class="lead">Aegis is a fast, modular Discord bot for moderation, auto moderation, audit logging, and automation. Configured entirely with slash commands — no dashboard, no database to babysit.</p>
      <div class="btn-row center hero-actions">
        <a class="btn lg" href="${safeUrl(cfg.inviteUrl)}">Add to Discord</a>
        <a class="btn ghost lg" href="/commands">Browse all commands</a>
      </div>
      <p class="hero-note">Free to use &middot; ${stats.commands} commands &middot; No dashboard, no database to babysit</p>

      <div class="stats">
        ${statCard("Servers", stats.guilds.toLocaleString(), 'data-live="guilds" data-count="' + stats.guilds + '"')}
        ${statCard("Members", stats.users.toLocaleString(), 'data-live="users" data-count="' + stats.users + '"')}
        ${statCard("Commands", String(catalogStats().commands), 'data-count="' + catalogStats().commands + '"')}
        ${statCard("Uptime", fmtUptime(stats.uptime), 'data-uptime-from="' + stats.uptime + '"')}
      </div>

      <div class="hero-panel reveal">
        <div class="window-bar">
          <div class="window-dots" aria-hidden="true"><i></i><i></i><i></i></div>
          <span class="window-title">#mod-chat</span>
        </div>
        <div class="chat">
          <div class="chat-row">
            <div class="avatar user" aria-hidden="true">MK</div>
            <div class="chat-body">
              <div class="chat-name">mod.kai<span class="bot-tag">MOD</span></div>
              <div class="chat-text">third time this week, join my timeouts. <code class="inline">/timeout @riley reason:repeated spam</code></div>
            </div>
          </div>
          <div class="chat-row">
            <div class="avatar bot" aria-hidden="true">A</div>
            <div class="chat-body">
              <div class="chat-name">Aegis</div>
              <div class="chat-text">Done. The action was recorded in your log channel.</div>
              <div class="embed">
                <div class="embed-title">⏱️ Member Timed Out</div>
                <div class="embed-field"><span class="k">User</span><span>riley_</span></div>
                <div class="embed-field"><span class="k">Duration</span><span>Until in 30 minutes</span></div>
                <div class="embed-field"><span class="k">Reason</span><span>repeated spam</span></div>
                <div class="embed-field"><span class="k">Moderator</span><span>mod.kai</span></div>
              </div>
            </div>
          </div>
          <div class="chat-row">
            <div class="avatar bot" aria-hidden="true">A</div>
            <div class="chat-body">
              <div class="chat-name">Aegis</div>
              <div class="chat-text">Automod triggered on a link from <strong>spammer_99</strong> in <code class="inline">#general</code>. Message deleted, warning issued.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

/* ── Home ──────────────────────────────────────────────────────────── */

export function renderHome(cfg: SiteConfig, stats: Stats, online: boolean): string {
  const cats = groupByCategory();
  const top = features.slice(0, 6);

  const body = `
${homeHero(cfg, stats, online)}

<section class="block" id="features">
  <div class="wrap">
    <div class="section-head center reveal">
      <span class="eyebrow">What it does</span>
      <h2>Everything a moderation bot needs</h2>
      <p>Every feature is opt-in, per server, and controlled with slash commands. Nothing is enabled that you did not ask for.</p>
    </div>
    <div class="grid cols-3">
      ${top.map(f => featureCard(f)).join("\n      ")}
    </div>
    <div class="btn-row center" style="margin-top:2.25rem">
      <a class="btn ghost" href="/features">See every feature</a>
    </div>
  </div>
</section>

<section class="block tight">
  <div class="wrap">
    <div class="section-head center reveal">
      <span class="eyebrow">Getting started</span>
      <h2>Three steps to a moderated server</h2>
      <p>Aegis declares permissions per command, so the invite screen only asks for what the bot actually needs to run. Only <code class="inline">/config</code> asks for Administrator.</p>
    </div>
    <div class="steps">
      ${quickstart.map(s => `<div class="step reveal">
        <h3>${escapeHtml(s.title)}</h3>
        <p>${s.body}</p>
      </div>`).join("\n      ")}
    </div>
  </div>
</section>

<section class="block">
  <div class="wrap">
    <div class="section-head center reveal">
      <span class="eyebrow">Command reference</span>
      <h2>${catalogStats().commands} commands, grouped by job</h2>
      <p>Every command in the bot, with its subcommands, options, and the permissions it enforces. Searchable and generated straight from the source.</p>
    </div>
    <div class="grid cols-3">
      ${cats.slice(0, 6).map(g => `<a class="card reveal" href="/commands#${g.category}" style="text-decoration:none;color:inherit">
        <div class="card-icon" aria-hidden="true">${g.icon}</div>
        <h3>${escapeHtml(g.label)}</h3>
        <p>${escapeHtml(g.blurb)}</p>
        <div class="cmd-meta" style="margin-top:0.9rem">
          <span class="pill">${g.commands.length} command${g.commands.length === 1 ? "" : "s"}</span>
        </div>
      </a>`).join("\n      ")}
    </div>
    <div class="btn-row center" style="margin-top:2.25rem">
      <a class="btn ghost" href="/commands">Open the full reference</a>
    </div>
  </div>
</section>

<section class="block tight">
  <div class="wrap">
    <div class="section-head center reveal">
      <span class="eyebrow">Questions</span>
      <h2>Frequently asked</h2>
    </div>
    ${faqBlock(faqs)}
  </div>
</section>

<section class="block">
  <div class="wrap">
    ${ctaBox(cfg, "Ready to get started?", "Add Aegis to your server and run <code class=\"inline\">/help</code> to see everything it can do.")}
    <p style="text-align:center;margin-top:1.75rem;font-size:0.85rem;color:var(--faint)">
      By adding Aegis to a server you accept the <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.
    </p>
  </div>
</section>`;

  return page(cfg, {
    title: "Aegis — Discord Moderation & Automation Bot",
    description:
      "Aegis is a fast, modular Discord bot for moderation, auto moderation, audit logging, welcome messages, and automation. Configured with slash commands, no dashboard required.",
    path: "/",
    body,
    headExtra: jsonLd({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "SoftwareApplication",
          name: "Aegis",
          applicationCategory: "SocialNetworkingApplication",
          operatingSystem: "Cross-platform",
          description:
            "A fast, modular Discord bot for moderation, auto moderation, audit logging, welcome messages, and automation.",
          softwareVersion: cfg.version,
          url: process.env.SITE_URL || undefined,
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
  const cat = groupByCategory();

  const body = `
<div class="wrap">
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">/</span><span>Features</span>
  </nav>
  <div class="page-head">
    <h1>Features</h1>
    <p class="lead">Everything Aegis ships with, grouped by what it is for. All of it is configured per server with slash commands.</p>
  </div>
</div>

${features.map(f => `<section class="block tight" id="${f.id}">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="eyebrow">${escapeHtml(f.icon)} ${escapeHtml(f.title)}</span>
      <h2 style="font-size:clamp(1.5rem,3vw,2rem)">${escapeHtml(f.tagline)}</h2>
      <p>${escapeHtml(f.text)}</p>
    </div>
    <div class="grid cols-2">
      ${f.points.map(p => `<div class="feature-row reveal">
        <div class="card-icon" aria-hidden="true">✓</div>
        <div>
          <h4>${escapeHtml(p.split(":")[0])}</h4>
          <p class="muted" style="font-size:0.9rem;margin-top:0.2rem">${escapeHtml(p.split(":").slice(1).join(":").trim())}</p>
        </div>
      </div>`).join("\n      ")}
    </div>
  </div>
</section>`).join("\n")}

<section class="block">
  <div class="wrap">
    <div class="section-head center reveal">
      <span class="eyebrow">Command groups</span>
      <h2>Where to find each feature</h2>
      <p>Every capability above maps to a command group you can inspect before inviting.</p>
    </div>
    <div class="table-wrap reveal">
      <table>
        <thead><tr><th>Group</th><th>Commands</th><th>What it covers</th><th></th></tr></thead>
        <tbody>
          ${cat.map(g => `<tr>
            <td><strong>${g.icon} ${escapeHtml(g.label)}</strong></td>
            <td>${g.commands.length}</td>
            <td>${escapeHtml(g.blurb)}</td>
            <td><a href="/commands#${g.category}">View &rarr;</a></td>
          </tr>`).join("\n          ")}
        </tbody>
      </table>
    </div>
  </div>
</section>

<section class="block">
  <div class="wrap">
    ${ctaBox(cfg, "See them in action", "Every feature listed here is available in the current release.")}
  </div>
</section>`;

  return page(cfg, {
    title: "Features — Aegis",
    description:
      "Moderation, auto moderation, audit logging, welcome messages, community tools, and automation in one Discord bot.",
    path: "/features",
    body,
  });
}

/* ── Commands ──────────────────────────────────────────────────────── */

function optionsTable(cmd: CommandInfo): string {
  const all: OptionInfo[] = [
    ...cmd.options,
    ...cmd.subcommands.flatMap(s =>
      s.options.map(o => ({ ...o, name: `${s.path} ${o.name}` }))
    ),
  ];

  if (all.length === 0) return `<p class="faint">This command takes no options.</p>`;

  return `<div class="table-wrap">
    <table class="opt-table">
      <thead><tr><th>Option</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
      <tbody>
        ${all.map(o => `<tr>
          <td><code>${escapeHtml(o.name)}</code></td>
          <td>${escapeHtml(o.type)}</td>
          <td>${o.required ? `<span class="opt-req">required</span>` : `<span class="opt-opt">optional</span>`}</td>
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

  return `<details class="cmd-card" id="${anchor}" data-cmd-card data-category="${escapeHtml(cmd.category)}" data-search="${escapeHtml(searchBlob)}">
  <summary>
    <a class="cmd-anchor" href="#${anchor}" aria-label="Permalink to /${escapeHtml(cmd.name)}">#</a>
    <span class="cmd-slash" data-cmd-name>/${escapeHtml(cmd.name)}</span>
    <span class="cmd-summary-text">
      <span class="cmd-desc">${escapeHtml(cmd.description)}</span>
    </span>
    <span class="cmd-meta">
      ${cmd.guildOnly ? `<span class="pill">server only</span>` : ""}
      ${perms.length ? `<span class="pill warn">${perms.length} permission${perms.length === 1 ? "" : "s"}</span>` : `<span class="pill ok">no permissions</span>`}
      ${cmd.subcommands.length ? `<span class="pill">${cmd.subcommands.length} sub</span>` : ""}
    </span>
    <span class="cmd-chevron" aria-hidden="true"></span>
  </summary>
  <div class="cmd-body">
    <div class="cmd-run">
      <code class="inline">/${escapeHtml(cmd.name)}</code>
      <button class="copy-btn" type="button" data-copy="/${escapeHtml(cmd.name)}" aria-label="Copy /${escapeHtml(cmd.name)} to clipboard">Copy</button>
      <a class="copy-btn" href="/api/commands/${encodeURIComponent(cmd.name)}">JSON</a>
    </div>

    ${cmd.subcommands.length ? `<div>
      <div class="cmd-section-title">Subcommands</div>
      <div class="sub-list">
        ${cmd.subcommands.map(s => `<div class="sub-item">
          <code>/${escapeHtml(cmd.name)} ${escapeHtml(s.path)}</code>
          <span class="sub-desc">${escapeHtml(s.description)}</span>
          ${s.options.length ? `<span class="sub-opts faint">${s.options.length} option${s.options.length === 1 ? "" : "s"}</span>` : ""}
        </div>`).join("\n        ")}
      </div>
    </div>` : ""}

    <div>
      <div class="cmd-section-title">Options</div>
      ${optionsTable(cmd)}
    </div>

    <div>
      <div class="cmd-section-title">Permissions</div>
      ${perms.length
        ? `<div class="cmd-meta">${perms.map(p => `<span class="pill warn">${escapeHtml(p)}</span>`).join("")}</div>`
        : `<p class="faint">Anyone in the server can run this command.</p>`}
      ${cmd.botPermissions.length
        ? `<p class="faint" style="margin-top:0.5rem;font-size:0.83rem">Aegis needs ${cmd.botPermissions.map(escapeHtml).join(", ")} to run this.</p>`
        : ""}
    </div>
  </div>
</details>`;
}

export function renderCommands(cfg: SiteConfig): string {
  const cat = groupByCategory();
  const s = catalogStats();

  const filterChips = [
    `<button class="tab" type="button" data-cat="all" aria-pressed="true">All <span class="faint">${s.commands}</span></button>`,
    ...cat.map(
      g => `<button class="tab" type="button" data-cat="${escapeHtml(g.category)}" aria-pressed="false">${escapeHtml(g.icon)} ${escapeHtml(g.label)} <span class="faint">${g.commands.length}</span></button>`
    ),
  ].join("\n        ");

  const groups = cat.map(g => `<section class="cmd-group" data-cmd-group="${g.category}" id="${g.category}">
  <div class="cmd-group-head">
    <h2>${g.icon} ${escapeHtml(g.label)}</h2>
    <span class="blurb">${escapeHtml(g.blurb)}</span>
    <span class="pill" style="margin-left:auto">${g.commands.length}</span>
  </div>
  ${g.commands.map(commandCard).join("\n  ")}
</section>`).join("\n\n");

  const body = `
<div class="wrap">
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">/</span><span>Commands</span>
  </nav>
  <div class="page-head">
    <h1>Command reference</h1>
    <p class="lead">All ${s.commands} commands, ${s.subcommands} subcommands, and ${s.options} options — generated directly from the command definitions, so this page cannot drift out of date.</p>
  </div>
</div>

<div class="wrap">
  <div class="cmd-toolbar">
    <div class="search">
      <span class="icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      </span>
      <label class="visually-hidden" for="cmd-search">Search commands</label>
      <input id="cmd-search" type="search" placeholder="Search commands and subcommands…" autocomplete="off" spellcheck="false">
      <span class="hint" aria-hidden="true"><kbd>/</kbd></span>
    </div>
    <span class="cmd-count" id="cmd-count" role="status">${s.commands} commands</span>
  </div>

  <div class="tabs" id="cmd-filters" role="group" aria-label="Filter by category">
        ${filterChips}
  </div>

  <div id="cmd-empty" class="empty-state" hidden>
    <strong>No matching commands</strong>
    Try a different search term, or clear the category filter.
  </div>

  ${groups}
</div>

<section class="block">
  <div class="wrap">
    ${ctaBox(cfg, "Commands work better in Discord", "The Discord client handles autocomplete, permission hints, and required arguments natively. Press <code class=\"inline\">/</code> in any channel to see the live list.")}
    <p class="feed-note">Follow releases automatically: <a href="/changelog.xml">Atom feed</a>.</p>
  </div>
</section>`;

  return page(cfg, {
    title: "Commands — Aegis",
    description:
      "Full searchable reference for every Aegis slash command, including subcommands, options, and required permissions.",
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
  { id: "configuration", label: "Configuration" },
  { id: "automod", label: "Auto moderation" },
  { id: "logging", label: "Logging" },
  { id: "welcome", label: "Welcome messages" },
  { id: "automation", label: "Automation" },
  { id: "roles", label: "Roles" },
  { id: "permissions", label: "Permissions" },
  { id: "troubleshooting", label: "Troubleshooting" },
  { id: "architecture", label: "How it works" },
];

function permissionTable(): string {
  const rows = permissionMatrix();

  return `<div class="table-wrap">
    <table>
      <thead><tr><th>Permission</th><th>Used by</th><th>Why</th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td><strong>${escapeHtml(r.permission)}</strong></td>
          <td>${r.commands.map(c => `<code class="inline">${escapeHtml(c)}</code>`).join(" ")}</td>
          <td>${PERMISSION_WHY[r.permission] ?? "Required to perform the action."}</td>
        </tr>`).join("\n        ")}
      </tbody>
    </table>
  </div>`;
}

const PERMISSION_WHY: Record<string, string> = {
  "Ban Members": "Removing members from the server entirely.",
  "Kick Members": "Removing a member without a permanent ban.",
  "Moderate Members": "Applying and lifting communication timeouts.",
  "Manage Messages": "Bulk deleting messages.",
  "Manage Channels": "Setting per-channel slowmode durations.",
  "Manage Server": "Editing server-wide Aegis configuration.",
  Administrator: "Only for /config, which writes server-wide settings.",
};

export function renderDocs(cfg: SiteConfig): string {
  const s = catalogStats();

  const side = DOC_SECTIONS.map(sec => {
    const match = sectionCommandCount(sec.id);
    return `<li><a href="#${sec.id}">${escapeHtml(sec.label)}${match ? ` <span class="faint">(${match})</span>` : ""}</a></li>`;
  }).join("\n        ");

  const body = `
<div class="wrap">
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">/</span><span>Docs</span>
  </nav>
  <div class="page-head">
    <h1>Documentation</h1>
    <p class="lead">How to configure Aegis, what each permission unlocks, and how data is stored. Everything here works with the ${s.commands} commands listed in the reference.</p>
  </div>
</div>

<div class="wrap">
  <div class="docs-layout">
    <aside class="docs-side" aria-label="On this page">
      <div class="side-title">On this page</div>
      <ul>
        ${side}
      </ul>
      <div class="side-divider"></div>
      <div class="side-title">Reference</div>
      <ul>
        <li><a href="/commands">All commands</a></li>
        <li><a href="/features">All features</a></li>
        <li><a href="/changelog">Changelog</a></li>
        <li><a href="/status">Service status</a></li>
      </ul>
    </aside>

    <div class="prose">
      <h2 id="quickstart">Quickstart</h2>
      <p>Aegis is ready to use the moment it joins a server, but almost everything is off by default. This is the shortest path to a working setup.</p>
      <ol>
        <li><strong>Invite Aegis.</strong> Use the invite link in the header. Review the permission list on the authorization screen — you can start with no administrative access and add only what a feature asks for.</li>
        <li><strong>Check the defaults.</strong> Run <code class="inline">/config view</code> to see what is currently set.</li>
        <li><strong>Turn on logging.</strong> <code class="inline">/logging channel #mod-logs</code> sets the channel and enables logging in one step.</li>
        <li><strong>Add auto moderation.</strong> <code class="inline">/automod words toggle enabled:true</code>, then <code class="inline">/automod words add word:&lt;term&gt;</code> for each term.</li>
        <li><strong>Set up welcomes.</strong> <code class="inline">/welcome channel #general</code>, <code class="inline">/welcome message text:…</code>, then <code class="inline">/welcome toggle enabled:true</code>.</li>
        <li><strong>Schedule anything recurring.</strong> <code class="inline">/automation remind in:2h message:…</code>, review with <code class="inline">/automation list</code>.</li>
      </ol>
      <div class="callout info">
        <span class="callout-icon" aria-hidden="true">i</span>
        <div>Commands register automatically when the bot starts. Global commands can take up to an hour to appear; commands registered to a single test guild appear immediately.</div>
      </div>

      <h2 id="configuration">Configuration</h2>
      <p><code class="inline">/config</code> reads and writes the per-server settings that other features depend on. Settings are keyed by guild ID, so nothing is ever shared between servers.</p>
      <h3>Available settings</h3>
      <ul>
        <li><strong>Prefix</strong> — legacy prefix, retained for compatibility. Aegis does not use prefix commands.</li>
        <li><strong>Language</strong> — locale hint for message formatting.</li>
      </ul>
      <p>Feature-level state lives with its own command instead: <code class="inline">/logging</code>, <code class="inline">/automod</code>, and <code class="inline">/welcome</code> each manage their own settings, which keeps <code class="inline">/config</code> small and predictable.</p>
      <pre class="block">/config view
/config set key:language value:en</pre>

      <h2 id="automod">Auto moderation</h2>
      <p>Automod inspects every new message before anyone else reads it. Three independent rules ship enabled-by-default-off, each with its own action.</p>
      <h3>Blocked words</h3>
      <p>Matches case-insensitively anywhere in the message body. Lists are per server and per rule, so a filter tuned for one community never affects another.</p>
      <pre class="block">/automod status
/automod words toggle enabled:true
/automod words add word:free nitro
/automod words remove word:free nitro</pre>
      <h3>Link filtering</h3>
      <p>Catches any <code class="inline">http</code> or <code class="inline">https</code> URL. Useful for channels where links mean spam.</p>
      <pre class="block">/automod links toggle enabled:true</pre>
      <h3>Mention spam</h3>
      <p>Triggers when a single message mentions more users than the configured threshold. Defaults to a timeout action, which stops ping-spam escalation without needing a moderator online.</p>
      <div class="callout warn">
        <span class="callout-icon" aria-hidden="true">!</span>
        <div>Automod is a safety net, not a replacement for moderators. Tune the word list carefully — short or ambiguous terms will catch legitimate conversation.</div>
      </div>

      <h2 id="logging">Logging</h2>
      <p>Log entries are written into a channel you choose, so they follow the retention and access controls you already set for that channel. Aegis does not keep a second copy.</p>
      <p>Setting a channel also enables logging, so the common case is a single command:</p>
      <pre class="block">/logging channel #mod-logs
/logging status
/logging toggle enabled:false</pre>
      <p>Currently recorded events include member joins, member leaves, deleted messages, and every moderation action with the moderator, target, and reason attached.</p>

      <h2 id="welcome">Welcome messages</h2>
      <p>Welcome messages post when a member joins. The message template supports placeholders that are replaced at send time.</p>
      <pre class="block">/welcome channel #general
/welcome message text:Welcome {user} to **{server}**! You are member #{member_count}.
/welcome toggle enabled:true</pre>
      <h3>Placeholders</h3>
      <ul>
        <li><code class="inline">{user}</code> — a mention that pings the new member</li>
        <li><code class="inline">{username}</code> — plain username, no ping</li>
        <li><code class="inline">{server}</code> — server name</li>
        <li><code class="inline">{member_count}</code> — member count after joining</li>
      </ul>
      <p><code class="inline">/welcome message</code> replies with a live preview using your own account, so you can check the formatting before enabling it.</p>

      <h2 id="automation">Automation</h2>
      <p>Scheduled tasks are persisted, so they survive a restart. Durations use a compact format: <code class="inline">30s</code>, <code class="inline">10m</code>, <code class="inline">2h</code>, <code class="inline">1d</code>.</p>
      <pre class="block">/automation remind in:2h message:Stand-up in 5 minutes
/automation list
/automation cancel id:&lt;task-id&gt;</pre>
      <p>You can only cancel your own tasks unless you hold <code class="inline">Manage Server</code>.</p>

      <h2 id="roles">Roles and hierarchy</h2>
      <p>Aegis refuses to act on anyone who sits at or above its own highest role, and it checks the same relationship between the moderator and the target. This is enforced in the permission layer, so it applies to every command, including automod actions.</p>

      <h2 id="permissions">Permissions</h2>
      <p>Permissions are checked twice. Discord hides commands the invoking member cannot use via <code class="inline">setDefaultMemberPermissions</code>, and the bot re-verifies at execution time so a permission change mid-session cannot be used to bypass a check.</p>
      ${permissionTable()}
      <div class="callout">
        <span class="callout-icon" aria-hidden="true">i</span>
        <div><code class="inline">/config</code> is the only command that asks for <code class="inline">Administrator</code>, because it writes server-wide settings. Every other command requests a specific permission, and the invite screen asks for the union of those.</div>
      </div>

      <h2 id="troubleshooting">Troubleshooting</h2>
      <h3>Commands do not appear</h3>
      <p>Global commands can take up to an hour to propagate. If they never appear, confirm the bot was invited with the <code class="inline">applications.commands</code> scope and that the application has finished registering.</p>
      <h3>A command is greyed out</h3>
      <p>Your account is missing the permission that command declares. Run <code class="inline">/help</code> to see the list, and check your role position.</p>
      <h3>Aegis says it needs a permission</h3>
      <p>That is the bot, not you. Move Aegis' role above the target role, and grant the specific permission in the server role settings.</p>
      <h3>Timeouts fail silently</h3>
      <p>Discord caps timeouts at 28 days, and timeouts cannot be applied to the server owner or anyone above Aegis. Check the member's highest role.</p>
      <h3>Logs are missing</h3>
      <p>Confirm <code class="inline">/logging status</code> shows the channel you expect, that the channel still exists, and that Aegis can view and send in it.</p>

      <h2 id="architecture">How it works</h2>
      <p>Each server's state is stored against its guild ID: configuration, automod rules, warnings, suggestions, and scheduled tasks. A command in one server can never read or write another server's data.</p>
      <ul>
        <li><strong>Commands</strong> load once at startup and register with Discord in a single scope, so no command is ever duplicated in the client.</li>
        <li><strong>Permissions</strong> are declared per command and re-checked at execution time.</li>
        <li><strong>Scheduler</strong> persists tasks and rehydrates them on boot, so a restart does not lose reminders.</li>
        <li><strong>Logging</strong> writes to your channel directly rather than retaining a private copy.</li>
      </ul>
      <p>See the <a href="/changelog">changelog</a> for what changed recently, or <a href="/status">service status</a> for live uptime.</p>
    </div>
  </div>
</div>`;

  return page(cfg, {
    title: "Documentation — Aegis",
    description:
      "Setup guide, configuration reference, permission requirements, and troubleshooting for the Aegis Discord bot.",
    path: "/docs",
    body,
  });
}

/** Map a docs section to the commands that cover it, for the sidebar. */
function sectionCommandCount(section: string): number {
  const mapping: Record<string, string[]> = {
    configuration: ["config"],
    automod: ["automod"],
    logging: ["logging"],
    welcome: ["welcome"],
    automation: ["automation"],
    roles: [],
    permissions: [],
    troubleshooting: [],
    architecture: [],
    quickstart: ["help", "config"],
  };
  const names = mapping[section] ?? [];
  if (names.length === 0) return 0;
  return buildCatalog().filter(c => names.includes(c.name)).length;
}

/* ── Changelog ─────────────────────────────────────────────────────── */

export interface Release {
  version: string;
  date: string;
  tag?: string;
  highlights: string[];
}

export const RELEASES: Release[] = [
  {
    version: "1.0.1",
    date: "2026-09-30",
    tag: "current",
    highlights: [
      "Fixed developer command access for the bot owner, including deployments without a DISCORD_OWNER_ID setting.",
      "Scheduled reminders and messages now retry after temporary Discord delivery failures instead of being discarded.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-09-29",
    highlights: [
      "Public launch with moderation, auto moderation, logging, welcome, community, and automation command groups.",
      "Slash commands are registered in a single scope to eliminate duplicate entries in the Discord client.",
      "Bot presence now reports live server and member counts and refreshes periodically so it does not go stale.",
      "Introduced this website: home, features, searchable command reference, documentation, changelog, and status pages.",
      "Published Terms of Service and Privacy Policy.",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-09-14",
    highlights: [
      "Added warning history with per-user review and reset.",
      "Added scheduled reminders that survive a restart.",
      "Permission checks moved into a shared layer applied to every command.",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-08-30",
    highlights: [
      "Auto moderation gained blocked word, link, and mention spam rules.",
      "Welcome messages support {user}, {username}, {server}, and {member_count} placeholders.",
      "Per-guild data isolation enforced across all stored records.",
    ],
  },
];

export function renderChangelog(cfg: SiteConfig): string {
  const body = `
<div class="wrap">
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">/</span><span>Changelog</span>
  </nav>
  <div class="page-head">
    <h1>Changelog</h1>
    <p class="lead">Notable changes to Aegis, newest first.</p>
  </div>
</div>

<section class="block tight">
  <div class="wrap">
    <div class="wrap-prose" style="margin-inline:auto">
      <div class="timeline">
        ${RELEASES.map(r => `<article class="release" id="${escapeHtml(r.version)}">
          <div class="release-head">
            <h3>${escapeHtml(r.version)}</h3>
            ${r.tag ? `<span class="pill primary">${escapeHtml(r.tag)}</span>` : ""}
            <time datetime="${r.date}">${new Date(r.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</time>
          </div>
          <ul>
            ${r.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join("\n            ")}
          </ul>
        </article>`).join("\n        ")}
      </div>
    </div>
  </div>
</section>

<section class="block">
  <div class="wrap">
    ${ctaBox(cfg, "Want the full feature list?", "Every capability in the current release, with the commands that drive it.")}
  </div>
</section>`;

  return page(cfg, {
    title: "Changelog — Aegis",
    description: "Release history and notable changes for the Aegis Discord bot.",
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
        url: `${process.env.SITE_URL || ""}/changelog#${r.version}`,
        description: r.highlights.join(" "),
      })),
    }),
  });
}

/* ── Status ────────────────────────────────────────────────────────── */

export function renderStatus(cfg: SiteConfig, stats: Stats, online: boolean, startedAt: number): string {
  const st = statusWord(stats.ping, online);
  const good = st.cls === "ok";
  const pingBar = Math.min(100, Math.round((stats.ping / 500) * 100));
  const pingClass = good ? "" : st.cls === "danger" ? "bad" : "warn";

  const body = `
<div class="wrap">
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">/</span><span>Status</span>
  </nav>
  <div class="page-head">
    <h1>Service status</h1>
    <p class="lead">Live metrics from the running bot. This page updates itself every 30 seconds.</p>
  </div>
</div>

<section class="block tight">
  <div class="wrap">
    <div class="status-banner ${good ? "" : "bad"}">
      <span class="dot" style="width:12px;height:12px;border-radius:50%;background:var(--${good ? "accent" : "danger"});flex-shrink:0" aria-hidden="true"></span>
      <div class="status-text">
        <h2>${good ? "All systems operational" : st.label}</h2>
        <p>${good
          ? "Aegis is connected to Discord and responding normally."
          : "Aegis may be experiencing degraded performance. Check the metrics below."}</p>
      </div>
      <span class="pill ${good ? "ok" : "danger"}" style="margin-left:auto">${escapeHtml(st.label)}</span>
    </div>

    <h2 style="font-size:1.3rem;margin-bottom:1rem">Live metrics</h2>
    <div class="metric-grid" style="margin-bottom:2.5rem">
      <div class="metric">
        <div class="label">Gateway latency</div>
        <div class="value ${good ? "good" : "warn"}" data-live="ping" data-suffix=" ms">${stats.ping} ms</div>
        <div class="sub">Round trip to Discord</div>
      </div>
      <div class="metric">
        <div class="label">Uptime</div>
        <div class="value" data-uptime-from="${stats.uptime}">${fmtUptime(stats.uptime)}</div>
        <div class="sub">Since last restart</div>
      </div>
      <div class="metric">
        <div class="label">Servers</div>
        <div class="value" data-live="guilds">${stats.guilds.toLocaleString()}</div>
        <div class="sub">Cached guilds</div>
      </div>
      <div class="metric">
        <div class="label">Members</div>
        <div class="value" data-live="users">${stats.users.toLocaleString()}</div>
        <div class="sub">Across all servers</div>
      </div>
      <div class="metric">
        <div class="label">Commands</div>
        <div class="value" data-live="commands">${stats.commands}</div>
        <div class="sub">Registered and loadable</div>
      </div>
      <div class="metric">
        <div class="label">Version</div>
        <div class="value">${escapeHtml(cfg.version)}</div>
        <div class="sub">Deployed build</div>
      </div>
    </div>

    <h2 style="font-size:1.3rem;margin-bottom:1rem">Components</h2>
    <div class="component-row">
      <span class="name">Discord gateway</span>
      <span class="desc">WebSocket connection to Discord</span>
      <span class="bar ${pingClass}"><i style="width:${pingBar}%"></i></span>
      <span class="pill ${good ? "ok" : "warn"}">${good ? "Operational" : "Degraded"}</span>
    </div>
    <div class="component-row">
      <span class="name">Slash commands</span>
      <span class="desc">${stats.commands} commands loaded into the registry</span>
      <span class="bar"><i style="width:${stats.commands > 0 ? 100 : 0}%"></i></span>
      <span class="pill ${stats.commands > 0 ? "ok" : "danger"}">${stats.commands > 0 ? "Operational" : "Failed"}</span>
    </div>
    <div class="component-row">
      <span class="name">This website</span>
      <span class="desc">Express server rendering this page</span>
      <span class="bar"><i style="width:100%"></i></span>
      <span class="pill ok">Operational</span>
    </div>

    <div class="callout" style="margin-top:2rem">
      <span class="callout-icon" aria-hidden="true">i</span>
      <div>Only the Discord gateway and the command registry are actually probed. Machine-readable status is available at <a href="/health">/health</a>, and metrics as JSON at <a href="/api/stats">/api/stats</a>. Historical uptime, incident tracking, and response-time history are not collected, so this page makes no claims about them.</div>
    </div>

    <p class="faint" style="margin-top:1.5rem">Process started ${new Date(startedAt).toISOString()}.</p>
  </div>
</section>`;

  return page(cfg, {
    title: "Status — Aegis",
    description: "Live service status and metrics for the Aegis Discord bot.",
    path: "/status",
    body,
  });
}

/* ── Legal ─────────────────────────────────────────────────────────── */

const EFFECTIVE_DATE = "September 29, 2026";


export function renderTerms(cfg: SiteConfig): string {
  const support = cfg.supportUrl
    ? `<a href="${safeUrl(cfg.supportUrl)}" rel="noopener noreferrer">support server</a>`
    : "support server";

  const body = `
<div class="wrap">
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">/</span><span>Terms of Service</span>
  </nav>
  <div class="page-head">
    <h1>Terms of Service</h1>
    <p class="lead">These terms govern your use of the Aegis Discord bot and this website. By adding Aegis to a server or using this site, you agree to them.</p>
    <p class="faint" style="margin-top:0.75rem">Effective date: ${EFFECTIVE_DATE}</p>
  </div>
</div>

<section class="block tight">
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
    title: "Terms of Service — Aegis",
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
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">/</span><span>Privacy Policy</span>
  </nav>
  <div class="page-head">
    <h1>Privacy Policy</h1>
    <p class="lead">What Aegis collects, why it collects it, and what it never does with it.</p>
    <p class="faint" style="margin-top:0.75rem">Effective date: ${EFFECTIVE_DATE}</p>
  </div>
</div>

<section class="block tight">
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
        <li>Process memory usage, uptime, and gateway latency, used for the <a href="/status">status page</a> and the homepage counters.</li>
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
        <li><strong>Warnings:</strong> retained until a moderator clears them with <code class="inline">/clearwarnings</code>, or until Aegis is removed.</li>
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
    title: "Privacy Policy — Aegis",
    description: "What data the Aegis Discord bot collects, how it is used, and how it is retained.",
    path: "/privacy",
    body,
  });
}

/* ── 404 ───────────────────────────────────────────────────────────── */

export function renderNotFound(cfg: SiteConfig): string {
  const body = `
<div class="wrap">
  <div class="page-head" style="text-align:center;padding:clamp(3rem,8vw,6rem) 0 3rem">
    <h1>404</h1>
    <p class="lead" style="margin-inline:auto">That page does not exist. Try the homepage, or look through the command reference.</p>
    <div class="btn-row center" style="margin-top:2rem">
      <a class="btn" href="/">Back to home</a>
      <a class="btn ghost" href="/commands">Command reference</a>
      <a class="btn ghost" href="/docs">Documentation</a>
    </div>
  </div>
</div>`;

  return page(cfg, {
    title: "Page not found — Aegis",
    description: "The requested page could not be found.",
    path: "/404",
    body,
    noindex: true,
    omitCanonical: true,
  });
}
