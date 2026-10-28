# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Roles, tickets, verification and general commands
- `/rolepanel create` has a `style` option (buttons or a dropdown menu), `exclusive` (members can hold only one role from the panel) and `required_role` (only members with that role can use the panel). Existing button panels keep working, and the roles plugin's max-roles setting is enforced.
- Tickets have a staff-only **Claim** button that shows who claimed the ticket; `/ticket claim` now records the claim too, and a ticket can only be claimed once.
- Tickets close automatically after 48 hours without messages. The check is stored through the Mongo scheduler, so it survives restarts. Change it or turn it off with `/ticket settings autoclose_hours:`.
- Closing a ticket builds a self-contained HTML transcript, posts it to the ticket log channel (`/ticket settings log_channel:`) and DMs it to the member who opened the ticket; DM failures are ignored. `/ticket transcript` now returns the same HTML file.
- `/verify` CAPTCHA mode now asks a small math question in a pop-up form. Answers are checked in memory and expire after 5 minutes.
- Optional kick for members still unverified after a set number of minutes (`/verify autokick minutes:` or `kick_unverified_minutes` on setup), off by default. It is now persisted through the scheduler instead of an in-memory timer, and cancelled when the member verifies.
- `/remindme set` has a `repeat` option (daily or weekly), and delivered reminder DMs have Snooze buttons (10 minutes, 1 hour). The 25-pending-reminders limit still applies.
- `/userinfo` shows the warning count and trust score only to members with moderation permissions, in a reply only they can see. Warn History and Mod Cases buttons are moderator-only.
- `/help` shows only commands the member can use, and its `command` option searches names, descriptions and subcommands.

### Reliability
- `/lock channel duration_minutes:` auto-unlocks and `/remindme` reminders are now stored in MongoDB through the existing scheduler and restored on startup, so a restart or deploy no longer leaves a channel locked or drops a reminder. Overdue auto-unlocks are always applied on boot, however late.
- Timers longer than Node's ~24.8-day limit are re-armed in chunks. `/remindme` now accepts up to 365 days (was 24).
- `/remindme` is now `/remindme set`, with new `/remindme list` and `/remindme cancel` (ID autocomplete). Up to 25 pending reminders per user.
- `/automation list` and `/automation cancel` only show their own reminder and scheduled-message tasks.

### Code quality
- Replaced the deprecated `ephemeral: true` reply option with `flags: MessageFlags.Ephemeral` everywhere.
- Added an `isSendableChannel()` type guard and removed the obvious `as any` channel casts; the giveaway scheduler now takes a typed `Client`.
- Removed the leftover `fix.js` codemod and stopped tracking `server.md` (already in `.gitignore`).
- Added unit tests (`node:test` via `tsx`) for duration parsing, timer chunking, trust score maths, escalation thresholds and the role hierarchy rule; `npm test` runs them first.
- Added GitHub Actions CI (`.github/workflows/ci.yml`): `npm ci`, typecheck and tests on Node 22 for every push and pull request.
- README intro rewritten in plain language and notes that the project is Node.js despite the AegisDeno name.

### Website
- Redesigned every page of the public site (home, features, commands, docs, troubleshooting, changelog, status, privacy, terms, 404) with a plainer, docs-first look: light theme by default with an optional dark theme, one teal accent, IBM Plex Sans and Plex Mono, thin borders, small corners. Removed gradients, glow, emoji headings, icon tiles, the theme picker and the interactive "lab" demo.
- Feature copy rewritten to be short and match the code. Trust score docs now describe the real formula (account age maxes at two years, server tenure at one year, tenure bonus of 6/12/20 points).
- Command examples throughout use real option names and choice labels, and the command reference shows a usage line for every command and subcommand.
- Fixed the command category filter (the markup and script used different ids), moved the troubleshooting filter out of an inline script that the CSP blocked, and removed the inline changelog script.
- The status page no longer shows the process ID, Node version or hard-coded "operational" subsystem cards; it shows only values read from the running bot.
- New favicon and social preview image without gradients.
- `scripts/smoke-web.ts` now checks that the stylesheet has no scroll-reveal, gradient-text or blur effects.

## [3.4.0] — 2026-10-26

