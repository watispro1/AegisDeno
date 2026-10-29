/**
 * Copy for the features page and home page. Keep it factual: every claim here
 * should be traceable to a command in src/commands.
 */
export interface Feature {
  id: string;
  title: string;
  /** One line used in the home page reference table. */
  short: string;
  /** Paragraph shown at the top of the feature's section. */
  text: string;
  points: string[];
  /** [example invocation, what it does] */
  commands: [string, string][];
  /** The first command you would run, shown on the home page. */
  start: string;
  /** Anchor on /docs with the setup details. */
  docs?: string;
}

export const features: Feature[] = [
  {
    id: "moderation",
    start: "/warn",
    title: "Moderation and cases",
    short: "Warn, timeout, kick and ban. Every action becomes a numbered case you can look up later.",
    text: "The basics, done carefully. Each command checks role hierarchy before it acts, asks for confirmation on the destructive ones, and writes a case with the moderator, target, reason and time. Warnings carry a severity, and escalation rules can turn repeat warnings into timeouts or bans automatically.",
    points: [
      "Reason suggestions on /warn, /timeout and /ban (Spam, NSFW, Harassment, Advertising, Raiding, Other), or type your own.",
      "Attach a screenshot with proof: and it is stored with the case.",
      "An Undo button on /warn, /timeout and /ban for five minutes; undoing reverses the action and marks the case revoked.",
      "Timeouts from 60 seconds to one week; /removetimeout lifts one early.",
      "/purge deletes up to 500 messages with filters for bots, humans, links, images, a user or text, skips pinned messages and anything over Discord's 14-day limit, and shows a preview first.",
      "/lock for a channel or a whole category, with an optional message and timed unlock; /slowmode for when a channel gets out of hand.",
      "/case view, /case user (with Prev/Next pages), /case edit and /case export (capped at 5,000 records) for the paper trail.",
      "Escalation can ignore warnings older than a set number of days.",
      "Warnings, cases and staff notes expire after one year.",
    ],
    commands: [
      ["/warn user:@member reason:Posting invite links severity:Medium", "Formal warning, logged as a case"],
      ["/timeout user:@member duration:1 hour", "Mute for an hour"],
      ["/ban user:@member reason:Raid account delete_messages:1", "Ban and clear a day of messages"],
      ["/infractions user:@member", "Warnings and cases on one page"],
      ["/escalation add warnings:3 action:Timeout duration:60", "Third warning becomes a 60-minute timeout"],
      ["/escalation expiry days:30", "Only warnings from the last 30 days count"],
    ],
    docs: "moderation",
  },
  {
    id: "automod",
    start: "/automod status",
    title: "Automod",
    short: "Filters for blocked words, invite links, mention spam, message spam and caps.",
    text: "Each filter is switched on separately and has its own action: delete, warn or timeout. Staff roles and channels can be exempted so the filters stay out of your moderators' way.",
    points: [
      "Blocked word list per server, matched case-insensitively.",
      "Link filter for Discord invites and other URLs.",
      "Mention, spam-rate and caps-percentage limits you set yourself.",
      "Exempt roles and channels with /automod exempt.",
    ],
    commands: [
      ["/automod status", "Show every filter and its action"],
      ["/automod words add word:free nitro", "Block a phrase"],
      ["/automod links toggle enabled:true", "Turn on the link filter"],
      ["/automod mentions limit count:5", "Act on 5+ mentions in one message"],
      ["/automod exempt addrole role:@Staff", "Let staff through"],
    ],
    docs: "automod",
  },
  {
    id: "trustscore",
    start: "/trustscore",
    title: "Trust score",
    short: "A 0 to 100 number for a member, from account age, time in the server, their record and how active they are.",
    text: "Useful before you hand out a role or approve someone who looks off. The score is simple arithmetic and the embed lists why, biggest factor first, so you can see where a member landed and what drove it.",
    points: [
      "Account age: up to 25 points, reached at two years old.",
      "Time in the server: up to 25 points, reached at one year.",
      "Long-tenure bonus: 6 points at 180 days, 12 at a year, 20 at two years.",
      "Minus 5 per active warning (capped at 30) and minus 4 per timeout, kick or ban (capped at 20). Undone actions don't count.",
      "Message activity: up to 10 points for message count and 5 for being active in the last week. Only a count and last-active time are kept, never message content.",
      "Bands: 80+ trusted, 60+ established, 40+ caution, 20+ elevated risk, below 20 high risk.",
      "Replies privately by default.",
    ],
    commands: [
      ["/trustscore user:@member", "Score and breakdown, visible only to you"],
    ],
    docs: "trustscore",
  },
  {
    id: "appeal",
    start: "/appeal review",
    title: "Ban appeals",
    short: "Banned members get a code by DM and can appeal from Discord. Approving one lifts the ban.",
    text: "When you ban someone, Aegis DMs them an appeal code like AGS-K7X2. From any other server Aegis is in, they file the appeal with that code through a Discord form, it lands in a queue, and staff approve or deny it. Approval unbans them and tells them so. No external form, no separate inbox.",
    points: [
      "Codes are created on every /ban where the DM can be delivered.",
      "Anyone can run /appeal submit; reviewing needs Ban Members.",
      "Decisions and reviewer notes are stored with the appeal.",
    ],
    commands: [
      ["/appeal submit code:AGS-K7X2", "Member files an appeal"],
      ["/appeal list status:Pending", "See what is waiting"],
      ["/appeal review code:AGS-K7X2 decision:Approve", "Approve and unban"],
    ],
    docs: "appeal",
  },
  {
    id: "watchlist",
    start: "/watchlist add",
    title: "Watchlist",
    short: "Quietly watch a member. You get a DM when they post, edit, delete, join voice, join, leave or change roles.",
    text: "For the account that has not broken a rule yet but probably will. The member is not told. Alerts go to the moderator who added the watch, and optionally to a staff channel.",
    points: [
      "Durations: 1 hour, 6 hours, 24 hours, 7 days or until removed.",
      "Pick the events: everything, messages only, join and leave, role changes, voice joins, or just their first message of the day plus voice joins.",
      "Add alert_channel: to also post alerts in a staff channel.",
      "Alerts include before and after text for edits.",
    ],
    commands: [
      ["/watchlist add user:@member duration:24 Hours events:Messages Only", "Start watching"],
      ["/watchlist info user:@member", "Expiry, events and alert count"],
      ["/watchlist remove user:@member", "Stop watching"],
    ],
    docs: "watchlist",
  },
  {
    id: "modreport",
    start: "/modreport",
    title: "Mod reports",
    short: "A digest of the last day or week: actions taken, repeat offenders, staff activity, automod hits.",
    text: "Run it before a staff meeting or when you want to know whether last week was as bad as it felt. The report is one embed with four views you switch between with buttons.",
    points: [
      "Overview, top offenders, staff activity and automod rules.",
      "/modstats gives a per-moderator view of the same data.",
    ],
    commands: [
      ["/modreport period:Last 7 Days", "Last seven days"],
      ["/modstats", "Per-moderator activity"],
    ],
    docs: "modreport",
  },
  {
    id: "logging",
    start: "/logging channel",
    title: "Logging",
    short: "Joins, leaves, deleted messages and every moderation action, posted to a channel you choose.",
    text: "Logs go to a channel in your own server, so they follow your retention settings and nobody needs another login to read them.",
    points: [
      "Member joins and leaves with account creation date.",
      "Deleted messages with author and channel.",
      "Bans, kicks, timeouts, warnings and purges.",
    ],
    commands: [
      ["/logging channel channel:#mod-log", "Pick the log channel"],
      ["/logging test", "Post a test entry"],
    ],
    docs: "logging",
  },
  {
    id: "tickets",
    start: "/ticket setup",
    title: "Tickets",
    short: "A button that opens a private channel between a member and your staff.",
    text: "Post a panel, members click it, and Aegis creates a channel only they and your staff role can see. One open ticket per member, so the queue does not fill with duplicates.",
    points: [
      "Staff can claim a ticket with a button, so everyone can see who is handling it.",
      "HTML transcript on close, posted to your ticket log channel and sent to the member by DM.",
      "Tickets with no messages for 48 hours close on their own (configurable, or off).",
      "Closing a ticket deletes its channel shortly after and logs the close.",
    ],
    commands: [
      ["/ticket setup channel:#support staff_role:@Staff", "Post the panel"],
      ["/ticket claim", "Take ownership"],
      ["/ticket transcript", "Export the conversation"],
      ["/ticket close reason:solved", "Close it"],
      ["/ticket settings log_channel:#ticket-logs autoclose_hours:48", "Transcripts and auto-close"],
    ],
    docs: "tickets",
  },
  {
    id: "verification",
    start: "/verify setup",
    title: "Verification",
    short: "New members press a button or solve a captcha before they get the verified role.",
    text: "A simple gate for raids and throwaway accounts. Unverified members only see the verify channel; passing the check grants the role you picked.",
    points: [
      "Button or captcha mode; captcha asks a small math question in a pop-up.",
      "Optional auto-kick for members who stay unverified, off by default.",
      "Re-running setup removes the old panel.",
      "Staff can verify someone manually with /verify user.",
    ],
    commands: [
      ["/verify setup channel:#verify verified_role:@Member type:CAPTCHA Verification", "Post the gate"],
      ["/verify user target:@member", "Verify by hand"],
      ["/verify autokick minutes:30", "Kick if unverified"],
    ],
    docs: "verification",
  },
  {
    id: "community",
    start: "/starboard setup",
    title: "Community tools",
    short: "Starboard, giveaways, polls, suggestions, welcome messages and role panels.",
    text: "The things most servers end up wanting once moderation is sorted. All of them use buttons rather than reactions where Discord allows it.",
    points: [
      "Starboard with your own emoji, threshold and ignored channels. Self-stars never count, and images and attachments carry over.",
      "Giveaways up to 30 days long, with role requirements, bonus entries for server boosters, up to 20 winners, early end and a Reroll button.",
      "Polls with up to 10 options, anonymous and multi-select modes, live result bars, and timed auto-close that posts results.",
      "Suggestions with voting and Approve, Consider or Deny buttons; the author gets a DM with the reason.",
      "Role panels with up to three roles each, as buttons or a dropdown, with optional pick-only-one and required-role rules.",
      "Welcome messages with {user}, {username}, {server} and {count} placeholders, plus a preview.",
    ],
    commands: [
      ["/starboard setup channel:#starboard", "Turn on the starboard"],
      ["/giveaway start prize:Nitro duration:24h winners:1", "Run a giveaway"],
      ["/poll question:Movie night? option1:Fri option2:Sat", "Ask the server"],
      ["/rolepanel create channel:#roles role1:@Events", "Self-assign roles"],
    ],
    docs: "community",
  },
  {
    id: "automation",
    start: "/remindme",
    title: "Reminders and schedules",
    short: "Personal reminders, one-off posts and repeating messages that survive restarts.",
    text: "Tasks are stored in the database and restored when the bot starts, so a restart does not lose next week's announcement.",
    points: [
      "Durations like 30s, 10m, 2h or 1d.",
      "Personal reminders can repeat daily or weekly and be snoozed from the DM.",
      "List and cancel tasks by ID.",
    ],
    commands: [
      ["/remindme set reminder:Check the appeal queue duration:2h", "DM yourself later"],
      ["/automation repeat interval:1d channel:#general message:...", "Daily post"],
      ["/automation list", "See scheduled tasks"],
    ],
    docs: "automation",
  },
];

