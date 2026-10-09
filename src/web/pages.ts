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

      <div class="trust-strip" aria-label="Aegis principles">
        <span>✓ Per-server isolation</span>
        <span>✓ Explicit permissions</span>
        <span>✓ No web account required</span>
      </div>

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
      <p>Aegis declares permissions per command, so the invite screen only asks for what the bot actually needs to run. Server-wide settings use Manage Server rather than Administrator.</p>
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
      <span class="eyebrow">Server Sizing & Calculator</span>
      <h2>Calculate Performance & Presets for Your Guild</h2>
      <p>Aegis dynamically scales memory allocation and worker queues based on server population and chat velocity.</p>
    </div>
    <div class="dash-card reveal" style="max-width: 720px; margin: 0 auto;">
      <div style="margin-bottom: 1.5rem;">
        <label for="calc-members" style="font-weight: 700; display: block; margin-bottom: 0.5rem;">
          Server Member Count: <span id="calc-members-val" style="color: var(--primary);">10,000 members</span>
        </label>
        <input type="range" id="calc-members" min="100" max="100000" step="500" value="10000" style="width: 100%; accent-color: var(--primary);">
      </div>

      <div class="metric-grid">
        <div class="metric">
          <div class="label">Est. Memory Heap</div>
          <div id="calc-ram" class="value good">26 MB</div>
          <div class="sub">Per-shard footprint</div>
        </div>
        <div class="metric">
          <div class="label">Gateway Latency</div>
          <div id="calc-ping" class="value good">14 ms</div>
          <div class="sub">Event dispatch latency</div>
        </div>
        <div class="metric">
          <div class="label">Recommended Preset</div>
          <div id="calc-preset" class="value warn" style="font-size: 1.1rem;">Community Standard</div>
          <div class="sub">Apply via /preset</div>
        </div>
      </div>
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
  { id: "tickets", label: "Support Tickets" },
  { id: "verification", label: "Verification & Anti-Raid" },
  { id: "roles", label: "Role Panels & Self-Roles" },
  { id: "suggestions", label: "Suggestions & Voting" },
  { id: "automod", label: "Auto Moderation" },
  { id: "logging", label: "Audit Logging" },
  { id: "welcome", label: "Welcome Messages" },
  { id: "automation", label: "Automation & Schedules" },
  { id: "configuration", label: "Configuration" },
  { id: "permissions", label: "Permissions Matrix" },
  { id: "troubleshooting", label: "Troubleshooting" },
  { id: "architecture", label: "Architecture & Security" },
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
  "Ban Members": "Removing members from the server entirely or lifting bans.",
  "Kick Members": "Removing a member without a permanent ban.",
  "Moderate Members": "Applying and lifting communication timeouts.",
  "Manage Messages": "Bulk deleting messages and managing panel messages.",
  "Manage Channels": "Creating ticket channels, locking channels, and setting slowmodes.",
  "Manage Roles": "Assigning roles via verification and interactive role panels.",
  "Manage Server": "Editing server-wide Aegis configuration and AutoMod rules.",
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
    <h1>Documentation & User Manual</h1>
    <p class="lead">Complete documentation for configuring Aegis, setting up ticket panels, anti-raid verification, interactive role panels, AutoMod filters, and audit streams across your server.</p>
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
        <li><a href="/playground">Command Playground</a></li>
        <li><a href="/dashboard">Live Dashboard</a></li>
        <li><a href="/changelog">Changelog</a></li>
        <li><a href="/status">Service status</a></li>
      </ul>
    </aside>

    <div class="prose">
      <h2 id="quickstart">Quickstart Guide</h2>
      <p>Aegis is ready to protect and manage your server right out of the box. Follow these steps to set up core moderation, ticket systems, and security gates.</p>
      <ol>
        <li><strong>Invite Aegis to your server.</strong> Click the invite link above and select your server. Aegis registers all slash commands instantly upon joining.</li>
        <li><strong>Configure audit logging.</strong> Run <code class="inline">/logging channel #mod-logs</code> to record member joins, message deletions, and moderation actions.</li>
        <li><strong>Set up support tickets.</strong> Run <code class="inline">/ticket setup channel:#support staff_role:@Staff</code> to post an interactive ticket panel.</li>
        <li><strong>Enable anti-raid verification.</strong> Run <code class="inline">/verify setup channel:#verify verified_role:@Verified</code> to screen new members.</li>
        <li><strong>Configure AutoMod.</strong> Enable keyword and link protection using <code class="inline">/automod words toggle enabled:true</code> and <code class="inline">/automod links toggle enabled:true</code>.</li>
      </ol>
      <div class="callout info">
        <span class="callout-icon" aria-hidden="true">i</span>
        <div>Slash commands register automatically with Discord. If global commands do not appear immediately in your client, restart Discord or run <code class="inline">/help</code> to force client cache refresh.</div>
      </div>

      <h2 id="tickets">Support Ticket System</h2>
      <p>Aegis features a private support ticket system powered by Discord buttons and permission overwrites. Moderators can manage tickets, claim responsibility, and export TXT chat transcripts.</p>
      <h3>Ticket Commands</h3>
      <pre class="block">/ticket setup channel:#support staff_role:@SupportTeam title:"🎫 Support Center"
