# Aegis Deployment Checklist

A step-by-step guide for deploying Aegis to production on Fly.io with MongoDB Atlas.

---

## Prerequisites

- [ ] Node.js 20+ installed locally
- [ ] [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/) installed and authenticated (`fly auth login`)
- [ ] A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster created (M0 free tier is fine)
- [ ] A Discord application created at [discord.com/developers](https://discord.com/developers/applications)

---

## 1. Discord Application Setup

- [ ] Create a new application at the Discord Developer Portal
- [ ] Copy the **Application ID** → `DISCORD_APPLICATION_ID`
- [ ] Go to **Bot** → Reset Token → copy it → `DISCORD_TOKEN`
- [ ] Under **Privileged Gateway Intents**, enable:
  - [x] **Server Members Intent** (required for welcome messages and hierarchy checks)
  - [x] **Message Content Intent** (required for automod)
  - [ ] **Presence Intent** (optional — only needed for rich presence display)
- [ ] Under **OAuth2 → URL Generator**, select scopes: `bot`, `applications.commands`
- [ ] Select bot permissions: `Manage Messages`, `Kick Members`, `Ban Members`, `Moderate Members`, `Send Messages`, `Embed Links`, `Read Message History`, `View Audit Log`
- [ ] Copy the generated OAuth2 URL → `BOT_INVITE_URL`

---

## 2. MongoDB Atlas Setup

- [ ] Create a new cluster (M0 free tier or higher)
- [ ] Create a database user (username + strong password)
- [ ] Under **Network Access**, add your Fly.io deployment region's IP range, or use `0.0.0.0/0` (restrict later)
- [ ] Go to **Connect → Drivers** → copy the connection string → replace `<password>` → `MONGO_URI`
  - Format: `mongodb+srv://USERNAME:PASSWORD@cluster.mongodb.net/aegis?retryWrites=true&w=majority`
- [ ] Verify connection locally: `node -e "const m = require('mongoose'); m.connect(process.env.MONGO_URI).then(() => { console.log('OK'); process.exit(0); })"`

---

## 3. Local Development Verification

- [ ] Copy `.env.example` to `.env` and fill in all values
- [ ] Set `DISCORD_TEST_GUILD_ID` to a private test server ID for fast command registration
- [ ] Run `npm install`
- [ ] Run `npm run build` — should compile with 0 TypeScript errors
- [ ] Run `npm start` and verify:
  - [ ] `✅ Successfully connected to MongoDB!` appears
  - [ ] `✅ Logged in as Aegis#XXXX` appears
  - [ ] `Website listening on port 3000` appears
  - [ ] Visit `http://localhost:3000/health` → should return `{"status":"ok",...}`
  - [ ] Slash commands appear in your test guild within seconds

---

## 4. Fly.io Deployment

### 4a. App creation (first time only)
```bash
fly launch --no-deploy
```
- Accept the `fly.toml` config
- Do not create a Postgres database (using MongoDB Atlas instead)

### 4b. Set production secrets
```bash
fly secrets set \
  DISCORD_TOKEN="your-bot-token" \
  DISCORD_APPLICATION_ID="your-app-id" \
  MONGO_URI="mongodb+srv://..." \
  SITE_URL="https://your-app.fly.dev" \
  BOT_ENV="production" \
  LOG_LEVEL="info"
```

Optional secrets:
```bash
fly secrets set \
  SUPPORT_SERVER_URL="https://discord.gg/your-invite" \
  BOT_INVITE_URL="https://discord.com/oauth2/authorize?..." \
  CONTACT_EMAIL="you@example.com" \
  DISCORD_CLEAR_GUILD_IDS="guild-id-1,guild-id-2"
```

> **Do not set `DISCORD_TEST_GUILD_ID` in production** — this registers commands guild-only and they won't appear globally.

### 4c. Deploy
```bash
fly deploy
```

### 4d. Verify deployment
```bash
fly status                          # Machines should be "started"
fly logs                            # Watch for startup messages
curl https://your-app.fly.dev/health  # Should return {"status":"ok",...}
```

---

## 5. Production Health Checks

After first deploy, verify the following in `fly logs`:

| Log line | Meaning |
|----------|---------|
| `✅ Successfully connected to MongoDB!` | DB connected |
| `Registering X commands globally...` | Commands being sent to Discord |
| `Global commands registered (up to 1h propagation delay).` | Registration done |
| `Website listening on port 3000` | Web server up |
| `✅ Logged in as Aegis#XXXX` | Bot online |
| `Scheduler initialised: X pending, Y overdue` | Tasks loaded |

> Global slash commands can take **up to 1 hour** to propagate to all Discord clients after first registration. This is expected.

---

## 6. Fly.io Configuration Notes

The `fly.toml` is configured with:
- `auto_stop_machines = 'off'` — bot stays running 24/7 (required; Discord connections drop if the process sleeps)
- `min_machines_running = 1` — always at least one machine running
- `internal_port = 3000` — matches the default `PORT` value in the app
- `force_https = true` — Fly terminates TLS; the app sees plain HTTP internally

### Health check endpoint
Fly.io uses `/health` for its HTTP health checks automatically. The endpoint returns:
- `{"status":"ok"}` when the bot is connected to Discord
- `{"status":"degraded"}` during startup (before Discord login completes) — this is normal and Fly will wait for it to resolve

---

## 7. Updating an Existing Deployment

```bash
npm run build       # Verify no TypeScript errors first
git push            # If using GitHub Actions CI
# or
fly deploy          # Direct deploy from local
```

---

## 8. Rollback

```bash
fly releases          # List releases
fly deploy --image <release-id>  # Roll back to a specific image
```

---

## 9. Monitoring & Maintenance

```bash
fly logs              # Tail live logs
fly ssh console       # Shell into the running machine
fly scale show        # View current machine resources
fly secrets list      # List set secret names (values are hidden)
```

### MongoDB Atlas
- Enable **Atlas Alerts** for connection count spikes or slow queries
- Enable **Backup** (even on free tier snapshots)
- Periodically check **Network Access** and remove any overly-broad IP allowlists

---

## 10. First-Time Server Admin Guide

After inviting Aegis to a server:

1. **Set up a logging channel** — run `/logging setup #your-log-channel` so mod actions, member join/leave, and automod triggers are recorded
2. **Configure welcome messages** (optional) — `/welcome setup #welcome-channel`
3. **Enable automod** — `/automod status` to see defaults, then configure rules as needed
4. **Test moderation** — try `/warn`, `/timeout`, `/modhistory` in a private channel first
5. **Check bot permissions** — Aegis needs **Manage Messages**, **Moderate Members**, and **Ban Members** at minimum

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | ✅ | Bot token from Discord Developer Portal |
| `DISCORD_APPLICATION_ID` | ✅ | Application ID from Discord Developer Portal |
| `MONGO_URI` | ✅ | MongoDB Atlas connection string |
| `DISCORD_TEST_GUILD_ID` | Dev only | Register commands to this guild only (fast refresh) |
| `DISCORD_CLEAR_GUILD_IDS` | Optional | Comma-separated guild IDs to clear stale guild commands on boot |
| `BOT_ENV` | Optional | `development` or `production` (default: `development`) |
| `LOG_LEVEL` | Optional | `debug`, `info`, `warn`, `error` (default: `info`) |
| `PORT` | Optional | HTTP port for web server (default: `3000`) |
| `SITE_URL` | Optional | Public site URL, used for SEO and canonical links |
| `BOT_INVITE_URL` | Optional | Custom OAuth2 invite URL |
| `SUPPORT_SERVER_URL` | Optional | Discord support server invite |
| `CONTACT_EMAIL` | Optional | Contact email shown in web footer |
