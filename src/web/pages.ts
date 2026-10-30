import { layout, REPO_URL } from "./layout";
import { DASHBOARD_VERSION } from "../version";
import {
  buildCatalog,
  groupByCategory,
  catalogStats,
  permissionMatrix,
  botPermissionRows,
  type CommandInfo,
  type OptionInfo,
  type SubcommandInfo,
} from "./catalog";
import { examplesFor, examplesForPath } from "./commandExamples";
import { features, faqs, quickstart } from "./content";
import { getChangelog, getDashboardChangelog, type ChangelogRelease } from "./changelog";

/** Public source repository (readable; proprietary licence). */
export { REPO_URL };

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
    ogImage: opts.ogImage ?? "/assets/og.png",
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
      <p class="lead">Aegis handles warnings, timeouts, bans and the case log behind them, plus automod, ban appeals, tickets, verification and logging. You type a command in your server and it does the thing. Server managers can also review cases and change settings in the <a href="/dashboard">web dashboard</a>.</p>
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
function usageLine(prefix: string, opts: OptionInfo[]): string {
  return [
    escapeHtml(prefix),
    ...opts.map(o => (o.required ? escapeHtml(optHint(o)) : `<span class="opt">[${escapeHtml(optHint(o))}]</span>`)),
  ].join(" ");
}

function synopsis(cmd: CommandInfo): string {
  const lines = cmd.subcommands.length
    ? cmd.subcommands.map(s => usageLine(`/${cmd.name} ${s.path}`, s.options))
    : [usageLine(`/${cmd.name}`, cmd.options)];
  return `<pre class="synopsis">${lines.join("\n")}</pre>`;
}

/** Anchor for a command or one of its subcommands: #cmd-ban, #cmd-automod-words-add. */
export function commandAnchor(name: string, path = ""): string {
  return `cmd-${[name, ...path.split(" ").filter(Boolean)].join("-")}`;
}

/** Choices, autocomplete, numeric range and text length, read from the option definition. */
function optionExtras(o: OptionInfo): string {
  const notes: string[] = [];
  if (o.choices.length) notes.push(`Choices: ${o.choices.map(escapeHtml).join(", ")}`);
  if (o.autocomplete) notes.push("Suggests values as you type.");
  if (o.min !== undefined && o.max !== undefined) notes.push(`From ${o.min} to ${o.max}.`);
  else if (o.min !== undefined) notes.push(`At least ${o.min}.`);
  else if (o.max !== undefined) notes.push(`At most ${o.max}.`);
  if (o.maxLength !== undefined) notes.push(`Up to ${o.maxLength} characters.`);
  return notes.map(n => `<br><span class="faint">${n}</span>`).join("");
}

function optionsTable(options: OptionInfo[]): string {
  if (options.length === 0) return `<p class="faint">No options.</p>`;

  // Required options first, as Discord lists them.
  const sorted = [...options.filter(o => o.required), ...options.filter(o => !o.required)];
  return `<div class="table-wrap">
    <table class="opt-table">
      <thead><tr><th>Option</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
      <tbody>
        ${sorted.map(o => `<tr>
          <td><code>${escapeHtml(o.name)}</code></td>
          <td>${escapeHtml(o.type)}</td>
          <td>${o.required ? `<span class="opt-req">yes</span>` : `<span class="opt-opt">no</span>`}</td>
          <td>${escapeHtml(o.description)}${optionExtras(o)}</td>
        </tr>`).join("\n        ")}
      </tbody>
    </table>
  </div>`;
}

function exampleList(examples: string[]): string {
  if (examples.length === 0) return "";
  return `<ul class="examples">
      ${examples.map(e => `<li><code>${escapeHtml(e)}</code><button class="copy-btn" type="button" data-copy="${escapeHtml(e)}" aria-label="Copy example: ${escapeHtml(e)}">Copy</button></li>`).join("\n      ")}
    </ul>`;
}

/** Who can run it, what Aegis needs, cooldown and where it works, as a short definition list. */
function commandFacts(cmd: CommandInfo): string {
  const perms = [...new Set([...cmd.declaredPermissions, ...cmd.enforcedPermissions])];
  const cooldown = cmd.cooldownSeconds > 0
    ? `${Number.isInteger(cmd.cooldownSeconds) ? cmd.cooldownSeconds : cmd.cooldownSeconds.toFixed(1)}s per member`
    : "None";
  return `<dl class="cmd-facts">
      <div><dt>Who can run it</dt><dd>${perms.length ? perms.map(p => `<strong>${escapeHtml(p)}</strong>`).join(", ") : "Anyone in the server"}${cmd.declaredPermissions.length ? `<span class="faint"> · hidden in Discord from members without it</span>` : ""}</dd></div>
      <div><dt>Aegis needs</dt><dd>${cmd.botPermissions.length ? cmd.botPermissions.map(escapeHtml).join(", ") : `<span class="faint">None checked before it runs</span>`}</dd></div>
      <div><dt>Cooldown</dt><dd>${cooldown}</dd></div>
      <div><dt>Where</dt><dd>${cmd.guildOnly ? "Servers only, not in DMs" : "Servers and DMs"}</dd></div>
    </dl>`;
}

function subcommandBlocks(cmd: CommandInfo, examples: string[]): string {
  const name = escapeHtml(cmd.name);
  const groups: { group: string | null; subs: SubcommandInfo[] }[] = [];
  for (const sub of cmd.subcommands) {
    const last = groups[groups.length - 1];
    if (last && last.group === sub.group) last.subs.push(sub);
    else groups.push({ group: sub.group, subs: [sub] });
  }

  return groups.map(g => `<div class="sub-group">
      ${g.group ? `<div class="cmd-section-title">${name} ${escapeHtml(g.group)}</div>` : ""}
      ${g.subs.map(s => {
        const anchor = commandAnchor(cmd.name, s.path);
        return `<section class="cmd-sub" id="${anchor}" data-sub-path="${escapeHtml(s.path)}">
        <h3 class="cmd-sub-title"><a class="sub-anchor" href="#${anchor}" aria-label="Link to /${name} ${escapeHtml(s.path)}">#</a> <code>/${name} ${escapeHtml(s.path)}</code></h3>
        <p class="cmd-sub-desc">${escapeHtml(s.description)}</p>
        ${optionsTable(s.options)}
        ${exampleList(examplesForPath(examples, cmd.name, s.path))}
      </section>`;
      }).join("\n      ")}
    </div>`).join("\n    ");
}

function commandCard(cmd: CommandInfo, catalog: CommandInfo[]): string {
  const examples = examplesFor(cmd, catalog);
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
  const anchor = commandAnchor(cmd.name);
  const name = escapeHtml(cmd.name);
  const hasAutocomplete = options.some(o => o.autocomplete);
  const topLevelExamples = cmd.subcommands.length ? [] : examples;

  return `<details class="cmd-card" id="${anchor}" data-category="${escapeHtml(cmd.category)}" data-name="${name}" data-search="${escapeHtml(searchBlob)}">
  <summary>
    <a class="cmd-anchor" href="#${anchor}" aria-label="Link to /${name}">#</a>
    <span class="cmd-slash" data-cmd-name>/${name}</span>
    <span class="cmd-summary-text"><span class="cmd-desc">${escapeHtml(cmd.description)}</span></span>
    <span class="cmd-meta">
      ${cmd.subcommands.length ? `<span class="tag">${cmd.subcommands.length} sub</span>` : ""}
      ${hasAutocomplete ? `<span class="tag">autocomplete</span>` : ""}
      ${perms.length ? `<span class="tag warn">${escapeHtml(perms[0])}${perms.length > 1 ? ` +${perms.length - 1}` : ""}</span>` : ""}
    </span>
    <span class="cmd-chevron" aria-hidden="true"></span>
  </summary>
  <div class="cmd-body">
    ${commandFacts(cmd)}
    <div>
      <div class="cmd-section-title">Usage</div>
      ${synopsis(cmd)}
    </div>
    <div class="cmd-run">
      <button class="copy-btn" type="button" data-copy="/${name}" aria-label="Copy /${name}">Copy /${name}</button>
      <button class="copy-btn" type="button" data-copy-link="#${anchor}" aria-label="Copy a link to /${name}">Copy link</button>
      <a class="copy-btn" href="/api/commands/${encodeURIComponent(cmd.name)}">JSON</a>
    </div>
    ${cmd.subcommands.length ? `<div>
      <div class="cmd-section-title">Subcommands</div>
      ${subcommandBlocks(cmd, examples)}
    </div>` : `<div>
      <div class="cmd-section-title">Options</div>
      ${optionsTable(cmd.options)}
    </div>
    <div>
      <div class="cmd-section-title">Examples</div>
      ${exampleList(topLevelExamples)}
    </div>`}
  </div>
</details>`;
}

