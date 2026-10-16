# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.2.0] — 2026-10-15

### 📊 System Telemetry & Status Experience

- **Overhauled:** `/about` command completely rewritten with interactive select-menu navigation across 4 dedicated views:
  - **System Overview:** Version, Node.js runtime, Discord.js library, guild count, protected member total, gateway ping, uptime, and database connectivity.
  - **Runtime Telemetry:** Real-time heap usage with visual ASCII meter (`█░`), RSS, external memory allocation, bot uptime, process uptime, architecture, and PID.
  - **Network & Guilds:** Real-time WebSocket latency probe, cached channel tally, and top 5 largest cached guilds sorted by member count.
  - **Database Diagnostics:** Live MongoDB round-trip ping latency probe (`admin().ping()`), database connection state, database name, and registered Mongoose models.
  - **Refresh & Navigation:** On-demand live metric refresh with an active 2-minute interaction window, disabling gracefully on timeout, plus direct action links to the Web Status Page, Docs, and Dashboard.
- **Redesigned:** `/status` web dashboard completely modernized:
  - **Visual Health Indicator:** Animated pulse dot with dynamic color shifting based on system availability and ping threshold.
  - **30-Day Uptime Bar:** Interactive historical operational bar visualization indicating service stability.
  - **SLA Tier Matrix:** Clear tier definitions (Excellent <100ms, Good <200ms, Degraded <350ms, Unstable >350ms, Offline) with active tier indicator.
  - **Component Health Status:** Granular health rows for Discord Gateway, Command Registry, Web Server, and Guild Coverage.
  - **Endpoint Directory:** Machine-readable quick links to `/health`, `/api/stats`, `/api/commands`, and `/changelog.xml`.
  - **On-Demand Refresh:** Immediate metric recalculation button with 360° spin animation and toast notification.
- **Improved:** Web changelog and releases catalog in `pages.ts` expanded to include v3.2.0 highlights and tag badges.

### 🐛 Bug Fixes

- **Fixed:** `/embed quick` was posting two embeds instead of one. Added immediate `deferReply` so Discord acknowledges within 3 seconds (preventing client retries), plus an in-memory concurrency lock keyed on `userId:channelId` with a 3-second cooldown window.
- **Fixed:** `/embed builder` "Post Embed" button could post duplicate embeds on rapid double-clicks. Added an instant `i.update()` call that clears the action row before `channel.send()` is awaited, and a `posted` boolean guard makes any subsequent click a no-op.
- **Fixed:** Gateway-level interaction deduplication added to `client.ts` — a sliding 60-second `processedInteractions` cache now drops duplicate event deliveries from Discord gateway reconnections/retransmissions before they reach `executeCommand()`.
- **Fixed:** `/purge` crashed with a Discord 400 error when only 1 message matched the filter. Discord's `bulk-delete` endpoint requires 2–100 messages; single-message deletions now fall through to `.delete()` instead.
- **Fixed:** `/warn` undo button bypassed role hierarchy — a lower-ranked moderator could undo warnings on users with equal or higher roles. Hierarchy is now validated before `removeWarning()` is called.
- **Fixed:** `/announce` "Send Announcement" button could double-send if clicked rapidly. Added `isSending` concurrency guard and immediate `i.update()` (stripping action row) before the announcement is dispatched to the target channel.
- **Fixed:** `/poll` live vote count update could throw an unhandled rejection when two users voted simultaneously. `interaction.editReply()` is now wrapped in `.catch(() => null)`.
- **Fixed:** Giveaway ending and rerolling failed silently when the giveaway channel was missing from client cache (cold start or sharded restarts). Now safely fetches from Discord API if the cache misses.
- **Fixed:** `/remindme` with durations exceeding ~24.8 days suffered from Node.js 32-bit signed integer `setTimeout` overflow, causing the reminder to trigger immediately. Maximum duration is now capped to 24 days.
- **Fixed:** `/note view` interactive deletion (`note_del_`) could cause unhandled promise rejections on deleted notes or database errors, and `/note clear` confirmation prompt had a typo ("Cleared cancelled"). Added comprehensive try/catch guards and safe reply handling.
- **Fixed:** `/slowmode` quick-adjust preset buttons remained enabled for "Turn Off" even when slowmode was set to 0s. Button rows are now rebuilt dynamically with updated disabled states.
- **Fixed:** `/suggest approve/deny/consider` allowed staff to re-finalize already approved or rejected suggestions, which could continuously append duplicate "Staff Note" fields until Discord's 25-field limit was exceeded. Added finalization status guards and deduplicated staff note embed fields.
- **Fixed:** `/infractions` pagination collector lacked rejection handlers on `editReply()`, potentially causing unhandled exceptions if the message interaction expired.
- **Fixed:** `/kick` confirmation button allowed potential duplicate kick actions from rapid repeated clicks or race conditions before collector closed. Added execution lock guard.
- **Fixed:** `/ban` cancellation and confirmation handlers now safely catch rejection errors if interaction tokens expire.

### ✨ Quality-of-Life & Navigation Enhancements

