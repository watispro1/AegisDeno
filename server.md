# 🛡️ Aegis — Server Setup Guide

> **Aegis** is a full-featured Discord moderation and community bot built with TypeScript, Discord.js v14, and MongoDB. This guide walks server administrators through every feature and how to configure it.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Moderation Commands](#moderation-commands)
3. [Community Commands](#community-commands)
4. [Roles & Panels](#roles--panels)
5. [Ticket System](#ticket-system)
6. [Verification System](#verification-system)
7. [Automation & Reminders](#automation--reminders)
8. [Configuration & Logging](#configuration--logging)
9. [Automod](#automod)
10. [Auto-Responder](#auto-responder)
11. [General Commands](#general-commands)
12. [Permission Reference](#permission-reference)

---

## Quick Start

| Step | What to do |
|------|-----------|
| 1 | Invite Aegis with **Administrator** or the permissions listed in [Permission Reference](#permission-reference) |
| 2 | Run `/config preset` to apply a ready-made setup for your server type |
| 3 | Run `/logging setup` and pick a channel for audit logs |
| 4 | Run `/verify setup` to enable member verification |
| 5 | Run `/ticket setup` to create a support panel |
| 6 | Optionally run `/automod` to enable automatic rule enforcement |

---

## Moderation Commands

### `/warn` — Issue a Warning
Warn a member and store the infraction permanently.

| Option | Description |
|--------|-------------|
| `user` | The member to warn *(required)* |
| `preset` | Quick violation preset (Spam, NSFW, Harassment, etc.) |
| `reason` | Free-text reason — also shows preset suggestions via autocomplete |
| `severity` | `low` / `medium` / `high` — affects embed colour |
| `proof` | Screenshot or image attachment stored with the case |
| `silent` | Skip DM notification to the member |

**After warning:** buttons appear for **Undo**, **Warning History**, and **Quick Timeout (10 min)**.

---

### `/timeout` — Temporarily Mute a Member
Issues a Discord timeout with a configurable duration.

| Option | Description |
|--------|-------------|
| `user` | Member to timeout *(required)* |
| `duration` | 60s · 5m · 10m · 30m · 1h · 6h · 12h · 1d · 3d · 1 week *(required)* |
| `preset` | Common reason preset |
| `reason` | Custom reason (autocomplete includes presets) |
| `proof` | Attachment stored with the mod case |
| `silent` | Skip DM |

**After confirmation:** buttons to **Undo**, **Extend +1h**, or **View Cases**.

---

### `/ban` — Permanent Ban
Ban with a confirmation prompt, DM with appeal info, and optional message deletion.

| Option | Description |
|--------|-------------|
| `user` | Member or user ID *(required)* |
| `preset` / `reason` | Reason (autocomplete + free text) |
| `delete_messages` | Delete last 0–7 days of their messages |
| `proof` | Proof attachment |
| `silent` | Skip ban DM |

**After ban:** an **Unban (Revoke)** button appears for a 60-second window.

---

### `/kick` — Remove from Server
Kicks with optional reason and DM.

---

### `/purge` — Bulk Delete Messages
Deletes messages matching your filters with a preview before executing.

| Option | Description |
|--------|-------------|
| `amount` | Number of matching messages to delete (1–500) *(required)* |
| `filter` | `all` · `bots` · `humans` · `links` · `images` · `embeds` · `keyword` |
| `user` | Only delete messages from this specific user |
| `keyword` | Delete only messages containing this text |
| `reason` | Recorded in the mod log |
| `before_message` | Only scan messages sent before this message ID — useful for targeting a specific incident |

> **Tip:** Right-click any Discord message → **Copy Message ID** to use with `before_message`.

---

### `/case` — Moderation Case Lookup
View, edit, paginate, and export moderation cases.

| Subcommand | Description |
|------------|-------------|
| `view` | View a specific case by its database ID |
| `user` | List all cases for a member with **◀ Prev / Next ▶** pagination |
| `edit` | Change the reason on an existing case |
| `delete` | Remove a case record (requires **Administrator**) |
| `export` | Download all guild cases as a JSON file |

---

### `/warn` history — `/warnings` & `/infractions`

- **`/warnings`** — List a member's active warnings
- **`/infractions`** — Full moderation record with tabs for Overview, Warnings, and Cases
- **`/modhistory`** — Paginated case history with action-type filter

---

### `/clearwarnings` — Remove All Warnings
Clears every warning for a member after a confirmation prompt.

---

### `/escalation` — Auto-Escalation Thresholds
Automatically applies actions when a member accumulates enough warnings.

| Subcommand | Description |
|------------|-------------|
| `status` | View current config including warning expiry |
| `toggle` | Enable / disable escalation |
| `add` | Add a threshold: e.g. 3 warnings → timeout 60 min |
| `remove` | Remove a threshold by warning count |
| `clear` | Remove all thresholds |
| `expiry` | Warnings older than X days stop counting (0 = never expire) |

**Actions:** `timeout` (with duration) · `kick` · `ban`

---

### `/trustscore` — Member Trust Rating
Calculates a 0–100 trust score based on account age, server tenure, warnings, and mod cases.

| Tier | Score | Meaning |
|------|-------|---------|
| 🟢 Trusted | 80–100 | Long-standing, clean member |
| 🔵 Established | 60–79 | Good standing |
| 🟡 Caution | 40–59 | Monitor |
| 🟠 Elevated Risk | 20–39 | Prior infractions |
| 🔴 High Risk | 0–19 | New or heavily sanctioned |

---

### `/lock` — Channel / Category Lockdown
Prevent @everyone from sending messages.

| Subcommand | Description |
|------------|-------------|
| `channel` | Lock a specific channel (with optional auto-unlock duration and custom message) |
| `unlock` | Restore a locked channel |
| `category` | Lock every text channel inside a category |
| `server` | Emergency: lock ALL text channels (requires **Administrator**) |
| `status` | Check current lock state of a channel |

---

### `/watchlist` — Monitor Specific Members
Alert staff when a watched member is active.

| Subcommand | Description |
|------------|-------------|
| `add` | Add a member to the watchlist with event triggers |
| `remove` | Remove from watchlist |
| `list` | View all watched members |

**Events:** Messages · Voice joins · First message of the day · Presence changes

---

### `/note` — Private Staff Notes
Add internal notes to member profiles, visible only to staff.

| Subcommand | Description |
|------------|-------------|
| `add` | Open a modal to write a note |
| `view` | View all notes for a member (paginated) |
| `delete` | Delete a note by ID |
| `clear` | Wipe all notes for a member |

---

### `/modstats` — Moderation Dashboard
View server-wide moderation activity for the last 7 or 30 days, including action breakdown and top offenders.

---

### `/modreport` — Moderator Activity Report
See which staff members took the most actions.

---

### `/appeal` — Ban Appeal System
Banned users can submit appeal codes via `/appeal submit`. Staff review with **Approve / Deny** buttons.

---

### `/slowmode` — Channel Rate-Limit
Set a per-channel message cooldown (0 to disable).

---

### `/nickname` — Force-Set Nickname
Change or reset a member's nickname.

---

## Community Commands

### `/giveaway` — Giveaways
Create, manage, and reroll Discord giveaways.

| Subcommand | Description |
|------------|-------------|
| `start` | Start a giveaway with prize, duration, and optional settings |
| `end` | End early and draw winners |
| `reroll` | Pick new winners from existing entrants |
| `list` | View active giveaways |
| `cancel` | Cancel without drawing |

**Start options:** `required_role` · `booster_multiplier` (extra entries for boosters) · `winners` (1–20)

---

### `/poll` — Community Polls
Interactive polls with live results.

- Multiple choice (up to 9 options)
- Anonymous mode — hides who voted
- Live results bar updates as votes come in
- Moderator **End Poll** button

---

### `/suggest` — Community Suggestions
Members submit suggestions via a modal; staff review with status buttons.

| Subcommand | Description |
|------------|-------------|
| `submit` | Submit a suggestion (opens a form) |
| `approve` | Mark approved (staff note optional) |
| `deny` | Mark denied with reason |
| `consider` | Mark "Under Consideration" |
| `info` | View suggestion details and vote stats |

> The suggestion author is automatically DM'd when the status changes.

---

### `/starboard` — Message Highlights
Automatically repost highly-reacted messages to a highlight channel.

- Configurable star emoji and threshold
- Self-star protection
- Handles images, embeds, and attachments

---

### `/welcome` — Welcome Messages
Send a greeting when members join.

| Option | Description |
|--------|-------------|
| `message` | Custom message supporting `{user}`, `{username}`, `{server}`, `{member_count}`, `{count}` |
| `channel` | Channel to post in |
| `role` | Auto-assign role on join |

Use `/welcome preview` to see how the message will look before enabling.

---

### `/embed` — Custom Embeds
Build and send a rich embed to any channel.

---

### `/announce` — Formatted Announcements
Post a styled announcement with optional ping.

---

### `/activitysummary` — Channel Activity
Generate an activity summary for a channel over a given period.

---

## Roles & Panels

### `/rolepanel` — Self-Assign Role Panels
Let members pick roles by clicking buttons or a dropdown.

| Option | Description |
|--------|-------------|
| `channel` | Where to post the panel *(required)* |
| `role1–3` | Roles to include |
| `style` | `button` (default) or `dropdown` |
| `exclusive` | Members can only hold one role from this panel |
| `required_role` | A role members must already have to use this panel |

---

## Ticket System

### `/ticket` — Support Tickets
Complete support ticket system with staff tools.

| Subcommand | Description |
|------------|-------------|
| `setup` | Create a ticket panel in a channel |
| `close` | Close the current ticket |
| `claim` | Assign yourself as the ticket handler |
| `add` / `remove` | Add or remove a user from the ticket channel |
| `transcript` | Generate and download an HTML transcript |
| `settings` | Set transcript log channel and inactivity auto-close hours |

**Auto-close:** Tickets with no messages for the configured number of hours (default: 48h) close automatically. A warning is posted at ~47h.

---

## Verification System

### `/verify` — Anti-Raid Verification
Gate server access behind a verification challenge.

| Subcommand | Description |
|------------|-------------|
| `setup` | Configure and post a verification panel |
| `autokick` | Kick members who don't verify within X minutes |
| `user` | Manually verify a specific member |
| `batch` | Manually verify multiple users |
| `info` | View current verification settings |

**Challenge types:**
- **One-Click Button** — Member clicks to verify instantly
- **CAPTCHA** — Member solves a simple math problem before getting the role

---

## Automation & Reminders

### `/remindme` — Personal Reminders
Set a DM reminder that survives bot restarts.

| Subcommand | Description |
|------------|-------------|
| `set` | Set a reminder with text, duration, and optional repeat |
| `list` | View your pending reminders |
| `cancel` | Cancel a reminder by ID |

**Repeat options:** `daily` · `weekly`  
**Snooze:** Delivered reminders include **Snooze 10m** and **Snooze 1h** buttons.

---

### `/automation` — Scheduled Tasks
Schedule recurring server tasks (announcements, role checks, etc.).

---

## Configuration & Logging

### `/config` — Server Settings
Manage Aegis server preferences.

| Subcommand | Description |
|------------|-------------|
| `view` | Show current settings |
| `prefix` | Set a legacy text command prefix |
| `preset` | Apply a pre-built config (community, gaming, study, etc.) |
| `language` | Set the bot language |
| `reset` | Reset all settings to defaults |

---

### `/logging` — Audit Logs
Configure which events are logged and where.

| Subcommand | Description |
|------------|-------------|
| `setup` | Set the log channel |
| `enable` / `disable` | Toggle logging |
| `categories` | Enable/disable specific log categories |
| `status` | View current logging configuration |

**Log categories:** `modActions` · `memberJoins` · `memberLeaves` · `messageEdits` · `messageDeletes` · `roleChanges` · `channelEvents`

---

### `/plugins` — Feature Toggles
Enable or disable specific Aegis feature modules per server.

---

### `/diagnostics` — Health Check
Check bot latency, database connectivity, and feature status.

---

## Automod

### `/automod` — Automatic Rule Enforcement
Detect and act on rule violations without moderator intervention.

| Rule | Description |
|------|-------------|
| `words` | Block configured forbidden words/phrases |
| `links` | Delete unauthorized links |
| `mentions` | Limit mass-pings above a threshold |
| `spam` | Rate-limit messages per window |
| `caps` | Flag messages with excessive capitalization |

**Actions per rule:** `delete` · `warn` · `timeout`

**Exemptions:** Roles and channels can be whitelisted.

---

## Auto-Responder

### `/autoresponder` — Keyword Auto-Replies
Automatically reply when a message contains a trigger phrase.

| Subcommand | Description |
|------------|-------------|
| `add` | Add a trigger → response pair |
| `list` | View all auto-responders |
| `remove` | Delete a trigger |

---

## General Commands

| Command | Description |
|---------|-------------|
| `/help` | Browse all commands by category (filtered to what you can use) |
| `/userinfo` | Full member profile; shows warns & trust score to mods only |
| `/serverinfo` | Server stats: member counts, channel breakdown, boost level |
| `/ping` | Bot latency and uptime |
| `/about` | Aegis version, links, and invite |
| `/dashboard` | Web dashboard link |

---

## Permission Reference

### Bot Required Permissions

| Permission | Used by |
|-----------|---------|
| Administrator *(optional)* | Simplifies setup |
| Manage Messages | `/purge`, automod delete |
| Manage Channels | `/lock`, ticket channels |
| Manage Roles | Verification roles, role panels |
| Ban Members | `/ban`, appeal system |
| Kick Members | `/kick`, escalation |
| Moderate Members | `/timeout`, `/warn` |
| View Audit Log | Logging |
| Embed Links | All embed responses |
| Attach Files | Transcripts, exports |
| Read Message History | `/purge`, modhistory |
| Send Messages | All responses |

### User Required Permissions (defaults)

| Permission | Commands unlocked |
|-----------|-------------------|
| `Moderate Members` | `/warn`, `/timeout`, `/kick`, `/case`, `/infractions`, `/watchlist`, `/note` |
| `Manage Messages` | `/purge`, `/slowmode` |
| `Manage Channels` | `/lock` |
| `Manage Roles` | `/rolepanel` |
| `Ban Members` | `/ban`, `/unban`, `/appeal` |
| `Manage Guild` | `/config`, `/logging`, `/automod`, `/escalation`, `/suggest` review |
| `Administrator` | `/case delete`, `/note clear` |
| *(none)* | `/help`, `/userinfo` (self), `/remindme`, `/poll`, `/suggest submit`, `/giveaway enter` |

---

## Variables Reference

These variables can be used in welcome messages and other configurable text fields:

| Variable | Replaced with |
|----------|---------------|
| `{user}` | `@Username` mention |
| `{username}` | Username without the mention |
| `{server}` | Server name |
| `{member_count}` | Total member count |
| `{count}` | Alias for `{member_count}` |

---

## Support & Links

- 🌐 **Web dashboard:** https://aegisdeno.fly.dev
- 📋 **Commands catalog:** https://aegisdeno.fly.dev/commands
- 📖 **Documentation:** https://aegisdeno.fly.dev/docs
- 💬 **Support server:** https://discord.gg/DkZUgm3q4F
- 🐛 **Issues:** https://github.com/watispro1/AegisDeno/issues

---

*Aegis is licensed under the [MIT License](LICENSE).*
