# Aegis Todo

## Current iteration

### Website + repo hygiene
- [x] Removed all stale public GitHub repository URLs and open-source references in transition to proprietary platform
- [x] Add Changelog link directly to the top navigation bar across all site pages
- [x] Completely removed Liquid Glass UI and all `backdrop-filter` effects for maximum rendering performance and zero frame drops
- [x] Replaced glass styling with sleek, solid, high-contrast surface hierarchy and fast shadows
- [x] Removed glass toggle button, client scripts, theme-init hooks, and keyboard shortcuts
- [x] Completely redesigned Home, Features, Changelog, and Status pages to developer-grade engineering aesthetic (Linear/Tailscale/Raycast)
- [x] Replaced simulated fake chat and fabricated metrics with interactive Command & Response Inspector and authentic live telemetry
- [x] Replaced fake 90-day uptime grid on Status page with genuine runtime specifications and machine-readable health probes
- [x] Validate the public site metadata, invite links, and docs navigation after the latest release sweep
- [x] Re-check mobile navigation, search results, and command deep links for regressions
- [x] Audit README/setup guidance for copy-paste accuracy before the next release

### Bug triage backlog
- [x] Revisit any edge cases around missing env vars, invalid bot invite URLs, and partial config states
- [x] Review command/website interactions that depend on live fetches and ensure they degrade gracefully without network access
- [x] Check for stale assumptions in docs, support links, and release notes after updates
- [x] Add a lightweight regression checklist for future web and bot changes

## High-priority work

### Core reliability

- [x] Verify the bot works cleanly in a real Discord guild with all moderation commands and permission checks
- [x] Validate database behavior for guild config, warnings, moderation cases, suggestions, automod, and scheduled tasks under realistic usage
- [x] Add graceful fallbacks for missing env vars, invalid Mongo records, and partial config states
- [x] Review the startup sequence to ensure command registration, DB connection, scheduler, and web server boot in a safe order
- [x] Add more resilient logging around failed moderation actions, scheduler retries, and automod triggers

### Moderation and safety

- [x] Test the entire warn / timeout / ban / unban / modhistory flow end-to-end
- [x] Confirm case history records are complete and consistent for moderator actions and server events
- [x] Review permission checks for admin-only and moderator-only flows to prevent privilege mistakes
- [x] Evaluate whether timeout and ban actions should keep more metadata for auditing and reporting
- [x] Add a clear audit trail for automod actions so staff can understand why a message was deleted or timed out

### Automod

- [x] Expand automod rule coverage beyond words/links/mentions to include spam pattern detection and message abuse checks
- [x] Add per-guild rule presets and a sane default configuration for new servers
- [x] Add safe-list / exemption support for trusted roles or channels
- [x] Review automod edge cases like repeated triggers, mention spam thresholds, and message edits
- [x] Add an admin-facing summary of current automod settings and recent triggers

### Scheduling and automation

- [x] Stress-test delayed reminders and scheduled announcements across bot restarts and retry loops
- [x] Confirm scheduler cleanup works correctly for expired, canceled, and failed tasks
- [x] Decide if recurring tasks should support more advanced cron-like scheduling or interval-based triggers
- [x] Add monitoring for missed tasks and delayed executions

### Web dashboard and deployment

- [x] Audit the web server for stale content, cache invalidation, and deployment-specific edge cases
- [x] Review site metadata, SEO basics, and page structure for public-facing docs and command pages
- [x] Validate health and stats endpoints under real hosting conditions and behind proxy/load balancer setups
- [x] Review Fly.io and environment configuration to ensure production secrets, ports, and health checks are stable
- [x] Add a deployment checklist for first-time setup, bot token config, Mongo connectivity, and environment validation

## Important follow-up backlog

### Admin experience

- [x] Add a guild onboarding flow for first-time server setups and admin configuration
- [x] Add clearer help text for commands that require moderator or admin privileges
- [x] Add server setup diagnostics to show whether key permissions, channels, and config values are missing
- [x] Add safer defaults for new guild configuration records

### Community features

