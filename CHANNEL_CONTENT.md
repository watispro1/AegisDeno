# 📬 AegisDeno Support Server — Channel Content Guide

> Copy and paste each section below directly into its respective Discord channel.
> Channels marked with **[EMBED]** should be sent as bot embeds using `/embed`. Channels marked with **[MESSAGE]** are plain text pastes.

---

## 📌 INFORMATION Category

---

### 📜 `#rules` — [MESSAGE]

> Set the channel topic to: `Read before participating. Violations result in automated moderation.`

```
╔══════════════════════════════════════════╗
║      📜  Server Rules & Guidelines       ║
╚══════════════════════════════════════════╝

Welcome to the official **AegisDeno** support server!
To maintain a safe, productive, and welcoming environment, all members must adhere to the following rules.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
§1 — Follow Discord's Terms of Service
All activity must comply with Discord's ToS and Community Guidelines.
🔗 https://dis.gd/tos | https://dis.gd/guidelines

§2 — Be Respectful
Harassment, slurs, hate speech, personal attacks, or toxic behavior toward any member will result in an immediate timeout or ban.

§3 — No Unsolicited Advertising
Do not post invite links, promotions, or DM solicitations without explicit staff permission.

§4 — Keep Content Appropriate
NSFW content, gore, or malicious/phishing links are strictly prohibited across all channels and DMs.

§5 — No Spam or Mass Mentions
Message flooding, excessive emoji, or abusing @everyone / @here / role pings is not allowed.

§6 — Use Channels Correctly
Post in the channel relevant to your question. Off-topic conversations slow support for everyone.

§7 — Respect Staff Decisions
Moderators enforce rules at their discretion. If you disagree with an action, open a ticket — do not argue publicly.

§8 — Voice Etiquette
No soundboard abuse, ear-rape audio, or excessive noise in voice channels.

§9 — No Impersonation
Impersonating staff, the developer team, or other members is prohibited. Suspicious accounts will be quarantined.

§10 — Automated Enforcement
AegisDeno tracks all infractions automatically. Warning accumulation triggers escalating actions (timeout → kick → ban).
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
By joining this server, you agree to these guidelines.
```

---

### 📢 `#announcements` — [EMBED via `/embed`]

> **Channel Topic:** `Bot updates, changelogs, and service notices. Enable notifications to stay up to date.`

**Send this as the pinned channel introduction:**

```
/embed channel:#announcements title:"📢 Welcome to Announcements" color:#5865F2 description:"This channel receives all official AegisDeno announcements including:\n\n🆕 **Version releases** and changelogs\n🛠️ **Hotfixes** and critical patches\n⚠️ **Downtime notices** and maintenance windows\n🎉 **New feature previews** and roadmap updates\n\nEnable notifications 🔔 to stay informed the moment updates drop." footer:"AegisDeno • Official Announcements"
```

**First announcement to post:**

```
🛡️ AegisDeno v3.0 is Live!

After months of development, AegisDeno v3 is officially released.

What's new:
• Full slash command rework across all modules
• Dual-layer AutoMod engine (Discord Native + Bot-level)
• Advanced ticket system with transcripts
• Suggestion voting with live counters
• Interactive /dashboard with real-time stats
• Brand new documentation website at https://aegisbot.dev
• Automation scheduler for timed actions
• Self-assignable role panels

Add AegisDeno: https://discord.com/oauth2/authorize?client_id=1554631691421876254
Vote on Top.gg: https://top.gg/bot/aegisdeno/vote
Full changelog: https://aegisbot.dev/changelog
```

---

### 🚀 `#getting-started` — [EMBED + MESSAGE]

> **Channel Topic:** `New to AegisDeno? Start here. Step-by-step setup guide.`

**Embed header:**

```
/embed channel:#getting-started title:"🚀 Getting Started with AegisDeno" color:#57F287 description:"Welcome! Follow these steps to get AegisDeno fully set up in under 5 minutes." footer:"AegisDeno • Setup Guide"
```

**Follow-up plain message:**

```
Step 1 — Invite AegisDeno
https://discord.com/oauth2/authorize?client_id=1554631691421876254

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 2 — Apply a 1-Click Preset (fastest setup)
/preset apply preset:community

Available presets:
• community — Balanced AutoMod, welcome messages, suggestion channel
• gaming — Relaxed rules, voice-focused, gaming-optimized AutoMod
• minimal — Bare-bones setup for small servers

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 3 — Manual Configuration (optional)

AutoMod:
/automod words enable action:warn log_channel:#mod-logs
/automod spam enable action:timeout max_messages:5 time_window:5

Ticket System:
/ticket setup channel:#open-a-ticket category:Support

Verification Gate:
/verify setup channel:#verification role:@Member type:button

Welcome Messages:
/welcome setup channel:#welcome message:Welcome {user} to {server}! You are member #{member_count}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 4 — Set Up Logging
/logging channel:#mod-logs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 5 — Verify Everything Works
/diagnostics
/dashboard
/automod status

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 Full Documentation: https://aegisbot.dev
❓ Need help? Open a ticket in #open-a-ticket or ask in #setup-help
```

