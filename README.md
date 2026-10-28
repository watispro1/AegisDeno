# Aegis

[![Version](https://img.shields.io/badge/version-3.4.0-blue.svg)](https://aegisdeno.fly.dev)
[![Discord.js](https://img.shields.io/badge/discord.js-v14.27-5865F2.svg)](https://discord.js.org/)
[![TypeScript](https://img.shields.io/badge/typescript-v5.0-3178C6.svg)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/mongodb-v9.0-47A248.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](#license)

Aegis is a premium, invite-only Discord moderation and community management bot built with TypeScript, **discord.js v14**, and MongoDB. Engineered for high-security server environments, it delivers features found nowhere else — ghost-watch intel, per-member trust scores, automated ban appeal workflows, and rich moderation analytics.

---

## ✨ Standout Features

### 🕵️ Ghost Watch (unique)
Silently monitor any server member without alerting them. `/watchlist add @user` places a member on your staff watchlist — any message, edit, delete, join, leave, or role change fires an instant private DM to the requesting moderator. Pinpoint users before problems escalate.

### 🧠 Trust Score System (unique)
Every member gets a live **Trust Score (0–100)** calculated from account age, server tenure, warning history, and message behaviour. `/trustscore @user` shows a colour-coded risk profile with a breakdown drill-down. Configure auto-actions when a score drops below a threshold.

### 📋 Ban Appeal Workflow (unique)
When a user is banned, Aegis automatically DMs them a unique **appeal code** and instructions. Staff review pending appeals with `/appeal list` and approve/deny with `/appeal review`. Full audit trail — no more DMs-to-mods chaos.

### 📰 Mod Report (unique)
`/modreport` generates an interactive daily or weekly moderation digest: top offenders by infraction count, most active moderators, flagged keyword trends from automod hits, new-member risk events, and a 7-day infraction bar chart — all inside a Discord embed carousel.

---

## Core Feature Set

### Web Portal & Design System

The public site (`src/web/`) is server-rendered from TypeScript strings and served by Express. The design is intentionally plain and docs-first:

- **Look**: one warm off-white background (light by default, dark via the header toggle, saved in `localStorage`), one teal accent, IBM Plex Sans for text and IBM Plex Mono for anything you would type into Discord. Thin borders instead of shadows, corners of 6px or less, no gradients, blur or scroll animations.
- **Content**: commands are shown as real Discord slash commands (`/warn user:@member reason:...`) instead of icon tiles. The home page lists each feature with the command you would start with; `/features` and `/docs` give setup steps with copy-pasteable examples.
- **Command reference**: `/commands` is generated from the command definitions at startup, with a usage line, options table and permissions per command, a `/` shortcut to filter, category filters and `#cmd-<name>` deep links.
- **Search**: `Ctrl+K` (or `Cmd+K`) searches pages and every slash command.
- **Pages**: home, features, commands, docs, troubleshooting, changelog, status, privacy, terms and a 404. Health and data endpoints: `/health`, `/api/stats`, `/api/commands`, `/api/plugins`, `/changelog.xml`.
- **Files**: `theme.ts` (stylesheet), `layout.ts` (shell, nav, footer, search dialog), `pages.ts` (page bodies), `content.ts` (feature and FAQ copy), `client.ts` (progressive-enhancement JS, no dependencies), `assets.ts` (favicon, OG image, manifest).
- **Checks**: `npm run typecheck`, `npm test` (build plus `scripts/smoke-web.ts`), `npx tsx scripts/audit-site.ts` (links, ids, unstyled classes, dead CSS) and `npx tsx scripts/preview-site.ts` (static build into `dist/site`).

### Moderation & Security

- **Core Commands**: Enhanced `/warn` (rule presets, history, undo, quick-timeout), `/timeout` (presets, +1h extend, remove, case history), `/ban` (presets, account age audit, instant revoke, auto-appeal DM), `/purge` (filter, preview, progress bar, case audit), `/kick`, `/unban`, `/lock`, `/note`, `/slowmode`, `/nickname`.
- **Staff Analytics**: `/modstats` interactive staff activity metrics + `/modreport` weekly digest.
- **Warning Escalation**: Automated punishments when warning thresholds are reached (`/escalation`).
- **Case Tracking**: Complete case suite (`/case view`, `/case user`, `/case edit`, `/case delete`, `/case export`) with action icons and timestamps.
- **Moderation Presets**: Apply security presets (`casual`, `community`, `gaming`, `strict`) via `/preset apply`.

### Automod & Anti-Raid

- **Content Filtering**: Banned words filter, link filter, mass-mention protection, caps/character-flood detection, and chat rate-limiting (`/automod`).
- **Exemptions**: Safe-list trusted roles and channels (`/automod exempt`).
- **Verification**: Interactive 1-click button or CAPTCHA verification panels (`/verify setup`) with exception-safe error handling.

### Support Tickets & Roles

- **Support Tickets**: Interactive ticket panels with private channel creation and staff permissions (`/ticket setup`, `/ticket close`).
- **Role Panels**: Self-assignable button role panels (`/rolepanel create`).
- **Auto-Responders**: Automated bot replies with rich variables via `/autoresponder`.

### Community Tools

- **Starboard Plugin**: Configurable server hall-of-fame system powered by the Knub framework (`/starboard`).
- **Suggestions System**: Interactive suggestion boards with live voting and staff approval workflows (`/suggest`).
- **Native Polls**: Discord native poll integration with multi-select and duration timers (`/poll`).
- **Scheduled Tasks**: One-off reminders and recurring announcements (`/automation`).

---

## Setup & Running Locally

### Prerequisites

- **Node.js** v20.0.0 or higher
- **MongoDB** connection URI (MongoDB Atlas or local instance)

### Installation

```bash
git clone <private-repo-url>
cd AegisDeno
npm install
cp .env.example .env
```

### Configuration

Fill out `.env` with your bot credentials:

```env
DISCORD_TOKEN="your_bot_token"
DISCORD_APPLICATION_ID="your_discord_app_id"
MONGO_URI="mongodb+srv://user:password@cluster.mongodb.net/aegis"
SITE_URL="http://localhost:3000"
PORT=3000
```

### Running

```bash
# Typecheck
npm run typecheck

# Start in development mode
npm run dev

# Production build and run
npm run build
npm start
```

---

## Deployment (Fly.io)

```bash
fly secrets set DISCORD_TOKEN="..." DISCORD_APPLICATION_ID="..." MONGO_URI="..." SITE_URL="https://your-app.fly.dev"
fly deploy
```

---

## Documentation

- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Production deployment & Fly.io guide.
- [`OPERATIONAL.md`](./OPERATIONAL.md) — Maintenance and server administration guide.
- [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) — Troubleshooting guide for database, Discord tokens, and slash commands.
- [`server.md`](./server.md) — Official Aegis Support Server blueprint & channel permissions architecture.

---

## License

**Proprietary — All Rights Reserved.**

This software is not open source. Unauthorized copying, modification, distribution, or use of this software, in whole or in part, is strictly prohibited without explicit written permission from the author.
