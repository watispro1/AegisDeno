# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] — 2026-10-09

This major milestone release marks the **Enterprise Suite & Discovery Launch** for AegisDeno. It delivers enhanced moderation telemetry, complete Top.gg and Discord App Directory launch assets, operational hardening, and expanded community management tooling.

### 🛡️ Moderation & Enterprise Security

- **New:** `/modstats` command — Staff analytics dashboard providing guild-wide warning counts, active timeouts, total ban cases, and AutoMod intervention metrics.
- **Enhanced:** AutoMod repeated offense escalation with customizable strictness presets and automated role-exempt safety filters.
- **Enhanced:** `/case export` with complete audit trails, moderator action timestamps, and standardized JSON compliance formats.

### 🌐 Discovery & Top.gg Ecosystem Integration

- **New:** Comprehensive Top.gg long description, short description, and vote reward webhook protocol documentation.
- **New:** Discord App Directory and Server Discovery profiles with complete permission transparency declarations.
- **Enhanced:** Public web dashboard API (`/api/stats`, `/api/commands`, `/health`) with high-concurrency memory optimization and production health checks.

### ⚡ System Performance & Reliability

- **Hardened:** Database connection resilience with exponential backoff retries and graceful fallback handling during partial network partitions.
- **Hardened:** Scheduled task execution engine with persistent job state recovery following bot restarts.

---

## [2.1.1] — 2026-10-08

This maintenance patch introduces new interactive management commands, expands subcommand alias coverage across core modules, adds manual member verification capabilities, and updates complete server permission architecture documentation.

### 🎮 Interactive Commands & Dashboards

- **New:** `/dashboard` command — interactive server control panel with live metric counters and action buttons (`Refresh Stats`, `AutoMod Status`, `Open Tickets`, `Pending Suggestions`).
- **New:** `/embed` command — interactive custom embed builder with live ephemeral preview and direct channel posting controls (`Send Embed`, `Cancel`).
- **Enhanced:** `/userinfo` command — added interactive buttons (`📜 Warning Details`, `🎭 All Roles`, `🔑 Permissions`).
- **Enhanced:** `/serverinfo` command — added interactive buttons (`💬 Channel Breakdown`, `🎨 Roles & Assets`, `🔒 Security Settings`).
- **Enhanced:** `/warn` command — added interactive action buttons (`📜 Warning History`, `❌ Undo Warn`).

### 💡 Suggestions Workflow Enhancements

- **New:** `/suggest consider` command — marks suggestions as under active review (`🟡 Under Consideration`), applies yellow status styling, and attaches staff review notes while keeping community voting active.
- **New:** Subcommand aliases `/suggest create` (submit) and `/suggest deny` (reject).

### 🛡️ Verification & Member Management

- **New:** `/verify user` command — allows staff with `Manage Roles` permission to manually verify members directly, assigning the configured verified role.

### 🤖 Auto-Responder Improvements

- **New:** Subcommand aliases `/autoresponder create` (add) and `/autoresponder delete` (remove) for improved CLI UX.

### 📑 Architecture Documentation & Linter Alignment