---

### 🔗 `#links` — [EMBED + MESSAGE]

> **Channel Topic:** `All official AegisDeno resources in one place.`

**Embed:**

```
/embed channel:#links title:"🔗 Official AegisDeno Links" color:#5865F2 description:"Everything you need to know about AegisDeno, in one place." footer:"AegisDeno • Resources Hub"
```

**Plain message content:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 Add AegisDeno to your server
https://discord.com/oauth2/authorize?client_id=1554631691421876254

🌐 Documentation & Website
https://aegisbot.dev

📋 Changelog & Release Notes
https://aegisbot.dev/changelog

⬆️ Vote on Top.gg (boosts our visibility!)
https://top.gg/bot/aegisdeno/vote

🐙 GitHub Repository (open source!)
https://github.com/your-org/aegisdeno

💬 Support Server Invite
https://discord.gg/DkZUgm3q4F

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Voting on Top.gg is free and takes 5 seconds.
Every vote helps more servers discover AegisDeno. Thank you! 🙏
```

---

### 🗳️ `#topgg-votes` — [EMBED via `/embed`]

> **Channel Topic:** `Live feed of Top.gg votes. Thank you to everyone who supports us! 🙏`

```
/embed channel:#topgg-votes title:"🗳️ Top.gg Vote Tracker" color:#FF3366 description:"This channel receives live notifications every time someone votes for AegisDeno on Top.gg!\n\n⬆️ Vote now (free, takes 5 seconds):\nhttps://top.gg/bot/aegisdeno/vote\n\n🎉 Every vote helps AegisDeno rank higher and get discovered by more servers.\nThank you to everyone who has voted — you're keeping this project alive!" footer:"Powered by Top.gg Webhooks"
```

---

## 💬 COMMUNITY Category

---

### 💬 `#general` — [MESSAGE]

> **Channel Topic:** `Main community chat. Talk about anything! Keep it friendly.`

```
👋 Welcome to #general!

This is the main community hub for the AegisDeno server. Feel free to:
• Chat about your server setups and how you're using AegisDeno
• Share cool moderation strategies or AutoMod configurations
• Discuss Discord bot development in general
• Ask quick questions before opening a formal support ticket

A few quick reminders:
🤐 Keep it friendly and on-topic
🎫 For bot issues, use #open-a-ticket
🤖 For bot commands, use #bot-commands
💡 Have a feature idea? Drop it in #suggestions!
```

---

### 🤖 `#bot-commands` — [EMBED via `/embed`]

> **Channel Topic:** `Test AegisDeno commands here. All slash commands work in this channel.`

```
/embed channel:#bot-commands title:"🤖 Bot Command Testing Ground" color:#FEE75C description:"Use this channel to test and explore AegisDeno's slash commands without cluttering other channels.\n\n**Try these to get started:**\n• `/ping` — Check bot latency\n• `/help` — Browse all commands interactively\n• `/about` — Bot info and runtime stats\n• `/serverinfo` — Your server's overview\n• `/userinfo` — Your profile and permission info\n• `/dashboard` — Server management panel" footer:"AegisDeno • Command Testing"
```

---

### 💡 `#suggestions` — [EMBED via `/embed`]

> **Channel Topic:** `Submit feature requests and vote on ideas! Use /suggest create`

```
/embed channel:#suggestions title:"💡 Feature Suggestions" color:#F47FFF description:"Have an idea for a new AegisDeno feature? We want to hear it!\n\n**How to submit a suggestion:**\nRun `/suggest create` and fill out the title and description.\nYour suggestion will appear here with 👍 Upvote and 👎 Downvote buttons.\n\n**Suggestion lifecycle:**\n🟡 **Under Review** — Being evaluated by the team\n🟢 **Approved** — Planned for an upcoming release\n🔴 **Denied** — Not feasible or out of scope (reason provided)\n\n**Tips for good suggestions:**\n• Be specific — explain the problem your idea solves\n• Include examples of how it would work\n• Check if it's already been suggested!" footer:"AegisDeno • Community Driven Development"
```

---

### 📊 `#polls` — [EMBED via `/embed`]

> **Channel Topic:** `Community polls. Vote to make your voice heard!`

