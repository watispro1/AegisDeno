/**
 * Discord OAuth2 (authorization code grant) with built-in fetch. Scopes are
 * `identify guilds`. Tokens are returned to the caller and never logged.
 */
import type { DashboardConfig } from "./config";
import type { OAuthGuild } from "./permissions";

export const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
export const DISCORD_API = "https://discord.com/api/v10";
export const OAUTH_SCOPES = "identify guilds";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface TokenResult {
  accessToken: string;
  expiresInSeconds: number;
  scope: string;
}

export interface DiscordUser {
  id: string;
  username: string;
  globalName: string | null;
  /** Avatar hash (validated), for the Discord CDN; null for the default avatar. */
  avatar?: string | null;
}

export class DiscordOAuthError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "DiscordOAuthError";
  }
}

export function authorizeUrl(cfg: DashboardConfig, state: string): string {
  const url = new URL(DISCORD_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("scope", OAUTH_SCOPES);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

function basicAuth(cfg: DashboardConfig): string {
  return `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")}`;
}

async function readJson(res: Response, what: string): Promise<Record<string, unknown>> {
  if (!res.ok) {
    // Discord error bodies can echo request details; keep only the status.
    throw new DiscordOAuthError(`${what} failed with HTTP ${res.status}`, res.status);
  }
  const body = (await res.json().catch(() => null)) as unknown;
  if (!body || typeof body !== "object") throw new DiscordOAuthError(`${what} returned an unreadable body`, res.status);
  return body as Record<string, unknown>;
}

export async function exchangeCode(cfg: DashboardConfig, code: string, fetchImpl: FetchLike = fetch): Promise<TokenResult> {
  const res = await fetchImpl(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuth(cfg),
      Accept: "application/json",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: cfg.redirectUri }).toString(),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await readJson(res, "Token exchange");
  const accessToken = typeof body.access_token === "string" ? body.access_token : "";
  const scope = typeof body.scope === "string" ? body.scope : "";
  if (!accessToken) throw new DiscordOAuthError("Token exchange returned no access token", res.status);
  const scopes = new Set(scope.split(/\s+/));
  if (!scopes.has("identify") || !scopes.has("guilds")) {
    throw new DiscordOAuthError("Discord did not grant the identify and guilds scopes", 400);
  }
  const expires = Number(body.expires_in);
  return { accessToken, scope, expiresInSeconds: Number.isFinite(expires) && expires > 0 ? expires : 3600 };
}

export async function fetchUser(accessToken: string, fetchImpl: FetchLike = fetch): Promise<DiscordUser> {
  const res = await fetchImpl(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  const body = await readJson(res, "User lookup");
  if (typeof body.id !== "string" || !/^\d{17,20}$/.test(body.id)) throw new DiscordOAuthError("User lookup returned no ID", res.status);
  return {
    id: body.id,
    username: typeof body.username === "string" ? body.username : "unknown",
    globalName: typeof body.global_name === "string" ? body.global_name : null,
    avatar: typeof body.avatar === "string" && /^(a_)?[0-9a-f]{32}$/.test(body.avatar) ? body.avatar : null,
  };
}

export async function fetchUserGuilds(accessToken: string, fetchImpl: FetchLike = fetch): Promise<OAuthGuild[]> {
  const res = await fetchImpl(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new DiscordOAuthError(`Guild list failed with HTTP ${res.status}`, res.status);
  const body = (await res.json().catch(() => null)) as unknown;
  if (!Array.isArray(body)) throw new DiscordOAuthError("Guild list returned an unreadable body", res.status);
  return body.flatMap((g) => {
    if (!g || typeof g !== "object") return [];
    const o = g as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.name !== "string") return [];
    return [{
      id: o.id,
      name: o.name.slice(0, 100),
      icon: typeof o.icon === "string" ? o.icon : null,
      owner: o.owner === true,
      permissions: typeof o.permissions === "string" ? o.permissions : "0",
    }];
  });
}

/** Best effort: tell Discord to drop the token on logout. Errors are swallowed. */
export async function revokeToken(cfg: DashboardConfig, accessToken: string, fetchImpl: FetchLike = fetch): Promise<void> {
  await fetchImpl(`${DISCORD_API}/oauth2/token/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basicAuth(cfg) },
    body: new URLSearchParams({ token: accessToken, token_type_hint: "access_token" }).toString(),
    signal: AbortSignal.timeout(5_000),
  }).catch(() => null);
}
