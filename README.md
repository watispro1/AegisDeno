# Aegis

Aegis is a moderation bot for Discord, run from slash commands. It handles
warnings, timeouts, bans and the case log behind them, plus automod, Incident
Mode for raids, ban appeals, ModMail, tickets, verification, logging, a staff
watchlist and an explainable per-member Trust Score. Server managers can also
review cases and change settings in a web dashboard.

| | |
| --- | --- |
| Website | https://aegisdeno.fly.dev |
| Add to Discord | the **Add to Discord** button on the website |
| Command reference | https://aegisdeno.fly.dev/commands |
| Web dashboard | https://aegisdeno.fly.dev/dashboard |
| Docs and FAQ | https://aegisdeno.fly.dev/docs |
| Status | https://aegisdeno.fly.dev/status |
| Why Aegis | https://aegisdeno.fly.dev/why |
| Roadmap | https://aegisdeno.fly.dev/roadmap |
| Support server | https://discord.gg/HwTbCYC4PM |
| Security | https://aegisdeno.fly.dev/security (report privately, see [`SECURITY.md`](./SECURITY.md)) |
| Current version | bot 3.13.0, dashboard 1.8.0 |

> **Self-hosting and the source.** The source code is public so it can be read
> and reviewed. It is not open source: copying, modifying, redistributing or
> running your own copy, public or private, needs written permission from the
> maintainer (see [Licence](#licence), the [`LICENSE`](./LICENSE) file and
> section "Source code and licence" of the
> [Terms](https://aegisdeno.fly.dev/terms#source)). Using the bot in your server
> does not give you any rights to the code, name or branding.

Despite the repository name, Aegis is a **Node.js** app (TypeScript,
discord.js v14, Mongoose/MongoDB, Express). It does not run on Deno.

## Contents

- [What it does](#what-it-does)
- [Permissions](#permissions)
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
reverses the action and marks the case revoked. `/ban duration:7d` makes a
temporary ban that Aegis lifts on its own, and `/timeout custom_duration:` takes
any length up to 28 days (`90m`, `1d 12h`, `2 weeks`). Also `/purge` (filters for
bots, humans, links, images, embeds, a user or a keyword, with a preview),
`/lock` (a channel, a category or the whole server, optionally timed),
`/slowmode` (optionally timed with `for:`, then restored), `/softban`,
`/temprole`, `/nickname`, `/note`, `/case`, `/infractions` and `/modhistory`.
`/case user` filters a member's cases by action or hides revoked ones.
`/massban` bans up to 50 pasted user IDs at once for raid clean-up, with the
same hierarchy checks as `/ban`, a confirmation and one case per ban (no DMs
or appeal codes). The Member Joined log flags new accounts, missing avatars and
members returning with earlier cases, as hints for staff.
`/escalation` turns a number of warnings into a timeout, kick or ban, and can
ignore warnings older than a set number of days.

**Automod.** Blocked words, links, mass mentions, message rate and caps, each
with its own action (delete, delete and warn, delete and timeout), plus role and
channel exemptions. Members with Administrator or Manage Server are never
automodded. After automod warns or times out a member, their further hits in
the next 60 seconds are deleted without another penalty or log entry, so one
burst counts once.

**Incident Mode.** `/incident start` handles a raid in one step: slowmode,
lockdown, a join gate that times out or kicks brand-new accounts, and paused
invites. Every change is recorded and restored exactly when it ends, by hand
(`/incident end`) or on its timer, even across restarts, and a report goes to
the mod log. `/incident auto` can start it when many accounts join at once.

**Trust Score.** `/trust user` gives a member a 0 to 100 score with every
factor explained: account age, time in the server, verification, active days,
warnings and cases by severity and recency, automod hits and Incident Mode
join-gate flags. The embed shows a ten-square bar coloured by band (Trusted
80+, Established 60+, Neutral 40+, Low trust 20+, High risk below). Only counts
and timestamps are inputs, never message content. `/trust config` picks a
preset (strict, balanced, lenient) and a low-trust threshold, and can
optionally give low-trust members a role on join, limit link filtering to them,
or have Incident Mode gate them. `/trustscore` is a deprecated alias of
`/trust user`.

**Ban appeals.** `/ban` DMs the member a code like `AGS-K7X2`. They file an
appeal with `/appeal submit` from any server Aegis shares with them; staff
review it with `/appeal list|view|review` or in the dashboard, and approving it
unbans them.

**Watchlist.** `/watchlist add` quietly watches a member and DMs the moderator
when they post, edit or delete a message, join or leave, have their roles
changed or join voice, depending on the events picked. Alerts can also go to a
staff channel. The member is not told. An alert only reaches a watcher who
still has Moderate Members and can view the channel it came from, and copies
posted to a staff channel leave out text from private channels.

**ModMail.** Members DM Aegis to reach a server's staff; each conversation
becomes a private thread (or forum post) where staff reply, anonymously if
they like (`/modmail setup|reply|close|block|unblock|snippet`). Closed
transcripts are kept for 90 days and can be read in the dashboard.

**Mod reports.** `/modreport` shows the last 24 hours or 7 days in four views:
overview, top offenders, moderator activity and automod hits. `/modstats` and
`/activitysummary` give simpler counts, and `/digest setup` posts a weekly staff
digest.

**Economy (opt-in).** Off until a server manager runs `/economy toggle`.
Members earn coins with `/daily` (streak bonus), `/weekly`, `/work` (10 work
levels, each adding pay), `/crime` and daily bank `/interest` (capped), keep
them in a wallet or a bank (`/deposit`, `/withdraw`), send them with `/pay`
(tenure, daily limit, optional tax) and spend them in a `/shop` that sells
collectibles, roles (never ones with staff permissions) and consumable effects
used with `/use`: rob shields and timed work boosts. Optional extras, each off
until staff turn them on with `/economy risk`: `/gamble` (coinflip, dice,
slots, with fixed house edges, bet limits and a daily loss cap) and `/rob`
(wallet only, cooldowns, minimum wallets, protection after a robbery, fines
removed from circulation). `/balance` shows levels and badges, `/transactions`
shows your own history privately, and `/leaderboard` never pings. Staff tune it
with `/economy config` and `/economy risk`, see `/economy stats`, adjust
balances with `/economy give|take|reset` (posted to the mod log) and manage
everything on the dashboard's Economy page. Cooldowns are stored in MongoDB and
every balance change is a single atomic update with its checks in the query,
so coins can't be spent twice, claimed twice or pushed past the limits. Money
is always whole coins. New slash commands need `npm run deploy` once.

**Everything else.** Logging to a channel (`/logging`), tickets with claim,
inactivity auto-close and HTML transcripts (`/ticket`), button or math-captcha
verification with optional auto-kick (`/verify`), role panels as buttons or a
dropdown (`/rolepanel`), auto-responders, a starboard, giveaways with booster
bonus entries, button polls that close on a timer, suggestions with
Approve/Deny/Consider, welcome messages, personal reminders that can repeat
(`/remindme`, or **Remind Me About This** on any message) and scheduled channel
posts (`/automation`). Timed actions are
stored in MongoDB and restored after a restart. Starboard posts, ModMail relays
and ticket transcripts leave out media Discord flags as explicit, gore or
self-harm unless the channel is age-restricted (`/config media-safety`).

**Web dashboard.** At [`/dashboard`](https://aegisdeno.fly.dev/dashboard),
people with Manage Server or Administrator log in with Discord (`identify` and
`guilds` scopes only) to see a server overview with a first-run Get started
checklist and recent activity, browse and filter cases, edit a reason or revoke
a case, review ban appeals, read ModMail transcripts and Incident Mode reports,
post the ticket, verification and role panels, and change logging, escalation,
automod, Trust Score, welcome, ticket, verification, starboard, economy and
community settings. An Activity page shows who changed what. Everything it does
is also available as a slash command.

What the bot and dashboard store, and for how long, is in the
[privacy policy](https://aegisdeno.fly.dev/privacy). The rules for using them
are in the [terms of service](https://aegisdeno.fly.dev/terms).

## Permissions

The invite asks for exactly what the commands use, computed from each
command's declarations: permissions integer **`1460691659798`**. Administrator,
Manage Server and View Audit Log are never requested.

| Permission | Why |
|---|---|
| View Channel, Send Messages, Embed Links, Read Message History | Reading and posting where Aegis works; purge, starboard, transcripts |
| Manage Roles | `/lock` and Incident Mode lockdowns (they change @everyone's override), ticket members, verification, role panels, welcome, low-trust and shop roles |
| Manage Channels | `/slowmode`, Incident Mode slowmode, ticket channels |
| Manage Messages | `/purge`, automod deletes |
| Moderate Members | Timeouts (`/timeout`, automod, escalations, the join gate) |
| Kick Members, Ban Members | `/kick`, `/ban`, `/unban`, appeals, escalations, verification auto-kick |
| Manage Nicknames | `/nickname` |
| Attach Files | Ticket transcripts |
| Create Private Threads, Send Messages in Threads, Manage Threads | ModMail threads |

A lock needs **Manage Roles** (shown as *Manage Permissions* in a channel's
settings), plus View Channel and Send Messages in that channel, not Manage
Channels. Members running `/lock` need Manage Channels. `/diagnostics` lists
anything Aegis is missing. The full table is on the
[docs page](https://aegisdeno.fly.dev/docs#permissions-bot).

## Running it yourself

The source is public so it can be read and reviewed, but it is **not open
source** (see [Licence](#licence)). Running your own copy, public or private,
needs written permission from the maintainer; ask in the
[support server](https://discord.gg/HwTbCYC4PM) or open an issue. With
permission, you need:

- Node.js 22 or newer (`engines` in `package.json`; CI and the Docker image use 22).
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
| `BOT_INVITE_URL` | no | Base invite URL (must be an https discord.com link, otherwise it is ignored); the client ID, computed permissions, scopes and `integration_type=0` are added to it. |
| `SUPPORT_SERVER_URL` | no | Support server link shown on the website, legal pages and the bot's Support buttons. Defaults to https://discord.gg/HwTbCYC4PM. |
| `JOIN_WELCOME` | no | Set to `off` to stop the one-time "Thanks for adding Aegis! Run /help" message Aegis posts when it joins a server. On by default. |
| `CONTACT_EMAIL` | no | Email shown on the terms and privacy pages. Without it they point to the support server and GitHub issues. |
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

- `pages/`: page bodies, one module per page (`home.ts`, `commands.ts`,
  `docs.ts`, `legal.ts` for terms, privacy and security, ...); `pages/index.ts`
  re-exports them. `layout.ts`: the shared shell, nav and footer.
- `content.ts`: feature and FAQ copy. Every claim there should trace back to a
  command in `src/commands`.
- `catalog.ts`: builds the command reference from the registered command
  definitions, so `/commands` cannot drift from the bot.
- `changelog.ts`: parses `CHANGELOG.md` and `DASHBOARD_CHANGELOG.md` for
  `/changelog`, `/dashboard/changelog` and `/changelog.xml`.
- `notFound.ts` (404 suggestions), `wellKnown.ts` (`security.txt`).
- `theme/` (stylesheet, split by area and joined in `theme/index.ts`),
  `client/` (small progressive-enhancement script, one IIFE split into parts),
  `assets.ts` (favicon, social image, manifest).
- `dashboard/`: the web dashboard (OAuth, sessions, validation; `views/` has
  one module per page and `routes/` one module per group of routes).

## Project documents

- [`CHANGELOG.md`](./CHANGELOG.md): bot releases (also at
  https://aegisdeno.fly.dev/changelog and as an Atom feed at `/changelog.xml`).
- [`DASHBOARD_CHANGELOG.md`](./DASHBOARD_CHANGELOG.md): dashboard releases
  (https://aegisdeno.fly.dev/dashboard/changelog).
- [`CONTRIBUTING.md`](./CONTRIBUTING.md): setup, branches, sign-off, tests and
  changelog rules.
- [`SECURITY.md`](./SECURITY.md): how to report a vulnerability privately
  (short version at https://aegisdeno.fly.dev/security).
- [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md): Contributor Covenant 2.1.
- [`DEPLOYMENT.md`](./DEPLOYMENT.md), [`OPERATIONAL.md`](./OPERATIONAL.md) and
  [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md): deploying, running and fixing
  the bot.
- [`server.md`](./server.md): the setup playbook for the official support
  server.
- [`LICENSE`](./LICENSE): the proprietary licence.
- [Terms of Service](https://aegisdeno.fly.dev/terms) and
  [Privacy Policy](https://aegisdeno.fly.dev/privacy).

## Licence

Proprietary, all rights reserved. The full text is in [`LICENSE`](./LICENSE),
and `package.json` says `"license": "UNLICENSED"`, npm's marker for code that
is not offered under any licence. The source is public so it can be read and
reviewed, but copying, modifying, redistributing or running your own copy,
public or private, needs written permission from the maintainer, as section
"Source code and licence" of the [Terms](https://aegisdeno.fly.dev/terms#source)
says. Ask in the [support server](https://discord.gg/HwTbCYC4PM) or open an
issue.

Versions before 3.13.0 were published under the MIT licence; from 3.13.0 the
proprietary licence applies.
