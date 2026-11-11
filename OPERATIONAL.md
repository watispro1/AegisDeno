# Aegis Operational Guide

This document is for maintainers and operators of Aegis Bot. It covers configuring the bot, managing admin commands, and performing deployment checks.

## Bot Configuration

The bot relies on several environment variables that must be configured correctly for operations to run smoothly.
- `DISCORD_TOKEN`: The secret token used by the bot to log into Discord.
- `DISCORD_APPLICATION_ID`: The client ID used for building OAuth2 invite links and validating slash command registration.
- `MONGO_URI`: The connection string for the MongoDB instance used for storing guild configurations, automod settings, warnings, moderation cases, and scheduled tasks.
- `PORT` (Optional): The port on which the web dashboard runs (defaults to 3000).
- `SITE_URL` (Optional): The base URL for the web dashboard, used for sitemap generation.
- `BOT_INVITE_URL` (Optional): A custom invite URL if you don't want to use the auto-generated one.
- `SUPPORT_SERVER_URL` (Optional): A link to the bot's support server.

## Admin Commands

The main admin commands:
- `/automod`: Configure automoderation settings (requires `ManageGuild` permission).
  - `/automod words toggle|add|remove|action`: Manage blocked words filter.
  - `/automod links toggle|action`: Manage link filtering.
  - `/automod mentions toggle|limit|action`: Manage mention-spam filter.
  - `/automod caps toggle|threshold|action`: Manage uppercase and character flood detection.
  - `/automod status`: Interactive status hub with toggle buttons.
- `/warn`, `/timeout`, `/ban`, `/kick`: Preset reasons, a confirmation step, and quick actions afterwards (Timeout 10m, +1h Extend, Undo, Revoke Ban).
- `/case`: Case lookup (`/case view`, `/case user` with `action:` and `hide_revoked:` filters), search (`/case search`), reason updates (`/case edit`), and JSON audit exports (`/case export`).
- `/massban`: Ban up to 50 user IDs at once (Ban Members). Same hierarchy rules as `/ban`, confirmation, re-check before acting, one case per ban, one mod-log entry. No DMs or appeal codes. 30-second cooldown per moderator.
- `/purge`: Filtered bulk message deletion with preview prompt, audit reason logging, and progress bar.
- `/developer`: Restricted bot-owner diagnostics for live heap memory, cached guilds, and loaded commands.
- `/sync`: Live slash command re-registration without process restarts.

## Web Portal Operations & Visual Performance

- `/status` shows uptime, gateway latency and incident notices; `/api/status` returns the same as JSON.
- `/playground` is retired and redirects to `/features`.

## Deployment Checks

Aegis runs on Fly.io. Before a rollout:
1. **Secrets Validation**: `DISCORD_TOKEN`, `MONGO_URI` and the rest are set with `fly secrets set`.
2. **Database Availability**: The bot exits at startup if it cannot reach MongoDB. Check your cluster's connection limits and network allowlists.
3. **Smoke Tests**: Run `npm run test` before deployment to verify web endpoint health and API responses. It checks status codes, cache and security headers (CSP, HSTS) and the JSON endpoints.
4. **Discord Intent and Permissions**: Verify that your bot has been granted the `Server Members` intent (if necessary for fetching member data) and `Message Content` intent (automod needs it to read messages) via the Discord Developer Portal.
5. **Logs**: Monitor your deployment using `fly logs`. Startup logs one line each for the DB connection, command registration and the web server.
   Discord rate limits show up as `Discord rate limit on <METHOD> <route>` (at most once a minute per route), and `invalid Discord API requests` warns before Discord's 10,000-per-10-minutes IP ban.
6. **Shutdown**: On SIGTERM/SIGINT the bot stops timers, disconnects from Discord, flushes activity counters and closes MongoDB, in that order, once. If that takes more than 10 seconds it exits with code 1 and logs `shutdown did not finish`.

## Retired settings collection (`pluginconfigs`)

Up to v3.5.0 ticket settings and the roles-per-panel limit were stored in the
`pluginconfigs` collection. The bot now keeps them in `guildconfigs` and copies
the old values over the first time each server's config is loaded, stamping
`legacySettingsMigratedAt` on the server's config. Nothing reads or writes
`pluginconfigs` after that copy. Once every server the bot is in has been
loaded at least once, check what is left and then drop it:

```js
// mongosh, connected to the bot's database
db.guildconfigs.countDocuments({ legacySettingsMigratedAt: null })   // servers not yet copied
db.pluginconfigs.distinct("guildId").filter(id =>
  !db.guildconfigs.findOne({ guildId: id, legacySettingsMigratedAt: { $ne: null } }))
db.pluginconfigs.drop()
```
