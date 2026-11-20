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

### Data stores: MongoDB and AegisDB

- **MongoDB is the authoritative store.** Every command, the dashboard and the
  schedulers read and write MongoDB. Back it up (see below); it is the data that matters.
- **AegisDB is a secondary store**: the TypeScript engine in `src/database/aegisDb`, run
  inside the bot process. After a MongoDB write succeeds, the bot mirrors moderation cases,
  warnings and config snapshots into it. The bot calls the engine in process, not over HTTP.
- **If AegisDB is unavailable** (data directory locked by another process, disk full, missing
  `AEGIS_BACKEND_SECRET` outside development) the bot keeps working on MongoDB: mirror writes
  are retried from a small in-memory queue and dropped after a few attempts, and `/status`
  shows AegisDB as degraded while the bot stays operational. Nothing is lost from MongoDB.
- **Storage**: write-ahead log `ts-wal.jsonl` and snapshot `ts-snapshot.json` in
  `AEGIS_DB_PATH` (`/data/aegis-db` on the Fly volume). The engine compacts every 5 minutes
  and on shutdown. To back it up, copy `ts-snapshot.json` (and `ts-wal.jsonl`) off the volume;
  restore by stopping the bot and placing them in an empty data directory.
- **HTTP API**: the engine also listens on `127.0.0.1:$AEGIS_DB_PORT` (default 4000) for
  outside tools, protected by `AEGIS_BACKEND_SECRET`. If that port is taken the engine still
  runs; only the listener is skipped. `GET /api/db/stats` (with the secret) reports document
  counts and WAL size.
- **External AegisDB**: set `AEGIS_BACKEND_URL` only to point the bot at an AegisDB in another
  process; the bot then talks HTTP to it and does not open a local engine.

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

At startup the bot checks every variable below in one pass (`src/config/env.ts`).
If anything is missing or malformed it logs **one** error listing every problem
and exits with code 1, so fix the whole list before redeploying. Conditionally
required variables:

- `AEGIS_BACKEND_SECRET`: required unless `BOT_ENV`/`NODE_ENV` is `development` or `test`.
- `DASHBOARD_SESSION_SECRET` (32+ characters): required once `DISCORD_CLIENT_SECRET` is set.
- `STRIPE_*` values are optional and never stop startup while web checkout is off
  (`WEB_CHECKOUT_ENABLED` in `src/config/stripe.ts`, false today). If web checkout is ever
  switched back on, `SITE_URL` and all four `STRIPE_*` values become required.

A `.env` file is read only when `NODE_ENV` is not `production`; the Docker image sets
`NODE_ENV=production`, so on Fly only `fly secrets` count.

