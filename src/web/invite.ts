/**
 * Bot invite links. Every "Add to Discord" / "Add Aegis" button is a plain
 * https link to Discord's own authorize page, so it works without JavaScript,
 * passes the site's CSP and opens in the browser on desktop and mobile.
 * Discord's page offers to continue in the app itself.
 *
 * - `integration_type=0` asks for a server install. The application also
 *   allows user installs, and without this Discord shows its "Add App" flow,
 *   which hands off to the Discord app ("Opening Discord app") and can stall
 *   when the app does not pick it up.
 * - `scope` is `bot applications.commands`, written with `%20` (not `+`).
 * - `response_type` and `redirect_uri` are dropped: the bot invite needs no
 *   code grant, and a redirect URI Discord does not know makes the page fail.
 * - Only https links on discord.com are accepted from `BOT_INVITE_URL`; anything
 *   else (a `discord://` link, a typo) falls back to the standard URL.
 */

export const DISCORD_INVITE_BASE = "https://discord.com/oauth2/authorize";
export const INVITE_SCOPES = "bot applications.commands";
const DISCORD_HOSTS = new Set(["discord.com", "www.discord.com", "discordapp.com", "ptb.discord.com", "canary.discord.com"]);
const SNOWFLAKE = /^\d{17,20}$/;

/** Serialise search params with `%20` for spaces instead of `+`. */
function withParams(url: URL, params: URLSearchParams): string {
  url.search = params.toString().replace(/\+/g, "%20");
  return url.toString();
}

function parseDiscordUrl(value: string | undefined): URL | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !DISCORD_HOSTS.has(url.hostname.toLowerCase())) return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * The site-wide invite URL. Returns "#" when nothing usable is configured
 * (no application ID and no valid BOT_INVITE_URL).
 */
export function buildInviteUrl(opts: { appId?: string; permissions: string; configured?: string }): string {
  const appId = (opts.appId ?? "").trim();
  const configured = parseDiscordUrl(opts.configured);
  if (!appId && !configured) return "#";

  const url = configured ?? new URL(DISCORD_INVITE_BASE);
  const params = new URLSearchParams(url.search);
  params.delete("response_type");
  params.delete("redirect_uri");
  if (appId) {
    params.set("client_id", appId);
    params.set("permissions", opts.permissions);
    params.set("scope", INVITE_SCOPES);
  }
  if (!params.get("client_id")) return "#";
  if (!params.get("scope")) params.set("scope", INVITE_SCOPES);
  params.set("integration_type", "0");
  return withParams(url, params);
}

/** Invite URL preselecting one server. Returns null when no base invite is configured or the id is invalid. */
export function guildInviteUrl(baseInviteUrl: string, guildId: string): string | null {
  if (!SNOWFLAKE.test(guildId)) return null;
  const url = parseDiscordUrl(baseInviteUrl);
  if (!url) return null;
  const params = new URLSearchParams(url.search);
  if (!params.get("client_id")) return null;
  params.set("guild_id", guildId);
  params.set("disable_guild_select", "true");
  if (!params.get("integration_type")) params.set("integration_type", "0");
  return withParams(url, params);
}