```
/embed channel:#polls title:"📊 Community Polls" color:#3498DB description:"Staff will post polls here for important community decisions, feature prioritization, and general fun!\n\nVoting is open to all members. Simply click your preferred option on each poll card.\n\n**Upcoming topics may include:**\n• Which features to prioritize in the next release\n• New preset template ideas\n• Server event planning\n\nStay tuned and make your voice count! 🗳️" footer:"AegisDeno • Community Voice"
```

---

## 🛠️ SUPPORT CENTER Category

---

### 🎟️ `#open-a-ticket` — [Run Command + EMBED]

> **Channel Topic:** `Need help? Click the button below to open a private support ticket.`

**Step 1 — Send an intro embed:**

```
/embed channel:#open-a-ticket title:"🎟️ Support Center" color:#E74C3C description:"Need help with AegisDeno? Our support team is here for you!\n\nClick the button below to open a private ticket.\nA dedicated channel will be created just for you and our support team.\n\n**Before opening a ticket, please check:**\n📚 Documentation: https://aegisbot.dev\n❓ FAQ: #faq\n🔍 Existing answers in #setup-help" footer:"Response times: typically under 24 hours"
```

**Step 2 — Deploy the ticket panel:**

```
/ticket setup channel:#open-a-ticket category:Support
```

---

### 🛡️ `#verification` — [Run Command + EMBED]

> **Channel Topic:** `Complete verification to access the server. One click is all it takes!`

**Step 1 — Send an intro embed:**

```
/embed channel:#verification title:"🛡️ Server Verification" color:#57F287 description:"Welcome to AegisDeno's official support server!\n\nTo access all channels and the community, please verify yourself by clicking the button below.\n\nThis is a quick anti-bot measure to keep our community safe and spam-free.\n\n**Why do we verify?**\n✅ Protects the community from bot raids\n✅ Ensures all members are real people\n✅ Keeps the server safe and high-quality" footer:"Verification is instant and free"
```

**Step 2 — Deploy the verification panel:**

```
/verify setup channel:#verification role:@Member type:button
```

---

### ❓ `#setup-help` — [EMBED + PINNED MESSAGE]

> **Channel Topic:** `Troubleshooting forum. Create a thread for your specific issue.`

**Intro embed:**

```
/embed channel:#setup-help title:"❓ Setup Help & Troubleshooting" color:#FEE75C description:"Having trouble setting up AegisDeno? You're in the right place!\n\n**How this channel works:**\nCreate a new thread with your specific issue.\nOur support team will respond as soon as possible.\n\n**Please include in your thread:**\n• What you were trying to do\n• The exact command you ran\n• Any error messages you received\n• Your server ID (run `/serverinfo`)" footer:"AegisDeno Support • Create a thread for faster help"
```

**Pinned message in this channel:**

```
📌 Common Setup Issues & Quick Fixes

❌ "Missing Permissions" error on moderation commands
→ Make sure AegisDeno's role is ABOVE the target member's highest role in Server Settings → Roles.

❌ Commands not showing up in Discord
→ Global commands can take up to 1 hour to propagate after the bot restarts.
→ Make sure "Use Application Commands" is enabled for @everyone in your server.

❌ AutoMod not triggering
→ Run /automod status to check if filters are enabled.
→ Make sure the log channel is set and AegisDeno has Send Messages + Embed Links permissions there.

❌ Ticket panel not working
→ AegisDeno needs Manage Channels and Manage Roles permissions.
→ Ensure the target category exists and the bot can create channels there.

❌ Welcome messages not sending
→ Run /config view to verify your welcome channel is set correctly.
→ Check that AegisDeno has Send Messages permission in the welcome channel.

📚 Full troubleshooting guide: https://aegisbot.dev/troubleshooting
```

---

### 📚 `#faq` — [MESSAGE]

> **Channel Topic:** `Frequently asked questions. Read before opening a ticket!`

```
📚 Frequently Asked Questions — AegisDeno

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Q: Is AegisDeno free to use?
A: Yes! AegisDeno is completely free and open-source. No paywalls, no premium tiers.

Q: What database does AegisDeno use?
A: AegisDeno uses MongoDB Atlas for server configuration and moderation history, plus SQLite for local caching and scheduling.

Q: How do I set up AegisDeno from scratch?
A: Check out #getting-started for a complete step-by-step guide. For one-click setup, run /preset apply preset:community.

Q: Why aren't my slash commands showing up after the bot restarts?
A: Global command registration can take up to 1 hour to propagate across Discord. Set DISCORD_TEST_GUILD_ID in your .env for instant guild-scoped registration during development.

Q: Can AegisDeno moderate users with higher roles?
A: No — Discord enforces strict role hierarchy. AegisDeno's bot role must be above the target member's highest role.

Q: How does the escalation system work?
A: Configure automatic escalation thresholds with /escalation set. Example: 3 warnings = 1h timeout, 5 warnings = ban. The bot tracks all infractions automatically.

Q: Does AegisDeno log everything?
A: Yes, with /logging channel:#mod-logs enabled, all moderation actions are logged (warns, timeouts, kicks, bans, AutoMod triggers).

Q: Can I self-host AegisDeno?
A: Absolutely! AegisDeno is open-source. Check the GitHub repository and DEPLOYMENT.md for Docker and Fly.io deployment guides.

Q: How do I report a bug or request a feature?
A: Open a ticket in #open-a-ticket for bugs, or submit a feature request in #suggestions with /suggest create.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 Full documentation: https://aegisbot.dev
❓ Still stuck? Open a ticket in #open-a-ticket
```

