# AegisDeno Support Server — Channel Content Guide

Copy and paste the text or run the slash command for each channel when setting up your Discord support server.

---

## 📌 INFORMATION

---

### #rules

**Channel Topic:**
`Read before chatting. Follow Discord ToS and treat everyone with respect.`

**Message to post:**

```markdown
# Server Rules

Welcome to the AegisDeno server! Please follow these basic guidelines so everyone has a good time.

1. **Follow Discord ToS & Guidelines**
   Keep everything within Discord's Terms of Service and Community Guidelines.
   https://dis.gd/tos | https://dis.gd/guidelines

2. **Be Respectful**
   No harassment, hate speech, slurs, or toxic behavior. Disagreements happen, but keep them civil.

3. **No Unsolicited Advertising or DMs**
   Don't post invite links, spam promotions, or slide into member DMs to advertise without staff permission.

4. **Keep Content SFW**
   No NSFW, gore, or sketchy/phishing links anywhere on the server.

5. **No Spam or Mass Mentions**
   Don't flood messages, spam emotes, or unnecessarily ping `@everyone`, `@here`, or staff roles.

6. **Use the Right Channels**
   Keep bot commands in `#bot-commands`, support questions in `#setup-help` or `#open-a-ticket`, and feature ideas in `#suggestions`.

7. **Follow Staff Instructions**
   Moderators are here to keep things safe. If you disagree with a moderation action, open a ticket instead of arguing in public chat.

8. **Voice Etiquette**
   No soundboard spam, screamers, or loud background noise in voice channels.

_Note: Infractions are logged automatically by AegisDeno. Repeated warnings will escalate to timeouts, kicks, or bans._
```

---

### #announcements

**Channel Topic:**
`Official bot updates, changelogs, and downtime notices.`

**First embed to post:**

```
/embed quick channel:#announcements title:"AegisDeno Announcements" description:"This channel is for official bot releases, changelogs, maintenance notices, and major project news.\n\nTurn on channel notifications to stay updated on new releases." color:"#5865F2" footer:"AegisDeno Updates"
```

**Latest announcement message (v3.3.1):**

```markdown
🛡️ **AegisDeno v3.3.1 is live! — Liquid Glass 2.0 & QoL Patch**

What's new in this patch update:
• 🪟 **Liquid Glass 2.0 Overhaul:** Apple VisionOS/macOS Sequoia frosted glass physics with dual-angle specular highlights, enhanced 48px blur, 210% saturation boost, and dynamic prismatic hover lifts.
• ⚡ **Toggleable Liquid Glass Mode:** Seamless toggle between VisionOS frosted materials and high-contrast solid performance mode via the navbar `.glass-toggle` button, the `/dashboard` operations center, or the `G` keyboard shortcut.
• 📋 **One-Click Command Copy:** Instant command string copying on `/commands` with live toast feedback and checkmark animations.
• ⏱️ **Hardened `/timeout` Extensions:** Quick-action button now dynamically computes duration from current expiration time with full audit logging and case tracking.
• 🔒 **Thread-Safe Lockdown:** `/lock server` cleanly skips thread channels, preventing unhandled exceptions.
• 💬 **Enhanced AutoResponders:** Added `{tag}`, `{user_id}`, `{server_id}`, and `{channel_id}` variables.
• 🛡️ **Verification Hardening:** Safe optional catching on member fetching during button verification.

🔗 **Add AegisDeno:** https://discord.com/oauth2/authorize?client_id=1554631691421876254
🌐 **Web Dashboard:** https://aegisdeno.fly.dev/dashboard
📖 **Changelog:** https://aegisdeno.fly.dev/changelog
```

**Previous announcement message (v3.2):**

```markdown
🛡️ **AegisDeno v3.2 is live! — System Telemetry & Status Overhaul**

What's new in this release:
• 📊 **Overhauled `/about` command:** Interactive select menu with 4 dedicated views: System Overview, Runtime Telemetry (with ASCII heap meter), Network & Guilds, and live Database Diagnostics (MongoDB round-trip ping probe).
• 🌐 **Redesigned Web Status Page:** Modern visual dashboard with SLA health tiers, 30-day uptime history visualization, component status rows, and machine-readable JSON endpoints (`/status`).
• 🏓 **Upgraded `/ping` command:** Shows WebSocket heartbeat, round-trip message latency, MongoDB ping, uptime, and direct live status link.
• 🎁 **Giveaways, Polls & Reminders:** Role requirements, multi-winner draws, persistent recovery across restarts, and `/remindme`.
• ⚡ **Reliability & Security Hardening:** Hardened role panels, atomic suggestion voting, and safe ticket teardown.

