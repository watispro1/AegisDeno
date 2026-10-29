# Changelog

Notable changes to Aegis, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Version numbers follow the `version` field in `package.json` as it was bumped
in the git history. Dates are the date of the last commit in each release.
Earlier drafts of this file also listed 2.1.1, 3.1.1 and 3.3.1; those were never
separate bumps, so their changes are folded into 3.0.0, 3.1.0 and 3.3.2.
3.1.0 was only ever set in `src/version.ts`, not in `package.json`.

## [Unreleased]

### Added
- A web dashboard at `/dashboard`. Log in with Discord (`identify` and `guilds`
  scopes) to pick a server where you have Manage Server or Administrator, see an
  overview (members, cases and warnings over 7 and 30 days, recent cases, open
  tickets, pending appeals), browse and filter cases, edit a case reason or
  revoke a case or warning, and change logging, escalation, automod, welcome,
  ticket, verification and starboard settings. Permissions are re-checked
  through the bot on every request. It stays off until
  `DISCORD_CLIENT_SECRET` and `DASHBOARD_SESSION_SECRET` are set; see
  `DEPLOYMENT.md`.
- A self-hosting section in the docs and the README, with the real setup steps,
  the intents the bot needs, and the licence terms. The site footer links to the
  source on GitHub.
- A PNG social preview image (`/assets/og.png`). Discord and most link previews
  ignore SVG, so shared links had no image before.

### Changed
- `/dashboard` no longer redirects to `/features`. The site footer, home page,
  FAQ and privacy policy now describe the dashboard and the login cookies it
  sets.
- `/case edit` and the dashboard share one `editCaseReason()` service function.
- `/changelog` on the website is rendered from this file, so the site and the
  repository can no longer disagree. The Atom feed at `/changelog.xml` uses the
  same entries. The hand-written release list in `pages.ts` is gone.
- The command reference notes which options suggest values as you type and the
  allowed range for numeric options, read from the command definitions.
- The site no longer loads IBM Plex from Google Fonts. It uses the system font
  stack (Plex is still used if installed), which removes the only third-party
  request and lets the content security policy drop Google's domains.
- Buttons, filter chips, copy buttons and nav links are at least 44px tall; on
  touch screens, sidebar and footer links get the same target size.
- The faint text colour is slightly darker so it passes 4.5:1 contrast on code
  backgrounds too. Footer column titles are headings in the right order.
- The 404 page links to troubleshooting and the changelog as well.
- README rewritten: shorter, no emoji headings, and every feature description
  checked against the code.

### Fixed
- The README said the trust score reacts to "message behaviour" and that you can
  "configure auto-actions when a score drops below a threshold". No score-based
  action exists; the score only counts how many messages a member has sent and
  when they last posted. It also called `/poll` a native Discord poll (polls use
  buttons since 3.1.0) and described `/modreport` as having keyword trends,
  new-member risk events and a 7-day chart, none of which exist.
- The features page said Discord caps timeouts at 7 days. Discord allows 28;
  the `/timeout` choices stop at one week.

## [3.5.0] - 2026-10-28

Pull requests #2 to #7. This release changes how several existing commands
behave; read "Changed" before deploying. Slash command definitions changed, so
commands are re-registered on the next start.

### Added
- **Role panels:** `/rolepanel create` takes `style` (buttons or a dropdown),
  `exclusive` (a member can hold only one role from the panel) and
  `required_role` (only members with that role can use the panel). The roles
  plugin's max-roles-per-panel setting is now enforced.
- **Tickets:** a staff-only Claim button; a ticket can only be claimed once and
  shows who claimed it. `/ticket claim` does the same.
- **Tickets:** tickets with no messages for 48 hours close on their own. Change
  or turn it off with `/ticket settings autoclose_hours:` (0 = off). The check is
  stored as a scheduler task, so it survives restarts.
- **Tickets:** closing a ticket builds a self-contained HTML transcript (up to
  1,000 messages), posts it to the ticket log channel set with
  `/ticket settings log_channel:` and DMs it to the member who opened the ticket.
  `/ticket transcript` returns the same file.
