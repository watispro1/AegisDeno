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
    id: "tickets",
    icon: "🎫",
    title: "Support Ticket System",
    tagline: "Private support channel workflow",
    text: "Create custom ticket panels with interactive buttons. Aegis automatically provisions private ticket channels with granular permission overwrites, staff role tagging, claiming, and full TXT transcript generation.",
    points: [
      "Panel setup: post interactive button panels into support channels with optional staff role assignment.",
      "Single-open ticket rule: duplicate ticket creation and concurrent button double-clicks are automatically guarded.",
      "Staff claiming: staff members can claim responsibility for open support tickets.",
      "Member management: add or remove server members dynamically inside active ticket channels.",
      "Transcripts export: generate structured text transcripts of ticket conversation history on demand.",
      "Clean teardown: auto-archives ticket channels 5 seconds after close with complete audit logging.",
    ],
    href: "/docs#tickets",
  },
  {
    id: "verification",
    icon: "🛡️",
    title: "Anti-Raid Verification",
    tagline: "Secure entry gates for new members",
    text: "Protect your server against self-bots and raid waves using button or CAPTCHA verification challenges. Unverified members remain isolated until completing verification.",
    points: [
      "Custom modal configuration: customize panel title and instructions with modal input forms.",
      "Challenge modes: choose between instant 1-click button verification or visual CAPTCHA verification.",
      "Auto-role grant: automatically assigns verified member roles upon successful verification.",
      "Duplicate cleanup: re-running setup automatically cleans up old verification panels from the target channel.",
      "Audit tracking: logs every verification attempt and role assignment directly to your logging channel.",
    ],
    href: "/docs#verification",
  },
  {
    id: "roles",
    icon: "🎭",
    title: "Interactive Role Panels",
    tagline: "Self-serve button reaction roles",
    text: "Design self-assignable role panels with interactive buttons. Members can toggle custom roles on and off instantly without reaction emojis or complex bot commands.",
    points: [
      "Multi-role panels: attach up to 5 custom roles per panel with unique labels and button styles.",
      "Modal creation form: fill out panel titles, descriptions, and button labels interactively.",
      "Instant toggle: clicking a role button adds or removes the role and sends an ephemeral status response.",
      "Panel lifecycle: deleting a role panel from the database automatically removes the message from Discord.",
    ],
    href: "/docs#roles",
  },
  {
    id: "moderation",
    icon: "🔨",
    title: "Moderation & Audit Control",
    tagline: "Enforce server guidelines consistently",
    text: "Every moderation action checks role hierarchy, records formal case logs with timestamps, and notifies the audit channel. Moderation history is tracked per member.",
    points: [
      "Ban, unban, and softban: remove members permanently, lift bans, or clear recent messages in one step.",
      "Kick: remove a member with audit logging and required reason prompt.",
      "Timeout & Untimeout: apply temporary mutes (60s to 7 days) or remove active timeouts early.",
      "Warn system: issue formal warnings with low/medium/high severity levels, view history, or clear warnings.",
      "Purge filters: bulk delete messages with preview, progress tracking, and filters (bots, humans, links, images, keyword).",
      "Channel lockdown: instantly lock or unlock text channels to stop raid escalation.",
    ],
    href: "/docs#permissions",
  },
  {
    id: "automod",
    icon: "🤖",
    title: "Auto Moderation",
    tagline: "Real-time threat filtering",
    text: "Automated filters inspect messages before community members read them. Configure blocked keywords, link shielding, and mention spam filters independently.",
    points: [
      "Blocked words: case-insensitive keyword matching with per-server custom block lists.",
      "Link filtering: shields channels against unauthorized Discord invites and external links.",
      "Mention spam: automatically timeouts users who exceed configurable mention thresholds.",
      "Flexible actions: select delete, warn, or timeout actions independently per filter rule.",
      "Exemptions: configure exempt roles and channels to bypass AutoMod filters.",
    ],
    href: "/docs#automod",
  },
  {
    id: "logging",
    icon: "📋",
    title: "Audit Logging",
    tagline: "Comprehensive channel audit stream",
    text: "Write audit events into a Discord text channel under your server's retention and privacy control. No external third-party storage needed.",
    points: [
      "Member events: logs member join and leave events with account creation timestamps.",
      "Message events: captures deleted messages with author, channel, and snippet context.",
      "Moderation events: records every ban, timeout, warning, kick, and purge action.",
      "Single command setup: enable and configure logging with a single command.",
    ],
    href: "/docs#logging",
  },
  {
    id: "suggestions",
    icon: "💡",
    title: "Community Suggestions",
    tagline: "Structured member feedback",
    text: "Empower members to submit server suggestions with interactive upvote and downvote buttons. Staff can approve, consider, or reject suggestions with visible status badges.",
    points: [
      "Interactive voting: members can vote and toggle their upvotes or downvotes in real-time.",
      "Status updates: staff members can mark suggestions as approved, under consideration, or rejected.",
      "Trackable IDs: every suggestion receives a unique UUID for clear reference.",
    ],
    href: "/docs#suggestions",
  },
  {
    id: "automation",
    icon: "⏰",
    title: "Scheduled Reminders & Tasks",
    tagline: "Persistent background automation",
    text: "Schedule reminders and channel announcements that survive bot restarts. Tasks are rehydrated on boot from database storage.",
    points: [
      "Compact duration format: 30s, 10m, 2h, 1d, or custom interval strings.",
      "Task management: list active tasks and cancel by ID.",
      "Recurring messages: post scheduled messages on repeating intervals.",
    ],
    href: "/docs#automation",
  },
];

