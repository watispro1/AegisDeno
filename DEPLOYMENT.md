# Aegis Deployment Checklist

A step-by-step guide for deploying Aegis to production on Fly.io with MongoDB Atlas.

> Aegis is proprietary (see [`LICENSE`](./LICENSE)). This guide is for the
> maintainer's deployment and for anyone the maintainer has given written
> permission to run a copy. Using the hosted bot needs none of this.

---

## Prerequisites

- [ ] Node.js 22+ installed locally
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
  - [x] **Presence Intent** (the bot requests it, so Discord refuses the
    connection if it is off)
  - The bot also requests the message reactions intent (starboard) and the
    direct messages intent (ModMail). Neither is privileged, so there is
    nothing to enable for them.
- [ ] Under **OAuth2 → URL Generator**, select scopes: `bot`, `applications.commands`
- [ ] Nothing to pick by hand: the site's `/invite` adds the computed permissions
  (`1460691659798`: View Channel, Send Messages, Embed Links, Read Message
  History, Attach Files, Manage Messages, Manage Channels, Manage Roles,
  Manage Nicknames, Manage Threads, Create Private Threads, Send Messages in
  Threads, Moderate Members, Kick Members, Ban Members). A custom
  `BOT_INVITE_URL` gets the same permissions added to it.

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
- [ ] Run `npm run build` (should compile with no TypeScript errors)
- [ ] Run `npm test` (unit tests plus the web smoke test: routes, asset hashing, CSP and security headers)
- [ ] Run `npm start` and verify:
  - [ ] `connected to mongodb` appears
  - [ ] `logged in as Aegis#XXXX` appears
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

> **Do not set `DISCORD_TEST_GUILD_ID` in production.** It registers commands guild-only and they won't appear globally.

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

| Log line                                                   | Meaning                        |
| ---------------------------------------------------------- | ------------------------------ |
| `connected to mongodb`                                     | DB connected                   |
| `registering X commands globally`                          | Commands being sent to Discord |
| `registered X global commands`                             | Registration done              |
| `Website listening on port 3000`                           | Web server up                  |
| `logged in as Aegis#XXXX`                                  | Bot online                     |
| `Scheduler initialised: X pending, Y overdue`              | Tasks loaded                   |

> Global slash commands can take **up to 1 hour** to propagate to all Discord clients after first registration. This is expected.

---

## 6. Fly.io Configuration Notes

The `fly.toml` is configured with:

- `auto_stop_machines = 'off'`: bot stays running 24/7 (required; Discord connections drop if the process sleeps)
- `min_machines_running = 1`: always at least one machine running
- `internal_port = 3000`: matches the default `PORT` value in the app
- `force_https = true`: Fly terminates TLS; the app sees plain HTTP internally

### Health check endpoint

Fly.io uses `/health` for its HTTP health checks automatically. The endpoint returns:

- `{"status":"ok"}` when the bot is connected to Discord
- `{"status":"degraded"}` during startup (before Discord login completes). This is normal; Fly waits for it to resolve

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

### AegisDB (Rust service)

These apply to the standalone Rust service in `crates/aegis-db` only; the Docker image runs the
embedded TypeScript engine, which ignores them. Set them in the service's environment (or with
`fly secrets set` if you run it on Fly):

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `AEGIS_DB_AUTO_COMPACT_SECS` | `300` | Compaction timer in seconds; `0` turns the timer off |
| `AEGIS_DB_COMPACT_WAL_BYTES` | `67108864` (64 MiB) | Compact once the WAL reaches this size; `0` disables |
| `AEGIS_DB_SNAPSHOT_ZSTD` | `true` | zstd-compress snapshots; legacy JSON snapshots still load |

- **Upgrading**: an existing plain-JSON `snapshot.json` loads as-is and is rewritten as zstd on the
  next compaction. Setting `AEGIS_DB_SNAPSHOT_ZSTD=false` later is safe too; zstd snapshots still load.
- **Backups**: pull a consistent copy on a schedule and keep it off the machine:
  `curl -fsS -H "x-aegis-secret: $AEGIS_BACKEND_SECRET" -o aegis-db-$(date +%F).json.zst http://127.0.0.1:4000/api/db/snapshot/export`.
  There is no import endpoint; restore by stopping the service and placing the file as
  `snapshot.json` in an empty data directory.
