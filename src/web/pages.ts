import { layout, NavLink } from "./layout";
import { commands } from "../commands/loader";

export interface SiteConfig {
  inviteUrl: string;
  supportUrl: string;
  version: string;
}

export interface Stats {
  guilds: number;
  users: number;
  commands: number;
  ping: number;
  uptime: number;
}

const NAV: NavLink[] = [
  { label: "Features", href: "/features" },
  { label: "Commands", href: "/commands" },
  { label: "Docs", href: "/docs", hideOnMobile: true },
];

function fmtUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

export function renderHome(cfg: SiteConfig, stats: Stats): string {
  const body = `
  <section class="hero">
    <div class="wrap">
      <div class="badge"><span class="dot"></span> All systems operational</div>
      <h1>Moderation that keeps up<br>with your community.</h1>
      <p>Aegis is a fast, modular Discord bot for moderation, automation, logging, and server management. Built to stay out of the way until you need it.</p>
      <div class="hero-cta">
        <a class="btn lg" href="${cfg.inviteUrl}">Add Aegis to Discord</a>
        <a class="btn ghost lg" href="/commands">Browse commands</a>
      </div>

      <div class="stats">
        <div class="stat"><div class="stat-value">${stats.guilds.toLocaleString()}</div><div class="stat-label">Servers</div></div>
        <div class="stat"><div class="stat-value">${stats.users.toLocaleString()}</div><div class="stat-label">Members</div></div>
        <div class="stat"><div class="stat-value">${stats.commands}</div><div class="stat-label">Commands</div></div>
        <div class="stat"><div class="stat-value">${fmtUptime(stats.uptime)}</div><div class="stat-label">Uptime</div></div>
      </div>
    </div>
  </section>

  <section class="block" id="pillars">
    <div class="wrap">
      <div class="section-head">
        <div class="eyebrow">What it does</div>
        <h2>Everything a moderation bot needs</h2>
        <p>Every feature is opt-in, per-server, and configurable with slash commands. No dashboard login required.</p>
      </div>
      <div class="grid">
        <div class="card">
          <div class="card-icon">🛡️</div>
          <h3>Moderation</h3>
          <p>Ban, kick, softban, timeout, and warn with optional message purging and role hierarchy enforcement.</p>
        </div>
        <div class="card">
          <div class="card-icon">🤖</div>
          <h3>Auto Moderation</h3>
          <p>Filter blocked words, links, mass mentions, and spam automatically before they reach your channel.</p>
        </div>
        <div class="card">
          <div class="card-icon">📜</div>
          <h3>Audit Logging</h3>
          <p>Route moderation and server events into a dedicated log channel with full moderator attribution.</p>
        </div>
        <div class="card">
          <div class="card-icon">👋</div>
          <h3>Welcome &amp; Goodbye</h3>
          <p>Greet new members and announce departures in a channel you choose, with a custom message.</p>
        </div>
        <div class="card">
          <div class="card-icon">📢</div>
          <h3>Community</h3>
          <p>Polls, announcements, and a suggestion channel that keeps feedback organized and actionable.</p>
        </div>
        <div class="card">
          <div class="card-icon">⏱️</div>
          <h3>Automation</h3>
          <p>Schedule recurring messages and reminders with a built-in scheduler that survives restarts.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="block">
    <div class="wrap">
      <div class="section-head">
        <div class="eyebrow">Getting started</div>
        <h2>Three steps to a moderated server</h2>
        <p>Aegis asks for the minimum permissions it needs. You can review every permission on the invite screen.</p>
      </div>
      <div class="steps">
        <div class="step">
          <h3>Invite Aegis</h3>
          <p>Use the invite link above and pick the server you want to protect. Slash commands register automatically.</p>
        </div>
        <div class="step">
          <h3>Configure it</h3>
          <p>Run <code class="inline">/config view</code> to see the defaults, then enable logging, welcome messages, and automod.</p>
        </div>
        <div class="step">
          <h3>Set permissions</h3>
          <p>Move Aegis above the roles it needs to manage and grant <code class="inline">Ban Members</code> or <code class="inline">Moderate Members</code> as required.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="block">
    <div class="wrap">
      <div class="section-head">
        <div class="eyebrow">Questions</div>
        <h2>Frequently asked</h2>
      </div>
      <div class="faq">
        <details open>
          <summary>What permissions does Aegis need?</summary>
          <p>Aegis declares the permissions each command needs at the command level, so the invite screen only requests what is actually used. Start without administrator access and add more if a feature asks for it.</p>
        </details>
        <details>
          <summary>Is there a web dashboard?</summary>
          <p>No. Everything is configured in Discord with slash commands like <code class="inline">/config</code> and <code class="inline">/logging</code>. This site is informational only.</p>
        </details>
        <details>
          <summary>How do warnings work?</summary>
          <p>Use <code class="inline">/warn</code> to record a warning against a member, <code class="inline">/warnings</code> to review their history, and <code class="inline">/clearwarnings</code> to reset it. Warnings are stored per server.</p>
        </details>
        <details>
          <summary>Can I use Aegis in multiple servers?</summary>
          <p>Yes. Configuration, warnings, logs, and automod rules are fully isolated per guild, so nothing bleeds between servers.</p>
        </details>
      </div>
    </div>
  </section>

  <section class="block">
    <div class="wrap">
      <div class="cta-box">
        <h2>Ready to get started?</h2>
        <p>Add Aegis to your server and run <code class="inline">/help</code> to see everything it can do.</p>
        <div class="cta-actions">
          <a class="btn lg" href="${cfg.inviteUrl}">Add to Discord</a>
          ${cfg.supportUrl ? `<a class="btn ghost lg" href="${cfg.supportUrl}">Join the support server</a>` : ""}
        </div>
      </div>
    </div>
  </section>`;

  return layout({
    title: "Aegis — Discord Moderation & Automation Bot",
    description:
      "Aegis is a fast, modular Discord bot for moderation, auto moderation, audit logging, welcome messages, and community management.",
    path: "/",
    body,
    links: NAV,
    inviteUrl: cfg.inviteUrl,
    supportUrl: cfg.supportUrl,
    version: cfg.version,
  });
}