export function renderCommands(cfg: SiteConfig): string {
  const catalog = buildCatalog();
  const cat = groupByCategory(catalog);
  const s = catalogStats();

  const filterChips = [
    `<button class="tab" type="button" data-cat="all" aria-pressed="true">All<span class="n">${s.commands}</span></button>`,
    ...cat.map(
      g => `<button class="tab" type="button" data-cat="${escapeHtml(g.category)}" aria-pressed="false">${escapeHtml(g.label)}<span class="n">${g.commands.length}</span></button>`
    ),
  ].join("\n    ");

  const jumpNav = cat.map(
    g => `<li><a href="#${escapeHtml(g.category)}">${escapeHtml(g.label)}</a> <span class="faint">${g.commands.length}</span></li>`
  ).join("\n      ");

  const groups = cat.map(g => `<section class="cmd-group" data-cmd-group="${escapeHtml(g.category)}" id="${escapeHtml(g.category)}" aria-labelledby="${escapeHtml(g.category)}-title">
  <div class="cmd-group-head">
    <h2 id="${escapeHtml(g.category)}-title"><a class="group-anchor" href="#${escapeHtml(g.category)}">${escapeHtml(g.label)}</a></h2>
    <span class="blurb">${escapeHtml(g.blurb)}</span>
    <span class="n">${g.commands.length}</span>
  </div>
  ${g.commands.map(c => commandCard(c, catalog)).join("\n  ")}
</section>`).join("\n\n");

  const body = `
<div class="wrap">
  ${breadcrumb("Commands")}
  <div class="page-head">
    <h1>Commands</h1>
    <p class="lead">${s.commands} commands, ${s.subcommands} subcommands, ${s.options} options. This page is built from the command definitions when Aegis starts, so it always matches what the bot registers in Discord. Open a command for who can run it, every option, and examples you can copy.</p>
  </div>

  <nav class="cmd-jump" aria-label="Command categories">
    <p class="side-title">Jump to</p>
    <ul>
      ${jumpNav}
    </ul>
  </nav>

  <div class="cmd-sticky">
    <div class="cmd-toolbar">
      <div class="search">
        <span class="icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        </span>
        <label class="visually-hidden" for="cmd-search">Search commands</label>
        <input id="cmd-search" type="search" placeholder="Filter by name, option or permission" autocomplete="off" spellcheck="false" aria-describedby="cmd-keys" aria-controls="cmd-list">
        <span class="hint" aria-hidden="true"><kbd>/</kbd></span>
      </div>
      <span class="cmd-count" id="cmd-count" role="status" aria-live="polite">${s.commands} commands</span>
      <button class="copy-btn" type="button" id="cmd-expand" aria-pressed="false">Expand all</button>
    </div>
    <p class="visually-hidden" id="cmd-keys">Press Enter to open the first match, the down arrow to move through results, and Escape to clear.</p>

    <div class="tabs" id="cmd-filter" role="group" aria-label="Filter by category">
      ${filterChips}
    </div>
  </div>

  <div id="cmd-empty" class="empty-state" hidden>
    <strong>No commands match.</strong>
    <span id="cmd-didyoumean">Try a shorter word, or set the filter back to All.</span>
    <div class="btn-row"><button class="copy-btn" type="button" data-cmd-clear>Clear search and filter</button></div>
  </div>

  <div id="cmd-list">
  ${groups}
  </div>

  <p class="faint">Each command is also available as JSON at <code class="inline">/api/commands/ban</code> (swap in any name), and the full list at <a href="/api/commands">/api/commands</a>. Setup guides are in the <a href="/docs">docs</a>. Release notes are in the <a href="/changelog.xml">Atom feed</a>.</p>
  ${endNote(cfg, "In Discord, type <code class=\"inline\">/</code> to see the same list with autocomplete.")}
</div>`;

  return page(cfg, {
    title: "Commands | Aegis",
    description:
      "Searchable reference for every Aegis slash command: usage, subcommands, options, permissions, cooldowns and examples.",
    path: "/commands",
    body,
    headExtra: jsonLd({
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: "Aegis command reference",
      description:
        "Searchable reference for every Aegis slash command, including subcommands, options, required permissions and examples.",
      url: `${process.env.SITE_URL || ""}/commands`,
      softwareVersion: cfg.version,
    }),
  });
}

/* ── Docs ──────────────────────────────────────────────────────────── */

export interface DocSection {
  id: string;
  label: string;
  /** Sub-sections shown indented in the table of contents. */
  children?: { id: string; label: string }[];
}

/** The docs table of contents, in page order. Every id is a heading on the page. */
export const DOC_GROUPS: { title: string; sections: DocSection[] }[] = [
  {
    title: "Getting started",
    sections: [
      { id: "quickstart", label: "Set up Aegis" },
      { id: "dashboard", label: "Web dashboard" },
    ],
  },
  {
    title: "Guides",
    sections: [
      { id: "moderation", label: "Moderation and cases", children: [
        { id: "cases", label: "Cases and warnings" },
        { id: "escalation", label: "Escalation" },
        { id: "channel-tools", label: "Purge, lock, slowmode" },
      ] },
      { id: "automod", label: "Automod" },
      { id: "trustscore", label: "Trust score" },
      { id: "appeal", label: "Ban appeals" },
      { id: "watchlist", label: "Watchlist" },
      { id: "modreport", label: "Mod reports" },
      { id: "logging", label: "Logging" },
      { id: "tickets", label: "Tickets" },
      { id: "verification", label: "Verification" },
      { id: "community", label: "Community tools", children: [
        { id: "starboard", label: "Starboard" },
        { id: "polls-giveaways", label: "Polls and giveaways" },
        { id: "suggestions", label: "Suggestions" },
        { id: "welcome", label: "Welcome messages" },
        { id: "role-panels", label: "Role panels" },
        { id: "autoresponder", label: "Auto-responder" },
      ] },
      { id: "automation", label: "Reminders and schedules" },
    ],
  },
  {
    title: "Reference",
    sections: [
      { id: "permissions", label: "Permissions" },
      { id: "hidden-channels", label: "Hidden channels" },
      { id: "configuration", label: "Configuration and presets" },
      { id: "self-hosting", label: "Self-hosting" },
      { id: "data", label: "Data and storage" },
    ],
  },
  {
    title: "Help",
    sections: [
      { id: "faq", label: "FAQ" },
      { id: "troubleshooting", label: "Troubleshooting" },
    ],
  },
];

/** Every anchor the docs table of contents links to. */
export function docAnchors(): string[] {
  return DOC_GROUPS.flatMap(g => g.sections.flatMap(s => [s.id, ...(s.children ?? []).map(c => c.id)]));
}

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

/** Member permissions checked inside a subcommand, on top of the command's own. Kept in step with the code by tests. */
export const SUBCOMMAND_CHECKS: { command: string; permission: string }[] = [
  { command: "/case delete", permission: "Administrator" },
  { command: "/case export", permission: "Manage Server" },
  { command: "/preset apply", permission: "Administrator" },
  { command: "/note clear", permission: "Manage Server" },
  { command: "/appeal list, view, review", permission: "Ban Members" },
  { command: "/ticket setup", permission: "Manage Channels" },
  { command: "/ticket settings (changing a value)", permission: "Manage Channels" },
  { command: "/rolepanel create, delete", permission: "Manage Roles" },
  { command: "/verify user", permission: "Manage Roles" },
  { command: "/verify autokick", permission: "Kick Members" },
  { command: "/suggest setup, approve, deny, consider", permission: "Manage Server" },
  { command: "/autoresponder add, create, remove, delete", permission: "Manage Server" },
  { command: "/giveaway reroll", permission: "Manage Server, or the giveaway's host" },
];

function permissionTable(): string {
  const rows = permissionMatrix();

  return `<div class="table-wrap">
    <table>
      <thead><tr><th>Permission</th><th>Commands</th><th>Why</th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td><strong>${escapeHtml(r.permission)}</strong></td>
          <td>${r.commands.map(c => `<a class="cmd-link" href="/commands#cmd-${escapeHtml(c.slice(1))}"><code class="inline">${escapeHtml(c)}</code></a>`).join(" ")}</td>
          <td>${PERMISSION_WHY[r.permission] ?? "Needed to carry out the command."}</td>
        </tr>`).join("\n        ")}
      </tbody>
    </table>
  </div>`;
}

function botPermissionTable(): string {
  const rows = botPermissionRows();
  return `<div class="table-wrap">
    <table>
      <thead><tr><th>Aegis needs</th><th>Used by</th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td><strong>${escapeHtml(r.permission)}</strong></td>
          <td>${r.commands.length ? r.commands.map(c => `<code class="inline">${escapeHtml(c)}</code>`).join(" ") : "Reading and posting in the channels Aegis works in"}</td>
        </tr>`).join("\n        ")}
      </tbody>
    </table>
  </div>`;
}

/** An h2 with a copyable # link, so every section can be shared. */
function docHeading(id: string, label: string, level: 2 | 3 = 2): string {
  return `<h${level} id="${id}" class="doc-h">${escapeHtml(label)} <a class="h-anchor" href="#${id}" aria-label="Link to ${escapeHtml(label)}">#</a></h${level}>`;
}

function docToc(): string {
  return DOC_GROUPS.map(g => `<p class="side-title">${escapeHtml(g.title)}</p>
      <ul>
        ${g.sections.map(s => `<li><a href="#${s.id}">${escapeHtml(s.label)}</a>${s.children ? `
          <ul class="toc-sub">
            ${s.children.map(c => `<li><a href="#${c.id}">${escapeHtml(c.label)}</a></li>`).join("\n            ")}
          </ul>` : ""}</li>`).join("\n        ")}
      </ul>`).join("\n      ");
}

