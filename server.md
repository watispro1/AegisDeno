# Aegis Support & Community Server Manual

> Official architecture guide, operational manual, and configuration blueprint for the **Aegis Support & Community** Discord server (`v3.14.0`). Covers role hierarchy, permission boundaries, channel architecture, copy-paste topics, bot automation commands, and staff operating procedures.

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
   - [7.2 General & Audit Logging Setup](#72-general--audit-logging-setup)
   - [7.3 Verification Gate](#73-verification-gate)
   - [7.4 Role Selection Panels (Opt-In Pings)](#74-role-selection-panels-opt-in-pings)
   - [7.5 Support Ticket Launcher & Settings](#75-support-ticket-launcher--settings)
   - [7.6 Welcome & Orientation](#76-welcome--orientation)
   - [7.7 Suggestions](#77-suggestions)
   - [7.8 Starboard Highlights](#78-starboard-highlights)
   - [7.9 Automod & Spam Protection](#79-automod--spam-protection)
   - [7.10 Escalation Safety Nets](#710-escalation-safety-nets)
   - [7.11 Staff Tools: ModMail, Digest, Incident Mode, Trust Score, Ghost Watch](#711-staff-tools-modmail-digest-incident-mode-trust-score-ghost-watch)
   - [7.12 Economy (Optional, for the Playground)](#712-economy-optional-for-the-playground)
8. [Onboarding & Member Journey](#8-onboarding--member-journey)
9. [Staff Standard Operating Procedures (SOP)](#9-staff-standard-operating-procedures-sop)
10. [Pre-Launch QA Checklist](#10-pre-launch-qa-checklist)

---

## 1. Server Foundation & Community Settings

### Server Metadata
- **Server Name:** `Aegis Support & Community`
- **Community Enabled:** Yes *(Unlocks Announcements, Forums, Community Onboarding, and Server Insights)*
- **Description:** Official technical support, release notes, documentation, and community hub for Aegis.
- **Preferred Locale:** `English (US)`
- **Server Icon & Banner:** Aegis shield insignia in blurple (`#5865F2`) and dark slate (`#1E1F1E`).

### Core Safety Settings
- **Verification Level:** `High` *(Member of the server for > 10 minutes to post in public channels)*
- **Explicit Media Content Filter:** `Scan media content from all members`
- **Default Notification Settings:** `Only @mentions`
- **2FA Requirement for Moderation:** `Enabled` *(Mandatory for all staff roles)*
- **Automod Defense:** Native Discord AutoMod active in tandem with Aegis's real-time link, mention, and spam filters.

---

## 2. Role Hierarchy & Specifications

Roles **must** stay in the exact vertical order below (highest position first). In Discord, no user or bot can manage, timeout, kick, or ban anyone with an equal or higher role.

| Pos | Role Name | Color Hex | Hoist | Mentionable | Purpose |
|:---:|---|---|:---:|:---:|---|
| **1** | `Founder / Owner` | `#E74C3C` | Yes | No | Server owner; complete administrative control |
| **2** | `Lead Developer` | `#9B59B6` | Yes | Yes | Engineering, releases, infrastructure & production bot management |
| **3** | `Head Moderator` | `#E67E22` | Yes | Yes | Leads moderation team, handles escalations & policy audits |
| **4** | `Moderator` | `#3498DB` | Yes | Yes | Daily chat moderation, purge/timeout/warn enforcement |
| **5** | `Support Specialist` | `#2ECC71` | Yes | Yes | Technical support staff answering tickets and community questions |
| **6** | `Aegis Bot` | `#5865F2` | Yes | Yes | Production Aegis bot instance; must sit above all managed roles |
| **7** | `System Bots` | `#7289DA` | Yes | No | Auxiliary bots (webhooks, GitHub notifications, uptime) |
| **8** | `Contributor / Dev` | `#1ABC9C` | Yes | No | Contributors with accepted pull requests or integrations |
| **9** | `Bug Hunter` | `#F1C40F` | Yes | No | Members who have verified critical security or bug reports |
| **10** | `Server Booster` | `#F47FFF` | Yes | No | Nitro boosters supporting the community (auto-managed) |
| **11** | `VIP / Partner` | `#E91E63` | Yes | No | Server owners running Aegis in 1,000+ member guilds or sponsors |
| **12** | `Active Member` | `#6782B4` | No | No | Established community members rewarded for positive engagement |
| **13** | `Community Member` | `#95A5A6` | No | No | Verified standard member role; baseline access to public channels |
| **14** | `Announcement Ping` | `#A0B0C0` | No | No | Opt-in role for major release announcements |
| **15** | `Bot Updates Ping` | `#A0B0C0` | No | No | Opt-in role for version changelogs and patch notes |
| **16** | `Outage / Status Ping` | `#A0B0C0` | No | No | Opt-in role for maintenance notices and downtime alerts |
| **17** | `Muted / Quarantine` | `#4F545C` | No | No | Restricted role for members placed in cooldown or under investigation |
| **18** | `@everyone` | None | No | No | Baseline pre-verification role; restricted read-only view of landing channels |

---

## 3. Global Permissions Matrix

Key permission delegations across the role tiers:

| Role | Admin | Manage Guild | Manage Roles | Manage Chans | Kick / Ban | Timeout | Mod Messages | View Audit | Send Messages |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `Founder / Owner` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Lead Developer` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Head Moderator` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Moderator` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Support Specialist` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| `Aegis Bot` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `System Bots` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
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
  ├─ ⭐・highlights            [Text | Starboard feed for community-starred posts]
  └─ 📷・media-and-memes       [Text | Slowmode 10s | Safe images, media & clips]

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

Every channel has one clear role. Below is the operational specification for each category, followed by paste-ready **Channel Topics** (plain text, under Discord's 1024-character limit).

Official links used across topics:
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
| `#welcome` | Aegis | Off | Read-only for `@everyone` | `/welcome` greets joins here |
| `#announcements` | Staff | Off | Read-only; announcement channel | `/announce crosspost:true` publishes updates |
| `#bot-updates` | Staff | Off | Read-only; announcement channel | `/announce` with changelog link |
| `#status-and-incidents` | Staff | Off | Read-only; announcement channel | Staff post outages linking status page |
| `#official-links` | Staff | Off | Read-only; reactions off | Pinned embed with official links |

`#rules-and-info`
```text
Read this first. Server rules, how warnings escalate (3 warnings -> 1h timeout, 5 warnings -> 24h timeout, 7 warnings -> ban; warnings expire after 30 days) and where to get help. Then verify in #verify. Full docs: https://aegisdeno.fly.dev/docs
```

`#welcome`
```text
Welcome to Aegis Support & Community! Read #rules-and-info, then press Verify in #verify to unlock the server. New to Aegis? Start at https://aegisdeno.fly.dev/docs
```

`#announcements`
```text
Major Aegis releases, events and server news. Want a ping? Pick Announcement Ping in #get-roles. Discuss in #general-discussion.
```

`#bot-updates`
```text
Release notes for every Aegis version: new commands, changes and fixes. Full history: https://aegisdeno.fly.dev/changelog - Dashboard changes: https://aegisdeno.fly.dev/dashboard/changelog - Ping role: Bot Updates Ping in #get-roles.
```

`#status-and-incidents`
```text
Outages, degraded service and planned maintenance, with an all-clear when it is fixed. Live component status and uptime: https://aegisdeno.fly.dev/status - Check there before reporting downtime. Ping role: Outage / Status Ping in #get-roles.
```

`#official-links`
```text
The only trusted Aegis links. Invite: https://aegisdeno.fly.dev/invite - Dashboard: https://aegisdeno.fly.dev/dashboard - Docs: https://aegisdeno.fly.dev/docs - Status: https://aegisdeno.fly.dev/status - Security: https://aegisdeno.fly.dev/security - Support server: https://discord.gg/HwTbCYC4PM - Source (for review, all rights reserved): https://github.com/watispro1/AegisDeno - Anyone posting other "Aegis" links is not us.
```

---

### 5.2 🛡️ Verification & Roles

| Channel | Who posts | Slowmode | Permissions | Aegis |
|---|---|---|---|---|
| `#verify` | Aegis | Off | `@everyone` read-only; hides after verified | `/verify setup` panel; grants `@Community Member` |
| `#get-roles` | Aegis | Off | `@Community Member` read-only | `/rolepanel create` dropdown for ping roles |

`#verify`
```text
Press Verify below to unlock the server. One click, no forms. Unverified accounts are removed after 30 minutes; you can rejoin any time. Stuck? DM Aegis to reach staff.
```

`#get-roles`
```text
Choose your pings: Announcement Ping (big releases), Bot Updates Ping (every version), Outage / Status Ping (incidents and maintenance). Pick again to remove a role.
```

---

### 5.3 💬 Community Chat

| Channel | Who posts | Slowmode | Permissions | Aegis |
|---|---|---|---|---|
| `#general-discussion` | `@Community Member` | 3s | Send on; Attach Files off; Mention @everyone off | Automod: links, mentions, spam, caps |
| `#bot-discussion` | `@Community Member` | 5s | Send on; Mention @everyone off | Automod; support staff answer here |
| `#showcase-setups` | `@Community Member` | 15s | Send and Attach Files on | Automod |
| `#highlights` | Aegis | Off | Read-only for `@Community Member` | Starboard: 4 reactions copy a message here |
| `#media-and-memes` | `@Community Member` | 10s | Send and Attach Files on | Automod; excluded from the starboard |

`#general-discussion`
```text
General chat for the Aegis community. Be kind and stay safe for work. Feature questions go to #bot-discussion, private problems to a ticket in #create-ticket. React with star to nominate a message for #highlights.
```

`#bot-discussion`
```text
Ask how Aegis works and share setup ideas. Try /help for any command, or browse https://aegisdeno.fly.dev/commands. Logs, tokens or account issues? Open a ticket in #create-ticket instead.
```

`#showcase-setups`
```text
Show off your Aegis setup: logging layouts, automod rules, ticket flows, role panels, dashboard screenshots. Hide member names and IDs before posting.
```

`#highlights`
```text
Community highlights. Messages with 4 star reactions land here automatically; stars on your own message don't count.
```

`#media-and-memes`
```text
Images, clips and memes. Safe for work only. Support questions belong in #bot-discussion or a ticket.
```

---

### 5.4 🧪 Testing & Playground

| Channel | Who posts | Slowmode | Permissions | Aegis |
|---|---|---|---|---|
| `#bot-playground-1` | `@Community Member` | 3s | Send on; Use Application Commands on | Automod-exempt channel; purged regularly |
| `#bot-playground-2` | `@Community Member` | 3s | Same as playground 1 | Same as playground 1 |
| `#mod-commands-testing` | Staff | Off | Staff roles only | Rehearsals create real cases; use test accounts |

`#bot-playground-1`
```text
Try Aegis here: /help, /ping, /serverinfo, /userinfo, /poll, /remindme set. Automod is off in this channel so tests don't get you warned. No moderation commands. Messages are cleared regularly.
```

`#bot-playground-2`
```text
Overflow sandbox for busy times and multi-person tests (polls, reminders). Same rules as #bot-playground-1.
```

`#mod-commands-testing`
```text
Staff sandbox. Rehearse /warn, /timeout, /case, /purge, /massban, /lock and /incident status on a test account only. Every action here creates a real case and a mod-log entry.
```

---

### 5.5 🎫 Support & Tickets

| Channel | Who posts | Slowmode | Permissions | Aegis |
|---|---|---|---|---|
| `#create-ticket` | Aegis | Off | `@Community Member` read-only | `/ticket setup` panel; pings `@Support Specialist` |
| `#faq-quick-help` | Staff | Off | Read-only | Pinned FAQ embed linking docs |
| `#self-hosting` | `@Community Member` | 5s / thread | Forum; tag required; Create Posts on | Auto-archives after 7 days |
| `#api-and-dev-help` | `@Community Member` | 5s / thread | Forum; tag required; Create Posts on | Auto-archives after 7 days |

`#create-ticket`
```text
Need private help? Press Create Ticket for a channel only you and staff can see. Use it for logs, server-specific setups and anything you can't share publicly. Never send your bot token or database password.
```

`#faq-quick-help`
```text
Quick answers: missing slash commands, permissions Aegis needs, hidden channels, appeal codes, where transcripts go. Run /diagnostics in your server first. Full guide: https://aegisdeno.fly.dev/docs
```

`#self-hosting`
```text
Help running your own Aegis: Node.js, MongoDB, Docker, Fly.io and environment variables. Aegis is proprietary: running your own copy needs the maintainer's written permission first (https://aegisdeno.fly.dev/terms#source). One problem per post, pick a tag, include your error with secrets removed. Source and setup: https://github.com/watispro1/AegisDeno
```

`#api-and-dev-help`
```text
Building around Aegis or contributing? Ask about the public JSON (/api/status, /api/commands), the codebase and pull requests. One question per post. Repo: https://github.com/watispro1/AegisDeno
```

---

### 5.6 💡 Feedback & Bugs

| Channel | Who posts | Slowmode | Permissions | Aegis |
|---|---|---|---|---|
| `#suggestions` | Aegis | Off | `@Community Member` App commands on, send off | Suggestion embeds with buttons; updates on staff triage |
| `#bug-reports` | `@Community Member` | 10s / thread | Forum; status tags | Staff triage and lifecycle tags |

`#suggestions`
```text
Suggest a feature with /suggest submit. One idea per suggestion; vote with the buttons. Staff reply with consider, approve or deny and a reason, and you get a DM.
```

`#bug-reports`
```text
Found a bug? One post each: what you did, what you expected, what happened, and the version from /about. Outages go to #status-and-incidents, security issues to https://aegisdeno.fly.dev/security
```

---

### 5.7 🔐 Staff Command & Audit

`@everyone` and `@Community Member` have View Channel **denied** for this category.

| Channel | Who posts | Slowmode | Permissions | Aegis |
|---|---|---|---|---|
| `#staff-chat` | Staff | Off | Staff send on | Internal team coordination |
| `#modmail` | Aegis + staff | Off | Forum; staff send in posts; Aegis manages threads | `/modmail setup` routes member DMs here |
| `#mod-logs` | Aegis | Off | Staff send off | Moderation log target |
| `#staff-digest` | Aegis | Off | Staff send off | `/digest setup` weekly scheduled operations digest |
| `#watchlist-alerts` | Aegis | Off | Staff send off | Ghost Watch alerts from `/watchlist add` |
| `#ticket-transcripts` | Aegis | Off | Staff send off | HTML ticket transcripts posted on ticket close |
| `#bot-debug-logs` | Aegis + webhooks | Off | Staff send off | Deploy and runtime notices from host |

`#staff-chat`
```text
Staff coordination, handoffs and escalations. Mention the case ID when talking about a member, and never paste DM or ModMail content outside staff channels.
```

`#modmail`
```text
One post per member who DMs Aegis. Reply with /modmail reply, the Reply buttons, a snippet (/modmail snippet use) or a message starting with =. Plain chat here stays internal. Close with /modmail close; transcripts stay on the dashboard for 90 days.
```

`#mod-logs`
```text
Aegis audit log: warnings, timeouts, kicks, bans, mass bans, purges, case edits, join risk flags, message reports, Incident Mode steps and ModMail closes. Each entry links its case. Look a case up with /case view or on https://aegisdeno.fly.dev/dashboard
```

`#staff-digest`
```text
Weekly staff digest, Mondays 09:00 US Central: cases by moderator, joins and leaves, automod hits, incidents, low-trust members and open tickets, appeals and ModMail. Preview any time with /digest preview.
```

`#watchlist-alerts`
```text
Ghost Watch alerts for members under watch. Confidential: never quote alerts in public. Manage with /watchlist list and /watchlist remove.
```

`#ticket-transcripts`
```text
Transcripts of closed tickets, with who opened, claimed and closed each one. Search by member name before reopening an issue.
```

`#bot-debug-logs`
```text
Deploy notices and runtime errors for the production bot. Not for member reports. Live health: https://aegisdeno.fly.dev/status
```

---

### 5.8 🔊 Voice Lounges

Voice channels do not have topics. Set the channel **status**:

| Channel | Access | Status to set |
|---|---|---|
| `🔊 Community Lounge` | `@Community Member` - 64kbps - limit 25 | `Chill voice chat - 25 max` |
| `🎮 Gaming & Screen Share` | `@Community Member` - 96kbps - limit 10 | `Games and screen share - ask before streaming` |
| `🛡️ Staff Meeting Room` | Staff only - 96kbps | `Staff meetings only` |
| `💤 AFK` | `@Community Member` - speak off | `AFK - idle members land here after 15 min` |

---

### 5.9 Channel Conventions

- **Names:** `emoji・kebab-case`; voice channels use title case.
- **Order:** Information -> Verification -> Community -> Testing -> Support -> Feedback -> Staff -> Voice. Staff channels never sit above public ones.
- **Topics are documentation:** Paste them from §5 and update this manual first whenever a channel changes.
- **Slowmode:** 3s general chat, 5s discussion & support forums, 10–15s media & showcases, off for read-only and staff channels. During raids, `/incident start` adds slowmode server-wide and restores it upon conclusion.
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

Four specialized Forum channels keep community technical questions and bug reports cleanly triaged:

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
- **Tag Requirement:** Disabled *(Aegis manages threads on inbound DM)*
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
   - `💬 Community & Chat` -> Channels: `#general-discussion`, `#showcase-setups`, `#media-and-memes`
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

Run these commands inside Discord to configure all native bot systems. All option names match the live command catalog (`aegisdeno.fly.dev/commands`).

### 7.1 Setup Order

1. **Invite Aegis** from https://aegisdeno.fly.dev/invite (`bot` and `applications.commands` scopes) and drag `Aegis Bot` above all roles it manages (§2).
2. **Run `/diagnostics`** and resolve any missing permissions. Required bitfield: `1460691659798`.
3. **Audit Logging** (7.2), then **verification** and **role panels** (7.3–7.4).
4. **Tickets, welcome, suggestions and starboard** (7.5–7.8).
5. **Automod and escalation** (7.9–7.10).
6. **Staff tools:** ModMail, staff digest, Incident Mode, Trust Score and Ghost Watch (7.11).
7. **Optional:** Playground economy (7.12).
8. **Verify everything** using the QA checklist in §10.

### 7.2 General & Audit Logging Setup

```bash
/config language language:English (en)
/logging channel channel:#mod-logs
/logging toggle enabled:true
/logging status
/logging test
```

`/logging status` opens the interactive category manager. Use buttons to toggle mod actions, member joins/leaves, message edits/deletes, role changes, and channel events. When member joins logging is active, Aegis automatically attaches join-risk intelligence flags (new accounts under 1d/7d/30d, default avatars, generated names, returning members with prior infractions).

### 7.3 Verification Gate

```bash
/verify setup channel:#verify verified_role:@Community Member type:One-Click Button kick_unverified_minutes:30
```

- `type:One-Click Button` is the standard zero-friction panel. Use `type:CAPTCHA Verification` during active raids.
- Set `kick_unverified_minutes:0` to disable auto-kick, or update later with `/verify autokick minutes:30`.
- `/verify user target:@member` verifies an individual; `/verify batch` verifies multiple accounts.

### 7.4 Role Selection Panels (Opt-In Pings)

```bash
/rolepanel create channel:#get-roles role1:@Announcement Ping role2:@Bot Updates Ping role3:@Outage / Status Ping style:Dropdown menu exclusive:false
```

- `style:Dropdown menu` is clean for 3+ roles; `style:Buttons` is available for short lists.
- `exclusive:false` allows members to pick multiple independent pings.
- Inspect or remove panels with `/rolepanel list` and `/rolepanel delete id:<panel-id>`.

### 7.5 Support Ticket Launcher & Settings

```bash
/ticket settings log_channel:#ticket-transcripts autoclose_hours:48 transcripts:true

/ticket setup channel:#create-ticket staff_role:@Support Specialist title:"Aegis Technical Support" description:"Click the button below to open a private support ticket with our engineering and support staff."
```

- `autoclose_hours:0` disables automatic inactivity closure.
- Inside ticket channels: `/ticket claim`, `/ticket add`, `/ticket remove`, `/ticket rename`, `/ticket transcript`, and `/ticket close`.

### 7.6 Welcome & Orientation

```bash
/welcome channel channel:#welcome
/welcome message
/welcome toggle enabled:true
/welcome preview
```

`/welcome message` opens a modal form. Paste this message body:

```text
Welcome {user} to the official **{server}**! Please read <#RULES_CHANNEL_ID> and then verify in <#VERIFY_CHANNEL_ID>. You are member #{count}.
```

Supported placeholders: `{user}` (mention), `{username}` (plain name), `{server}` (guild name), `{count}` (member count). Test anytime with `/welcome preview`.

### 7.7 Suggestions

```bash
/suggest setup channel:#suggestions
```

Members submit with `/suggest submit`. Staff triage with `/suggest consider`, `/suggest approve`, and `/suggest deny`, each supporting an optional public `reason`.

### 7.8 Starboard Highlights

```bash
/starboard setup channel:#highlights
/starboard threshold count:4
/starboard emoji emoji:⭐
/starboard selfstar allowed:false
/starboard toggle enabled:true
```

- At 4 star reactions, messages are posted to `#highlights`.
- `/starboard ignore action:add channel:#media-and-memes` excludes noisy channels.

### 7.9 Automod & Spam Protection

```bash
/automod links toggle enabled:true
/automod links action action:Delete message
/automod mentions toggle enabled:true
/automod mentions limit count:5
/automod mentions action action:Delete and timeout
/automod spam toggle enabled:true
/automod spam limit max:5 window:4
/automod spam action action:Delete and timeout
/automod caps toggle enabled:true
/automod caps limit percent:80
/automod caps action action:Delete message
/automod exempt addrole role:@Support Specialist
/automod exempt addrole role:@Moderator
/automod exempt addchannel channel:#bot-playground-1
/automod exempt addchannel channel:#bot-playground-2
/automod status
```

Exempt staff roles and the playground channels from filters so tests run without triggering penalties.

### 7.10 Escalation Safety Nets

```bash
/escalation toggle enabled:true
/escalation add warnings:3 action:Timeout duration:60
/escalation add warnings:5 action:Timeout duration:1440
/escalation add warnings:7 action:Ban
/escalation expiry days:30
/escalation status
```

Automatically escalates repeat infractions (3 warnings -> 1h timeout, 5 warnings -> 24h timeout, 7 warnings -> permanent ban). Warnings expire after 30 days.

### 7.11 Staff Tools: ModMail, Digest, Incident Mode, Trust Score, Ghost Watch

```bash
/modmail setup channel:#modmail role:@Support Specialist ping_staff:false enabled:true
/modmail snippet add name:ticket content:For logs or account details, please open a ticket in #create-ticket.
/modmail snippet add name:docs content:The full setup guide is linked in #official-links.

/digest setup channel:#staff-digest day:Monday hour:9 timezone:America/Chicago
/digest preview

/incident auto enabled:true joins:10 seconds:30
/incident status

/trust config enabled:true preset:balanced threshold:30 incident_gate:true
/trust user user:@member
```

- **ModMail:** Inbound member DMs create private forum threads in `#modmail`. Reply with `/modmail reply`, quick buttons, snippets (`/modmail snippet use`), or messages prefixed with `=`. Close with `/modmail close`.
- **Staff Digest:** Weekly operational summary posted Mondays at 09:00 Central to `#staff-digest`.
- **Incident Mode:** Auto-triggers during join bursts (10 joins in 30s) or manually via `/incident start`. Restores exact previous slowmodes and permissions via `/incident end`.
- **Trust Score:** `/trust user` evaluates member risk (0–100) based on tenure, verified status, infractions, and activity.
- **Ghost Watch:** `/watchlist add user:@member reason:Suspected alt account alert_channel:#watchlist-alerts`.
- **Mass Ban:** `/massban user_ids:"ID1 ID2" reason:"Raid cleanup"` quickly purges up to 50 bad actors by ID with confirmation and a single audit case.

### 7.12 Economy (Optional, for the Playground)

Demo economy for `#bot-playground-1`:

```bash
/economy toggle enabled:true
/economy config currency_name:credits currency_emoji:🪙 daily_amount:100 work_min:20 work_max:80
/shop add name:Playground Badge price:2500 description:Bragging rights for active testers stock:100
/shop view
/leaderboard
```

Members use `/daily`, `/work`, `/pay`, `/balance`, `/shop buy`, `/inventory`, `/transactions`, `/rob`, and `/interest`.

---

## 8. Onboarding & Member Journey

1. **Arrival:** New member joins and sees only the read-only information category and `#verify`.
2. **Verification:** Member reviews `#rules-and-info` and clicks **Verify** in `#verify`.
3. **Access Granted:** Aegis assigns `@Community Member` and automatically hides `#verify`.
4. **Role Customization:** Member visits `#get-roles` and selects opt-in notifications.
5. **Support:** For technical help, members use `#self-hosting` / `#api-and-dev-help`, launch a private ticket in `#create-ticket`, or DM Aegis for ModMail assistance.

---

## 9. Staff Standard Operating Procedures (SOP)

### Incident & Escalation Flow
- **Minor (caps, light off-topic, spam):** Friendly chat redirection; if repeated, `/warn` with Low severity.
- **Moderate (disrespect, harassment, toxicity):** `/warn` Medium severity; repeat within 10 minutes -> `/timeout` for 10 minutes.
- **Severe (malicious links, token stealers, hate speech):** Immediate `/ban` with `delete_messages` and evidence attachments.
- **Raid:** Start Incident Mode with `/incident start` (locks public channels, gates new joins, slows chats), clean up via `/massban` or `/purge`, then run `/incident end` to restore channels automatically.

### Ticket Handling Protocol
1. **Claiming:** Click **Claim** on the ticket embed or run `/ticket claim` before replying to prevent duplicate staff intervention.
2. **Confidentiality:** Direct users to run `/diagnostics` for setup issues. Never request bot tokens, API keys, or database credentials.
3. **Closing:** When solved, notify the user and invoke `/ticket close reason:"Issue resolved"`. Aegis generates an HTML transcript and delivers it to `#ticket-transcripts`.

### Case Hygiene
- Every moderation action requires an informative reason.
- Use `/case edit case_id:<id> reason:"..."` when additional context arises; never attempt to delete cases.
- Use `/note add user:@member` for staff notes that should not penalize member Trust Scores.

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

*Document version: 3.14.0 • Maintained by the Aegis team • Source (proprietary, for review): https://github.com/watispro1/AegisDeno*
