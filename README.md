# Aegis

Aegis is a moderation bot for Discord, run from slash commands. It handles
warnings, timeouts, bans and the case log behind them, plus automod, ban
appeals, tickets, verification, logging, a staff watchlist and per-member trust
scores. Server managers can also review cases and change settings in a web
dashboard.

| | |
| --- | --- |
| Website | https://aegisdeno.fly.dev |
| Add to Discord | the **Add to Discord** button on the website |
| Command reference | https://aegisdeno.fly.dev/commands |
| Web dashboard | https://aegisdeno.fly.dev/dashboard |
| Status | https://aegisdeno.fly.dev/status |
| Current version | bot 3.6.1, dashboard 1.2.2 |

Despite the repository name, Aegis is a **Node.js** app (TypeScript,
discord.js v14, Mongoose/MongoDB, Express). It does not run on Deno.

## Contents

- [What it does](#what-it-does)
- [Running it yourself](#running-it-yourself)
- [Deploying to Fly.io](#deploying-to-flyio)
- [Development and tests](#development-and-tests)
- [Project documents](#project-documents)
- [Licence](#licence)

## What it does

Every command, option and permission is listed on the
[commands page](https://aegisdeno.fly.dev/commands), which is generated from the
command definitions in `src/commands`, so it always matches what the bot
registers. In short:

**Moderation.** `/warn`, `/timeout`, `/kick`, `/ban` and `/unban` check role
hierarchy, ask for confirmation and write a numbered case. The `reason` option
suggests presets but takes any text, and `proof` attaches a screenshot to the
case. `/warn`, `/timeout` and `/ban` show an Undo button for five minutes; undo
reverses the action and marks the case revoked. Also `/purge` (filters for
bots, humans, links, images, embeds, a user or a keyword, with a preview),
`/lock` (a channel, a category or the whole server, optionally timed),
`/slowmode`, `/nickname`, `/note`, `/case`, `/infractions` and `/modhistory`.
`/escalation` turns a number of warnings into a timeout, kick or ban, and can
ignore warnings older than a set number of days.

**Automod.** Blocked words, links, mass mentions, message rate and caps, each
with its own action (delete, delete and warn, delete and timeout), plus role and
channel exemptions.

**Trust score.** `/trustscore` gives a 0 to 100 number from account age, time
in the server, a long-tenure bonus, active warnings, timeouts, kicks and bans
that were not undone, and message activity. Only a message count and a
last-active time are stored, never message content. The score is
informational: nothing happens automatically when it is low.

**Ban appeals.** `/ban` DMs the member a code like `AGS-K7X2`. They file an
appeal with `/appeal submit` from any server Aegis shares with them; staff
review it with `/appeal list|view|review` or in the dashboard, and approving it
unbans them.

**Watchlist.** `/watchlist add` quietly watches a member and DMs the moderator
when they post, edit or delete a message, join or leave, have their roles
changed or join voice, depending on the events picked. Alerts can also go to a
staff channel. The member is not told.

**Mod reports.** `/modreport` shows the last 24 hours or 7 days in four views:
overview, top offenders, moderator activity and automod hits. `/modstats` and
`/activitysummary` give simpler counts.

**Everything else.** Logging to a channel (`/logging`), tickets with claim,
inactivity auto-close and HTML transcripts (`/ticket`), button or math-captcha
verification with optional auto-kick (`/verify`), role panels as buttons or a
dropdown (`/rolepanel`), auto-responders, a starboard, giveaways with booster
bonus entries, button polls that close on a timer, suggestions with
Approve/Deny/Consider, welcome messages, personal reminders that can repeat
(`/remindme`) and scheduled channel posts (`/automation`). Timed actions are
stored in MongoDB and restored after a restart.

**Web dashboard.** At [`/dashboard`](https://aegisdeno.fly.dev/dashboard),
people with Manage Server or Administrator log in with Discord (`identify` and
`guilds` scopes only) to see a server overview, browse and filter cases, edit a
reason or revoke a case, review ban appeals, post the ticket, verification and
role panels, and change logging, escalation, automod, welcome, ticket,
verification and starboard settings. An Activity page shows who changed what.
Everything it does is also available as a slash command.

What the bot and dashboard store, and for how long, is in the
[privacy policy](https://aegisdeno.fly.dev/privacy). The rules for using them
are in the [terms of service](https://aegisdeno.fly.dev/terms).

## Running it yourself

The source is public so it can be read and reviewed, but it is **not open
source** (see [Licence](#licence)). Ask the author before running your own copy.
With permission, you need:

- Node.js 20 or newer (CI and the Docker image use Node 22).
- A MongoDB database (Atlas or local).
- A Discord application with a bot user. Under **Bot** in the Developer Portal,
  turn on the Server Members, Message Content and Presence intents; the bot
  requests all three.

```bash
git clone https://github.com/watispro1/AegisDeno.git
cd AegisDeno
npm ci
cp .env.example .env
```

Fill in `.env`. Every variable the code reads:

| Variable | Required | What it does |
| --- | --- | --- |
| `DISCORD_TOKEN` | yes | Bot token. The bot exits at startup without it. |
| `DISCORD_APPLICATION_ID` | yes | Application (client) ID. Also used to build the invite link and as the dashboard's OAuth client ID. |
| `MONGO_URI` | yes | MongoDB connection string, e.g. `mongodb+srv://user:password@cluster/db`. |
| `DISCORD_TEST_GUILD_ID` | no | Register commands to one server only (instant, for testing). Leave empty for global commands. |
| `DISCORD_CLEAR_GUILD_IDS` | no | Comma-separated server IDs whose guild-scoped commands are cleared at startup, so a command does not appear twice after testing. |
| `DISCORD_OWNER_ID` | no | Your user ID, for the developer commands. |
| `BOT_ENV` | no | Read into the config but not used by any feature yet. |
| `LOG_LEVEL` | no | `info` (default) or `debug`. |
| `SITE_URL` | in production | Public origin of the website, no trailing slash. Used for canonical URLs, Open Graph tags, `sitemap.xml` and `security.txt`. |
| `PORT` | no | Website port. Defaults to 3000, which is what `fly.toml` exposes. |
| `BOT_INVITE_URL` | no | Base invite URL; the client ID, computed permissions and scopes are added to it. |
| `SUPPORT_SERVER_URL` | no | Support server link shown on the website and legal pages. |
| `CONTACT_EMAIL` | no | Email shown on the terms and privacy pages. Without it they point to GitHub issues only. |
| `DISCORD_CLIENT_SECRET` | for the dashboard | OAuth2 client secret from the Developer Portal. |
| `DASHBOARD_SESSION_SECRET` | for the dashboard | At least 32 characters; signs session cookies and CSRF tokens. Generate with `openssl rand -hex 32`. |
| `DASHBOARD_REDIRECT_URI` | no | Must match a redirect under OAuth2 in the Developer Portal. Defaults to `https://aegisdeno.fly.dev/dashboard/callback`; locally use `http://localhost:3000/dashboard/callback`. |
| `TOPGG_TOKEN` | no | Posts the server count to Top.gg every 30 minutes. |
| `TOPGG_WEBHOOK_AUTH` | no | Shared secret for the Top.gg vote webhook. The webhook answers 503 until it is set. |

The dashboard stays off, and `/dashboard` says so, until `DISCORD_CLIENT_SECRET`
and a long enough `DASHBOARD_SESSION_SECRET` are both set.

Then:

```bash
npm run dev                 # run from source with tsx
npm run build && npm start  # compiled
```

Slash commands are registered every time the bot starts. The website and the
dashboard are served by the same process.

## Deploying to Fly.io

`fly.toml` and the `Dockerfile` are set up for Fly.io (app `aegisdeno`, primary
region `dfw`, one always-on machine). Pushes to `main` deploy automatically from
GitHub Actions once the checks pass; this needs a `FLY_API_TOKEN` repository
secret. To deploy by hand:

```bash
fly secrets set DISCORD_TOKEN="..." DISCORD_APPLICATION_ID="..." MONGO_URI="..." SITE_URL="https://your-app.fly.dev"
fly deploy
```

[`DEPLOYMENT.md`](./DEPLOYMENT.md) (including the Web dashboard section),
[`OPERATIONAL.md`](./OPERATIONAL.md) and
[`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) have more detail.

## Development and tests

```bash
npm run typecheck              # tsc --noEmit
npm run test:unit              # unit tests only (node:test via tsx)
npm test                       # unit tests, build, then a smoke test of every web route
npx tsx scripts/smoke-web.ts   # the smoke test on its own (after a build)
npx tsx scripts/audit-site.ts  # links, ids, heading count, unstyled classes, dead CSS
npm run preview:site           # static copy of the site in dist/site
```

CI runs `npm ci`, the typecheck and `npm test` on Node 22 for every push and
pull request. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) before opening a pull
request: commits need a `Signed-off-by:` line, and user-facing changes need a
changelog entry.

The website lives in `src/web/`: pages are TypeScript template strings rendered
by Express, with no framework and no build step for the front end.

- `pages.ts`: page bodies, including the terms, privacy and security pages.
  `layout.ts`: the shared shell, nav and footer.
- `content.ts`: feature and FAQ copy. Every claim there should trace back to a
  command in `src/commands`.
- `catalog.ts`: builds the command reference from the registered command
  definitions, so `/commands` cannot drift from the bot.
- `changelog.ts`: parses `CHANGELOG.md` and `DASHBOARD_CHANGELOG.md` for
  `/changelog`, `/dashboard/changelog` and `/changelog.xml`.
- `notFound.ts` (404 suggestions), `wellKnown.ts` (`security.txt`).
- `theme.ts` (stylesheet), `client.ts` (small progressive-enhancement script),
  `assets.ts` (favicon, social image, manifest).
- `dashboard/`: the web dashboard (OAuth, sessions, views, validation).

## Project documents

- [`CHANGELOG.md`](./CHANGELOG.md): bot releases (also at
  https://aegisdeno.fly.dev/changelog and as an Atom feed at `/changelog.xml`).
- [`DASHBOARD_CHANGELOG.md`](./DASHBOARD_CHANGELOG.md): dashboard releases
  (https://aegisdeno.fly.dev/dashboard/changelog).
- [`CONTRIBUTING.md`](./CONTRIBUTING.md): setup, branches, sign-off, tests and
  changelog rules.
- [`SECURITY.md`](./SECURITY.md): how to report a vulnerability privately.
- [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md): Contributor Covenant 2.1.
- [Terms of Service](https://aegisdeno.fly.dev/terms) and
  [Privacy Policy](https://aegisdeno.fly.dev/privacy).

## Licence

Proprietary, all rights reserved (`"license": "UNLICENSED"` in `package.json`).
You may read the code here, but copying, modifying, redistributing or running it
requires written permission from the author.