/ticket close reason:"Issue resolved"
/ticket claim
/ticket add user:@Member
/ticket remove user:@Member
/ticket transcript</pre>
      <h3>Single Open Ticket Rule & Duplicate Safeguards</h3>
      <p>Aegis limits members to one active open ticket at a time to prevent support queue spam. Rapid double-clicks on button panels are guarded by a concurrency mutex, and re-running <code class="inline">/ticket setup</code> automatically purges old panel embeds from the target channel.</p>

      <h2 id="verification">Verification & Anti-Raid System</h2>
      <p>Protect your server against self-bots, raid waves, and spam accounts by requiring new arrivals to pass a verification gate before seeing server channels.</p>
      <pre class="block">/verify setup channel:#verify verified_role:@Member type:button
/verify info
/verify user target:@Member
/verify disable</pre>
      <p>Choose between <strong>1-Click Button</strong> mode for seamless onboarding or <strong>CAPTCHA Verification</strong> mode for enhanced security.</p>

      <h2 id="roles">Role Panels & Self-Roles</h2>
      <p>Deploy self-assignable role panels with interactive buttons. Members click a role button to toggle roles on or off instantly with zero reaction emoji lag.</p>
      <pre class="block">/rolepanel create channel:#roles role1:@Announcements role2:@Events role3:@Updates
/rolepanel list
/rolepanel delete id:&lt;panel-id&gt;</pre>
      <p>Deleting a role panel record with <code class="inline">/rolepanel delete</code> automatically removes the physical panel message from your Discord channel.</p>

      <h2 id="suggestions">Suggestions & Community Feedback</h2>
      <p>Collect community ideas with interactive upvote and downvote buttons. Staff members can approve, reject, or mark suggestions as under consideration.</p>
      <pre class="block">/suggest suggestion:"Add a dedicated art channel"
/suggest approve id:&lt;id&gt; reason:"Great idea!"
/suggest reject id:&lt;id&gt; reason:"Not feasible"</pre>

      <h2 id="automod">Auto Moderation</h2>
      <p>AutoMod scans messages in real time to enforce community guidelines before moderators need to intervene.</p>
      <pre class="block">/automod status
/automod words toggle enabled:true
/automod words add word:"free nitro"
/automod words action action:warn
/automod links toggle enabled:true
/automod mentions toggle enabled:true limit:5</pre>

      <h2 id="logging">Audit Logging</h2>
      <p>Stream member joins, message deletions, and moderation actions directly to a staff audit log channel in your server.</p>
      <pre class="block">/logging channel #mod-logs
/logging status
/logging toggle enabled:false</pre>

      <h2 id="welcome">Welcome Messages</h2>
      <p>Greet new members with customized join messages and placeholders.</p>
      <pre class="block">/welcome channel #general