- **Updated:** [`server.md`](file:///c:/Users/mzlad/Downloads/AegisDeno/server.md) updated with explicit category and channel permission overrides across all 6 categories (`INFORMATION`, `COMMUNITY`, `SUPPORT CENTER`, `DEVELOPMENT`, `STAFF ONLY`, `VOICE CHANNELS`).
- **Fixed:** Resolved `MD024/no-duplicate-heading` lint warnings by normalizing section heading anchors.

---

## [2.1.0] — 2026-10-07

This feature-packed release adds major server management systems including Interactive Support Tickets, Member Verification & Anti-Raid, Custom Auto-Responders, Button Role Panels, 1-Click Moderation Presets, Case Editing & Log Exporting, and Activity Digest Summaries.

### 🎫 Interactive Support Tickets

- **New:** `/ticket setup` command — deploy interactive support ticket panels with custom titles, descriptions, and staff role assignments.
- **New:** Private thread/channel creation with automated user & staff permission overwrites.
- **New:** `/ticket close` — closes tickets with audit logs and auto-deletes ticket channels.
- **New:** `/ticket add` and `/ticket remove` — manage member access to active ticket channels.

### 🛡️ Member Verification & Anti-Raid

- **New:** `/verify setup` command — post interactive server verification panels with one-click button or CAPTCHA workflows.
- **New:** `/verify info` and `/verify disable` — inspect or disable anti-raid verification systems.
- **New:** Instant role assignment and audit log tracking for verified members.

### 🤖 Auto-Responder & Custom Triggers

- **New:** `/autoresponder add` — configure custom trigger keywords (`contains`, `exact`, `startsWith`) and automated bot replies.
- **New:** Variable substitution support (`{user}`, `{username}`, `{server}`, `{channel}`, `{member_count}`).
- **New:** `/autoresponder list` and `/autoresponder remove` — manage active auto-responder triggers per guild.

### 🎭 Reaction-Button Role Panels

- **New:** `/rolepanel create` — build interactive multi-button role assignment panels in text channels.
- **New:** `/rolepanel list` and `/rolepanel delete` — manage active role panels.
- **New:** One-click role toggle buttons with instant user feedback.

### ⚙️ 1-Click Moderation Presets

- **New:** `/preset apply` — instantly apply curated moderation templates (`casual`, `community`, `gaming`, `strict`) across automod, spam limits, and warning escalation thresholds.
- **New:** `/preset view` — inspect preset rules and thresholds before applying.

### 📜 Case Management & Log Export

- **New:** `/case view` and `/case edit` — view detailed moderation case logs or update reasons.
- **New:** `/case delete` — remove individual case records with administrator privileges.
- **New:** `/case export` — export complete guild moderation history into a downloadable JSON file attachment.

### 📊 Server Activity Summaries

- **New:** `/activitysummary` command — view server activity digests over 24h, 7d, or 30d (cases, warnings, tickets, suggestions, and autoresponders).

---

## [2.0.0] — 2026-10-06

This is a major release representing a complete hardening and feature expansion of Aegis. It covers reliability, moderation automation, community features, and operational documentation.

### 🛡️ Moderation

- **New:** `/escalation` command — configure automatic warning-threshold actions (timeout, kick, ban). When a user hits a configured warning count, the action is applied instantly and logged.
- **New:** `/modstats` command — guild-wide moderation dashboard showing total cases, total warnings, recent actions, and top offenders.
- **New:** Auto-escalation fires immediately after `/warn`, with a public follow-up message and guild log entry for full transparency.
- **Hardened:** All moderation commands wrapped in `try/catch` with structured error logging.
- **Hardened:** `deferReply` enforced on all commands with DB/API latency to prevent Discord "Interaction not found" errors.
- **Hardened:** Human-readable permission error messages in the executor (e.g. "Moderate Members (Timeout)" instead of raw bitfield numbers).

### 🤖 Automod

- **New:** Spam rate-limiting rule — configurable max messages per time window via `/automod spam`.
- **New:** Safe-list/exemption support — roles and channels can be exempted from all automod rules via `/automod exempt`.
- **New:** Automod now checks message **edits** in addition to new messages.
- **New:** `/automod status` shows a full summary of all enabled rules and recent triggers.
- **Hardened:** Full `try/catch` coverage across all automod execution paths.

### ⏰ Scheduler & Automation

- **New:** **Recurring tasks** — `/automation repeat` schedules a message on a repeating interval (e.g., every 24h). After each execution the task reschedules itself in the DB.
- **Hardened:** Failed tasks retry up to 3 times (1 minute apart) then self-delete from the database.
- **Hardened:** Duplicate task guard prevents double-scheduling on bot restarts.
- **Hardened:** Malformed task validation at startup — skips corrupted records gracefully instead of crashing.
- **Hardened:** Overdue tasks fire in the background immediately on startup without blocking the init sequence.

### 👋 Welcome & Onboarding

- **New:** `/welcome` command — configure welcome messages, auto-assign a role to new members, and customise the message template (`{user}`, `{username}`, `{server}`, `{member_count}`).
- **New:** `welcomeRoleId` field — bot automatically assigns the configured role when a member joins the guild.

### 💡 Suggestions

- **Rewritten:** `/suggest` now has `setup`, `submit`, `approve`, and `reject` subcommands.
- **New:** Suggestions are posted to a designated channel with live 👍/👎 vote buttons that update in real time.
- **New:** Moderators can `/suggest approve` or `/suggest reject` with an optional reason, which updates the embed and disables the voting buttons.
- **New:** `suggestionsChannelId` persisted in guild config.

### 📊 Polls

- **Rewritten:** `/poll` uses Discord's **native poll API** — includes configurable duration (1h, 4h, 8h, 24h, 3d, 7d), multi-select toggle, and up to 10 options.

### ⚙️ Admin & Configuration

- **New:** `/diagnostics` — runs a full server health check: bot permissions, logging channel, welcome channel, automod status, and actionable recommendations.
- **New:** `/escalation` — full CRUD interface for warning-threshold escalation rules.
- **Hardened:** Config normalization now applies safe defaults for all fields, preventing null-pointer errors on new guilds.

### 🌐 Web Dashboard & Deployment

- **Hardened:** Boot sequence reordered: DB → Web Server → Discord Login → Command Registration.
- **Hardened:** Web server uses Gzip compression, `Cache-Control: no-cache` on HTML, and a `/health` endpoint Fly.io uses for health checks.
- **New:** `SITE_URL` used for canonical URLs, Open Graph tags, and sitemap.
- **New:** [`DEPLOYMENT.md`](./DEPLOYMENT.md) — step-by-step guide covering Discord, MongoDB Atlas, Fly.io secrets, health check validation, rollback, and monitoring.
- **New:** [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) — covers startup failures, slash commands, moderation, automod, scheduler, welcome messages, suggestions, web dashboard, and Fly.io deployment.

### 🗄️ Database

- `GuildConfigSchema` extended with: `welcomeRoleId`, `suggestionsChannelId`, `escalation.enabled`, `escalation.thresholds`.
- `TaskSchema` extended with: `intervalMs` for recurring task support.
- `ModerationCaseModel`: added `getRecentCasesForGuild` and `getTopOffendersForGuild` aggregate queries.

---

## [1.2.0] — Earlier

- Initial implementation of moderation commands: `/warn`, `/timeout`, `/kick`, `/ban`, `/unban`, `/clearwarnings`, `/warnings`, `/modhistory`, `/purge`, `/slowmode`, `/nickname`.
- Automod: word filter, link filter, mention spam detection.
- Scheduler: one-off reminders and scheduled channel messages (`/automation remind`, `/automation message`).
- Web dashboard: public command reference, stats, health endpoint.
- Logging service: `sendGuildLog` for structured moderation audit logs.
- Configuration service: guild-scoped settings with safe defaults.
- Suggestion system (basic): submit and vote.
- Poll command (basic): emoji reaction-based.
- Welcome messages (basic): configurable channel and message template.