const FEATURES: { icon: string; title: string; text: string; items: string[] }[] = [
  {
    icon: "🛡️",
    title: "Moderation",
    text: "Actions that respect your role hierarchy and always record who did what.",
    items: [
      "Ban, unban, softban, and kick with optional message deletion",
      "Timeouts and timeouts removal with duration parsing",
      "Warnings with per-user history and one-command reset",
      "Bulk message purge with an amount limit",
      "Per-user and per-bot permission checks before every action",
    ],
  },
  {
    icon: "🤖",
    title: "Auto Moderation",
    text: "Catch problems in real time instead of cleaning up after the fact.",
    items: [
      "Blocked word and phrase lists",
      "Link filtering with optional allowlist",
      "Mass mention and spam detection",
      "Each rule can be toggled independently per server",
    ],
  },
  {
    icon: "📜",
    title: "Logging",
    text: "A durable record of everything that happens in your server.",
    items: [
      "Dedicated log channel per server",
      "Moderation, message, member, and role events",
      "Moderator, target, and reason captured on every entry",
      "Enable and disable per event type",
    ],
  },
  {
    icon: "👋",
    title: "Welcome & Good-bye",
    text: "Make arrivals and departures feel intentional.",
    items: [
      "Separate join and leave channels",
      "Custom message templates",
      "Send a test message before enabling",
    ],
  },
  {
    icon: "📢",
    title: "Community",
    text: "Give members a voice and keep decisions transparent.",
    items: [
      "Native Discord polls",
      "Formatted announcement embeds",
      "Suggestion channel with upvote tracking",
    ],
  },
  {
    icon: "⏱️",
    title: "Automation & Roles",
    text: "Recurring work and role management without a bot in your admin panel.",
    items: [
      "Scheduled announcements and reminders",
      "List and cancel scheduled jobs",
      "Create, delete, and inspect roles",
      "Add and remove roles from members",
    ],
  },
];

export function renderFeatures(cfg: SiteConfig): string {
  const body = `
  <div class="wrap">
    <div class="page-head">
      <h1>Features</h1>
      <p>Every capability Aegis ships with, grouped by what it is for. All of it is configured per server with slash commands.</p>
    </div>
  </div>

  <section class="block" style="padding-top:1.5rem">
    <div class="wrap">
      <div class="grid">
        ${FEATURES.map(
          (f) => `
        <div class="card">
          <div class="card-icon">${f.icon}</div>
          <h3>${f.title}</h3>
          <p>${f.text}</p>
          <ul style="margin-top:1rem;padding-left:1.1rem;color:var(--muted);font-size:0.9rem">
            ${f.items.map((i) => `<li style="margin-bottom:0.35rem">${i}</li>`).join("")}
          </ul>
        </div>`,
        ).join("")}
      </div>
    </div>
  </section>

  <section class="block">
    <div class="wrap">
      <div class="cta-box">
        <h2>See them in action</h2>
        <p>Every feature on this page is available in the current release.</p>
        <div class="cta-actions">
          <a class="btn lg" href="${cfg.inviteUrl}">Add to Discord</a>
          <a class="btn ghost lg" href="/commands">View commands</a>
        </div>
      </div>
    </div>
  </section>`;

  return layout({
    title: "Features — Aegis",
    description:
      "Moderation, auto moderation, audit logging, welcome messages, community tools, and automation in one Discord bot.",
    path: "/features",
    body,
    links: NAV,
    inviteUrl: cfg.inviteUrl,
    supportUrl: cfg.supportUrl,
    version: cfg.version,
  });
}

