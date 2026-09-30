# AegisDeno Support Server Blueprint

This document outlines the exact, detailed structure for the official AegisDeno Support Server. It includes the role hierarchy, category layout, channel design, and specific permission overrides mapped directly to Discord's official permission flags to ensure a secure and organized community.

## 🎭 Role Hierarchy & Permissions

*Note: Emojis in role names are supported via Discord role icons (Server Boost Level 2 required).*

### 👑 Administration
**1. 🛡️ Aegis Founder**
* **Color:** `#FFD700` (Gold)
* **Base Permissions:** `ADMINISTRATOR`
* **Description:** Server Owner and Project Lead. Bypasses all channel restrictions automatically.

**2. ⚔️ Administrator**
* **Color:** `#E74C3C` (Red)
* **Base Permissions:** `ADMINISTRATOR`
* **Description:** Top-level management handling server settings, integrations, and high-level escalations.

### 🛠️ Staff & Support
**3. 🔨 Moderator**
* **Color:** `#3498DB` (Blue)
* **Base Permissions:** `KICK_MEMBERS`, `BAN_MEMBERS`, `MODERATE_MEMBERS`, `MANAGE_MESSAGES`, `MANAGE_THREADS`, `MUTE_MEMBERS`, `DEAFEN_MEMBERS`, `MOVE_MEMBERS`
* **Description:** Handles community moderation, resolves disputes, and enforces rules.

**4. 🚑 Support Team**
* **Color:** `#2ECC71` (Green)
* **Base Permissions:** `MANAGE_MESSAGES`, `MANAGE_THREADS`, `CREATE_PUBLIC_THREADS`, `CREATE_PRIVATE_THREADS`, `SEND_MESSAGES_IN_THREADS`
* **Description:** Helps users with bot configuration and troubleshooting. Can manage support threads but lacks destructive moderation permissions.

### 🤖 Bot Integration
**5. 🤖 AegisDeno (Bot)**
* **Color:** `#5865F2` (Blurple)
* **Base Permissions:** `ADMINISTRATOR` (or `MANAGE_ROLES`, `MANAGE_CHANNELS`, `KICK_MEMBERS`, `BAN_MEMBERS`, `MODERATE_MEMBERS`, `MANAGE_MESSAGES` for minimum required config).
* **Description:** The production AegisDeno bot.

**6. 🔧 Test Bots**
* **Color:** `#95A5A6` (Grey)
* **Base Permissions:** None (Controlled via channel overrides).
* **Description:** Beta/Testing versions of AegisDeno.

### 🌟 Community Tiers
**7. ✨ Server Booster**
* **Color:** `#F47FFF` (Pink)
* **Base Permissions:** `USE_EXTERNAL_EMOJIS`, `USE_EXTERNAL_STICKERS`, `CHANGE_NICKNAME`, `ATTACH_FILES`
* **Description:** Automatically assigned by Discord to Nitro Boosters.

**8. 🏆 Verified Developer**
* **Color:** `#9B59B6` (Purple)
* **Base Permissions:** `VIEW_CHANNEL` (Allows access to hidden developer categories).
* **Description:** Users who build tools, write code, or contribute to the bot.

**9. 👤 Member**
* **Color:** `#FFFFFF` (White)
* **Base Permissions:** `VIEW_CHANNEL`, `SEND_MESSAGES`, `USE_APPLICATION_COMMANDS`, `READ_MESSAGE_HISTORY`, `CONNECT`, `SPEAK`, `USE_VAD`
* **Description:** Default verified community member.

**10. 🔇 Muted / Timed Out**
* **Color:** `#2C3E50` (Dark Grey)
* **Base Permissions:** None
* **Description:** Managed dynamically by Discord's timeout system or overriding `SEND_MESSAGES` to `FALSE` in channels.

---

## 📁 Server Layout: Categories & Channels

### 📌 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡
*Category Permissions Override:* 
* `@everyone`: `VIEW_CHANNEL` (TRUE), `SEND_MESSAGES` (FALSE), `ADD_REACTIONS` (TRUE)
---
* 📜・**rules** — Detailed server rules and TOS.
* 📢・**announcements** — Bot updates, downtime notices, and patch notes.
* 🚀・**getting-started** — Quick start guide to inviting and configuring AegisDeno.
* 🔗・**links** — GitHub repo, documentation, and bot invite links.

