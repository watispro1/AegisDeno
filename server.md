# 🛡️ AegisDeno Support Server Blueprint & Top.gg Verification Guide

> [!NOTE]
> This document outlines the comprehensive architecture for setting up the official **AegisDeno Support Server**, including role hierarchies, category and channel permission overrides, dual-layer AutoMod configurations, suggestion lifecycles, server rules, command specifications, and Top.gg verification requirements.

---

## 👑 Role Hierarchy & Permissions

> [!IMPORTANT]
> Role hierarchy determines bot moderation authority. Ensure **AegisDeno** is placed **above all standard member and moderation roles** in Server Settings → Roles to allow timeout, kick, and ban execution.

### 🔴 Administration

#### 1. 👑 Aegis Founder

- **Color:** `#FFD700` _(Gold)_
- **Base Permissions:** `ADMINISTRATOR`
- **Description:** Server Owner & Lead Developer. Complete administrative control over all server resources, webhooks, and bot infrastructure.

#### 2. 🛡️ Administrator

- **Color:** `#E74C3C` _(Red)_
- **Base Permissions:** `ADMINISTRATOR`
- **Description:** Top-level community management handling server configuration, security escalations, webhook integrations, and staff oversight.

---

### 🟢 Staff & Support

#### 3. ⚔️ Moderator

- **Color:** `#3498DB` _(Blue)_
- **Base Permissions:** `KICK_MEMBERS`, `BAN_MEMBERS`, `MODERATE_MEMBERS`, `MANAGE_MESSAGES`, `MANAGE_THREADS`, `MUTE_MEMBERS`, `DEAFEN_MEMBERS`, `MOVE_MEMBERS`
- **Description:** Enforces server rules, reviews `/automod` flags, handles `/case` moderation, reviews warning escalations (`/escalation`), and manages community safety.

#### 4. 🛠️ Support Team

- **Color:** `#2ECC71` _(Green)_
- **Base Permissions:** `MANAGE_MESSAGES`, `MANAGE_THREADS`, `CREATE_PUBLIC_THREADS`, `CREATE_PRIVATE_THREADS`, `SEND_MESSAGES_IN_THREADS`
- **Description:** Assists users with bot setup (`/config`, `/automod`, `/ticket`, `/verify`, `/preset`). Answers support tickets without destructive kick/ban permissions.

---

### 🤖 Bot Instances

#### 5. ⚡ AegisDeno (Production Bot)

- **Color:** `#5865F2` _(Blurple)_
- **Base Permissions:** Computed runtime bitfield _(View Channels, Send Messages, Embed Links, Manage Roles, Manage Channels, Moderate Members, Kick Members, Ban Members)_.
- **Description:** Live production instance of AegisDeno. _Never requires full `ADMINISTRATOR` permission._

#### 6. 🧪 Test Bots (Staging)

- **Color:** `#95A5A6` _(Grey)_
- **Base Permissions:** None _(Scoped via specific channel permission overrides)_.
- **Description:** Staging and development builds used for internal feature testing.

---

### 🌐 Community Tiers

#### 7. 🚀 Server Booster

- **Color:** `#F47FFF` _(Pink)_
- **Base Permissions:** `USE_EXTERNAL_EMOJIS`, `USE_EXTERNAL_STICKERS`, `CHANGE_NICKNAME`, `ATTACH_FILES`
- **Description:** Automatically assigned by Discord to active server boosters.

#### 8. 💻 Verified Developer

- **Color:** `#9B59B6` _(Purple)_
- **Base Permissions:** `VIEW_CHANNEL` _(Grants access to hidden developer channels)_.
- **Description:** Recognized open-source contributors and API integration developers.

#### 9. 👤 Member

- **Color:** `#FFFFFF` _(White)_
- **Base Permissions:** `VIEW_CHANNEL`, `SEND_MESSAGES`, `USE_APPLICATION_COMMANDS`, `READ_MESSAGE_HISTORY`, `CONNECT`, `SPEAK`
- **Description:** Standard verified community members.

#### 10. 🚫 Muted / Timed Out