- **Watch** `wal_bytes`, `snapshot_bytes` and `last_compaction` (time, duration, trigger) in
  `GET /api/db/stats`. A `last_compaction` that stops advancing, or a `wal_bytes` that keeps growing
  past `compact_wal_bytes`, means compaction is failing: check the logs for `Background compaction`.

### MongoDB Atlas

- Enable **Atlas Alerts** for connection count spikes or slow queries
- Enable **Backup** (even on free tier snapshots)
- Periodically check **Network Access** and remove any overly-broad IP allowlists

---

## 10. First-Time Server Admin Guide

After inviting Aegis to a server:

1. **Set up a logging channel**: run `/logging channel` and pick your log channel so mod actions, member join/leave, and automod triggers are recorded
2. **Configure welcome messages** (optional): `/welcome channel`, then `/welcome toggle`
3. **Enable automod**: `/automod status` to see defaults, then configure rules as needed
4. **Test moderation**: try `/warn`, `/timeout`, `/modhistory` in a private channel first
5. **Check bot permissions**: run `/diagnostics`; it lists every invite permission Aegis is missing and what it is for. Locks need **Manage Roles** (not Manage Channels)
6. **Use the dashboard's Get started checklist**: the overview at `/dashboard` lists the setup steps still to do, worked out from the server's settings

Questions go to the support server: https://discord.gg/HwTbCYC4PM.

---

## Environment Variables Reference

| Variable                  | Required | Description                                                     |
| ------------------------- | -------- | --------------------------------------------------------------- |
| `DISCORD_TOKEN`           | ✅       | Bot token from Discord Developer Portal                         |
| `DISCORD_APPLICATION_ID`  | ✅       | Application ID from Discord Developer Portal                    |
| `MONGO_URI`               | ✅       | MongoDB Atlas connection string                                 |
| `DISCORD_TEST_GUILD_ID`   | Dev only | Register commands to this guild only (fast refresh)             |
| `DISCORD_CLEAR_GUILD_IDS` | Optional | Comma-separated guild IDs to clear stale guild commands on boot |
| `BOT_ENV`                 | Optional | `development` or `production` (default: `development`)          |
| `LOG_LEVEL`               | Optional | `debug`, `info`, `warn`, `error` (default: `info`)              |
| `PORT`                    | Optional | HTTP port for web server (default: `3000`)                      |
| `SITE_URL`                | Optional | Public site URL, used for SEO and canonical links               |
| `BOT_INVITE_URL`          | Optional | Custom OAuth2 invite URL                                        |
| `SUPPORT_SERVER_URL`      | Optional | Discord support server invite (default: `https://discord.gg/HwTbCYC4PM`) |
| `JOIN_WELCOME`            | Optional | `off` disables the one-time welcome posted on server join     |
| `CONTACT_EMAIL`           | Optional | Contact email shown on the terms and privacy pages              |
| `DISCORD_CLIENT_SECRET`   | Dashboard | OAuth2 client secret; the dashboard is off without it          |
| `DASHBOARD_SESSION_SECRET`| Dashboard | Signs session cookies and CSRF tokens; 32+ characters          |
| `DASHBOARD_REDIRECT_URI`  | Optional | OAuth2 redirect (default: `https://aegisdeno.fly.dev/dashboard/callback`) |
| `TOPGG_TOKEN`             | Optional | Posts the server count to Top.gg every 30 minutes               |
| `TOPGG_WEBHOOK_AUTH`      | Optional | Shared secret for the Top.gg vote webhook                       |
| `AEGIS_DB_AUTO_COMPACT_SECS` | Optional | Rust AegisDB: compaction timer in seconds (default `300`, `0` = off) |
| `AEGIS_DB_COMPACT_WAL_BYTES` | Optional | Rust AegisDB: compact when the WAL reaches this size (default 64 MiB, `0` = off) |
| `AEGIS_DB_SNAPSHOT_ZSTD`  | Optional | Rust AegisDB: zstd-compress snapshots (default `true`) |