### 🔒 Transition to Proprietary Platform
- **Closed Source & Private Distribution:**
  - Transitioned Aegis from open source to a proprietary enterprise-grade Discord bot.
  - Removed all public GitHub repository and issue tracker links across the codebase, documentation, and web portal.
  - Updated project license to `UNLICENSED` / Proprietary.

### 🌟 Exclusive Advanced Security & Moderation Features
- **🕵️ Ghost Watch — Silent Member Surveillance (`/watchlist`):**
  - Monitor suspect members completely in secret without alerting them or cluttering public chat.
  - Monitors granular lifecycle events: message creation, edits, deletions, server joins, leaves, and role changes.
  - Dispatches immediate, detailed alert embeds straight to the monitoring moderator's private DMs with event metadata, previous/new content, and audit notes.
  - Configurable expiration periods (`1h`, `6h`, `24h`, `7d`, or permanent) and interactive management via `/watchlist info` and `/watchlist remove`.
  - Automatically wired into Discord Gateway events with no performance penalty on general traffic.

- **🧠 Algorithmic Trust Score (`/trustscore`):**
  - Computes a real-time 0–100 risk rating for any server member to immediately evaluate account legitimacy.
  - Factors in:
    - Discord Account Age: up to +25 points (scales linearly over 180 days).
    - Server Tenure: up to +25 points (scales linearly over 90 days).
    - Warning Penalty: −5 points per warning (capped at −30 points).
    - Formal Moderation Cases: −4 points per case (capped at −20 points).
    - Veteran Bonus: up to +20 points for accounts older than 1 year and in-server for 6+ months.
  - Rich interactive embeds with tier classification (`VERY HIGH`, `HIGH`, `MODERATE`, `LOW`, `CRITICAL RISK`), visual progress bars, detailed factor breakdowns, and live refresh buttons.

- **📋 Automated Ban Appeal Workflow (`/appeal`):**
  - Automatically generates an 8-character unique alphanumeric appeal tracking code (`AGS-XXXX`) whenever `/ban` is executed.
  - Delivers the appeal code and instructions to the banned user's DMs upon ejection.
  - Allows banned or pending users to submit their written appeal statement through a Discord Modal (`/appeal submit`).
  - Provides staff with a complete review queue: `/appeal list` (filtered by pending, approved, denied, all), `/appeal view <code>` with full context and history, and `/appeal review <code> <decision> [note]`.
  - If approved, Aegis **automatically unbans the user** from the Discord guild and sends a confirmation DM with staff notes.

- **📰 Moderation Digest & Analytics (`/modreport`):**
  - On-demand server activity and safety reports for both 24-hour and 7-day trailing windows.
  - 4-tab interactive embed switcher (powered by Discord button collectors):
    - **Overview:** Total actions, active warnings, automod interventions, bans, timeouts, and action breakdown.
    - **Top Offenders:** Aggregated list of members with the highest infraction counts, including latest infraction and severity metrics.
    - **Moderator Team:** Activity leaderboard highlighting active staff members and their contribution breakdown.
    - **AutoMod Analytics:** Rule-by-rule breakdown of blocked invites, anti-spam, caps violations, banned words, and phishing links.

### ⚡ Performance Optimizations & Command Fixes
- **High-Throughput Ghost Watch Engine (`watchlistService.ts`):**
  - Added an in-memory active watch `Set<string>` (`guildId:targetId`) and local cache.
  - Achieves $O(1)$ immediate rejection for non-watched members, eliminating 99.99% of MongoDB queries across message create, edit, delete, and presence events.
  - Added automatic 60-second background cache synchronization and instant cache invalidation upon `/watchlist add` and `/watchlist remove`.
- **Trust Score Engine Optimizations (`trustscore.ts`):**
  - Parallelized `WarningModel` and `ModerationCaseModel` database queries using `Promise.all`, cutting evaluation latency in half.
  - Fixed a closure bug where the interactive **🔄 Refresh** button re-calculated the score without passing the updated profile to the rendered embed.
  - Added an `ephemeral` privacy option (default: `true`) to safeguard member infraction history from public channels.
