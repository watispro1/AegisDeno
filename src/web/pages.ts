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
      <p style="text-align:center;margin-top:2rem;color:var(--muted);font-size:0.88rem">
        By adding Aegis to a server you accept the <a href="/terms" style="color:#a5b4fc">Terms of Service</a> and <a href="/privacy" style="color:#a5b4fc">Privacy Policy</a>.
      </p>
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

const EFFECTIVE_DATE = "September 29, 2026";
const CONTACT_EMAIL = "support@aegisbot.dev";

export function renderTerms(cfg: SiteConfig): string {
  const body = `
  <div class="wrap">
    <div class="page-head">
      <h1>Terms of Service</h1>
      <p>These terms govern your use of the Aegis Discord bot and this website. By adding Aegis to a server or using this site, you agree to them.</p>
      <p style="margin-top:0.75rem;font-size:0.85rem">Effective date: ${EFFECTIVE_DATE}</p>
    </div>
  </div>

  <section class="block" style="padding-top:1rem">
    <div class="wrap">
      <div class="legal">
        <h2>1. Acceptance of terms</h2>
        <p>These Terms of Service ("Terms") form a binding agreement between you and the Aegis maintainers ("we", "us"). If you do not agree with these Terms, do not invite Aegis to your server or otherwise use the service.</p>

        <h2>2. What Aegis is</h2>
        <p>Aegis is a software service delivered as a Discord application. It provides moderation, auto moderation, audit logging, welcome messaging, community, and automation tooling. Aegis is not affiliated with, endorsed by, or sponsored by Discord Inc.</p>

        <h2>3. Eligibility and account responsibility</h2>
        <p>You must meet Discord's minimum age requirement to use Discord, and therefore to use Aegis. You are responsible for all activity that occurs under your Discord account, including any action taken by Aegis that you or your server's moderators trigger.</p>

        <h2>4. Acceptable use</h2>
        <p>You agree not to use Aegis to:</p>
        <ul>
          <li>Violate Discord's Terms of Service or Community Guidelines.</li>
          <li>Abuse, harass, threaten, or target any person, group, or Discord platform.</li>
          <li>Conduct automated spam, mass mentions, or unsolicited advertising through the bot.</li>
          <li>Attempt to gain unauthorized access to the service, its host, or its data.</li>
          <li>Interfere with, overload, or disrupt the service or its infrastructure.</li>
          <li>Use the service to store or process content that is unlawful in your jurisdiction.</li>
        </ul>

        <h2>5. Server permissions and responsibility</h2>
        <p>Aegis acts strictly under the permissions and authority granted to it by each server. You are solely responsible for:</p>
        <ul>
          <li>Reviewing the permission list on the OAuth2 authorization screen before inviting Aegis.</li>
          <li>Placing Aegis' role at an appropriate height in your server's role hierarchy.</li>
          <li>Configuring moderation rules, blocked word lists, and log channels.</li>
          <li>Reviewing and appealing moderation actions taken by your moderators.</li>
        </ul>
        <p>Aegis is a tool. Decisions about who to punish, and how, remain with your server's moderation team.</p>

        <h2>6. Availability</h2>
        <p>The service is provided "as is" and "as available". We do not guarantee uninterrupted, timely, or error-free operation. Scheduled maintenance, upstream Discord API changes, network failures, and force majeure events may cause downtime. The <a href="/health">status endpoint</a> reflects current availability but is not a service level agreement.</p>

        <h2>7. Intellectual property</h2>
        <p>Aegis, including its source code, name, branding, and documentation, is owned by the maintainers and protected by applicable intellectual property law. These Terms grant you a limited, revocable, non-exclusive, non-transferable license to use the service as intended. Reverse engineering, reselling, or redistributing the service is not permitted.</p>

        <h2>8. Third-party services</h2>
        <p>Aegis depends on Discord, and may depend on infrastructure providers such as Fly.io. Your use of those services is governed by their own terms, over which we have no control. We are not responsible for the content, availability, or practices of any third party.</p>

        <h2>9. Disclaimer of warranties</h2>
        <p>To the maximum extent permitted by law, the service is provided without warranties of any kind, whether express or implied, including implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement. We do not warrant that the service will be uninterrupted, secure, or error-free.</p>

        <h2>10. Limitation of liability</h2>
        <p>To the maximum extent permitted by law, the maintainers shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, data, goodwill, or server activity, arising out of or related to your use of the service. This includes losses resulting from misconfigured automod rules, unintended moderation actions, or reliance on the service as your sole moderation safeguard.</p>
        <p>Where liability cannot be excluded by law, it is limited to the greater of the amount you paid for the service (which is zero) or USD 50.</p>

        <h2>11. Indemnification</h2>
        <p>You agree to indemnify and hold harmless the maintainers from any claim or demand, including reasonable legal fees, arising from your use of the service, your violation of these Terms, or your violation of Discord's policies.</p>

        <h2>12. Modifications</h2>
        <p>We may update these Terms to reflect changes in the service or applicable law. The effective date at the top of this page indicates the current version. Continuing to use Aegis after an update constitutes acceptance of the revised Terms.</p>

        <h2>13. Termination</h2>
        <p>You may stop using Aegis at any time by removing it from your server. We may suspend or terminate access, with or without notice, if you breach these Terms, if required by law, or if continued operation poses a security or abuse risk. Terminating access does not delete data already stored; see the <a href="/privacy">Privacy Policy</a> for retention.</p>

        <h2>14. Severability and governing law</h2>
        <p>If any provision of these Terms is found unenforceable, the remaining provisions remain in effect. These Terms are governed by the laws applicable in the maintainers' principal place of operation, without regard to conflict of law rules. Any dispute will be handled through good-faith negotiation, and where that fails, through the courts of that jurisdiction.</p>

        <h2>15. Contact</h2>
        <p>Questions about these Terms can be raised on our <a href="${cfg.supportUrl || "#"}">support server</a> or by email at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
      </div>
    </div>
  </section>`;

  return layout({
    title: "Terms of Service — Aegis",
    description: "Terms governing use of the Aegis Discord bot and this website.",
    path: "/terms",
    body,
    links: NAV,
    inviteUrl: cfg.inviteUrl,
    supportUrl: cfg.supportUrl,
    version: cfg.version,
  });
}

