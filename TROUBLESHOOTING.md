# Aegis — Troubleshooting Guide

Common problems and how to fix them.

---

## 🔴 Bot won't start

### "MONGO_URI is missing in your .env file!"
The bot exits immediately because the MongoDB connection string isn't set.

**Fix:**
1. Open (or create) `.env` in the project root.
2. Add: `MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/aegis?retryWrites=true&w=majority`
3. See [DEPLOYMENT.md](./DEPLOYMENT.md) for full MongoDB Atlas setup instructions.

---

### "Failed to connect to MongoDB"
The bot found `MONGO_URI` but couldn't actually connect.

**Common causes:**
- Wrong password in the connection string (check for special characters — URL-encode them if needed, e.g. `@` → `%40`).
- MongoDB Atlas IP allow-list doesn't include your machine or the Fly.io region. Add `0.0.0.0/0` temporarily to test.
- Cluster is paused (Atlas free tier auto-pauses after 60 days of inactivity — click **Resume** in the Atlas UI).

---

### "Error: DISCORD_TOKEN is missing"
The `DISCORD_TOKEN` environment variable is not set.

**Fix:** Add `DISCORD_TOKEN=your-bot-token` to `.env`. Regenerate the token in the Discord Developer Portal if you've lost it — old tokens are immediately invalidated.

---

## 🟡 Slash commands not appearing

### Commands don't show up after the bot starts
Global slash command registration can take **up to 1 hour** to propagate to all Discord clients. This is a Discord API limitation.

**Faster alternative (development):**
- Set `DISCORD_TEST_GUILD_ID=your-server-id` in `.env` — commands will register instantly to that guild only.
- **Do not** set this in production, or commands won't be globally visible.

### Commands appeared in one server but not others
This happens if `DISCORD_TEST_GUILD_ID` was set when the bot was previously deployed. The old guild still has the commands registered locally.

**Fix:** Set `DISCORD_CLEAR_GUILD_IDS=guild-id-1,guild-id-2` in `.env` to clear them on the next startup.

### Commands appear twice (old guild-scoped + new global)
Same root cause as above. Use `DISCORD_CLEAR_GUILD_IDS` to clean up the guild-scoped registration.

---

## 🟡 Moderation commands failing

### "Unknown Member" / moderation action silently fails
The target user has left the server between the time the command was issued and the time the bot tried to apply the action.

**Expected behavior:** The bot will reply with an error message. The moderation case is still logged if the action was partially completed.

### Timeout/ban gives "Missing Permissions"
The bot's role is **below** the target member's highest role in the role hierarchy. Discord prevents bots from moderating members with equal or higher roles.

**Fix:** In **Server Settings → Roles**, drag the `Aegis` role above the roles of members you want it to moderate.

### "You cannot warn/timeout/ban this user — they have a higher or equal role"
This is the hierarchy guard working correctly. The *moderator* running the command also has a lower role than the target.

---

## 🟡 Automod not triggering

### Messages with banned words aren't deleted
1. Run `/automod status` — check that the "Words" rule is **Enabled**.
2. Run `/automod words list` — confirm the word is in the list.
3. Check if the channel or the user's role is exempt: `/automod exempt list`.
4. Confirm the bot has **Manage Messages** permission in that channel.

### Spam detection isn't firing
1. Run `/automod status` — confirm "Spam" is enabled and the threshold looks right.
2. The spam detector uses an in-memory window. It resets on bot restart. After a restart, the counter starts fresh.
3. Bot roles and channel exemptions bypass spam checks.

---

## 🟡 Scheduler / reminders not firing

### A reminder or scheduled message never arrived
1. Check `fly logs` (or console in dev) for `Task <id> failed` or `Task <id> delivered`.
2. If the task exists in DB but no timer ran, the bot may have restarted after the task was created. On next boot, all pending tasks are re-queued from the database automatically.
3. If the bot was offline when the task was due, it will fire immediately on next startup (overdue tasks are caught during init).

### "Task X: maximum retry attempts reached"
The task ran 3 times and failed each time. Likely the target channel was deleted, or the bot lost Send Messages permission.

**Fix:** Cancel the task with `/automation cancel <id>` and recreate it in a valid channel.

---

## 🟡 Welcome messages / auto-roles not working

### New members don't get a welcome message
1. Run `/welcome status` — confirm **Status** is `✅ Enabled` and a **Channel** is set.
2. Check the bot has **Send Messages** and **View Channel** permission in that channel.
3. Welcome messages require the **Server Members Intent** to be enabled in the Discord Developer Portal (Bot → Privileged Gateway Intents).

### Auto-role isn't assigned
1. Run `/welcome status` — confirm **Auto-Role** is set.
2. The bot's role must be **higher** than the auto-role in the role hierarchy.
3. Confirm the bot has **Manage Roles** permission.

---

## 🟡 Suggestions not posting

### `/suggest submit` says "suggestions are not set up"
An admin needs to run `/suggest setup #channel-name` first to designate a suggestions channel.

### Suggestion embed appears but votes don't update
The bot needs **Read Message History** and **View Channel** in the suggestions channel to fetch and edit the message after a vote.

---

## 🟡 Web dashboard issues

### Health endpoint returns 503 or times out
The bot is still starting up (connecting to MongoDB, registering commands). Wait 15–30 seconds and try again.

### Site returns stale content
The web server sets `Cache-Control: no-cache` on HTML pages by default. If you're behind a CDN or Cloudflare, make sure HTML pages are not cached (only static assets should be cached).

### `/stats` returns zeros for guild count
The bot is connected but hasn't joined any guilds yet. Invite it using the OAuth2 URL from `/diagnostics` or the invite link in `.env`.

---

## 🔵 Fly.io deployment issues

### "fly deploy" fails with "image build failed"
Check the Dockerfile for correct Node version. The project requires Node 20+. Verify `node_modules` is listed in `.dockerignore`.

### Bot repeatedly restarts on Fly.io
Check `fly logs` for the crash reason. Common causes:
- Missing secret (DISCORD_TOKEN, MONGO_URI) — run `fly secrets list` to verify they're set.
- Memory exhaustion — upgrade from 256MB to 512MB or 1GB in `fly.toml`.
- MongoDB connection refused — check Atlas IP allowlist includes Fly.io IPs.

### `fly secrets set` shows no confirmation
This is normal. Fly.io silently accepts secrets. Run `fly secrets list` to confirm they appear.

---

## 🔵 Getting more debug info

Set `LOG_LEVEL=debug` in `.env` (or as a Fly.io secret) to see verbose output including:
- Every automod rule evaluation
- Task scheduling and cancellation
- Database query results for configurations
- Slash command registration responses

**Caution:** Debug logs are verbose. Switch back to `info` in production.

---

## Still stuck?

1. Check `fly logs` or the console for the exact error message.
2. Open an issue on the repository with the error, environment (local/fly), and steps to reproduce.
3. Join the support server: `SUPPORT_SERVER_URL` in your `.env`.