- **Color:** `#2C3E50` _(Dark Grey)_
- **Base Permissions:** `NONE`
- **Description:** Applied dynamically via Discord Timeout API or AegisDeno `/timeout` command.

---

## 📁 Category & Channel Architecture with Explicit Permissions

---

### 📌 1. INFORMATION (Category)

> Category Base Overrides:
>
> - `@everyone`: View Channel: ✅ | Send Messages: ❌ | Add Reactions: ✅

#### 📜 `#rules`

- **Purpose:** Official community guidelines, Terms of Service, and Privacy Policy links.
- **Permissions:**
  - **`@everyone` Role:** View Channel: ✅ | Send Messages: ❌ | Add Reactions: ❌
  - **`Administrator` / `Moderator`:** View Channel: ✅ | Send Messages: ✅ | Embed Links: ✅

#### 📢 `#announcements`

- **Purpose:** AegisDeno release notes, changelogs, patch updates, and service notices.
- **Permissions:**
  - **`@everyone` Role:** View Channel: ✅ | Send Messages: ❌ | Add Reactions: ✅
  - **`Administrator` / `Staff`:** View Channel: ✅ | Send Messages: ✅ | Mention `@everyone`: ✅

#### 🚀 `#getting-started`

- **Purpose:** Step-by-step setup guides for adding AegisDeno and applying 1-click `/preset` configurations.
- **Permissions:**
  - **`@everyone` Role:** View Channel: ✅ | Send Messages: ❌ | Add Reactions: ✅
  - **`Support Team`:** View Channel: ✅ | Send Messages: ✅ | Embed Links: ✅

#### 🔗 `#links`

- **Purpose:** Top.gg listing, documentation site, GitHub repository, and official OAuth2 bot invite links.
- **Permissions:**
  - **`@everyone` Role:** View Channel: ✅ | Send Messages: ❌ | Add Reactions: ❌
  - **`Administrator`:** View Channel: ✅ | Send Messages: ✅ | Embed Links: ✅

#### 🗳️ `#topgg-votes`

- **Purpose:** Automated feed receiving live Top.gg upvote webhook notifications.
- **Permissions:**
  - **`@everyone` Role:** View Channel: ✅ | Send Messages: ❌ _(Read-only feed)_
  - **`AegisDeno (Bot)`:** View Channel: ✅ | Send Messages: ✅ | Embed Links: ✅

---

### 💬 2. COMMUNITY (Category)

> Category Base Overrides:
>
> - `@everyone`: View Channel: ✅ | Send Messages: ✅ | Read Message History: ✅

#### 💬 `#general`

- **Purpose:** Main community discussion chat.
- **Permissions:**
  - **`@everyone` Role:** View Channel: ✅ | Send Messages: ✅ | Attach Files: ✅ | Use External Emojis: ✅
  - **`AegisDeno (Bot)`:** View Channel: ✅ | Send Messages: ✅ | Manage Messages: ✅ _(For AutoMod enforcement)_

#### 🤖 `#bot-commands`

- **Purpose:** Designated public channel for testing slash commands (`/ping`, `/userinfo`, `/serverinfo`, etc.).
- **Permissions:**
  - **`@everyone` Role:** View Channel: ✅ | Send Messages: ✅ | Use Application Commands: ✅
  - **`AegisDeno (Bot)`:** View Channel: ✅ | Send Messages: ✅ | Embed Links: ✅

#### 💡 `#suggestions`

- **Purpose:** Interactive suggestion channel bound to `/suggest` with live voting buttons and status updates.
- **Permissions:**
  - **`@everyone` Role:** View Channel: ✅ | Send Messages: ❌ _(Suggestions submitted via button or `/suggest create`)_ | Add Reactions: ❌
  - **`AegisDeno (Bot)`:** View Channel: ✅ | Send Messages: ✅ | Embed Links: ✅ | Use External Emojis: ✅
  - **`Support Team`:** View Channel: ✅ | Send Messages: ✅ | Manage Threads: ✅

#### 📊 `#polls`

