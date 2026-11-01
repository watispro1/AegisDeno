/**
 * Public URLs the bot links to from embeds and buttons.
 *
 * The website, support server and invite are deployment settings, not code.
 * Every link is built here so moving to a new domain, or pointing at a staging
 * site, is an environment change instead of a find-and-replace across commands.
 */

const DEFAULT_SITE_URL = "https://aegisdeno.fly.dev";
const DEFAULT_SUPPORT_URL = "https://discord.gg/DkZUgm3q4F";

/** Accept only http(s) URLs; anything malformed falls back instead of shipping a broken button. */
function normalizeHttpUrl(value: string | undefined, fallback: string): string {
  const raw = (value ?? "").trim();
  if (!raw) return fallback;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return fallback;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

/** Origin the public site is served from. `SITE_URL`, or the production default. */
export function siteBaseUrl(): string {
  return normalizeHttpUrl(process.env.SITE_URL, DEFAULT_SITE_URL);
}

/** Support server invite. `SUPPORT_SERVER_URL`, or the production default. */
export function supportServerUrl(): string {
  return normalizeHttpUrl(process.env.SUPPORT_SERVER_URL, DEFAULT_SUPPORT_URL);
}

/** Absolute link to a path on the public site. */
export function siteUrl(pathname = "/"): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${siteBaseUrl()}${path}`;
}

/** Docs page, optionally deep-linked to a section anchor (e.g. "permissions"). */
export function docsUrl(anchor?: string): string {
  return siteUrl(`/docs${anchor ? `#${anchor}` : ""}`);
}

/** Command reference entry. `subpath` mirrors the command's subcommand path. */
export function commandUrl(name: string, subpath = ""): string {
  const parts = [name, ...subpath.split(/\s+/).filter(Boolean)];
  return siteUrl(`/commands#cmd-${parts.join("-")}`);
}

/** Dashboard overview: the guild picker, or one server's overview page. */
export function dashboardUrl(guildId?: string): string {
  if (!guildId) return siteUrl("/dashboard");
  return siteUrl(`/dashboard/${encodeURIComponent(guildId)}`);
}

/** Case list for a guild, optionally filtered to one member. */
export function caseListUrl(guildId: string, userId?: string): string {
  const base = siteUrl(`/dashboard/${encodeURIComponent(guildId)}/cases`);
  return userId ? `${base}?user=${encodeURIComponent(userId)}` : base;
}

/** A single case or warning. */
export function caseUrl(guildId: string, caseId: string): string {
  return siteUrl(`/dashboard/${encodeURIComponent(guildId)}/cases/${encodeURIComponent(caseId)}`);
}

/**
 * Bot invite. `BOT_INVITE_URL` when it is a usable https link, otherwise the
 * site's `/invite` route, which redirects to Discord's authorize page.
 */
export function inviteUrl(): string {
  const configured = (process.env.BOT_INVITE_URL ?? "").trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:") return url.toString();
    } catch {
      // Fall through to the site redirect.
    }
  }
  return siteUrl("/invite");
}

/** Docs anchors used by /help and permission errors. */
export const DOC_ANCHORS = {
  quickstart: "quickstart",
  permissions: "permissions",
  moderation: "moderation",
  cases: "cases",
  escalation: "escalation",
  channelTools: "channel-tools",
  automod: "automod",
  trustscore: "trustscore",
  appeal: "appeal",
  watchlist: "watchlist",
  modreport: "modreport",
  logging: "logging",
  tickets: "tickets",
  verification: "verification",
  community: "community",
  welcome: "welcome",
  rolePanels: "role-panels",
  autoresponder: "autoresponder",
  automation: "automation",
  starboard: "starboard",
  pollsGiveaways: "polls-giveaways",
  suggestions: "suggestions",
  configuration: "configuration",
  selfHosting: "self-hosting",
  troubleshooting: "troubleshooting",
} as const;