🔗 **Add AegisDeno:** https://discord.com/oauth2/authorize?client_id=1554631691421876254
📊 **Live Status:** https://aegisdeno.fly.dev/status
📖 **Changelog:** https://aegisdeno.fly.dev/changelog
```

---

### #getting-started

**Channel Topic:**
`New to AegisDeno? Follow this quick setup guide.`

**Embed to post:**

```
/embed quick channel:#getting-started title:"Getting Started with AegisDeno" description:"Follow these simple steps to set up AegisDeno in your server in under 5 minutes." color:"#57F287" footer:"AegisDeno Setup"
```

**Message to post below the embed:**

```markdown
### 1. Invite the Bot

Add AegisDeno with the required permissions:
https://discord.com/oauth2/authorize?client_id=1554631691421876254

_Make sure the AegisDeno role is placed above member roles in Server Settings → Roles so moderation commands work properly._

---

### 2. Quick Setup (1-Click Preset)

Run this command in any admin channel to apply a pre-configured template:
`/preset apply preset:community`

Presets available:
• `community` — Balanced AutoMod, welcome channel, suggestions, logging
• `gaming` — Light chat filters, voice-friendly rules
• `minimal` — Basic logging and warning limits

---

### 3. Key Feature Setup (Manual)

If you want to configure modules individually:

• **Set up Mod Logs:**
`/logging channel channel:#mod-logs`
`/logging toggle enabled:true`

• **Set up Ticket Panel:**
`/ticket setup channel:#open-a-ticket staff_role:@Support title:"Support Tickets" description:"Click below to open a ticket."`

• **Set up Member Verification:**
`/verify setup channel:#verification verified_role:@Member type:button`

• **Set up Welcome Messages:**
`/welcome channel channel:#welcome`
`/welcome toggle enabled:true`

• **Set up AutoMod:**
`/automod words toggle enabled:true`
`/automod words action action:warn`
`/automod links toggle enabled:true`
`/automod mentions toggle enabled:true`
`/automod mentions limit count:5`

---

### 4. Check Everything

Run `/diagnostics` or `/config view` to verify your configuration.

📖 Full Docs: https://aegisdeno.fly.dev
❓ Need help? Ask in `#setup-help` or open a ticket in `#open-a-ticket`.
```

---

### #links

**Channel Topic:**
`Official AegisDeno website, documentation, GitHub, and invite links.`

**Embed to post:**

```
/embed quick channel:#links title:"Official AegisDeno Links" description:"Bookmark these resources for bot setup, documentation, and source code." color:"#5865F2" footer:"AegisDeno Resources"
```

**Message to post below the embed:**

```markdown
• 🤖 **Bot Invite:** https://discord.com/oauth2/authorize?client_id=1554631691421876254
• 🌐 **Website & Dashboard:** https://aegisdeno.fly.dev
• 📖 **Documentation:** https://aegisdeno.fly.dev/docs
• 📋 **Full Command Catalog:** https://aegisdeno.fly.dev/commands
• 🐙 **GitHub Repository:** https://github.com/your-org/aegisdeno
• 🗳️ **Top.gg Page:** https://top.gg/bot/aegisdeno/vote
• 💬 **Support Server:** https://discord.gg/DkZUgm3q4F

_Voting on Top.gg is free and takes just a few seconds — it helps more servers discover AegisDeno!_
```

---

### #topgg-votes

**Channel Topic:**
`Live feed of Top.gg upvotes. Thanks for supporting the bot!`

**Message / Embed to post:**

```
/embed quick channel:#topgg-votes title:"Top.gg Vote Feed" description:"This channel automatically receives live notifications whenever someone votes for AegisDeno on Top.gg!\n\n🗳️ Vote here: https://top.gg/bot/aegisdeno/vote\n\nEvery vote helps boost the bot's rank so more communities find it. Thank you for your support!" color:"#FF3366" footer:"Powered by Top.gg"
```

---

## 💬 COMMUNITY

---

### #general

**Channel Topic:**
`General discussion. Chat about Discord bots, server setups, and tech.`

**Message to pin:**

```markdown
👋 Welcome to **#general**!

This is our main community chat. Feel free to talk about:
• Server setup ideas and moderation tips
• Discord bot development and TypeScript / discord.js
• Tech, gaming, and general chat

