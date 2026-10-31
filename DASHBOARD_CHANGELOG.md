# Dashboard changelog

Changes to the Aegis web dashboard at `/dashboard`, newest first. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Changes to the
bot itself are in `CHANGELOG.md`.

The dashboard has its own version numbers, separate from the bot's. The first
release is 1.2.0. The running version is shown at the bottom of every dashboard
page.

## [1.2.3] - 2026-10-31

Dashboard 1.2.3. A redesigned, module-based dashboard with a sidebar and
new pages for features that used to be slash-command only, a role-hierarchy
fix, security hardening, clearer error and empty states, and small usability
fixes. No new environment variables, Discord intents or OAuth scopes.

### Added
- **New layout.** Every server page now has a sidebar: a server switcher at
  the top (your other servers with Aegis), then the modules grouped as
  General, Moderation, Community, Automation and Records. A top bar shows the
  server name and an account menu (your servers, what's new, log out). On a
  phone the sidebar becomes a drawer behind a Menu button. Everything works
  with the keyboard, and Escape closes the drawer and menus.
- **Overview** now has stat cards (members, cases and warnings for 7 and 30
  days, open tickets, pending appeals, active giveaways, automod hits), a
  30-day cases-per-day chart, a grid of every module with its on/off state and
  a link to it, and a setup checklist: permissions Aegis's role is missing,
  configured channels Aegis can no longer see, logging or automod left off,
  and how many channels are hidden from Aegis ahead of Discord's 2026-11-16
  View Channel change.
- **Settings** page listing every module with its state, plus Aegis's
  server-wide permissions.
- **Autoresponders:** add, turn on or off, and delete autoresponders, and
  switch all of them off for the server at once (they are kept). Up to 50 per
  server.
- **Scheduled messages:** schedule a post to a channel in 1 minute to 28 days,
  once or repeating (every 10 minutes to 28 days), and cancel pending ones.
- **Announcements:** build an embed (title, description, colour, author,
  footer, image and thumbnail links, up to 10 fields) with a live preview that
  looks like Discord, and post it to a channel. Announcements never ping
  anyone. Needs Manage Messages, as `/announce` does.
- **Giveaways:** see running and finished giveaways, end one early, or reroll
  a finished one.
- **Suggestions:** pick the suggestions channel, filter open, approved, denied
  or all suggestions, and approve, consider or deny with an optional staff
  note. The post is restyled and the author told by DM, as with
  `/suggest review`.
- **Ghost Watch:** your own watch list (nobody else's), with Stop watching.
  Needs Moderate Members, as `/watchlist` does.
- **Goodbye messages:** a new Goodbye tab next to Welcome posts a message when
  someone leaves. It never pings anyone.
- **Embeds for welcome and goodbye:** both can send an embed built with the
  same builder and preview. A variables list (`{user}`, `{username}`,
  `{server}`, `{memberCount}` and its aliases) sits next to every text box.
- **Logging per event type:** each log category (moderation actions, joins,
  leaves, edits, deletes, role and channel changes) can go to its own channel;
  the rest use the main log channel.
- An **unsaved changes** bar ("You have unsaved changes — Reset / Save")
  appears when you edit a settings form, and the browser asks before you
  leave with unsaved changes.
- Notices also show as toasts, destructive buttons ask in an in-page dialog,
  tables have a filter box, long text boxes count characters, and module pages
  show an Enabled / Disabled badge.

### Changed
- Role pickers for the verified role and the join role grey out roles you
  can't hand out and say why: "Aegis cannot assign" or "above your highest
  role". When nothing can be picked, a note says which limit emptied the list.
- When a channel list is empty, a note says whether Aegis can't see the
  channels (they are hidden from it; give it View Channel) or the server has
  no text channels. Hidden channels are still never listed.
- A form can't be sent twice: its buttons are disabled while it is sending,
  and work again if you come back with the Back button.
- A "Saved" or other notice shows once: it is removed from the address bar,
  so reloading or bookmarking the page doesn't repeat it.
- Disabled buttons and fields now look disabled.
- When you are rate limited while sending a form, the page says nothing was
  saved.
- A server Aegis is not in links straight to adding Aegis to that server.

### Fixed
- **Roles above your own could be handed out.** The verified role (Panels and
  Settings), the join role, and role panel re-posts only checked Aegis's role
  position. They now also require the role to be below your highest role,
  checked live on every request and enforced on the server whatever the form
  sends. The server owner may pick any role Aegis can assign; Administrator is
  still bounded by their highest role. If your role can't be read, no role
  can be picked. A role already saved in Settings can be kept while you change
  other settings there.
- A role panel that hands out a role above yours can't be re-posted by you;
  its Re-post button is disabled with the reason.
- A saved role that had become greyed out was dropped silently (or reported
  as missing) the next time the form was saved. It now stays selected and is
  checked like any other choice.
- Re-posting a role panel without picking a channel said Aegis couldn't see
  the channel; it now asks you to pick one.
- A database outage showed "Something went wrong" (500), and a session
  lookup that failed during an outage signed you out. Both now show
  "Database unavailable" (503, with Retry-After) and keep you signed in.
- A form sent after your session ended now says nothing was saved and offers
  a Log in button.

### Security
- Every new page and action uses the same protections as the rest of the
  dashboard: sign-in, a CSRF token and same-origin check on every form, a live
  check that you may manage the server, the matching Discord permission for
  actions that need more than Manage Server, refusal of operator-looking
  input, rate limits, size limits on forms, and an entry in the Activity log.
  Channels hidden from Aegis are never offered or accepted. Embed image links
  must be https, and every length is checked against Discord's limits on the
  server. All new styling and scripts are served from `/assets`; the Content
  Security Policy still allows no inline script or style.
- Session cookies are now `__Host-aegis_dash` and `__Host-aegis_oauth` on the
  live site: the browser only accepts them over HTTPS from this exact host,
  with `Path=/` and no `Domain`, so another subdomain or a plain-http
  response can't set or overwrite them. They are still HttpOnly and
  SameSite=Lax. If you were signed in with the old `aegis_dash` cookie, your
  next visit moves you to the new one and clears the old one; you stay
  signed in. (A local http copy keeps the old names under `/dashboard`.)
- Every login starts a new session and deletes the one the browser had
  before.
- A query string or form with Mongo-operator-like keys (`$where`,
  `user[$ne]`, dotted names) is refused with "Bad request" before anything
  is read or saved.
- Failed form checks (expired or foreign CSRF token, wrong Origin) are
  written to the server log.
- Stricter page headers, shared with the rest of the site: no inline styles
  allowed by the Content Security Policy, no `<base>` changes, no frames or
  workers, and cross-origin isolation of the window and its resources.

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