- **Verification:** optional kick for members still unverified after a set
  number of minutes (`/verify autokick minutes:` or `kick_unverified_minutes` on
  setup). Off by default, stored as a scheduler task, cancelled when the member
  verifies.
- **Reminders:** `/remindme set` has a `repeat` option (once, daily, weekly).
  Reminder DMs have Snooze buttons for 10 minutes and 1 hour.
- **Reminders:** `/remindme list` and `/remindme cancel` (with ID autocomplete).
  Up to 25 pending reminders per member.
- **Moderation:** the `reason` option on `/warn`, `/timeout` and `/ban`
  autocompletes presets (Spam, NSFW, Harassment, Advertising, Raiding, Other) and
  still accepts any text. A new optional `proof` attachment is stored with the
  warning or case and shown in `/case view`.
- **Moderation:** `/lock category` locks every channel in a category, and
  `/lock unlock category:` reverses it. `/lock channel` and `/lock category`
  take an optional `message` posted in each locked channel.
- **Moderation:** `/escalation expiry days:` sets how many days a warning counts
  toward escalation thresholds (0 = never expires).
- **Moderation:** `/case user` has Prev/Next buttons (5 per page, up to 100
  cases) and marks revoked cases and cases with proof.
- **Watchlist:** voice joins and first-message-of-the-day are new event types,
  with a "First Message of the Day + Voice Joins" preset. `alert_channel` also
  posts alerts to a staff channel, with mentions turned off.
- **Trust score:** message activity adds up to 15 points: 2, 4, 7 or 10 points
  at 10, 50, 250 and 1,000 messages, plus 5 for posting in the last 7 days (2
  for the last 30). The reply opens with a "Why" list, biggest factor first.
  Only a message count and a last-active time are stored per member, never
  message content.
- **Giveaways:** `/giveaway start` takes `booster_multiplier` (1 to 10): server
  boosters get that many entries. Ended giveaways have a Reroll button for the
  host and anyone with Manage Server.
- **Suggestions:** Approve, Deny and Consider buttons for staff with Manage
  Server. Each opens an optional reason form and DMs the author.
- **Welcome:** `{count}` placeholder (`{member_count}` still works).
- Unit tests (`node:test` via `tsx`) for durations, timer chunking, trust score,
  escalation, role hierarchy, community helpers, purge filters, moderation undo,
  case paging, role panels, ticket transcripts, verification and `/help`
  filtering.
- GitHub Actions CI: `npm ci`, typecheck and tests on Node 22 for every push and
  pull request. Pushes to `main` deploy to Fly.io after the checks pass. The
  Docker image now uses Node 22.

### Changed
- **Breaking:** `/remindme` is now `/remindme set`, alongside the new `list` and
  `cancel` subcommands. It accepts durations up to 365 days (was 24).
- **Breaking:** the 60-second Remove Timeout and Revoke Ban buttons, and the Undo
  Warning button that deleted the warning, are replaced by one Undo button that
  stays on the `/warn`, `/timeout` and `/ban` confirmation for 5 minutes. Only
  staff with the matching permission (Moderate Members, or Ban Members for bans)
  can press it. Undo lifts the timeout or ban, or revokes the warning, and marks
  the case revoked instead of deleting it. Revoked warnings no longer count
  toward totals, escalation or the trust score.
- **Breaking:** polls are now stored in MongoDB, so their buttons keep working
  after a restart, and timed polls close through the scheduler and post a
  results message. Polls posted before this release reply "This poll is no
  longer active" when their buttons are pressed. `/poll` is now server-only and
  is posted as a normal channel message; the poll creator can end their own poll.
- **Behaviour:** `/userinfo` shows the warning count and trust score only to
  members with moderation permissions, in a reply only they can see. The Warn
  History and Mod Cases buttons are moderator-only.
- `/help` lists and searches only the commands the member can use, and its
  `command` option also matches subcommand names.
- `/verify` CAPTCHA mode asks a small math question in a pop-up form. Answers
  are held in memory, expire after 5 minutes and lock after 3 wrong tries.
