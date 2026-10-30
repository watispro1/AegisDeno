import { REPO_URL } from "../layout";
import { faqs } from "../content";
import { type SiteConfig, breadcrumb, cmdBlock, escapeHtml, faqBlock, page, safeUrl } from "./shared";
import { SUBCOMMAND_CHECKS, botPermissionTable, docHeading, docToc, permissionTable } from "./docsData";

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