- **Purpose:** Server-wide community polls created via `/poll` using Discord's native poll interface.
- **Permissions:**
  - **`@everyone` Role:** View Channel: ✅ | Send Messages: ❌ | Use Application Commands: ❌ _(Native voting enabled on poll cards)_
  - **`Moderator` / `Administrator`:** View Channel: ✅ | Send Messages: ✅ | Use Application Commands: ✅
  - **`AegisDeno (Bot)`:** View Channel: ✅ | Send Messages: ✅

---

### 🛠️ 3. SUPPORT CENTER (Category)

> Category Base Overrides:
>
> - `@everyone`: View Channel: ✅ | Send Messages: ❌
> - `Support Team`: View Channel: ✅ | Send Messages: ✅

#### 🎟️ `#open-a-ticket`

- **Purpose:** Interactive support panel created via `/ticket setup` for opening private support tickets.
- **Permissions:**
  - **`@everyone` Role:** View Channel: ✅ | Send Messages: ❌ | Read History: ✅
  - **`AegisDeno (Bot)`:** View Channel: ✅ | Send Messages: ✅ | Manage Channels: ✅ | Manage Roles: ✅

#### 🛡️ `#verification`

- **Purpose:** Anti-raid gatekeeper panel created via `/verify setup` for member verification.
- **Permissions:**
  - **`@everyone` Role:** View Channel: ✅ | Send Messages: ❌ | Read History: ✅
  - **`AegisDeno (Bot)`:** View Channel: ✅ | Send Messages: ✅ | Manage Roles: ✅

#### ❓ `#setup-help`

- **Purpose:** Troubleshooting forum for MongoDB connection, environment variables, and deployment.
- **Permissions:**
  - **`@everyone` Role:** View Channel: ✅ | Create Public Threads: ✅ | Send Messages in Threads: ✅
  - **`Support Team`:** View Channel: ✅ | Manage Threads: ✅ | Send Messages: ✅

#### 📚 `#faq`

- **Purpose:** Read-only answers to frequently asked configuration and moderation questions.
- **Permissions:**
  - **`@everyone` Role:** View Channel: ✅ | Send Messages: ❌ | Read History: ✅
  - **`Support Team`:** View Channel: ✅ | Send Messages: ✅ | Embed Links: ✅

---

### 💻 4. DEVELOPMENT (Category)

> Category Base Overrides:
>
> - `@everyone`: View Channel: ❌ _(Hidden from public)_
> - `Verified Developer`: View Channel: ✅ | Send Messages: ✅

#### 💻 `#dev-chat`

- **Purpose:** Developer discussion on TypeScript, discord.js, Deno, and API integrations.
- **Permissions:**
  - **`Verified Developer` Role:** View Channel: ✅ | Send Messages: ✅ | Attach Files: ✅
  - **`Administrator` Role:** View Channel: ✅ | Send Messages: ✅

#### 🐙 `#github-logs`

- **Purpose:** Automated feed receiving GitHub commits, pull requests, issue events, and release webhooks.
- **Permissions:**
  - **`@everyone` Role:** View Channel: ❌
  - **`Verified Developer` Role:** View Channel: ✅ | Send Messages: ❌ _(Read-only feed)_
  - **`GitHub Webhook` / `AegisDeno`:** View Channel: ✅ | Send Messages: ✅ | Embed Links: ✅

#### 🧪 `#beta-testing`

- **Purpose:** Testing ground for unreleased AegisDeno features and staging bot instances.
- **Permissions:**
  - **`Verified Developer` Role:** View Channel: ✅ | Send Messages: ✅ | Use Application Commands: ✅
  - **`Test Bots` Role:** View Channel: ✅ | Send Messages: ✅ | Embed Links: ✅

---

### 🔒 5. STAFF ONLY (Category)

> Category Base Overrides:
>
> - `@everyone`: View Channel: ❌ _(Hidden from public)_
> - `Moderator` / `Administrator`: View Channel: ✅ | Send Messages: ✅

#### 💬 `#staff-chat`