## Web dashboard

The dashboard at `/dashboard` lets people with **Manage Server** or
**Administrator** log in with Discord, read and edit moderation cases, and change
the settings the bot stores. It is off until the two secrets below are set; until
then every `/dashboard` page says "not configured" and nothing else changes.

### 1. Discord Developer Portal

1. Open https://discord.com/developers/applications and pick the Aegis application.
2. Go to **OAuth2**.
3. Under **Redirects**, click **Add Redirect** and enter exactly:
   `https://aegisdeno.fly.dev/dashboard/callback`
   Then click **Save Changes**.
4. On the same page, under **Client Secret**, click **Reset Secret** (or copy it if
   you have it) and keep it for the next step. Resetting invalidates the old one.

The dashboard asks for the `identify` and `guilds` scopes only. You do not need to
tick them in the URL Generator; the login link sets them.

### 2. Fly secrets

```bash
fly secrets set \
  DISCORD_CLIENT_SECRET="paste-the-client-secret" \
  DASHBOARD_SESSION_SECRET="$(openssl rand -hex 32)" \
  -a aegisdeno
```

Setting secrets restarts the machines. `DISCORD_APPLICATION_ID` is already set and
doubles as the OAuth2 client ID.

If the site is served from another hostname, also set
`DASHBOARD_REDIRECT_URI="https://your-host/dashboard/callback"` and add that same
URL as a redirect in the portal. The two must match character for character.

### 3. Check it

1. Open https://aegisdeno.fly.dev/dashboard. It should show **Log in with Discord**
   instead of "not configured".
2. Log in. You should see the servers where you have Manage Server and Aegis is a
   member, and an **Add Aegis** link for servers you manage without it.
3. `fly logs -a aegisdeno` shows `Dashboard: user <id> signed in`. Secrets and
   tokens are never logged.

### Notes

- Sessions live in the `dashboardsessions` collection and expire after 7 days
  (TTL index). Only a SHA-256 of the session ID is stored; the Discord access
  token stays on the server and is revoked at logout.
- Rotating `DASHBOARD_SESSION_SECRET` signs everyone out.
- Every server page re-checks the member's permissions through the bot's
  gateway connection, so losing Manage Server takes effect on the next click.
- Changes made in the dashboard are posted to the server's log channel (if
  logging is on) with the dashboard user's mention, like slash command changes.
- Changes made in the dashboard are also kept per server in the
  `dashboardaudits` collection (TTL 180 days) and shown on its Activity page.
- Rate limits per client IP (from `Fly-Client-IP`): 20 login requests, 30 form
  posts and 240 page views per minute. Counters live in the
  `dashboardratelimits` collection (one document per client and minute, keyed
  by a hash of the IP, removed by a TTL index), so they are shared by every
  machine and survive restarts. If MongoDB is unreachable they fall back to
  in-memory counts.
- Both collections and their TTL indexes are created by Mongoose on start; no
  new environment variables, scopes or gateway intents are needed.
- Appeal reviews, unbans and posting panels from the dashboard need the same
  member permission as their slash command (Ban Members, Manage Channels or
  Manage Roles), and the bot needs Ban Members, Manage Roles, Send Messages,
  Embed Links and Read Message History where it acts.
- Local testing: set `DASHBOARD_REDIRECT_URI=http://localhost:3000/dashboard/callback`,
  add that redirect in the portal, and run `npm run dev`. Cookies drop the
  `Secure` flag only when the redirect URI is plain `http`.

## Aegis Premium (Paddle Billing)

Premium is planned at $5/month per server, sold through Paddle as merchant of record. **It is currently in development and not for sale.** Benefits live in `src/config/premium.ts`.

### Sales switch: `PREMIUM_SALES_ENABLED`

One environment variable decides whether anyone can start a new purchase. It is **off by default** (unset or anything other than `true`, `1`, `yes` or `on`).

