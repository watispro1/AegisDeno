# Aegis Support & Community Server Setup

> Comprehensive operational guide and configuration manual for the official **Aegis Support & Community** Discord server: roles, categories, channels, permission overrides, forum tag systems, automations, and bot integrations.

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
6. [Forum Architecture & Tag Specifications](#6-forum-architecture--tag-specifications)
   - [6.1 🔧 #self-hosting Forum Tags](#61--self-hosting-forum-tags)
   - [6.2 💻 #api-and-dev-help Forum Tags](#62--api-and-dev-help-forum-tags)
   - [6.3 🐛 #bug-reports Forum Tags](#63--bug-reports-forum-tags)
   - [6.4 📬 #modmail Forum Tags](#64--modmail-forum-tags)
7. [Channel Permissions Breakdown](#7-channel-permissions-breakdown)
8. [Official Aegis Bot Setup & Integration](#8-official-aegis-bot-setup--integration)
9. [Onboarding & Member Journey](#9-onboarding--member-journey)
10. [Staff Standard Operating Procedures (SOP)](#10-staff-standard-operating-procedures-sop)
11. [Pre-Launch QA Checklist](#11-pre-launch-qa-checklist)

---

## 1. Server Foundation & Community Settings

### Server Metadata
- **Server Name:** `Aegis Support & Community`
- **Community Enabled:** Yes *(Required for Announcement channels, Forum channels, Welcome screen, Server Insights, and AutoMod)*
- **Description:** *Official support, development updates, documentation, and community server for the Aegis Discord moderation and management bot.*
- **Server Region / Preferred Locale:** `English (US)`
- **Server Banner & Icon:** Official shield insignia with blurple and ruby accenting.

### Safety & Moderation Setup
- **Verification Level:** `High` *(Must be a member of the server for longer than 10 minutes)*
- **Explicit Media Content Filter:** `Scan media content from all members`
- **Default Notification Settings:** `Only @mentions`
- **2FA Requirement for Moderation:** `Enabled` *(All staff roles with administrative, kick, ban, or role management powers must have 2FA enabled)*

---

## 2. Role Hierarchy & Specifications

Roles must be arranged in the exact order shown below (highest position first) to preserve permission and moderation role hierarchy. Discord prevents any user or bot from modifying, muting, or banning members holding equal or higher roles.

| Position | Role Name | Color Hex | Hoist | Mentionable | Purpose & Qualifications |
|:---:|---|---|:---:|:---:|---|
| **1** | `Founder / Owner` | `#E74C3C` (Ruby Red) | Yes | No | Server owner & core creator. Unrestricted administrative control. |
| **2** | `Lead Developer` | `#9B59B6` (Purple) | Yes | Yes | Core bot software engineers & infrastructure managers. |
| **3** | `Head Moderator` | `#E67E22` (Orange) | Yes | Yes | Leads moderation team, handles escalations, oversees staff actions. |
| **4** | `Moderator` | `#3498DB` (Cyan Blue) | Yes | Yes | Daily community moderation, chat management, purge/mute/warn enforcement. |
| **5** | `Support Specialist` | `#2ECC71` (Emerald) | Yes | Yes | Technical support staff answering tickets and community questions. |
| **6** | `Aegis Bot` | `#5865F2` (Blurple) | Yes | Yes | The official production Aegis bot instance. Elevated permissions. |
| **7** | `System Bots` | `#7289DA` (Steel Blue) | Yes | No | Auxiliary utility bots (GitHub webhooks, uptime monitor, audio test). |
| **8** | `Contributor / Dev` | `#1ABC9C` (Turquoise) | Yes | No | Open-source contributors with accepted PRs or code contributions. |
| **9** | `Bug Hunter` | `#F1C40F` (Gold) | Yes | No | Members who discover and verify critical bugs or security flaws. |
| **10** | `Server Booster` | `#F47FFF` (Nitro Pink) | Yes | No | Nitro boosters supporting the community (auto-managed by Discord). |
| **11** | `VIP / Partner` | `#E91E63` (Magenta) | Yes | No | Verified server owners running Aegis in 1,000+ member guilds or sponsors. |
| **12** | `Active Member` | `#6782B4` (Slate Blue) | No | No | Established active community members rewarded for engagement. |
| **13** | `Community Member` | `#95A5A6` (Light Gray) | No | No | Verified standard member role. Baseline access to public channels. |
| **14** | `Announcement Ping` | `#A0B0C0` (Muted) | No | No | Opt-in role for major release announcements. |
| **15** | `Bot Updates Ping` | `#A0B0C0` (Muted) | No | No | Opt-in role for patch notes, feature updates, and changelogs. |
| **16** | `Outage / Status Ping` | `#A0B0C0` (Muted) | No | No | Opt-in role for maintenance notices and downtime alerts. |
| **17** | `Muted / Quarantine` | `#4F545C` (Dark Gray) | No | No | Restricted role for members placed in cooldown or under investigation. |
| **18** | `@everyone` | None | No | No | Baseline pre-verification role. Restricted read-only view of landing channels. |

---

## 3. Global Permissions Matrix

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
📂 📌 INFORMATION & WELCOME
  ├── 📖 #rules-and-info        [Text | Read-only | Server guide & rules]
  ├── 👋 #welcome               [Text | Read-only | Aegis welcome announcements]
  ├── 📢 #announcements         [Announcement | Read-only | Major news & events]
  ├── 🔄 #bot-updates           [Announcement | Read-only | Release notes & patches]
  ├── 🚨 #status-and-incidents  [Announcement | Read-only | Outages & maintenance]
  └── 🔗 #official-links        [Text | Read-only | Trusted repository & web links]

📂 🛡️ VERIFICATION & ROLES
  ├── 🛡️ #verify                [Text | Interactive verification gate panel]
  └── 🎭 #get-roles             [Text | Interactive opt-in role select panel]

📂 💬 COMMUNITY CHAT
  ├── 💬 #general-discussion    [Text | Slowmode 3s | Main community discussion]
  ├── 🤖 #bot-discussion        [Text | Slowmode 5s | Aegis bot chat & Q&A]
  ├── 🎨 #showcase-setups       [Text | Slowmode 15s | Server setups & dashboards]
  ├── ⭐ #highlights            [Text | Starboard feed for pinned community stars]
  └── 📷 #media-and-memes       [Text | Slowmode 10s | Safe images, media, and clips]

📂 🧪 TESTING & PLAYGROUND
  ├── 🧪 #bot-playground-1      [Text | Slowmode 3s | Public bot command testing]
  ├── 🧪 #bot-playground-2      [Text | Slowmode 3s | Sandbox overflow & economy testing]
  └── 🛡️ #mod-commands-testing  [Text | Staff only | Moderation rehearsal & drills]

📂 🎫 SUPPORT & TICKETS
  ├── 🎫 #create-ticket         [Text | Interactive ticket creation launcher]
  ├── ❓ #faq-quick-help        [Text | Read-only common questions & answers]
  ├── 🔧 #self-hosting          [Forum | Node.js, Docker, Fly.io & MongoDB support]
  └── 💻 #api-and-dev-help      [Forum | Integrations, Webhooks & API support]

📂 💡 FEEDBACK & BUGS
  ├── 💡 #suggestions           [Text | /suggest voting feed & triage]
  └── 🐛 #bug-reports           [Forum | Structured bug tracking with tag workflow]

📂 🔐 STAFF COMMAND & AUDIT
  ├── 💬 #staff-chat            [Text | Private staff operations & coordination]
  ├── 📬 #modmail               [Forum | Inbound member DM ModMail threads]
  ├── 📜 #mod-logs              [Text | Automated Aegis audit logging target]
  ├── 📊 #staff-digest          [Text | Weekly scheduled staff summary digests]
  ├── 🕵️ #watchlist-alerts      [Text | Ghost Watch alerts for monitored targets]
  ├── 📁 #ticket-transcripts    [Text | Automated HTML ticket transcripts]
  └── 🪵 #bot-debug-logs        [Text | Production host deploy notices & logs]

📂 🔊 VOICE LOUNGES
  ├── 🔊 Community Lounge      [Voice | 64kbps | User limit: 25]
  ├── 🎮 Gaming & Screen Share [Voice | 96kbps | User limit: 10]
  ├── 🛡️ Staff Meeting Room    [Voice | 96kbps | Staff roles only]
  └── 💤 AFK                   [Voice | 64kbps | Automatic 15-minute idle move]
```

---

## 5. Channel Reference & Descriptions

Every channel has one distinct responsibility. Below is the operational table for each category, followed by the exact, ready-to-copy **Channel Topic / Description** (under Discord's 1024-character limit).

The shared official web links used across topics are:
- **Website:** https://aegisdeno.fly.dev/
- **Dashboard:** https://aegisdeno.fly.dev/dashboard
- **Commands:** https://aegisdeno.fly.dev/commands
- **Docs:** https://aegisdeno.fly.dev/docs
- **Status:** https://aegisdeno.fly.dev/status
- **Changelog:** https://aegisdeno.fly.dev/changelog
- **Invite:** https://aegisdeno.fly.dev/invite
- **Source:** https://github.com/watispro1/AegisDeno

---

### 5.1 📌 Information & Welcome

| Channel | Type | Who Posts | Slowmode | Permissions | Aegis Integration |
|---|---|---|---|---|---|
| `#rules-and-info` | Text | Staff | Off | `@everyone` view & read history; send off; reactions off | None; staff pin the rules embed (`/embed builder`) |
| `#welcome` | Text | Aegis | Off | `@everyone` view & read history; send off | `/welcome` greets each join here with count |
| `#announcements` | Announcement | Staff | Off | Read-only; reactions on; announcement channel | `/announce crosspost:true` publishes to follower servers |
| `#bot-updates` | Announcement | Staff | Off | Read-only; reactions on; announcement channel | `/announce` with changelog links for each release |
| `#status-and-incidents` | Announcement | Staff | Off | Read-only; announcement channel | Staff post maintenance notices and link live status |
| `#official-links` | Text | Staff | Off | Read-only; reactions off | One pinned embed with verified Aegis ecosystem links |

#### Channel Descriptions (Copy & Paste):

`#rules-and-info`
```text
📖 Read this first. Server rules, community guidelines, and escalation safety nets (3 warnings -> 1h timeout, 5 warnings -> 24h timeout, 7 warnings -> permanent ban; warnings expire after 30 days). Once read, verify in #verify to unlock the community. Documentation: https://aegisdeno.fly.dev/docs
```

`#welcome`
```text
👋 Welcome to Aegis Support & Community! Check out #rules-and-info, then click Verify in #verify to unlock the rest of the server. New to Aegis? Explore guides and quickstarts at https://aegisdeno.fly.dev/docs
```

`#announcements`
```text
📢 Official announcements, major releases, events, and server news for Aegis. Get pinged for major releases by grabbing the Announcement Ping role in #get-roles. Discuss announcements in #general-discussion.
```

`#bot-updates`
```text
🔄 Detailed release notes and patch updates for every Aegis version. Command updates, security improvements, and dashboard overhauls. Full changelog: https://aegisdeno.fly.dev/changelog | Dashboard notes: https://aegisdeno.fly.dev/dashboard/changelog | Ping role: Bot Updates Ping in #get-roles.
```

`#status-and-incidents`
```text
🚨 Outages, degraded performance, maintenance windows, and resolution notices. Check live system health and uptime before reporting issues: https://aegisdeno.fly.dev/status | Ping role: Outage / Status Ping in #get-roles.
```

`#official-links`
```text
🔗 The only trusted Aegis links. Website: https://aegisdeno.fly.dev/ | Invite: https://aegisdeno.fly.dev/invite | Dashboard: https://aegisdeno.fly.dev/dashboard | Docs: https://aegisdeno.fly.dev/docs | Status: https://aegisdeno.fly.dev/status | GitHub: https://github.com/watispro1/AegisDeno | Anyone sharing other links is not affiliated with us.
```

---

### 5.2 🛡️ Verification & Roles

| Channel | Type | Who Posts | Slowmode | Permissions | Aegis Integration |
|---|---|---|---|---|---|
| `#verify` | Text | Aegis | Off | `@everyone` view; send off; `@Community Member` view off | `/verify setup` button panel; auto-kicks unverified in 30m |
| `#get-roles` | Text | Aegis | Off | `@everyone` view off; `@Community Member` view; send off | `/rolepanel create` dropdown menu for ping roles |

#### Channel Descriptions (Copy & Paste):

`#verify`
```text
🛡️ Press the Verify button below to complete verification and unlock community channels. Quick and automated. Unverified accounts are pruned after 30 minutes to defend against raid bots. Need help? DM Aegis to reach support through ModMail.
```

`#get-roles`
```text
🎭 Choose your optional notification roles: Announcement Ping (major milestones), Bot Updates Ping (version changelogs), and Outage / Status Ping (service alerts). Select an option again to remove the role.
```

---

### 5.3 💬 Community Chat

| Channel | Type | Who Posts | Slowmode | Permissions | Aegis Integration |
|---|---|---|---|---|---|
| `#general-discussion` | Text | `@Community Member` | 3s | Send on; Attach Files off; Mention @everyone off | AutoMod: links, mentions, spam, caps |
| `#bot-discussion` | Text | `@Community Member` | 5s | Send on; Mention @everyone off | AutoMod; technical Q&A hub |
| `#showcase-setups` | Text | `@Community Member` | 15s | Send on; Attach Files on | AutoMod; showcase server configurations |
| `#highlights` | Text | Aegis | Off | Read-only for `@Community Member` | Starboard: 4 ⭐ reactions republishes message here |
| `#media-and-memes` | Text | `@Community Member` | 10s | Send on; Attach Files on | AutoMod; excluded from starboard |

#### Channel Descriptions (Copy & Paste):

`#general-discussion`
```text
💬 Main community hub for friendly conversation, bot discussions, and server building. Keep it respectful and family-friendly. Bot questions belong in #bot-discussion, and private issues belong in #create-ticket. React with ⭐ to send great posts to #highlights!
```

`#bot-discussion`
```text
🤖 Talk all things Aegis: setup questions, feature requests, permission guidance, and moderation workflows. Browse commands at https://aegisdeno.fly.dev/commands. Sensitive logs, tokens, or security reports? Open a ticket in #create-ticket.
```

`#showcase-setups`
```text
🎨 Share your server layouts, custom logging channels, AutoMod rule combinations, ticket panels, and dashboard screenshots. Please redact member tokens, internal IDs, and private details before sharing images.
```

`#highlights`
```text
⭐ Starboard highlights! Top community messages that receive 4 or more ⭐ reactions appear here automatically. Self-starring does not count.
```

`#media-and-memes`
```text
📷 Safe-for-work images, videos, community memes, and media. Keep chat relevant to media sharing. Bot support questions belong in #bot-discussion or a support ticket.
```

---

### 5.4 🧪 Testing & Playground

| Channel | Type | Who Posts | Slowmode | Permissions | Aegis Integration |
|---|---|---|---|---|---|
| `#bot-playground-1` | Text | `@Community Member` | 3s | Send on; Use Application Commands on | AutoMod exempt; sandbox commands; periodic purge |
| `#bot-playground-2` | Text | `@Community Member` | 3s | Send on; Use Application Commands on | AutoMod exempt; overflow testing & economy sandbox |
| `#mod-commands-testing` | Text | Staff Roles | Off | Staff roles only; `@everyone` view off | Real cases generated; used for staff drill rehearsals |

#### Channel Descriptions (Copy & Paste):

`#bot-playground-1`
```text
🧪 Primary testing sandbox. Try out public slash commands: /help, /ping, /serverinfo, /userinfo, /poll, /remindme set. AutoMod is disabled here so command syntax won't trigger warnings. Moderation commands are disabled for non-staff. Chat is cleared periodically.
```

`#bot-playground-2`
```text
🧪 Secondary testing sandbox for overflow testing, multi-user polls, reminders, and economy commands (/daily, /work, /balance, /shop). AutoMod is disabled here. Moderation commands are blocked.
```

`#mod-commands-testing`
```text
🛡️ Staff moderation rehearsal chamber. Test /warn, /timeout, /case, /purge, /lock, and /incident drill sequences on test accounts. Every action here generates live audit cases in #mod-logs.
```

---

### 5.5 🎫 Support & Tickets

| Channel | Type | Who Posts | Slowmode | Permissions | Aegis Integration |
|---|---|---|---|---|---|
| `#create-ticket` | Text | Aegis | Off | `@Community Member` view; send off | `/ticket setup` launcher; pings `@Support Specialist` |
| `#faq-quick-help` | Text | Staff | Off | Read-only | Pinned FAQ embeds linking docs & diagnostics |
| `#self-hosting` | Forum | `@Community Member` | 5s / post | Tag required; Create Posts on; auto-archive 7d | Community & staff self-hosting debugging |
| `#api-and-dev-help` | Forum | `@Community Member` | 5s / post | Tag required; Create Posts on; auto-archive 7d | Integration, REST endpoints & PR discussions |

#### Channel Descriptions (Copy & Paste):

`#create-ticket`
```text
🎫 Need confidential technical support? Click "Create Ticket" below to open a private channel between you and our support staff. Use tickets for server setup issues, private logs, and sensitive data. Never share bot tokens or database passwords.
```

`#faq-quick-help`
```text
❓ Instant answers to frequent questions: missing slash commands, required invite permissions (bitfield 1460691659798), hidden channel handling, and dashboard access. Run /diagnostics in your server first! Full documentation: https://aegisdeno.fly.dev/docs
```

`#self-hosting`
```text
🔧 Community forum for self-hosting Aegis via Docker, Fly.io, Node.js, and MongoDB. Search existing posts before creating a thread. Select an accurate tag, include your environment details, and remove private secrets. Repository: https://github.com/watispro1/AegisDeno
```

`#api-and-dev-help`
```text
💻 Building integrations with Aegis or contributing to the codebase? Ask about public endpoints (/api/status, /api/commands), TypeScript conventions, and GitHub PRs. Select a tag for your post. Sensitive credentials must never be posted publicly.
```

---

### 5.6 💡 Feedback & Bugs

| Channel | Type | Who Posts | Slowmode | Permissions | Aegis Integration |
|---|---|---|---|---|---|
| `#suggestions` | Text | Aegis (`/suggest`) | Off | Send off; Use Application Commands on; reactions off | Suggestion embeds with buttons; staff decision updates |
| `#bug-reports` | Forum | `@Community Member` | 10s / post | Tag required; Create Posts on | Bug tracking lifecycle with triage tags |

#### Channel Descriptions (Copy & Paste):

`#suggestions`
```text
💡 Submit feature ideas and improvements using /suggest submit. Upvote or downvote with buttons. Staff review ideas using /suggest approve, consider, or deny with public rationale. You will receive a direct notification when your idea is reviewed!
```

`#bug-reports`
```text
🐛 Report reproducible bugs and unexpected behavior. One bug per thread. Include what happened, steps to reproduce, and your /about version. Tag your post accurately. Critical vulnerabilities should be submitted to https://aegisdeno.fly.dev/security instead.
```

---

### 5.7 🔐 Staff Command & Audit

`@everyone` and `@Community Member` have View Channel denied for this entire category. Staff roles can inspect every channel; only `#staff-chat` and `#modmail` permit staff messages.

| Channel | Type | Who Posts | Slowmode | Permissions | Aegis Integration |
|---|---|---|---|---|---|
| `#staff-chat` | Text | Staff | Off | Staff send on; read history on | Private staff coordination hub |
| `#modmail` | Forum | Aegis + Staff | Off | Forum; staff send in posts on; Aegis manages threads | `/modmail setup` routes member DMs into active forum posts |
| `#mod-logs` | Text | Aegis | Off | Staff view; send off | Moderation actions, Incident Mode transitions, ModMail closes |
| `#staff-digest` | Text | Aegis | Off | Staff view; send off | `/digest setup` automated weekly moderation summary |
| `#watchlist-alerts` | Text | Aegis | Off | Staff view; send off | Ghost Watch alerts for monitored members |
| `#ticket-transcripts` | Text | Aegis | Off | Staff view; send off | Automated HTML transcript uploads for closed tickets |
| `#bot-debug-logs` | Text | Aegis + Webhooks | Off | Staff view; send off | Production deployment notices, uptime pings, runtime errors |

#### Channel Descriptions (Copy & Paste):

`#staff-chat`
```text
🔐 Internal staff communication, moderation shift handoffs, and policy discussions. Always reference case IDs when discussing members. Never leak ModMail or ticket contents outside staff channels.
```

`#modmail`
```text
📬 ModMail inbox. Direct messages sent to Aegis create a private thread here. Reply to users using /modmail reply, interactive reply buttons, snippets (/modmail snippet use), or messages prefixed with =. Plain text stays internal. Conclude with /modmail close.
```

`#mod-logs`
```text
📜 Centralized audit log. Records warnings, timeouts, kicks, bans, unbans, purges, case edits, Incident Mode triggers, and ModMail summaries. Inspect cases with /case view or on the web dashboard: https://aegisdeno.fly.dev/dashboard
```

`#staff-digest`
```text
📊 Automated weekly operations digest posted every Monday at 09:00 US Central. Summarizes moderation volume, active moderators, join/leave metrics, AutoMod hits, open tickets, and unresolved appeals. Preview with /digest preview.
```

`#watchlist-alerts`
```text
🕵️ Real-time Ghost Watch alerts for monitored accounts. Strictly confidential—never quote watch alerts in public channels. Manage alerts with /watchlist list and /watchlist remove.
```

`#ticket-transcripts`
```text
📁 Permanent archive of closed ticket transcripts. Includes opener, staff handlers, closing timestamps, and attached HTML logs. Consult past transcripts before handling repeat support cases.
```

`#bot-debug-logs`
```text
🪵 Automated infrastructure and runtime feed: CI/CD deployment alerts, process restarts, database connection warnings, and cluster health metrics. Check live status at https://aegisdeno.fly.dev/status
```

---

### 5.8 🔊 Voice Lounges

Voice channels use both a **Channel Status** and an internal **Channel Description**:

| Channel | Type | Bitrate | User Limit | Channel Status | Permissions |
|---|---|---|:---:|---|---|
| `🔊 Community Lounge` | Voice | 64 kbps | 25 | `Chill voice chat • 25 max` | `@Community Member` connect & speak |
| `🎮 Gaming & Screen Share` | Voice | 96 kbps | 10 | `Games & screen share • Ask before streaming` | `@Community Member` connect, speak & video |
| `🛡️ Staff Meeting Room` | Voice | 96 kbps | None | `Staff meetings & voice sync` | Staff roles only; `@everyone` view off |
| `💤 AFK` | Voice | 64 kbps | None | `AFK • Idle members land here after 15m` | Connect on; speak off; automatic idle target |

#### Voice Channel Descriptions (Copy & Paste):

`🔊 Community Lounge`
```text
Casual voice chat for Aegis community members. Keep conversations respectful and adhere to server rules.
```

`🎮 Gaming & Screen Share`
```text
Higher-bitrate voice channel for gaming, coding sessions, and screen sharing. Please ask before starting a stream.
```

`🛡️ Staff Meeting Room`
```text
Private voice channel for staff meetings, voice handoffs, and moderation strategy syncs. Restricted to staff roles.
```

`💤 AFK`
```text
Designated inactive channel. Members idle for more than 15 minutes in any voice channel are automatically relocated here.
```

---

### 5.9 Channel Conventions

- **Naming Standard:** Use `emoji-kebab-case` for text and forum channels (e.g., `#bot-discussion`), and clean Title Case with emoji for voice channels (e.g., `🔊 Community Lounge`).
- **Hierarchy:** Information -> Verification -> Community -> Testing -> Support -> Feedback -> Staff -> Voice. Staff categories must always remain at the bottom of the channel list.
- **Slowmodes:** 3 seconds for general chat, 5 seconds for bot discussion & support forums, 10–15 seconds for media/showcases. Off for read-only and staff channels.
- **Audit Trails:** Never delete audit logs or closed ticket transcripts. Retain all case records for security compliance.

---

### 5.10 What Aegis Posts Where

| Aegis Event / Action | Target Channel | Command / Trigger |
|---|---|---|
| Member joins & welcomes | `#welcome` | Automatic gateway `GuildMemberAdd` |
| Verification interactive panel | `#verify` | `/verify setup` |
| Role assignment dropdown | `#get-roles` | `/rolepanel create` |
| Starboard highlight copies | `#highlights` | 4 ⭐ reactions on a community message |
| Moderation cases (warn, timeout, ban, kick, purge, lock) | `#mod-logs` | `/warn`, `/timeout`, `/ban`, `/kick`, `/purge`, `/lock` |
| AutoMod rule violations & deletions | `#mod-logs` | Triggered AutoMod rules (with `modActions` category) |
| Incident Mode start / end / pauses | `#mod-logs` | `/incident start`, `/incident end`, auto-raid triggers |
| Ghost Watch alerts | `#watchlist-alerts` | Monitored member actions via `/watchlist add` |
| Ticket transcripts (HTML) | `#ticket-transcripts` | `/ticket close` or auto-close timer |
| Suggestion submissions & votes | `#suggestions` | `/suggest submit` |
| Scheduled staff digests | `#staff-digest` | Weekly Monday 09:00 cron trigger |
| Inbound member ModMail conversations | `#modmail` | Inbound DM sent to Aegis bot |

---

## 6. Forum Architecture & Tag Specifications

Discord Forum channels require intentional tag design to keep technical queries organized and ensure clear triage workflows. Below are the exact tags, emojis, and moderation settings to configure for every forum.

### 6.1 🔧 #self-hosting Forum Tags

- **Channel Topic:** *Troubleshooting and deployment help for self-hosted Aegis bot instances (Docker, Fly.io, MongoDB, Node.js).*
- **Tag Requirement:** `Require members to select at least one tag` -> **Enabled**
- **Default Reaction:** 💡
- **Default Sort Order:** `Recent Activity`
- **Post Guidelines:** *State your operating system/host, Node.js and MongoDB versions, and the exact error output with all tokens, passwords, and private IPs redacted.*

| Tag Name | Emoji | Moderator Only | Purpose & Usage Guidelines |
|---|:---:|:---:|---|
| `Docker` | 🐳 | No | Container deployments, `Dockerfile`, `docker-compose.yml`, or image build issues. |
| `Fly.io` | 🚀 | No | Fly.io app deployments, `fly.toml`, secrets config, regions, or app scaling. |
| `MongoDB` | 🍃 | No | Database connection strings, Atlas configuration, indexes, or Mongoose schema errors. |
| `Node.js` | 🟩 | No | Node runtime version, dependencies (`package.json`), or TypeScript compilation issues. |
| `Environment` | ⚙️ | No | `.env` variables, missing configuration flags, or token configuration issues. |
| `Permissions` | 🔒 | No | Discord Developer Portal bot permissions, OAuth2 invite bitfield, or missing gateway intents. |
| `Upgrades` | 🔄 | No | Upgrading between Aegis releases or executing database data migrations. |
| `Resolved` | ✅ | **Yes** | Applied by staff when the troubleshooting issue has been successfully answered and resolved. |

---

### 6.2 💻 #api-and-dev-help Forum Tags

- **Channel Topic:** *Developer discussions, custom integrations, REST API endpoints, webhooks, and GitHub pull request guidance.*
- **Tag Requirement:** `Require members to select at least one tag` -> **Enabled**
- **Default Reaction:** 💻
- **Default Sort Order:** `Recent Activity`
- **Post Guidelines:** *Specify the endpoint or service involved. Include relevant code snippets in markdown code blocks. Never share production API keys.*

| Tag Name | Emoji | Moderator Only | Purpose & Usage Guidelines |
|---|:---:|:---:|---|
| `REST API` | 📡 | No | Questions regarding `/api/status`, `/api/commands`, `/api/stats`, or custom JSON routes. |
| `Webhooks` | 🪝 | No | Inbound/outbound webhook integrations, GitHub deploy notifications, or logging hooks. |
| `Architecture` | 🏗️ | No | Questions about Aegis codebase structure, event dispatchers, or service boundaries. |
| `Slash Commands` | ⌨️ | No | Adding, modifying, or registering custom Discord slash commands and option builders. |
| `Dashboard` | 📊 | No | Questions regarding the Express web dashboard, SSR templates, or session cookies. |
| `Contributing` | 🤝 | No | PR discussion, code reviews, local testing harnesses, or contribution guidelines. |
| `Solved` | ✅ | **Yes** | Applied by staff when the architectural or API question has been satisfactorily answered. |

---

### 6.3 🐛 #bug-reports Forum Tags

- **Channel Topic:** *Structured tracking for confirmed Aegis bugs, unexpected crashes, command failures, and regression reports.*
- **Tag Requirement:** `Require members to select at least one tag` -> **Enabled**
- **Default Reaction:** 🔍
- **Default Sort Order:** `Creation Date` (Newest First)
- **Post Guidelines:** *Provide your /about version, steps to reproduce, expected vs. actual behavior, and screenshots or non-sensitive log traces. One bug per thread.*

| Tag Name | Emoji | Moderator Only | Purpose & Usage Guidelines |
|---|:---:|:---:|---|
| `New` | 🆕 | No | Default tag for newly opened member bug reports awaiting staff review. |
| `Investigating` | 🔍 | **Yes** | Applied by developers/moderators actively diagnosing or reproducing the bug. |
| `Confirmed` | ⚠️ | **Yes** | Applied when the bug is confirmed and added to the engineering development queue. |
| `Fixed` | ✅ | **Yes** | Applied when a fix is implemented, tested, and pushed to the release branch. |
| `Not a Bug` | ❌ | **Yes** | Working as designed or caused by missing Discord permissions / invalid server settings. |
| `Needs Info` | ❓ | **Yes** | Applied when the reporter must provide missing logs, reproduction steps, or bot version. |
| `Duplicate` | 🚫 | **Yes** | Applied when the reported issue is already tracked in an existing thread or GitHub issue. |

---

### 6.4 📬 #modmail Forum Tags

- **Channel Topic:** *Private staff forum holding active and archived member direct message conversations routed through Aegis ModMail.*
- **Tag Requirement:** `Require members to select at least one tag` -> **Disabled** *(Aegis auto-creates threads on DM)*
- **Default Reaction:** 📬
- **Default Sort Order:** `Recent Activity`
- **Post Guidelines:** *Staff only. Use /modmail reply or =message to reply to members. Internal comments require no prefix. Close threads with /modmail close.*

| Tag Name | Emoji | Moderator Only | Purpose & Usage Guidelines |
|---|:---:|:---:|---|
| `Open` | 📩 | **Yes** | Active ticket currently awaiting staff response or action. |
| `Pending Member` | ⏳ | **Yes** | Staff have replied and are waiting on the user for additional details. |
| `Appeal` | ⚖️ | **Yes** | Inbound member inquiry appealing a moderation action (warning, timeout, or ban). |
| `Urgent` | 🚨 | **Yes** | High-priority safety issue, active raid, or harassment report requiring immediate attention. |
| `General` | ❓ | **Yes** | General inquiry or administrative question not requiring an engineering ticket. |
| `Closed` | 🔒 | **Yes** | Applied automatically or manually when the conversation has been finalized and archived. |

---

## 7. Channel Permissions Breakdown

Category defaults provide clean baseline security; the per-channel overrides detailed in Section 5 take precedence.

| Category | `@everyone` | `@Community Member` | Staff Roles | `Aegis Bot` |
|---|---|---|---|---|
| **📌 Information & Welcome** | View, Read History; Send off, Reactions off | View, Read History; Reactions on in announcements | Send (Head Mod+), Manage Messages | Send, Embed Links, Attach Files |
| **🛡️ Verification & Roles** | View `#verify` only; Send off | View `#get-roles` only; Send off | View Channels | Send, Embed Links, Manage Roles (below its own) |
| **💬 Community Chat** | View off | View, Send, Embed Links; Mention @everyone off | Manage Messages, Moderate Members | View, Send, Manage Messages, Moderate Members |
| **🧪 Testing & Playground** | View off | View & Send in playgrounds; Commands on | All channels; Staff sandbox | View, Send, Embed Links, Manage Messages |
| **🎫 Support & Tickets** | View off | View `#create-ticket` (no send); Forum Create Posts | View, Manage Threads, Send in Posts | Manage Channels, Manage Roles, Attach Files, Embed Links |
| **💡 Feedback & Bugs** | View off | Use Slash Commands; Forum Create Posts | Manage Threads, Manage Messages | Send, Embed Links, Manage Threads |
| **🔐 Staff Command & Audit** | View off | View off | View; Send in `#staff-chat` & `#modmail` | Send, Embed Links, Attach Files, Manage Threads |

---

## 8. Official Aegis Bot Setup & Integration

Run these commands in order to configure Aegis's native subsystems for this server layout.

### 8.1 Setup Order & Initial Permissions
1. **Invite Aegis:** Ensure it is invited with full scopes and permissions bitfield `1460691659798`.
2. **Role Order:** In Server Settings -> Roles, position the `Aegis Bot` role **above** `Contributor / Dev`, `Community Member`, and all opt-in ping roles.
3. **Verify Health:** Run `/diagnostics` in `#mod-commands-testing`. Confirm all permissions report green checkmarks.

### 8.2 Logging Setup
```bash
/config language language:English (en)
/logging channel channel:#mod-logs
/logging toggle enabled:true
/logging status
/logging test
```
*Use the interactive buttons on `/logging status` to enable all categories: Mod Actions, Member Joins/Leaves, Message Edits/Deletes, Role Changes, Voice Events, and Channel Events.*

### 8.3 Verification Gate Setup
```bash
/verify setup channel:#verify verified_role:@Community Member type:One-Click Button kick_unverified_minutes:30
```

### 8.4 Role Selection Panel
```bash
/rolepanel create channel:#get-roles role1:@Announcement Ping role2:@Bot Updates Ping role3:@Outage / Status Ping style:Dropdown menu exclusive:false
```

### 8.5 Support Ticket System
```bash
/ticket settings log_channel:#ticket-transcripts autoclose_hours:48 transcripts:true
/ticket setup channel:#create-ticket staff_role:@Support Specialist title:"Aegis Technical Support" description:"Click the button below to open a private support ticket with our engineering and support staff."
```

### 8.6 Welcome Greeter
```bash
/welcome channel channel:#welcome
/welcome toggle enabled:true
/welcome message
```
*Paste this into the modal:*
```text
Welcome {user} to the official **{server}**! Please read <#RULES_CHANNEL_ID> and then verify in <#VERIFY_CHANNEL_ID>. You are member #{count}!
```

### 8.7 Suggestions & Starboard
```bash
/suggest setup channel:#suggestions

/starboard setup channel:#highlights
/starboard threshold count:4
/starboard emoji emoji:⭐
/starboard selfstar allowed:false
/starboard toggle enabled:true
/starboard ignore action:add channel:#media-and-memes
```

### 8.8 AutoMod & Escalation
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

/escalation toggle enabled:true
/escalation add warnings:3 action:Timeout duration:60
/escalation add warnings:5 action:Timeout duration:1440
/escalation add warnings:7 action:Ban
/escalation expiry days:30
```

### 8.9 Staff Automation (ModMail, Digest, Incident Mode)
```bash
/modmail setup channel:#modmail role:@Support Specialist ping_staff:false enabled:true
/modmail snippet add name:ticket content:For private server logs or sensitive data, please open a ticket in #create-ticket.
/modmail snippet add name:docs content:The full documentation and setup guide is available at https://aegisdeno.fly.dev/docs.

/digest setup channel:#staff-digest day:Monday hour:9 timezone:America/Chicago

/incident auto enabled:true joins:10 seconds:30
/trust config enabled:true preset:balanced threshold:30 incident_gate:true
```

---

## 9. Onboarding & Member Journey

1. **Arrival:** New member lands in the server, restricted to viewing `#rules-and-info`, `#welcome`, `#announcements`, `#status-and-incidents`, and `#verify`.
2. **Verification:** The member reads guidelines and clicks **Verify** in `#verify`.
3. **Role Assignment:** Aegis assigns `@Community Member` and automatically hides the `#verify` channel from the user.
4. **Notification Tuning:** The member heads to `#get-roles` and selects desired notification roles (Announcements, Updates, Status).
5. **Engagement:** Member participates in `#general-discussion`, tests commands in `#bot-playground-1`, or opens discussions in technical forums.
6. **Support Escalation:** When encountering private issues, the member opens a ticket in `#create-ticket` or DMs Aegis to reach staff via ModMail.

---

## 10. Staff Standard Operating Procedures (SOP)

### Incident & Escalation Flow
- **Minor Infraction** (caps, off-topic, excessive spam): Verbal redirect in chat; if ignored, `/warn severity:Low`.
- **Moderate Infraction** (disrespect, toxic behavior, repeated spam): `/warn severity:Medium`; repeated offenses within 10 minutes -> `/timeout duration:10m`.
- **Severe Infraction** (malicious links, token stealers, hate speech): Immediate `/ban delete_messages:1d` with attached screenshot proof.
- **Raid Event:** Trigger `/incident start`. Aegis immediately slows and locks public channels, gating accounts under 7 days old. Execute targeted purges using `/purge`. Conclude with `/incident end` to restore previous permissions accurately.

### Ticket Resolution Etiquette
1. **Claiming:** Staff members must press **Claim** on the ticket embed (`/ticket claim`) before responding to prevent duplicate staff replies.
2. **Diagnostics:** Ask members to run `/diagnostics` in their server and report output. **Never request bot tokens or database passwords.**
3. **Resolution & Archival:** When solved, inform the member and execute `/ticket close reason:"Issue resolved"`. Aegis automatically posts the HTML transcript to `#ticket-transcripts` and DMs the member.

---

## 11. Pre-Launch QA Checklist

- [ ] Aegis bot is online with green status on `/diagnostics`.
- [ ] `/logging test` successfully delivers an embed to `#mod-logs`.
- [ ] Interactive category buttons on `/logging status` reflect all enabled categories.
- [ ] Clicking **Verify** in `#verify` grants `@Community Member` and hides the channel.
- [ ] Unverified test accounts are pruned after 30 minutes.
- [ ] `#get-roles` dropdown assigns and removes ping roles smoothly.
- [ ] Opening a ticket in `#create-ticket` generates a private thread, pings `@Support Specialist`, claims, and archives upon closing.
- [ ] Closed ticket transcript uploads to `#ticket-transcripts`.
- [ ] Welcome message triggers on join in `#welcome` with accurate member count.
- [ ] 4 ⭐ reactions on a message copies it to `#highlights`.
- [ ] `/suggest submit` publishes embed in `#suggestions`; staff review buttons function properly.
- [ ] AutoMod deletes prohibited links and spam floods across general channels, while playgrounds remain exempt.
- [ ] Escalation fires automatically upon reaching warning thresholds (3 warnings -> timeout).
- [ ] All 4 forum channels have their defined tags configured and posting requirements enforced.
- [ ] Inbound member DM to Aegis creates a new thread in `#modmail`; `/modmail reply` delivers back to the user.
- [ ] `/digest preview` renders cleanly, and `#staff-digest` is registered as the target.
- [ ] `/incident start` on a test guild applies slowmode and locks, and `/incident end` restores prior state.
- [ ] Every channel topic from Section 5 is copied into Discord channel settings.

---

*Document version: 3.8.0 (2026-11-07) • Maintained by the Aegis Core Team • Source: https://github.com/watispro1/AegisDeno*