export const faqs: { q: string; a: string }[] = [
  {
    q: "How does the Ticket System prevent duplicate tickets?",
    a: `<p>Aegis enforces a single open ticket rule per user in a guild. Additionally, double-clicking ticket buttons is guarded by an in-memory concurrency lock, preventing duplicate channel creation. Re-running <code class="inline">/ticket setup</code> automatically purges old panel embeds from the channel.</p>`,
  },
  {
    q: "How do Anti-Raid Verification and Role Panels work?",
    a: `<p>Server admins use modal forms via <code class="inline">/verify setup</code> or <code class="inline">/rolepanel create</code> to customize embeds and action buttons. Members click buttons to verify or toggle roles instantly with zero emoji reaction clutter.</p>`,
  },
  {
    q: "What permissions does Aegis require?",
    a: `<p>Aegis only requires permissions for features you enable. Discord natively checks role hierarchy and hides unauthorized slash commands. Full mappings are documented on the <a href="/docs#permissions">permissions page</a>.</p>`,
  },
  {
    q: "Can Aegis be used across multiple servers?",
    a: `<p>Yes. All settings, warnings, ticket records, verification states, and AutoMod rules are strictly isolated by guild ID.</p>`,
  },
  {
    q: "Is Aegis free?",
    a: `<p>Yes. Aegis is completely free to add and use across all your Discord servers.</p>`,
  },
];

export const quickstart: { title: string; body: string }[] = [
  {
    title: "1. Add Aegis to Discord",
    body: `Click the invite link above and select your Discord server. Slash commands register automatically upon connection.`,
  },
  {
    title: "2. Set Up Audit Logging",
    body: `Run <code class="inline">/logging channel #mod-logs</code> to designate an audit channel for member joins, deletions, and mod cases.`,
  },
  {
    title: "3. Post Ticket & Verification Panels",
    body: `Use <code class="inline">/ticket setup</code> to deploy support ticket panels, and <code class="inline">/verify setup</code> for anti-raid member verification.`,
  },
  {
    title: "4. Enable AutoMod Safeguards",
    body: `Run <code class="inline">/automod words toggle enabled:true</code> and <code class="inline">/automod links toggle enabled:true</code> to shield text channels.`,
  },
];