export function renderDocs(cfg: SiteConfig): string {
  const toc = docToc();

  const body = `
<div class="wrap">
  ${breadcrumb("Docs")}
  <div class="page-head">
    <h1>Docs</h1>
    <p class="lead">How to set Aegis up, then a guide for each feature. Commands are written the way you type them in Discord; every option is on the <a href="/commands">commands page</a>, and fixes for common problems are on the <a href="/troubleshooting">troubleshooting page</a>.</p>
  </div>

  <details class="toc-mobile">
    <summary>On this page</summary>
    <nav aria-label="On this page (mobile)">
      ${toc}
    </nav>
  </details>

  <div class="split">
    <aside class="toc" aria-label="On this page">
      ${toc}
      <p class="side-title">Elsewhere</p>
      <ul>
        <li><a href="/commands">Commands</a></li>
        <li><a href="/troubleshooting">Troubleshooting</a></li>
        <li><a href="/changelog">Changelog</a></li>
      </ul>
    </aside>

    <article class="prose">
      ${docHeading("quickstart", "Set up Aegis")}
      <p>About ten minutes from invite to a working setup. Each step links to the guide with the details.</p>
      <ol class="setup-steps">
        <li><strong>Invite Aegis.</strong> Use the <a href="${safeUrl(cfg.inviteUrl)}">Add to Discord</a> link. It asks for the <code>bot</code> and <code>applications.commands</code> scopes and only the permissions the commands use, never Administrator (the list is under <a href="#permissions">Permissions</a>). Slash commands appear once it joins.</li>
        <li><strong>Move the Aegis role up.</strong> In <strong>Server Settings &rarr; Roles</strong>, drag the Aegis role above every role it should moderate or hand out: the roles of members it may time out, kick or ban, the verified role, the welcome role and role-panel roles.</li>
        <li><strong>Let Aegis see its channels.</strong> Aegis needs <strong>View Channel</strong> in every channel it posts to or watches: the log channel, welcome, verification, tickets, starboard, suggestions and announcements. Channels it cannot see are hidden from it by Discord; see <a href="#hidden-channels">Hidden channels</a>.</li>
        <li><strong>Pick a log channel</strong> so every action is recorded: <code>/logging channel</code>, then <code>/logging test</code>. See <a href="#logging">Logging</a>.</li>
        <li><strong>Choose your protection.</strong> Look at a preset with <code>/preset view</code> and apply it with <code>/preset apply</code> (Administrator only), or turn on individual <a href="#automod">automod</a> filters. Exempt staff roles first.</li>
        <li><strong>Optional:</strong> warning <a href="#escalation">escalation</a>, <a href="#tickets">tickets</a>, <a href="#verification">verification</a> and the <a href="#community">community tools</a>.</li>
        <li><strong>Check it.</strong> <code>/diagnostics</code> lists the permissions Aegis is missing, whether the log and welcome channels are set and visible to it, whether the welcome role sits below its role, and which automod filters are on.</li>
      </ol>
      ${cmdBlock(`/logging channel channel:#mod-log
/logging test
/automod exempt addrole role:@Staff
/preset view type:Standard Community
/preset apply type:Standard Community
/diagnostics`)}
      <div class="callout"><p>If commands do not show up, restart your Discord client. If they still do not, Aegis was probably invited without the <code>applications.commands</code> scope; invite it again with the link above.</p></div>

      ${docHeading("dashboard", "Web dashboard")}
      <p>The dashboard at <a href="/dashboard">/dashboard</a> covers the day-to-day jobs without slash commands. Log in with Discord; it lists the servers where you are the owner or have <strong>Manage Server</strong> or <strong>Administrator</strong>, and checks that again on every page.</p>
      <ul>
        <li><strong>Overview</strong>: counts for the server at a glance.</li>
        <li><strong>Cases</strong>: cases and warnings filtered by type, member or moderator; edit a reason, or revoke one (revoking a ban can also unban).</li>
        <li><strong>Appeals</strong>: read and decide ban appeals (needs Ban Members).</li>
        <li><strong>Panels</strong>: post or re-post the ticket, verification and role panels.</li>
        <li><strong>Settings</strong>: logging, escalation, automod, welcome, tickets, verification and starboard.</li>
        <li><strong>Activity</strong>: who changed what in the dashboard, kept for 180 days.</li>
      </ul>
      <p>In Discord, <code>/dashboard</code> shows a private summary for the server (members, active automod filters, open tickets, pending suggestions, warnings and cases). Dashboard changes have their own <a href="/dashboard/changelog">changelog</a>.</p>

      ${docHeading("moderation", "Moderation and cases")}
      <p>Timeout, kick and ban check that both you and Aegis rank above the member, then ask you to confirm. Warn checks that you outrank the member and applies straight away. Add <code>silent:true</code> to skip the DM to the member. On warn, timeout and ban the <code>reason</code> option suggests presets (Spam, NSFW, Harassment, Advertising, Raiding, Other) but takes any text, and <code>proof</code> attaches a screenshot to the case. Warn, timeout and ban show an Undo button for five minutes; it reverses the action and marks the case revoked.</p>
      ${cmdBlock(`/warn user:@member reason:Spam severity:Low
/timeout user:@member duration:1 hour reason:Arguing with staff proof:screenshot.png
/kick user:@member reason:Alt account
/ban user:@member reason:Raid account delete_messages:1
/unban user_id:123456789012345678`)}
      ${docHeading("cases", "Cases and warnings", 3)}
      <p>Every action creates a case. <code>/case user</code> pages through a member's cases five at a time. Wherever a command takes a <code>case_id</code>, start typing and Aegis suggests the server's recent cases (only to staff with Moderate Members). <code>/case delete</code> needs Administrator, shows the case and asks you to confirm; it removes the record and posts to the log channel, but does not undo the action itself. <code>/case export</code> (Manage Server) sends up to 5,000 cases as a JSON file.</p>
      <p><code>/warnings</code> lists a member's active warnings five per page, newest first, with each warning's ID; pass that ID to <code>/case edit</code> to change its reason. Only you see the list unless you set <code>ephemeral:false</code>. <code>/clearwarnings</code> shows how many warnings it will delete and asks you to confirm, then logs a case. You cannot clear your own warnings, and for members still in the server you must outrank them; members who have left can be cleared by any moderator.</p>
      ${cmdBlock(`/case user user:@member
/case view case_id:65f0c0ffee0000000000abcd
/case edit case_id:65f0c0ffee0000000000abcd reason:Updated reason
/warnings user:@member
/clearwarnings user:@member
/infractions user:@member
/note add user:@member`)}
      ${docHeading("escalation", "Escalation", 3)}
      <p>Escalation rules act automatically when a member reaches a warning count. Timeout durations are in minutes. Set an expiry and warnings older than that many days stop counting; revoked warnings never count. <code>/escalation clear</code> lists the thresholds and asks before removing them all.</p>
      ${cmdBlock(`/escalation add warnings:3 action:Timeout duration:60
/escalation add warnings:5 action:Ban
/escalation expiry days:30
/escalation toggle enabled:true`)}
      ${docHeading("channel-tools", "Purge, lock and slowmode", 3)}
      <p><code>/purge</code> can combine a filter with <code>user</code> and <code>keyword</code>, leaves pinned messages alone, and reports how many were deleted and how many were skipped for being older than 14 days. <code>/lock server</code> and <code>/lock category</code> skip channels Aegis cannot see.</p>
      ${cmdBlock(`/purge amount:50 filter:Bot messages only
/purge amount:200 filter:Messages with links user:@member
/lock channel channel:#general duration_minutes:15 message:Back in 15 minutes
/lock category category:Events duration_minutes:30
/lock unlock channel:#general
/slowmode custom seconds:10`)}

      ${docHeading("automod", "Automod")}
      <p>Five filters: blocked words, links, mentions, spam rate and caps. Each one is toggled separately and has its own action (delete, delete and warn, or delete and timeout). Exempt your staff roles before turning filters on.</p>
      ${cmdBlock(`/automod status
/automod exempt addrole role:@Staff
/automod words add word:free nitro
/automod words action action:Delete and warn
/automod mentions limit count:5
/automod spam limit max:6 window:5
/automod caps limit percent:70`)}

      ${docHeading("trustscore", "Trust score")}
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

      ${docHeading("appeal", "Ban appeals")}
      <p>Every ban that can DM the member sends them a code like <code>AGS-K7X2</code> with instructions. Since they are no longer in your server, they run the submit command from any other server Aegis is in; the DM tells them this.</p>
      ${cmdBlock(`/appeal submit code:AGS-K7X2
/appeal list status:Pending
/appeal view code:AGS-K7X2
/appeal review code:AGS-K7X2 decision:Approve note:Account secured`)}
      <p>Approving lifts the ban and DMs the member. Reviewing needs Ban Members; submitting does not. Appeals can also be decided on the dashboard's Appeals page.</p>

      ${docHeading("watchlist", "Watchlist")}
      <p>Adds a member to a private watch. You get DMs for the events you picked. Add <code>alert_channel</code> to also post them in a staff channel; the member is never told.</p>
      ${cmdBlock(`/watchlist add user:@member duration:7 Days events:All Events reason:Alt of a banned user
/watchlist add user:@member events:First Message of the Day + Voice Joins alert_channel:#mod-alerts
/watchlist list
/watchlist info user:@member
/watchlist remove user:@member`)}

      ${docHeading("modreport", "Mod reports")}
      ${cmdBlock(`/modreport period:Last 24 Hours
/modreport period:Last 7 Days ephemeral:false
/modstats period:Last 30 days`)}
      <p>The report has four views (overview, top offenders, staff, automod) behind buttons on the reply.</p>

      ${docHeading("logging", "Logging")}
      ${cmdBlock(`/logging channel channel:#mod-log
/logging status
/logging test
/logging toggle enabled:false`)}
      <p>Logs are posted to your channel and not stored anywhere else. If Aegis loses sight of the log channel, entries are skipped and <code>/diagnostics</code> says so.</p>

      ${docHeading("tickets", "Tickets")}
      ${cmdBlock(`/ticket setup channel:#support staff_role:@Staff
/ticket claim
/ticket add user:@member
/ticket transcript
/ticket close reason:Solved
/ticket settings log_channel:#ticket-logs autoclose_hours:48`)}
      <p>Members can have one open ticket at a time. Aegis needs Manage Channels in the category where tickets are created. <code>/ticket setup</code> and changing <code>/ticket settings</code> need Manage Channels.</p>
      <p>Staff can press <strong>Claim</strong> on the ticket to show who is handling it. When a ticket closes, Aegis builds an HTML transcript, posts it to the ticket log channel if you set one, and DMs it to the member who opened the ticket. Tickets with no messages for 48 hours close on their own; change that with <code>autoclose_hours</code>, or set it to <code>0</code> to turn it off.</p>
      <p>A ticket channel Aegis cannot see is never closed, by hand or automatically: Aegis could not post the notice, build the transcript or delete the channel. The automatic check waits a full window and tries again; give Aegis View Channel there to close it.</p>

      ${docHeading("verification", "Verification")}
      ${cmdBlock(`/verify setup channel:#verify verified_role:@Member type:One-Click Button
/verify info
/verify user target:@member
/verify autokick minutes:30
/verify disable`)}
      <p>Set your other channels so that only the verified role can see them. The Aegis role has to sit above the verified role to grant it.</p>
      <p>CAPTCHA mode asks a small math question in a pop-up form before granting the role. Auto-kick is off by default; with <code>/verify autokick</code> (needs Kick Members) or the <code>kick_unverified_minutes</code> option on setup, members who have not verified in time are kicked, even if the bot restarted in between. <code>/verify user</code> verifies someone by hand and needs Manage Roles.</p>

      ${docHeading("community", "Community tools")}
      <p>Starboard, polls, giveaways, suggestions, welcome messages, role panels and auto-replies.</p>
      ${docHeading("starboard", "Starboard", 3)}
      ${cmdBlock(`/starboard setup channel:#starboard
/starboard threshold count:5
/starboard emoji emoji:⭐
/starboard selfstar allowed:false
/starboard ignore action:add channel:#staff`)}
      ${docHeading("polls-giveaways", "Polls and giveaways", 3)}
      ${cmdBlock(`/giveaway start prize:Nitro duration:24h winners:1 booster_multiplier:2
/giveaway reroll message_id:123456789012345678
/poll question:Next game night? option1:Friday option2:Saturday duration:24 Hours (1 Day) multiselect:true anonymous:true`)}
      <p>Server boosters get extra entries when <code>booster_multiplier</code> is above 1. Ended giveaways have a Reroll button for the host and moderators with Manage Server; rerolls skip people who already won. Timed polls close on their own, even across restarts, and post the results.</p>
      ${docHeading("suggestions", "Suggestions", 3)}
      ${cmdBlock(`/suggest setup channel:#suggestions
/suggest submit
/suggest approve id:5d0c8a1e-7b3f-4c2e-9a61-2f4b8e9d1c70 reason:Doing it`)}
      <p>Each suggestion post shows its ID in the footer. The post has Approve, Deny and Consider buttons for staff with Manage Server; each asks for an optional reason, and the author gets a DM when the status changes.</p>
      ${docHeading("welcome", "Welcome messages", 3)}
      ${cmdBlock(`/welcome channel channel:#welcome
/welcome message
/welcome preview
/welcome toggle enabled:true`)}
      <p><code>/welcome message</code> opens a form and <code>/welcome preview</code> shows the result. Placeholders: <code>{user}</code>, <code>{username}</code>, <code>{server}</code>, <code>{count}</code> (<code>{member_count}</code> also works).</p>
      ${docHeading("role-panels", "Role panels", 3)}
      ${cmdBlock(`/rolepanel create channel:#roles role1:@Events role2:@Updates
/rolepanel create channel:#colors role1:@Red role2:@Blue style:Dropdown menu exclusive:true required_role:@Member
/rolepanel list
/rolepanel delete id:panel-id`)}
      <p>A panel offers up to three roles as buttons or a dropdown menu. With <code>exclusive:true</code> a member can hold only one role from the panel, and <code>required_role</code> limits the panel to members who already have that role. Creating and deleting panels needs Manage Roles, and the Aegis role must sit above every role on the panel.</p>
      ${docHeading("autoresponder", "Auto-responder", 3)}
      ${cmdBlock(`/autoresponder add trigger:how do i verify response:Read the pinned message in {channel} match_type:Contains Keyword
/autoresponder list
/autoresponder remove id:ar-…`)}
      <p>Aegis replies in the channel when a member's message contains, starts with or exactly matches the trigger, ignoring case. Bots are ignored. Adding and removing needs Manage Server; the <code>id</code> option on remove suggests your triggers as you type, and a trigger that already exists with the same match type is refused. Triggers can be up to 100 characters and responses up to 2,000. Placeholders: <code>{user}</code>, <code>{username}</code>, <code>{tag}</code>, <code>{user_id}</code>, <code>{server}</code>, <code>{server_id}</code>, <code>{channel}</code>, <code>{channel_id}</code>, <code>{member_count}</code>.</p>

      ${docHeading("automation", "Reminders and schedules")}
      ${cmdBlock(`/remindme set reminder:Review appeals duration:2h
/remindme set reminder:Stand-up notes duration:1d repeat:Daily
/remindme list
/remindme cancel id:(pick from the list)
/automation message in:1d channel:#announcements message:Event starts in an hour
/automation repeat interval:7d channel:#general message:Weekly thread is up
/automation list
/automation cancel id:(from /automation list)`)}
      <p>Durations use <code>30s</code>, <code>10m</code>, <code>2h</code>, <code>1d</code> (<code>/remindme</code> also takes <code>1w</code> and goes up to a year). Reminders, scheduled tasks and <code>/lock</code> auto-unlocks are restored after a restart. A <code>/remindme</code> reminder can repeat daily or weekly, and the DM has Snooze buttons for 10 minutes or 1 hour.</p>

      ${docHeading("permissions", "Permissions")}
      <p>Who can run what. Discord hides these commands from members without the permission; Aegis checks again when the command runs.</p>
      ${permissionTable()}
      <h3 id="permissions-subcommands">Checked inside a subcommand</h3>
      <p>Some subcommands ask for more than their command does:</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Subcommand</th><th>Needs</th></tr></thead>
          <tbody>
            ${SUBCOMMAND_CHECKS.map(r => `<tr><td><code class="inline">${escapeHtml(r.command)}</code></td><td>${escapeHtml(r.permission)}</td></tr>`).join("\n            ")}
          </tbody>
        </table>
      </div>
      <h3 id="permissions-bot">What Aegis needs</h3>
      <p>The invite link asks for exactly these, built from the commands' own declarations. Administrator is never requested. Aegis checks the ones a command needs before it runs and tells you which are missing.</p>
      ${botPermissionTable()}

      ${docHeading("hidden-channels", "Hidden channels")}
      <p>From November 16, 2026 Discord hides channel details from bots that lack <strong>View Channel</strong> there: the channel arrives with the placeholder name <code>___hidden___</code>, the <code>CHANNEL_OBFUSCATED</code> flag and stand-in permissions. Aegis recognises such channels by that flag (a real channel that happens to be called <code>___hidden___</code> is treated normally) and then:</p>
      <ul>
        <li>leaves them out of channel pickers and channel counts (<code>/serverinfo</code>, <code>/dashboard</code>, <code>/about</code>, the web dashboard);</li>
        <li>never posts to them, and never edits their permissions: <code>/lock server</code> and <code>/lock category</code> skip them, and <code>/lock</code>, <code>/slowmode</code>, auto-unlocks and ticket member changes refuse them;</li>
        <li>keeps tickets in them open rather than closing them blind (see <a href="#tickets">Tickets</a>);</li>
        <li>tells you, wherever a saved channel has become hidden: "Aegis can't see this channel. Give Aegis the View Channel permission there." This shows in <code>/diagnostics</code>, in command replies, and on the dashboard's Settings and Panels pages.</li>
      </ul>
      <p><strong>To fix it:</strong> open the channel's (or its category's) <strong>Edit Channel &rarr; Permissions</strong>, add the Aegis role, and allow <strong>View Channel</strong>, plus Send Messages and Embed Links where Aegis posts. Then run <code>/diagnostics</code> again.</p>

      ${docHeading("configuration", "Configuration and presets")}
      ${cmdBlock(`/config view
/config logging channel:#mod-log enabled:true
/config welcome channel:#welcome enabled:true
/preset view type:Gaming Hub`)}
      <p>Presets (Casual Server, Standard Community, Gaming Hub, Strict Security) apply a bundle of automod and escalation settings in one go. Run <code>/preset view</code> to see what one changes before applying it; applying needs Administrator. Most settings can also be changed on the dashboard's Settings page.</p>

      ${docHeading("self-hosting", "Self-hosting")}
      <p>The source is on <a href="${REPO_URL}">GitHub</a>. It is readable, but it is not open source: the licence is proprietary and all rights are reserved, so ask the author before running your own copy. If you have the go-ahead, this is what it takes.</p>
      <ul>
        <li>Node.js 20 or newer (CI and the Docker image use 22) and a MongoDB database. Despite the repository name, it does not run on Deno.</li>
        <li>A Discord application with a bot user. Copy its token and application ID, and turn on the Server Members, Message Content and Presence intents under <strong>Bot</strong> in the Developer Portal; the bot asks for all three when it connects.</li>
      </ul>
      ${cmdBlock(`git clone ${REPO_URL}.git
cd AegisDeno
npm ci
cp .env.example .env    # set DISCORD_TOKEN, DISCORD_APPLICATION_ID, MONGO_URI
npm run dev             # or: npm run build && npm start`)}
      <p>Slash commands are registered every time the bot starts. Set <code>DISCORD_TEST_GUILD_ID</code> to register them to one server while testing, and <code>DISCORD_OWNER_ID</code> to your own user ID for the developer commands. The website is served by the same process on <code>PORT</code> (3000 by default). Set <code>SITE_URL</code> to the public address so canonical links, social previews and the sitemap are correct.</p>
      <p>The web dashboard stays off until <code>DISCORD_CLIENT_SECRET</code> and <code>DASHBOARD_SESSION_SECRET</code> are both set; <code>DASHBOARD_REDIRECT_URI</code> must match a redirect added under OAuth2 in the Developer Portal. <code>fly.toml</code> and <code>DEPLOYMENT.md</code> in the repository cover deploying to Fly.io, and <a href="${REPO_URL}/blob/main/CONTRIBUTING.md" rel="noopener noreferrer">CONTRIBUTING.md</a> covers the tests and the pull request rules.</p>

      ${docHeading("data", "Data and storage")}
      <p>Settings, cases, warnings, tickets, appeals and the other records Aegis needs are stored in MongoDB, keyed by server ID. Warnings, cases and staff notes are deleted automatically after one year, and the dashboard's Activity log after 180 days. Log entries and ticket transcripts are posted to your channels rather than kept in the database. Removing Aegis does not delete a server's records on its own. The <a href="/privacy#stored">privacy policy</a> lists every kind of record and how long it is kept.</p>

      ${docHeading("faq", "FAQ")}
      ${faqBlock(faqs)}

      ${docHeading("troubleshooting", "Troubleshooting")}
      <p>The <a href="/troubleshooting">troubleshooting page</a> has step-by-step fixes. The usual ones:</p>
      <ul>
        <li><a href="/troubleshooting#cat-hierarchy">Missing Permissions on ban, timeout or roles</a>: role order, or a channel Aegis cannot see.</li>
        <li><a href="/troubleshooting#cat-commands">Commands not showing up or failing</a>.</li>
        <li><a href="/troubleshooting#cat-automod">Automod not acting, or acting on staff</a>.</li>
        <li><a href="/troubleshooting#cat-tickets">Tickets and verification</a>.</li>
        <li><a href="/troubleshooting#cat-automation">Reminders and welcome messages</a>.</li>
        <li><a href="/troubleshooting#cat-hosting">Self-hosting</a>.</li>
      </ul>
      <p>Still stuck? Run <code>/diagnostics</code> and include its output when you ask${cfg.supportUrl ? ` in the <a href="${safeUrl(cfg.supportUrl)}" rel="noopener noreferrer">support server</a>` : ""} or <a href="${REPO_URL}/issues" rel="noopener noreferrer">open an issue on GitHub</a>.</p>
    </article>
  </div>