- **Purpose:** Private channel for staff discussions and moderation alignment.
- **Permissions:**
  - **`Moderator` / `Administrator`:** View Channel: ✅ | Send Messages: ✅ | Mention `@everyone`: ✅

#### 📋 `#mod-logs`

- **Purpose:** Automated audit log channel receiving AegisDeno moderation events (`/warn`, `/timeout`, `/kick`, `/ban`, AutoMod actions).
- **Permissions:**
  - **`@everyone` Role:** View Channel: ❌
  - **`Moderator` / `Administrator`:** View Channel: ✅ | Send Messages: ❌ _(Read-only log feed)_
  - **`AegisDeno (Bot)`:** View Channel: ✅ | Send Messages: ✅ | Embed Links: ✅

#### ⚙️ `#bot-config`

- **Purpose:** Private administrative channel for executing `/config`, `/automod`, `/escalation`, and `/preset` safely.
- **Permissions:**
  - **`Administrator` Role:** View Channel: ✅ | Send Messages: ✅ | Use Application Commands: ✅
  - **`AegisDeno (Bot)`:** View Channel: ✅ | Send Messages: ✅ | Embed Links: ✅

---

### 🔊 6. VOICE CHANNELS (Category)

> Category Base Overrides:
>
> - `@everyone`: View Channel: ✅ | Connect: ✅ | Speak: ✅

#### 🔊 `Lounge`

- **Purpose:** Public voice chat room.
- **Permissions:** `@everyone`: Connect: ✅ | Speak: ✅ | Stream: ✅

#### 🎧 `Support Waiting Room`

- **Purpose:** Muted queue channel for users waiting for voice support assistance.
- **Permissions:**
  - **`@everyone` Role:** Connect: ✅ | Speak: ❌ _(Muted on join)_
  - **`Support Team` Role:** Connect: ✅ | Speak: ✅ | Move Members: ✅

#### 🔒 `Staff VC`

- **Purpose:** Private staff voice chat room.
- **Permissions:**
  - **`@everyone` Role:** View Channel: ❌ | Connect: ❌
  - **`Moderator` / `Administrator`:** View Channel: ✅ | Connect: ✅ | Speak: ✅

---

## 🔌 Webhook Channels & Event Integration

Discord webhooks push real-time automated event feeds into dedicated read-only channels.

---

### 🗳️ Top.gg Vote Notifications — `#topgg-votes`

> [!TIP]
> Live vote notifications encourage community engagement and boost your bot's visibility ranking on Top.gg.

- **Purpose:** Receives real-time POST events from Top.gg when a user votes for AegisDeno.
- **Workflow:**
  1. Top.gg sends a POST request to `https://<your-domain>/api/topgg/webhook`.
  2. AegisDeno validates the `Authorization` header against `TOPGG_WEBHOOK_AUTH`.
  3. The vote payload (`user`, `type`, `isWeekend`) is parsed and forwarded to `#topgg-votes` via Discord Webhook.

#### Permission Overrides for `#topgg-votes`

- **`@everyone` Role:** View Channel: ✅ | Send Messages: ❌ _(Read-only feed)_
- **`AegisDeno (Bot)` Role:** View Channel: ✅ | Send Messages: ✅ | Embed Links: ✅

---

### 💡 Suggestion Vote Activity — `#suggestions`

- **Purpose:** Interactive suggestion lifecycle with real-time upvote/downvote buttons and status badges.
- **Workflow:**
  1. User runs `/suggest create` or clicks the **Submit Suggestion** button.
  2. AegisDeno creates a formatted suggestion embed with **👍 Upvote** and **👎 Downvote** buttons.
  3. Vote states are updated in MongoDB with deduplication and vote-switching support.
  4. Staff execute `/suggest approve`, `deny`, or `consider` to update the embed color and badge.

#### Permission Overrides for `#suggestions`

- **`@everyone` Role:** View Channel: ✅ | Send Messages: ❌ | Add Reactions: ❌
- **`AegisDeno (Bot)` Role:** View Channel: ✅ | Send Messages: ✅ | Embed Links: ✅
- **`Support Team` Role:** View Channel: ✅ | Send Messages: ✅ | Manage Threads: ✅

