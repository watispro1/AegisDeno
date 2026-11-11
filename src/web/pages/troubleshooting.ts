import { type SiteConfig, breadcrumb, endNote, escapeHtml, page, statStrip } from "./shared";

/* Troubleshooting */

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

/** Stable fragment for one issue: #cat-commands-1. */
export function issueAnchor(groupId: string, index: number): string {
  return `${groupId}-${index + 1}`;
}

export function troubleshootingIssues(): typeof ISSUES {
  return ISSUES;
}

export function renderTroubleshooting(cfg: SiteConfig): string {
  const total = ISSUES.reduce((n, g) => n + g.items.length, 0);
  const groups = ISSUES.map(g => `<section class="issue-group" aria-labelledby="${g.id}">
      <h2 id="${g.id}"><a class="group-anchor" href="#${g.id}">${escapeHtml(g.group)}</a> <span class="issue-n">${g.items.length}</span></h2>
      ${g.items.map((i, n) => {
        const id = issueAnchor(g.id, n);
        return `<details class="issue" id="${id}">
        <summary><span class="issue-q">${escapeHtml(i.q)}</span></summary>
        <div class="issue-body">${i.a}
          <p class="issue-link"><a class="text-link" href="#${id}">Link to this fix</a> <button class="copy-btn sm-copy" type="button" data-js-only data-copy-link="#${id}" aria-label="Copy a link to this fix">Copy link</button></p>
        </div>
      </details>`;
      }).join("\n      ")}
    </section>`).join("\n\n    ");

  const side = ISSUES.map(g => `<li><a href="#${g.id}"><span>${escapeHtml(g.group)}</span><span class="toc-d">${g.items.length}</span></a></li>`).join("\n        ");

  const body = `
<div class="wrap">
  ${breadcrumb("Troubleshooting")}
  <header class="cl-head ph-head">
    <div class="cl-head-text">
      <h1>Troubleshooting</h1>
      <p class="lead">Start with <code class="inline">/diagnostics</code> in your server. It checks permissions, configured channels and role order, and usually names the problem. The fixes below cover the rest.</p>
    </div>
  </header>
  ${statStrip([
    { label: "Known problems", value: String(total), note: `in ${ISSUES.length} groups` },
    { label: "First step", value: `<a href="/commands#cmd-diagnostics">/diagnostics</a>`, note: "names most problems" },
    { label: "Bot status", value: `<a href="/status">Check</a>`, note: "is it us or you?" },
  ], "Troubleshooting at a glance")}

  <details class="toc-mobile">
    <summary>Problem groups</summary>
    <nav aria-label="Problem groups (mobile)">
      <ul>
        ${side}
      </ul>
    </nav>
  </details>

  <div class="split help-split">
    <aside class="toc" aria-label="Problem groups">
      <p class="side-title">Problem groups</p>
      <ul>
        ${side}
      </ul>
      <p class="side-title">Elsewhere</p>
      <ul>
        <li><a href="/docs#permissions">Permissions</a></li>
        <li><a href="/docs#hidden-channels">Hidden channels</a></li>
        <li><a href="/commands">Commands</a></li>
      </ul>
    </aside>

    <div class="help-main">
      <section class="help-hierarchy" aria-labelledby="role-order">
        <h2 id="role-order">Role order, the usual culprit</h2>
        <p class="muted">Discord only lets a role act on roles below it. That applies to bots even with every permission ticked.</p>
        <div class="hierarchy">
          <div class="bad">
            <span class="hierarchy-label">✕ Does not work</span>
            <ol><li>Owner</li><li>Moderator</li><li><strong>Aegis</strong> (cannot touch moderators)</li><li>Member</li></ol>
          </div>
          <div class="good">
            <span class="hierarchy-label">✓ Works</span>
            <ol><li>Owner</li><li><strong>Aegis</strong></li><li>Moderator</li><li>Member</li></ol>
          </div>
        </div>
      </section>

      <div class="help-toolbar" data-js-only>
        <div class="search help-search">
          <span class="icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          </span>
          <label class="visually-hidden" for="help-search">Filter problems</label>
          <input id="help-search" type="search" placeholder="Filter: permissions, automod, tickets…" autocomplete="off" spellcheck="false" maxlength="100">
        </div>
      </div>

      <div id="help-issue-list">
    ${groups}
      </div>
      <div id="help-empty" class="empty-state" hidden>
        <strong>Nothing matches.</strong>
        Ask in the support server and include the output of /diagnostics.
      </div>

      <section class="help-ask" aria-labelledby="ask-title">
        <h2 id="ask-title">Before you ask for help</h2>
        <ol>
          <li>Run <code class="inline">/diagnostics</code> and copy its output.</li>
          <li>Note the exact command you ran and the reply you got.</li>
          <li>Check the <a href="/status">status page</a> and the <a href="/changelog">changelog</a> for anything recent.</li>
        </ol>
      </section>
    </div>
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