### 💬 𝗖𝗢𝗠𝗠𝗨𝗡𝗜𝗧𝗬
*Category Permissions Override:*
* `@everyone`: `VIEW_CHANNEL` (TRUE), `SEND_MESSAGES` (TRUE), `READ_MESSAGE_HISTORY` (TRUE), `ATTACH_FILES` (FALSE)
---
* 💬・**general** — Main chat for community discussions.
* 🤖・**bot-commands** — For running global AegisDeno slash commands. 
  * Override: `@everyone` -> `SEND_MESSAGES` (FALSE), `USE_APPLICATION_COMMANDS` (TRUE).
* 💡・**suggestions** — Where users can post bot feature requests.
  * *Channel Type:* Forum. 
  * Override: `@everyone` -> `CREATE_PUBLIC_THREADS` (TRUE), `SEND_MESSAGES_IN_THREADS` (TRUE).
* 📊・**polls** — Server-wide community polls.
  * Override: `@everyone` -> `SEND_MESSAGES` (FALSE).

### 🛠️ 𝗦𝗨𝗣𝗣𝗢𝗥𝗧 𝗖𝗘𝗡𝗧𝗘𝗥
*Category Permissions Override:*
* `@everyone`: `VIEW_CHANNEL` (TRUE), `SEND_MESSAGES` (FALSE)
* `🚑 Support Team`: `VIEW_CHANNEL` (TRUE), `SEND_MESSAGES` (TRUE), `MANAGE_THREADS` (TRUE)
---
* 🎫・**open-a-ticket** — Panel for creating private support tickets.
  * Override: `@everyone` -> `USE_APPLICATION_COMMANDS` (TRUE), `SEND_MESSAGES` (FALSE).
* ❓・**setup-help** — Forum channel for users asking how to configure specific AegisDeno features (e.g., Automod, Logging).
  * *Channel Type:* Forum.
  * Override: `@everyone` -> `CREATE_PUBLIC_THREADS` (TRUE), `SEND_MESSAGES_IN_THREADS` (TRUE).
* 📚・**faq** — Read-only channel addressing common questions.
  * Override: `@everyone` -> `SEND_MESSAGES` (FALSE).

### 💻 𝗗𝗘𝗩𝗘𝗟𝗢𝗣𝗠𝗘𝗡𝗧
*Category Permissions Override:*
* `@everyone`: `VIEW_CHANNEL` (FALSE)
* `🏆 Verified Developer`: `VIEW_CHANNEL` (TRUE), `SEND_MESSAGES` (TRUE)
* `🛡️ Founder` & `⚔️ Admin`: Inherits `ADMINISTRATOR`
---
* 👨‍💻・**dev-chat** — Discussions about the codebase, TypeScript, Deno, and Discordeno.
* 🔄・**github-logs** — Webhooks pushing GitHub commits, PRs, and issues.
  * Override: `🏆 Verified Developer` -> `SEND_MESSAGES` (FALSE).
* 🧪・**beta-testing** — Testing grounds for upcoming unreleased features.

### 🚨 𝗦𝗧𝗔𝗙𝗙 𝗢𝗡𝗟𝗬
*Category Permissions Override:*
* `@everyone`: `VIEW_CHANNEL` (FALSE)
* `🔨 Moderator`: `VIEW_CHANNEL` (TRUE), `SEND_MESSAGES` (TRUE)
---
* 🛡️・**staff-chat** — Private chat for staff members.
* 📝・**mod-logs** — AegisDeno's automated moderation log outputs.
  * Override: `🔨 Moderator` -> `SEND_MESSAGES` (FALSE).
* ⚙️・**bot-config** — Private channel to test configuration commands safely.

### 🔊 𝗩𝗢𝗜𝗖𝗘 𝗖𝗛𝗔𝗡𝗡𝗘𝗟𝗦
*Category Permissions Override:*
* `@everyone`: `VIEW_CHANNEL` (TRUE), `CONNECT` (TRUE), `SPEAK` (TRUE)
---
* 🎧・**Lounge** — Casual voice chat.
* 🆘・**Support Waiting Room** — Users wait here for voice support from staff.
* 🔒・**Staff VC** — Private voice channel for moderators/admins.
  * Override: `@everyone` -> `CONNECT` (FALSE). `🔨 Moderator` -> `CONNECT` (TRUE).

---

## 💡 Best Practices for the Support Server
1. **Onboarding**: Use Discord's native Community Onboarding. Remove access to the Information category for unverified users if you require a rule-acceptance gate.
2. **Auto-Moderation**: Enable AegisDeno's link filtering in `💬・general` to prevent phishing links.
3. **Clean Layout**: Hide categories like Staff Only and Development entirely from regular members by stripping their `VIEW_CHANNEL` permissions at the category level.
