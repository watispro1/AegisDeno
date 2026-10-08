# AegisDeno Support Server Blueprint & Top.gg Verification Guide

This document outlines the detailed architecture for the official **AegisDeno Support Server** and provides an operational checklist to prepare AegisDeno for **Top.gg Bot Listing & Verification**.

---

## 🎭 Role Hierarchy & Permissions

*Note: Role icons and Unicode emojis are supported directly in role names for enhanced visual hierarchy.*

### 👑 Administration

#### 1. 🛡️ Aegis Founder
- **Color:** `#FFD700` (Gold)
- **Base Permissions:** `ADMINISTRATOR`
- **Description:** Server Owner and Lead Developer. Full administrative control over all server resources.

#### 2. ⚔️ Administrator
- **Color:** `#E74C3C` (Red)
- **Base Permissions:** `ADMINISTRATOR`
- **Description:** Top-level community management handling server settings, webhooks, integrations, and high-level security escalations.

### 🛠️ Staff & Support

#### 3. 🔨 Moderator
- **Color:** `#3498DB` (Blue)
- **Base Permissions:** `KICK_MEMBERS`, `BAN_MEMBERS`, `MODERATE_MEMBERS`, `MANAGE_MESSAGES`, `MANAGE_THREADS`, `MUTE_MEMBERS`, `DEAFEN_MEMBERS`, `MOVE_MEMBERS`
- **Description:** Enforces community rules, handles `/case` management, reviews automod logs, and manages moderation actions.

#### 4. 🚑 Support Team
- **Color:** `#2ECC71` (Green)
- **Base Permissions:** `MANAGE_MESSAGES`, `MANAGE_THREADS`, `CREATE_PUBLIC_THREADS`, `CREATE_PRIVATE_THREADS`, `SEND_MESSAGES_IN_THREADS`
- **Description:** Assists community members with bot setup (`/config`, `/automod`, `/ticket`, `/verify`, `/preset`). Can manage support channels but lacks destructive ban/kick permissions.

### 🤖 Bot Integration

#### 5. 🤖 AegisDeno (Bot)
- **Color:** `#5865F2` (Blurple)
- **Base Permissions:** Computed runtime bitfield (View Channels, Send Messages, Embed Links, Manage Roles, Manage Channels, Moderate Members, Kick Members, Ban Members). *Never requires Administrator.*
- **Description:** Production instance of AegisDeno.

#### 6. 🔧 Test Bots
- **Color:** `#95A5A6` (Grey)
- **Base Permissions:** None (Scoped via channel permission overrides).
- **Description:** Staging and development builds of AegisDeno.

### 🌟 Community Tiers

#### 7. ✨ Server Booster
- **Color:** `#F47FFF` (Pink)
- **Base Permissions:** `USE_EXTERNAL_EMOJIS`, `USE_EXTERNAL_STICKERS`, `CHANGE_NICKNAME`, `ATTACH_FILES`
- **Description:** Automatically granted by Discord to Server Boosters.

#### 8. 🏆 Verified Developer
- **Color:** `#9B59B6` (Purple)
- **Base Permissions:** `VIEW_CHANNEL` (Grants access to hidden developer categories).
- **Description:** Open-source contributors and API integration developers.

#### 9. 👤 Member
- **Color:** `#FFFFFF` (White)
- **Base Permissions:** `VIEW_CHANNEL`, `SEND_MESSAGES`, `USE_APPLICATION_COMMANDS`, `READ_MESSAGE_HISTORY`, `CONNECT`, `SPEAK`
- **Description:** Verified community members.

#### 10. 🔇 Muted / Timed Out
- **Color:** `#2C3E50` (Dark Grey)
- **Base Permissions:** None
- **Description:** Managed dynamically by Discord's timeout system.

---

## 📁 Category & Channel Architecture

### 📌 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡

*Category Overrides:* `@everyone`: `VIEW_CHANNEL` (TRUE), `SEND_MESSAGES` (FALSE), `ADD_REACTIONS` (TRUE)

- 📜・**rules** — Official community guidelines, Terms of Service, and Privacy Policy links.
- 📢・**announcements** — AegisDeno release notes (`CHANGELOG.md`), patch updates, and status notices.
- 🚀・**getting-started** — Guide for adding AegisDeno, configuring slash commands, and applying 1-click `/preset` configurations.
- 🔗・**links** — Top.gg listing link, documentation, GitHub repository, and OAuth2 invite.
- 🗳️・**topgg-votes** — Automated webhook channel receiving live Top.gg upvote notifications.

### 💬 𝗖𝗢𝗠𝗠𝗨𝗡𝗜𝗧𝗬

*Category Overrides:* `@everyone`: `VIEW_CHANNEL` (TRUE), `SEND_MESSAGES` (TRUE), `READ_MESSAGE_HISTORY` (TRUE)

- 💬・**general** — Main chat for general discussion.
- 🤖・**bot-commands** — Designated channel for testing `/ping`, `/userinfo`, `/serverinfo`, and community commands.
- 💡・**suggestions** — Interactive suggestion channel powered by `/suggest` with live upvote/downvote buttons.
- 📊・**polls** — Server-wide community polls using Discord's native poll interface (`/poll`).

