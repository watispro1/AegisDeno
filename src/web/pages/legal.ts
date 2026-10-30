import { REPO_URL } from "../layout";
import { DASHBOARD_VERSION } from "../../version";
import { type SiteConfig, breadcrumb, escapeHtml, page, safeUrl } from "./shared";

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