/welcome message text:"Welcome {user} to **{server}**! You are member #{member_count}."
/welcome toggle enabled:true</pre>
      <ul>
        <li><code class="inline">{user}</code> — pings the member</li>
        <li><code class="inline">{username}</code> — plain username without ping</li>
        <li><code class="inline">{server}</code> — server name</li>
        <li><code class="inline">{member_count}</code> — total server member count</li>
      </ul>

      <h2 id="automation">Automation & Scheduled Tasks</h2>
      <p>Set reminders and recurring channel posts that survive bot restarts. Time durations use compact syntax: <code class="inline">30s</code>, <code class="inline">10m</code>, <code class="inline">2h</code>, or <code class="inline">1d</code>.</p>
      <pre class="block">/automation remind in:2h message:"Staff sync meeting"
/automation message in:1d channel:#announcements message:"Event starting soon!"
/automation list
/automation cancel id:&lt;task-id&gt;</pre>

      <h2 id="configuration">Server Configuration</h2>
      <p>View and manage server-wide configuration settings.</p>
      <pre class="block">/config view
/config set key:language value:en</pre>

      <h2 id="permissions">Permissions Matrix</h2>
      <p>Aegis enforces strict role hierarchy checks and re-verifies user and bot permissions at execution time.</p>
      ${permissionTable()}

      <h2 id="troubleshooting">Troubleshooting & Gotchas</h2>
      <h3>Commands missing from slash menu</h3>
      <p>Verify that Aegis was invited with the <code class="inline">applications.commands</code> scope. Global commands propagate across Discord within a few minutes.</p>
      <h3>Role hierarchy error when performing moderation</h3>
      <p>Aegis cannot moderate members whose highest role sits above or equal to Aegis' highest role in Server Settings > Roles.</p>
      <h3>Duplicate ticket panel issue</h3>
      <p>Re-run <code class="inline">/ticket setup</code> in the support channel. Aegis automatically purges old bot ticket setup panels in that channel.</p>

      <h2 id="architecture">Architecture & Data Security</h2>
      <p>All configuration, ticket records, and AutoMod rules are isolated by guild ID. Aegis never shares data between servers and writes audit logs directly to your Discord channels.</p>
    </div>
  </div>
</div>`;

  return page(cfg, {
    title: "Documentation — Aegis Discord Bot",
    description:
      "Comprehensive documentation for Aegis Discord Bot: tickets, verification, role panels, AutoMod, audit logging, and commands.",
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

export interface Release {
  version: string;
  date: string;
  tag?: string;
  summary?: string;
  highlights: string[];
}

export const RELEASES: Release[] = [
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

function renderHighlightItem(h: string): string {
  const match = h.match(/^\[(NEW|ENHANCED|SECURITY|WEB|FIX)\]\s*(.*)$/);
  if (!match) return `<li>${escapeHtml(h)}</li>`;

  const tag = match[1];
  const content = match[2];
  const tagClass =
    tag === "NEW" ? "primary" :
    tag === "ENHANCED" ? "ok" :
    tag === "SECURITY" ? "danger" :
    tag === "WEB" ? "warn" : "faint";

  return `<li style="list-style:none; margin-bottom: 0.55rem; display:flex; gap:0.6rem; align-items:flex-start;">
    <span class="pill ${tagClass}" style="font-size:0.65rem; padding: 0.12rem 0.45rem; text-transform:uppercase; font-weight:700; flex-shrink:0; margin-top:0.15rem;">${tag}</span>
    <span style="font-size:0.94rem; color:var(--text-2);">${escapeHtml(content)}</span>
  </li>`;
}

export function renderChangelog(cfg: SiteConfig): string {
  const body = `
<div class="wrap">
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">/</span><span>Changelog</span>
  </nav>
  <div class="page-head" style="text-align:center; padding: 2rem 0 1rem;">
    <span class="eyebrow">Product Releases</span>
    <h1 style="margin-top:0.4rem;">Bot <span class="gradient-text">Changelog</span></h1>
    <p class="lead" style="max-width: 640px; margin: 0.5rem auto 0;">Chronological history of major updates, new moderation capabilities, and platform enhancements.</p>
  </div>