- [x] Improve suggestions workflow with review states, moderation approval, and better analytics
- [x] Expand poll functionality with richer options, expiration handling, and moderation controls
- [x] Add welcome configuration for roles, custom embeds, and onboarding steps
- [x] Add recurring community announcements or event scheduling tied to the scheduler system
- [x] Add activity summaries or weekly reports for server admins and mods (`/activitysummary`)

### Product / feature roadmap

- [x] Build a staff moderation dashboard with recent warnings, cases, and action summaries
- [x] Add repeated-offense detection and escalation thresholds for abuse patterns
- [x] Add command presets or server templates for typical moderation setups (`/preset`)
- [x] Add export/report tools for moderation logs and user action history (`/case export`)
- [x] Add role-based automation for onboarding, verification, and help channels (`/ticket`, `/verify`, `/rolepanel`, `/autoresponder`)

### Documentation and maintenance

- [x] Write a proper installation guide for local dev, production deployment, and env configuration
- [x] Document all major command groups and expected permissions
- [x] Add a troubleshooting guide for MongoDB, Discord token issues, slash command registration, and scheduler problems
- [x] Add contributor notes for project structure, command loading, and service boundaries
- [x] Add release checklist and operational verification notes before publishing new versions
- [x] Update all project documentation (`.md` files) across bot guides, server setup, and changelogs for v3.3.1

### v3.7.0 Milestone (Official Server Playbook & Website QoL)

- [x] Rewrite `server.md` with a per-channel reference: who posts, purpose, Aegis behaviour and a pasteable Discord topic for all 31 channels
- [x] Add `#welcome` as the welcome target and document channel naming, category order, slowmode and read-only conventions
- [x] Add "What Aegis posts where", setup order and a pre-launch QA checklist to `server.md`
- [x] Add `tests/serverDocs.test.ts` so documented slash commands are validated against the live command registry
- [x] Centralise public URLs in `src/config/links.ts` (`SITE_URL`, `SUPPORT_SERVER_URL`, `BOT_INVITE_URL`)
- [x] Upgrade `/help` with category docs links, per-command permission tags, deep command links and an Add Aegis button
- [x] Add case, user-history and dashboard link buttons to moderation confirmations and audit-log entries
- [x] Upgrade the Ctrl/Cmd+K palette with fuzzy matching, grouped results, subcommand anchors, arrow keys and recent searches
- [x] Add access-level/subcommand/autocomplete filters and locally saved pinned commands to `/commands`, with state in the URL
- [x] Add per-heading copy links, inline command links and a previous/next section pager to `/docs`
- [x] Add release search, a Latest badge and per-release copy links to `/changelog`
- [x] Add `tests/links.test.ts` and `tests/siteQol.test.ts` coverage for the new links and site hooks

### v3.4.0 Milestone (Exclusive Features & Proprietary Transition)

- [x] Transition to proprietary platform: removed all public GitHub repository links, issue trackers, and copyleft licenses; updated `package.json` to `UNLICENSED` / `private: true`
- [x] Implement Ghost Watch (`/watchlist`): silent member surveillance system monitoring messages, edits, deletes, joins, leaves, and role changes with private DM alerts to staff
- [x] Implement Trust Score (`/trustscore`): real-time 0–100 algorithmic risk scoring incorporating account age, guild tenure, warning penalties, active cases, and veteran longevity bonuses
- [x] Implement Ban Appeal Workflow (`/appeal`): automatic 8-character appeal code generation (`AGS-XXXX`) during bans, DM delivery, modal submission, and automated unban execution on approval
- [x] Implement Mod Report Digest (`/modreport`): interactive 24h/7d analytics dashboard breaking down moderation actions, top repeat offenders, moderator activity, and AutoMod triggers
- [x] Register gateway event listeners in `src/bot/client.ts` for real-time watchlist surveillance
- [x] Wire automatic appeal code creation and DM dispatch directly into `/ban`
- [x] Wire AutoMod enforcement telemetry into `AutomodHitModel` for live reporting
- [x] High-throughput in-memory Ghost Watch caching with O(1) active target Set rejection
- [x] Parallelized database queries and live embed refresh reactivity for `/trustscore`
- [x] Decoupled `/appeal submit` permissions for accessible ban appellant modal submission
- [x] Instant session tab caching with on-demand refresh for `/modreport`
- [x] Updated public web changelog (`RELEASES`), release highlights, and `CHANGELOG.md`
- [x] Verify all TypeScript compilation cleanly passes with zero errors

