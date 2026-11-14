# AegisDeno — Development Context

## Stack

- Runtime: Node.js 22+ (`engines` in `package.json`)
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
- `autoresponder` — keyword auto-responses
- `economy` — the opt-in server economy
- `roles` — role panels
- `tickets` — the ticket system
- `verification` — member verification
- `developer` — owner-only developer tools

Message and user context-menu commands (Report Message, Remind Me About This,
User Info, Avatar) live in `src/commands/contextMenus.ts`.

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

## Web Portal & Design System Architecture

The web dashboard and public reference pages live under `src/web/`:

- `theme/` — The CSS design system, split by area and joined in `theme/index.ts`: semantic tokens and the selectable themes (System, Light, Dark, Steel & Ink, and Glass, the only one that uses `backdrop-filter`, with a solid fallback).
- `layout.ts` — Global HTML layout scaffolding including responsive navigation (with direct Changelog link), search dialog modal, theme toggle (`data-theme`), and metadata.
- `client/` — Client-side vanilla JavaScript controlling theme persistence (`aegis-theme` in localStorage, never a cookie), global search (`Ctrl+K`), and quick clipboard copying. Note: NEVER include string template literals (`${...}`) in `clientScript` to preserve smoke test compliance.
- `assets.ts` — Inlined SVGs and synchronous `themeInitScript` executed before DOM paint to prevent styling flash.
- `pages/` — Server-side rendered HTML generators for the public routes, one module per page (`pages/index.ts` re-exports them).
- `server.ts` — Express server managing asset hashing, route registration, live telemetry streaming, and HTTP compression.
- `dashboard/` — The web dashboard (Discord OAuth, sessions, CSRF, one view module per page under `views/` and one route module per group under `routes/`).
- `pages/legal.ts` — Terms and Privacy. When a change starts or stops storing something, or changes how long it is kept, update the privacy table and the "Last updated" date there.

## Exclusive Proprietary Features (v3.4.0+)

Aegis includes unique high-value moderation capabilities not found in standard public bots:

- **Ghost Watch (`/watchlist`, `src/services/watchlistService.ts`):** Silent member surveillance tracking messages, edits, deletions, joins, leaves, and role changes via gateway events with direct DM alerts to staff.
- **Trust Score (`/trust user`, `src/services/trustEngine.ts`):** Explainable 0–100 score from account age, server tenure, verification, active days, warnings and cases by severity and recency, automod hits and Incident Mode join-gate flags, shown with a ten-square band-coloured bar (`scoreBar()` in `src/services/trustScore.ts`). `/trust config` sets the preset and low-trust integrations. `/trustscore` is a deprecated alias.
- **Incident Mode (`/incident`, `src/services/incidentService.ts`):** One-step raid response (slowmode, lockdown, join gate, paused invites) that records every change and restores it exactly.
- **ModMail (`/modmail`, `src/services/modmailService.ts`):** Members DM the bot; conversations become private staff threads, with transcripts kept 90 days after close.
- **Ban Appeal Workflow (`/appeal`):** Automatic unique appeal code (`AGS-XXXX`) generation during `/ban`, direct delivery to appellant DMs, Discord modal submission, and staff triage with automated unban execution upon approval.
- **Mod Report Digest (`/modreport`):** Multi-view interactive analytics digest aggregating 24h/7d metrics across moderation actions, repeat offenders, moderator team leaderboards, and AutoMod rule triggers.

## Project Direction & Distribution

Aegis is proprietary: all rights are reserved (see `LICENSE`, `"license": "UNLICENSED"` in `package.json`). The source is public on GitHub so it can be read and reviewed, but copying, modifying, redistributing or running a copy, public or private, needs the maintainer's written permission, as section "Source code and licence" of the Terms says. Do not describe it as open source anywhere, and do not add open-source or copyleft licences. Versions before 3.13.0 were MIT-licensed. Favor predictable behavior, strong typing, explicit permissions, safe moderation, and reusable services over unnecessary abstraction.