---

## 💻 DEVELOPMENT Category

---

### 💻 `#dev-chat` — [EMBED via `/embed`]

> **Channel Topic:** `Developer discussion — TypeScript, Discord.js, bot architecture, API questions.`

```
/embed channel:#dev-chat title:"💻 Developer Chat" color:#9B59B6 description:"Welcome to the developer hub! This channel is for technical discussions around AegisDeno and Discord bot development.\n\n**Topics welcome here:**\n• TypeScript and Discord.js questions\n• AegisDeno architecture and contribution questions\n• API integrations and webhook setups\n• Performance optimization and deployment strategies\n• Open-source collaboration\n\n**Contributing to AegisDeno:**\nRead CONTRIBUTING.md in the GitHub repository before submitting PRs.\nAll contributions must pass TypeScript checks and follow the existing code style." footer:"AegisDeno • Developer Community"
```

---

### 🐙 `#github-logs` — [MESSAGE + WEBHOOK SETUP]

> **Channel Topic:** `Automated GitHub feed — commits, PRs, releases, and issues.`

**Setup webhook instructions:**
1. Go to: GitHub Repository → Settings → Webhooks → Add webhook
2. Payload URL: `https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN/github`
3. Content-Type: `application/json`
4. Select events: Push, Pull requests, Releases, Issues

**Intro message to send manually:**

```
🐙 GitHub Activity Feed

This channel receives automated notifications for all AegisDeno repository activity:

📝 Commits — Code pushes to main and development branches
🔀 Pull Requests — New PRs, reviews, merges, and closes
🐛 Issues — New issues, assignments, and closures
🚀 Releases — New version tags and published releases

Repository: https://github.com/your-org/aegisdeno
```

---

### 🧪 `#beta-testing` — [EMBED via `/embed`]

> **Channel Topic:** `Staging bot testing ground. Expect bugs and breaking changes here.`

```
/embed channel:#beta-testing title:"🧪 Beta Testing Lab" color:#E67E22 description:"Welcome to the beta testing channel! This is where unreleased AegisDeno features are tested before going live.\n\n⚠️ **Important:** Expect bugs, breaking changes, and experimental behavior here. Do NOT rely on staging bot commands for production use.\n\n**How to participate:**\n• Test commands and report issues in this channel\n• Include the exact command, expected behavior, and what actually happened\n• Share error messages or screenshots where possible\n\nYour testing helps make AegisDeno better for everyone. Thank you! 🙏" footer:"AegisDeno • Staging Environment"
```

---

## ⚙️ Post-Setup Verification Checklist

After setting up all channels, run these commands in `#bot-config` (Staff Only):

```
# 1. Verify bot config
/config view

# 2. Check AutoMod status
/automod status

# 3. Run full diagnostics
/diagnostics

# 4. View bot dashboard
/dashboard

# 5. Test logging is configured
/logging channel:#mod-logs

# 6. Verify commands loaded (developer only)
/developer commands

# 7. Force re-sync commands if any are missing (developer only)
/sync guild_only:true
```

---

## 🎨 Recommended Channel Emoji Icons

| Channel | Emoji |
|---|---|
| `#rules` | 📜 |
| `#announcements` | 📢 |
| `#getting-started` | 🚀 |
| `#links` | 🔗 |
| `#topgg-votes` | 🗳️ |
| `#general` | 💬 |
| `#bot-commands` | 🤖 |
| `#suggestions` | 💡 |
| `#polls` | 📊 |
| `#open-a-ticket` | 🎟️ |
| `#verification` | 🛡️ |
| `#setup-help` | ❓ |
| `#faq` | 📚 |
| `#dev-chat` | 💻 |
| `#github-logs` | 🐙 |
| `#beta-testing` | 🧪 |
| `#mod-logs` | 📋 |
| `#bot-config` | ⚙️ |
| `#staff-chat` | 🔒 |