| | `PREMIUM_SALES_ENABLED` off (default) | on (and all five Paddle secrets set) |
|---|---|---|
| `/pricing`, `/premium` | "In development — not for sale yet" badge, no price, no buy links | Price and "Upgrade on Dashboard" |
| Dashboard Premium page | Shown with the badge; no checkout, Paddle.js not loaded | Subscribe button (Paddle overlay) |
| `GET /dashboard/<server>/premium/checkout` | `403 {"error":"premium_not_for_sale"}`, so no Paddle checkout can open | Checkout settings for Paddle.js |
| `/premium` command | Says it's in development, no "Get Premium" button | Price and "Get Premium" |
| Terms, `/refunds` | Policy notes sales are paused; refund and cancel terms still cover existing subscriptions | Full policy with price |
| Webhook, entitlements, badge, billing portal | **Keep working** for any existing subscription (renewals, cancellations, refunds) | Same |

To open sales later: `fly secrets set PREMIUM_SALES_ENABLED=true` (this restarts the app). With it on but a Paddle secret missing, the dashboard Premium page is hidden and nothing can be bought.

Billing and refund policy (shown in the Terms "Aegis Premium and payments" section, on `/refunds` and on the public `/premium` page; keep all three in sync; `src/web/pages/premiumCopy.ts` holds both versions). While sales are paused the policy opens with "Aegis Premium is in development and not for sale yet: no new subscriptions can be started. If you already have a subscription, it is still billed by Paddle as merchant of record." and continues with the cancel and refund terms below. While for sale: Aegis Premium is $5 USD per month per server, billed by Paddle as merchant of record. You can cancel anytime from the dashboard Premium page; Premium stays active until the end of the paid period and is not renewed. If you're not happy, request a full refund within 14 days of any payment through Paddle (paddle.net) or our support server; refunds after 14 days are not given except where required by law. Paddle processes all refunds.

1. In Paddle (start in a sandbox account): **Catalog > Products**: create "Aegis Premium" (tax category: standard/SaaS) with a recurring price of USD 5.00 every 1 month. Copy the price ID (`pri_...`).
2. **Developer tools > Authentication**: create a client-side token (`test_...` in sandbox, `live_...` in production) and an API key with at least `customer_portal_session.write`.
3. **Developer tools > Notifications > New destination**: URL `https://aegisdeno.fly.dev/api/paddle/webhook`, type webhook, events `subscription.created`, `subscription.updated`, `subscription.activated`, `subscription.canceled`, `subscription.past_due`, `subscription.paused`, `subscription.resumed`, `subscription.trialing`, `transaction.completed`. Copy the destination's secret key (`pdl_ntfset_...`).
4. **Checkout > Checkout settings**: set the default payment link to `https://aegisdeno.fly.dev/premium`. For live, submit `aegisdeno.fly.dev` under **Website approval** (Paddle reviews the pricing, terms, privacy and refund information on the site).
5. Set the secrets (this restarts the app):

```bash
fly secrets set \
  PADDLE_ENV=sandbox \
  PADDLE_CLIENT_TOKEN=test_... \
  PADDLE_PRICE_ID=pri_... \
  PADDLE_API_KEY=... \
  PADDLE_WEBHOOK_SECRET=pdl_ntfset_...
```

6. Test with Paddle's webhook simulator and a sandbox checkout (card 4242 4242 4242 4242; needs `PREMIUM_SALES_ENABLED=true` on a sandbox deploy), then repeat steps 1–5 in the live account with `PADDLE_ENV=production`. Leave `PREMIUM_SALES_ENABLED` off in production until Premium is ready to sell.

## Automatic deploys from GitHub

Every push to `main` runs the CI checks (typecheck + tests). If they pass, the
`deploy` job runs `flyctl deploy --remote-only`.

One-time setup:

1. Create a deploy token scoped to this app: `fly tokens create deploy -a aegisdeno`
2. In GitHub, go to Settings → Secrets and variables → Actions → New repository secret.
   Name it `FLY_API_TOKEN` and paste the token.

To redeploy without a code change, re-run the latest CI workflow on `main` from the Actions tab.

Slash commands are registered on every boot (`registerCommands()` in `src/main.ts`),
so a deploy also syncs them. In global mode Discord can take up to an hour to show changes;
set `DISCORD_TEST_GUILD_ID` for instant guild-scoped registration while testing.
