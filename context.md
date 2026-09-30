# AegisDeno — Development Context

## Stack

- Runtime: Node.js
- Language: TypeScript
- Discord library: discord.js v14
- Database: MongoDB / Mongoose
- Package manager: npm
- Web services: Express where required by the existing application

**Do not use Deno or Discordeno.** AegisDeno is a Node.js + TypeScript + discord.js project.

## Command Architecture

Commands live under `src/commands/` and are grouped by category:

- `general` — basic utility and bot information
- `moderation` — moderation and member-management commands
- `config` — server configuration
- `logging` — logging configuration and controls
- `automod` — automatic moderation configuration
- `welcome` — welcome system configuration
- `community` — community interaction commands
- `automation` — scheduled and automated tasks
- `developer` — owner-only developer tools

Every command should implement the shared `Command` interface from `src/types/discord.ts`.

A command should define:

- `data` — its `SlashCommandBuilder`
- `category` — command category metadata
- `guildOnly` when applicable
- `userPermissions` for permissions required from the invoking member
- `botPermissions` for permissions required from the bot
- `execute(interaction)` — command implementation

The command loader is responsible for discovery and registration. The centralized command executor is responsible for common validation, permission checks, logging, and error handling. Individual commands should not duplicate those responsibilities unless a command has an additional resource-specific security requirement.

## Moderation Rules

Moderation commands must:

- Reject self-targeting where the action would be invalid.
- Respect Discord role hierarchy.
- Never allow a moderator to act on a member with an equal or higher role.
- Never allow the bot to act on a member above the bot's highest role.
- Protect the server owner from normal moderation actions.
- Declare required user and bot permissions.
- Validate target/member/channel types before performing an action.
- Log significant moderation actions through the existing logging service.
- Await database writes before reporting success or derived totals.

## TypeScript Rules

- Avoid `any` unless there is a documented unavoidable boundary.
- Prefer explicit Discord.js types.
- Prefer `unknown` over `any` for unknown external values.
- Keep command modules small and focused.
- Reuse shared utilities instead of duplicating permission or validation logic.
- Use async/await consistently and await persistence operations.

## Error Handling

Commands should fail safely and return a useful ephemeral error when an interaction cannot be completed. Unexpected exceptions should flow through the centralized command executor so users receive a consistent response and the error is logged.

## Developer Commands

Developer commands are owner-only. The owner ID should be supplied through `DISCORD_OWNER_ID`; do not add executable evaluation of arbitrary JavaScript to the bot.

## Project Direction

AegisDeno should be a reliable, maintainable, feature-rich Discord utility/moderation bot with a clean slash-command experience. Favor predictable behavior, strong typing, explicit permissions, safe moderation, and reusable services over unnecessary abstraction.