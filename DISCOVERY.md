# AegisDeno — Discovery & Bot Directory Listings

This guide contains listings for **Top.gg**, **Discord App Directory**, and **Discord Server Discovery**.

---

## 1. Top.gg Bot Listing

### Short Description (Max 140 characters)

```text
Modular Discord moderation, AutoMod, verification anti-raid, ticket support, reaction roles & community automation in one bot.
```

---

### Long Description (Top.gg Format)

```markdown
# AegisDeno — Moderation & Community Suite

[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](https://github.com/watipro/AegisDeno)
[![Discord.js](https://img.shields.io/badge/discord.js-v14.27-5865F2.svg)](https://discord.js.org/)
[![TypeScript](https://img.shields.io/badge/typescript-v5.0-3178C6.svg)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/mongodb-v9.0-47A248.svg)](https://www.mongodb.com/)

AegisDeno is an all-in-one moderation, security, anti-raid, and community automation bot designed for modern Discord servers. Built with Node.js, TypeScript, and MongoDB.

---

## Features

### Moderation & Escalation
- **Mod Tools**: `/warn`, `/timeout`, `/removetimeout`, `/kick`, `/ban`, `/unban`, `/purge`, `/slowmode`, `/nickname`.
- **Automatic Escalation**: Set punishments for warning thresholds via `/escalation`.
- **Case Audit Trail**: Case history with `/case view`, `/case edit`, `/case delete`, and `/case export`.
- **Staff Analytics**: Track moderator activity with `/modstats`.
- **Security Presets**: Instantly apply curated profiles (`casual`, `community`, `gaming`, `strict`) via `/preset apply`.

### AutoMod & Anti-Raid
- **Content Filtering**: Word filters, link blocklists, mass-mention protection, and chat limits (`/automod`).
- **Exemptions**: Exclude trusted roles or channels via `/automod exempt`.
- **Verification**: Button or CAPTCHA verification panels (`/verify setup`).

### Support Tickets & Roles
- **Support Tickets**: Ticket panels with private channels and staff permissions (`/ticket setup`, `/ticket close`).
- **Role Panels**: Self-assignable button role panels (`/rolepanel create`).
- **Auto-Responders**: Trigger bot replies with custom keywords and variables (`/autoresponder`).

### Community & Utilities
- **Suggestions System**: Interactive suggestion boards with live voting and staff approval (`/suggest`).
- **Native Polls**: Discord native polls with custom timers (`/poll`).
- **Scheduled Tasks**: Automated announcements and reminders (`/automation`).
- **Activity Digests**: Generate 24h, 7d, and 30d community growth summaries (`/activitysummary`).

---

## Quick Slash Command Reference

| Command             | Description                                      | Required Permission |
| :------------------ | :----------------------------------------------- | :------------------ |
| `/dashboard`        | Interactive server control panel                 | `Manage Guild`      |
| `/warn`             | Issue a warning to a member                      | `Moderate Members`  |
| `/timeout`          | Temporarily mute a member                        | `Moderate Members`  |
| `/ban`              | Ban a user from the server                       | `Ban Members`       |
| `/case view`        | View moderation case details                     | `Moderate Members`  |
| `/automod`          | Configure content filters and anti-spam rules    | `Manage Guild`      |
| `/verify setup`     | Deploy anti-raid member verification panel       | `Administrator`     |
| `/ticket setup`     | Create a support ticket panel                    | `Administrator`     |
| `/rolepanel create` | Deploy button role panel                         | `Manage Roles`      |
| `/suggest`          | Submit a community suggestion with live voting   | `@everyone`         |
```

---

## 2. Discord App Directory Listing

### Short Description (Max 150 characters)

```text
Modular Discord bot for moderation, AutoMod, anti-raid verification, support tickets, reaction roles, and automated community management.
```

---

### Detailed Description

```text
AegisDeno provides complete moderation, anti-raid security, and community engagement for Discord servers.

Key Features:
- Security & AutoMod: Word filtering, link blocking, mass-mention prevention, and anti-raid verification panels.
- Moderation: Complete slash command moderation suite with case logging and JSON export capabilities.
- Support & Community: Support ticket system, self-assignable role panels, suggestion boards, and custom auto-responders.
```
hook Endpoint Verified**: POST requests to `/api/topgg/webhook` returning `200 OK` when authorization header matches.