### 🛠️ 𝗦𝗨𝗣𝗣𝗢𝗥𝗧 𝗖𝗘𝗡𝗧𝗘𝗥

*Category Overrides:* `@everyone`: `VIEW_CHANNEL` (TRUE), `SEND_MESSAGES` (FALSE); `🚑 Support Team`: `VIEW_CHANNEL` (TRUE), `SEND_MESSAGES` (TRUE)

- 🎫・**open-a-ticket** — Interactive ticket panel created via `/ticket setup` for private support channels.
- 🛡️・**verification** — Anti-raid verification panel created via `/verify setup`.
- ❓・**setup-help** — Forum channel for troubleshooting MongoDB, environment variables, slash command registration, and Fly.io deployment.
- 📚・**faq** — Read-only answers to frequently asked setup and moderation questions.

### 💻 𝗗𝗘𝗩𝗘𝗟𝗢𝗣𝗠𝗘𝗡𝗧

*Category Overrides:* `@everyone`: `VIEW_CHANNEL` (FALSE); `🏆 Verified Developer`: `VIEW_CHANNEL` (TRUE), `SEND_MESSAGES` (TRUE)

- 👨‍💻・**dev-chat** — Developer chat for Node.js, TypeScript, discord.js, and API discussions.
- 🔄・**github-logs** — Webhook feed pushing GitHub commits and pull requests.
- 🧪・**beta-testing** — Testing grounds for upcoming unreleased bot features.

### 🚨 𝗦𝗧𝗔𝗙𝗙 𝗢𝗡𝗟𝗬

*Category Overrides:* `@everyone`: `VIEW_CHANNEL` (FALSE); `🔨 Moderator`: `VIEW_CHANNEL` (TRUE), `SEND_MESSAGES` (TRUE)

- 🛡️・**staff-chat** — Private channel for moderators and administrators.
- 📝・**mod-logs** — Channel for automated guild log events (`sendGuildLog`).
- ⚙️・**bot-config** — Private channel to test `/config`, `/automod`, and `/preset` commands safely.

### 🔊 𝗩𝗢𝗜𝗖🇪 𝗖𝗛𝗔𝗡𝗡𝗘𝗟𝗦

- 🎧・**Lounge** — Public voice channel.
- 🆘・**Support Waiting Room** — Queue for voice assistance.
- 🔒・**Staff VC** — Private staff voice room.

---

## 🚀 Top.gg Listing & Verification Checklist

To get AegisDeno successfully approved and verified on **Top.gg**, ensure all of the following requirements are met:

### 1. ⚙️ Technical Requirements

- [x] **Slash Commands Only**: 100% of commands use Discord Slash Commands with explicit `userPermissions` and `botPermissions`.
- [x] **Safe OAuth2 Invite URL**: The bot invite link computes an explicit bitfield and **never requests `ADMINISTRATOR`** on the invite screen.
- [x] **Uptime & Health Endpoint**: Public `/health` endpoint returns `200 OK` with gateway ping, uptime, and server stats for Top.gg status monitors.
- [x] **Privacy Policy & Terms**: Public URLs served at `/privacy` and `/terms`.
- [x] **Top.gg Webhook Endpoint**: Express route `/api/topgg/webhook` configured for real-time vote notifications with `TOPGG_WEBHOOK_AUTH` validation.
- [x] **Top.gg Server Count Posting**: Automatic background server count posting service (`src/services/topgg.ts`) updating `https://top.gg/api/bots/:id/stats` via `TOPGG_TOKEN`.

### 2. 📝 Top.gg Bot Page Content

- **Bot Name**: AegisDeno
- **Short Description**: High-performance Discord utility, moderation, support ticket, and anti-raid automation bot built with TypeScript & discord.js.
- **Detailed Description**: Highlight key feature categories:
  - 🔨 **Moderation & Escalation**: `/warn`, `/timeout`, `/kick`, `/ban`, `/escalation`, `/case`
  - 🛡️ **Automod & Anti-Raid**: `/automod`, `/verify`, `/preset`
  - 🎫 **Support Tickets**: `/ticket setup`, `/ticket close`
  - 🤖 **Auto-Responders & Roles**: `/autoresponder`, `/rolepanel`
  - 📊 **Analytics & Diagnostics**: `/activitysummary`, `/diagnostics`, `/serverinfo`
- **Prefix**: Slash commands (`/`)
- **Support Server Link**: Direct permanent invite link to the official AegisDeno Support Server.
- **Website Link**: Canonical website URL (`https://aegisbot.dev` or configured `SITE_URL`).

### 3. 🔑 Environment Variables for Top.gg

Add these variables to your production `.env` or Fly.io secrets:

```env
# Top.gg Integration
TOPGG_TOKEN="your_topgg_api_token"
TOPGG_WEBHOOK_AUTH="your_topgg_webhook_secret"
SUPPORT_SERVER_URL="https://discord.gg/your_support_server_code"
```