</div>

<section class="block tight" style="padding-top: 1rem;">
  <div class="wrap">
    <div style="display:flex; justify-content:center; gap: 0.5rem; flex-wrap:wrap; margin-bottom: 2.5rem;">
      ${RELEASES.map(r => `<a class="pill ${r.version === "3.0.0" ? "primary" : ""}" href="#v${escapeHtml(r.version)}" style="font-weight:600;">v${escapeHtml(r.version)}</a>`).join("\n      ")}
    </div>

    <div class="wrap-prose" style="margin-inline:auto">
      <div class="timeline">
        ${RELEASES.map(r => `<article class="release reveal" id="v${escapeHtml(r.version)}" style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 1.5rem; margin-bottom: 2rem; backdrop-filter: blur(12px);">
          <div class="release-head" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; margin-bottom: 0.75rem;">
            <div style="display:flex; align-items:center; gap:0.6rem;">
              <h2 style="font-size:1.4rem; margin:0;">v${escapeHtml(r.version)}</h2>
              ${r.tag ? `<span class="pill primary" style="font-size:0.7rem; font-weight:700;">${escapeHtml(r.tag)}</span>` : ""}
            </div>
            <time datetime="${r.date}" style="font-size:0.83rem; color:var(--faint); font-weight:600;">${new Date(r.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</time>
          </div>
          ${r.summary ? `<p style="color:var(--muted); font-size:0.95rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">${escapeHtml(r.summary)}</p>` : ""}
          <ul style="padding-left:0; margin-top:0.6rem;">
            ${r.highlights.map(h => renderHighlightItem(h)).join("\n            ")}
          </ul>
        </article>`).join("\n        ")}
      </div>
    </div>
  </div>
</section>

<section class="block">
  <div class="wrap">
    ${ctaBox(cfg, "Want to test these features live?", "Try our interactive playground browser sandbox or add Aegis directly to your server.")}
  </div>
</section>`;

  return page(cfg, {
    title: "Changelog — Aegis Discord Bot",
    description: "Release history and detailed feature changelog for the Aegis Discord bot.",
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
    <div class="status-banner ${good ? "" : "bad"}" data-status-banner>
      <span class="dot" data-status-dot style="width:12px;height:12px;border-radius:50%;background:var(--${good ? "accent" : "danger"});flex-shrink:0" aria-hidden="true"></span>
      <div class="status-text">
        <h2 data-status-title>${good ? "All systems operational" : st.label}</h2>
        <p data-status-description>${good
          ? "Aegis is connected to Discord and responding normally."
          : "Aegis may be experiencing degraded performance. Check the metrics below."}</p>
      </div>
      <span class="pill ${good ? "ok" : "danger"}" data-status-label style="margin-left:auto">${escapeHtml(st.label)}</span>
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

    <p class="faint" style="margin-top:1.5rem">Process started ${new Date(startedAt).toISOString()}. <span data-status-refreshed>Live values refresh every 30 seconds.</span></p>
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

const EFFECTIVE_DATE = "October 1, 2026";


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

/* ── Live Dashboard Page ────────────────────────────────────────────── */

export function renderDashboard(cfg: SiteConfig, stats: Stats, online: boolean): string {
  const st = statusWord(stats.ping, online);
  const cs = catalogStats();

  const body = `
<section class="page-header" style="text-align:center; padding: 3rem 0 1.5rem;">
  <div class="wrap">
    <span class="eyebrow">Real-Time Operations Center</span>
    <h1 style="margin-top: 0.4rem;">Live Server <span class="gradient-text">Dashboard</span></h1>
    <p class="lead" style="max-width: 680px; margin: 0.5rem auto 0;">Monitor live gateway telemetry, AutoMod threat filters, active ticket systems, and staff audit streams in one real-time dashboard.</p>
  </div>
</section>