interface CommandEntry {
  name: string;
  description: string;
  subs: { name: string; description: string }[];
}

function collectCommands(): CommandEntry[] {
  const out: CommandEntry[] = [];
  for (const cmd of commands.values()) {
    const json = typeof cmd.data?.toJSON === "function" ? cmd.data.toJSON() : cmd.data;
    if (!json?.name) continue;
    const subs: { name: string; description: string }[] = [];
    for (const opt of json.options ?? []) {
      if (opt.type === 1) {
        for (const sub of opt.options ?? []) {
          subs.push({ name: sub.name, description: sub.description ?? "" });
        }
      } else if (opt.type === 2) {
        subs.push({ name: opt.name, description: opt.description ?? "" });
      }
    }
    out.push({ name: json.name, description: json.description ?? "", subs });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function renderCommands(cfg: SiteConfig): string {
  const entries = collectCommands();
  const body = `
  <div class="wrap">
    <div class="page-head">
      <h1>Commands</h1>
      <p>Aegis exposes ${entries.length} slash commands. Type <code class="inline">/</code> in Discord to see them with the live parameter list.</p>
    </div>
  </div>

  <section class="block" style="padding-top:1.5rem">
    <div class="wrap">
      ${entries
        .map(
          (c) => `
      <div class="cmd-group">
        <h3>/${c.name}</h3>
        <div class="cmd-list">
          <div class="cmd">
            <div class="cmd-name">/${c.name}${c.subs.length ? " [subcommand]" : ""}</div>
            <div class="cmd-desc">${c.description}</div>
            ${c.subs
              .map((s) => `<span class="sub">/${c.name} ${s.name} — ${s.description}</span>`)
              .join("")}
          </div>
        </div>
      </div>`,
        )
        .join("")}
    </div>
  </section>

  <section class="block">
    <div class="wrap">
      <div class="cta-box">
        <h2>Commands are easier in Discord</h2>
        <p>Autocomplete, permission hints, and required arguments are handled natively by the Discord client.</p>
        <div class="cta-actions"><a class="btn lg" href="${cfg.inviteUrl}">Add to Discord</a></div>
      </div>
    </div>
  </section>`;

  return layout({
    title: "Commands — Aegis",
    description: "Full list of Aegis slash commands for moderation, automod, logging, welcome, community, and automation.",
    path: "/commands",
    body,
    links: NAV,
    inviteUrl: cfg.inviteUrl,
    supportUrl: cfg.supportUrl,
    version: cfg.version,
  });
}

const QUICKSTART = (inviteUrl: string) => [
  {
    title: "1. Invite the bot",
    body: `Click <a class="btn" href="${inviteUrl}">Add to Discord</a> and select your server. Aegis requests only the permissions its commands declare, so the authorization screen stays minimal.`,
  },
  {
    title: "2. Check the current setup",
    body: `Run <code class="inline">/config view</code> to review what is enabled. Most features are off by default and turned on one at a time.`,
  },
  {
    title: "3. Enable logging",
    body: `Run <code class="inline">/logging channel #your-log-channel</code>, then toggle the events you care about with <code class="inline">/logging enable</code>.`,
  },
  {
    title: "4. Turn on auto moderation",
    body: `Use <code class="inline">/automod enable</code> to switch on the rule set, then add blocked words with <code class="inline">/automod words</code> and links with <code class="inline">/automod links</code>.`,
  },
  {
    title: "5. Set up welcome messages",
    body: `Pick a channel with <code class="inline">/welcome channel</code>, write your message with <code class="inline">/welcome message</code>, preview it with <code class="inline">/welcome test</code>, then <code class="inline">/welcome enable</code>.`,
  },
  {
    title: "6. Schedule recurring posts",
    body: `Create reminders and scheduled announcements with <code class="inline">/automation schedule</code>, review them with <code class="inline">/automation list</code>, and stop them with <code class="inline">/automation cancel</code>.`,
  },
];

export function renderDocs(cfg: SiteConfig): string {
  const invite = cfg.inviteUrl;
  const body = `
  <div class="wrap">
    <div class="page-head">
      <h1>Documentation</h1>
      <p>How to configure Aegis, what the permissions mean, and how data is stored.</p>
    </div>
  </div>

  <section class="block" style="padding-top:1rem">
    <div class="wrap">
      <div class="section-head" style="text-align:left;margin-bottom:2rem">
        <div class="eyebrow">Quickstart</div>
        <h2 style="font-size:1.8rem">Set up your server</h2>
      </div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
        ${QUICKSTART(invite).map(
          (s) => `<div class="card">
          <h3>${s.title}</h3>
          <p>${s.body}</p>
        </div>`,
        ).join("")}
      </div>
    </div>
  </section>

  <section class="block">
    <div class="wrap">
      <div class="section-head" style="text-align:left;margin-bottom:2rem">
        <div class="eyebrow">Reference</div>
        <h2 style="font-size:1.8rem">Permissions</h2>
      </div>
      <div class="grid">
        <div class="card">
          <h3>Ban, kick, unban</h3>
          <p>Require <code class="inline">Ban Members</code> and <code class="inline">Kick Members</code>. Aegis refuses to act on anyone above the highest role it can manage.</p>
        </div>
        <div class="card">
          <h3>Timeout</h3>
          <p>Requires <code class="inline">Moderate Members</code>. Maximum duration follows Discord's own limit of 28 days.</p>
        </div>
        <div class="card">
          <h3>Purge and slowmode</h3>
          <p>Requires <code class="inline">Manage Messages</code> and <code class="inline">Manage Channels</code> respectively. Messages newer than 14 days cannot be bulk deleted by the API.</p>
        </div>
        <div class="card">
          <h3>Roles</h3>
          <p>Requires <code class="inline">Manage Roles</code>. Aegis will not create, delete, or assign roles above its own highest role.</p>
        </div>
        <div class="card">
          <h3>Logging</h3>
          <p>Aegis needs <code class="inline">View Channel</code> and <code class="inline">Send Messages</code> in the log channel you select.</p>
        </div>
        <div class="card">
          <h3>Roles menu / intents</h3>
          <p>Aegis uses the standard privileged intents: <code class="inline">Guilds</code>, <code class="inline">GuildMembers</code>, <code class="inline">GuildMessages</code>, and <code class="inline">MessageContent</code>.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="block">
    <div class="wrap">
      <div class="section-head" style="text-align:left;margin-bottom:2rem">
        <div class="eyebrow">Behaviour</div>
        <h2 style="font-size:1.8rem">Data and privacy</h2>
      </div>
      <div class="grid">
        <div class="card">
          <h3>Per-server storage</h3>
          <p>Configuration, warnings, and automod rules are keyed by guild ID. No data is shared between servers.</p>
        </div>
        <div class="card">
          <h3>Stored data</h3>
          <p>User IDs for warnings and role assignments, message content only when a moderation action deletes it, and channel IDs for log routing.</p>
        </div>
        <div class="card">
          <h3>This website</h3>
          <p>The pages on this site are static. They do not collect data, set cookies, or load third-party trackers.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="block">
    <div class="wrap">
      <div class="cta-box">
        <h2>Still need help?</h2>
        <p>Open a support server ticket and a maintainer will take a look.</p>
        <div class="cta-actions">
          ${cfg.supportUrl ? `<a class="btn lg" href="${cfg.supportUrl}">Join the support server</a>` : ""}
          <a class="btn ghost lg" href="/commands">Command reference</a>
        </div>
      </div>
    </div>
  </section>`;

  return layout({
    title: "Documentation — Aegis",
    description: "Setup guide, permission reference, and data handling for the Aegis Discord bot.",
    path: "/docs",
    body,
    links: NAV,
    inviteUrl: cfg.inviteUrl,
    supportUrl: cfg.supportUrl,
    version: cfg.version,
  });
}

export function renderNotFound(cfg: SiteConfig): string {
  const body = `
  <div class="wrap">
    <div class="page-head" style="text-align:center;padding:7rem 0 4rem">
      <h1>404</h1>
      <p>That page does not exist. Try the <a href="/" style="color:var(--primary)">homepage</a> or browse the <a href="/commands" style="color:var(--primary)">command list</a>.</p>
    </div>
  </div>`;

  return layout({
    title: "Not found — Aegis",
    description: "Page not found.",
    path: "/404",
    body,
    links: NAV,
    inviteUrl: cfg.inviteUrl,
    supportUrl: cfg.supportUrl,
    version: cfg.version,
  });
}
