/**
 * Content for the public /features page, by category. Command references are
 * command paths ("warn", "trust user"); the page looks each one up in the real
 * command catalog to print its name and link it, and a test fails if any of
 * them stops existing. Icons are symbols in FEATURE_ICONS (an in-page sprite).
 */

export interface FeatureCard {
  id: string;
  icon: IconId;
  title: string;
  text: string;
  /** Command paths, e.g. "case view". */
  commands: string[];
  /** Dashboard page this lives on, shown as a badge. */
  dashboard?: string;
}

export interface FeatureCategory {
  id: string;
  title: string;
  lead: string;
  cards: FeatureCard[];
}

export type IconId =
  | "shield" | "gavel" | "filter" | "alert" | "gauge" | "people" | "ticket" | "layout" | "pulse"
  | "clock" | "eye" | "chart" | "lock" | "star" | "bell" | "role" | "check" | "mail";

/** 24×24 stroke icons, drawn with currentColor so they follow the theme. */
export const FEATURE_ICONS: Record<IconId, string> = {
  shield: '<path d="M12 3 19 6v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3Z"/>',
  gavel: '<path d="m14 4 6 6M11 7l6 6M8 10l5-5 6 6-5 5zM3 21l7-7"/>',
  filter: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>',
  alert: '<path d="M12 3 2 20h20L12 3Zm0 6v5m0 3v.5"/>',
  gauge: '<path d="M4 16a8 8 0 1 1 16 0M12 16l4-5"/><circle cx="12" cy="16" r="1"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5a3 3 0 0 1 0 6M18 14c2 .7 3 2.6 3 6"/>',
  ticket: '<path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/>',
  layout: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M9 4v16M9 10h12"/>',
  pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  chart: '<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="1"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  star: '<path d="m12 3 2.7 5.6 6.3.9-4.5 4.4 1 6.1L12 17l-5.5 3 1-6.1L3 9.5l6.3-.9z"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/>',
  role: '<path d="M4 7h10l6 5-6 5H4z"/><circle cx="8" cy="12" r="1"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 7 9 6 9-6"/>',
};