<section class="block" style="padding-top: 1rem;">
  <div class="wrap">
    <div class="metric-grid" style="margin-bottom: 2rem;">
      <div class="metric">
        <div class="label">System Gateway</div>
        <div class="value ${st.cls === "ok" ? "good" : "warn"}">${st.label}</div>
        <div class="sub">Latency: ${stats.ping} ms</div>
      </div>
      <div class="metric">
        <div class="label">Active Guilds</div>
        <div class="value" data-live="guilds">${stats.guilds.toLocaleString()}</div>
        <div class="sub">Connected Discord servers</div>
      </div>
      <div class="metric">
        <div class="label">Protected Members</div>
        <div class="value" data-live="users">${stats.users.toLocaleString()}</div>
        <div class="sub">Active user coverage</div>
      </div>
      <div class="metric">
        <div class="label">Command Suite</div>
        <div class="value">${stats.commands}</div>
        <div class="sub">${cs.subcommands} subcommands &middot; ${cs.options} options</div>
      </div>
    </div>

    <div class="playground-grid" style="margin-bottom: 2rem;">
      <div class="dash-card">
        <div class="card-head" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <h3>🛡️ Live AutoMod Rule Toggles</h3>
          <span class="pill ok">Interactive Engine</span>
        </div>
        <div style="display: grid; gap: 1.15rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>Link & Invite Shield</strong>
              <div class="faint">Block discord invites & untrusted external URLs</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" checked data-rule-name="Link Shield">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>Mention Spam Guard</strong>
              <div class="faint">Timeout users posting > 5 mentions per message</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" checked data-rule-name="Mention Guard">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>Profanity & Keyword Filter</strong>
              <div class="faint">Purge blacklisted terms & issue warnings</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" checked data-rule-name="Keyword Filter">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>Caps & Character Flooding</strong>
              <div class="faint">Filter messages containing > 70% uppercase text</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" data-rule-name="Caps Filter">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <div class="dash-card">
        <div class="card-head" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <h3>📜 Live Staff Audit Stream</h3>
          <span class="pill ok">Stream Active</span>
        </div>
        <div class="log-stream-box">
          <div class="log-item">
            <span class="log-tag mod">TICKET</span>
            <span><b>@User409</b> opened ticket <code>#ticket-user409</code> (General Support)</span>
          </div>
          <div class="log-item">
            <span class="log-tag mod">MOD</span>
            <span><b>@Moderator</b> issued warning to <b>@User102</b> (Severity: MEDIUM)</span>
          </div>
          <div class="log-item">
            <span class="log-tag automod">AUTOMOD</span>
            <span>Shielded invite link from <b>spammer_bot</b> in <code>#general</code></span>
          </div>
          <div class="log-item">
            <span class="log-tag system">SYSTEM</span>
            <span>Anti-raid verification panel synced in <code>#verify</code></span>
          </div>
        </div>
      </div>
    </div>

    ${ctaBox(cfg, "Deploy Aegis to your server today", "Take total control of server moderation, ticket systems, and verification with zero hassle.")}
  </div>
</section>`;

  return page(cfg, {
    title: "Live Dashboard — Aegis Discord Bot",
    description: "Real-time telemetry, AutoMod controls, and staff audit stream dashboard for Aegis Discord Bot.",
    path: "/dashboard",
    body,
  });
}

/* ── Interactive Playground Page ────────────────────────────────────── */

export function renderPlayground(cfg: SiteConfig): string {
  const body = `
<section class="page-header" style="text-align:center; padding: 3rem 0 1.5rem;">
  <div class="wrap">
    <span class="eyebrow">Interactive Simulator</span>
    <h1 style="margin-top:0.4rem;">Command & Embed <span class="gradient-text">Playground</span></h1>
    <p class="lead" style="max-width: 680px; margin: 0.5rem auto 0;">Test Aegis slash commands live in your browser and preview Discord embeds, interactive action buttons, and modal workflows in real time.</p>
  </div>
</section>

