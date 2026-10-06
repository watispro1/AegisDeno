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

Aegis provides a robust set of moderation and administration commands. Key commands include:
- `/automod`: Configure automoderation settings (requires `ManageGuild` permission).
  - `/automod words toggle|add|remove|action`: Manage blocked words filter.
  - `/automod links toggle|action`: Manage link filtering.
  - `/automod mentions toggle|limit|action`: Manage mention-spam filter.
  - `/automod status`: View current automod settings.
- `/ban`, `/kick`, `/timeout`, `/warn`: Core moderation tools (require corresponding permissions like `BanMembers`, `KickMembers`, `ModerateMembers`).
- `/modhistory`: View a user's warning and moderation history (requires `ModerateMembers`).
- `/developer`: Special command restricted to the configured bot owner (usually to manage global overrides or fetch deep debug info).

## Deployment Checks

Aegis is optimized for deployment via platforms like Fly.io. Follow these checks to ensure a safe rollout:
1. **Secrets Validation**: Ensure all environment variables (especially `DISCORD_TOKEN` and `MONGO_URI`) are securely set via `fly secrets set`.
2. **Database Availability**: The bot relies on MongoDB. If the DB is unavailable, the bot will exit early during startup to prevent data corruption. Check your cluster's connection limits and network allowlists.
3. **Smoke Tests**: Run `npm run test` before deployment to verify web endpoint health and API responses. The smoke tests validate HTTP 200 statuses, correct cache headers, security headers (CSP, HSTS), and accurate JSON formatting.
4. **Discord Intent and Permissions**: Verify that your bot has been granted the `Server Members` intent (if necessary for fetching member data) and `Message Content` intent (vital for automod link and word filtering) via the Discord Developer Portal.
5. **Logs**: Monitor your deployment using `fly logs`. The application outputs clear info messages on successful DB connection, command registration, and web server boot up.
