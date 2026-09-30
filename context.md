# AegisDeno — Discordeno Bot Project Context

## 1. Project Identity
**Project name**: AegisDeno
**Platform**: Discord
**Runtime**: Deno
**Language**: TypeScript
**Discord library**: Discordeno (@discordeno/bot)
**Primary purpose**: A modern all-purpose Discord server utility, moderation, automation, and community-management bot.

### One-line description
AegisDeno is a fast, modular Discord bot built with TypeScript, Deno, and Discordeno that provides moderation, automation, utility, server management, logging, configuration, and community features through clean slash commands and Discord interactions.

### Design goals
*   Fast startup and low overhead.
*   Slash-command-first architecture.
*   Modular commands that are easy to add, remove, and maintain.
*   Strong permission checks before privileged operations.
*   Predictable and useful error messages.
*   Safe handling of user input.
*   Minimal unnecessary state and caching.
*   Configuration that can be changed per server.
*   Consistent embeds/components and response formatting.
*   Production-ready structure without unnecessary complexity.
*   Clear separation between Discord event handling, commands, services, storage, and configuration.

## 2. Technology Requirements
**Use:**
*   Deno
*   TypeScript
*   Discordeno
*   Discord application commands/interactions
*   Deno's native tooling where practical
*   Environment variables for secrets
*   A database only when persistent data is actually required

Discordeno is the primary Discord API abstraction. Do not introduce another Discord library unless there is a specific, documented reason.
Discordeno supports Deno and can be imported through the npm: specifier. Prefer the current Discordeno documentation and currently supported package versions rather than copying outdated examples.
Official documentation:
*   [https://discordeno.js.org/](https://discordeno.js.org/)
*   [https://github.com/discordeno/discordeno](https://github.com/discordeno/discordeno)

## 3. Bot Personality
AegisDeno should feel:
*   Professional
*   Helpful
*   Direct
*   Modern
*   Slightly technical
*   Not overly verbose
*   Consistent

The bot should avoid unnecessary roleplay, excessive emojis, fake system messages, or overly complicated responses.

**Example response style:**
> **Configuration Updated**
> Moderation logging has been enabled for this server.

Instead of:
> 🎉🎉 YOOOOOO!!! Your settings have been updated!!! 🚀🔥

## 4. Core Feature Set
AegisDeno should be an all-purpose server-management bot.
**Feature groups:**
*   General
*   Moderation
*   Auto Moderation
*   Server Management
*   Logging
*   Roles
*   Utility
*   Automation
*   Welcome/Goodbye
*   Community
*   Information
*   Developer/Diagnostics
*   Configuration

All commands should be implemented as slash commands unless there is a strong Discord-specific reason to use another interaction type.

## 5. Command Organization
Commands should be grouped by logical category.
Recommended command tree:
```
/
├── help
├── ping
├── about
├── invite
├── support
│
├── moderation
│   ├── warn
│   ├── warnings
│   ├── clearwarnings
│   ├── timeout
│   ├── removetimeout
│   ├── kick
│   ├── ban
│   ├── unban
│   ├── softban
│   ├── purge
│   └── slowmode
│
├── automod
│   ├── enable
│   ├── disable
│   ├── config
│   ├── words
│   ├── links
│   ├── mentions
│   └── spam
│
├── config
│   ├── view
│   ├── set
│   ├── reset
│   └── permissions
│
├── logging
│   ├── enable
│   ├── disable
│   ├── channel
│   └── events
│
├── role
│   ├── add
│   ├── remove
│   ├── create
│   ├── delete
│   └── info
│
├── utility
│   ├── avatar
│   ├── banner
│   ├── userinfo
│   ├── serverinfo
│   ├── roleinfo
│   ├── channelinfo
│   ├── snowflake
│   └── permissions
│
├── welcome
│   ├── enable
│   ├── disable
│   ├── channel
│   ├── message
│   └── test
│
├── automation
│   ├── reminder
│   ├── schedule
│   ├── list
│   └── cancel
│
├── community
│   ├── poll
│   ├── announce
│   └── suggest
│
└── developer
    ├── status
    ├── stats
    ├── reload
    └── debug
```
Do not implement every command immediately. Build the foundation first, then add command groups incrementally.

## 55. Implementation Priority
Build the project in this order.

**Phase 1 — Foundation**
Implement:
*   Bot initialization
*   Environment loading
*   Logger
*   Command loader
*   Interaction handling
*   Error handling
*   `/ping`
*   `/help`
*   `/about`

[... See full context for more phases]

## 58. AI Coding-Agent Instructions
When an AI coding agent works on this repository:
*   Read this context.md before modifying the project.
*   Inspect existing code before creating new abstractions.
*   Follow the existing architecture unless there is a concrete reason to change it.
*   Use current Discordeno documentation when an API detail is uncertain.
*   Do not invent Discordeno methods or types.
*   Do not replace Discordeno with another Discord library.
*   Do not expose tokens or credentials.
*   Do not weaken permission checks to make a feature work.
*   Do not add privileged intents without explaining why they are necessary.
*   Do not create unnecessary database dependencies.
*   Prefer small, reviewable changes.
*   Update tests when behavior changes.
*   Run formatting, linting, type checking, and relevant tests after changes.
*   If a Discord API behavior is uncertain, verify it against current documentation rather than guessing.
*   Preserve guild isolation.
*   Preserve existing command behavior unless the task explicitly requests a breaking change.