<section class="block" style="padding-top: 1rem;">
  <div class="wrap">
    <div class="playground-grid">
      <div class="pg-card">
        <h3 style="margin-bottom: 1.2rem;">⚡ Command Simulator Controls</h3>

        <div class="pg-form-group">
          <label for="pg-command-select">Select Command Suite</label>
          <select id="pg-command-select" class="pg-select">
            <option value="ticket" selected>🎫 /ticket setup (Support Ticket Panel)</option>
            <option value="verify">🛡️ /verify setup (Anti-Raid Member Verification)</option>
            <option value="rolepanel">🎭 /rolepanel create (Button Reaction Roles)</option>
            <option value="suggest">💡 /suggest (Community Feedback & Voting)</option>
            <option value="warn">⚠️ /warn (Warning with Severity & Undo)</option>
            <option value="purge">🗑️ /purge (Bulk Delete & Filter Preview)</option>
          </select>
        </div>

        <div class="pg-form-group">
          <label for="pg-user-input">Target User / Channel</label>
          <input type="text" id="pg-user-input" class="pg-input" value="@Member" placeholder="@Username or #channel">
        </div>

        <div class="pg-form-group">
          <label for="pg-severity-select">Warning / Action Severity</label>
          <select id="pg-severity-select" class="pg-select">
            <option value="low">🟡 Low Severity</option>
            <option value="medium" selected>🟠 Medium Severity</option>
            <option value="high">🔴 High Severity</option>
          </select>
        </div>

        <div class="pg-form-group">
          <label for="pg-reason-input">Title / Reason / Input</label>
          <input type="text" id="pg-reason-input" class="pg-input" value="Need assistance with server permissions" placeholder="Specify reason or panel title...">
        </div>

        <div style="margin-top: 1.5rem; background: var(--bg-alt); padding: 0.85rem; border-radius: var(--r-sm); border: 1px solid var(--border);">
          <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--faint); font-weight: 700; margin-bottom: 0.25rem;">Slash Command String</div>
          <code id="pg-cmd-string" style="color: var(--primary); font-family: var(--mono); font-size: 0.88rem;">/ticket setup channel:#support staff_role:@SupportTeam title:"Support Tickets"</code>
        </div>
      </div>

      <div class="pg-card" style="background: #1e1f22;">
        <h3 style="margin-bottom: 1.2rem; color: #f2f3f5;">💬 Live Discord Embed Preview</h3>

        <div class="discord-box">
          <div class="discord-msg-head">
            <div class="discord-avatar">A</div>
            <div>
              <div class="discord-author">Aegis <span class="discord-bot-tag">BOT</span></div>
              <div class="discord-time">Today at 12:00 PM</div>
            </div>
          </div>

          <div id="pg-embed-card" class="discord-embed-card" style="border-left-color: #3498db;">
            <div id="pg-embed-title" class="discord-embed-title">🎫 Support Tickets</div>
            <div id="pg-embed-desc" class="discord-embed-desc">Need assistance? Click the button below to open a private support ticket with our team.</div>
            <div class="discord-embed-fields">
              <div>
                <div class="discord-field-name">Category</div>
                <div id="pg-f1-val" class="discord-field-val">General Support</div>
              </div>
              <div>
                <div class="discord-field-name">Staff Role</div>
                <div id="pg-f2-val" class="discord-field-val">@SupportTeam</div>
              </div>
            </div>
          </div>

          <div id="pg-buttons-row" class="discord-buttons-row" style="margin-top: 0.75rem;">
            <button class="d-btn primary" type="button">🎫 Create Ticket</button>
          </div>
        </div>
      </div>
    </div>

    ${ctaBox(cfg, "Ready to use Aegis in your Discord server?", "Add Aegis now with full support for slash commands, embed builders, and moderation automation.")}
  </div>
</section>`;

  return page(cfg, {
    title: "Interactive Command Playground — Aegis Bot",
    description: "Try out Aegis Discord Bot slash commands and live Discord embed previews directly in your browser.",
    path: "/playground",
    body,
  });
}