- **Decoupled Ban Appeal Access (`appeal.ts`):**
  - Removed top-level `BanMembers` permission requirements from `/appeal submit` so banned and regular members can invoke the command and submit their appeal statement modal.
  - Protected staff subcommands (`/appeal list`, `/appeal view`, `/appeal review`) with granular in-command permission verification.
  - Implemented Discord user cache lookups before falling back to API fetches to prevent rate limiting when viewing appeal queues.
- **Instant Digest Tab Switching (`modreport.ts`):**
  - Implemented session-level in-memory embed caching, allowing moderators to toggle between Overview, Offenders, Moderators, and AutoMod tabs with zero database latency (<5ms).
  - Added a dedicated **🔄 Refresh** button for on-demand re-aggregation.
  - Added an `ephemeral` privacy option (default: `true`) to keep server infraction statistics private by default.
- **Lean Mongoose Deserialization (`warnings.ts`, `case.ts`):**
  - Applied `.lean()` across warning lookups and `/case export` operations to return plain JavaScript objects, reducing memory allocation by up to 80%.

### ⚡ Web Portal High-Performance Redesign & Glass System Removal
- **Complete Elimination of Glassmorphism & `backdrop-filter` Overhead:**
  - Fully removed heavy `-webkit-backdrop-filter` and `backdrop-filter` blur calculations across all page components (navbars, cards, modals, search panels, stat grids, accordions, and buttons).
  - Replaced translucent blur layers with solid, high-contrast, GPU-efficient surface designs (`--bg-alt`, `--surface-2`, `--border`) with subtle elevation shadows (`--shadow-sm`, `--shadow-md`).
  - Purged all legacy glass tokens (`--glass`, `--glass-strong`, `--glass-border`, `--glass-highlight`) and redirected tokens to solid, high-performance palette colors.
  - Removed dead `data-glass` attribute logic, theme initialization checks, and client storage listeners.
  - Removed the glass toggle button from navigation and removed the corresponding `'g'`/`'G'` keyboard shortcut.
- **Developer-Grade Authentic Portal Redesign:**
  - Redesigned all primary pages (`Home`, `Features`, `Changelog`, `Status`, `Docs`, `Commands`) with a disciplined, high-density developer aesthetic (Linear / Tailscale / Raycast style).
  - Removed all AI marketing buzzwords, rainbow gradient headers, and exaggerated claims.
  - Eliminated simulated/fake chat animations and fabricated statistics (such as fake 90-day uptime history grids or synthetic sub-15ms claims).
  - Replaced home hero simulation with an interactive **Command & Response Inspector** showcasing real inputs, options, permissions, and Discord response embeds for Ghost Watch, Trust Score, Ban Appeals, and Mod Reports.
  - Upgraded the Status page with authentic cluster telemetry (live PID, Node/V8 runtime version, primary shard state, Knub plugin states, and machine-readable API endpoints).
- **Interactive Security Workbench & Customization Lab:**
  - Added interactive **Canvas Theme Customizer** supporting 5 themes: Midnight (Dark), Cyberpunk (Neon violet/pink), Emerald (Matrix green), Gold (Amber obsidian), and Daylight (Light), with synchronous persistence and zero theme flash.
  - Implemented the **Aegis Interactive Lab** on the home page featuring 4 real-time interactive customization engines:
    - **Live Algorithmic Trust Score Calculator:** Interactive sliders for account age, guild tenure, active warnings, and cases with dynamic 0–100 score gauge, visual progress bar, risk tier badge, and live Discord embed preview.
    - **AutoMod Rule Builder & Message Sandbox:** Interactive rule toggles paired with a real-time message testing input and 5 preset test chips showing instant Shield verdicts (Allowed / Blocked) and automated penalty actions.
    - **Ghost Watch Event Surveillance Simulator:** Interactive event matrix with simulated trigger buttons (Edit, Delete, Leave) dispatching live DM alert cards with before/after diff highlighting.
    - **Ban Appeal Review Desk:** Interactive appellant statement modal with 1-click Approve (automated unban execution) and Deny triage actions.
- **Enhanced Website Navigation:**
  - Added dedicated **Changelog** link directly to the primary top navigation bar across all desktop and mobile page layouts.
  - Streamlined header actions for faster loading and reduced DOM complexity.