- **Website:**
  - **Back-to-Top Floating Button:** Smooth floating button automatically appears when scrolling down on long command, documentation, and troubleshooting pages.
  - **Quick Search Hotkey (`/`):** Pressing `/` anywhere on `/commands` instantly focuses and selects the command filter search input.
  - **Copy Toast Notifications:** Copying any slash command or code block snippet triggers an instant animated toast message (`Copied "/warn" to clipboard`).
- **Bot Commands:**
  - **`/help`:** Added persistent action rows linking directly to the Web Documentation, Command Reference, and Live Status page. Inspecting a command (`/help command:name`) adds a direct link button to its web reference anchor.
  - **`/dashboard`:** Added direct "Web Dashboard" action button linking into the full web management portal.
  - **`/remindme`:** Added support for week durations (`1w`) and interactive autocomplete suggestions for friendly duration presets (`10m`, `30m`, `1h`, `2h`, `1d`, `3d`, `1w`).
  - **`/serverinfo`:** Added direct action buttons for high-resolution Server Icon and Server Banner with link preservation after collector timeout.

## [3.1.1] — 2026-10-13

### 🛡️ Interactive Security & Data Integrity

- **Hardened:** Role-panel clicks are verified against the stored panel, guild, message, and configured role before any role is changed. Deleted or forged controls cannot grant arbitrary roles.
- **Hardened:** Role panels reject managed roles and roles the bot cannot safely manage, with an actionable hierarchy/permission message.
- **Hardened:** Ticket closure is restricted to the opener, configured support staff, or channel managers. Participant access, claiming, and transcripts are staff-only.
- **Fixed:** Suggestion **Details** buttons now show details instead of being interpreted as a downvote.
- **Hardened:** Suggestion votes are atomic, preserve one vote per member, and reject votes after a suggestion is finalized.
- **Hardened:** Ticket, role-panel, and auto-responder IDs now use UUIDs; the database enforces one open ticket per member across restarts and instances.

### ⏱️ Reliability & Lifecycle Management

- **New:** Active giveaways are restored and rescheduled during startup, so restarts no longer strand them.
- **Hardened:** Giveaway completion is claimed atomically; manual, automatic, and multi-instance endings cannot announce different winners.
- **Improved:** Winner selection uses an unbiased cryptographic Fisher-Yates shuffle and deduplicates entrants.
- **Hardened:** Long-running scheduled tasks and giveaways are chunked around Node's timer limit, preventing jobs more than ~24.8 days away from firing immediately.
- **Improved:** Graceful shutdown waits for MongoDB to disconnect before the process exits.

### 🌐 Website

- **Fixed:** The public changelog and Atom feed now include this release's bot and website reliability work.
- **Hardened:** The Top.gg webhook is unavailable until `TOPGG_WEBHOOK_AUTH` is configured; unauthenticated requests can no longer reach the endpoint.
- **Hardened:** Website toasts and interactive AutoMod log entries use DOM text nodes instead of dynamic HTML insertion.
- **New:** Site-wide command palette searches pages and the live slash-command catalog, with Ctrl/Cmd+K, Escape, keyboard-first navigation, focus restoration, and mobile-safe responsive results.
- **Refined:** Simplified the visual system to a single light/dark choice, flatter card and button interactions, and a quieter background.

### ⚙️ Command Experience & Moderation Safety

- **Enhanced:** `/help command:` now supports autocomplete across every command, readable permission labels, and safely truncated long option/subcommand documentation.
- **Hardened:** Timeout quick actions now re-check the clicking moderator's role hierarchy before they can remove or extend a member's timeout.
- **Enhanced:** `/diagnostics` now audits ticket, role-panel, and transcript permissions plus welcome-role validity and role hierarchy.
- **New:** `/beta` establishes a managed beta program in the Aegis home server (`1554633956966539385`), with persistent tester enrollment, controlled feature rollout, tester-only feedback, staff review, and audit-log events.
- **New (Beta):** Experimental AutoMod caps detection is available to enrolled testers in the beta server, with configurable threshold/action controls and a safe `/beta lab` message preview that never enforces moderation.
- **Fixed:** Interactive polls now retain their original end time while votes update instead of moving the deadline forward on every refresh.

### 🌐 Website Support

- **New:** `/troubleshooting` provides a dedicated, navigable support guide for command registration, permissions, AutoMod, tickets, automation, status, and Fly.io deployment issues.

## [3.1.0] — 2026-10-09

### 🎁 Community Engagement & Moderation Expansion

- **New:** `/giveaway` suite (`start`, `end`, `reroll`, `list`) featuring role requirements, multi-winner support, automated end timers, and winner direct messages.
- **New:** `/infractions` staff dashboard displaying user warning history and active disciplinary cases in a tabbed, paginated embed.
- **New:** `/remindme` utility supporting human-readable durations (`30m`, `2h`, `1d`) with optional channel delivery.
- **Enhanced:** `/poll` completely rebuilt with interactive vote buttons, real-time bar graphs, anonymous voting option, multi-select mode, and moderator end buttons.
- **Enhanced:** `/announce` upgraded with an interactive modal preview before publishing, 8-color palette selector, image attachment inputs, and announcement channel crossposting.
- **Enhanced:** `/slowmode` updated with friendly preset options, quick-adjust action rows, and channel inspection.

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
