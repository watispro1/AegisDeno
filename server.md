# Aegis Support & Community Server Setup

> Comprehensive operational manual, architecture guide, and configuration blueprint for the official **Aegis Support & Community** Discord server: roles, categories, channels, permission overrides, forum tag workflows, Discord Community Onboarding, automations, and bot integrations.

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
- **Community Enabled:** Yes *(Enables Announcement channels, Forums, Welcome Screens, Server Insights, and Native AutoMod)*
- **Description:** *Official technical support, development updates, documentation, and community hub for the Aegis Discord moderation and management platform.*
- **Server Region / Preferred Locale:** `English (US)`
- **Server Icon & Banner:** High-contrast Aegis shield insignia in blurple (`#5865F2`) and deep dark slate (`#1E1F1E`).

### Safety & Moderation Settings
- **Verification Level:** `High` *(Must be a member of the server for longer than 10 minutes to post in public channels)*
- **Explicit Media Content Filter:** `Scan media content from all members`
- **Default Notification Settings:** `Only @mentions`
- **2FA Requirement for Moderation:** `Enabled` *(All staff with administrative, kick, ban, timeout, or role management powers must have 2FA enabled)*
- **Safety Setup:** Native Discord AutoMod rules enabled in tandem with Aegis's real-time filter engine.

---

## 2. Role Hierarchy & Specifications

Roles must be arranged in the exact order shown below (highest position first) to preserve permission and moderation role hierarchy. Discord prevents any user or bot from modifying, muting, or banning members holding equal or higher roles.

| Position | Role Name | Color Hex | Hoist | Mentionable | Purpose & Qualifications |
|:---:|---|---|:---:|:---:|---|
| **1** | `Founder / Owner` | `#E74C3C` (Ruby Red) | Yes | No | Server owner & core creator. Unrestricted administrative control. |
| **2** | `Lead Developer` | `#9B59B6` (Purple) | Yes | Yes | Core software engineers, release managers & infrastructure administrators. |
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
📂 ─── 📌 INFORMATION & WELCOME ───
  ├─ 📜・rules-and-info        [Text | Read-only | Server guide & guidelines]
  ├─ 👋・welcome               [Text | Read-only | Aegis welcome target]
  ├─ 📢・announcements         [Announcement | Read-only | Major news & events]
  ├─ 🚀・bot-updates           [Announcement | Read-only | Version changelogs]
  ├─ 🚨・status-and-incidents  [Announcement | Read-only | Maintenance & uptime]
  └─ 🔗・official-links        [Text | Read-only | Trusted repository & web links]

📂 ─── 🛡️ VERIFICATION & ROLES ───
  ├─ 🛡️・verify                [Text | Interactive verification gate panel]
  └─ 🎭・get-roles             [Text | Interactive role panel for notification pings]

📂 ─── 💬 COMMUNITY CHAT ───
  ├─ 💬・general-discussion    [Text | Slowmode 3s | Main community discussion]
  ├─ 🤖・bot-discussion        [Text | Slowmode 5s | Aegis bot setup & Q&A]
  ├─ 🎨・showcase-setups       [Text | Slowmode 15s | Server configs & layouts]
  ├─ ⭐・highlights            [Text | Starboard feed for community stars]
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

