# Aegis Todo

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

### v3.3.2 Milestone (Starboard Plugin, Web Docs Overhaul & Mobile QoL)
- [x] Create modular Knub Starboard plugin (`starboardPlugin` v1.0.0) with partial reaction hydration
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