---

### 📊 Poll Events — `#polls`

- **Purpose:** Server-wide polls created via `/poll` using Discord's native poll API.
- **Workflow:**
  1. Staff execute `/poll question:<text> option1:<A> option2:<B> duration:<hours>`.
  2. Discord natively renders poll options, voting progress, and auto-closing timers.
  3. Option deduplication is handled automatically prior to creation.

#### Permission Overrides for `#polls`

- **`@everyone` Role:** View Channel: ✅ | Send Messages: ❌ | Use Application Commands: ❌
- **`Moderator / Admin` Roles:** View Channel: ✅ | Send Messages: ✅ | Use Application Commands: ✅
- **`AegisDeno (Bot)` Role:** View Channel: ✅ | Send Messages: ✅

---

### 🐙 GitHub Activity — `#github-logs`

- **Purpose:** Pushes automated commits, pull requests, issue events, and release announcements into developer channels.
- **Configuration:**
  - Discord Webhook URL format: `https://discord.com/api/webhooks/.../github`
  - GitHub Payload Content-Type: `application/json`

#### Permission Overrides for `#github-logs`

- **`@everyone` Role:** View Channel: ❌ _(Hidden from public)_
- **`Verified Developer` Role:** View Channel: ✅ | Send Messages: ❌ _(Read-only feed)_
- **`Administrator` Role:** View Channel: ✅ | Send Messages: ✅

---

## ⚡ Comprehensive Command Reference & Operational Workflows

Below is the complete specification for all AegisDeno slash command suites, including exact options, permission requirements, and execution workflows.

---

### 1. 🛡️ AutoMod Suite — `/automod`

Provides bot-level content filtering, keyword blocking, domain whitelisting, mention limits, anti-flood enforcement, and role/channel exemptions.

#### `/automod` Subcommands

- **`/automod words enable action:<delete|warn|timeout> log_channel:<#channel>`**
  - Enables the bad word filter with a specified enforcement action and audit logging channel.
- **`/automod words add words:<comma-separated-words>`**
  - Appends new blocked terms or string patterns to the server blacklist.
- **`/automod words remove words:<comma-separated-words>`**
  - Removes terms from the blacklist.
- **`/automod links enable action:<delete|warn|timeout> log_channel:<#channel>`**
  - Enables URL domain filtering.
- **`/automod links whitelist domains:<comma-separated-domains>`**
  - Adds approved domains (e.g., `github.com, top.gg, discord.com`) that bypass the link filter.
- **`/automod mentions enable action:<delete|warn|timeout> max_mentions:<number> log_channel:<#channel>`**
  - Triggers enforcement when a message exceeds the maximum allowed unique mentions.
- **`/automod spam enable action:<delete|warn|timeout> max_messages:<number> time_window:<seconds> log_channel:<#channel>`**
  - Activates anti-flood protection when a user posts too many messages in a short window.
- **`/automod exempt add_role role:<@role>` / `add_channel channel:<#channel>`**
  - Grants specific roles or channels complete exemption from AutoMod evaluation.
- **`/automod status`**
  - Displays a comprehensive dashboard embed showing active filters, action modes, and exempt targets.

---

### 2. 💬 Auto-Responder Suite — `/autoresponder`

Creates automated trigger-response pairs for answering common community questions instantly.

#### `/autoresponder` Subcommands

- **`/autoresponder create trigger:<text> response:<text> match_type:<exact|contains|startswith>`**
  - Registers a new auto-responder. Supports exact string matching, keyword inclusion, or prefix matching.
- **`/autoresponder delete id:<response_id>`**
  - Removes an existing auto-responder by its database ID.
- **`/autoresponder list`**
  - Displays all configured auto-responders for the current server in an interactive embed.

---

### 3. 💡 Suggestions Suite — `/suggest`

Manages community suggestions, interactive upvote/downvote buttons, thread creation, and staff review.

#### `/suggest` Subcommands

- **`/suggest setup channel:<#suggestions>`**
  - Binds AegisDeno's suggestion engine to a target text channel.
