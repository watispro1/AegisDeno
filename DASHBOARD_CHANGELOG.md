# Dashboard changelog

Changes to the Aegis web dashboard at `/dashboard`, newest first. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Changes to the
bot itself are in `CHANGELOG.md`.

The dashboard has its own version numbers, separate from the bot's. They start
at 0.1.0 because the dashboard is new and its pages may still change.

## [Unreleased]

Dashboard 0.1.0, not released yet. It is off on any copy of Aegis until
`DISCORD_CLIENT_SECRET` and `DASHBOARD_SESSION_SECRET` (at least 32 characters)
are set; until then every `/dashboard` page says "not configured". Setup steps
are in `DEPLOYMENT.md` under Web dashboard.

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
  lock, unlock), by member ID or by moderator ID; a pasted mention works as an
  ID.
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
    window) and caps (with a threshold).
  - Welcome: on or off, channel, message (up to 1,000 characters, with a
    preview) and a role given on join.
  - Tickets: log channel, auto-close after a number of idle hours (0 = off, up
    to 30 days) and transcript logging.
  - Verification: on or off, the verified role, button or CAPTCHA mode, and
    kicking members still unverified after a number of minutes (0 = off, up to
    7 days).
  - Starboard: on or off, channel, star threshold and whether self-stars count.
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

### Security
- **CSRF:** every form carries a token tied to your session (an HMAC of the
  session ID), checked on every POST. POSTs whose `Origin` header is not the
  dashboard's own origin are refused.
- **OAuth state:** the state sent to Discord is checked against a signed,
  short-lived cookie on the callback.
- **Rate limits** per client: 20 login requests, 30 form posts and 240 page
  loads a minute. Over the limit you get a 429 page with `Retry-After`.
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

### Known limitations
- Some settings are still slash-command only: the automod word list and
  exemptions (`/automod`), posting the ticket panel (`/ticket setup`), and the
  starboard emoji and ignored channels (`/starboard`).
- Revoking only marks the record. It stops counting toward totals, escalation
  and the trust score, but it does not lift a ban or timeout in Discord; use
  `/unban` or `/removetimeout` for that.
- Verification settings can only be saved after `/verify setup` has posted the
  panel in Discord. Until then the page says to run it first.
- Rate limits key on the `Fly-Client-IP` header, falling back to the socket
  address. That header is only trustworthy behind Fly.io's proxy; on another
  host a client could set it. The counters are in memory, per process, and reset
  on restart.
- Revoking the Discord token at logout is best effort: if Discord does not
  answer within 5 seconds, the session is still ended but the token lives until
  it expires.