</div>`;

  return page(cfg, {
    title: "Docs | Aegis",
    description:
      "Set up the Aegis Discord bot and use every feature: moderation and cases, automod, appeals, logging, tickets, verification, community tools, the dashboard, permissions and hidden channels.",
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
        q: "“Aegis can't see this channel” or a channel shows as ___hidden___",
        a: `<p>Aegis is missing <strong>View Channel</strong> there, so Discord hides the channel from it. Aegis will not post to it, change its permissions or close tickets in it until it can see it.</p>
        <ol>
          <li>Open the channel's (or its category's) <strong>Edit Channel &rarr; Permissions</strong>.</li>
          <li>Add the Aegis role and allow View Channel, plus Send Messages and Embed Links where Aegis posts.</li>
          <li>Run <code>/diagnostics</code> to confirm. More in the <a href="/docs#hidden-channels">hidden channels guide</a>.</li>
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


function fmtDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

function releaseBlock(r: ChangelogRelease): string {
  const label = r.date ? `v${r.version}` : r.version;
  return `<article class="release" id="${escapeHtml(r.id)}" aria-labelledby="${escapeHtml(r.id)}-title">
      <div class="release-meta">
        ${r.date ? `<time datetime="${escapeHtml(r.date)}">${fmtDate(r.date)}</time>` : `<span class="release-pending">Not released yet</span>`}
        ${r.compareUrl ? `<a class="release-diff" href="${safeUrl(r.compareUrl)}" rel="noopener noreferrer">Commits</a>` : ""}
      </div>
      <div>
        <h2 class="release-title" id="${escapeHtml(r.id)}-title"><a href="#${escapeHtml(r.id)}">${escapeHtml(label)}</a></h2>
        ${r.notes.map(n => `<p class="release-summary">${n}</p>`).join("\n        ")}
        ${r.sections.map(sec => `<h3>${escapeHtml(sec.title)}</h3>
        <ul class="changes">
          ${sec.items.map(i => `<li>${i}</li>`).join("\n          ")}
        </ul>`).join("\n        ")}
      </div>
    </article>`;
}

