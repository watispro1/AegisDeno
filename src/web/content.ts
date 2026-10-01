export interface Feature {
  id: string;
  icon: string;
  title: string;
  tagline: string;
  text: string;
  /** "Label: description" pairs, rendered as a checked feature list. */
  points: string[];
  href?: string;
}

export const features: Feature[] = [
  {
    id: "moderation",
    icon: "🔨",
    title: "Moderation",
    tagline: "Enforce rules consistently",
    text: "Every action respects your role hierarchy, records who did what, and writes an entry to your log channel. No silent failures, no ambiguity about why someone was punished.",
    points: [
      "Ban, unban, and softban: remove members permanently, restore them, or kick-and-ban in one step.",
      "Kick: remove a member without a ban record, with a required reason.",
      "Timeout: apply a temporary mute from 60 seconds up to 7 days, chosen from a fixed list of durations.",
      "Remove timeout: lift an active timeout early when a member has cooled off.",
      "Warn: record a formal warning with a reason, viewable in the member's history.",
      "Warnings: review every warning for a member with issuing moderator and timestamp.",
      "Clear warnings: reset a member's warning history to give them a clean slate.",
      "Purge: bulk delete recent messages, with a limit and a 14-day API cutoff respected.",
      "Slowmode: set or clear a per-channel slowmode duration.",
      "Nickname: safely set or clear member nicknames with moderator and bot hierarchy checks.",
    ],
    href: "/docs#permissions",
  },
  {
    id: "automod",
    icon: "🛡️",
    title: "Auto Moderation",
    tagline: "Catch problems in real time",
    text: "Three independent rules inspect every new message before the community reads it. Each is toggled separately, so you enable only what your server needs.",
    points: [
      "Blocked words: case-insensitive matching anywhere in a message, with a per-server word list you control.",
      "Link filtering: catches http and https URLs for channels where links mean spam.",
      "Mention spam: triggers when a message exceeds a mention threshold, defaulting to a short timeout.",
      "Action per rule: choose delete, delete-and-warn, or delete-and-timeout independently for words, links, and mention spam.",
      "Every trigger is logged with the user, rule, action, channel, and the offending content.",
    ],
    href: "/docs#automod",
  },
  {
    id: "logging",
    icon: "📋",
    title: "Audit Logging",
    tagline: "A record you control",
    text: "Log entries are written into a channel you own, not a private database. That means your existing channel permissions and message retention settings apply automatically.",
    points: [
      "Member events: joins and leaves, with account age and join date.",
      "Message events: deletions, captured with author, channel, and content.",
      "Moderation events: every ban, timeout, warn, and purge with moderator attribution.",
      "One channel per server, configurable with a single command that enables logging as it goes.",
    ],
    href: "/docs#logging",
  },
  {
    id: "welcome",
    icon: "👋",
    title: "Welcome & Good-bye",
    tagline: "Make arrivals feel intentional",
    text: "Greet new members with a message you control, in a channel you pick. A live preview lets you check the formatting before anyone sees it.",
    points: [
      "Separate channel selection for welcomes.",
      "Placeholders for user, username, server name, and member count.",
      "Live preview on save, rendered with your own account.",
      "Enable and disable with a single toggle.",
    ],
    href: "/docs#welcome",
  },
  {
    id: "community",
    icon: "🗳️",
    title: "Community",
    tagline: "Give members a voice",
    text: "Tools for structured feedback and clear announcements, so decisions have a visible record rather than living in scrollback.",
    points: [
      "Polls: native Discord polls with configurable options and duration.",
      "Announcements: formatted embeds for official news, with optional ping behaviour.",
      "Suggestions: submit feedback and receive a trackable ID for follow-up.",
    ],
    href: "/commands#community",
  },
  {
    id: "automation",
    icon: "⏰",
    title: "Automation",
    tagline: "Recurring work without a cron job",
    text: "Schedule reminders and recurring posts that survive a restart, so a deploy does not silently cancel your announcements.",
    points: [
      "Compact duration format: 30s, 10m, 2h, or 1d.",
      "Persisted tasks rehydrated on boot, so restarts do not lose them.",
      "List your active tasks with their IDs and relative due times.",
      "Cancel by ID, restricted to your own tasks unless you hold Manage Server.",
    ],
    href: "/docs#automation",
  },
];

export const faqs: { q: string; a: string }[] = [
  {
    q: "What permissions does Aegis need?",
    a: `<p>Only what each command actually uses. Discord hides commands your role cannot run, and the bot re-checks at execution time. Start without administrator access and add permissions only when a feature asks for them.</p>
       <p>The full mapping is on the <a href="/docs#permissions">permissions page</a>.</p>`,
  },
  {
    q: "Is there a web dashboard to log into?",
    a: `<p>No. Everything is configured in Discord with slash commands like <code class="inline">/config</code>, <code class="inline">/logging</code>, and <code class="inline">/automod</code>. This site is informational and has no accounts.</p>`,
  },
  {
    q: "How do warnings work?",
    a: `<p><code class="inline">/warn</code> records a warning against a member with a reason. <code class="inline">/warnings</code> lists their history with the issuing moderator and timestamp. <code class="inline">/clearwarnings</code> resets it.</p>
       <p>Warnings are stored per server and are never visible to another server's moderators.</p>`,
  },
  {
    q: "Can I use Aegis in multiple servers?",
    a: `<p>Yes. Configuration, automod rules, warnings, suggestions, and scheduled tasks are all keyed by guild ID, so nothing bleeds between servers. Each server configures and moderates independently.</p>`,
  },
  {
    q: "What happens if a command is missing from the slash menu?",
    a: `<p>Global commands can take up to an hour to propagate after a deploy. Commands registered to a single guild appear immediately. If a command never appears, confirm the bot was invited with the <code class="inline">applications.commands</code> scope.</p>`,
  },
  {
    q: "Does Aegis work in direct messages?",
    a: `<p>No. Moderation, logging, and configuration commands are server-only by design, because their data is scoped to a guild. The bot does not store DM content.</p>`,
  },
  {
    q: "Is Aegis free?",
    a: `<p>Yes. Aegis is free to add and use. If you want to support development, the support server is the place to do it.</p>`,
  },
];

export const quickstart: { title: string; body: string }[] = [
  {
    title: "Invite Aegis",
    body: `Use the invite link above and pick the server you want to protect. Commands register automatically once the bot connects.`,
  },
  {
    title: "Configure it",
    body: `Run <code class="inline">/config view</code> to see the defaults, then turn on logging, welcomes, and automod one at a time.`,
  },
  {
    title: "Set permissions",
    body: `Move Aegis above the roles it needs to manage, and grant the specific permissions each feature requires.`,
  },
];