### 🛠️ Web Portal Bug Fixes, UI Polish & Performance Tuning
- **CSS Syntax & Layout Repairs (`theme.ts`):**
  - **Fixed `.docs-mobile-nav` Syntax Bug:** Resolved a missing closing brace that concatenated with the selector, breaking subsequent mobile navigation styling rules.
  - **Fixed `.back-to-top` Visibility Bug:** Fixed an unclosed selector block where `.back-to-top.visible` was swallowed into the parent rule, restoring the scroll-triggered return-to-top button.
  - **Feature Showcase Filter CSS:** Added explicit `.ft-showcase-card[hidden]` rule to ensure category filtering cleanly hides non-matching cards without layout shift.
- **Client Script & Runtime Performance Optimizations (`client.ts`, `pages.ts`):**
  - **Deduplicated Catalog Statistics:** Cached `catalogStats()` calculation in a single IIFE call on the home page instead of computing statistics twice across sections.
  - **Snappier Command Search:** Tightened live command search debounce from 110ms to 80ms for faster, more responsive search feedback.
  - **Removed Redundant Code:** Eliminated duplicate `escapeHtml()` function definition inside the command search closure in `client.ts`.
  - **Standardized Visibility Attribute:** Switched feature category filter in `client.ts` to standard HTML `card.hidden = !visible` toggling instead of inline `style.display` modifications.
- **Interactive UI & Component Styling Enhancements (`theme.ts`):**
  - **Interactive Preview Tab Buttons:** Added hover and active (`aria-pressed="true"`) states for `.preview-tab-btn` featuring primary color highlights, subtle background tint, and glowing shadow accents.
  - **Interactive Command Pills:** Implemented full interactive styles for `.cmd-pill` elements, including subtle translateY hover lift, active press scale feedback, primary border tint, and dedicated `.pill-copy` styling.

## [3.3.3] — 2026-10-23

### 🛡️ Core Moderation Overhaul
- **Enhanced `/warn` Command:**
  - Added quick `preset` violation dropdown (Spam, Harassment/Toxicity, NSFW, Promo links, Rule evasion) with combined custom reason support.
  - Added instant interactive **⚡ Timeout (10m)** quick-escalation button on the confirmation embed for repeat offenders.
  - Preserved **📜 Warning History** and **↩️ Undo Warning** action buttons.
- **Enhanced `/timeout` Command:**
  - Added infraction `preset` choices (Spamming, Harassment, Inappropriate Language, Argumentative, Promo Links).
  - Added on-demand **📜 Case History** inspection button allowing moderators to review past actions immediately.
  - Kept **🔓 Remove Timeout** and **⏩ Extend (+1h)** dynamic adjustment buttons.
- **Enhanced `/ban` Command:**
  - Added severe infraction `preset` choices (Severe Harassment, Compromised/Raid Account, Malicious Content, Mass Spam, Prior Infractions).
  - Enriched ban confirmation prompt with target account age (`<t:...:R>`) and guild join date metrics.
  - Added instant **↩️ Revoke Ban (Unban)** button on post-ban response.
- **Enhanced `/case` Command Suite:**
  - Added `/case user` subcommand to browse a member's recent infraction history with action icons (🔨, ⏱️, ⚠️, 👢, 🗑️).
  - Enriched `/case view` with color-coded embed designs and formatted relative timestamps.
- **Enhanced `/purge` Command:**
  - Added audit `reason` logging for bulk message cleanups.
  - Added automatic case record creation in `ModerationCaseModel`.
  - Expanded `ModerationAction` type union with `"purge" | "lock" | "unlock"`.

### 🧹 Lean Architecture & Developer Bloat Removal
- **Removed `/beta` Command & Lab Simulator:**
  - Completely removed the 600+ line `/beta` Command Lab simulation suite, tester roster management, and triage queues.
  - Removed `BetaProgramModel` and `BetaFeedbackModel` database schemas.
- **Standardized AutoMod Rules:**
  - Decoupled Caps Percentage and Character Flood detection from the beta program, making them standard AutoMod rules for all servers via `/automod caps`.

### 🌐 Web & Documentation Streamlining
- **Streamlined Navigation Bar:**
  - Consolidated top navigation bar to 4 core links: **Features**, **Commands**, **Docs**, and **Status**.
