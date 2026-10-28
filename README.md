# Aegis

Aegis is a moderation bot for Discord, run from slash commands. It handles
warnings, timeouts, bans and the case log behind them, plus automod, ban
appeals, tickets, verification, logging, a staff watchlist and per-member trust
scores.

- Website and command reference: https://aegisdeno.fly.dev
- Changelog: [CHANGELOG.md](./CHANGELOG.md) (also at https://aegisdeno.fly.dev/changelog)
- Current version: 3.5.0

Despite the repository name, Aegis is a **Node.js** app (TypeScript,
discord.js v14, Mongoose/MongoDB, Express). It does not run on Deno.

## What it does

Every command, option and permission is listed on the
[commands page](https://aegisdeno.fly.dev/commands), which is generated from the
command definitions in `src/commands`. In short:

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

**Trust score.** `/trustscore` gives a 0 to 100 number from account age (up to
25), time in the server (up to 25), a long-tenure bonus (up to 20), active
warnings (−5 each, down to −30), timeouts, kicks and bans that were not undone
(−4 each, down to −20), and message activity (up to 15: points at 10, 50, 250
and 1,000 messages, plus a bonus for posting in the last week or month). Only a
message count and a last-active time are stored, never message content. The
score is informational: nothing happens automatically when it is low.

**Ban appeals.** `/ban` DMs the member a code like `AGS-K7X2`. They file an
appeal with `/appeal submit` from any server Aegis shares with them; staff
review it with `/appeal list|view|review`, and approving it unbans them.

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

## Running it yourself

The source is public so it can be read and reviewed, but it is **not open
source** (see [Licence](#licence)). Ask the author before running your own copy.
With permission, you need:

- Node.js 20 or newer (CI and the Docker image use Node 22)
- A MongoDB database (Atlas or local)
- A Discord application with a bot user. Under **Bot** in the Developer Portal,
  turn on the Server Members, Message Content and Presence intents; the bot
  requests all three.

```bash
git clone https://github.com/watispro1/AegisDeno.git
cd AegisDeno
npm ci
cp .env.example .env
```

Fill in `.env`. The required values are `DISCORD_TOKEN`,
`DISCORD_APPLICATION_ID` and `MONGO_URI`. Useful extras:

| Variable | What it does |
| --- | --- |
| `DISCORD_TEST_GUILD_ID` | Register commands to one server only (instant, for testing). Leave empty for global commands. |
| `DISCORD_OWNER_ID` | Your user ID, for the developer commands. |
| `SITE_URL` | Public origin of the website, used for canonical URLs, Open Graph tags and the sitemap. |
| `PORT` | Website port. Defaults to 3000. |
| `BOT_INVITE_URL`, `SUPPORT_SERVER_URL` | Links shown on the website. |
| `TOPGG_TOKEN`, `TOPGG_WEBHOOK_AUTH` | Optional Top.gg integration. The webhook stays off until the auth value is set. |

Then:

```bash
npm run dev                 # run from source with tsx
npm run build && npm start  # compiled
```

Slash commands are registered every time the bot starts. The website is served
by the same process.

### Deploying to Fly.io

`fly.toml` and the `Dockerfile` are set up for Fly.io. Pushes to `main` deploy
automatically from GitHub Actions once the checks pass (this needs a
`FLY_API_TOKEN` repository secret). To deploy by hand:

```bash
fly secrets set DISCORD_TOKEN="..." DISCORD_APPLICATION_ID="..." MONGO_URI="..." SITE_URL="https://your-app.fly.dev"
fly deploy
```

[`DEPLOYMENT.md`](./DEPLOYMENT.md), [`OPERATIONAL.md`](./OPERATIONAL.md) and
[`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) have more detail.

## Development

```bash
npm run typecheck              # tsc --noEmit
npm test                       # unit tests, build, then a smoke test of every web route
npx tsx scripts/audit-site.ts  # links, ids, heading count, unstyled classes, dead CSS
npm run preview:site           # static copy of the site in dist/site
```

CI runs `npm ci`, the typecheck and `npm test` on Node 22 for every push and
pull request.

The website lives in `src/web/`: pages are TypeScript template strings rendered
by Express, with no framework and no build step for the front end.

- `pages.ts`: page bodies. `layout.ts`: the shared shell, nav and footer.
- `content.ts`: feature and FAQ copy. Every claim there should trace back to a
  command in `src/commands`.
- `catalog.ts`: builds the command reference from the registered command
  definitions, so `/commands` cannot drift from the bot.
- `changelog.ts`: parses `CHANGELOG.md` for `/changelog` and `/changelog.xml`.
- `theme.ts` (stylesheet), `client.ts` (small progressive-enhancement script),
  `assets.ts` (favicon, social image, manifest).

## Licence

Proprietary, all rights reserved (`"license": "UNLICENSED"` in `package.json`).
You may read the code here, but copying, modifying, redistributing or running it
requires written permission from the author.
