# Dashboard changelog

Changes to the Aegis web dashboard at `/dashboard`, newest first. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Changes to the
bot itself are in `CHANGELOG.md`.

The dashboard has its own version numbers, separate from the bot's. The first
release is 1.2.0. The running version is shown at the bottom of every dashboard
page.

## [1.3.0] - 2026-11-05

Dashboard 1.3.0. Every new economy setting, shop item limits and a wallet,
bank and total leaderboard, plus privacy fixes for polls and settings import.
Released alongside bot version 3.8.0. No new environment variables or OAuth
scopes.

### Added
- The Economy page has every new setting with the same limits as the bot:
  weekly rewards, bank limit, pay rules, sell-back rate, crime and gambling.
- Shop items can have a per-member limit and give a role for a set number of
  hours or on `/use`.
- The Starboard settings page has a Flagged media section: keep media Discord
  flagged out of reposts, and show a note or a spoilered link instead. Saved
  changes go to the activity log.

### Changed
- The economy leaderboard shows wallet, bank and total, and member cards show
  the bank.
- Economy settings changes are listed in the activity log as old and new
  values.
- The allowed invites list keeps codes that differ only by case as separate
  entries.
- Settings export includes the flagged media setting, and import checks it.
  An export made before this version leaves the setting unchanged.

### Fixed
- The Polls page only shows polls from channels both Aegis and you can see,
  and its open and closed counts follow the same rule.
- Settings import drops per-rule automod exemptions for channels and roles
  that don't exist in this server, like the server-wide lists, and warns about
  them.

## [1.2.5] - 2026-11-04

Dashboard 1.2.5. A Polls page, giveaway cancelling, starboard top posts,
suggestion search and the full automod rule set. Released alongside bot
version 3.7.3. No new environment variables or OAuth scopes.

### Added
- New Polls page: the 25 newest polls with each option's votes and
  percentage, open or closed, and a link to the message.
- Cancel a running giveaway from the dashboard: tick to confirm, and Aegis
  ends it with no winners and updates its message, just like
  `/giveaway cancel`.
- The Starboard page has a read-only Top posts list: the ten most-starred
  posts of all time with star counts, authors, excerpts and links to the
  original and the starboard post.
- The Automod page covers every rule the bot has: an invite filter with an
  allowed-invites list, a duplicate-message filter, and an emoji filter with a
  zalgo-text switch, each with its own switch and action.
- The link filter has an allowed-domains list on the page, the same list as
  `/automod links allow`, and the automod timeout length (1 minute to 7 days)
  can be set there too.

### Changed
- Giveaways show each giveaway's bonus role and extra entries, and mark
  cancelled giveaways clearly.
- Suggestions can be searched by text and sorted by newest, oldest, most
  upvoted or most downvoted, alongside the status tabs.
- Per-rule automod exemptions cover invites, duplicate messages, and emoji and
  zalgo.
- The Cases type filter includes `softban` and `temprole`.
- Out-of-range automod limits, unreadable domains or invite codes, and unknown
  actions are explained next to the field, and nothing is saved until they are
  fixed. The activity log lists allowed domains and invites that were added or
  removed.

### Fixed
- The Overview's Automod card and setup checklist only counted five rules, so
  a server using just the invite, duplicate-message or emoji filter was shown
  as having automod off. They now count all eight rules.

## [1.2.4] - 2026-11-02

Dashboard 1.2.4. A new Economy page, a balance card on member pages and small
fixes. Released alongside bot version 3.7.1. No new environment variables or
OAuth scopes.

### Added
- **Economy page** (Community → Economy), for people with Manage Server:
  - A switch to turn the economy on or off (off by default; turning it off
    keeps balances and the shop).
  - Settings: currency name and emoji, daily amount, streak bonus and
    cooldown, work range and cooldown, and the amount at which `/pay` asks for
    confirmation. Invalid values are explained next to the field and nothing
    is saved until they are fixed.
  - Shop editor: add, edit and remove items with price, description, stock
    and an optional role. The role picker only lists roles below Aegis's
    highest role and below yours.
  - Leaderboard, 25 members per page, linking to each member's page.
  - Recent transactions: claims, payments, purchases and staff changes, with
    who did it and why.
  - Adjust a member's balance (give, take or reset to 0). Every change is
    recorded in the transactions, the Activity page and the mod log.
- **Economy card on member pages** with the member's balance and daily streak
  while the economy is on (or while they still hold coins).
