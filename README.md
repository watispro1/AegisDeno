# AegisDeno

[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](https://github.com/watipro/AegisDeno)
[![Discord.js](https://img.shields.io/badge/discord.js-v14.27-5865F2.svg)](https://discord.js.org/)
[![TypeScript](https://img.shields.io/badge/typescript-v5.0-3178C6.svg)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/mongodb-v9.0-47A248.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/license-ISC-green.svg)](./LICENSE)

AegisDeno is a modular Discord moderation, anti-raid, and community management bot built with TypeScript, **discord.js v14**, and MongoDB. Built for speed, security, and reliability, it includes a web control panel, Top.gg voting API support, and a complete suite of administration tools.

---

## Features

### Moderation & Security
- **Core Commands**: `/warn`, `/timeout`, `/removetimeout`, `/kick`, `/ban`, `/unban`, `/purge`, `/lock`, `/note`, `/slowmode`, `/nickname`.
- **Staff Analytics**: `/modstats` interactive staff activity metrics and `/dashboard` server management view.
- **Warning Escalation**: Automated punishments when warning thresholds are reached (`/escalation`).
- **Case Tracking**: View (`/case view`), edit reasons (`/case edit`), delete (`/case delete`), or export moderation logs as JSON (`/case export`).
- **Moderation Presets**: Apply security presets (`casual`, `community`, `gaming`, `strict`) via `/preset apply`.

### Automod & Anti-Raid
- **Content Filtering**: Banned words filter, link filter, mass-mention protection, and chat rate-limiting (`/automod`).
- **Exemptions**: Safe-list trusted roles and channels (`/automod exempt`).
- **Verification**: Interactive 1-click button or CAPTCHA verification panels (`/verify setup`).

### Support Tickets & Roles
- **Support Tickets**: Interactive ticket panels with private channel creation and staff permissions (`/ticket setup`, `/ticket close`).
- **Role Panels**: Self-assignable button role panels (`/rolepanel create`).
- **Auto-Responders**: Automated bot replies with variables (`{user}`, `{server}`, `{channel}`, `{member_count}`) via `/autoresponder`.

### Community Tools
- **Suggestions System**: Interactive suggestion boards with live voting and staff approval workflows (`/suggest`).
- **Native Polls**: Discord native poll integration with multi-select and duration timers (`/poll`).
- **Scheduled Tasks**: One-off reminders and recurring announcements (`/automation`).
- **Activity Summaries**: Community growth and message digests (`/activitysummary`).

---

## Setup & Running Locally

### 1. Prerequisites
- **Node.js** v20.0.0 or higher
- **MongoDB** connection URI (MongoDB Atlas or local instance)

### 2. Installation
```bash
git clone https://github.com/watipro/AegisDeno.git
cd AegisDeno
npm install
cp .env.example .env
```

### 3. Configuration
Fill out `.env` with your bot credentials:
```env
DISCORD_TOKEN="your_bot_token"
DISCORD_APPLICATION_ID="your_discord_app_id"
MONGO_URI="mongodb+srv://user:password@cluster.mongodb.net/aegis"
SITE_URL="http://localhost:3000"
PORT=3000
```

### 4. Running
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

- [`DISCOVERY.md`](./DISCOVERY.md) — Top.gg & App Directory submission details.
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Production deployment guide.
- [`OPERATIONAL.md`](./OPERATIONAL.md) — Maintenance and server administration guide.
- [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) — Troubleshooting guide for database, Discord tokens, and slash commands.

---

## License

ISC License.
