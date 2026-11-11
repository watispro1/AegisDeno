import { buildCatalog, groupByCategory, catalogStats, type CommandInfo, type OptionInfo, type SubcommandInfo } from "../catalog";
import { examplesFor, examplesForPath } from "../commandExamples";
import { type CommandAccess, commandAccess, commandSearchText, filterHref, hasAutocomplete, matchesFilter, parseCommandFilter } from "./commandFilter";
import { type SiteConfig, breadcrumb, endNote, escapeHtml, fmtNum, jsonLd, page, statStrip } from "./shared";

/* Commands */

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

/** Plain text of a usage line, for the copy button: required options as `name:`. */
function usageCopy(prefix: string, opts: OptionInfo[]): string {
  return [prefix, ...opts.filter(o => o.required).map(o => `${o.name}:`)].join(" ");
}

function synopsis(cmd: CommandInfo): string {
  const lines = cmd.subcommands.length
    ? cmd.subcommands.map(s => ({ html: usageLine(`/${cmd.name} ${s.path}`, s.options), copy: usageCopy(`/${cmd.name} ${s.path}`, s.options) }))
    : [{ html: usageLine(`/${cmd.name}`, cmd.options), copy: usageCopy(`/${cmd.name}`, cmd.options) }];
  return `<ul class="usage" aria-label="Usage">
      ${lines.map(l => `<li><pre class="synopsis">${l.html}</pre><button class="copy-btn usage-copy" type="button" data-js-only data-copy="${escapeHtml(l.copy)}" aria-label="Copy ${escapeHtml(l.copy)}">Copy</button></li>`).join("\n      ")}
    </ul>`;
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
      <div><dt>Aegis needs</dt><dd>${cmd.botPermissions.length ? cmd.botPermissions.map(escapeHtml).join(", ") : `<span class="faint">None checked before it runs</span>`}</dd></div>${cmd.featurePermissions.length ? `
      <div><dt>Some parts use</dt><dd>${cmd.featurePermissions.map(escapeHtml).join(", ")}<span class="faint"> · checked when that part runs</span></dd></div>` : ""}
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

const ACCESS_LABEL: Record<CommandAccess, string> = { everyone: "Everyone", moderator: "Moderator", admin: "Admin" };

export { commandAccess, commandSearchText, matchesFilter, parseCommandFilter, type CommandAccess, type CommandFilter } from "./commandFilter";

const current = (on: boolean) => (on ? ` aria-current="true"` : "");

function permBadge(cmd: CommandInfo): string {
  const perms = [...new Set([...cmd.declaredPermissions, ...cmd.enforcedPermissions])];
  const access = commandAccess(cmd);
  const title = perms.length ? `Needs ${perms.join(", ")}` : "No permission needed";
  return `<span class="perm-badge perm-${access}" title="${escapeHtml(title)}"><span class="perm-level">${ACCESS_LABEL[access]}</span>${perms.length ? `<span class="perm-name">${escapeHtml(perms[0])}${perms.length > 1 ? ` +${perms.length - 1}` : ""}</span>` : ""}</span>`;
}

function commandCard(cmd: CommandInfo, catalog: CommandInfo[], hidden: boolean): string {
  const examples = examplesFor(cmd, catalog);
  const anchor = commandAnchor(cmd.name);
  const name = escapeHtml(cmd.name);
  const auto = hasAutocomplete(cmd);
  const topLevelExamples = cmd.subcommands.length ? [] : examples;
  const access = commandAccess(cmd);

  return `<details class="cmd-card" id="${anchor}" data-category="${escapeHtml(cmd.category)}" data-name="${name}" data-access="${access}" data-subs="${cmd.subcommands.length ? "1" : "0"}" data-autocomplete="${auto ? "1" : "0"}" data-search="${escapeHtml(commandSearchText(cmd))}"${hidden ? " hidden" : ""}>
  <summary>
    <a class="cmd-anchor" href="#${anchor}" aria-label="Link to /${name}">#</a>
    <span class="cmd-slash" data-cmd-name>/${name}</span>
    <span class="cmd-summary-text"><span class="cmd-desc">${escapeHtml(cmd.description)}</span></span>
    <span class="cmd-meta">
      ${permBadge(cmd)}
      ${cmd.subcommands.length ? `<span class="tag">${cmd.subcommands.length} sub</span>` : ""}
      ${auto ? `<span class="tag">autocomplete</span>` : ""}
    </span>
    <button class="cmd-pin" type="button" data-pin="${name}" data-js-only aria-pressed="false" aria-label="Pin /${name}" title="Pin to the top of this page">★</button>
    <span class="cmd-chevron" aria-hidden="true"></span>
  </summary>
  <div class="cmd-body">
    ${commandFacts(cmd)}
    <div>
      <div class="cmd-section-title">Usage</div>
      ${synopsis(cmd)}
      <p class="usage-legend faint">Options in <span class="opt">[brackets]</span> are optional.</p>
    </div>
    <div class="cmd-run">
      <button class="copy-btn" type="button" data-js-only data-copy="/${name}" aria-label="Copy /${name}">Copy /${name}</button>
      <button class="copy-btn" type="button" data-js-only data-copy-link="#${anchor}" aria-label="Copy a link to /${name}">Copy link</button>
      <a class="copy-btn" href="/api/commands/${encodeURIComponent(cmd.name)}">JSON</a>
    </div>
    ${cmd.subcommands.length ? `<div>
      <div class="cmd-section-title">Subcommands</div>
      ${subcommandBlocks(cmd, examples)}
    </div>` : `<div>
      <div class="cmd-section-title">Options</div>
      ${optionsTable(cmd.options)}
    </div>
    ${topLevelExamples.length ? `<div>
      <div class="cmd-section-title">Examples</div>
      ${exampleList(topLevelExamples)}
    </div>` : ""}`}
  </div>
</details>`;
}

const searchIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;

export function renderCommands(cfg: SiteConfig, query?: Record<string, unknown>): string {
  const catalog = buildCatalog();
  const cat = groupByCategory(catalog);
  const s = catalogStats();
  const f = parseCommandFilter(query, cat.map(g => g.category));
  const filtering = f.q !== "" || f.cat !== "all" || f.access !== "all" || f.subs || f.auto;
  const shown = new Set(catalog.filter(c => matchesFilter(c, f)).map(c => c.name));
  const accessCount = (a: CommandAccess) => catalog.filter(c => commandAccess(c) === a).length;

  const filterChips = [
    `<a class="tab" href="${filterHref({ ...f, cat: "all" })}" data-cat="all"${current(f.cat === "all")}>All<span class="n">${s.commands}</span></a>`,
    ...cat.map(
      g => `<a class="tab" href="${filterHref({ ...f, cat: g.category })}" data-cat="${escapeHtml(g.category)}"${current(f.cat === g.category)}>${escapeHtml(g.label)}<span class="n">${g.commands.length}</span></a>`
    ),
  ].join("\n      ");

  const accessChips = ([
    ["all", "Any access", ""],
    ["everyone", "Everyone", "Commands without a required permission"],
    ["moderator", "Moderator", "Commands that need Ban Members, Kick Members, Moderate Members, Manage Messages, Manage Channels, Manage Roles or Manage Nicknames"],
    ["admin", "Admin", "Commands that need Administrator or Manage Server"],
  ] as const).map(([value, label, title]) =>
    `<a class="tab${value === "all" ? "" : ` access-${value}`}" href="${filterHref({ ...f, access: value })}" data-access="${value}"${current(f.access === value)}${title ? ` title="${title}"` : ""}>${value === "all" ? "" : `<span class="perm-dot" aria-hidden="true"></span>`}${label}${value === "all" ? "" : `<span class="n">${accessCount(value)}</span>`}</a>`
  ).join("\n      ");

  const sideNav = cat.map(
    g => `<li><a href="#${escapeHtml(g.category)}"><span>${escapeHtml(g.label)}</span><span class="toc-d">${g.commands.length}</span></a></li>`
  ).join("\n        ");

  const jumpNav = cat.map(
    g => `<li><a href="#${escapeHtml(g.category)}">${escapeHtml(g.label)}</a> <span class="faint">${g.commands.length}</span></li>`
  ).join("\n      ");

  const groups = cat.map(g => {
    const visible = g.commands.filter(c => shown.has(c.name)).length;
    return `<section class="cmd-group" data-cmd-group="${escapeHtml(g.category)}" id="${escapeHtml(g.category)}" aria-labelledby="${escapeHtml(g.category)}-title"${visible ? "" : " hidden"}>
  <div class="cmd-group-head">
    <h2 id="${escapeHtml(g.category)}-title"><a class="group-anchor" href="#${escapeHtml(g.category)}">${escapeHtml(g.label)}</a></h2>
    <span class="blurb">${escapeHtml(g.blurb)}</span>
    <span class="n">${g.commands.length}</span>
  </div>
  ${g.commands.map(c => commandCard(c, catalog, !shown.has(c.name))).join("\n  ")}
</section>`;
  }).join("\n\n");

  const hidden = (name: string, value: string, on: boolean) => (on ? `<input type="hidden" name="${name}" value="${escapeHtml(value)}">` : "");
  const countText = shown.size === 1 ? "1 command" : `${shown.size} commands`;

  const body = `
<div class="wrap">
  ${breadcrumb("Commands")}
  <header class="cl-head ph-head">
    <div class="cl-head-text">
      <h1>Command reference</h1>
      <p class="lead">Every slash command Aegis registers, generated from the bot's own definitions when it starts, so it always matches Discord. Open a command for who can run it, every option and examples you can copy.</p>
    </div>
  </header>
  ${statStrip([
    { label: "Commands", value: fmtNum(s.commands), note: `in ${s.categories} categories` },
    { label: "Subcommands", value: fmtNum(s.subcommands) },
    { label: "Options", value: fmtNum(s.options) },
    { label: "Open to everyone", value: fmtNum(accessCount("everyone")), note: `${accessCount("moderator")} for moderators, ${accessCount("admin")} for admins` },
  ], "Command reference in numbers")}

  <nav class="cmd-jump" aria-label="Command categories">
    <p class="side-title">Jump to</p>
    <ul>
      ${jumpNav}
    </ul>
  </nav>

  <div class="split cmd-split">
    <aside class="toc cmd-side" aria-label="Command categories (sidebar)">
      <p class="side-title">Categories</p>
      <ul>
        ${sideNav}
      </ul>
      <p class="side-title">Who can run it</p>
      <ul class="perm-legend">
        <li><span class="perm-badge perm-everyone"><span class="perm-level">Everyone</span></span> no permission needed</li>
        <li><span class="perm-badge perm-moderator"><span class="perm-level">Moderator</span></span> a moderation permission</li>
        <li><span class="perm-badge perm-admin"><span class="perm-level">Admin</span></span> Manage Server or Administrator</li>
      </ul>
      <p class="side-title">Also</p>
      <ul>
        <li><a href="/docs#permissions">Permissions guide</a></li>
        <li><a href="/api/commands">All commands as JSON</a></li>
        <li><a href="/troubleshooting#cat-commands">Commands missing?</a></li>
      </ul>
    </aside>

    <div class="cmd-main">
      <div class="cmd-sticky">
        <form class="cmd-toolbar" id="cmd-form" role="search" action="/commands" method="get">
          <div class="search">
            <span class="icon" aria-hidden="true">${searchIcon}</span>
            <label class="visually-hidden" for="cmd-search">Search commands</label>
            <input id="cmd-search" name="q" type="search" value="${escapeHtml(f.q)}" placeholder="Filter by name, option or permission" autocomplete="off" spellcheck="false" maxlength="100" aria-describedby="cmd-keys" aria-controls="cmd-list">
            <span class="hint" aria-hidden="true" data-js-only><kbd>/</kbd></span>
          </div>
          ${hidden("cat", f.cat, f.cat !== "all")}${hidden("access", f.access, f.access !== "all")}${hidden("subs", "1", f.subs)}${hidden("auto", "1", f.auto)}
          <button class="btn sm nojs-only" type="submit">Search</button>
          <span class="cmd-count" id="cmd-count" role="status" aria-live="polite">${countText}</span>
          <button class="copy-btn" type="button" id="cmd-expand" data-js-only aria-pressed="false">Expand all</button>
        </form>
        <p class="visually-hidden" id="cmd-keys">Press Enter to open the first match, the down arrow to move through results, and Escape to clear.</p>

        <nav class="tabs" id="cmd-filter" aria-label="Filter by category">
      ${filterChips}
        </nav>

        <nav class="tabs cmd-tabs-secondary" id="cmd-access" aria-label="Filter by access and features">
      ${accessChips}
          <span class="tabs-sep" aria-hidden="true"></span>
          <a class="tab" href="${filterHref(f)}" data-flag="pinned" data-js-only>★ Pinned</a>
          <a class="tab" href="${filterHref({ ...f, subs: !f.subs })}" data-flag="subs"${current(f.subs)}>Has subcommands</a>
          <a class="tab" href="${filterHref({ ...f, auto: !f.auto })}" data-flag="autocomplete"${current(f.auto)}>Autocomplete</a>
        </nav>
      </div>

      <div id="cmd-empty" class="empty-state"${shown.size === 0 ? "" : " hidden"}>
        <strong>No commands match.</strong>
        <span id="cmd-didyoumean">Try a shorter word, or set the filter back to All.</span>
        <div class="btn-row"><a class="copy-btn" href="/commands" data-cmd-clear>Clear search and filter</a></div>
      </div>
      ${filtering ? `<p class="cmd-filtered nojs-only">Showing ${countText} for this filter. <a href="/commands">Show all ${s.commands}</a>.</p>` : ""}

      <div id="cmd-list">
      ${groups}
      </div>

      <p class="faint">Each command is also available as JSON at <code class="inline">/api/commands/ban</code> (swap in any name), and the full list at <a href="/api/commands">/api/commands</a>. Setup guides are in the <a href="/docs">docs</a>. Release notes are in the <a href="/changelog.xml">Atom feed</a>.</p>
    </div>
  </div>
  ${endNote(cfg, "In Discord, type <code class=\"inline\">/</code> to see the same list with autocomplete.")}
</div>`;

  return page(cfg, {
    title: "Commands | Aegis",
    description:
      "Searchable reference for every Aegis slash command: usage, subcommands, options, permissions, cooldowns and examples.",
    path: "/commands",
    body,
    noindex: filtering,
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