/** Headline features for the hero strip. */
export const HEADLINE: Array<{ icon: IconId; title: string; text: string; href: string }> = [
  { icon: "alert", title: "Incident Mode", text: "One switch for raids: slowmode, lockdown, a join gate and paused invites, all undone exactly when it ends.", href: "#incident" },
  { icon: "gauge", title: "Trust Score", text: "An explainable 0–100 score per member, with every factor shown. Opt-in integrations for automod and the join gate.", href: "#trust" },
  { icon: "layout", title: "Web dashboard", text: "Cases, members, settings, analytics and Incident Mode in your browser, with the same permission checks as the commands.", href: "#dashboard" },
];

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    id: "moderation", title: "Moderation", lead: "Careful versions of the basics. Every action checks role hierarchy and becomes a case you can look up later.",
    cards: [
      { id: "actions", icon: "gavel", title: "Warn, timeout, kick and ban", text: "Reason suggestions, proof attachments and an Undo button on reversible actions.", commands: ["warn", "timeout", "kick", "ban", "unban", "removetimeout"], dashboard: "Members" },
      { id: "cases", icon: "chart", title: "Cases and history", text: "Numbered cases with moderator, reason and proof; look them up, edit, export or page through a member's record.", commands: ["case view", "case user", "case export", "modhistory", "infractions"], dashboard: "Cases" },
      { id: "warnings", icon: "bell", title: "Warnings and escalation", text: "Warnings that expire if you want them to, and rules that turn repeat warnings into timeouts or bans.", commands: ["warnings", "clearwarnings", "escalation add", "escalation expiry"], dashboard: "Moderation" },
      { id: "channels", icon: "lock", title: "Channel control", text: "Lock a channel, a category or the whole server with exact restore, set slowmode, and bulk-delete with filters.", commands: ["lock channel", "lock server", "slowmode set", "purge"] },
      { id: "notes", icon: "mail", title: "Staff notes and watchlist", text: "Private notes on members and a Ghost Watch list that alerts staff when a watched member joins or changes roles.", commands: ["note add", "note view", "watchlist add", "watchlist list"], dashboard: "Ghost Watch" },
      { id: "reports", icon: "chart", title: "Reports", text: "Weekly-style moderation reports, per-moderator stats and an activity summary.", commands: ["modreport", "modstats", "activitysummary"], dashboard: "Analytics" },
    ],
  },
  {
    id: "automod", title: "Automod & Safety", lead: "Filters that act before a human has to, with exemptions for the roles and channels you trust.",
    cards: [
      { id: "filters", icon: "filter", title: "Content filters", text: "Blocked words, links and invites, mention spam, message spam and caps floods, each with its own action.", commands: ["automod words add", "automod links toggle", "automod mentions limit", "automod spam limit", "automod caps limit"], dashboard: "Automod" },
      { id: "exempt", icon: "check", title: "Exemptions and presets", text: "Exempt staff roles and channels, or start from a ready-made preset.", commands: ["automod exempt addrole", "preset apply"] },
      { id: "verification", icon: "shield", title: "Verification", text: "Button or captcha verification with an optional kick for members who never verify.", commands: ["verify setup", "verify autokick"], dashboard: "Verification" },
    ],
  },
  {
    id: "incident", title: "Incident Mode", lead: "Raid response in one command, recorded and reversible.",
    cards: [
      { id: "incident-switch", icon: "alert", title: "One switch for raids", text: "Slowmode, lockdown of public or picked channels, a join gate for new accounts and paused invites. Ending it restores exactly what it changed, even after a restart.", commands: ["incident start", "incident end", "incident status"], dashboard: "Incident Mode" },
      { id: "incident-auto", icon: "pulse", title: "Auto-trigger and reports", text: "Optionally starts on a join burst. Every incident keeps a timeline and a report for 90 days.", commands: ["incident auto"], dashboard: "Incident Mode" },
    ],
  },
  {
    id: "trust", title: "Trust Score", lead: "Who is likely fine and who to watch, with the reasons shown. Counts and dates only, never message content.",
    cards: [
      { id: "trust-score", icon: "gauge", title: "Explainable score", text: "Account age, time in the server, verification, activity, cases and warnings by severity and recency, automod hits and join-gate flags, each shown as + or − points.", commands: ["trust user", "trustscore", "userinfo"], dashboard: "Trust Score" },
      { id: "trust-integrations", icon: "role", title: "Opt-in integrations", text: "Link filtering only for low-trust members, a trust threshold for Incident Mode's join gate, and a low-trust role on join. All off until you turn them on.", commands: ["trust config"], dashboard: "Trust Score" },
    ],
  },
  {
    id: "community", title: "Community", lead: "The friendly side of running a server.",
    cards: [
      { id: "welcome", icon: "people", title: "Welcome and goodbye", text: "Messages with embeds, placeholders and a join role that waits for membership screening.", commands: ["welcome channel", "welcome message", "welcome preview"], dashboard: "Welcome & Goodbye" },
      { id: "roles", icon: "role", title: "Role panels", text: "Self-assign roles with buttons or menus, limited to roles below yours and Aegis's.", commands: ["rolepanel create"], dashboard: "Role panels" },
      { id: "engage", icon: "star", title: "Polls, giveaways, starboard, suggestions", text: "Polls, giveaways with rerolls, a starboard for great posts, and a suggestion queue staff can approve or deny.", commands: ["poll", "giveaway start", "starboard setup", "suggest submit"], dashboard: "Giveaways" },
      { id: "automation", icon: "clock", title: "Reminders and scheduled messages", text: "Personal reminders, repeating announcements and autoresponders.", commands: ["remindme set", "automation message", "autoresponder add", "announce", "embed builder"], dashboard: "Scheduled messages" },
    ],
  },
  {
    id: "tickets", title: "Tickets & Appeals", lead: "Private help channels and a fair way back for banned members.",
    cards: [
      { id: "tickets-card", icon: "ticket", title: "Tickets", text: "A ticket panel, claim and rename, add people, and HTML transcripts posted to a log channel when a ticket closes.", commands: ["ticket setup", "ticket claim", "ticket transcript", "ticket settings"], dashboard: "Tickets" },
      { id: "appeals", icon: "mail", title: "Ban appeals", text: "Banned members submit an appeal; staff review it with the case attached.", commands: ["appeal submit", "appeal review"], dashboard: "Appeals" },
    ],
  },
  {
    id: "dashboard", title: "Dashboard", lead: "Everything above, in the browser, for people with Manage Server.",
    cards: [
      { id: "dash-pages", icon: "layout", title: "Settings and modules", text: "Every module's settings, module switches, settings export and import, and a command palette (Ctrl+K).", commands: ["dashboard", "config view"], dashboard: "Settings" },
      { id: "dash-members", icon: "people", title: "Members and quick actions", text: "Look up anyone by name or ID, see their cases, warnings, notes and Trust Score, and act with the same hierarchy rules as the commands.", commands: ["userinfo"], dashboard: "Members" },
    ],
  },
  {
    id: "reliability", title: "Status & Reliability", lead: "Built to be checked, not trusted blindly.",
    cards: [
      { id: "status", icon: "pulse", title: "Public status page", text: "Live bot status and incident notices at /status.", commands: ["ping", "about"] },
      { id: "logging", icon: "eye", title: "Audit logging", text: "Mod actions, joins and leaves, edits and deletions, role and channel changes, each routable to its own channel. Dashboard changes are audited too.", commands: ["logging channel", "logging toggle", "logging test"], dashboard: "Logging" },
      { id: "diagnostics", icon: "check", title: "Diagnostics", text: "Checks how Aegis is set up in your server and says what to fix.", commands: ["diagnostics", "help"] },
    ],
  },
];

/** Why Aegis, compared with doing it by hand or with a typical bot. */
export const WHY_ROWS: Array<[string, string, string]> = [
  ["Undo a raid lockdown exactly", "Yes: every change is recorded and restored", "Usually manual"],
  ["See why a member is flagged", "Yes: Trust Score lists every factor", "Rarely"],
  ["Role hierarchy enforced everywhere", "Commands and dashboard use the same rule", "Varies"],
  ["Never pings @everyone by accident", "Mentions are off unless a feature needs one", "Varies"],
  ["Trust Score reads message content", "No: counts and timestamps only", "Often, for similar scores"],
];
