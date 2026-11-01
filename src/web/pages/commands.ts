import { buildCatalog, groupByCategory, catalogStats, type CommandInfo, type OptionInfo, type SubcommandInfo } from "../catalog";
import { examplesFor, examplesForPath } from "../commandExamples";
import { type SiteConfig, breadcrumb, endNote, escapeHtml, jsonLd, page } from "./shared";

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
  // Server-wide settings count as admin: no command declares Administrator itself,
  // but Manage Server is the permission that gates configuration.
  const access = perms.includes("Administrator") || perms.includes("Manage Server")
    ? "admin"
    : perms.length ? "moderator" : "everyone";

  return `<details class="cmd-card" id="${anchor}" data-category="${escapeHtml(cmd.category)}" data-name="${name}" data-access="${access}" data-subs="${cmd.subcommands.length ? "1" : "0"}" data-autocomplete="${hasAutocomplete ? "1" : "0"}" data-search="${escapeHtml(searchBlob)}">
  <summary>
    <a class="cmd-anchor" href="#${anchor}" aria-label="Link to /${name}">#</a>
    <span class="cmd-slash" data-cmd-name>/${name}</span>
    <span class="cmd-summary-text"><span class="cmd-desc">${escapeHtml(cmd.description)}</span></span>
    <span class="cmd-meta">
      ${cmd.subcommands.length ? `<span class="tag">${cmd.subcommands.length} sub</span>` : ""}
      ${hasAutocomplete ? `<span class="tag">autocomplete</span>` : ""}
      ${perms.length ? `<span class="tag warn">${escapeHtml(perms[0])}${perms.length > 1 ? ` +${perms.length - 1}` : ""}</span>` : ""}
    </span>
    <button class="cmd-pin" type="button" data-pin="${name}" aria-pressed="false" aria-label="Pin /${name}" title="Pin to the top of this page">★</button>
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

    <div class="tabs cmd-tabs-secondary" id="cmd-access" role="group" aria-label="Filter by access and features">
      <button class="tab" type="button" data-access="all" aria-pressed="true">Any access</button>
      <button class="tab" type="button" data-access="everyone" aria-pressed="false" title="Commands without a required permission">Everyone</button>
      <button class="tab" type="button" data-access="moderator" aria-pressed="false" title="Commands that need Ban Members, Kick Members, Moderate Members, Manage Messages, Manage Channels, Manage Roles or Manage Nicknames">Moderator</button>
      <button class="tab" type="button" data-access="admin" aria-pressed="false" title="Commands that need Administrator or Manage Server">Admin</button>
      <span class="tabs-sep" aria-hidden="true"></span>
      <button class="tab" type="button" data-flag="pinned" aria-pressed="false">★ Pinned</button>
      <button class="tab" type="button" data-flag="subs" aria-pressed="false">Has subcommands</button>
      <button class="tab" type="button" data-flag="autocomplete" aria-pressed="false">Autocomplete</button>
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