- `/purge`: `keyword` narrows any filter and `user` combines with every filter.
  It looks back through up to 1,000 messages, deletes up to 500, skips pinned
  messages, and reports how many were skipped for being older than Discord's
  14-day bulk-delete limit.
- `/case edit` also works on warning IDs and logs the old and new reason.
- Trust score: only active warnings, and timeout, kick or ban cases that were not
  undone, count against the score. Before, every case counted.
- Giveaway rerolls (button or `/giveaway reroll`) skip members who already won.
- The slash-command form of `/suggest approve|deny|consider` also DMs the author,
  and two moderators can no longer both finalise the same suggestion.
- Message activity counts are kept in memory and written to MongoDB in one batch
  every 30 seconds instead of on every message.
- `/lock channel duration_minutes:` auto-unlocks and `/remindme` reminders are
  stored through the scheduler and restored on startup. Overdue auto-unlocks,
  poll closes, ticket auto-closes and verification kicks are applied on boot
  however late.
- `/automation list` and `/automation cancel` only show reminder and
  scheduled-message tasks.
- The website was redesigned (#2): a plain, docs-first look with a light theme
  by default and an optional dark theme, one accent colour, no gradients, glow,
  emoji headings, icon tiles or scroll effects. Copy was rewritten to match the
  code, and command examples use real option names.
- The status page shows only values read from the running bot. It no longer
  shows the process ID, Node version or hard-coded "operational" cards.
- Replaced the deprecated `ephemeral: true` reply option with
  `flags: MessageFlags.Ephemeral`.

### Fixed
- A restart or deploy no longer leaves a channel locked or drops a reminder.
- Timers longer than Node's ~24.8-day limit are re-armed in chunks instead of
  firing immediately.
- Starboard: the author's own star no longer counts when self-starring is off;
  the first non-spoiler image is shown, other files are listed as links, and
  embed-only messages keep their text and image. Removing stars updates an
  already-posted entry.
- Welcome templates are filled in a single pass, so a member name containing
  `{server}` is not expanded again.
- Website: the command category filter works again (the markup and script used
  different ids), and the troubleshooting filter no longer relies on an inline
  script the content security policy blocked.

### Removed
- Website: the theme picker, the interactive "lab" demos and the five colour
  themes from 3.4.0.
- The leftover `fix.js` codemod; `server.md` is no longer tracked.

## [3.4.0] - 2026-10-27

### Added
- `/watchlist`: watch a member without telling them. The moderator who adds the
  watch gets a DM when the member posts, edits or deletes a message, joins,
  leaves or has their roles changed. Watches last 1 hour, 6 hours, 24 hours,
  7 days or until removed. Active watches are cached in memory, so messages from
  unwatched members don't hit the database.
- `/trustscore`: a 0 to 100 score from account age (up to 25 points at two
  years), time in the server (up to 25 at one year), a tenure bonus (6, 12 or 20
  points at 180 days, one year and two years), minus 5 per warning (capped at
  30) and minus 4 per case (capped at 20). Replies privately by default.
- `/appeal`: `/ban` DMs the banned member an appeal code (`AGS-` plus four
  characters). They file the appeal with `/appeal submit`; staff use
  `/appeal list`, `/appeal view` and `/appeal review`. Approving an appeal
  unbans the member and DMs them.
- `/modreport`: a 24-hour or 7-day digest with four views switched by buttons:
  overview, top offenders, moderator activity and automod hits.

### Changed
- Licence changed from ISC to proprietary (`UNLICENSED`). The source stays
  readable on GitHub.
- Website: removed the frosted-glass styling and `backdrop-filter` blur in
  favour of solid surfaces, added five colour themes and an interactive demo
  section on the home page. (Both were removed again in 3.5.0.)

### Fixed
- Production hardening: scheduler exports, the Top.gg webhook handler,
  configuration loading and `/case` edge cases.
- Committed SQLite database files were removed from the repository.

## [3.3.3] - 2026-10-23

### Added
- `/warn`, `/timeout` and `/ban` have a `preset` option with common reasons.
  `/warn` has a Timeout (10m) button; `/timeout` has a Case History button; the
  `/ban` confirmation shows account age and join date.
- `/case user` lists a member's recent cases.
- `/purge` takes a `reason` and records a case.

### Changed
- Caps and character-flood detection are now regular automod rules for every
  server (`/automod caps`), no longer tied to the beta program.
- Top navigation trimmed to Features, Commands, Docs and Status.

### Removed
- `/beta`, the Command Lab simulator and the beta database models.
- `CHANNEL_CONTENT.md`, `KNUB_CHANGELOG.md` and `DISCOVERY.md`.

## [3.3.2] - 2026-10-20

Includes the changes earlier drafts listed as 3.3.1.

### Added
- Starboard (`/starboard`): reposts messages that reach a reaction threshold,
  with a custom emoji, ignored channels and roles, a self-star setting and a
  list of recent entries.
- `/beta lab` message checks (caps, character flood, invite links, mass
  mentions) and beta feedback triage. (Removed in 3.3.3.)
- Website: a toggle for the glass styling and one-click copy for command names.

### Changed
- `/dashboard` and `/playground` web pages removed; both paths redirect to
  `/features`.
- Auto-responder variables gained `{tag}`, `{user_id}`, `{server_id}` and
  `{channel_id}`.

### Fixed
- Timeout extension adds to the remaining time instead of resetting it to one
  hour, capped at Discord's 28-day limit.
- `/lock server` skips threads, and `/lock channel` inside a thread points you
  to the parent channel instead of failing.

## [3.3.0] - 2026-10-17

### Added
- Plugin framework: a 30-second in-memory cache for plugin settings,
  `onGuildLoaded` and guild-join hooks, and plugin dependency checks.

### Changed
- Website restyled with frosted-glass panels.

### Fixed
- Leaving members that were not cached no longer crash the member-remove
  handler.
- Welcome messages are delivered when the welcome channel is not in the cache.
- Removed duplicate button handlers that the plugin router already covered.

## [3.2.0] - 2026-10-15

### Added
- Plugin framework (`src/knub`): commands grouped into plugins with shared
  permission, cooldown and guild-only checks, per-server enable/disable stored
  in MongoDB, and `/plugins list|toggle|info`.
- `/api/plugins` endpoint.
- `/about` has a menu with overview, runtime, network and database views.

### Fixed
- `/embed quick` and the embed builder could post twice; `/announce` could send
  twice on a double click.
- Duplicate gateway deliveries of the same interaction are dropped.
- `/purge` failed when exactly one message matched.
- `/remindme` durations over ~24.8 days fired immediately; capped at 24 days.
- The `/warn` undo button now checks role hierarchy.
- `/suggest` could be finalised more than once, piling up staff-note fields.
- Giveaways ended or rerolled in an uncached channel failed silently.

## [3.1.0] - 2026-10-13

### Added
- `/giveaway start|end|reroll|list`, with role requirements and multiple
  winners. Winners are drawn with `crypto.randomInt`.
- `/remindme` and `/infractions`.
- `/beta` program for the Aegis home server. (Removed in 3.3.3.)
- `/troubleshooting` page and a site-wide command search (Ctrl/Cmd+K).

### Changed
- `/poll` rebuilt with vote buttons, live result bars, anonymous and
  multi-select modes.
- `/announce` shows a preview before posting.

### Fixed
- Role-panel clicks are checked against the stored panel and role before any
  role changes, and panels refuse roles the bot can't manage.
- Only the opener, support staff or channel managers can close a ticket.
- Active giveaways are restored on startup.
- Ticket, role-panel, suggestion and auto-responder IDs use UUIDs.
- The Top.gg webhook stays disabled until `TOPGG_WEBHOOK_AUTH` is set.

## [3.0.0] - 2026-10-09

Includes the changes earlier drafts listed as 2.1.1.

### Added
- `/embed`, `/dashboard`, `/lock`, `/note` and `/sync`.
- Buttons on `/userinfo`, `/serverinfo` and `/warn` for details and history.
- `/suggest consider`, and the aliases `/autoresponder create` and
  `/autoresponder delete`.

### Changed
- `/suggest reject` is now `/suggest deny`.
- `/verify user` for verifying a member by hand.

## [2.1.0] - 2026-10-07

### Added
- Tickets (`/ticket`), verification panels with button or captcha mode
  (`/verify`), auto-responders (`/autoresponder`) and button role panels
  (`/rolepanel`).
- `/preset apply|view` with casual, community, gaming and strict presets.
- `/case view|edit|delete|export`.
- `/activitysummary` for 24-hour, 7-day and 30-day digests.
- Top.gg vote webhook.

## [2.0.0] - 2026-10-06

### Added
- `/escalation`: warning thresholds that trigger a timeout, kick or ban.
- `/modstats` and `/diagnostics`.
- Automod spam limit, role and channel exemptions, and checks on edited
  messages.
- `/automation repeat` for recurring messages. Failed tasks retry up to 3 times.
- Welcome role assigned on join.
- `/suggest setup|submit|approve|reject` with vote buttons.
- `DEPLOYMENT.md`, `OPERATIONAL.md` and `TROUBLESHOOTING.md`.

### Changed
- `/poll` uses Discord's native polls.

## [1.2.0] - 2026-10-01

### Added
- `/userinfo`, `/serverinfo` and `/nickname`.
- `src/version.ts` as the single version string for the bot and site.

## [1.0.1] - 2026-09-30

### Added
- A shared command executor that handles permission checks and errors.
- Moderation case records and `/modhistory`.
- The website's command reference is generated from the command definitions.
- Gzip, versioned assets and security headers on the website, plus the
  `smoke-web` and `audit-site` scripts.

### Fixed
- `/ban`, `/kick`, `/timeout`, `/removetimeout` and warning removal check role
  hierarchy.
- Database writes are awaited before replies report success.
- `/purge` and `/announce` validate the channel first.

### Removed
- Runtime `eval` from `/developer`; developer commands require a configured
  owner ID.

## [1.0.0] - 2026-09-29

First version.

### Added
- Moderation: `/warn`, `/warnings`, `/clearwarnings`, `/timeout`,
  `/removetimeout`, `/kick`, `/ban`, `/unban`, `/purge`, `/slowmode`.
- Automod with word, link and mention filters.
- `/automation` reminders and scheduled messages.
- `/announce`, `/poll`, `/suggest`, `/welcome`, `/config`, `/logging`,
  `/about`, `/help`, `/ping` and `/developer`.
- MongoDB storage (the SQLite dependency was dropped the same day).
- Express website and Fly.io config.

[Unreleased]: https://github.com/watispro1/AegisDeno/compare/87e33cb...HEAD
[3.5.0]: https://github.com/watispro1/AegisDeno/compare/6f05a0d...87e33cb
[3.4.0]: https://github.com/watispro1/AegisDeno/compare/4c2a46a...6f05a0d
[3.3.3]: https://github.com/watispro1/AegisDeno/compare/c87cfd5...4c2a46a
[3.3.2]: https://github.com/watispro1/AegisDeno/compare/5d357ba...c87cfd5
[3.3.0]: https://github.com/watispro1/AegisDeno/compare/09f9b81...5d357ba
[3.2.0]: https://github.com/watispro1/AegisDeno/compare/c7e8dc6...09f9b81
[3.1.0]: https://github.com/watispro1/AegisDeno/compare/ae88f40...c7e8dc6
[3.0.0]: https://github.com/watispro1/AegisDeno/compare/b6aa280...ae88f40
[2.1.0]: https://github.com/watispro1/AegisDeno/compare/87d3b15...b6aa280
[2.0.0]: https://github.com/watispro1/AegisDeno/compare/96fac06...87d3b15
[1.2.0]: https://github.com/watispro1/AegisDeno/compare/da6d893...96fac06
[1.0.1]: https://github.com/watispro1/AegisDeno/compare/be095b7...da6d893
[1.0.0]: https://github.com/watispro1/AegisDeno/commits/be095b7