export const faqs: { q: string; a: string }[] = [
  {
    q: "Is it free?",
    a: `<p>Yes. There is no paid tier.</p>`,
  },
  {
    q: "What permissions does it ask for?",
    a: `<p>Only the ones its commands use. The invite link is built from each command's declared bot permissions, and Administrator is never requested. The full list is in the <a href="/docs#permissions">permissions table</a>.</p>`,
  },
  {
    q: "Is there a web dashboard?",
    a: `<p>Yes, at <a href="/dashboard">/dashboard</a>. Log in with Discord to see moderation cases, edit or revoke them (and unban when revoking a ban), review ban appeals, post the ticket, verification and role panels, and change logging, escalation, automod (word list and exemptions included), welcome, ticket, verification and starboard settings. An Activity page shows who changed what. It only lists servers where you have Manage Server or Administrator, and it re-checks that permission on every page. Slash commands still do everything the dashboard does, and more.</p>`,
  },
  {
    q: "Is data shared between servers?",
    a: `<p>No. Settings, warnings, cases, tickets and rules are stored per server ID. Warnings, cases and staff notes are deleted automatically after a year. Details are in the <a href="/privacy">privacy policy</a>.</p>`,
  },
  {
    q: "Commands are not showing up. What now?",
    a: `<p>Check that the bot was invited with the <code class="inline">applications.commands</code> scope, then restart your Discord client. The <a href="/troubleshooting">troubleshooting page</a> covers the other usual causes.</p>`,
  },
];

export const quickstart: { title: string; body: string; cmd: string }[] = [
  {
    title: "Invite the bot",
    body: `Use the Add to Discord link and pick your server. Slash commands register on join.`,
    cmd: "",
  },
  {
    title: "Pick a log channel",
    body: `Moderation actions, joins, leaves and deleted messages go here.`,
    cmd: "/logging channel channel:#mod-log",
  },
  {
    title: "Turn on the filters you want",
    body: `Start with links and blocked words; add the rest later.`,
    cmd: "/automod links toggle enabled:true\n/automod words toggle enabled:true",
  },
  {
    title: "Check the setup",
    body: `Diagnostics lists missing permissions and role-order problems.`,
    cmd: "/diagnostics",
  },
];