Quick reminders:
• For bot help, use `#setup-help` or `#open-a-ticket`
• Test slash commands in `#bot-commands`
• Submit feature requests in `#suggestions`
```

---

### #bot-commands

**Channel Topic:**
`Public playground for testing AegisDeno slash commands.`

**Message / Embed to pin:**

```
/embed quick channel:#bot-commands title:"Bot Commands Sandbox" description:"Test out AegisDeno commands here so general chat stays clean.\n\nTry running:\n• `/ping` — View bot latency and gateway ping\n• `/help` — Browse available commands\n• `/about` — Check bot stats and versions\n• `/userinfo` — Check your server profile and roles\n• `/serverinfo` — View current server statistics\n• `/remindme reminder:\"Take a break\" duration:30m` — Set a timer" color:"#FEE75C" footer:"AegisDeno Commands"
```

---

### #suggestions

**Channel Topic:**
`Share feature requests and vote on ideas with buttons.`

**Setup command to run:**

```
/suggest setup channel:#suggestions
```

**Embed to pin:**

```
/embed quick channel:#suggestions title:"Feature Suggestions" description:"Have an idea for AegisDeno? Share it with the community!\n\n**How to suggest:**\nRun `/suggest submit` to open the suggestion form.\n\nYour suggestion will post here with voting buttons so other members can vote on it.\n\n**Status Labels:**\n⏳ Pending Review • 🟡 Under Consideration • ✅ Approved • ❌ Rejected" color:"#F47FFF" footer:"AegisDeno Suggestions"
```

---

### #polls

**Channel Topic:**
`Community polls and feedback voting.`

**Embed to pin:**

```
/embed quick channel:#polls title:"Community Polls" description:"Staff will post polls here for community feedback, feature priorities, and server decisions.\n\nVote directly on the poll cards to share your opinion!" color:"#3498DB" footer:"AegisDeno Polls"
```

---

### #roles

**Channel Topic:**
`Click buttons below to toggle self-assignable roles.`

**Setup commands to run:**

```
/rolepanel create channel:#roles role1:@Announcements role2:@Events role3:@Updates
```

_(Enter "Notification Roles" for Title and "Click to toggle your notification pings:" for Description in the modal)_

```
/rolepanel create channel:#roles role1:@Developer role2:@Beta Tester role3:@Gamer
```

_(Enter "Community Roles" for Title and "Pick your interest roles:" for Description in the modal)_

---

### #welcome

**Channel Topic:**
`New member join feed.`

**Setup command to run:**

```
/welcome channel channel:#welcome
/welcome toggle enabled:true
```

**Intro embed to pin:**

```
/embed quick channel:#welcome title:"Welcome to AegisDeno!" description:"Glad to have you here! Here are a few quick links to help you find your way around:\n\n1. Complete verification in <#verification>\n2. Check the server rules in <#rules>\n3. Pick your roles in <#roles>\n4. Need bot setup help? Head to <#getting-started> or <#setup-help>" color:"#5865F2" footer:"Welcome to our community"
```

---

### #giveaways

**Channel Topic:**
`Community giveaways and prize events.`

**Embed to pin:**

```
/embed quick channel:#giveaways title:"AegisDeno Giveaways" description:"We host occasional giveaways here for Discord Nitro, roles, and community perks!\n\n**Rules:**\n• Click the Enter button on active giveaway messages to join.\n• One entry per member. Alt accounts will be disqualified.\n• Winners have 48 hours to claim by opening a ticket in <#open-a-ticket>." color:"#F47FFF" footer:"AegisDeno Giveaways"
```

---

## 🛠️ SUPPORT CENTER

---

### #open-a-ticket

**Channel Topic:**
`Need private assistance? Click below to open a ticket.`

**Setup command to run:**

```
/ticket setup channel:#open-a-ticket staff_role:@Support title:"AegisDeno Support" description:"Click the button below to open a private ticket with our team. Please check #faq first for quick answers to common issues."
```

---

### #verification

**Channel Topic:**
`Click the verify button to gain access to the server.`

**Setup command to run:**

```
/verify setup channel:#verification verified_role:@Member type:button
```

---

### #setup-help

**Channel Topic:**
`Troubleshooting forum. Ask questions or create a thread for bot help.`

**Pinned message:**

```markdown
### Getting Help with AegisDeno

Need help troubleshooting an issue? Follow these steps for quick support:

1. **Check common fixes:**
   • **Permission errors:** Make sure the AegisDeno bot role is ABOVE member roles in Server Settings → Roles.
   • **AutoMod not logging:** Run `/logging status` to confirm your log channel is set and enabled.
   • **Slash commands missing:** Run `/sync guild_only:true` or wait a short while for global command sync.

2. **When asking a question, please include:**
   • What you were trying to do
   • The command you ran
   • The exact error message or a screenshot

For private inquiries or server-specific matters, open a ticket in `#open-a-ticket`.
```

---

### #faq

**Channel Topic:**
`Frequently asked questions about AegisDeno.`

**Message to post:**

```markdown
# Frequently Asked Questions

**Q: Is AegisDeno free?**
A: Yes, AegisDeno is 100% free and open-source. There are no paywalls or locked features.

**Q: Why do moderation commands say "Missing Permissions"?**
A: Discord checks role hierarchy. Go to Server Settings → Roles and drag AegisDeno above regular members and moderators.

**Q: How does warning escalation work?**
A: Use `/escalation add warnings:3 action:timeout duration:30` so members automatically receive timeouts after reaching warning limits.

**Q: How do I turn on AutoMod?**
A: Run `/automod words toggle enabled:true` and `/automod links toggle enabled:true`. Run `/automod status` to review your active filters.

**Q: Can I self-host the bot?**
A: Yes! AegisDeno runs on Node.js/TypeScript and can be deployed on Docker, Fly.io, or VPS. Check DEPLOYMENT.md in our GitHub repository.

**Q: How do I report a bug or suggest a feature?**
A: Report bugs by opening a ticket in `#open-a-ticket`. Post feature ideas in `#suggestions` using `/suggest submit`.
```

---

## 💻 DEVELOPMENT

---

### #dev-chat

**Channel Topic:**
`Technical discussions: TypeScript, discord.js, architecture, and PRs.`

**Message / Embed to pin:**

```
/embed quick channel:#dev-chat title:"Developer Chat" description:"Discussion channel for developers contributing to AegisDeno or building Discord bots.\n\n**Topics:**\n• TypeScript and discord.js best practices\n• AegisDeno codebase, services, and schemas\n• Webhooks, API routes, and deployment\n\n*Review CONTRIBUTING.md before opening pull requests on GitHub.*" color:"#9B59B6" footer:"AegisDeno Developers"
```

---

### #github-logs

**Channel Topic:**
`Automated feed of GitHub commits, pull requests, and releases.`

**Message to post:**

```markdown
**GitHub Repository Activity Feed**

This channel receives automated notifications for:
• Code commits pushed to `main`
• Pull requests and code reviews
• Issue reports and labels
• New version tags and releases

🔗 **Repository:** https://github.com/your-org/aegisdeno
```

---

### #beta-testing

**Channel Topic:**
`Testing channel for staging bot builds and upcoming features.`

**Message / Embed to pin:**

```
/embed quick channel:#beta-testing title:"Beta Testing Lab" description:"This channel is used to test staging builds and unreleased features before they ship to production.\n\n⚠️ **Expect bugs and experimental behavior here.** Do not rely on beta bot commands for daily moderation.\n\nPlease report any issues or unexpected output directly in this channel!" color:"#E67E22" footer:"AegisDeno Beta"
```

---

## 🔒 STAFF ONLY

---

### #staff-chat

**Channel Topic:**
`Private coordination for moderators and admins.`

**Message to pin:**

```markdown
### Staff Guidelines & Protocols

Welcome to the staff channel. Keep discussions constructive and professional.

**General Guidelines:**
• **Stay Objective:** Apply rules fairly. Don't let personal arguments influence moderation actions.
• **Always Add Reasons:** Every `/warn`, `/timeout`, `/kick`, and `/ban` should have a clear, factual reason.
• **Escalate Cleanly:** Start with verbal warnings or `/warn`, then `/timeout`, and only use kicks/bans for repeat or severe offenses.
• **Tickets:** Greet members politely, answer clearly, and run `/ticket close` once resolved.