- **`/suggest create title:<text> description:<text>`**
  - Submits a suggestion embed with interactive **👍 Upvote** and **👎 Downvote** buttons and opens a discussion thread.
- **`/suggest approve id:<suggestion_id> reason:<text>`**
  - Accepts a suggestion, turns the embed background green, updates the status badge to **Approved**, and locks voting.
- **`/suggest deny id:<suggestion_id> reason:<text>`**
  - Declines a suggestion with staff reasoning, turns the embed red, and locks voting.
- **`/suggest consider id:<suggestion_id> reason:<text>`**
  - Marks a suggestion as under active review (yellow embed).

---

### 4. 🎟️ Ticket Support Suite — `/ticket`

Provides private support ticket channels with automated category management and closing transcripts.

#### `/ticket` Subcommands

- **`/ticket setup channel:<#open-a-ticket> category:<#category>`**
  - Deploys an interactive **Open Ticket** button panel in the setup channel and links new tickets to the target category.
- **`/ticket close reason:<text>`**
  - Closes the active ticket channel, generates an audit record, and cleans up channel permissions.

---

### 5. 🛡️ Verification Gatekeeper — `/verify`

Protects the server against automated bot raids and alt accounts.

#### `/verify` Subcommands

- **`/verify setup channel:<#verification> role:<@Member> type:<button|captcha>`**
  - Deploys a verification panel in the target channel that assigns the verified member role upon completion.
- **`/verify user target:<@user>`**
  - Manually verifies a member, bypassing the interactive verification gate.

---

### 6. ⚔️ Moderation Suite — `/warn`, `/timeout`, `/kick`, `/ban`, `/case`, `/escalation`

Full suite for member discipline, infraction tracking, warning escalation, and audit history.

#### Moderation Command Specifications

- **`/warn target:<@user> reason:<text>`**
  - Issues an official warning to a user, increments their warning count in MongoDB, logs to `#mod-logs`, and checks for warning escalation triggers.
- **`/timeout target:<@user> duration:<minutes> reason:<text>`**
  - Applies a temporary Discord communication timeout to a member.
- **`/kick target:<@user> reason:<text>`**
  - Kicks a member from the server with audit logging.
- **`/ban target:<@user> delete_days:<0-7> reason:<text>`**
  - Permanently bans a user and purges recent message history.
- **`/case view case_id:<number>` / `user target:<@user>`**
  - Retrieves detailed infraction records for a specific case ID or member history.
- **`/escalation set warn_count:<number> action:<timeout|kick|ban> duration:<minutes>`**
  - Configures automated policy rules (e.g., 3 warnings = 60m timeout; 5 warnings = ban).
- **`/escalation view`**
  - Displays current warning escalation thresholds.

---

### 7. ⚙️ Configuration & Presets — `/config`, `/preset`, `/logging`

Administrative commands for guild settings and 1-click server templates.

#### Configuration Command Specifications

- **`/config view`**
  - Displays the active server configuration dashboard (logging channel, verified roles, suggestion channels).
- **`/preset apply preset:<community|gaming|minimal>`**
  - Applies a 1-click complete server configuration template with pre-built AutoMod rules and channel bindings.
- **`/logging channel:<#channel>`**
  - Configures the target channel for automated moderation audit logs.

---

### 8. 📊 Community & Utility Suite — `/dashboard`, `/embed`, `/poll`, `/rolepanel`, `/welcome`, `/userinfo`, `/serverinfo`, `/diagnostics`

- **`/dashboard`**
  - Displays an interactive server control panel with live metric counters (members, active automod rules, open tickets, pending suggestions) and action buttons (`Refresh Stats`, `AutoMod Status`, `Open Tickets`, `Pending Suggestions`).
- **`/embed channel:<#channel> title:<text> description:<text> [color:<hex>] [footer:<text>] [image:<url>]`**
  - Interactive rich embed builder with live ephemeral preview and direct channel dispatch controls (`Send Embed`, `Cancel`).