| Variable                  | Required | Description                                                     |
| ------------------------- | -------- | --------------------------------------------------------------- |
| `DISCORD_TOKEN`           | ✅       | Bot token from Discord Developer Portal                         |
| `DISCORD_APPLICATION_ID`  | ✅       | Application ID from Discord Developer Portal                    |
| `MONGO_URI`               | ✅       | MongoDB Atlas connection string                                 |
| `DISCORD_TEST_GUILD_ID`   | Dev only | Register commands to this guild only (fast refresh)             |
| `DISCORD_CLEAR_GUILD_IDS` | Optional | Comma-separated guild IDs to clear stale guild commands on boot |
| `BOT_ENV`                 | Optional | `development` or `production` (default: `development`)          |
| `LOG_LEVEL`               | Optional | `debug`, `info`, `warn`, `error` (default: `info`)              |
| `LOG_FORMAT`              | Optional | `json` or `pretty` (default: `json` when `NODE_ENV=production`, else `pretty`) |
| `BOT_OWNER_IDS`           | Optional | Comma-separated owner user IDs for `/developer` and `/sync`. Fallback when unset (and `DISCORD_OWNER_ID` unset): `1320058519642177668` |
| `DISCORD_OWNER_ID`        | Optional | Legacy single owner ID, added to `BOT_OWNER_IDS`                |
| `AEGIS_BACKEND_SECRET`    | Production | AegisDB shared secret; required outside development/test      |
| `PORT`                    | Optional | HTTP port for web server (default: `3000`)                      |
| `SITE_URL`                | Stripe   | Public site URL, used for SEO and canonical links; required only if web checkout is switched back on |
| `BOT_INVITE_URL`          | Optional | Custom OAuth2 invite URL                                        |
| `SUPPORT_SERVER_URL`      | Optional | Discord support server invite (default: `https://discord.gg/HwTbCYC4PM`) |
| `JOIN_WELCOME`            | Optional | `off` disables the one-time welcome posted on server join     |
| `CONTACT_EMAIL`           | Optional | Contact email shown on the terms and privacy pages              |
| `DISCORD_PREMIUM_SKU_ID`  | Optional | Discord Monetization Subscription SKU ID; required to sell and grant Premium |
| `DISCORD_CLIENT_SECRET`   | Dashboard | OAuth2 client secret; the dashboard is off without it          |
| `DASHBOARD_SESSION_SECRET`| Dashboard | Signs session cookies and CSRF tokens; 32+ characters          |
| `DASHBOARD_REDIRECT_URI`  | Optional | OAuth2 redirect (default: `https://aegisdeno.fly.dev/dashboard/callback`) |
| `RATE_LIMIT_STORE`        | Optional | Dashboard rate-limit counters: `memory` (default) or `mongo` (shared across instances) |
| `TOPGG_TOKEN`             | Optional | Posts the server count to Top.gg every 30 minutes               |
| `TOPGG_WEBHOOK_AUTH`      | Optional | Shared secret for the Top.gg vote webhook                       |
| `AEGIS_BACKEND_SECRET`    | Production | Secret for AegisDB's HTTP API; AegisDB (secondary store) does not start without it outside development |
| `AEGIS_DB_PATH`           | Optional | AegisDB data directory (default `./data/aegis-db`; Docker image: `/data/aegis-db`) |
| `AEGIS_DB_PORT`           | Optional | Port of AegisDB's local HTTP API for outside tools (default `4000`) |
| `AEGIS_BACKEND_URL`       | Optional | Use an external AegisDB over HTTP instead of the in-process engine (normally unset) |

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
  posts and 240 page views per minute. By default the counters live in memory
  in each process: no database round trip per request, and they reset on
  restart. That is correct for the usual single Fly machine.
- Running more than one machine? Set `RATE_LIMIT_STORE=mongo`
  (`fly secrets set RATE_LIMIT_STORE=mongo -a aegisdeno`) so every machine
  shares one count. Counters then live in the `dashboardratelimits` collection
  (one document per client and minute, keyed by a hash of the IP, removed by a
  TTL index) and survive restarts; if MongoDB is unreachable they fall back to
  in-memory counts. Without it, each machine enforces the limits on its own, so
  a client spread across N machines gets up to N times the limit.
- The collections and their TTL indexes are created by Mongoose on start; no
  scopes or gateway intents beyond the above are needed.
- Appeal reviews, unbans and posting panels from the dashboard need the same
  member permission as their slash command (Ban Members, Manage Channels or
  Manage Roles), and the bot needs Ban Members, Manage Roles, Send Messages,
  Embed Links and Read Message History where it acts.
- Local testing: set `DASHBOARD_REDIRECT_URI=http://localhost:3000/dashboard/callback`,
  add that redirect in the portal, and run `npm run dev`. Cookies drop the
  `Secure` flag only when the redirect URI is plain `http`.

## Aegis Premium (sold only through Discord In-App Subscriptions)

Owner's decision: Aegis Premium ($5/month per server) is sold **only** as a Discord in-app subscription. It is **not** buyable on the website: there is no Stripe checkout on the public `/pricing` and `/premium` pages or on the dashboard's Premium page. Every web surface shows a **Subscribe in Discord** link to the app's Discord store instead, and Discord handles billing, cancellation and refunds under Discord's terms. The shared public wording lives in `src/web/pages/billingCopy.ts`.

### Web checkout switch: `WEB_CHECKOUT_ENABLED` (off)

Web (Stripe) checkout is hard-disabled by the code constant `WEB_CHECKOUT_ENABLED = false` in `src/config/stripe.ts`. It is deliberately **not** an environment variable, so no combination of secrets can turn it back on: even with every `STRIPE_*` secret set,

