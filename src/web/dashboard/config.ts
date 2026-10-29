/**
 * Dashboard configuration from the environment. When any required value is
 * missing the dashboard is off: its routes show a "not configured" page and
 * nothing else on the site changes.
 */
export const DEFAULT_REDIRECT_URI = "https://aegisdeno.fly.dev/dashboard/callback";

export interface DashboardConfig {
  clientId: string;
  clientSecret: string;
  sessionSecret: string;
  redirectUri: string;
  /** Origin of the redirect URI; POSTs with any other Origin header are refused. */
  origin: string;
  /** Cookies get the Secure flag unless the dashboard runs on plain http (local testing). */
  secureCookies: boolean;
}

/** Shortest session secret accepted; `openssl rand -hex 32` gives 64 characters. */
export const MIN_SESSION_SECRET_LENGTH = 32;

export function readDashboardConfig(env: NodeJS.ProcessEnv = process.env): DashboardConfig | null {
  const clientId = env.DISCORD_APPLICATION_ID?.trim() ?? "";
  const clientSecret = env.DISCORD_CLIENT_SECRET?.trim() ?? "";
  const sessionSecret = env.DASHBOARD_SESSION_SECRET?.trim() ?? "";
  const redirectUri = env.DASHBOARD_REDIRECT_URI?.trim() || DEFAULT_REDIRECT_URI;

  if (!clientId || !clientSecret || sessionSecret.length < MIN_SESSION_SECRET_LENGTH) return null;

  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  return {
    clientId,
    clientSecret,
    sessionSecret,
    redirectUri: url.toString(),
    origin: url.origin,
    secureCookies: url.protocol === "https:",
  };
}

/** Why the dashboard is off, in words an operator can act on. Never includes values. */
export function missingDashboardSettings(env: NodeJS.ProcessEnv = process.env): string[] {
  const missing: string[] = [];
  if (!env.DISCORD_APPLICATION_ID?.trim()) missing.push("DISCORD_APPLICATION_ID");
  if (!env.DISCORD_CLIENT_SECRET?.trim()) missing.push("DISCORD_CLIENT_SECRET");
  const secret = env.DASHBOARD_SESSION_SECRET?.trim() ?? "";
  if (secret.length < MIN_SESSION_SECRET_LENGTH) missing.push("DASHBOARD_SESSION_SECRET (at least 32 characters)");
  const redirect = env.DASHBOARD_REDIRECT_URI?.trim();
  if (redirect) {
    try {
      const u = new URL(redirect);
      if (u.protocol !== "https:" && u.protocol !== "http:") missing.push("DASHBOARD_REDIRECT_URI (must be http or https)");
    } catch {
      missing.push("DASHBOARD_REDIRECT_URI (not a valid URL)");
    }
  }
  return missing;
}