- **`/poll question:<text> option1:<A> option2:<B> ... duration:<hours>`**
  - Posts a Discord native poll message with multiselect support and auto-deduplicated options.
- **`/rolepanel create title:<text> description:<text> channel:<#roles>`**
  - Posts a self-assignable role menu panel with interactive select menus or buttons.
- **`/welcome setup channel:<#welcome> message:<text> autorole:<@role>`**
  - Configures automated welcome messages and autorole assignment for new joins.
- **`/userinfo [target:<@user>]`**
  - Displays member profile with interactive quick-action buttons (`📜 Warning Details`, `🎭 All Roles`, `🔑 Permissions`).
- **`/serverinfo`**
  - Displays guild overview with interactive exploration buttons (`💬 Channel Breakdown`, `🎨 Roles & Assets`, `🔒 Security Settings`).
- **`/diagnostics`**
  - Runs a diagnostic check reporting gateway ping, uptime, database latency, and memory usage.

---

## 📜 Server Rules Template (`#rules`)

> [!TIP]
> Copy and paste the formatted block below directly into your **`#rules`** channel.

```markdown
# 📜 Server Rules & Community Guidelines

Welcome to the official server! To maintain a safe, welcoming, and productive environment, all members must comply with these guidelines.

### 1. Follow Discord Terms of Service

All activity must strictly adhere to the [Discord Terms of Service](https://dis.gd/tos) and [Discord Community Guidelines](https://dis.gd/guidelines).

### 2. Respectful Communication

- Treat all members with respect. Harassment, slurs, hate speech, toxic behavior, or personal attacks will result in an immediate kick or ban.

### 3. No Unsolicited Advertising

- Self-promotion, invite links, or DM solicitations are strictly forbidden. Post project showcases only in `#showcase`.

### 4. Clean & Age-Appropriate Content

- NSFW content, sexually explicit media, gore, or malicious links/phishing sites are prohibited.

### 5. No Spam or Mass Mentions

- Avoid message flooding, emote spam, or abusing `@everyone`, `@here`, or staff roles.

### 6. On-Topic Channel Usage

- Use channels for their intended purpose. Open support requests in `#open-a-ticket` rather than general chat.

### 7. Respect Staff Decisions

- Server Moderators enforce rules at their discretion. Address concerns privately via support tickets.

### 8. Voice Channel Etiquette

- No loud noise, soundboard spam, or ear-rape audio in voice rooms.

### 9. Account Safety & Impersonation

- Impersonating staff, developers, or other users is prohibited. Suspicious or compromised accounts will be quarantined.

### 10. Automated Escalation

- AegisDeno tracks infractions automatically. Accumulating warnings triggers automated timeouts, kicks, or bans.
```

---

## 🛡️ AutoMod Setup — Dual-Layer Protection Strategy

AegisDeno utilizes a **dual-layer AutoMod architecture**: Gateway-level instant filtering via Discord Native AutoMod (Layer 1) paired with bot-level warning tracking and moderation logging via AegisDeno AutoMod (Layer 2).

```text
                          [ Incoming Message ]
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
       ┌────────────────────────┐    ┌────────────────────────┐
       │ Layer 1: Discord Native│    │  Layer 2: AegisDeno    │
       │    AutoMod (Gateway)   │    │    Bot AutoMod Engine  │
       └────────────┬───────────┘    └────────────┬───────────┘
                    │                             │
        Blocks instantly before msg       Evaluates patterns,
          hits server channels           issues warns/timeouts,
                                         logs to #mod-logs