- the dashboard Premium page shows no Subscribe/checkout button and does not load Stripe.js (the page's CSP no longer allows `js.stripe.com` or Stripe frames), and
- `POST /dashboard/<server ID>/premium/checkout` answers `403 {"error":"web_checkout_disabled"}` before any session, CSRF or Stripe check.

Re-enabling web purchase would be a code change and an owner decision, not a deploy setting.

### 1. Discord in-app subscription (Discord SKU) — how Premium is sold

1. Open https://discord.com/developers/applications and select your Aegis application.
2. Go to **Monetization → SKUs**.
3. Create a **Guild Subscription** SKU (e.g. "Aegis Premium Server Subscription") at **USD 5.00/month**, matching the `$5 / month` shown on the site (`PREMIUM_PRICE_LABEL` in `src/config/premium.ts`). Discord shows each buyer the price in their local currency and adds tax where it applies, so the amount they see in Discord may differ slightly; the site says so.
4. Copy the SKU ID (a snowflake number) and set it as an environment variable or Fly secret:
   ```bash
   fly secrets set DISCORD_PREMIUM_SKU_ID="your-sku-id" -a aegisdeno
   ```
5. `DISCORD_APPLICATION_ID` must be set too (it already is for the bot). With both set:
   - `/premium`, `/pricing` and the dashboard Premium page show **Subscribe in Discord**, linking to `https://discord.com/application-directory/<DISCORD_APPLICATION_ID>/store/<DISCORD_PREMIUM_SKU_ID>`, with how-to copy (open Aegis's profile in Discord → Subscribe, or use `/premium` in a server).
   - The `/premium` slash command shows Discord's native Premium (SKU) button.
   - The bot listens for `entitlementCreate`, `entitlementUpdate` and `entitlementDelete` and syncs entitlements on startup to switch Premium on and off.
6. Without `DISCORD_PREMIUM_SKU_ID`, every surface says **Coming soon on Discord** with no price call to action, the roadmap still lists Premium, and **no entitlement grants Premium**. Only an entitlement to `DISCORD_PREMIUM_SKU_ID` ever grants it; an entitlement to any other SKU of the app is ignored.

### 2. Stripe — existing website subscribers only

Stripe stays wired up only for subscriptions bought on the website before Premium moved to Discord. With the four `STRIPE_*` secrets set, the Stripe webhook (`/api/stripe/webhook`) keeps those subscriptions in sync, and the buyer can still open Stripe's billing portal from the dashboard Premium page to update their card or cancel. New Stripe subscriptions cannot be started (see `WEB_CHECKOUT_ENABLED`). Without the secrets the webhook answers 503. For a refund of one of those website payments, the buyer asks in the support server within 14 days of the payment; the pages say this too.

If you still have Stripe subscribers, keep these set:

1. **Developers > API keys**: the Secret key (`sk_test_...`/`sk_live_...`) and Publishable key (`pk_test_...`/`pk_live_...`).
2. **Product catalog**: the existing "Aegis Premium" price ID (`price_...`).
3. **Developers > Webhooks**: the endpoint `https://aegisdeno.fly.dev/api/stripe/webhook` with events
   `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`,
   `customer.subscription.paused`, `customer.subscription.resumed`, `checkout.session.completed`,
   `invoice.payment_succeeded`, `invoice.payment_failed`, and its signing secret (`whsec_...`).

```bash
fly secrets set \
  STRIPE_SECRET_KEY=sk_... \
  STRIPE_PUBLISHABLE_KEY=pk_... \
  STRIPE_PRICE_ID=price_... \
  STRIPE_WEBHOOK_SECRET=whsec_...
```

Test webhooks locally with the Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## Automatic deploys from GitHub

Every push to `main` runs the CI checks (version lockstep check, lint, typecheck, tests with a coverage summary, and the web smoke test). If they pass, the
`deploy` job runs `flyctl deploy --remote-only`.

One-time setup:

1. Create a deploy token scoped to this app: `fly tokens create deploy -a aegisdeno`
2. In GitHub, go to Settings → Secrets and variables → Actions → New repository secret.
   Name it `FLY_API_TOKEN` and paste the token.

To redeploy without a code change, re-run the latest CI workflow on `main` from the Actions tab.

Slash commands are registered on every boot (`registerCommands()` in `src/main.ts`),
so a deploy also syncs them. In global mode Discord can take up to an hour to show changes;
set `DISCORD_TEST_GUILD_ID` for instant guild-scoped registration while testing.