Every channel has one distinct responsibility. Below is the operational table for each category, followed by the exact, ready-to-copy **Channel Topic / Description** (plain text, under Discord's 1024-character limit).

The shared official web links used across topics are:
- Website: https://aegisdeno.fly.dev/
- Status: https://aegisdeno.fly.dev/status
- Features: https://aegisdeno.fly.dev/features
- Commands: https://aegisdeno.fly.dev/commands
- Docs: https://aegisdeno.fly.dev/docs
- Dashboard: https://aegisdeno.fly.dev/dashboard
- Changelog: https://aegisdeno.fly.dev/changelog
- Invite: https://aegisdeno.fly.dev/invite
- Source: https://github.com/watispro1/AegisDeno

---

### 5.1 📌 Information & Welcome

| Channel | Who posts | Slowmode | Permissions | Aegis |
|---|---|---|---|---|
| `#rules-and-info` | Staff | Off | Read-only for `@everyone`; reactions off | None; staff pin the rules embed (`/embed builder`) |
| `#welcome` | Aegis | Off | Read-only for `@everyone` | `/welcome` greets each join here |
| `#announcements` | Staff | Off | Read-only; reactions on; announcement channel | `/announce crosspost:true` publishes to followers |
| `#bot-updates` | Staff | Off | Read-only; reactions on; announcement channel | `/announce` with a changelog link per release |
| `#status-and-incidents` | Staff | Off | Read-only; announcement channel | None; staff post outages and maintenance and link the status page |
| `#official-links` | Staff | Off | Read-only; reactions off | None; one pinned embed with every trusted link |

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
The only trusted Aegis links. Invite: https://aegisdeno.fly.dev/invite - Dashboard: https://aegisdeno.fly.dev/dashboard - Docs: https://aegisdeno.fly.dev/docs - Status: https://aegisdeno.fly.dev/status - Source: https://github.com/watispro1/AegisDeno - Anyone posting other "Aegis" links is not us.
```

---

### 5.2 🛡️ Verification & Roles

| Channel | Who posts | Slowmode | Permissions | Aegis |
|---|---|---|---|---|
| `#verify` | Aegis | Off | `@everyone` view + read history, no send; `@Community Member` view off (hides after verifying) | `/verify setup` panel; grants `@Community Member`; kicks unverified accounts after 30 min |
| `#get-roles` | Aegis | Off | `@everyone` view off; `@Community Member` view, no send | `/rolepanel create` dropdown for the three ping roles |

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
| `#bot-playground-1` | `@Community Member` | 3s | Send on; Use Application Commands on | Automod-exempt channel; purge it weekly |
| `#bot-playground-2` | `@Community Member` | 3s | Same as playground 1 | Same as playground 1 |
| `#mod-commands-testing` | Staff | Off | Staff roles only | Real cases and logs are created; use a test account |

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
Staff sandbox. Rehearse /warn, /timeout, /case, /purge, /lock and /incident status on a test account only. Every action here creates a real case and a mod-log entry.
```

---

### 5.5 🎫 Support & Tickets

| Channel | Who posts | Slowmode | Permissions | Aegis |
|---|---|---|---|---|
| `#create-ticket` | Aegis | Off | `@Community Member` view, no send | `/ticket setup` panel; tickets ping `@Support Specialist` |
| `#faq-quick-help` | Staff | Off | Read-only | None; pinned FAQ embed linking the docs |
| `#self-hosting` | `@Community Member` | 5s per thread | Forum; tag required; Create Posts on | None; threads auto-archive after 7 days |
| `#api-and-dev-help` | `@Community Member` | 5s per thread | Forum; tag required; Create Posts on | None; threads auto-archive after 7 days |

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
Help running your own Aegis: Node.js, MongoDB, Docker, Fly.io and environment variables. One problem per post, pick a tag, include your error with secrets removed. Source and setup: https://github.com/watispro1/AegisDeno
```

`#api-and-dev-help`
```text
Building around Aegis or contributing? Ask about the public JSON (/api/status, /api/commands), the codebase and pull requests. One question per post. Repo: https://github.com/watispro1/AegisDeno
```

---

### 5.6 💡 Feedback & Bugs

| Channel | Who posts | Slowmode | Permissions | Aegis |
|---|---|---|---|---|
| `#suggestions` | Aegis (members use `/suggest submit`) | Off | `@Community Member` Send off, Use Application Commands on, reactions off | Suggestion embeds with votes; staff decisions update the post |
| `#bug-reports` | `@Community Member` | 10s per thread | Forum; tags New, Confirmed, Fixed, Not a bug | None |

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

`@everyone` and `@Community Member` have View Channel off for this whole category. Staff roles can read every channel; only `#staff-chat` and `#modmail` allow staff to send.

| Channel | Who posts | Slowmode | Permissions | Aegis |
|---|---|---|---|---|
| `#staff-chat` | Staff | Off | Staff send on | None |
| `#modmail` | Aegis + staff | Off | Forum; staff Send in Posts on; Aegis Manage Threads | `/modmail setup` opens one post per member DM |
| `#mod-logs` | Aegis | Off | Staff send off | Every moderation action, Incident Mode step, ModMail close summary, Trust settings change |
| `#staff-digest` | Aegis | Off | Staff send off | `/digest setup` posts one summary a week |
| `#watchlist-alerts` | Aegis | Off | Staff send off | Ghost Watch alerts from `/watchlist add` |
| `#ticket-transcripts` | Aegis | Off | Staff send off | HTML transcript of every closed ticket |
| `#bot-debug-logs` | Aegis + webhooks | Off | Staff send off | Deploy and runtime notices from the host |

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
Aegis audit log: warnings, timeouts, kicks, bans, purges, case edits, Incident Mode steps and ModMail closes. Each entry links its case. Look a case up with /case view or on https://aegisdeno.fly.dev/dashboard
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

Voice channels have no topic. Set the channel **status** instead.

| Channel | Access | Status to set |
|---|---|---|
| `🔊 Community Lounge` | `@Community Member` - 64kbps - limit 25 | `Chill voice chat - 25 max` |
| `🎮 Gaming & Screen Share` | `@Community Member` - 96kbps - limit 10 | `Games and screen share - ask before streaming` |
| `🛡️ Staff Meeting Room` | Staff only - 96kbps | `Staff meetings only` |
| `💤 AFK` | `@Community Member` - speak off | `AFK - idle members land here after 15 min` |

---

### 5.9 Channel Conventions

- **Names:** `emoji・kebab-case`; voice channels may use title case.
- **Order:** Information -> Verification -> Community -> Testing -> Support -> Feedback -> Staff -> Voice. Staff channels never sit above public ones.
- **Topics are documentation:** paste them from this section, and update this file first when a channel changes.
- **Slowmode:** 3s general chat, 5s discussion and support forums, 10–15s media and showcases, off for read-only and staff channels. During a raid, `/incident start` adds slowmode everywhere and removes it again when it ends.
- **Read-only means read-only:** staff post through Aegis or with an explicit override.
- **Archive, don't delete:** forum posts auto-archive after 7 days; retired channels are archived so old links keep working.
- **One bot per job:** Aegis owns moderation, ModMail, tickets, verification, role panels, starboard and logging.

---

### 5.10 What Aegis Posts Where

| Aegis event | Destination | Trigger |
|---|---|---|
| Warnings, timeouts, kicks, bans, unbans, purges, case edits | `#mod-logs` | `/warn`, `/timeout`, `/kick`, `/ban`, `/unban`, `/purge`, `/case edit` |
| Incident Mode start, steps and restore | `#mod-logs` | `/incident start`, `/incident end`, the `/incident auto` trigger |
| ModMail conversations / close summaries | `#modmail` / `#mod-logs` | Member DMs Aegis; `/modmail close` |
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

Discord Forum channels organize technical discussions, self-hosting inquiries, bug reports, and inbound member communications. Configure each forum with the following tag definitions and workflows:

#### 1. 🔧 #self-hosting Forum Tags
- **Tag Requirement:** `Require members to select at least one tag` -> **Enabled**
- **Default Reaction:** 💡
- **Default Sort Order:** `Recent Activity`
- **Post Guidelines:** *Specify your deployment host (Docker, Fly.io, Bare Metal VPS), Node.js and MongoDB versions, and the exact error output with all secrets redacted.*

| Tag Name | Emoji | Moderator Only | Purpose & Usage Guidelines |
|---|:---:|:---:|---|
| `Docker` | 🐳 | No | Container setup, `Dockerfile`, `docker-compose.yml`, and container runtime issues. |
| `Fly.io` | 🚀 | No | Fly.io app deployments, `fly.toml`, secrets configuration, and region routing. |
| `MongoDB` | 🍃 | No | MongoDB connection URI, Atlas network access, replica sets, and Mongoose errors. |
| `Node.js` | 🟩 | No | Node runtime version, dependencies (`package.json`), and TypeScript execution. |
| `Environment` | ⚙️ | No | `.env` variables, missing flags, and Discord application token configuration. |
| `Permissions` | 🔒 | No | Discord Developer Portal bot permissions, invite bitfields, and gateway intents. |
| `Upgrades` | 🔄 | No | Version migration steps, database schema adjustments, and upgrade procedures. |
| `Resolved` | ✅ | **Yes** | Applied by staff when the troubleshooting issue has been successfully answered and resolved. |

#### 2. 💻 #api-and-dev-help Forum Tags
- **Tag Requirement:** `Require members to select at least one tag` -> **Enabled**
- **Default Reaction:** 💻
- **Default Sort Order:** `Recent Activity`
- **Post Guidelines:** *Specify the endpoint or service involved. Include relevant code snippets in markdown code blocks. Never share production API keys.*

| Tag Name | Emoji | Moderator Only | Purpose & Usage Guidelines |
|---|:---:|:---:|---|
| `REST API` | 📡 | No | Questions regarding JSON endpoints (/api/status, /api/commands, /api/stats) or custom routes. |
| `Webhooks` | 🪝 | No | Inbound/outbound webhook integrations, GitHub deploy notifications, or logging hooks. |
| `Architecture` | 🏗️ | No | Questions about Aegis codebase structure, event dispatchers, or service boundaries. |
| `Slash Commands` | ⌨️ | No | Adding, modifying, or registering custom Discord slash commands and option builders. |
| `Dashboard` | 📊 | No | Questions regarding the Express web dashboard, SSR templates, or session cookies. |
| `Contributing` | 🤝 | No | PR discussion, code reviews, local testing harnesses, or contribution guidelines. |
| `Solved` | ✅ | **Yes** | Applied by staff when the architectural or API question has been satisfactorily answered. |

#### 3. 🐛 #bug-reports Forum Tags & Lifecycle Workflow
- **Tag Requirement:** `Require members to select at least one tag` -> **Enabled**
- **Default Reaction:** 🔍
- **Default Sort Order:** `Creation Date` (Newest First)
- **Post Guidelines:** *Provide your /about version, steps to reproduce, expected vs. actual behavior, and screenshots or non-sensitive log traces. One bug per thread.*

```
[ Member Submits Bug ] ──> Tag: 🆕 New
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
[ Staff Diagnosing ] ──> 🔍 Investigating        [ Invalid/Expected ] ──> ❌ Not a Bug
        │                                               ▼
        ├──> [ Missing Reproduction Info ] ────> ❓ Needs Info
        │                                               ▼
        ├──> [ Tracked in Existing Issue ] ───> 🚫 Duplicate
        │
        ▼
[ Verified by Team ] ──> ⚠️ Confirmed
        │
        ▼
[ PR Merged / Deployed ] ──> ✅ Fixed
```

| Tag Name | Emoji | Moderator Only | Purpose & Usage Guidelines |
|---|:---:|:---:|---|
| `New` | 🆕 | No | Default tag for newly opened member bug reports awaiting staff review. |
| `Investigating` | 🔍 | **Yes** | Applied by developers/moderators actively diagnosing or reproducing the bug. |
| `Confirmed` | ⚠️ | **Yes** | Applied when the bug is confirmed and added to the engineering development queue. |
| `Fixed` | ✅ | **Yes** | Applied when a fix is implemented, tested, and pushed to the release branch. |
| `Not a Bug` | ❌ | **Yes** | Working as designed or caused by missing Discord permissions / invalid server settings. |
| `Needs Info` | ❓ | **Yes** | Applied when the reporter must provide missing logs, reproduction steps, or bot version. |
| `Duplicate` | 🚫 | **Yes** | Applied when the reported issue is already tracked in an existing thread or GitHub issue. |

#### 4. 📬 #modmail Forum Tags
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

### 5.12 Discord Community Onboarding & Server Guide

Discord Community Onboarding streamlines arrival and grants immediate access to relevant content while maintaining server security:

#### 1. Default Channels (Visible to All Pre-Verification)
New members automatically view these landing channels upon joining:
- `#rules-and-info`
- `#welcome`
- `#announcements`
- `#bot-updates`
- `#status-and-incidents`
- `#official-links`
- `#verify`

#### 2. Pre-Join Customization Questions
Discord prompts joining members with two onboarding questions:
- **Question 1:** *"What brings you to the Aegis community?"*
  - Option A: `💬 Community & Chat` -> Unlocks `#general-discussion`, `#showcase-setups`, `#media-and-memes`
  - Option B: `🔧 Self-Hosting & Deployment` -> Unlocks `#self-hosting` forum
  - Option C: `🤖 Bot Setup & Moderation` -> Unlocks `#bot-discussion` & `#faq-quick-help`
  - Option D: `💻 Developer & API Integrations` -> Unlocks `#api-and-dev-help`
- **Question 2:** *"Which updates would you like to receive?"*
  - Option A: `📢 Major Announcements` -> Assigns `@Announcement Ping`
  - Option B: `🔄 Bot Patch Notes` -> Assigns `@Bot Updates Ping`
  - Option C: `🚨 Outages & Incidents` -> Assigns `@Outage / Status Ping`

#### 3. Server Guide (To-Do List & Resources)
Discord's Server Guide tab presents three onboarding steps for new arrivals:
- **Step 1:** Complete Verification in `#verify` to unlock full server participation.
- **Step 2:** Review notifications in `#get-roles` to customize optional ping roles.
- **Step 3:** Test your first command in `#bot-playground-1` with `/help`.
- **Resource Page:** *"Official Documentation"* -> Highlights `#official-links` and https://aegisdeno.fly.dev/docs.

---

## 6. Channel Permissions Breakdown

Category defaults; the per-channel rows in §5 override these.

| Category | `@everyone` | `@Community Member` | Staff roles | `Aegis Bot` |
|---|---|---|---|---|
| 📌 Information & Welcome | View, read history; no send, threads or reactions | Same; reactions on in announcement channels | Send (Head Moderator and above) | Send, Embed Links, Attach Files |
| 🛡️ Verification & Roles | `#verify` only | `#get-roles` only | View | Send, Embed Links, Manage Roles (below its own role) |
| 💬 Community Chat | View off | View, send, Embed Links; Mention @everyone off | Manage Messages, Moderate Members | View, Manage Messages, Moderate Members |
| 🧪 Testing & Playground | View off | Playgrounds only | All three channels | View, send |
| 🎫 Support & Tickets | View off | View; forum Create Posts; panel channel no send | View, Manage Threads | Manage Channels (creates `ticket-` channels), Manage Roles (adds members), Attach Files (transcripts) |
| 💡 Feedback & Bugs | View off | Use Application Commands; forum Create Posts | Manage Threads | Send, Embed Links |
| 🔐 Staff Command & Audit | View off | View off | View; send in `#staff-chat` and `#modmail` | Send, Embed Links, Attach Files, Create Private Threads, Manage Threads |

- `Muted / Quarantine` has Send Messages, Add Reactions, Create Threads and Connect off in every category.
- Ticket channels (`ticket-<username>`, created by Aegis) deny `@everyone` and allow the opener and the ticket staff role.

---

## 7. Official Aegis Bot Setup & Integration

Run the following commands inside the server using the bot to configure its native subsystems. Option names below match the registered slash commands; if a command changes, `/help` and the public command catalog (`aegisdeno.fly.dev/commands`) are the source of truth.

### 7.1 Setup Order

1. **Invite Aegis** from https://aegisdeno.fly.dev/invite (`bot` and `applications.commands` scopes) and drag `Aegis Bot` above every role it must manage (§2).
2. **Run `/diagnostics`** and fix every missing permission. Aegis needs what its invite asks for (permissions integer `1460691659798`): View Channels, Send Messages, Send Messages in Threads, Create Private Threads, Manage Threads, Embed Links, Attach Files, Read Message History, Manage Messages, Moderate Members, Kick Members, Ban Members, Manage Nicknames, Manage Channels (slowmode, tickets) and Manage Roles (locks, roles, ticket members). `/lock` needs Manage Roles, not Manage Channels. Manage Server is optional: only Incident Mode's "pause invites" uses it.
3. **Logging** (7.2), then **verification** and **role panels** (7.3–7.4).
4. **Tickets, welcome, suggestions and starboard** (7.5–7.8).
5. **Automod and escalation** (7.9–7.10).
6. **Staff tools:** ModMail, staff digest, Incident Mode, Trust Score and Ghost Watch (7.11).
7. **Optional:** the playground economy (7.12).
8. **Test everything** with the checklist in §10.

### 7.2 General & Audit Logging Setup

```bash
/config language language:English (en)
/logging channel channel:#mod-logs
/logging toggle enabled:true
/logging status
/logging test
```

`/logging status` opens the interactive category manager. Use the buttons to toggle mod actions, member joins/leaves, message edits/deletes, role changes, and channel events. There is no `/logging categories` subcommand - the buttons replace it.

### 7.3 Verification Gate

```bash
/verify setup channel:#verify verified_role:@Community Member type:One-Click Button kick_unverified_minutes:30
```

- `type:One-Click Button` is the one-click panel. Use `type:CAPTCHA Verification` if the server is under active raid pressure.
- `kick_unverified_minutes:0` disables auto-kick. Change it later with `/verify autokick minutes:30`.
- `/verify user target:@member` manually verifies a member; `/verify batch` handles a trusted list; `/verify info` shows current settings.

### 7.4 Role Selection Panels (Opt-In Pings)

```bash
/rolepanel create channel:#get-roles role1:@Announcement Ping role2:@Bot Updates Ping role3:@Outage / Status Ping style:Dropdown menu exclusive:false
```

- `style:Buttons` is the default. `style:Dropdown menu` is better for three or more roles.
- `exclusive:true` lets a member hold only one role from the panel; keep `false` for independent notification pings.
- Add `required_role:@Community Member` if the panel should stay gated.
- Inspect or remove panels with `/rolepanel list` and `/rolepanel delete id:<panel-id>`.

### 7.5 Support Ticket Launcher & Settings

```bash
/ticket settings log_channel:#ticket-transcripts autoclose_hours:48 transcripts:true

/ticket setup channel:#create-ticket staff_role:@Support Specialist title:"Aegis Technical Support" description:"Click the button below to open a private support ticket with our engineering and support staff."
```

- `autoclose_hours:0` turns inactivity closing off.
- `transcripts:false` keeps transcripts out of the log channel while still DMing the member.
- `/ticket claim`, `/ticket add`, `/ticket remove`, `/ticket rename`, `/ticket transcript`, and `/ticket close` are used inside the ticket channel.

### 7.6 Welcome & Orientation

```bash
/welcome channel channel:#welcome
/welcome message
/welcome toggle enabled:true
/welcome preview
```

`/welcome message` opens a form rather than taking the text as an option. Paste this into the form, replacing `RULES_CHANNEL_ID` and `VERIFY_CHANNEL_ID` with the real channel IDs:

```text
Welcome {user} to the official **{server}**! Please read <#RULES_CHANNEL_ID> and then verify in <#VERIFY_CHANNEL_ID>. You are member #{count}.
```

Supported variables: `{user}` mentions the member, `{username}` is their display name without a mention, `{server}` is the server name, and `{count}` is the member count. `{member_count}` is kept as an alias. `/welcome preview` renders the message exactly as members will see it before you enable it.

### 7.7 Suggestions

```bash
/suggest setup channel:#suggestions
```

Members submit with `/suggest submit`. Staff triage with `/suggest consider`, `/suggest approve`, and `/suggest deny`, each with an optional public `reason`. `/suggest info id:<id>` shows the full review history.

### 7.8 Starboard Highlights

```bash
/starboard setup channel:#highlights
/starboard threshold count:4
/starboard emoji emoji:⭐
/starboard selfstar allowed:false
/starboard toggle enabled:true
```

- Star a message with ⭐ to nominate it. At four reactions it is copied to `#highlights`.
- `/starboard ignore action:add channel:#media-and-memes` keeps noisy channels out.
- `/starboard config` and `/starboard list` verify the setup.

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

Links, mention floods, message floods and caps are filtered everywhere except the exempt roles and the two playgrounds. Each filter's `action` is Delete message, Delete and warn, or Delete and timeout. Exemptions can also be edited on the dashboard's Automod settings.

### 7.10 Escalation Safety Nets

```bash
/escalation toggle enabled:true
/escalation add warnings:3 action:Timeout duration:60
/escalation add warnings:5 action:Timeout duration:1440
/escalation add warnings:7 action:Ban
/escalation expiry days:30
/escalation status
```

`duration` is in minutes and only applies to the `timeout` action. `expiry days:0` makes warnings count forever.

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

- **ModMail:** members DM Aegis; each conversation becomes a post in `#modmail`. Reply with `/modmail reply`, the Reply buttons, a snippet (`/modmail snippet use`) or a message starting with `=`. `/modmail close` asks to confirm, DMs the member and posts a summary to `#mod-logs`. Use `/modmail block` for abuse. Greeting and close messages are edited on the dashboard's ModMail page.
- **Staff digest:** posts once a week; `/digest disable` stops it. It names members but never pings anyone.
- **Incident Mode:** `/incident auto` starts it when 10 accounts join within 30 seconds. Start it by hand during a raid with `/incident start` (defaults: 1 hour, gates accounts younger than 7 days) and end it early with `/incident end`, which puts back every slowmode, lock and invite it changed. Each step is logged to `#mod-logs`.
- **Trust Score:** `/trust user` shows a member's 0-100 score and why. With `incident_gate:true`, Incident Mode's join gate also catches low-trust joins. The link-filter and low-trust-role integrations stay off unless you turn them on.
- **Ghost Watch:** `/watchlist add user:@member reason:Suspected alt account alert_channel:#watchlist-alerts`, then `/watchlist list` to review.

### 7.12 Economy (Optional, for the Playground)

The economy is off by default. Turn it on here so visitors can try it in `#bot-playground-1`; it is a demo, so keep rewards modest and never sell staff or ping roles.

```bash
/economy toggle enabled:true
/economy config currency_name:credits currency_emoji:🪙 daily_amount:100 work_min:20 work_max:80
/shop add name:Playground Badge price:2500 description:Bragging rights for active testers stock:100
/shop view
/leaderboard
```

- Members use `/daily`, `/work`, `/pay`, `/balance`, `/shop buy` and `/inventory`. The leaderboard never pings.
- `/economy give`, `/economy take` and `/economy reset` are posted to `#mod-logs`. Use them for event prizes, not to settle disputes.
- The badge is an inventory item with no role. If you ever sell a role, keep it cosmetic and below `Aegis Bot` and your own role; Aegis refuses anything higher.

---

## 8. Onboarding & Member Journey

1. **Arrival:** New member joins, sees only `#rules-and-info`, `#welcome`, `#announcements`, `#status-and-incidents`, and `#verify`.
2. **Verification:** Member reviews the rules and clicks the button in `#verify`.
3. **Role Assignment:** Aegis grants `@Community Member` and automatically hides `#verify`.
4. **Notification Setup:** Member visits `#get-roles` and selects opt-in pings (release notices, bot updates, outages).
5. **Support Interaction:** For help, the member posts in `#self-hosting` / `#api-and-dev-help`, presses **Create Ticket** in `#create-ticket`, or DMs Aegis to reach staff through ModMail.

---

## 9. Staff Standard Operating Procedures (SOP)

### Incident & Escalation Flow
- **Minor** (caps, off-topic, light spam): redirect in chat, then `/warn` with severity Low.
- **Moderate** (disrespect, NSFW link attempt, toxicity): `/warn` with severity Medium; repeat within 10 minutes -> `/timeout` for 10 minutes.
- **Severe** (malicious links, token grabbers, hate speech): `/ban` with `delete_messages` and a `proof` attachment.
- **Raid:** `/incident start` (locks public channels, adds slowmode, gates new accounts), clean up with `/purge` (filter: links or bots), and `/incident end` once it is over. Post an update in `#status-and-incidents` only if the bot itself is affected.

### Ticket Resolution Etiquette
1. **Claiming:** Staff members must press **Claim** on the ticket embed (`/ticket claim`) before providing in-depth support to avoid duplicate staff intervention.
2. **Diagnostics:** When troubleshooting user instances, direct them to run `/diagnostics` and provide non-sensitive logs. Never ask for bot tokens or database passwords.
3. **Closing:** When resolved, notify the user and invoke `/ticket close reason:"Issue resolved after configuration update"`. The bot automatically generates an HTML transcript and sends it to `#ticket-transcripts`.

### Case Hygiene
- Every action gets a reason. "No reason provided" is not an audit trail.
- Use `/case edit case_id:<id> reason:"..."` when new context appears; do not delete a case to hide a mistake.
- Link the case ID in `#staff-chat` when escalating so the next moderator can read the history.
- Use `/note add user:@member` for context that should not count toward warnings.

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
- [ ] Invite, dashboard, docs, status, and changelog links in `#official-links` all resolve.

---

*Document version: 3.8.0 (2026-11-07) • Maintained by the Aegis team • Source: https://github.com/watispro1/AegisDeno*