**Quick Command Reference:**
• `/warn user:@User reason:"..." severity:medium`
• `/timeout user:@User duration:3600 reason:"..."`
• `/kick user:@User reason:"..."`
• `/ban user:@User delete_messages:1 reason:"..."`
• `/infractions user:@User`
• `/case view case_id:"<id>"`
• `/slowmode set channel:<#channel> seconds:10 reason:"..."`
• `/lock channel:<#channel> reason:"..."`
```

---

### #mod-logs

**Channel Topic:**
`Automated audit log feed from AegisDeno.`

**Embed to pin:**

```
/embed quick channel:#mod-logs title:"Moderation Audit Log" description:"AegisDeno posts automatic log entries here whenever a warning, timeout, kick, ban, or AutoMod action occurs.\n\nEach action receives an incremental Case ID stored in the database for tracking." color:"#3498DB" footer:"AegisDeno Logging"
```

---

### #bot-config

**Channel Topic:**
`Admin terminal for configuring bot settings and running maintenance.`

**Message to pin:**

```markdown
### Admin Setup & Maintenance Commands

Run administrative commands here so public channels stay clutter-free:

**1. Apply Server Preset:**
`/preset apply preset:community`

**2. Audit Logging:**
`/logging channel channel:#mod-logs`
`/logging toggle enabled:true`

**3. AutoMod Baseline:**
`/automod words toggle enabled:true`
`/automod words add word:discord.gg/`
`/automod words action action:warn`
`/automod links toggle enabled:true`
`/automod links action action:delete`
`/automod mentions toggle enabled:true`
`/automod mentions limit count:5`
`/automod spam toggle enabled:true`
`/automod spam limit max_messages:5 time_window:5`
`/automod exempt add_role role:@Moderator`

**4. Infraction Escalation:**
`/escalation toggle enabled:true`
`/escalation add warnings:3 action:timeout duration:30`
`/escalation add warnings:5 action:kick`
`/escalation add warnings:7 action:ban`

**5. System Health Check:**
`/config view`
`/automod status`
`/escalation status`
`/diagnostics`
`/dashboard`
```

---

## 🔊 VOICE CHANNELS

---

### Lounge (Voice)

**Channel Status / Topic:**
`Casual voice chat and screen sharing.`

**Voice text chat message to send:**

```markdown
**Lounge Voice Guidelines**
• Keep background noise to a minimum and use push-to-talk if your mic is sensitive.
• No soundboard spam or screamers.
• Screen shares must remain strictly SFW and follow Discord ToS.
```

---

### Support Waiting Room (Voice)

**Channel Status / Topic:**
`Voice support queue. Stay muted; staff will move you into a room.`

**Voice text chat message to send:**

```markdown
**Voice Support Queue**
• You are automatically muted while waiting here.
• Have your server ID and issue details ready.
• A staff member will move you to a private support voice room as soon as someone is available.
• If wait times are long, opening a text ticket in `#open-a-ticket` is recommended!
```

---

### Staff VC (Voice)

**Channel Status / Topic:**
`Private voice channel for staff meetings and coordination.`

**Voice text chat message to send:**

```markdown
**Staff Voice Room**
Private voice room for moderators and admins. Please keep discussion confidential and mute your mic when not speaking.
```

---

## 🎨 Recommended Channel Emoji Icons

| Channel                | Emoji | Purpose                    |
| ---------------------- | ----- | -------------------------- |
| `#rules`               | 📜    | Rules and guidelines       |
| `#announcements`       | 📢    | Bot news and updates       |
| `#getting-started`     | 🚀    | First-time setup guide     |
| `#links`               | 🔗    | Official links and invite  |
| `#topgg-votes`         | 🗳️    | Top.gg upvote feed         |
| `#general`             | 💬    | Main chat                  |
| `#bot-commands`        | 🤖    | Command testing            |
| `#suggestions`         | 💡    | Feature suggestions        |
| `#polls`               | 📊    | Server polls               |
| `#roles`               | 🎭    | Self-assignable roles      |
| `#welcome`             | 👋    | Welcome messages           |
| `#giveaways`           | 🎉    | Giveaways and events       |
| `#open-a-ticket`       | 🎟️    | Support ticket panel       |
| `#verification`        | 🛡️    | Verification button panel  |
| `#setup-help`          | ❓    | Troubleshooting forum      |
| `#faq`                 | 📚    | Frequently asked questions |
| `#dev-chat`            | 💻    | Developer discussion       |
| `#github-logs`         | 🐙    | GitHub commits and PRs     |
| `#beta-testing`        | 🧪    | Staging bot testing        |
| `#staff-chat`          | 🔒    | Staff discussion           |
| `#mod-logs`            | 📋    | Moderation audit log       |
| `#bot-config`          | ⚙️    | Admin bot configuration    |
| `Lounge`               | 🔊    | Public voice chat          |
| `Support Waiting Room` | 🎧    | Voice support queue        |
| `Staff VC`             | 🔒    | Staff voice meetings       |
