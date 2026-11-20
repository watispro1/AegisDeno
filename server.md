# Aegis Support & Community Server Manual

> Official architecture guide, operational manual, and configuration blueprint for the **Aegis Support & Community** Discord server (`v3.15.0`). Covers role hierarchy, permission boundaries, comprehensive channel architecture and descriptions, copy-paste topics, complete bot automation commands, and staff operating procedures.

---

## Table of Contents

1. [Server Foundation & Community Settings](#1-server-foundation--community-settings)
2. [Role Hierarchy & Specifications](#2-role-hierarchy--specifications)
3. [Global Permissions Matrix](#3-global-permissions-matrix)
4. [Category & Channel Architecture](#4-category--channel-architecture)
5. [Channel Reference & Descriptions](#5-channel-reference--descriptions)
   - [5.1 📌 Information & Welcome](#51--information--welcome)
   - [5.2 🛡️ Verification & Roles](#52-️-verification--roles)
   - [5.3 💬 Community Chat](#53--community-chat)
   - [5.4 🧪 Testing & Playground](#54--testing--playground)
   - [5.5 🎫 Support & Tickets](#55--support--tickets)
   - [5.6 💡 Feedback & Bugs](#56--feedback--bugs)
   - [5.7 🔐 Staff Command & Audit](#57--staff-command--audit)
   - [5.8 🔊 Voice Lounges](#58--voice-lounges)
   - [5.9 Channel Conventions](#59-channel-conventions)
   - [5.10 What Aegis Posts Where](#510-what-aegis-posts-where)
   - [5.11 Forum Architecture & Tag Workflows](#511-forum-architecture--tag-workflows)
   - [5.12 Discord Community Onboarding & Server Guide](#512-discord-community-onboarding--server-guide)
6. [Channel Permissions Breakdown](#6-channel-permissions-breakdown)
7. [Official Aegis Bot Setup & Integration](#7-official-aegis-bot-setup--integration)
   - [7.1 Setup Order](#71-setup-order)
   - [7.2 General Configuration & Audit Logging Setup](#72-general-configuration--audit-logging-setup)
   - [7.3 Verification Gate & Screening](#73-verification-gate--screening)
   - [7.4 Role Selection Panels (Opt-In Pings)](#74-role-selection-panels-opt-in-pings)
   - [7.5 Support Ticket System & Transcripts](#75-support-ticket-system--transcripts)
   - [7.6 Welcome & Orientation System](#76-welcome--orientation-system)
   - [7.7 Community Suggestions System](#77-community-suggestions-system)
   - [7.8 Starboard Highlights & Pinning](#78-starboard-highlights--pinning)
   - [7.9 Comprehensive Automod & Safety Shield](#79-comprehensive-automod--safety-shield)
   - [7.10 Automated Escalation Ladder](#710-automated-escalation-ladder)
   - [7.11 Advanced Staff Command Suite](#711-advanced-staff-command-suite)
   - [7.12 Economy & Gamification Playground](#712-economy--gamification-playground)
8. [Staff Standard Operating Procedures (SOP)](#8-staff-standard-operating-procedures-sop)
9. [Incident Response Playbooks](#9-incident-response-playbooks)
10. [Pre-Launch QA Checklist](#10-pre-launch-qa-checklist)

---

## 1. Server Foundation & Community Settings

### Server Metadata
- **Server Name:** `Aegis Support & Community`
- **Community Enabled:** Yes *(Unlocks Announcements, Forums, Community Onboarding, Server Guide, and Server Insights)*
- **Description:** Official technical support, release notes, documentation, and community hub for Aegis.
- **Preferred Locale:** `English (US)`
- **Server Icon & Banner:** Aegis shield insignia in blurple (`#5865F2`) and dark slate (`#1E1F1E`).

### Core Safety Settings
- **Verification Level:** `High` *(Member of the server for > 10 minutes to post in public channels)*
- **Explicit Media Content Filter:** `Scan media content from all members`
- **Default Notification Settings:** `Only @mentions`
- **2FA Requirement for Moderation:** `Enabled` *(Mandatory for all staff roles)*
- **Automod Defense:** Native Discord AutoMod active in tandem with Aegis's real-time blocked words, link filtering, mention-spam, message rate limits, duplicate detection, caps filtering, and emoji wall protection.

---

## 2. Role Hierarchy & Specifications

Roles **must** stay in the exact vertical order below (highest position first). In Discord, no user or bot can manage, timeout, kick, or ban anyone with an equal or higher role. The hierarchy has been streamlined to 15 purposeful roles, removing redundant cosmetic tiers.

| Pos | Role Name | Color Hex | Hoist | Mentionable | Purpose |
|:---:|---|---|:---:|:---:|---|
| **1** | `Founder / Owner` | `#E74C3C` | Yes | No | Server owner; complete administrative control and infrastructure governance |
| **2** | `Lead Developer` | `#9B59B6` | Yes | Yes | Engineering, releases, infrastructure & production bot management |
| **3** | `Head Moderator` | `#E67E22` | Yes | Yes | Leads moderation team, handles policy audits, appeals, and escalations |
| **4** | `Moderator` | `#3498DB` | Yes | Yes | Daily chat moderation, purge/timeout/warn enforcement, and watchlist audits |
| **5** | `Support Specialist` | `#2ECC71` | Yes | Yes | Technical support staff answering tickets, forums, and community questions |
| **6** | `Aegis Bot` | `#5865F2` | Yes | Yes | Production Aegis bot instance; must sit above all managed roles |
| **7** | `Contributor / Dev` | `#1ABC9C` | Yes | No | External contributors with accepted pull requests or ecosystem tools |
| **8** | `Bug Hunter` | `#F1C40F` | Yes | No | Security researchers and members who have verified critical bug reports |
| **9** | `Server Booster` | `#F47FFF` | Yes | No | Nitro boosters supporting the community (auto-managed by Discord) |
| **10** | `Community Member` | `#95A5A6` | No | No | Verified standard member role; baseline access to public channels |
| **11** | `Announcement Ping` | `#A0B0C0` | No | No | Opt-in role for major release announcements |
| **12** | `Bot Updates Ping` | `#A0B0C0` | No | No | Opt-in role for version changelogs and patch notes |
| **13** | `Outage / Status Ping` | `#A0B0C0` | No | No | Opt-in role for maintenance notices and downtime alerts |
| **14** | `Muted / Quarantine` | `#4F545C` | No | No | Restricted role for members placed in cooldown or under active investigation |
| **15** | `@everyone` | None | No | No | Baseline pre-verification role; restricted read-only view of landing channels |

---

## 3. Global Permissions Matrix

Key permission delegations across the streamlined role tiers:

| Role | Admin | Manage Guild | Manage Roles | Manage Chans | Kick / Ban | Timeout | Mod Messages | View Audit | Send Messages |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `Founder / Owner` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Lead Developer` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Head Moderator` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Moderator` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Support Specialist` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| `Aegis Bot` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Community Member` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `Muted / Quarantine` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `@everyone` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 4. Category & Channel Architecture

```
📂 ─── 📌 INFORMATION & WELCOME ───
  ├─ 📜・rules-and-info        [Text | Read-only | Server rules, guidelines & docs link]
  ├─ 👋・welcome               [Text | Read-only | Aegis welcome target]
  ├─ 📢・announcements         [Announcement | Read-only | Major news & events]
  ├─ 🚀・bot-updates           [Announcement | Read-only | Version changelogs]
  ├─ 🚨・status-and-incidents  [Announcement | Read-only | Maintenance & uptime notices]
  └─ 🔗・official-links        [Text | Read-only | Trusted repository, docs & web links]

📂 ─── 🛡️ VERIFICATION & ROLES ───
  ├─ 🛡️・verify                [Text | Interactive verification gate panel]
  └─ 🎭・get-roles             [Text | Interactive role panel for notification pings]

📂 ─── 💬 COMMUNITY CHAT ───
  ├─ 💬・general-discussion    [Text | Slowmode 3s | Main community discussion]
  ├─ 🤖・bot-discussion        [Text | Slowmode 5s | Aegis bot setup, features & Q&A]
  ├─ 🎨・showcase-setups       [Text | Slowmode 15s | Server configs & layouts showcase]
  └─ ⭐・highlights            [Text | Starboard feed for community-starred posts]

📂 ─── 🧪 TESTING & PLAYGROUND ───
  ├─ 🧪・bot-playground-1      [Text | Slowmode 3s | Public command sandbox]
  ├─ 🧪・bot-playground-2      [Text | Slowmode 3s | Sandbox overflow & economy testing]
  └─ 🛡️・mod-commands-testing  [Text | Staff only | Moderation drills & test cases]

📂 ─── 🎫 SUPPORT & TICKETS ───
  ├─ 🎫・create-ticket         [Text | Support ticket launcher panel]
  ├─ ❓・faq-quick-help        [Text | Read-only common questions & answers]
  ├─ 🔧・self-hosting          [Forum | Node.js, Docker, Fly.io & MongoDB support]
  └─ 💻・api-and-dev-help      [Forum | Integrations, Webhooks & API support]

📂 ─── 💡 FEEDBACK & BUGS ───
  ├─ 💡・suggestions           [Text | /suggest voting feed & decision updates]
  └─ 🐛・bug-reports           [Forum | Structured bug tracking with status tags]

📂 ─── 🔐 STAFF COMMAND & AUDIT ───
  ├─ 💬・staff-chat            [Text | Private staff coordination hub]
  ├─ 📬・modmail               [Forum | Inbound member DM ModMail threads]
  ├─ 📜・mod-logs              [Text | Automated Aegis audit logging target]
  ├─ 📊・staff-digest          [Text | Weekly scheduled operations digest]
  ├─ 🕵️・watchlist-alerts      [Text | Real-time Ghost Watch alerts]
  ├─ 📁・ticket-transcripts    [Text | Automated HTML ticket transcripts]
  └─ 🪵・bot-debug-logs        [Text | Production deployment notices & logs]

📂 ─── 🔊 VOICE LOUNGES ───
  ├─ 🔊・Community Lounge      [Voice | 64kbps | User limit: 25]
  ├─ 🎮・Gaming & Screen Share [Voice | 96kbps | User limit: 10]
  ├─ 🛡️・Staff Meeting Room    [Voice | 96kbps | Staff roles only]
  └─ 💤・AFK                   [Voice | 64kbps | Inactive timeout: 15 min]
```

---

## 5. Channel Reference & Descriptions

Every channel serves a single dedicated operational function. Below is the full specification and deep operational description for each channel across all server categories, followed by paste-ready **Channel Topics** (strictly plain text, under Discord's 1024-character limit).

Official links referenced across channel topics:
- Website: https://aegisdeno.fly.dev/
- Status: https://aegisdeno.fly.dev/status
- Features: https://aegisdeno.fly.dev/features
- Commands: https://aegisdeno.fly.dev/commands
- Docs: https://aegisdeno.fly.dev/docs
- Dashboard: https://aegisdeno.fly.dev/dashboard
- Changelog: https://aegisdeno.fly.dev/changelog
- Invite: https://aegisdeno.fly.dev/invite
- Why Aegis: https://aegisdeno.fly.dev/why
- Roadmap: https://aegisdeno.fly.dev/roadmap
- Security: https://aegisdeno.fly.dev/security
- Terms and Privacy: https://aegisdeno.fly.dev/terms and https://aegisdeno.fly.dev/privacy
- Support server invite: https://discord.gg/HwTbCYC4PM
- Source (proprietary, all rights reserved): https://github.com/watispro1/AegisDeno

---

### 5.1 📌 Information & Welcome

| Channel | Who posts | Slowmode | Permissions | Aegis |
|---|---|---|---|---|
| `#rules-and-info` | Staff | Off | Read-only for `@everyone`; reactions off | Staff pin rules embed via `/embed builder` |
| `#welcome` | Aegis | Off | Read-only for `@everyone` | Welcomes incoming members automatically |
| `#announcements` | Staff | Off | Read-only; announcement channel | Staff broadcast major updates |
| `#bot-updates` | Staff | Off | Read-only; announcement channel | Changelogs and version releases |
| `#status-and-incidents` | Staff | Off | Read-only; announcement channel | Downtime notices linking status page |
| `#official-links` | Staff | Off | Read-only; reactions off | Curated trusted domain reference |

#### `#rules-and-info` — Server Rules, Guidelines & Sanction Ladder
- **Purpose & Scope:** The foundational rulebook for all participants. Details expected community standards, behavioral boundaries, zero-tolerance infractions (hate speech, scams, token grabbers), and the automated warning escalation ladder.
- **Audience & Access:** Publicly visible to all users (`@everyone` and verified members). Strictly read-only; reactions and threads are disabled to prevent message dilution.
- **Aegis Integration:** Staff use `/embed builder` to post structured, formatted rule embeds. Documents the warning escalation schedule: 3 warnings lead to a 1h timeout, 5 warnings to a 24h timeout, and 7 warnings result in a permanent ban.
- **Staff Protocol:** Update when community standards evolve. Ensure links to documentation and guidelines remain accurate.

`#rules-and-info`
```text
Read this first. Server rules, how warnings escalate (3 warnings -> 1h timeout, 5 warnings -> 24h timeout, 7 warnings -> ban; warnings expire after 30 days) and where to get help. Then verify in #verify. Full docs: https://aegisdeno.fly.dev/docs
```

#### `#welcome` — Automated Member Greetings & Orientation
- **Purpose & Scope:** Real-time arrival feed welcoming new users into the community. Directs incoming members toward the verification gate and rules before granting access.
- **Audience & Access:** Visible to incoming users and verified members. Read-only for users; only Aegis has permission to dispatch messages here.
- **Aegis Integration:** Targeted by `/welcome channel channel:#welcome`. Automatically greets joining members using customizable variable templates (`{user}`, `{username}`, `{server}`, `{count}`) upon entry.
- **Staff Protocol:** Monitored to observe join waves. In the event of an automated raid join surge, Aegis automatically gates joins or staff initiate Incident Mode via `/incident start`.

`#welcome`
```text
Welcome to Aegis Support & Community! Read #rules-and-info, then press Verify in #verify to unlock the server. New to Aegis? Start at https://aegisdeno.fly.dev/docs
```

#### `#announcements` — Official Ecosystem Announcements
- **Purpose & Scope:** Primary broadcast channel for major product releases, security advisories, ecosystem partnerships, and community milestones.
- **Audience & Access:** Read-only for members; public Discord Announcement channel allowing external servers to follow and receive syndicated news.
- **Aegis Integration:** Staff broadcast announcements using `/announce channel:#announcements` with optional role pings (`@Announcement Ping`).
- **Staff Protocol:** Reserved strictly for high-impact updates. General release patch notes belong in `#bot-updates` instead.

`#announcements`
```text
Major Aegis releases, events and server news. Want a ping? Pick Announcement Ping in #get-roles. Discuss in #general-discussion.
```

#### `#bot-updates` — Production Bot Releases & Changelogs
- **Purpose & Scope:** Detailed engineering changelogs, feature additions, command deprecations, and dashboard revisions for every production Aegis release.
- **Audience & Access:** Read-only for community members. Members opt into notifications by claiming the `@Bot Updates Ping` role in `#get-roles`.
- **Aegis Integration:** Links directly to live release notes at `https://aegisdeno.fly.dev/changelog` and dashboard changelogs.
- **Staff Protocol:** Maintainers publish comprehensive release notes with code examples whenever new commands or subcommands are deployed to production.

`#bot-updates`
```text
Release notes for every Aegis version: new commands, changes and fixes. Full history: https://aegisdeno.fly.dev/changelog - Dashboard changes: https://aegisdeno.fly.dev/dashboard/changelog - Ping role: Bot Updates Ping in #get-roles.
```

#### `#status-and-incidents` — Infrastructure Health & Outage Alerts
- **Purpose & Scope:** Authoritative status updates regarding API availability, database maintenance, Discord gateway latency, host incidents, and recovery notices.
- **Audience & Access:** Read-only announcement channel. Pings the opt-in `@Outage / Status Ping` role for critical degradation or scheduled maintenance.
- **Aegis Integration:** References the public telemetry dashboard at `https://aegisdeno.fly.dev/status`.
- **Staff Protocol:** When an outage occurs, post immediate notification linking the status page. Post resolution notes ("All Clear") once metrics stabilize.

`#status-and-incidents`
```text
Outages, degraded service and planned maintenance, with an all-clear when it is fixed. Live component status and uptime: https://aegisdeno.fly.dev/status - Check there before reporting downtime. Ping role: Outage / Status Ping in #get-roles.
```

#### `#official-links` — Trusted Resource & Security Directory
- **Purpose & Scope:** Single source of truth for authentic Aegis domains, documentation mirrors, security disclosure policies, and source repositories to protect members against phishing.
- **Audience & Access:** Public read-only reference channel. All reactions and external threads disabled.
- **Aegis Integration:** Pinned embed maintained by staff documenting trusted URLs and API paths (/api/status, /api/commands).
- **Staff Protocol:** Periodically review destination URLs to verify TLS certificates, repository links, and terms compliance.

`#official-links`
```text
The only trusted Aegis links. Invite: https://aegisdeno.fly.dev/invite - Dashboard: https://aegisdeno.fly.dev/dashboard - Docs: https://aegisdeno.fly.dev/docs - Status: https://aegisdeno.fly.dev/status - Security: https://aegisdeno.fly.dev/security - Support server: https://discord.gg/HwTbCYC4PM - Source (for review, all rights reserved): https://github.com/watispro1/AegisDeno - Anyone posting other "Aegis" links is not us.
```

---

### 5.2 🛡️ Verification & Roles

| Channel | Who posts | Slowmode | Permissions | Aegis |
|---|---|---|---|---|
| `#verify` | Aegis | Off | `@everyone` read-only; hides after verified | Gate panel granting `@Community Member` |
| `#get-roles` | Aegis | Off | `@Community Member` read-only | Self-service notification pings |

#### `#verify` — Anti-Bot Gate & Membership Verification
- **Purpose & Scope:** The entry checkpoint safeguarding the server against automated bot raids, self-bots, and scrapers. Unverified users cannot view any public discussion channels until verified.
- **Audience & Access:** Visible exclusively to pre-verification users (`@everyone`). Automatically hidden once the user receives `@Community Member`.
- **Aegis Integration:** Managed via `/verify setup channel:#verify verified_role:@Community Member`. Employs a one-click button or interactive CAPTCHA modal with automated 30-minute auto-kick timeouts for unverified accounts.
- **Staff Protocol:** Staff can manually verify accounts encountering client glitches using `/verify user target:@member` or `/verify batch`.

`#verify`
```text
Press Verify below to unlock the server. One click, no forms. Unverified accounts are removed after 30 minutes; you can rejoin any time. Stuck? DM Aegis to reach staff.
```

#### `#get-roles` — Opt-In Notification Role Panels
- **Purpose & Scope:** Self-service role assignment allowing community members to opt into specific notification categories without pinging the entire server.
- **Audience & Access:** Visible to verified members (`@Community Member`). Read-only message channel featuring interactive UI select menus.
- **Aegis Integration:** Deployed via `/rolepanel create channel:#get-roles role1:@Announcement Ping role2:@Bot Updates Ping role3:@Outage / Status Ping style:Dropdown menu exclusive:false`.
- **Staff Protocol:** Add new opt-in roles (e.g. event or testing pings) using `/rolepanel create` or retire old panels using `/rolepanel delete id:<panel-id>`.

`#get-roles`
```text
Choose your pings: Announcement Ping (big releases), Bot Updates Ping (every version), Outage / Status Ping (incidents and maintenance). Pick again to remove a role.
```

---

### 5.3 💬 Community Chat

| Channel | Who posts | Slowmode | Permissions | Aegis |
|---|---|---|---|---|
| `#general-discussion` | `@Community Member` | 3s | Send on; Attach Files off; Mention @everyone off | Automod: links, mentions, spam, caps |
| `#bot-discussion` | `@Community Member` | 5s | Send on; Mention @everyone off | Feature queries and setup discussion |
| `#showcase-setups` | `@Community Member` | 15s | Send and Attach Files on | Layout and configuration showcase |
| `#highlights` | Aegis | Off | Read-only for `@Community Member` | Starboard feed for community-starred posts |

#### `#general-discussion` — Central Community Lounge
- **Purpose & Scope:** The primary social hub for casual conversation among Aegis community members. General tech banter, server administration discussion, and community networking.
- **Audience & Access:** Verified community members. Attachments disabled to prevent meme flooding; slowmode set to 3s to maintain conversation readability.
- **Aegis Integration:** Monitored continuously by Aegis AutoMod: link filtering (only whitelisted domains pass), mention spam caps, duplicate message suppression, and excessive caps checks. Community star reactions mirror top messages to `#highlights`.
- **Staff Protocol:** Keep discussions friendly and civil. Direct technical configuration questions to `#bot-discussion` and bug reports to `#bug-reports`.

`#general-discussion`
```text
General chat for the Aegis community. Be kind and stay safe for work. Feature questions go to #bot-discussion, private problems to a ticket in #create-ticket. React with star to nominate a message for #highlights.
```

#### `#bot-discussion` — Bot Features, Configurations & Setup Q&A
- **Purpose & Scope:** Technical dialogue dedicated to configuring Aegis. Users share configuration ideas, ask questions regarding permission calculations, and seek advice on automod tuning.
- **Audience & Access:** Verified members. 5-second slowmode to prevent overlapping questions.
- **Aegis Integration:** Protected by standard automod. Staff and support specialists actively assist users, referencing `/help` commands and online documentation.
- **Staff Protocol:** Direct users encountering private data/credentials issues (tokens, database strings) to `#create-ticket`.

`#bot-discussion`
```text
Ask how Aegis works and share setup ideas. Try /help for any command, or browse https://aegisdeno.fly.dev/commands. Logs, tokens or account issues? Open a ticket in #create-ticket instead.
```

#### `#showcase-setups` — Server Architecture & Configuration Showcases
- **Purpose & Scope:** Visual showcase where administrators share screenshots of their Aegis configurations, audit log layouts, ticket panels, verification flows, and dashboard charts.
- **Audience & Access:** Verified members. 15-second slowmode with image attachment permissions enabled.
- **Aegis Integration:** Automod filters non-image spam, external phishing links, and Discord invite links.
- **Staff Protocol:** Remind members to censor sensitive member IDs, internal tokens, or webhook credentials before posting screenshots.

`#showcase-setups`
```text
Show off your Aegis setup: logging layouts, automod rules, ticket flows, role panels, dashboard screenshots. Hide member names and IDs before posting.
```

#### `#highlights` — Community Starboard Hall of Fame
- **Purpose & Scope:** Automated showcase featuring noteworthy, insightful, helpful, or humorous messages curated democratically by the community.
- **Audience & Access:** Read-only for community members; only Aegis has permission to post embeds here.
- **Aegis Integration:** Managed by `/starboard setup channel:#highlights` with a 4-star threshold (`⭐`). Self-starring is prohibited. Starred messages display author attribution, jump links, and original image attachments.
- **Staff Protocol:** Inappropriate messages that reach the threshold can be removed by staff deleting the embed or using `/starboard ignore`.

`#highlights`
```text
Community highlights. Messages with 4 star reactions land here automatically; stars on your own message don't count.
```

---

### 5.4 🧪 Testing & Playground

| Channel | Who posts | Slowmode | Permissions | Aegis |
|---|---|---|---|---|
| `#bot-playground-1` | `@Community Member` | 3s | Send on; Use Application Commands on | Automod-exempt command testing sandbox |
| `#bot-playground-2` | `@Community Member` | 3s | Same as playground 1 | Overflow sandbox for high-traffic periods |
| `#mod-commands-testing` | Staff | Off | Staff roles only | Isolated staff sandbox for moderation drills |

#### `#bot-playground-1` — Public Slash Command Sandbox
- **Purpose & Scope:** Dedicated testing ground for users to experiment with Aegis slash commands (`/help`, `/ping`, `/serverinfo`, `/userinfo`, `/poll`, `/remindme set`, economy commands) without cluttering chat.
- **Audience & Access:** Verified members. 3-second slowmode to prevent rapid spam.
- **Aegis Integration:** Explicitly exempt from Aegis link, spam, and caps automod filters via `/automod exempt addchannel channel:#bot-playground-1` so users can test command inputs safely. Moderation commands are blocked for standard users.
- **Staff Protocol:** Routinely cleared via automated retention or staff `/purge` sweeps.

`#bot-playground-1`
```text
Try Aegis here: /help, /ping, /serverinfo, /userinfo, /poll, /remindme set. Automod is off in this channel so tests don't get you warned. No moderation commands. Messages are cleared regularly.
```

#### `#bot-playground-2` — Sandbox Overflow & Multi-User Testing
- **Purpose & Scope:** Secondary sandbox utilized during peak hours, multi-user reminder testing, interactive poll evaluations, or economy feature testing.
- **Audience & Access:** Verified members. Identical permissions and 3-second slowmode to playground 1.
- **Aegis Integration:** Exempt from automod filters via `/automod exempt addchannel channel:#bot-playground-2`.
- **Staff Protocol:** Purged periodically alongside playground 1.

`#bot-playground-2`
```text
Overflow sandbox for busy times and multi-person tests (polls, reminders). Same rules as #bot-playground-1.
```

#### `#mod-commands-testing` — Staff Moderation Drills & Incident Sandbox
- **Purpose & Scope:** Restricted staging ground for staff to rehearse moderation workflows (`/warn`, `/timeout`, `/case`, `/purge`, `/massban`, `/lock`, `/incident status`) on dedicated test accounts.
- **Audience & Access:** Strictly restricted to staff roles (`Support Specialist` and higher). Completely hidden from general members.
- **Aegis Integration:** Every moderation command executed here generates genuine database cases and logs to `#mod-logs`.
- **Staff Protocol:** Never test moderation commands on real community members. Always use documented test accounts.

`#mod-commands-testing`
```text
Staff sandbox. Rehearse /warn, /timeout, /case, /purge, /massban, /lock and /incident status on a test account only. Every action here creates a real case and a mod-log entry.
```

---

### 5.5 🎫 Support & Tickets

| Channel | Who posts | Slowmode | Permissions | Aegis |
|---|---|---|---|---|
| `#create-ticket` | Aegis | Off | `@Community Member` read-only | Interactive ticket launcher panel |
| `#faq-quick-help` | Staff | Off | Read-only | Pinned self-serve troubleshooting guide |
| `#self-hosting` | `@Community Member` | 5s / thread | Forum; tag required; Create Posts on | Self-hosting and container deployment support |
| `#api-and-dev-help` | `@Community Member` | 5s / thread | Forum; tag required; Create Posts on | API, webhook, and developer integration support |

#### `#create-ticket` — Private Support Ticket Portal
- **Purpose & Scope:** The launchpad for confidential, one-on-one technical support. Used for discussing sensitive server configurations, permission audits, log analysis, or account inquiries.
- **Audience & Access:** Verified members can view the panel and click the interactive button. Only the ticket creator and staff can view opened ticket channels.
- **Aegis Integration:** Deployed via `/ticket setup channel:#create-ticket staff_role:@Support Specialist`. Upon button click, Aegis provisions a private channel, pings support, and handles auto-closure and HTML transcript generation.
- **Staff Protocol:** Support staff claim tickets with `/ticket claim` to prevent duplicate efforts. Transcripts are automatically saved to `#ticket-transcripts`.

`#create-ticket`
```text
Need private help? Press Create Ticket for a channel only you and staff can see. Use it for logs, server-specific setups and anything you can't share publicly. Never send your bot token or database password.
```

#### `#faq-quick-help` — Curated Self-Service Troubleshooting Library
- **Purpose & Scope:** Comprehensive, quick-reference repository answering the most frequent setup hurdles: missing slash commands, hierarchy permission errors, hidden channels, and appeal codes.
- **Audience & Access:** Public read-only reference channel.
- **Aegis Integration:** Directs users to execute `/diagnostics` within their own servers before opening tickets.
- **Staff Protocol:** Update frequently with common solutions discovered during ticket resolution.

`#faq-quick-help`
```text
Quick answers: missing slash commands, permissions Aegis needs, hidden channels, appeal codes, where transcripts go. Run /diagnostics in your server first. Full guide: https://aegisdeno.fly.dev/docs
```

#### `#self-hosting` — Forum: Docker, Fly.io, Node.js & MongoDB
- **Purpose & Scope:** Structured forum channel dedicated to self-hosting inquiries, Docker container configurations, Fly.io deployments, MongoDB indexing, and environment variable tuning.
- **Audience & Access:** Verified members can create forum posts. Tag selection is enforced to maintain organized searchability.
- **Aegis Integration:** Monitored by automod. Auto-archives inactive threads after 7 days to keep the forum uncluttered.
- **Staff Protocol:** Verify that self-hosters comply with proprietary license terms (`https://aegisdeno.fly.dev/terms#source`). Tag resolved threads with `Resolved` ✅.

`#self-hosting`
```text
Help running your own Aegis: Node.js, MongoDB, Docker, Fly.io and environment variables. Aegis is proprietary: running your own copy needs the maintainer's written permission first (https://aegisdeno.fly.dev/terms#source). One problem per post, pick a tag, include your error with secrets removed. Source and setup: https://github.com/watispro1/AegisDeno
```

#### `#api-and-dev-help` — Forum: REST Endpoints, Webhooks & Architecture
- **Purpose & Scope:** Dedicated forum for developers building integrations with Aegis, querying public status endpoints (/api/status), handling webhooks, or contributing to open modules.
- **Audience & Access:** Verified members can create posts. Tag required. 5-second slowmode per thread.
- **Aegis Integration:** Auto-archives inactive threads after 7 days.
- **Staff Protocol:** Review architecture discussions and guide contributors toward standardized pull request workflows on GitHub.

`#api-and-dev-help`
```text
Building around Aegis or contributing? Ask about the public JSON (/api/status, /api/commands), the codebase and pull requests. One question per post. Repo: https://github.com/watispro1/AegisDeno
```

---

### 5.6 💡 Feedback & Bugs

| Channel | Who posts | Slowmode | Permissions | Aegis |
|---|---|---|---|---|
| `#suggestions` | Aegis | Off | `@Community Member` App commands on, send off | Interactive suggestion voting feed |
| `#bug-reports` | `@Community Member` | 10s / thread | Forum; status tags | Structured bug tracking with lifecycle tags |

#### `#suggestions` — Community Feature Voting & Triage
- **Purpose & Scope:** Crowdsourced feature suggestion pipeline where members propose enhancements, UI tweaks, or new commands, and the community upvotes or downvotes.
- **Audience & Access:** Public voting feed. Members submit ideas via `/suggest submit`. Chat sending is disabled to prevent unformatted spam.
- **Aegis Integration:** Configured via `/suggest setup channel:#suggestions`. Posts formatted embeds with upvote/downvote buttons. When staff review suggestions (`/suggest consider`, `/suggest approve`, `/suggest deny`), Aegis updates the embed and DMs the author.
- **Staff Protocol:** Review weekly during developer triage. Provide clear explanatory reasons for accepted or declined submissions.

`#suggestions`
```text
Suggest a feature with /suggest submit. One idea per suggestion; vote with the buttons. Staff reply with consider, approve or deny and a reason, and you get a DM.
```

#### `#bug-reports` — Forum: Issue Tracking & Quality Assurance
- **Purpose & Scope:** Structured forum for reporting software anomalies, edge-case crashes, command validation failures, and dashboard UI glitches.
- **Audience & Access:** Verified members can open threads. 10-second slowmode per thread. Tag requirement enforced.
- **Aegis Integration:** Auto-sorts by newest. Monitored for automated error references.
- **Staff Protocol:** Triage incoming bugs through lifecycle tags: `New` 🆕 -> `Investigating` 🔍 -> `Confirmed` ⚠️ -> `Fixed` ✅ (or `Not a Bug` ❌ / `Duplicate` 🚫). Critical vulnerabilities must be directed to `https://aegisdeno.fly.dev/security`.

`#bug-reports`
```text
Found a bug? One post each: what you did, what you expected, what happened, and the version from /about. Outages go to #status-and-incidents, security issues to https://aegisdeno.fly.dev/security
```

---

### 5.7 🔐 Staff Command & Audit

`@everyone` and `@Community Member` have View Channel **denied** for this category.

| Channel | Who posts | Slowmode | Permissions | Aegis |
|---|---|---|---|---|
| `#staff-chat` | Staff | Off | Staff send on | Private staff coordination and handoffs |
| `#modmail` | Aegis + staff | Off | Forum; staff send in posts; Aegis manages threads | Inbound member DM ModMail relay |
| `#mod-logs` | Aegis | Off | Staff send off | Comprehensive moderation audit stream |
| `#staff-digest` | Aegis | Off | Staff send off | Automated weekly operational digest |
| `#watchlist-alerts` | Aegis | Off | Staff send off | Real-time Ghost Watch alerts |
| `#ticket-transcripts` | Aegis | Off | Staff send off | Archived HTML ticket transcripts |
| `#bot-debug-logs` | Aegis + webhooks | Off | Staff send off | Bot deployment and runtime notices |

#### `#staff-chat` — Internal Operations Coordination Hub
- **Purpose & Scope:** Confidential discussion channel for the administration and moderation teams to discuss case reviews, policy updates, shift handoffs, and suspicious accounts.
- **Audience & Access:** Restricted to staff roles (`Support Specialist` and higher). Completely hidden from members.
- **Aegis Integration:** Staff discuss active case IDs generated by Aegis.
- **Staff Protocol:** Always reference case IDs (`/case view case_id:<id>`) when discussing sanctions. Never leak staff discussions to public channels.

`#staff-chat`
```text
Staff coordination, handoffs and escalations. Mention the case ID when talking about a member, and never paste DM or ModMail content outside staff channels.
```

#### `#modmail` — Forum: Inbound Direct Message Communication
- **Purpose & Scope:** Dedicated forum where member DMs to the Aegis bot are converted into private forum threads. Enables members to contact staff privately regarding appeals, sensitive reports, or private inquiries.
- **Audience & Access:** Staff only. Each inbound DM opens a dedicated thread visible only to staff.
- **Aegis Integration:** Configured via `/modmail setup channel:#modmail role:@Support Specialist`. Staff reply using `/modmail reply`, quick buttons, snippets (`/modmail snippet use`), or messages prefixed with `=`. Transcripts saved upon `/modmail close`.
- **Staff Protocol:** Handle inquiries professionally. Use anonymous replies (`anonymous:true`) when representing the moderation team. Close resolved threads promptly.

`#modmail`
```text
One post per member who DMs Aegis. Reply with /modmail reply, the Reply buttons, a snippet (/modmail snippet use) or a message starting with =. Plain chat here stays internal. Close with /modmail close; transcripts stay on the dashboard for 90 days.
```

#### `#mod-logs` — Automated Security & Audit Trail
- **Purpose & Scope:** Centralized, immutable event stream documenting all moderation enforcement actions, member lifecycle changes, and security events across the guild.
- **Audience & Access:** Staff only. Message sending disabled for all roles; only Aegis posts embeds here.
- **Aegis Integration:** Target of `/logging channel channel:#mod-logs`. Logs warnings, timeouts, kicks, bans, mass bans, purges, case edits, join risk evaluations, member reports, and Incident Mode activations.
- **Staff Protocol:** Inspect join-risk flags (new accounts under 7 days, suspicious avatars). Review case details using `/case view`.

`#mod-logs`
```text
Aegis audit log: warnings, timeouts, kicks, bans, mass bans, purges, case edits, join risk flags, message reports, Incident Mode steps and ModMail closes. Each entry links its case. Look a case up with /case view or on https://aegisdeno.fly.dev/dashboard
```

#### `#staff-digest` — Weekly Operational Health & Moderation Summary
- **Purpose & Scope:** Automated management summary delivered weekly to keep staff aligned on community health metrics, moderation caseloads, and emerging trends.
- **Audience & Access:** Staff only. Read-only channel.
- **Aegis Integration:** Deployed via `/digest setup channel:#staff-digest day:Monday hour:9 timezone:America/Chicago`. Compiles weekly cases broken down by moderator, join/leave ratios, automod trigger counts, active incidents, low-trust member tallies, and pending ModMail/appeals.
- **Staff Protocol:** Review every Monday morning during administrative synchronization. Preview anytime with `/digest preview`.

`#staff-digest`
```text
Weekly staff digest, Mondays 09:00 US Central: cases by moderator, joins and leaves, automod hits, incidents, low-trust members and open tickets, appeals and ModMail. Preview any time with /digest preview.
```

#### `#watchlist-alerts` — Real-Time Ghost Watch Activity Feed
- **Purpose & Scope:** Confidential security channel receiving real-time telemetry when watched members (suspected alt accounts, past griefers, or evasive users) interact with the server.
- **Audience & Access:** Staff only. Read-only channel.
- **Aegis Integration:** Receives alerts generated by `/watchlist add user:@member alert_channel:#watchlist-alerts`. Dispatches instant alerts when the target member sends their first daily message, joins a voice channel, changes roles, or triggers automod.
- **Staff Protocol:** Strictly confidential. Never disclose to a member that they are on Ghost Watch. Manage active watches using `/watchlist list` and `/watchlist remove`.

`#watchlist-alerts`
```text
Ghost Watch alerts for members under watch. Confidential: never quote alerts in public. Manage with /watchlist list and /watchlist remove.
```

#### `#ticket-transcripts` — Support Ticket Archives & Audits
- **Purpose & Scope:** Immutable archive storing full HTML transcripts, participant lists, and resolution reasons for every closed support ticket.
- **Audience & Access:** Staff only. Read-only channel.
- **Aegis Integration:** Targeted by `/ticket settings log_channel:#ticket-transcripts transcripts:true`. When a ticket is closed via `/ticket close`, Aegis renders and posts the full transcript file here.
- **Staff Protocol:** Search previous ticket transcripts by user ID or username before handling repeat support cases.

`#ticket-transcripts`
```text
Transcripts of closed tickets, with who opened, claimed and closed each one. Search by member name before reopening an issue.
```

#### `#bot-debug-logs` — Production Telemetry & Deployment Stream
- **Purpose & Scope:** Technical telemetry channel capturing host health alerts, production deployment notices, process restarts, and webhook error traces.
- **Audience & Access:** Technical staff (`Lead Developer` and `Founder / Owner`).
- **Aegis Integration:** Integrated with production host health hooks.
- **Staff Protocol:** Cross-reference runtime warnings with the live public status page at `https://aegisdeno.fly.dev/status`.

`#bot-debug-logs`
```text
Deploy notices and runtime errors for the production bot. Not for member reports. Live health: https://aegisdeno.fly.dev/status
```

---

### 5.8 🔊 Voice Lounges

Voice channels do not have text topics. Configure each channel's **Status**:

| Channel | Access | Status to set |
|---|---|---|
| `🔊 Community Lounge` | `@Community Member` - 64kbps - limit 25 | `Chill voice chat - 25 max` |
| `🎮 Gaming & Screen Share` | `@Community Member` - 96kbps - limit 10 | `Games and screen share - ask before streaming` |
| `🛡️ Staff Meeting Room` | Staff only - 96kbps | `Staff meetings only` |
| `💤 AFK` | `@Community Member` - speak off | `AFK - idle members land here after 15 min` |

---

### 5.9 Channel Conventions

- **Names:** `emoji・kebab-case`; voice channels use clean title case.
- **Order:** Information -> Verification -> Community -> Testing -> Support -> Feedback -> Staff -> Voice. Staff channels never sit above public ones.
- **Topics are documentation:** Paste them verbatim from §5 and update this manual first whenever a channel changes.
- **Slowmode:** 3s general chat, 5s discussion & support forums, 15s showcases, off for read-only and staff channels. During raids, `/incident start` adds slowmode server-wide and restores it upon conclusion.
- **Read-only is strict:** Staff post through Aegis (`/announce`, `/embed builder`) or with explicit administrator overrides.
- **Archive, don't delete:** Forum threads auto-archive after 7 days; retired channels are hidden/archived to preserve message links.
- **Single bot ownership:** Aegis handles moderation, tickets, verification, role panels, starboard, ModMail, and audit logs.

---

### 5.10 What Aegis Posts Where

| Aegis event | Destination | Trigger |
|---|---|---|
| Warnings, timeouts, kicks, bans, unbans, purges, mass bans, case edits | `#mod-logs` | `/warn`, `/timeout`, `/kick`, `/ban`, `/unban`, `/purge`, `/massban`, `/case edit` |
| Incident Mode start, steps and restore | `#mod-logs` | `/incident start`, `/incident end`, the `/incident auto` trigger |
| ModMail conversations / close summaries | `#modmail` / `#mod-logs` | Member DMs Aegis; `/modmail close` |
| Member join risk flags & audit | `#mod-logs` | Member join (when memberJoins log is enabled) |
| Member message reports | `#mod-logs` | Message Apps context menu "Report Message" |
| Reverted slowmode completions | `#mod-logs` | Automated completion of `/slowmode set` duration |
| Weekly staff digest | `#staff-digest` | `/digest setup` schedule |
| Ghost Watch alerts | `#watchlist-alerts` + the watcher's DMs | `/watchlist add` |
| Ticket transcripts | `#ticket-transcripts` (and the member's DMs) | `/ticket close`, idle auto-close |
| Verification panel | `#verify` | `/verify setup` |
| Starboard copies | `#highlights` | 4 star reactions |
| Suggestions and decisions | `#suggestions` | `/suggest submit`, `/suggest approve`, `/suggest deny` |
| Welcome messages | `#welcome` | Member join |
| Status notices | `#status-and-incidents` (staff) | Staff post with a link to https://aegisdeno.fly.dev/status |

---

### 5.11 Forum Architecture & Tag Workflows

Four specialized Forum channels keep technical troubleshooting, bug triage, and private modmail organized:

#### 1. 🔧 `#self-hosting` Forum
- **Tag Requirement:** Enabled (at least one tag required)
- **Default Sort:** Recent Activity
- **Default Reaction:** 💡
- **Tags:** `Docker` 🐳, `Fly.io` 🚀, `MongoDB` 🍃, `Node.js` 🟩, `Environment` ⚙️, `Permissions` 🔒, `Upgrades` 🔄, `Resolved` ✅ *(Moderator only)*

#### 2. 💻 `#api-and-dev-help` Forum
- **Tag Requirement:** Enabled (at least one tag required)
- **Default Sort:** Recent Activity
- **Default Reaction:** 💻
- **Tags:** `REST API` 📡, `Webhooks` 🪝, `Architecture` 🏗️, `Slash Commands` ⌨️, `Dashboard` 📊, `Contributing` 🤝, `Solved` ✅ *(Moderator only)*

#### 3. 🐛 `#bug-reports` Forum
- **Tag Requirement:** Enabled (at least one tag required)
- **Default Sort:** Creation Date (Newest first)
- **Default Reaction:** 🔍
- **Tags & Lifecycle:**
  - `New` 🆕 *(Member selects on submit)*
  - `Investigating` 🔍 *(Staff diagnosing)*
  - `Confirmed` ⚠️ *(Bug verified; queued for fix)*
  - `Fixed` ✅ *(Fix pushed and verified)*
  - `Not a Bug` ❌ *(Invalid or working as intended)*
  - `Needs Info` ❓ *(Missing logs, steps or version)*
  - `Duplicate` 🚫 *(Already tracked in an open thread or issue)*

#### 4. 📬 `#modmail` Forum
- **Tag Requirement:** Disabled *(Aegis manages threads automatically on inbound DM)*
- **Default Sort:** Recent Activity
- **Default Reaction:** 📬
- **Staff Tags:** `Open` 📩, `Pending Member` ⏳, `Appeal` ⚖️, `Urgent` 🚨, `General` ❓, `Closed` 🔒

---

### 5.12 Discord Community Onboarding & Server Guide

#### Default Landing Channels (Pre-Verification)
- `#rules-and-info`
- `#welcome`
- `#announcements`
- `#bot-updates`
- `#status-and-incidents`
- `#official-links`
- `#verify`

#### Pre-Join Customization Questions
1. *"What brings you to the Aegis community?"*
   - `💬 Community & Chat` -> Channels: `#general-discussion`, `#showcase-setups`
   - `🔧 Self-Hosting & Deployment` -> Forum: `#self-hosting`
   - `🤖 Bot Setup & Moderation` -> Channels: `#bot-discussion`, `#faq-quick-help`
   - `💻 Developer & API Integrations` -> Forum: `#api-and-dev-help`
2. *"Which updates would you like to receive?"*
   - `📢 Major Announcements` -> Role: `@Announcement Ping`
   - `🔄 Bot Patch Notes` -> Role: `@Bot Updates Ping`
   - `🚨 Outages & Incidents` -> Role: `@Outage / Status Ping`

#### Server Guide Onboarding Tasks
- **Task 1:** Complete verification in `#verify` to unlock full server access.
- **Task 2:** Select notification roles in `#get-roles`.
- **Task 3:** Run `/help` in `#bot-playground-1` to test the bot.

---

## 6. Channel Permissions Breakdown

Category-level permission inheritance:

| Category | `@everyone` | `@Community Member` | Staff roles | `Aegis Bot` |
|---|---|---|---|---|
| 📌 Information & Welcome | View, read history; no send, threads or reactions | Same; reactions in announcements | Send (Head Moderator+) | Send, Embed Links, Attach Files |
| 🛡️ Verification & Roles | `#verify` only | `#get-roles` only | View | Send, Embed Links, Manage Roles |
| 💬 Community Chat | View off | View, send, Embed Links; no @everyone pings | Manage Messages, Moderate Members | View, Manage Messages, Moderate Members |
| 🧪 Testing & Playground | View off | Playgrounds only | All three channels | View, send |
| 🎫 Support & Tickets | View off | View; forum Create Posts; panel read-only | View, Manage Threads | Manage Channels, Manage Roles, Attach Files |
| 💡 Feedback & Bugs | View off | App Commands; forum Create Posts | Manage Threads | Send, Embed Links |
| 🔐 Staff Command & Audit | View off | View off | View; send in `#staff-chat` & `#modmail` | Full staff permissions |

---

## 7. Official Aegis Bot Setup & Integration

Run these commands inside Discord to configure all native bot systems. All command options and choices match the live command catalog (`https://aegisdeno.fly.dev/commands`).

### 7.1 Setup Order

1. **Invite Aegis** from `https://aegisdeno.fly.dev/invite` (`bot` and `applications.commands` scopes) and drag `Aegis Bot` above all roles it manages (§2).
2. **Run `/diagnostics`** and resolve any missing permissions. Required bitfield: `1460691659798`.
3. **Audit Logging** (7.2), then **verification** and **role panels** (7.3–7.4).
4. **Tickets, welcome, suggestions and starboard** (7.5–7.8).
5. **Comprehensive automod and escalation safety net** (7.9–7.10).
6. **Advanced staff tools:** ModMail, staff digest, Incident Mode, Trust Score and Ghost Watch (7.11).
7. **Optional:** Playground economy testing (7.12).
8. **Verify everything** using the QA checklist in §10.

### 7.2 General Configuration & Audit Logging Setup

Aegis features an enterprise audit logging engine that captures 8 distinct event categories: moderation actions, joins, leaves, edits, deletes, role updates, channel changes, and voice activity.

```bash
/config language language:English (en)
/logging channel channel:#mod-logs
/logging toggle enabled:true
/logging status
/logging test
```

- `/logging channel channel:#mod-logs`: Designates the target channel for event embeds and automatically enables the logging subsystem.
- `/logging toggle enabled:true`: Master on/off switch that preserves all configured categories and targets.
- `/logging status`: Opens the interactive category manager card with toggle buttons for all 8 categories (`Mod Actions`, `Member Joins`, `Member Leaves`, `Message Edits`, `Msg Deletes`, `Role Changes`, `Channel Events`, `Voice Activity`).
- **Join Risk Intelligence:** When member joins logging is active, Aegis automatically attaches color-coded risk flags to join embeds (evaluating account age under 1d/7d/30d, default avatars, algorithmic usernames, and returning accounts with previous infractions).
- `/logging test`: Dispatches a mock embed to `#mod-logs` to confirm webhook and channel posting permissions.

### 7.3 Verification Gate & Screening

The verification gate stops automated raids and malicious self-bots before they can see or interact with server channels.

```bash
/verify setup channel:#verify verified_role:@Community Member type:One-Click Button kick_unverified_minutes:30
/verify autokick minutes:30
/verify user target:@member
/verify batch
```

- `channel:#verify`: The public landing channel where new arrivals land.
- `verified_role:@Community Member`: The role granted upon successful verification. Must sit below Aegis's role in the hierarchy.
- `type:One-Click Button`: Zero-friction single button verification. Switch to `type:CAPTCHA Verification` during raid events for interactive math puzzles.
- `kick_unverified_minutes:30`: Automatically purges accounts that remain unverified after 30 minutes. Set `minutes:0` to disable auto-kicking.
- `/verify user target:@member`: Manually grants verification to a member experiencing client or network issues.
- `/verify batch`: Allows administrators to paste up to 50 user IDs to verify them in a single operation.

### 7.4 Role Selection Panels (Opt-In Pings)

Interactive role selection menus allow members to opt into announcement and incident notifications without administrative intervention.

```bash
/rolepanel create channel:#get-roles role1:@Announcement Ping role2:@Bot Updates Ping role3:@Outage / Status Ping style:Dropdown menu exclusive:false
/rolepanel list
```

- `style:Dropdown menu`: Clean select menu for 3+ roles. Use `style:Buttons` for compact button rows.
- `exclusive:false`: Allows members to select multiple independent roles simultaneously. Set to `true` for mutually exclusive choices (e.g. region or color roles).
- `/rolepanel list`: Displays all active role panels and their unique panel IDs.
- Remove panels when retired using `/rolepanel delete id:<panel-id>`.

### 7.5 Support Ticket System & Transcripts

Aegis provides private, dedicated support ticket channels with automated claim mechanics, inactivity timers, and HTML transcripts.

```bash
/ticket settings log_channel:#ticket-transcripts autoclose_hours:48 transcripts:true
/ticket setup channel:#create-ticket staff_role:@Support Specialist title:Aegis Technical Support description:Click the button below to open a private support ticket with our engineering and support staff.
/ticket claim
/ticket add user:@member
/ticket remove user:@member
/ticket rename name:resolved-ticket
/ticket transcript
/ticket close reason:Issue resolved
```

- `/ticket settings`: Configures the transcript log channel (`#ticket-transcripts`), enables automated transcript posting, and sets an inactivity timeout (default: 48 hours; set to `0` to disable).
- `/ticket setup`: Posts the persistent "Create Ticket" embed in `#create-ticket`. Restricts ticket access to the ticket creator and the `@Support Specialist` staff role.
- **In-Ticket Operations:**
  - `/ticket claim`: Designates the executing staff member as the ticket handler and updates the embed.
  - `/ticket add user:@member` / `/ticket remove user:@member`: Manages user access in the private ticket channel.
  - `/ticket rename name:<name>`: Renames the channel (Discord allows 2 renames per 10 minutes).
  - `/ticket transcript`: Generates an immediate HTML transcript visible only to the executing staff member.
  - `/ticket close reason:<reason>`: Prompts for confirmation, archives the full conversation into an HTML transcript, sends it to `#ticket-transcripts` and the user's DMs, and deletes the channel.

### 7.6 Welcome & Orientation System

Greets verified members upon entry with customized orientation messages and optional auto-roles.

```bash
/welcome channel channel:#welcome
/welcome message
/welcome toggle enabled:true
/welcome preview
/welcome test type:Welcome
```

- `/welcome channel channel:#welcome`: Sets the public reception channel and turns the welcome system on.
- `/welcome message`: Opens an interactive modal form to customize greeting copy. Paste this standard body:

```text
Welcome {user} to the official **{server}**! Please read <#RULES_CHANNEL_ID> and then verify in <#VERIFY_CHANNEL_ID>. You are member #{count}.
```

- **Supported Variables:** `{user}` (mention), `{username}` (plain text handle), `{server}` (guild name), `{count}` (current member count).
- `/welcome preview`: Previews variable substitution using the moderator's account as a stand-in.
- `/welcome test type:Welcome`: Dispatches an actual test greeting to `#welcome`.
- `/welcome role role:@Community Member`: Optional automated role assignment applied immediately upon join.

### 7.7 Community Suggestions System

Democratic crowdsourced feedback loop with persistent voting buttons and real-time staff triage.

```bash
/suggest setup channel:#suggestions
/suggest submit
/suggest consider id:5d0c8a1e-7b3f-4c2e-9a61-2f4b8e9d1c70 reason:Evaluating feasibility
/suggest approve id:5d0c8a1e-7b3f-4c2e-9a61-2f4b8e9d1c70 reason:Approved for implementation
/suggest deny id:5d0c8a1e-7b3f-4c2e-9a61-2f4b8e9d1c70 reason:Out of scope
/suggest info id:5d0c8a1e-7b3f-4c2e-9a61-2f4b8e9d1c70
```

- `/suggest setup channel:#suggestions`: Directs all user submissions into `#suggestions` with upvote/downvote reaction buttons.
- `/suggest submit`: Opens the modal form for community members to submit a title and description.
- `/suggest approve`, `/suggest deny`, `/suggest consider`: Staff commands updating suggestion embed status, attaching an explanatory review note, and dispatching a DM notice to the author.
- `/suggest info id:<id>`: Displays detailed vote counts, voter lists, and review status.

### 7.8 Starboard Highlights & Pinning

Community-curated showcase that highlights top messages receiving threshold reactions.

```bash
/starboard setup channel:#highlights
/starboard threshold count:4
/starboard emoji emoji:⭐
/starboard selfstar allowed:false
/starboard toggle enabled:true
/starboard ignore action:add channel:#bot-playground-1
/starboard top period:Past 7 days
```

- `/starboard setup channel:#highlights`: Links the starboard output feed to `#highlights`.
- `/starboard threshold count:4`: Requires 4 star reactions before a message is mirrored.
- `/starboard emoji emoji:⭐`: Customizes the trigger emoji (supports custom server emojis).
- `/starboard selfstar allowed:false`: Disallows authors from starring their own messages.
- `/starboard ignore action:add channel:#bot-playground-1`: Excludes noisy sandbox or staff channels from triggering the starboard.
- `/starboard top period:Past 7 days`: Generates a leaderboard of top-starred messages and contributors.

### 7.9 Comprehensive Automod & Safety Shield

Aegis provides deep real-time content filtering across 8 distinct vectors: blocked words, link whitelists, invite blocking, mention spam, rapid messaging, duplicate flood, excessive capitals, and emoji walls.

```bash
/automod words toggle enabled:true
/automod words action action:Delete and warn
/automod words add word:free nitro
/automod words list
/automod links toggle enabled:true
/automod links action action:Delete message
/automod links allow domain:github.com
/automod invites toggle enabled:true
/automod invites action action:Delete and warn
/automod invites allow code:discord.gg/HwTbCYC4PM
/automod mentions toggle enabled:true
/automod mentions limit count:5
/automod mentions action action:Delete and timeout
/automod spam toggle enabled:true
/automod spam limit max:5 window:4
/automod spam action action:Delete and timeout
/automod duplicates toggle enabled:true
/automod duplicates limit repeats:3 window:60
/automod duplicates action action:Delete message
/automod caps toggle enabled:true
/automod caps limit percent:80
/automod caps action action:Delete message
/automod emoji toggle enabled:true
/automod emoji limit max:10 zalgo:true
/automod emoji action action:Delete message
/automod timeout minutes:10
/automod exempt addrole role:@Support Specialist
/automod exempt addrole role:@Moderator
/automod exempt addchannel channel:#bot-playground-1
/automod exempt addchannel channel:#bot-playground-2
/automod status
```

- **Blocked Words (`/automod words`):** Blocks specific terms or scam phrases (2–100 characters). Automatically catches variations. Actions: `Delete message`, `Delete and warn`, `Delete and timeout`.
- **Link Filter (`/automod links`):** Strips all unauthorized hyperlinks. Whitelist trusted domains using `/automod links allow domain:domain.com`.
- **Discord Invites (`/automod invites`):** Blocks invite links to other Discord servers. The server's own vanity URL is always permitted; whitelist partners with `/automod invites allow code:discord.gg/partner`.
- **Mention-Spam Filter (`/automod mentions`):** Limits mass pings (users, roles, `@everyone`). Set to trigger at 5 mentions with an automated timeout.
- **Rapid-Message Spam (`/automod spam`):** Enforces a rate limit (5 messages within 4 seconds) to prevent script flooding and copypasta spam.
- **Duplicate Message Flood (`/automod duplicates`):** Catches repeated identical messages across multiple channels (3 repeats within 60 seconds).
- **Excessive Caps (`/automod caps`):** Deletes messages with over 80% capital letters.
- **Emoji Walls & Zalgo (`/automod emoji`):** Catches emoji floods (max 10 emoji) and strips glitchy zalgo text fonts.
- **Default Timeout Duration (`/automod timeout minutes:10`):** Sets the penalty duration applied whenever an automod rule triggers a timeout.
- **Exemptions (`/automod exempt`):** Completely exempts staff roles (`@Support Specialist`, `@Moderator`) and testing sandboxes (`#bot-playground-1`, `#bot-playground-2`) from automod penalties.
- **Status Dashboard (`/automod status`):** Displays all active rules and interactive toggles.

### 7.10 Automated Escalation Ladder

Automates progressive discipline so repeat offenders receive escalating sanctions without requiring manual staff intervention.

```bash
/escalation toggle enabled:true
/escalation add warnings:3 action:Timeout duration:60
/escalation add warnings:5 action:Timeout duration:1440
/escalation add warnings:7 action:Ban
/escalation expiry days:30
/escalation status
```

- **Ladder Rules:**
  - `3 warnings` -> Automated **1-Hour Timeout** (`duration:60`).
  - `5 warnings` -> Automated **24-Hour Timeout** (`duration:1440`).
  - `7 warnings` -> Permanent **Server Ban**.
- **Warning Expiry (`/escalation expiry days:30`):** Warnings older than 30 days expire automatically and no longer count toward escalation thresholds.
- `/escalation status`: Displays configured thresholds, active actions, and expiry windows.

### 7.11 Advanced Staff Command Suite

#### ModMail (Inbound DM Relay)
```bash
/modmail setup channel:#modmail role:@Support Specialist ping_staff:false enabled:true
/modmail reply message:Thanks for reaching out, looking into this now anonymous:true
/modmail snippet add name:ticket content:For logs or account details, please open a ticket in #create-ticket.
/modmail snippet add name:docs content:The full setup guide is linked in #official-links.
/modmail snippet use name:ticket
/modmail block user:@member
/modmail close reason:Resolved
```
- Inbound member DMs to Aegis open private forum posts in `#modmail`.
- Staff reply using `/modmail reply`, quick buttons, or prefixing chat with `=`.
- Standardized responses are saved and recalled using `/modmail snippet`.
- Closing a thread via `/modmail close` archives the conversation and posts a summary in `#mod-logs`.

#### Staff Digest (Weekly Analytics)
```bash
/digest setup channel:#staff-digest day:Monday hour:9 timezone:America/Chicago
/digest preview
```
- Automatically publishes a weekly Monday morning briefing to `#staff-digest`.
- Summarizes moderation actions per moderator, join/leave volume, automod catches, incidents, and pending tickets.

#### Incident Mode (Raid Defense)
```bash
/incident auto enabled:true joins:10 seconds:30
/incident start reason:Raid detected duration:1h slowmode:10 pause_invites:true
/incident status
/incident end reason:Raid cleared
```
- Auto-triggers when 10 accounts join within 30 seconds, or manually via `/incident start`.
- Automatically locks public channels, gates new joins, slows chats, and pauses invites.
- `/incident end` restores channels, slowmodes, and permissions to their exact pre-raid states.

#### Trust Score Engine
```bash
/trust config enabled:true preset:balanced threshold:30 incident_gate:true
/trust user user:@member
```
- Evaluates account trustworthiness (0–100) based on age, verification, infraction history, and chat tenure.
- Low-trust accounts below threshold 30 are subject to stricter automod link checks and incident gates.

#### Ghost Watch (Covert Surveillance)
```bash
/watchlist add user:@member duration:7 Days events:All Events reason:Alt account alert_channel:#watchlist-alerts
/watchlist list
/watchlist info user:@member
/watchlist remove user:@member
```
- Silently monitors high-risk members and dispatches private DM alerts and posts to `#watchlist-alerts` whenever the member speaks, joins voice, or updates roles.

#### Mass Moderation & Action Commands
```bash
/massban user_ids:123456789012345678 reason:Raid cleanup
/purge amount:50 filter:Bot messages only
/lock channel channel:#general-discussion duration:15m reason:Cooldown
/case view case_id:65f0c0ffee0000000000abcd
```
- `/massban`: Bans multiple raid accounts by user ID in a single action.
- `/purge`: Bulk removes messages with optional filters (bots, links, specific users).
- `/lock channel`: Temporarily revokes send permissions for cooling down chat.
- `/case view`: Looks up complete moderation records, notes, and staff attributions.

### 7.12 Economy & Gamification Playground

Optional virtual economy for engagement testing in `#bot-playground-1`.

```bash
/economy toggle enabled:true
/economy config weekly_amount:500 streak_days:7 bank_cap:50000
/economy give user:@member amount:500 reason:Event prize
/shop add name:Golden trophy price:20000 stock:10
/shop view
/leaderboard
```

- Members earn currency via `/daily`, `/work`, and `/crime`, deposit funds into `/balance`, trade items in `/shop`, and climb the server `/leaderboard`.

---

## 8. Staff Standard Operating Procedures (SOP)

### Incident & Escalation Flow
- **Minor (caps flood, light off-topic, mild spam):** Verbal chat redirection; if ignored, issue a `/warn` with Low severity.
- **Moderate (disrespect, toxicity, repeated automod evasion):** Issue `/warn` with Medium severity; repeat within 10 minutes leads to `/timeout` for 10 minutes.
- **Severe (malicious links, token stealers, severe harassment):** Immediate `/ban` with `delete_messages:1` and evidence logged.
- **Raid:** Initiate Incident Mode immediately via `/incident start`, execute `/massban` on bad actor IDs, purge contaminated chats with `/purge`, and run `/incident end` once threat is neutralized.

### Ticket Handling Protocol
1. **Claiming:** Click **Claim** on the ticket embed or run `/ticket claim` before typing to notify teammates.
2. **Confidentiality:** Direct users to run `/diagnostics` for permission issues. Never request bot tokens, API keys, or database credentials.
3. **Closing:** When resolved, notify the user and invoke `/ticket close reason:Issue resolved`. Aegis dispatches an HTML transcript to `#ticket-transcripts` and the user.

### Case Hygiene
- Every moderation action requires a clear, objective reason.
- Use `/case edit case_id:<id> reason:...` to attach context or update reasons; cases are permanent audit records and cannot be deleted.
- Use `/note add user:@member` for internal staff reminders that do not penalize member Trust Scores.

---

## 9. Incident Response Playbooks

### Playbook A: Coordinated Join Raid
1. **Trigger Incident Mode:** Run `/incident start reason:Raid detected duration:1h slowmode:10 pause_invites:true`.
2. **Identify Accounts:** Check `#mod-logs` for join burst alerts and copy bad actor IDs.
3. **Purge Actors:** Execute `/massban user_ids:<id1,id2,id3> reason:Raid bot accounts`.
4. **Clean Contaminated Channels:** Run `/purge amount:100 filter:Messages with links` in affected channels.
5. **Restore Server:** Run `/incident end reason:Raid resolved`. Aegis restores all previous slowmodes and channel permissions.

### Playbook B: Compromised Staff Account
1. **Revoke Roles:** Administrator immediately strips all staff roles from the compromised account.
2. **Session Terminate:** Issue `/ban user:@compromised reason:Compromised staff account - security lockout`.
3. **Audit Actions:** Review `#mod-logs` and Discord Audit Log to revert any unauthorized channel or permission alterations.
4. **Reinstatement:** Upon confirmed account recovery and 2FA reset, unban with `/unban` and restore roles.

---

## 10. Pre-Launch QA Checklist

- [ ] Aegis is online and `/diagnostics` reports no missing permissions.
- [ ] `/logging test` lands in `#mod-logs`.
- [ ] A test warning appears in `#mod-logs` with a case ID and a working case link.
- [ ] `#verify` grants `@Community Member` and hides itself afterward.
- [ ] Auto-kick works on a test account (or is intentionally disabled).
- [ ] `#get-roles` adds and removes each opt-in role.
- [ ] A test ticket opens, pings `@Support Specialist`, claims, and closes.
- [ ] The closed ticket transcript lands in `#ticket-transcripts`.
- [ ] A join posts a welcome message in `#welcome` with the correct member count.
- [ ] `/welcome channel channel:#welcome` is configured as the welcome target.
- [ ] A starred message reaches `#highlights` after the threshold.
- [ ] `/suggest submit` posts in `#suggestions`; approve and deny both update the embed.
- [ ] AutoMod deletes a test link and a test mention flood, but not in the playground channels.
- [ ] Escalation fires at the configured warning threshold.
- [ ] Announcement channels are published/crossposted correctly.
- [ ] `@everyone` cannot post in read-only channels and cannot see staff channels.
- [ ] Forum tags exist and posting requires a tag.
- [ ] A DM to Aegis from a test account opens a post in `#modmail`; `/modmail reply` reaches the member and `/modmail close` posts a summary in `#mod-logs`.
- [ ] `/digest preview` renders, and `#staff-digest` is set as the digest channel.
- [ ] `/incident start` on a test server slows and locks public channels, and `/incident end` restores them exactly.
- [ ] `/trust user` shows a score with its factors for a test account.
- [ ] Every channel topic from §5 is pasted, and `#status-and-incidents` links https://aegisdeno.fly.dev/status.
- [ ] Apps context menu "Report Message" delivers an audit notice to `#mod-logs`.
- [ ] Member join with risk factors displays color-coded indicators in `#mod-logs`.
- [ ] Invite, dashboard, docs, status, and changelog links in `#official-links` all resolve.

---

*Document version: 3.15.0 • Maintained by the Aegis team • Source (proprietary, for review): https://github.com/watispro1/AegisDeno*