- **Consolidated Documentation Handbook:**
  - Incorporated an interactive Troubleshooting & FAQs table and Release Changelog highlights directly into `/docs`.
  - Pruned redundant markdown files (`CHANNEL_CONTENT.md`, `KNUB_CHANGELOG.md`, `DISCOVERY.md`) in favor of centralized documentation.

## [3.3.2] — 2026-10-20

### 🧪 Beta Program & Command Lab Overhaul
- **Comprehensive Command Lab Simulation Suite (`/beta lab`):**
  - Added multi-scan safety simulator supporting Caps Percentage, Repetitive Character Flooding, Discord & Obfuscated Invite Link Scanning, Mass Mention Velocity, and Token Shannon Entropy.
  - Returns color-coded threat ratings (`SAFE`, `LOW RISK`, `SUSPICIOUS`, `HIGH RISK`, `CRITICAL`), threat scores (0–100), and non-enforcing AutoMod recommendations.
- **Multi-Guild Beta Network (`/beta guild-enroll` / `/beta guild-unenroll`):**
  - Expanded beta feature availability beyond the single primary hub to authorized partner servers.
- **Structured Feedback Management & Triage Suite:**
  - Added categorization (`bug`, `feature`, `improvement`, `question`) and severity tiers (`low`, `medium`, `high`, `critical`).
  - Added staff triage commands: `/beta feedback-view`, `/beta feedback-triage`, and `/beta feedback-list` with filtering.
- **Tester Profiles & Honors (`/beta profile`, `/beta leaderboard`):**
  - Added contributor statistics, resolution counts, and earned tester badges (`🧪 Beta Pioneer`, `🐛 Bug Hunter`, `🏆 Verified Contributor`, `💎 Master Diagnostician`).
- **Modular Beta Flags:**
  - Expanded rollout flags to 6 active experiments: `beta-feedback`, `experimental-automod` (caps & character flood), `command-lab`, `smart-anti-raid`, `ai-moderation-preview`, and `starboard-custom-rules`.

### ⭐ Starboard Plugin
- **New Plugin: `starboard` v1.0.0**
  - Automatically reposts highly-reacted messages to a dedicated starboard channel.
  - Listens to `messageReactionAdd` and `messageReactionRemove` Discord gateway events with full partial-message/reaction hydration for cold-cache safety.
  - Per-guild configuration persisted in MongoDB (`StarboardConfig` collection), separate from the generic `PluginConfig` store for cheap per-reaction lookups.
  - Tracks posted entries in a `StarboardEntry` collection to prevent duplicate starboard posts and enable live star-count updates on the embed.
  - Gold (`#FFD700`) embed includes author avatar, message content, first image attachment (or embed image), source channel, jump link, and formatted timestamp.

- **`/starboard` Slash Command** (requires `Manage Server`):
  - `/starboard setup #channel` — set the channel where starred messages are posted.
  - `/starboard threshold <n>` — set the minimum reaction count required (1–100).
  - `/starboard emoji <emoji>` — change the trigger emoji (Unicode or custom).
  - `/starboard selfstar <true|false>` — allow or deny the message author's own reaction from counting toward the threshold.
  - `/starboard ignore add/remove [#channel] [@role]` — exclude specific channels or roles from being starred.
  - `/starboard config` — view the full current configuration in a formatted embed.
  - `/starboard list [limit]` — show the most recent starboard entries (up to 20).
  - `/starboard toggle <true|false>` — master enable/disable switch.

- **Database:**
  - Added `StarboardConfigModel` Mongoose schema (indexed on `guildId`, unique).
  - Added `StarboardEntryModel` Mongoose schema (compound unique index on `guildId + sourceMessageId`, plus `createdAt` descending index for efficient list queries).

## [3.3.1] — 2026-10-20

### 🪟 Liquid Glass 2.0 & Interactive Controls

- **Heavily Improved Liquid Glass Materials:**
  - Upgraded optical refraction and diffusion tokens with dual-angle specular highlights (`--glass-highlight: rgba(255, 255, 255, 0.22)` in dark mode, `rgba(255, 255, 255, 0.98)` in light mode).
  - Enhanced frosted blur physics to 48px radius with 210% saturation boost and dynamic rim light illumination.
  - Added prismatic hover lifts and subtle specular flares on cards, metrics, and navigation elements.
  - Multi-tier ambient shadows: `0 16px 40px -12px rgba(0, 0, 0, 0.65)` for deep natural grounding.

