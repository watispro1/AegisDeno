# Knub Framework Changelog

All notable architectural and system changes to the Knub TypeScript modular plugin framework in Aegis are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This framework follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] — 2026-10-20

### ⭐ Starboard Plugin Architecture & Partial Reaction Hydration

- **Starboard Plugin (`starboardPlugin` v1.0.0):**
  - Modular Knub plugin listening to `Events.MessageReactionAdd` and `Events.MessageReactionRemove`.
  - Seamless handling of Discord partials: automatically hydrates partial reactions and messages via `reaction.fetch()` and `reaction.message.fetch()`.
  - Reaction threshold verification against per-guild configuration with dynamic live star count recalculation.
  - Golden embed generation with author metadata, source jump links, attachment detection, and image previews.
- **Dedicated Persistence Layer:**
  - High-performance `StarboardConfig` collection for immediate per-guild lookup.
  - `StarboardEntry` collection with unique compound index on `(guildId, originalMessageId)` preventing duplicate posts.
  - Automatic deletion cleanup if stars drop below threshold after creation.

## [1.1.1] — 2026-10-20

### 🛡️ Component Dispatcher & Verification Hardening

- **Verification Plugin Exception Safety:**
  - Added safe optional catching (`.catch(() => null)`) on `guild.members.fetch(interaction.user.id)` inside the `verify_start` button handler.
  - Prevents unhandled promise rejections when users leave the server during verification or when Discord API rate limits occur.
  - Emits friendly ephemeral guidance to prompt the user to retry if their member record cannot be fetched.
- **Component Handler Graceful Fallbacks:**
  - Standardized error logging in `knubManager.dispatchComponent` to preserve full error stack traces while ensuring interaction responses complete.

## [1.1.0] — 2026-10-17

### ⚡ Performance, Lifecycle Hooks & Configuration API

- **High-Throughput In-Memory Caching:**
  - Added 30-second sliding TTL in-memory cache for `isPluginEnabledForGuild` and `getGuildPluginConfig`.
  - Eliminates repeated database queries during high-concurrency interaction bursts (e.g., giveaway rollouts, rapid button clicks, or traffic spikes).
  - Synchronous cache invalidation on `setPluginEnabledForGuild` and `setGuildPluginConfig`.
- **Dynamic Per-Guild Configuration Mutation (`setGuildConfig`):**
  - Added `setGuildPluginConfig<T>(guildId, pluginName, config)` on `KnubManager` and exposed `ctx.setGuildConfig(guildId, config)` directly within `PluginContext`.
  - Allows plugins to mutate and persist per-server plugin configurations safely with automatic MongoDB persistence and cache synchronization.
- **Guild Lifecycle Dispatching (`onGuildLoaded` & `GuildCreate`):**
  - Added full `onGuildLoaded(guildId, config)` dispatching across all cached guilds during bot initialization.
  - Added `handleGuildCreate(guild)` invoked via Discord `Events.GuildCreate` to initialize per-guild plugin states as soon as the bot joins new servers.
- **Plugin Dependency Declarations:**
  - Added `dependencies?: string[]` declaration on `KnubPluginDefinition` and `KnubPlugin`.
  - Automatically verifies that declared dependencies are registered with `KnubManager` upon plugin registration.
- **Component Handler Polish:**
  - Streamlined component interaction pipeline with regex capture group extraction.
  - Strengthened `roles` plugin with safe regex pattern matching (`^rolepanel_([^_]+)_(.+)$`).

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
