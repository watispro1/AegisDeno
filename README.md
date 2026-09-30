# Aegis Bot

A modern, highly-modular Discord Moderation & Community Bot built with **Node.js, Discord.js, and MongoDB**.

## Features
- **Moderation**: Kick, Ban, Warn, Timeout
- **Automod**: Filter words, links, and mass-mentions
- **Community**: Suggestions, Polls, Welcome Messages
- **Logging**: Comprehensive audit logging
- **Automation**: Reminders and Scheduled Tasks
- **Web Dashboard**: Built-in Express web dashboard for status checks

## Setup

1. Clone the repository
2. Run `npm install`
3. Rename `.env.example` to `.env` and fill in your variables:
   - `DISCORD_TOKEN`
   - `DISCORD_APPLICATION_ID`
   - `MONGO_URI`
4. Start development: `npm run dev`
5. Build for production: `npm run build` & `npm start`

## Deployment (Fly.io)

This project is configured out-of-the-box for **Fly.io** deployment.
1. Install the `flyctl` CLI.
2. Run `fly auth login`.
3. Set your secrets: `fly secrets set DISCORD_TOKEN="..." DISCORD_APPLICATION_ID="..." MONGO_URI="..."`
4. Deploy: `fly deploy`