export function renderChangelog(cfg: SiteConfig): string {
  const log = getChangelog();
  const toc = log.releases
    .map(r => `<li><a href="#${escapeHtml(r.id)}">${escapeHtml(r.version)}</a>${r.date ? ` <span class="faint">${escapeHtml(r.date)}</span>` : ""}</li>`)
    .join("\n        ");

  const releases = log.releases.length
    ? log.releases.map(releaseBlock).join("\n      ")
    : `<p>The changelog file could not be read. It lives in the repository as <a href="${REPO_URL}/blob/main/CHANGELOG.md">CHANGELOG.md</a>.</p>`;

  const body = `
<div class="wrap">
  ${breadcrumb("Changelog")}
  <div class="page-head">
    <h1>Changelog</h1>
    <p class="lead">What changed in each version, newest first. This page is built from <a href="${REPO_URL}/blob/main/CHANGELOG.md">CHANGELOG.md</a> in the repository, so the two always match. There is also an <a href="/changelog.xml">Atom feed</a>. Changes to the web dashboard are in the <a href="/dashboard/changelog">dashboard changelog</a>.</p>
  </div>

  <details class="toc-mobile">
    <summary>Jump to a version</summary>
    <ul>
      ${toc}
    </ul>
  </details>

  <div class="split">
    <aside class="toc" aria-label="Versions">
      <p class="side-title">Versions</p>
      <ul>
        ${toc}
      </ul>
    </aside>
    <div>
      ${log.intro.map(p => `<p class="faint">${p}</p>`).join("\n      ")}
      ${releases}
      ${endNote(cfg, `This server is running v${escapeHtml(cfg.version)}.`)}
    </div>
  </div>
</div>`;

  const released = log.releases.filter(r => r.date);
  return page(cfg, {
    title: "Changelog | Aegis",
    description: "Release history for the Aegis Discord bot, built from CHANGELOG.md in the repository.",
    path: "/changelog",
    body,
    headExtra: jsonLd({
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "Aegis changelog",
      url: `${process.env.SITE_URL || ""}/changelog`,
      blogPost: released.slice(0, 10).map(r => ({
        "@type": "BlogPosting",
        headline: `Aegis ${r.version}`,
        datePublished: r.date,
        url: `${process.env.SITE_URL || ""}/changelog#${r.id}`,
      })),
    }),
  });
}