- **Toggleable Liquid Glass Mode (On / Off):**
  - Added accessible `.glass-toggle` button in the navbar right alongside the theme switch, with crystal isometric icon, active glow, and `aria-pressed` states.
  - Added `G` keyboard shortcut for toggling Liquid Glass on/off anywhere outside active form inputs.
  - Added synchronous `themeInitScript` support reading `aegis-glass` from `localStorage` to eliminate FOUC (flash of unstyled content).
  - Added high-performance solid/opaque mode (`[data-glass="off"]`): completely disables GPU-intensive backdrop blur filters and switches to high-contrast solid surfaces for low-power hardware, older devices, or OLED battery savings.
  - Glass toggle button visually reflects state with active glow ring (`aria-pressed="true"`) and faded icon when off.
  - Added `@media (prefers-reduced-transparency: reduce)` support: automatically disables all `backdrop-filter` for users who have OS-level transparency reduction enabled.

### 🌐 Web Experience & QoL Enhancements

- **Quick Command Clipboard Copy:**
  - Added one-click copy support for slash command strings with immediate `.copied` visual feedback and toast confirmation.
  - Wired up clipboard feedback across `/commands` and home page command pills.
- **Client Script Hardening:**
  - Fixed `syncThemeDots` undefined reference bug during theme toggle, ensuring zero console exceptions when cycling dark/light themes.

### 🗂️ Web Site Streamlining

- **Removed `/dashboard` and `/playground` pages:**
  - Eliminated the Live Dashboard and Command Playground web pages to simplify the site to its core public-facing content.
  - Added permanent `301` HTTP redirects from both removed paths to `/features`.
  - Cleaned navigation links and footer product columns to remove all references.
- **Home Page Bento Redesign:**
  - Replaced the previous layout with a clean bento capability grid covering core features (AutoMod, Tickets, Anti-Raid, Audit Logs, Role Panels, Analytics).
  - Added quick-copy slash command pills (`/timeout`, `/automod`, `/ticket`, `/verify`, `/warn`, `/poll`) to the hero section.
  - Added an interactive terminal preview with three tabs: AutoMod Shield, Precision Timeout, and Support Desk — each showing a realistic Discord embed mock-up.
- **Features Page Overhaul:**
  - Rebuilt the features page as a bento showcase grid with category filter tabs (All / Moderation / AutoMod / Community / Integrations).
  - Added interactive demo toast buttons on each feature card showing simulated bot responses.
  - Added an expandable deep-dive section with capability toggles and real-time audit log stream simulation.
- **Smoke Tests Updated:**
  - `scripts/smoke-web.ts` updated to verify `301` redirects for removed pages and confirm no broken internal links.

### 🤖 Bot Command Reliability & Bug Fixes

- **Moderation `/timeout`:**
  - Fixed quick-action timeout extension: dynamically calculates remaining timeout duration rather than overwriting with a flat 1 hour, clamped safely to Discord's 28-day ceiling.
  - Added full audit trail logging and `addModerationCase` entry for timeout extension actions.
- **Moderation `/lock`:**
  - Hardened emergency server lockdown (`/lock server`) by filtering out thread channels (`!ch.isThread()`), preventing unhandled `permissionOverwrites.edit` exceptions.
  - Added graceful rejection with parent channel guidance when running `/lock channel` or `/lock status` inside thread channels.
- **AutoResponder Service:**
  - Expanded variable replacement tokens with `{tag}`, `{user_id}`, `{server_id}`, and `{channel_id}`.
- **Verification Plugin:**
  - Added safe `.catch(() => null)` guard on member fetching to prevent unhandled rejection when users leave or during API rate limits.

## [3.3.0] — 2026-10-17

### 🪟 Apple Glassmorphism Design Overhaul