- **Per-rule automod exemptions** can be edited on the Automod page: each
  rule has its own roles and channels (up to 25 each), saved on its own
  without touching the rest of the automod settings, the same lists as
  `/automod exempt` with `rule:`. Roles at or above your highest role can stay
  exempt but only someone above them can add or remove them. Every save is in
  the Activity log.
- **Trust Score lists every member.** A new All members table pages through
  Discord's member list (25, 50 or 100 at a time, with an Everyone / Below
  the threshold filter), so large servers are no longer limited to the 1,000
  members Aegis had cached. The distribution now scores up to 10,000 members.
- **Cases: date range and CSV download.** Filter the Cases page by From and To
  (UTC days) and download the filtered list as CSV (up to 5,000 records).
  Values a spreadsheet would run as formulas are written as plain text, and
  each download is in the Activity log.

### Changed
- Save buttons read "Saving…" while the form is on its way, on top of the
  existing double-submit guard, and go back to normal if you return with the
  Back button.
- Activity entries for economy changes read as sentences ("Changed economy
  settings", "Gave a member coins").
- Relative times ("3 hours ago", exact UTC time on hover) and copy buttons on
  more of the community and automation pages: autoresponders (when and who
  added each one), giveaways (host, winners and channel), Ghost Watch (when a
  member was added), suggestions (who reviewed them), scheduled messages
  (channel) and role panels (panel and channel IDs, when they were created).
- The low-trust role setting on the Trust page explains that the role is now
  given and taken away as scores change.
- The Logging page has a Voice activity toggle (off until you turn it on).
- Settings import brings over the invite, duplicate and emoji automod rules
  and the automod timeout length.
- The automod rule preview checks invites, allowed link domains and emoji.

### Fixed
- The "Aegis is missing permissions" notice checked a fixed list that
  included View Audit Log (unused) and left out the ModMail thread
  permissions, so a fresh invite always looked incomplete. It now checks
  exactly what the invite asks for (top.gg review).
- Saving the Automod page now keeps per-rule exemptions set with
  `/automod exempt … rule:`, and the page says how to set them.

### Security
- Every Economy form needs a valid CSRF token and Manage Server, and balance
  adjustments have their own rate limit (10 a minute) on top of the usual
  form limit. A shop role at or above Aegis's or your highest role, or
  @everyone, is refused even if it is sent by hand.

## [1.2.3] - 2026-11-02

Dashboard 1.2.3. A redesigned, module-based dashboard with a sidebar, new
pages for features that used to be slash-command only (including ModMail,
Incident Mode, Trust Score and the staff digest), member pages with quick
actions, analytics, a role-hierarchy fix, security hardening and many
usability improvements. Released alongside bot versions 3.6.2 and 3.7.0. No
new environment variables or OAuth scopes.

### Added
- **New layout.** Every server page has a sidebar: a server switcher at the
  top, then the modules grouped as General, Moderation, Community, Automation
  and Records. A top bar shows the server name and an account menu (your
  servers, what's new, log out). On a phone the sidebar becomes a drawer
  behind a Menu button. Everything works with the keyboard.
- **Overview:** stat cards (members, cases and warnings for 7 and 30 days,
  open tickets, pending appeals, active giveaways, automod hits), a 30-day
  cases chart, a card for every module with its on/off state, an Incident
  Mode card, and a setup checklist (missing permissions, configured channels
  Aegis can no longer see, logging or automod left off, and channels hidden
  from Aegis ahead of Discord's 2026-11-16 View Channel change).
- **New module pages.**
  - Autoresponders: add, switch on or off, delete, or switch all off at once
    (they are kept). Up to 50 per server.
  - Scheduled messages: post to a channel in 1 minute to 28 days, once or
    repeating (every 10 minutes to 28 days), optionally with an embed, and
    cancel pending ones.
  - Announcements: build an embed with a live Discord-style preview and post
    it. Announcements never ping anyone.
  - Giveaways: see running and finished giveaways, end one early or reroll a
    finished one.
  - Suggestions: pick the channel, filter by status, and approve, consider or
    deny with a staff note; the author is told by DM.
  - Ghost Watch: your own watch list, with Stop watching.
  - ModMail: settings (staff channel and role, staff-role ping, anonymous
    replies by default, reply prefix, greeting and close messages), open
    conversations, searchable transcripts with a viewer, and blocked members
    with Unblock and block-by-ID.
  - Staff digest: day, hour, time zone and channel, with a live preview of
    the last 7 days.
  - Incident Mode: start or end it, set its defaults and the auto-trigger,
    and read every past incident with its timeline.
  - Trust Score: a distribution chart of member scores (with a text table),
    the lowest-trust members, and the Trust Score settings.
  - Settings: every module with its state, plus Aegis's server-wide
    permissions.
- **Test a message** on the Automod settings page: paste text and see
  whether automod would catch it, which rule, and what it would do, using
  the saved rules. Nothing is posted or stored.
- **Members.** A member page with cases, warnings, notes and the Trust Score
  breakdown in one place, and quick actions (warn, time out, remove timeout,
  kick, ban). Each action needs the same Discord permission as the slash
  command, follows the role-hierarchy rule and is written to the Activity
  log. `/userinfo` links here.
- **Analytics:** joins and leaves, cases, warnings and automod hits per day,
  plus cases by type and by moderator and automod hits by rule.
- **Goodbye messages** next to Welcome, and **embeds** for both, built with
  the same builder and preview. A variables list (`{user}`, `{username}`,
  `{server}`, `{memberCount}` and its aliases) sits next to every text box.
- **Logging per event type:** each log category can go to its own channel;
  the rest use the main log channel.
- **Module switches and backup:** turn whole modules on or off, and export a
  server's settings as JSON and import them back (validated before anything
  is saved).
- **Finding things fast.** Ctrl/Cmd+K jumps to any page or server; a search
  page finds pages, members (by name or ID, including people who left) and
  cases; `?` opens a keyboard shortcuts list; `/` focuses the table filter;
  Ctrl/Cmd+S saves the form you changed. The server picker lists the server
  you opened last first.
- **Times and IDs.** Times show as "3 days ago" or "in 2 hours" with the
  exact time on hover and update while the page is open, and IDs have copy
  buttons, across cases, members, appeals, tickets, analytics, Incident
  Mode, Trust Score, giveaways, suggestions, Ghost Watch, scheduled messages
  and the Activity log.
- **Working with forms and tables.** An unsaved-changes bar with Reset and
  Save (and a warning before you leave with unsaved changes), notices as
  toasts, in-page confirmation for destructive buttons, filter boxes on
  tables, character counters, Enabled / Disabled badges on module pages, and
  10, 25, 50 or 100 cases per page.
- **Real avatars and server icons** from Discord, with no image when there
  is none.

### Changed
- Role pickers grey out roles you can't hand out and say why ("Aegis cannot
  assign" or "above your highest role"), and say which limit emptied the
  list when nothing can be picked.
- An empty channel list says whether the channels are hidden from Aegis or
  the server has no text channels.
- A form can't be sent twice, and a "Saved" notice shows once instead of
  repeating on reload.
- Disabled buttons and fields look disabled, and empty states explain what
  will appear there.
- When you are rate limited while sending a form, the page says nothing was
  saved.
- A server Aegis is not in links straight to adding Aegis.

### Fixed
- **Roles above your own could be handed out.** The verified role, the join
  role and role panel re-posts only checked Aegis's role position. They now
  also require the role to be below your highest role, checked on every
  request. The server owner may pick any role Aegis can assign; a role
  already saved can be kept while you change other settings.
- A role panel that hands out a role above yours can't be re-posted by you;
  its Re-post button says why.
- A saved role that had become greyed out was dropped silently the next time
  the form was saved; it now stays selected.
- Re-posting a role panel without picking a channel said Aegis couldn't see
  the channel; it now asks you to pick one.
- A database outage showed "Something went wrong" and could sign you out. It
  now shows "Database unavailable" and keeps you signed in.
- A form sent after your session ended now says nothing was saved and offers
  a Log in button.
- ModMail settings refuse @everyone as the staff role.

### Security
- Every new page and action has the same protections as the rest of the
  dashboard: sign-in, a CSRF token and same-origin check on every form, a
  live check that you may manage the server, the matching Discord permission
  for actions that need more than Manage Server, role-hierarchy checks, rate
  limits, size limits and an Activity log entry. Channels hidden from Aegis
  are never offered or accepted, and every length is checked against
  Discord's limits on the server.
- Session cookies are `__Host-aegis_dash` and `__Host-aegis_oauth` on the
  live site, so only this exact host over HTTPS can set them. They are still
  HttpOnly and SameSite=Lax. If you were signed in with the old cookie, you
  are moved to the new one and stay signed in.
- Every login starts a new session and deletes the old one.
- Requests with database-operator-like keys (`$where`, `user[$ne]`, dotted
  names) are refused before anything is read or saved, and failed form checks
  are written to the server log.
- Stricter page headers: no inline script or style, no `<base>` changes, no
  frames or workers, cross-origin isolation, and images only from this site,
  inline data images and `https://cdn.discordapp.com`. Avatar hashes are validated before a URL
  is built.

## [1.2.2] - 2026-10-30

Dashboard 1.2.2. Wording and one hidden-channel fix; no new environment
variables, Discord intents or OAuth scopes.

### Changed
- The login page says exactly how permissions are checked: every page checks
  for Manage Server or Administrator, using a server list re-read from Discord
  at least every 10 minutes. It also says that changes are recorded on the
  Activity page for 180 days, and links the privacy policy and terms.
- Dashboard pages share the site's updated footer, which now links Security,
  Report a problem and this changelog.

### Fixed
- **"Add Aegis" could hang on "Opening Discord app".** The buttons under
  "Servers without Aegis" now open Discord's https authorize page with the
  server already chosen (`guild_id` and `disable_guild_select=true`) and
  `integration_type=0`, so Discord adds the bot to that server instead of
  starting its app hand-off. Each server also has a Copy link button, with a
  note on continuing in the browser if Discord's app prompt stalls and on
  refreshing the list once Aegis has joined.
- A real channel named `___hidden___` was left out of the channel pickers and
  reported as hidden. Only channels Discord marks as hidden (its
  `CHANNEL_OBFUSCATED` flag) are treated that way now.

## [1.2.1] - 2026-10-30

Dashboard 1.2.1. Fixes from the review of 1.2.0, and handling for Discord's
channel obfuscation. No new environment variables or Discord intents are
needed.

### Changed
- **Hidden channels:** channels Discord hides from Aegis (it lacks View
  Channel, so Discord sends them as `___hidden___`) are no longer offered in
  any channel picker. A saved log, welcome, transcript, starboard, verification
  or role panel channel that became hidden gets a warning on its page: "Aegis
  can't see the saved … channel. Give Aegis the View Channel permission there,
  or pick a new one." Picking a hidden channel is refused with the same advice.
  Hidden channels already in an exempt or ignored list stay ticked, labelled as
  hidden, so saving the form does not drop them.

### Fixed
- **Starboard emoji:** the emoji field accepted an emoji followed by other
  text, such as `⭐1`. The whole value must now be one emoji (keycaps, flags,
  skin tones and joined emoji such as 👨‍👩‍👧‍👦 included) or a custom emoji
  written as `<:name:id>`.
- **Blocked words:** a list at the advertised maximum (500 words of 100
  characters) could not be saved: the text box stopped at 30,000 characters
  and the form was refused as too large. The box now takes the full list, and
  the automod settings form accepts up to 512 KB, enough for a full list in any
  script. Every other dashboard form keeps the 32 KB limit.

## [1.2.0] - 2026-10-29

Dashboard 1.2.0, the first release. It is off on any copy of Aegis until
`DISCORD_CLIENT_SECRET` and `DASHBOARD_SESSION_SECRET` (at least 32 characters)
are set; until then every `/dashboard` page says "not configured". Setup steps
are in `DEPLOYMENT.md` under Web dashboard. No new environment variables or
Discord intents are needed.

### Added
- **Login:** "Log in with Discord" through OAuth2, asking only for the
  `identify` and `guilds` scopes. A login is refused if Discord does not grant
  both. The login must finish within 10 minutes.
- **Sessions:** a login lasts 7 days, then you log in again. Sessions are stored
  in MongoDB (`dashboardsessions`) and removed by a TTL index when they expire.
  Log out ends the session at once.
- **Server picker:** lists the servers where you are the owner or have Manage
  Server or Administrator and Aegis is a member. Servers you manage without
  Aegis get an "Add Aegis" invite link with that server preselected. The list
  is re-read from Discord when it is more than 10 minutes old, or when you
  press "Refresh the list".
- **Permission re-check:** every server page and every save asks the bot,
  live, whether you are still the owner or hold Manage Server or Administrator.
  Losing the role locks you out on the next request, not at the next login.
- **Overview:** cases and warnings in the last 7 and 30 days, the 10 most recent
  cases and warnings, open tickets (count and the 10 newest, with who claimed
  them) and the number of pending ban appeals.
- **Cases:** cases and warnings in one list, newest first, 25 per page. Filter
  by type (warn, kick, ban, timeout, untimeout, unban, clearwarnings, purge,
  lock, unlock), by member ID, by moderator ID, or by text in the reason; a
  pasted mention works as an ID.
- **Case page:** shows the reason, details, proof attachment and revoked state.
  Edit the reason (up to 512 characters) through the same `editCaseReason()`
  function `/case edit` uses, or revoke the case or warning. Both are posted to
  the server's log channel with your mention when logging is on.
- **Settings**, one page per section. Channels and roles are checked against
  what the bot can see, and roles must be ones the bot can assign. Each save is
  posted to the log channel.
  - Logging: on or off, the log channel, and the seven event categories
    (moderation actions, joins, leaves, message edits, message deletes, role
    changes, channel events).
  - Escalation: on or off, up to 8 steps (a warning count from 1 to 100 that
    triggers a timeout of up to 28 days, a kick or a ban), and how many days a
    warning counts (0 to 365, 0 = never expires).
  - Automod: on or off and the action (delete, warn or timeout) for blocked
    words, links, mass mentions (with a threshold), spam (messages per time
    window) and caps (with a threshold), plus the blocked word list and the
    exempt roles and channels.
  - Welcome: on or off, channel, message (up to 1,000 characters, with a
    preview) and a role given on join.
  - Tickets: log channel, auto-close after a number of idle hours (0 = off, up
    to 30 days) and transcript logging.
  - Verification: on or off, the verified role, button or CAPTCHA mode, and
    kicking members still unverified after a number of minutes (0 = off, up to
    7 days).
  - Starboard: on or off, channel, emoji, star threshold, whether self-stars
    count, and ignored channels and roles.
- **Phone layout:** every page fits screens 360 to 414px wide without
  scrolling sideways, and the page edges and header keep clear of notches and
  rounded corners.
- **Phone layout:** case lists on the overview and Cases pages turn into one
  card per case, each line labelled (when, action, member, moderator, reason),
  instead of a table you scroll sideways. Every column is shown, the moderator
  included. On touch screens the action link that opens a case is 44px tall.
- **Phone layout:** overview numbers sit two to a row. Filter, Save, Revoke
  and pager buttons are full width or share the row, and the Revoke and Refresh
  forms have space below them.
- **Phone layout:** text fields, number fields, lists and the reason box use
  16px text on small and touch screens, so iOS Safari does not zoom in when you
  tap them.
- **Phone layout:** settings boxes have less padding and can no longer be
  pushed wider than the screen, and long IDs on the case page wrap.
- **Automod word list and exemptions:** edit the blocked word list (one word or
  phrase per line, 2 to 100 characters each, up to 500) and tick the roles and
  channels that skip automod. Same rules and storage as `/automod words` and
  `/automod exempt`.
- **Starboard emoji and ignore lists:** set the emoji (one Unicode emoji or a
  custom `<:name:id>` emoji) and tick the channels and roles the starboard
  ignores, as `/starboard emoji` and `/starboard ignore` do.
- **Appeals page:** ban appeals by status (pending, approved, denied, expired
  or all), 25 per page, with the member, who banned them and their statement.
  Each appeal has its own page with the ban reason and full statement.
- **Appeal review:** approve or deny a pending appeal with an optional note (up
  to 512 characters). It runs the same code as `/appeal review`: approving
  unbans the member, and either decision is sent to them by DM. The decision is
  posted to the log channel. Needs Ban Members, like the slash command.
- **Panels page:** post the ticket panel (channel, staff role, title and
  description, as `/ticket setup`), post the verification panel (channel, role,
  button or CAPTCHA, auto-kick, title and description, as `/verify setup`), and
  re-post any saved role panel to the same or another channel. Earlier Aegis
  panels of the same kind in the channel are removed first, as the slash
  commands do. Ticket panels need Manage Channels; verification and role panels
  need Manage Roles.
- **Set up verification from the dashboard:** when `/verify setup` has never
  been run, the Verification settings page explains what is missing and links
  to the Panels page, where posting the panel turns verification on.
- **Revoke and unban:** revoking a ban case can also lift the ban in Discord.
  It goes through the same code as `/unban`, which records an unban case and
  posts it to the log channel. Needs Ban Members.
- **Activity page:** every change made through the dashboard for a server: who,
  when, what (settings section, case, appeal or panel) and which fields changed
  from what to what. Entries are kept for 180 days.
- **Case page links:** "Their history" next to the member opens the Cases list
  filtered to them.
- **Version label:** the dashboard version is shown at the bottom of each page.

### Changed
- The server menu now has Overview, Cases, Appeals, Panels, Settings and
  Activity.
- The overview's pending appeals count links to the Appeals page instead of
  pointing at `/appeal`.
- Automod and Starboard settings pages save every field of their section; the
  "edited with `/automod`" and "set with `/starboard`" notes are gone.
- Channel and role lists for exemptions and ignore lists are checkbox lists
  read from the bot's server cache. Saved IDs Aegis cannot see (for example a
  voice channel exempted with `/automod`) stay listed as "Unknown" and stay
  saved unless you untick them.
- Revoking a case looks it up first, so a mistyped case ID gets a 404 page.
- Approving or denying an appeal, and revoking, ask for confirmation first when
  JavaScript is on.
- `/appeal review` and the dashboard share one `reviewBanAppeal()` function;
  `/unban` and the dashboard share `unbanMember()`; `/ticket setup` and the
  dashboard share `postTicketPanel()`.

### Fixed
- `/dashboard/changelog` showed nested list items (such as the settings
  sections) run together into one line with a literal " - " between them. They
  are now a nested list.
- An appeal can no longer be decided twice when two moderators review it at
  the same moment; the second one is told it was already reviewed.

### Security
- **CSRF:** every form carries a token tied to your session (an HMAC of the
  session ID), checked on every POST. POSTs whose `Origin` header is not the
  dashboard's own origin are refused.
- **OAuth state:** the state sent to Discord is checked against a signed,
  short-lived cookie on the callback.
- **Rate limits** per client: 20 login requests, 30 form posts and 240 page
  loads a minute. Over the limit you get a 429 page with `Retry-After`. The
  counters are kept in MongoDB, so they hold across restarts and machines.
- **Cookies** are `HttpOnly`, `SameSite=Lax`, scoped to `/dashboard`, signed
  with `DASHBOARD_SESSION_SECRET`, and `Secure` whenever the redirect URI is
  https. Rotating the secret signs everyone out.
- **Hashed session IDs:** session IDs are 32 random bytes; the database keeps
  only their SHA-256 hash, so reading the database alone is not enough to reuse
  a cookie.
- **Logout** deletes the session and asks Discord to revoke the access token.
  The session also stores that token so the server list can be refreshed.
- **No caching or indexing:** dashboard pages are sent with
  `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow` and a `noindex`
  meta tag, and `robots.txt` disallows `/dashboard`.
- Forms are size-limited (32 KB, 200 fields). Text you enter is escaped in the
  pages, and `@everyone` and `@here` are defused in log messages.
- **Extra permission checks:** actions whose slash command needs more than
  Manage Server check that permission live too: Ban Members for appeal reviews
  and unbans, Manage Channels for the ticket panel and Manage Roles for the
  verification and role panels. Owners and Administrators always pass. Pages
  say which permission is missing before you try.
- Rate-limit records store a SHA-256 hash of the client address, not the
  address, and are removed by a TTL index a minute after their window ends.
- Every new form carries the CSRF token and goes through the same origin check,
  form size limits and escaping as the existing ones.

### Known limitations
- Role panels can only be re-posted from the dashboard. Creating a role panel,
  or changing its roles, is still `/rolepanel create`.
- The automod exemption and starboard ignore lists offer text and announcement
  channels only. Other channel types can still be added with `/automod exempt`
  and `/starboard ignore`, and the dashboard keeps them.
- Revoking a timeout case does not lift the timeout in Discord; use
  `/removetimeout` for that.
- The Activity page lists dashboard changes only. Changes made with slash
  commands appear in the server's log channel, not there.
- Rate limits key on the `Fly-Client-IP` header, falling back to the socket
  address. That header is only trustworthy behind Fly.io's proxy; on another
  host a client could set it. If MongoDB cannot be reached, the counters fall
  back to memory for that process until it is back.
- Revoking the Discord token at logout is best effort: if Discord does not
  answer within 5 seconds, the session is still ended but the token lives until
  it expires.
- Panel posting, appeal review and revoke-and-unban have automated tests with a
  fake bot; they act on Discord only in a live server.
