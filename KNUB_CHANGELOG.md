# Knub Framework Changelog

All notable architectural and system changes to the Knub TypeScript modular plugin framework in Aegis are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This framework follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-10-15

### 🚀 Initial Knub Modular Architecture Launch

- **Plugin Architecture & Lifecycle (`KnubPlugin`, `definePlugin`):**
  - Fully typed modular plugin interface supporting custom config schemas, metadata, command groups, event listeners, and interactive UI component handlers.
  - Lifecycle hooks: `onLoad` (initialization), `onUnload` (graceful cleanup on shutdown), and `onGuildLoaded` (per-guild config resolution).
  - Centralized `KnubManager` orchestrating plugin registration, filter pipelines, and execution dispatching.
- **Command Pre-Filter Pipeline:**
  - `guildOnlyFilter`: Enforces server-only execution for commands requiring guild context.
  - `userPermissionsFilter`: Validates invoking member's permissions with human-readable permission names.
  - `botPermissionsFilter`: Validates bot's own Discord permissions prior to executing actions.
  - `cooldownFilter`: Per-user, per-command rate limiting with remaining-time countdown notifications.
  - `pluginEnabledFilter`: Verifies that the plugin owning the command is currently active in the guild.
- **Command Post-Execution Hooks:**
  - `telemetryHook`: High-precision latency tracking and performance logging for command executions.
  - `cooldownUpdateHook`: Automatically updates cooldown records on successful command completion.
- **Interactive Component Dispatcher:**
  - Declarative string and regular-expression pattern matching for button clicks, modal submissions, and select menus (`customIdHandlers`).
  - Seamless fallback to legacy component handlers if no plugin claims the interaction.
- **Core Domain Plugins:**
  - `ModerationPlugin` (`moderation`): Disciplinary actions, escalation rules, infraction cases, and staff notes.
  - `CommunityPlugin` (`community`): Interactive giveaways, suggestions, live polls, announcements, and embed builder.
  - `TicketsPlugin` (`tickets`): Support channel creation, staff claiming, transcript archiving, and automated closure.
  - `RolesPlugin` (`roles`): Self-assignable role panels with interactive button and select-menu toggling.
  - `VerificationPlugin` (`verification`): Server gatekeeper verification button and captcha flows.
  - `AutomodPlugin` (`automod`): Real-time chat filtering, anti-invite, mention limits, and spam protection.
  - `GeneralPlugin` (`general`): Core diagnostics, status telemetry, help manuals, and remindme timers.
  - `ConfigPlugin` (`config`): Server settings, logging channel setup, welcome automation, and diagnostics.
  - `AutoresponderPlugin` (`autoresponder`): Keyword and pattern-based automated trigger-response rules.
- **Administrative Plugin Management (`/plugins`):**
  - Added `/plugins list` with a real-time interactive select menu to toggle plugins on or off per guild.
  - Added `/plugins toggle` for direct enable/disable administration.
  - Added `/plugins info` to inspect plugin metadata, active handlers, event listeners, and default configuration.
  - Added `PluginConfigModel` in MongoDB for persistent per-server plugin configurations across bot restarts.
- **Diagnostic Telemetry & API:**
  - Enhanced `/diagnostics` with active Knub plugin health reporting.
  - Added `/api/plugins` endpoint exposing registered plugins, metadata, handler counts, and version details.
  - Exposed live plugin counts in `/health` and `/api/stats`.