### v3.3.3 Milestone (Lean Architecture & Moderation Overhaul)

- [x] Prune developer/beta bloat: completely removed experimental `/beta` Command Lab simulation suite (600+ lines), beta feedback models, and tester rosters
- [x] Standardize AutoMod caps and character flood filters across all guilds without beta restrictions
- [x] Streamline web navigation: consolidated top navbar into 4 core sections (`Features`, `Commands`, `Docs`, `Status`)
- [x] Consolidate secondary documentation: unified troubleshooting table and release changelogs directly into `/docs`
- [x] Overhaul `/warn`: added rule violation presets (`preset`), interactive warning history, undo warning, and quick-escalation 10m timeout button
- [x] Overhaul `/timeout`: added reason presets, dynamic remaining time extension, remove timeout, and on-demand case history inspector
- [x] Overhaul `/ban`: added reason presets, account age and join date audit metrics in confirmation embed, and 1-click ban revocation button
- [x] Overhaul `/case`: added `/case user` subcommand to view a member's complete infraction history with action icons, and richer single-case cards
- [x] Overhaul `/purge`: added audit reason support, case logging into `ModerationCaseModel`, and visual progress bar
- [x] Prune redundant markdown files (`CHANNEL_CONTENT.md`, the old framework changelog, `DISCOVERY.md`) and update all project documentation for v3.3.3

### v3.3.2 Milestone (Starboard Plugin, Web Docs Overhaul & Mobile QoL)

- [x] Create the Starboard module with partial reaction hydration
- [x] Add `/starboard` command suite (setup, threshold, emoji, selfstar, ignore, config, list, toggle)
- [x] Add `StarboardConfig` and `StarboardEntry` MongoDB models with unique compound indexes
- [x] Overhaul `/docs` manual with comprehensive Starboard, Tickets, Verification, and AutoMod guides
- [x] Add mobile TOC quick-jump navigation and IntersectionObserver active heading tracker
- [x] Add reading progress indicator and automatic 1-click clipboard copy buttons for code blocks
- [x] Full mobile/tablet responsive design enhancements (table scroll cues, drawer styling, touch targets)
- [x] Update all project documentation, changelogs, and bump version to 3.3.2

### v3.3.1 Patch Update (Liquid Glass & QoL)

- [x] Heavily improve Liquid Glass styling with VisionOS 2.0 optical tokens and dynamic specular sheen
- [x] Implement on/off toggle system for Liquid Glass (`.glass-toggle`, `aegis-glass` persistence, `data-glass="off"` solid mode)
- [x] Add `G` keyboard shortcut for toggling Liquid Glass
- [x] Add command string clipboard copy with toast feedback on command reference pages
- [x] Fix `syncThemeDots` undefined reference bug during theme toggle
- [x] Fix `/timeout` extension button to dynamically calculate duration from current remaining time with audit logging
- [x] Harden `/lock` emergency server lockdown against thread channel exceptions
- [x] Expand AutoResponder variable replacements with `{tag}`, `{user_id}`, `{server_id}`, `{channel_id}`
- [x] Harden verification plugin member resolution against unhandled rejections

## Nice-to-have after core work

- [x] Add anti-spam protections beyond current mention and link filters
- [x] Add configurable moderation thresholds for repeat offenders and time-based warnings
- [x] Add richer web analytics for command use, active guild metrics, and moderation health
- [x] Add optional premium or pro features for enterprise-style server management
- [x] Add more user-friendly moderation summaries in Discord embeds and dashboards

## Notes

- The current codebase is strongest in moderation commands, scheduler logic, and the web dashboard.
- Liquid Glass 2.0 is active by default with instant accessibility/performance fallback to solid opaque surfaces (`data-glass="off"`).
- All smoke tests and TypeScript builds validate cleanly across 11 core routes and API endpoints.