```

---

### Layer 1: Discord Native AutoMod Configuration

Configure these 3 rules in **Server Settings → Safety Setup → AutoMod**:

#### 1. 🛑 Block Blocked Words

- **Enforced Action:** Block Message + Alert Channel
- **Starter Patterns:** `discord.gg/*`, `free nitro`, `grabify`, `iplogger`, `http://*`, `bit.ly/*`
- **Exemptions:** Administrator & Staff Roles

#### 2. 🛡️ Block Spam Content

- **Enforced Action:** Block Message
- **Details:** Enable built-in Discord spam detection filter
- **Exemptions:** Administrator Roles

#### 3. 📢 Block Mention Spam

- **Enforced Action:** Block Message + 10-Minute Timeout
- **Threshold:** Maximum 5 unique mentions per message
- **Exemptions:** Administrator Roles

---

### Layer 2: AegisDeno `/automod` Slash Command Setup

Run these commands in a private staff channel to configure AegisDeno's internal protection engine:

#### 1. Enable Bad Words & Invite Protection

```bash
/automod words enable action:delete log_channel:#mod-logs
/automod words add words: discord.gg/, iplogger, grabify, bit.ly, tinyurl
```

#### 2. Enable Link Domain Protection

```bash
/automod links enable action:delete log_channel:#mod-logs
/automod links whitelist domains: github.com, top.gg, discord.com, aegisbot.dev
```

#### 3. Enable Mention Spam Enforcement

```bash
/automod mentions enable action:warn max_mentions:5 log_channel:#mod-logs
```

#### 4. Enable Message Flood / Anti-Spam

```bash
/automod spam enable action:timeout max_messages:5 time_window:5s log_channel:#mod-logs
```

#### 5. Configure Role & Channel Exemptions

```bash
/automod exempt add_role role:@Moderator
/automod exempt add_role role:@Admin
/automod exempt add_channel channel:#bot-commands
```

#### 6. Verify Configuration

```bash
/automod status
```

---

### 💬 Auto-Responder Starter Configurations

Set up automated instant answers for common community questions using AegisDeno's `/autoresponder` engine:

```bash
# 1. Server Rules Link
/autoresponder create trigger:!rules response:Please read our full server guidelines in <#rules>! match_type:exact

# 2. Website & Documentation
/autoresponder create trigger:!website response:Explore official docs and features at https://aegisbot.dev! match_type:exact

# 3. Support & Ticket Opening
/autoresponder create trigger:!support response:Need private staff assistance? Open a ticket in <#open-a-ticket>! match_type:exact

# 4. Top.gg Voting Link
/autoresponder create trigger:!vote response:Support AegisDeno by voting daily at https://top.gg/bot/aegisdeno/vote! match_type:exact
```

---

## 🤖 Companion Bots & Integration Architecture

Enhance server operations by combining AegisDeno with targeted companion bots:

#### 🤖 Carl-bot

- **Primary Role:** Reaction Roles & Secondary Logging
- **Channel Scope:** `#roles`, `#mod-logs`
- **Key Benefit:** High reliability for custom legacy reaction role setups.

#### 🤖 YAGPDB

- **Primary Role:** Custom Feeds (RSS / YouTube / Reddit)
- **Channel Scope:** `#announcements`
- **Key Benefit:** Automated external content feed updates.

#### 📊 Statbot

- **Primary Role:** Server Statistics Counters
- **Channel Scope:** Voice Counter Channels
- **Key Benefit:** Real-time channel name member counters.

#### 🛡️ Wick

- **Primary Role:** Anti-Nuke & Security Backup
- **Channel Scope:** Server-wide
- **Key Benefit:** Secondary anti-nuke & anti-bot join security layer.

#### 🐙 GitHub Bot

- **Primary Role:** Git Commit & PR Alerts
- **Channel Scope:** `#github-logs`
- **Key Benefit:** Visual GitHub repository event embeds.

#### 🚨 Sentry / Autocode

- **Primary Role:** Uptime & Error Alerting
- **Channel Scope:** `#server-alerts`
- **Key Benefit:** Real-time infrastructure monitoring.

---

### 🔒 Best Practices for Multi-Bot Management

1. **Restrict Command Permissions:** Disable companion bot slash commands in main chat channels (`#general`); limit command usage to `#bot-commands`.
2. **Isolate Audit Logs:** Keep AegisDeno's `#mod-logs` focused strictly on moderation actions (`/warn`, `/timeout`, `/kick`, `/ban`) to avoid noise.
3. **Maintain Role Hierarchy:** Position the **AegisDeno** bot role near the top of the role list so automated enforcement functions without permission errors.