/** /dashboard/changelog: rendered from DASHBOARD_CHANGELOG.md. Public, no login. */
export function renderDashboardChangelog(cfg: SiteConfig): string {
  const log = getDashboardChangelog();
  const releases = log.releases.length
    ? log.releases.map(releaseBlock).join("\n      ")
    : `<p>The dashboard changelog file could not be read. It lives in the repository as <a href="${REPO_URL}/blob/main/DASHBOARD_CHANGELOG.md">DASHBOARD_CHANGELOG.md</a>.</p>`;

  const body = `
<div class="wrap">
  <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span class="sep">/</span><a href="/changelog">Changelog</a><span class="sep">/</span><span>Dashboard</span></nav>
  <div class="page-head">
    <h1>Dashboard changelog</h1>
    <p class="lead">What changed in the web dashboard, newest first. This page is built from <a href="${REPO_URL}/blob/main/DASHBOARD_CHANGELOG.md">DASHBOARD_CHANGELOG.md</a> in the repository. Changes to the bot itself are in the <a href="/changelog">main changelog</a>.</p>
  </div>
  ${log.intro.map(p => `<p class="faint">${p}</p>`).join("\n  ")}
  ${releases}
  <p class="faint"><a href="/dashboard">Open the dashboard</a></p>
</div>`;

  return page(cfg, {
    title: "Dashboard changelog | Aegis",
    description: "Release history for the Aegis web dashboard, built from DASHBOARD_CHANGELOG.md in the repository.",
    path: "/dashboard/changelog",
    body,
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

/** Shown on /terms and /privacy. Change both pages together. */
export const LEGAL_LAST_UPDATED = "October 30, 2026";
const LEGAL_LAST_UPDATED_ISO = "2026-10-30";

/** How to reach the maintainer, built only from what is actually configured. */
function contactLine(cfg: SiteConfig, topic: string): string {
  const ways = [
    `open an issue on <a href="${REPO_URL}/issues" rel="noopener noreferrer">GitHub</a> (issues are public, so leave out personal details and ask for a private follow-up if you need one)`,
  ];
  if (cfg.supportUrl) ways.push(`ask in the <a href="${safeUrl(cfg.supportUrl)}" rel="noopener noreferrer">support server</a>`);
  if (cfg.contactEmail) ways.push(`email <a href="mailto:${escapeHtml(cfg.contactEmail)}">${escapeHtml(cfg.contactEmail)}</a>`);
  const list = ways.length === 1 ? ways[0] : `${ways.slice(0, -1).join(", ")} or ${ways[ways.length - 1]}`;
  return `<p>For ${topic}, ${list}. To report a security problem, follow the <a href="/security">security policy</a> instead of filing a public issue.</p>`;
}

function legalPage(cfg: SiteConfig, o: {
  crumb: string;
  title: string;
  lead: string;
  glance: string[];
  sections: { id: string; title: string; html: string }[];
  path: string;
  metaTitle: string;
  description: string;
}): string {
  const toc = o.sections.map(s => `<li><a href="#${s.id}">${escapeHtml(s.title)}</a></li>`).join("\n        ");
  const body = `
<div class="wrap">
  ${breadcrumb(o.crumb)}
  <div class="page-head">
    <h1>${escapeHtml(o.title)}</h1>
    <p class="lead">${o.lead}</p>
    <p class="faint legal-meta"><span>Last updated: <time datetime="${LEGAL_LAST_UPDATED_ISO}">${LEGAL_LAST_UPDATED}</time></span><span>Applies to Aegis ${escapeHtml(cfg.version)} and the dashboard</span></p>
  </div>
  <section class="at-a-glance" aria-labelledby="glance-title">
    <h2 id="glance-title">At a glance</h2>
    <ul>
      ${o.glance.map(g => `<li>${g}</li>`).join("\n      ")}
    </ul>
  </section>

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
    <div class="legal">
      ${o.sections.map((s, i) => `<h2 id="${s.id}">${i + 1}. ${escapeHtml(s.title)}</h2>\n      ${s.html}`).join("\n\n      ")}
    </div>
  </div>
</div>`;

  return page(cfg, {
    title: o.metaTitle,
    description: o.description,
    path: o.path,
    body,
  });
}

export function renderTerms(cfg: SiteConfig): string {
  return legalPage(cfg, {
    crumb: "Terms",
    title: "Terms of Service",
    lead: "The rules for using the Aegis Discord bot, its web dashboard and this website, in plain language.",
    path: "/terms",
    metaTitle: "Terms of Service | Aegis",
    description: "The terms for using the Aegis Discord bot, its web dashboard and the aegisdeno.fly.dev website.",
    glance: [
      "Aegis is free. There is no paid tier and nothing to buy.",
      "You must be old enough to use Discord, and you must follow Discord's own terms.",
      "Server staff decide how Aegis is used in their server and are responsible for the actions they take with it.",
      "Aegis is provided as is, without a guaranteed uptime.",
      `What Aegis stores is described in the <a href="/privacy">Privacy Policy</a>.`,
    ],
    sections: [
      {
        id: "about",
        title: "About these terms",
        html: `<p>These terms cover the Aegis bot on Discord, the web dashboard at <a href="/dashboard">/dashboard</a>, and this website (together, "Aegis"). Aegis is run by its maintainer ("we", "us"). It is not made, endorsed or sponsored by Discord Inc.</p>
      <p>By adding Aegis to a server, using its commands, logging in to the dashboard or using this website, you agree to these terms. If you do not agree, do not use Aegis, and remove it from any server you manage.</p>
      <p>These terms apply to the copy of Aegis we run. Someone running their own copy from the source code is responsible for that copy.</p>`,
      },
      {
        id: "eligibility",
        title: "Who can use Aegis",
        html: `<p>You must meet Discord's minimum age, which is 13 in most countries and higher in some, and you must follow Discord's <a href="https://discord.com/terms" rel="noopener noreferrer">Terms of Service</a> and <a href="https://discord.com/guidelines" rel="noopener noreferrer">Community Guidelines</a>. You are responsible for what happens through your Discord account, including actions Aegis carries out because you ran a command or changed a setting.</p>`,
      },
      {
        id: "server-staff",
        title: "Your server, your decisions",
        html: `<p>Aegis acts only with the permissions a server gives it, and only on commands and rules that server's staff set up. If you add or manage Aegis in a server, you are responsible for:</p>
      <ul>
        <li>Reviewing the permissions on Discord's authorization screen before inviting Aegis, and placing its role correctly in the role list.</li>
        <li>The rules you configure, such as automod filters, escalation thresholds, verification auto-kick and ticket auto-close, and the actions they take automatically.</li>
        <li>Moderation decisions: who is warned, timed out, kicked or banned, and why. Aegis is a tool; the decisions stay with your staff.</li>
        <li>Using logging, ticket transcripts and the staff watchlist in line with Discord's policies, your own server rules and any law that applies to you. Logging can copy deleted and edited messages into a channel, and the watchlist sends staff alerts about a member without telling them.</li>
      </ul>`,
      },
      {
        id: "dashboard",
        title: "The web dashboard",
        html: `<p>You log in to the dashboard with Discord. It only lets you manage servers where you have the Manage Server or Administrator permission, and it re-reads your permissions from Discord while you use it. Changes you make there have the same effect as the matching slash command, and each one is recorded on that server's Activity page with your Discord user ID and username. Do not share your session or try to reach servers you do not manage.</p>`,
      },
      {
        id: "acceptable-use",
        title: "Acceptable use",
        html: `<p>Do not use Aegis to:</p>
      <ul>
        <li>Break Discord's terms or guidelines, or the law.</li>
        <li>Harass, threaten, dox or target anyone, including through the watchlist, logging or direct messages Aegis sends.</li>
        <li>Send spam, mass mentions or unsolicited advertising.</li>
        <li>Try to get into data, servers or dashboard pages you are not allowed to see, or probe Aegis for weaknesses outside the <a href="/security">security policy</a>.</li>
        <li>Overload or disrupt Aegis, this website or the services it relies on, for example by scripting requests to the dashboard or API.</li>
      </ul>
      <p>We may stop Aegis from working for a user or a server that breaks these rules.</p>`,
      },
      {
        id: "availability",
        title: "Availability and changes",
        html: `<p>Aegis is offered free of charge, "as is" and "as available". It can go down for maintenance, because of Discord or hosting problems, or for other reasons, and we do not promise any level of uptime. The <a href="/status">status page</a> shows what the bot reports about itself; it is not a service level agreement.</p>
      <p>Commands and features can be added, changed or removed. Notable changes are listed in the <a href="/changelog">changelog</a> and the <a href="/dashboard/changelog">dashboard changelog</a>.</p>`,
      },
      {
        id: "source",
        title: "Source code and licence",
        html: `<p>The source code is published on <a href="${REPO_URL}" rel="noopener noreferrer">GitHub</a> so it can be read and reviewed. It is not open source: it is proprietary and all rights are reserved. Copying, modifying, redistributing or running your own copy needs written permission from the maintainer, as the README explains. Using the bot in your server does not give you any rights to the code, name or branding.</p>`,
      },
      {
        id: "third-parties",
        title: "Services Aegis relies on",
        html: `<p>Aegis runs on Discord and depends on other providers to host it and store its data, such as Fly.io and a MongoDB database host. Your use of Discord is covered by Discord's own terms. We are not responsible for the availability or practices of those services. The <a href="/privacy#sharing">Privacy Policy</a> lists what each one receives.</p>`,
      },
      {
        id: "disclaimer",
        title: "No warranty",
        html: `<p>As far as the law allows, Aegis comes without warranties of any kind, express or implied, including that it is fit for a particular purpose, accurate, secure, or free of errors and interruptions. Do not rely on Aegis as your only moderation safeguard.</p>`,
      },
      {
        id: "liability",
        title: "Limitation of liability",
        html: `<p>As far as the law allows, we are not liable for indirect, incidental, special or consequential losses, or for lost data, members, messages or goodwill, arising from your use of Aegis. That includes losses caused by misconfigured rules, unintended moderation actions, downtime or Discord changes. Where liability cannot be excluded, it is limited to the amount you paid to use Aegis, which is nothing, or USD 50, whichever is greater.</p>
      <p>You agree to cover claims brought against the maintainer that arise from how you or your server's staff used Aegis, or from your breach of these terms or Discord's policies.</p>`,
      },
      {
        id: "ending",
        title: "Stopping and suspension",
        html: `<p>You can stop using Aegis at any time by removing it from your server and logging out of the dashboard. We may suspend or end access for a user or server, with or without notice, if these terms are broken, if the law requires it, or to protect Aegis and its users.</p>
      <p>Removing Aegis does not delete what it has already stored. Some records expire on their own and the rest can be deleted on request; see <a href="/privacy#retention">how long data is kept</a> and <a href="/privacy#deletion">how to ask for deletion</a>.</p>`,
      },
      {
        id: "changes",
        title: "Changes to these terms",
        html: `<p>We may update these terms when Aegis changes. The "Last updated" date at the top shows the current version, and changes are noted in the <a href="/changelog">changelog</a>. If you keep using Aegis after an update, the new terms apply. If you do not agree with them, stop using Aegis.</p>`,
      },
      {
        id: "general",
        title: "General",
        html: `<p>If part of these terms cannot be enforced, the rest still applies. These terms are governed by the law of the place where the maintainer is based, without regard to conflict-of-law rules. We will try to settle any disagreement informally first.</p>`,
      },
      {
        id: "contact",
        title: "Contact",
        html: contactLine(cfg, "questions about these terms"),
      },
    ],
  });
}

export function renderPrivacy(cfg: SiteConfig): string {
  const row = (what: string, details: string, kept: string) =>
    `<tr><td><strong>${what}</strong></td><td>${details}</td><td>${kept}</td></tr>`;

  return legalPage(cfg, {
    crumb: "Privacy",
    title: "Privacy Policy",
    lead: "What the Aegis bot, its dashboard and this website collect, why, how long it is kept, and how to get it deleted.",
    path: "/privacy",
    metaTitle: "Privacy Policy | Aegis",
    description: "What data the Aegis Discord bot and dashboard collect, how it is used, how long it is kept and how to request deletion.",
    glance: [
      "Aegis stores what its features need, such as server settings, moderation records, tickets and appeals, keyed by server.",
      "It does not sell data, show ads, build profiles or train models on your messages.",
      "Warnings, cases and staff notes are deleted automatically after one year; dashboard activity after 180 days; dashboard sessions after 7 days.",
      "The public website has no analytics and no cookies. The dashboard sets two login cookies.",
      `You can ask for data to be deleted; see <a href="#deletion">how</a>.`,
    ],
    sections: [
      {
        id: "scope",
        title: "Who this covers",
        html: `<p>This policy covers the copy of Aegis run by its maintainer ("we", "us"): the bot on Discord, the dashboard at <a href="/dashboard">/dashboard</a> and this website. Server staff choose which Aegis features to turn on in their server, so they also decide much of what is collected about that server's members. Someone running their own copy from the source code is responsible for the data in that copy.</p>`,
      },
      {
        id: "from-discord",
        title: "What Aegis receives from Discord",
        html: `<p>Like any Discord bot, Aegis receives events from Discord for the servers it is in. It asks Discord for server, member, member presence, message, message content, reaction and voice state events. That means it can see:</p>
      <ul>
        <li>Server, channel and role details, and member details such as user ID, username, roles, join date and account age.</li>
        <li>Messages and their content in channels it can view, plus edits, deletions and reactions.</li>
        <li>Voice channel joins and leaves.</li>
      </ul>
      <p>Most of this is used in memory as it arrives, for example to check a message against automod rules or auto-responders, to post a log entry, to send a watchlist alert, or to count messages for the trust score, and is not written to the database. Only the items listed in the next section are stored. Aegis does not ask Discord for direct message events, so it does not read DMs sent to it.</p>`,
      },
      {
        id: "stored",
        title: "What Aegis stores",
        html: `<p>Aegis keeps its records in a MongoDB database. Every record is tied to a server ID, and one server's records are never shown in another server.</p>
      <div class="table-wrap">
      <table>
        <thead><tr><th>Data</th><th>What is in it</th><th>How long it is kept</th></tr></thead>
        <tbody>
          ${row("Server settings", "Logging, welcome, escalation, ticket, verification, starboard and automod settings, including blocked word lists and exempt roles and channels; auto-responders; role panels.", "Until staff change or remove them, or deletion is requested. Not removed automatically when Aegis leaves a server.")}
          ${row("Warnings", "Member's user ID, moderator's user ID, reason, optional proof link, and whether it was revoked.", "Deleted automatically one year after it was issued, or earlier with <code class=\"inline\">/clearwarnings</code>.")}
          ${row("Moderation cases", "Timeouts, kicks, bans, unbans and similar: member and moderator IDs, action, reason, details, optional proof link, revoked state.", "Deleted automatically after one year. Revoking a case keeps it, marked revoked.")}
          ${row("Staff notes", "Member and moderator IDs and the note text.", "Deleted automatically after one year, or earlier with <code class=\"inline\">/note delete</code> or <code class=\"inline\">/note clear</code>.")}
          ${row("Ban appeals", "Appeal code, member and moderator IDs, ban reason, the appeal text the member submits, and the staff decision and note.", "No automatic expiry.")}
          ${row("Automod hits", "Member and channel IDs, the rule and action, and the first 200 characters of the message that triggered it. Used for <code class=\"inline\">/modreport</code>.", "No automatic expiry.")}
          ${row("Tickets", "Opener's user ID, ticket channel, category, who claimed and closed it, close reason and timestamps.", "No automatic expiry. Transcripts are not stored in the database (see below).")}
          ${row("Watchlist entries", "Watched member's ID, moderator's ID, reason, chosen events, alert count and optional alert channel.", "Until staff remove the entry or its set expiry passes.")}
          ${row("Member activity", "Per member and server: a message count and the time of their last message. No message content.", "No automatic expiry.")}
          ${row("Community features", "Suggestions (author ID, text, voter IDs, staff review); giveaways (host, entrant and winner IDs); polls (creator, question, and each voter's choice by user ID, including for anonymous polls, where votes are hidden from members but still stored to count them); starboard entries.", "No automatic expiry.")}
          ${row("Reminders and scheduled posts", "Creator's user ID, channel, message text and timing.", "Until they run, or until cancelled if they repeat.")}
          ${row("Dashboard sessions", "Your Discord user ID, username, display name, the Discord access token for this login, and your server list with your permissions in each. Only a hash of the session ID is stored.", "7 days after login, or when you log out.")}
          ${row("Dashboard activity", "Server ID, your user ID and username, what you changed, and when. Shown on the server's Activity page.", "Deleted automatically after 180 days.")}
          ${row("Dashboard rate limits", "A SHA-256 hash of your IP address and a request count for a one-minute window. The address itself is not stored.", "Deleted about a minute after the window ends.")}
        </tbody>
      </table>
      </div>
      <h3>Things posted in Discord rather than stored by Aegis</h3>
      <ul>
        <li><strong>Log entries.</strong> With logging on, Aegis posts moderation actions, joins and leaves, role and channel changes, and the content of edited and deleted messages (up to 200 characters) to the server's log channel.</li>
        <li><strong>Ticket transcripts.</strong> When a ticket closes, Aegis builds an HTML transcript of the channel. It is posted to the ticket log channel if transcript logging is on, and sent to the ticket opener by DM. Aegis does not keep a copy.</li>
        <li><strong>Direct messages.</strong> Aegis may DM members about a ban and how to appeal it, an appeal decision, a suggestion's status, their own reminders, or a ticket transcript. Watchlist alerts are DMed to the moderator who set the watch, and can include part of the watched member's messages.</li>
      </ul>
      <p>Messages Aegis posts in Discord are kept by Discord and can be deleted by the server's staff. How long they last is up to the server.</p>
      <h3>Logs</h3>
      <p>The bot writes operational logs, such as errors, startup messages and Top.gg vote notices, which can include server and user IDs. They are kept by our hosting provider's logging system and are not sent to any analytics service. Aegis itself does not log the IP addresses of website visitors. The public API's rate limit keeps addresses in memory for one minute and never writes them to the database.</p>`,
      },
      {
        id: "website",
        title: "This website and cookies",
        html: `<p>The public pages load no analytics, advertising or third-party scripts or fonts, and set no cookies. Your light or dark theme choice is saved in your browser's local storage under <code class="inline">aegis-theme</code> and never sent to us.</p>
      <p>The dashboard sets two cookies, both limited to <code class="inline">/dashboard</code>, marked HttpOnly and SameSite=Lax, and sent only over HTTPS on the live site:</p>
      <ul>
        <li><code class="inline">aegis_dash</code>: a signed, random session ID that keeps you logged in for up to 7 days.</li>
        <li><code class="inline">aegis_oauth</code>: protects the Discord login step against forgery and expires after 10 minutes.</li>
      </ul>
      <p>Both are needed for login to work, so there is no option to turn them off other than not using the dashboard.</p>`,
      },
      {
        id: "discord-login",
        title: "Logging in with Discord",
        html: `<p>The dashboard asks Discord for two permissions (OAuth2 scopes): <code class="inline">identify</code>, for your user ID, username and display name, and <code class="inline">guilds</code>, for the list of servers you are in and your permissions in each. It does not ask for your email address, cannot read your messages and cannot act as you. Aegis never sees your Discord password.</p>
      <p>The access token Discord issues is kept on the server in your session record, never sent to your browser, and used only to read your server list. Logging out deletes the session.</p>`,
      },
      {
        id: "use",
        title: "How data is used",
        html: `<ul>
        <li>To run the features a server has turned on: moderation, automod, escalation, appeals, tickets, verification, logging, the watchlist, reports and community tools.</li>
        <li>To show server staff their records, in Discord and in the dashboard.</li>
        <li>To protect Aegis from abuse, for example with rate limits.</li>
        <li>To show totals such as server and member counts on the home and status pages.</li>
      </ul>
      <p>We do not sell or rent data, use it for advertising, build profiles across servers, or use it to train AI models.</p>`,
      },
      {
        id: "sharing",
        title: "Who receives data",
        html: `<ul>
        <li><strong>Discord</strong>, which Aegis runs on. Everything Aegis does in a server goes through Discord and is covered by <a href="https://discord.com/privacy" rel="noopener noreferrer">Discord's Privacy Policy</a>.</li>
        <li><strong>Fly.io</strong>, which hosts the bot and this website. The app's primary region is Dallas, United States.</li>
        <li><strong>Our MongoDB database host</strong>, which stores the records listed above.</li>
        <li><strong>Top.gg</strong>, which receives only Aegis's total server count, when that integration is turned on.</li>
        <li>Anyone we are legally required to disclose data to, or where disclosure is needed to protect people or Aegis from harm.</li>
      </ul>
      <p>Hosting providers process data on our behalf to run Aegis. Your data may be stored and processed in the United States or other countries where these providers operate.</p>`,
      },
      {
        id: "security",
        title: "How data is protected",
        html: `<p>Secrets such as the bot token and database password are kept in environment variables, never in the source code or on this website. Dashboard session IDs are stored only as hashes, Discord access tokens stay on the server, forms are protected against cross-site request forgery, and the site sends a strict content security policy. No system is perfectly secure, and we cannot promise that data will never be exposed. To report a problem, see the <a href="/security">security policy</a>.</p>`,
      },
      {
        id: "retention",
        title: "How long data is kept",
        html: `<p>The table above gives the period for each kind of record. In short: warnings, cases and staff notes are deleted after one year, dashboard activity after 180 days, dashboard sessions after 7 days and rate-limit records within minutes. Other records are kept until server staff delete them, until deletion is requested, or until Aegis no longer needs them. Removing Aegis from a server does not delete that server's records automatically.</p>`,
      },
      {
        id: "deletion",
        title: "Deleting data and your choices",
        html: `<p><strong>Server staff</strong> can delete much of it directly: <code class="inline">/clearwarnings</code> for warnings, <code class="inline">/note delete</code> and <code class="inline">/note clear</code> for staff notes, the relevant commands or dashboard pages for settings, watchlist entries, auto-responders and role panels, and Discord itself for anything Aegis posted.</p>
      <p><strong>Members</strong> should usually start with the staff of the server concerned, since they decide how Aegis is used there.</p>
      <p><strong>To ask us</strong> to delete a server's records, or records about you, use one of the contact options below. We will need to confirm that you manage the server or own the Discord account before deleting anything, and we will tell you if something cannot be deleted, for example because a server needs it to handle an open appeal. Depending on where you live, you may have other rights over your data, such as access or correction; ask the same way.</p>`,
      },
      {
        id: "children",
        title: "Children",
        html: `<p>Aegis is for people who meet Discord's minimum age, which is 13 in most countries and higher in some. It is not directed at children below that age, and we do not knowingly collect their data. If you think a child under that age has used Aegis, contact us and we will delete what we hold about them.</p>`,
      },
      {
        id: "changes",
        title: "Changes to this policy",
        html: `<p>We will update this policy when Aegis starts or stops collecting something, or changes how long it keeps it. The "Last updated" date at the top shows the current version, and changes are noted in the <a href="/changelog">changelog</a>.</p>`,
      },
      {
        id: "contact",
        title: "Contact",
        html: contactLine(cfg, "privacy questions and deletion requests"),
      },
    ],
  });
}

/* ── Security ──────────────────────────────────────────────────────── */

export function renderSecurity(cfg: SiteConfig): string {
  const body = `
<div class="wrap">
  ${breadcrumb("Security")}
  <div class="page-head">
    <h1>Security</h1>
    <p class="lead">How to report a vulnerability in Aegis, and what is in scope. The full policy is <a href="${REPO_URL}/blob/main/SECURITY.md" rel="noopener noreferrer">SECURITY.md</a> in the repository.</p>
  </div>
  <div class="legal">
    <h2 id="report">Reporting a vulnerability</h2>
    <p>Please report it privately, not in a public issue, Discord message or pull request.</p>
    <ol>
      <li>Open the repository's <a href="${REPO_URL}/security" rel="noopener noreferrer">Security tab</a> on GitHub.</li>
      <li>Choose <strong>Report a vulnerability</strong>. This opens a private advisory that only the maintainers can see.</li>
      <li>Describe the problem, the steps to reproduce it, the version (shown in the site footer and in <code class="inline">/about</code>) and what an attacker could do with it.</li>
    </ol>
    <p>If the Report a vulnerability button is not available, open a public issue that says only that you have a security report and would like a private way to send it. Do not include any details.</p>

    <h2 id="scope">Scope</h2>
    <ul>
      <li>The Aegis bot and its slash commands.</li>
      <li>This website, its API under <code class="inline">/api</code>, and the dashboard under <code class="inline">/dashboard</code>.</li>
      <li>The source code in the <a href="${REPO_URL}" rel="noopener noreferrer">repository</a>.</li>
    </ul>
    <p>Discord itself, Fly.io and MongoDB are out of scope; report problems with them to those companies. Please do not run denial-of-service tests, spam servers, or access or change data that is not yours. Use your own test server.</p>

    <h2 id="supported">Supported versions</h2>
    <p>Only the latest release gets security fixes: bot ${escapeHtml(cfg.version)} and dashboard ${escapeHtml(DASHBOARD_VERSION)} at the moment. Older versions are not patched.</p>

    <h2 id="response">What happens next</h2>
    <p>The maintainer will acknowledge your report, look into it, and keep you updated in the advisory. Aegis is maintained in spare time, so there are no guaranteed response times. Fixes ship through the normal <a href="/changelog">changelog</a>, and you will be credited in the advisory if you would like to be.</p>
    <p>Machine-readable contact details are at <a href="/.well-known/security.txt">/.well-known/security.txt</a>.</p>
  </div>
</div>`;

  return page(cfg, {
    title: "Security | Aegis",
    description: "How to report a security vulnerability in the Aegis Discord bot, website or dashboard.",
    path: "/security",
    body,
  });
}

/* ── 404 ───────────────────────────────────────────────────────────── */

export function renderNotFound(cfg: SiteConfig, suggestions: { href: string; label: string }[] = []): string {
  const suggest = suggestions.length
    ? `<p class="suggest">Did you mean ${suggestions
        .map(s => `<a href="${safeUrl(s.href)}">${escapeHtml(s.label)}</a>`)
        .join(", ")}?</p>`
    : "";
  const body = `
<div class="wrap">
  <div class="page-head">
    <p class="eyebrow">404</p>
    <h1>There is no page at this address.</h1>
    <p class="lead">It may have moved, or the link has a typo. If a link on this site brought you here, please <a href="${REPO_URL}/issues" rel="noopener noreferrer">report it on GitHub</a>.</p>
  </div>
  ${suggest}
  <form class="notfound-search" role="search" action="/commands" method="get">
    <label class="visually-hidden" for="notfound-q">Search commands</label>
    <input id="notfound-q" name="q" type="search" placeholder="Search commands, e.g. ban" autocomplete="off" spellcheck="false" maxlength="100">
    <button class="btn" type="submit">Search commands</button>
  </form>
  <ul class="notes">
    <li><a href="/commands">Commands</a>: every slash command with its options, searchable.</li>
    <li><a href="/docs">Docs</a>: setup, configuration and permissions.</li>
    <li><a href="/troubleshooting">Troubleshooting</a>: missing commands, role order, automod.</li>
    <li><a href="/changelog">Changelog</a>: what changed recently.</li>
    <li><a href="/">Home</a></li>
  </ul>
  ${endNote(cfg, "You can also press <kbd>Ctrl</kbd> <kbd>K</kbd> to search every page and command.")}
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

export function renderPlayground(cfg: SiteConfig): string {
  return renderFeatures(cfg);
}
