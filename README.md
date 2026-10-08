# 🛡️ AegisDeno — Enterprise Discord Moderation & Community Bot

[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)](https://github.com/watipro/AegisDeno)
[![Discord.js](https://img.shields.io/badge/discord.js-v14.27-5865F2.svg)](https://discord.js.org/)
[![Node.js](https://img.shields.io/badge/node.js-%3E%3D20.0.0-339933.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-v5.0-3178C6.svg)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/mongodb-v9.0-47A248.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/license-ISC-green.svg)](./LICENSE)

**AegisDeno** is a state-of-the-art, modular Discord utility, moderation, anti-raid, and community management bot built with TypeScript, **discord.js v14**, and MongoDB. Designed for speed, safety, and reliability, AegisDeno includes a built-in public Express web dashboard, Top.gg voting API support, and a complete suite of administration tools.

---

## ✨ Features Overview

### 🔨 Moderation & Security

- **Core Commands**: `/warn`, `/timeout`, `/removetimeout`, `/kick`, `/ban`, `/unban`, `/purge`, `/slowmode`, `/nickname`.
- **Warning Escalation**: Auto-punish users when reaching warning thresholds (`/escalation`).
- **Case Management**: View (`/case view`), edit reasons (`/case edit`), delete (`/case delete`), or export all guild moderation history as JSON (`/case export`).
- **1-Click Moderation Presets**: Instantly apply curated profiles (`casual`, `community`, `gaming`, `strict`) via `/preset apply`.

### 🛡️ Automod & Anti-Raid

- **Content Filtering**: Banned words filter, link filter, mass-mention spam protection, and chat rate-limiting (`/automod`).
- **Exemptions**: Safe-list trusted roles and channels (`/automod exempt`).
- **Member Verification**: Deploy interactive 1-click button or CAPTCHA verification panels to stop raids (`/verify setup`).

### 🎫 Interactive Support Tickets & Role Panels

- **Support Tickets**: Interactive ticket panels with private channel generation and staff role permissions (`/ticket setup`, `/ticket close`).
- **Button Role Panels**: Self-assignable multi-button role assignment panels (`/rolepanel create`).
- **Custom Auto-Responders**: Trigger automated bot replies with placeholder variables (`{user}`, `{server}`, `{channel}`, `{member_count}`) via `/autoresponder`.

### 🗳️ Community & Automation

- **Suggestions System**: Interactive suggestion submission with live 👍/👎 vote buttons and staff approval/rejection workflows (`/suggest`).
- **Native Polls**: Discord native poll integration with multi-select and duration timers (`/poll`).
- **Scheduled Tasks**: One-off reminders and recurring interval announcements (`/automation`).
- **Activity Summaries**: 24-hour, 7-day, and 30-day server activity digests (`/activitysummary`).

### 🌐 Dashboard & Top.gg Verification Preparedness

- **Web Dashboard**: Public command catalog, API endpoints (`/api/stats`, `/api/commands`), `/health` uptime monitoring, `/privacy`, and `/terms`.
- **Top.gg Webhook Integration**: Dedicated `/api/topgg/webhook` endpoint with authentication headers for live vote rewards.
- **Top.gg Stats Service**: Automated background server count posting (`src/services/topgg.ts`).

---

## 🚀 Quick Start & Installation

### 1. Prerequisites

- **Node.js** v20.0.0 or higher
- **npm** package manager
- **MongoDB** cluster connection string (e.g. MongoDB Atlas)

### 2. Setup & Installation

```bash
# Clone the repository
git clone https://github.com/watipro/AegisDeno.git
cd AegisDeno

# Install dependencies
npm install

# Copy configuration template
cp .env.example .env
```

### 3. Environment Configuration

Edit `.env` and supply your credentials:

```env
DISCORD_TOKEN="your_bot_token"
DISCORD_APPLICATION_ID="your_discord_app_id"
MONGO_URI="mongodb+srv://user:password@cluster.mongodb.net/aegis"
SITE_URL="http://localhost:3000"
PORT=3000

# Top.gg Integration (Optional for local testing)
TOPGG_TOKEN="your_topgg_api_token"
TOPGG_WEBHOOK_AUTH="your_topgg_webhook_secret"
```

### 4. Running locally

```bash
# Typecheck TypeScript codebase
npm run typecheck

# Start in development mode with live reload
npm run dev

# Compile and start production bundle
npm run build
npm start
```

---

## 🚀 Deployment (Fly.io)

AegisDeno is pre-configured for seamless production hosting on **Fly.io**:

```bash
# Set secrets on Fly.io
fly secrets set DISCORD_TOKEN="..." DISCORD_APPLICATION_ID="..." MONGO_URI="..." SITE_URL="https://aegisbot.dev"

# Top.gg secrets
fly secrets set TOPGG_TOKEN="..." TOPGG_WEBHOOK_AUTH="..."

# Deploy
fly deploy
```

Detailed deployment instructions and health check validation steps are available in [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## 📖 Documentation

- [`server.md`](./server.md) — AegisDeno Support Server Blueprint & Top.gg Verification Checklist.
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Step-by-step production deployment & environment validation guide.
- [`OPERATIONAL.md`](./OPERATIONAL.md) — Operational maintenance & verification procedures.
- [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) — Diagnostic guide for MongoDB, Discord tokens, slash command registration, and Fly.io.

---

## 📜 License

This project is licensed under the **ISC License**.