export function renderPrivacy(cfg: SiteConfig): string {
  const body = `
  <div class="wrap">
    <div class="page-head">
      <h1>Privacy Policy</h1>
      <p>What Aegis collects, why it collects it, and what it never does with it.</p>
      <p style="margin-top:0.75rem;font-size:0.85rem">Effective date: ${EFFECTIVE_DATE}</p>
    </div>
  </div>

  <section class="block" style="padding-top:1rem">
    <div class="wrap">
      <div class="legal">
        <h2>1. Summary</h2>
        <p>Aegis stores the minimum needed to run moderation and logging in each server. It does not build advertising profiles, it does not sell data, and it does not share data between servers. This website sets no cookies and runs no trackers.</p>

        <h2>2. Who is responsible</h2>
        <p>The Aegis maintainers operate the service. Individual Discord servers that invite Aegis are separate controllers of the data they configure Aegis to process, and their own privacy policies apply to their members.</p>

        <h2>3. Data we collect</h2>
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
          <li>Process memory usage, uptime, and gateway latency, used for status reporting on this site.</li>
          <li>Server logs containing error messages, used to diagnose faults.</li>
        </ul>

        <h2>4. What we do not collect</h2>
        <ul>
          <li>Direct messages. Aegis is not built to act in DMs and does not store their contents.</li>
          <li>Passwords, payment details, or any Discord account credentials. Aegis only ever holds its own bot token.</li>
          <li>Advertising identifiers, cross-site tracking data, or behavioural profiles.</li>
          <li>Data harvested from servers where Aegis has not been invited.</li>
        </ul>

        <h2>5. How data is used</h2>
        <ul>
          <li>To execute the moderation, logging, and automation features a server has enabled.</li>
          <li>To maintain guild, member, and channel caches required for role hierarchy checks and routing.</li>
          <li>To detect and respond to abuse, including rate limit and permission errors.</li>
          <li>To publish aggregate counts on the homepage, such as total servers and total members.</li>
        </ul>
        <p>Your data is never used for advertising, profiling, or model training.</p>

        <h2>6. Website privacy</h2>
        <p>The pages on this site are static and self-contained. They set no cookies, embed no analytics or advertising scripts, and transmit nothing about you to us. The only personal data this site processes is standard web server request logs, such as IP address and user agent, retained briefly for security and diagnostics. The <a href="/health">status endpoint</a> returns bot metrics only and holds no requester data.</p>

        <h2>7. Data retention</h2>
        <ul>
          <li><strong>Configuration and automod rules:</strong> retained while Aegis is in the server, then deleted on removal or after a defined period.</li>
          <li><strong>Warnings:</strong> retained until a moderator clears them with <code class="inline">/clearwarnings</code>, or until Aegis is removed.</li>
          <li><strong>Audit log entries:</strong> written to your own Discord channel and governed by your message retention settings; we do not keep a separate copy.</li>
          <li><strong>Operational logs:</strong> retained for a short period for debugging, then discarded.</li>
        </ul>

        <h2>8. Data isolation between servers</h2>
        <p>All stored records are keyed by guild ID. Configuration, warnings, and rules in one server are never visible to, or mixed with, another server. This isolation is enforced in the application layer and is a design requirement, not a configuration option.</p>

        <h2>9. Sharing and disclosure</h2>
        <p>We do not sell, rent, or trade your data. We disclose data only in these cases:</p>
        <ul>
          <li>To Discord, as required to operate the service. Discord receives commands, messages, and member events under its own privacy policy.</li>
          <li>To infrastructure providers, such as Fly.io, strictly to host and run the service under our instructions.</li>
          <li>When required by law, or in good faith to protect the rights, safety, and integrity of the service, its users, or the public.</li>
        </ul>

        <h2>10. Security</h2>
        <p>Secrets are held in environment variables and are never written to source control, logs, or this website. Access to production systems is limited to the maintainers. No system is perfectly secure, so we do not claim that data held in connection with the service can be guaranteed breach-free.</p>

        <h2>11. Your rights</h2>
        <p>Because the relevant data is largely held by Discord servers rather than by us, most requests are best directed at the server operator. A server moderator can remove data by clearing warnings, resetting configuration, or removing Aegis entirely. If you are a Discord user and want data removed concerning you, contact the operator of the relevant server, or reach us and we will assist where the data sits with us.</p>

        <h2>12. Children</h2>
        <p>The service is not directed at children under Discord's minimum age, and we do not knowingly collect personal information from them.</p>

        <h2>13. International transfers</h2>
        <p>The service is hosted on infrastructure that may be located outside your country. By using it you consent to the transfer and processing of data in those locations under the safeguards described here.</p>

        <h2>14. Changes to this policy</h2>
        <p>We may revise this policy as the service changes. The effective date at the top of this page indicates the current version, and material changes will be announced in the support server.</p>

        <h2>15. Contact</h2>
        <p>Privacy questions and data requests can go to our <a href="${cfg.supportUrl || "#"}">support server</a> or to <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
      </div>
    </div>
  </section>`;

  return layout({
    title: "Privacy Policy — Aegis",
    description: "What data the Aegis Discord bot collects, how it is used, and how it is retained.",
    path: "/privacy",
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