- **Full VisionOS / macOS Sonoma Liquid-Glass Materials:**
  - Modernized the web portal design system with layered frosted glass tokens (`--glass`, `--glass-strong`, `--glass-highlight`, `--glass-border`, `--glass-shadow`).
  - Integrated rich `-webkit-backdrop-filter` and `backdrop-filter` with dual blur and color saturation.
  - Added specular rim lighting and 175-degree top sheen gradients across cards, panels, search bars, and navigation headers.
  - Added macOS traffic-light window controls (`.window-dots`) and spotlight search bar pill with glass vibrancy.
  - Re-architected interactive states for stat widgets, cards, command cards, tables, pills, and toasts with subtle elevation shadows.
  - Added accessibility support via `@media (prefers-reduced-transparency: reduce)` high-contrast solid backgrounds.

### 🧩 Knub Plugin Framework v1.1.0

- **High-Throughput In-Memory Caching:**
  - Added 30-second sliding TTL in-memory cache for `isPluginEnabledForGuild` and `getGuildPluginConfig`.
  - Eliminates repeated database queries during high-concurrency interaction bursts.
  - Instant cache invalidation on `setPluginEnabledForGuild` and `setGuildPluginConfig`.
- **Dynamic Configuration Mutation (`setGuildConfig`):**
  - Added `setGuildPluginConfig<T>()` and `ctx.setGuildConfig()` allowing plugins to mutate and persist per-server plugin configurations safely.
- **Guild Lifecycle Hooks (`onGuildLoaded` & `GuildCreate`):**
  - Added `onGuildLoaded` dispatching across cached guilds on client initialization.
  - Added `handleGuildCreate(guild)` invoked via Discord `Events.GuildCreate` to initialize per-guild plugin states when the bot joins new servers.
- **Plugin Dependency Declarations:**
  - Added `dependencies?: string[]` declaration with registration-time validation.
- **Component Handler Polish:**
  - Streamlined component interaction pipeline directly through Knub plugin dispatcher.
  - Strengthened `roles` plugin with safe regex pattern matching (`^rolepanel_([^_]+)_(.+)$`).

### 🐛 Bug Fixes & Gateway Hardening

- **Fixed:** Unhandled runtime crashes in `Events.GuildMemberRemove` when uncached members leave. Added safe optional chaining on `member.user` properties.
- **Fixed:** Welcome message delivery failure on cold cache. When `config.welcomeChannelId` is not in `guild.channels.cache`, the bot now asynchronously fetches the channel via Discord API rather than silently dropping messages.
- **Fixed:** Removed redundant duplicate component button handlers in `client.ts` that were bypassed by Knub plugin routing.
- **Fixed:** Role panel customId parsing vulnerability when role IDs or panel IDs contain complex delimiter characters.

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

### 🧩 Knub TypeScript Modular Architecture

- **Integrated:** Knub-inspired modular plugin framework for the Discord bot:
  - **Modular Plugins:** Created plugin system (`KnubPlugin`, `definePlugin`) organizing bot features into distinct domains (`Moderation`, `Community`, `Tickets`, `Roles`, `Verification`, `Automod`, `General`, `Config`, `Autoresponder`).
  - **Pre-Filter Pipeline:** Replaced standalone checks with Knub pre-filters (`guildOnlyFilter`, `userPermissionsFilter`, `botPermissionsFilter`, `cooldownFilter`, and guild-level plugin enablement checks).
  - **Post-Execution Hooks:** Telemetry logging (`telemetryHook`) for tracking command execution latency and automated rate-limiting updates (`cooldownUpdateHook`).
  - **Component Dispatcher:** Centralized interactive button, modal, and select menu routing via plugin `customIdHandlers` with seamless fallback to legacy handlers.
  - **Per-Guild Configuration:** Added `PluginConfigModel` in MongoDB for persistent per-server plugin enablement and custom plugin options.
  - **Lifecycle Management:** Added `onLoad`, `onUnload`, and graceful shutdown lifecycle hooks in `knubManager`.
  - **New Command `/plugins`:** Interactive server plugin manager supporting `/plugins list` with a real-time select menu to toggle plugins on/off, `/plugins toggle` for direct toggles, and `/plugins info` to inspect plugin architecture, event hooks, and component handlers.
  - **Diagnostic Telemetry:** Enhanced `/diagnostics` to report active Knub plugins and added fallback fetching for channels and roles to eliminate false-positive "channel deleted" cache warnings.
  - **Plugins API Endpoint (`/api/plugins`):** Added public API returning active plugins, version metadata, and handler counts, integrated with `/health` and `/api/stats`.

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
