import { buildCatalog } from "../catalog";
import { permissionMatrix, botPermissionRows } from "../catalog";
import { escapeHtml } from "./shared";

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
  { command: "/autoresponder add, create, remove, delete, toggle", permission: "Manage Server" },
  { command: "/giveaway reroll", permission: "Manage Server, or the giveaway's host" },
];

export function permissionTable(): string {
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

export function botPermissionTable(): string {
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
export function docHeading(id: string, label: string, level: 2 | 3 = 2): string {
  const safeLabel = escapeHtml(label);
  return `<h${level} id="${id}" class="doc-h">${safeLabel} <span class="h-actions"><a class="h-anchor" href="#${id}" aria-label="Link to ${safeLabel}">#</a><button class="h-copy" type="button" data-copy-link="#${id}" aria-label="Copy a link to ${safeLabel}">Copy link</button></span></h${level}>`;
}

/**
 * Turn `<code>/command</code>` mentions in the docs prose into links to the
 * command reference. Code that is already inside a "cmd-link" anchor is left
 * alone, and so is a command block (a <pre> of copyable lines).
 */
export function linkCommandsInHtml(html: string): string {
  const names = new Set(buildCatalog().map((c) => c.name));
  const saved: string[] = [];

  // Park links that already point at the command reference.
  let out = html.replace(/<a [^>]*class="cmd-link"[^>]*><code[^>]*>\/[a-z][\w-]*<\/code><\/a>/g, (match) => {
    saved.push(match);
    return `\u0000${saved.length - 1}\u0000`;
  });

  out = out.replace(/(?<!<pre class="block">)<code( class="inline")?>(\/[a-z][\w-]*)<\/code>/g, (match, cls: string | undefined, cmd: string) => {
    const name = cmd.slice(1);
    if (!names.has(name)) return match;
    return `<a class="cmd-link" href="/commands#cmd-${name}"><code${cls ?? ""}>${cmd}</code></a>`;
  });

  return out.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => saved[Number(index)]);
}


export function docToc(): string {
  return DOC_GROUPS.map(g => `<p class="side-title">${escapeHtml(g.title)}</p>
      <ul>
        ${g.sections.map(s => `<li><a href="#${s.id}">${escapeHtml(s.label)}</a>${s.children ? `
          <ul class="toc-sub">
            ${s.children.map(c => `<li><a href="#${c.id}">${escapeHtml(c.label)}</a></li>`).join("\n            ")}
          </ul>` : ""}</li>`).join("\n        ")}
      </ul>`).join("\n      ");
}
