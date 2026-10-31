/**
 * Pure security helpers for the web dashboard: signed cookies, CSRF tokens,
 * OAuth state and a small fixed-window rate limiter. No Express, no Mongo, so
 * everything here is unit-tested directly.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Cookie names on plain-http (local) dashboards, and the legacy https name migrated on first visit. */
export const SESSION_COOKIE = "aegis_dash";
export const STATE_COOKIE = "aegis_oauth";
/**
 * Cookie names over https. The __Host- prefix makes the browser refuse the
 * cookie unless it is Secure, has Path=/ and no Domain, so a sibling subdomain
 * or a plain-http response can never set or shadow it.
 */
export const HOST_SESSION_COOKIE = "__Host-aegis_dash";
export const HOST_STATE_COOKIE = "__Host-aegis_oauth";

export interface CookieNames {
  session: string;
  state: string;
  path: string;
}

/** Which cookie names and path the dashboard uses: __Host- names on https, plain names under /dashboard on http. */
export function cookieNames(secure: boolean): CookieNames {
  return secure
    ? { session: HOST_SESSION_COOKIE, state: HOST_STATE_COOKIE, path: "/" }
    : { session: SESSION_COOKIE, state: STATE_COOKIE, path: "/dashboard" };
}
/** Absolute session lifetime. The Mongo TTL index uses the same value. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** How long a login attempt may take between /login and /callback. */
export const STATE_TTL_MS = 10 * 60 * 1000;

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function hmac(secret: string, purpose: string, value: string): string {
  return b64url(createHmac("sha256", secret).update(`${purpose}\n${value}`).digest());
}

/** Constant-time string comparison that tolerates different lengths. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(String(a), "utf8");
  const right = Buffer.from(String(b), "utf8");
  if (left.length !== right.length) {
    // Still spend the comparison so length is the only thing that leaks.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

/** 32 random bytes, base64url. Used for session IDs and OAuth state. */
export function randomToken(bytes = 32): string {
  return b64url(randomBytes(bytes));
}

/** Session IDs are stored hashed so a database read alone cannot replay a cookie. */
export function hashSessionId(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex");
}

/* ── Signed session cookie ─────────────────────────────────────────── */

export function signSessionId(secret: string, sessionId: string): string {
  return `${sessionId}.${hmac(secret, "session", sessionId)}`;
}

/** Returns the session ID when the signature matches, otherwise null. */
export function verifySessionCookie(secret: string, value: string | undefined | null): string | null {
  if (!value || typeof value !== "string" || value.length > 200) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const sessionId = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(sessionId)) return null;
  return safeEqual(signature, hmac(secret, "session", sessionId)) ? sessionId : null;
}

/* ── CSRF ───────────────────────────────────────────────────────────── */

/**
 * The CSRF token is an HMAC of the session ID, so it is stable for a session,
 * needs no storage, and is useless for any other session.
 */
export function csrfToken(secret: string, sessionId: string): string {
  return hmac(secret, "csrf", sessionId);
}

export function verifyCsrf(secret: string, sessionId: string, submitted: unknown): boolean {
  if (typeof submitted !== "string" || submitted.length === 0 || submitted.length > 100) return false;
  return safeEqual(submitted, csrfToken(secret, sessionId));
}

/**
 * Browsers send Origin on every cross-site POST. When it is present it must be
 * our own origin; when it is absent we rely on the CSRF token alone.
 */
export function originAllowed(originHeader: string | undefined, allowedOrigin: string): boolean {
  if (!originHeader) return true;
  return originHeader === allowedOrigin;
}

/* ── OAuth state ────────────────────────────────────────────────────── */

/**
 * The state value goes to Discord in the authorize URL; a signed copy with an
 * expiry is kept in a short-lived cookie and compared on the callback.
 */
export function createOAuthState(secret: string, nowMs: number = Date.now()): { state: string; cookie: string } {
  const state = randomToken(24);
  const expires = String(nowMs + STATE_TTL_MS);
  const payload = `${state}.${expires}`;
  return { state, cookie: `${payload}.${hmac(secret, "state", payload)}` };
}

export function verifyOAuthState(
  secret: string,
  cookieValue: string | undefined | null,
  returnedState: unknown,
  nowMs: number = Date.now(),
): boolean {
  if (!cookieValue || typeof returnedState !== "string" || returnedState.length === 0) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 3) return false;
  const [state, expires, signature] = parts;
  if (!safeEqual(signature, hmac(secret, "state", `${state}.${expires}`))) return false;
  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || nowMs > expiresAt) return false;
  return safeEqual(returnedState, state);
}

/* ── Cookies ────────────────────────────────────────────────────────── */

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    const raw = part.slice(eq + 1).trim();
    if (!name || name in out) continue;
    try {
      out[name] = decodeURIComponent(raw);
    } catch {
      out[name] = raw;
    }
  }
  return out;
}

export interface CookieOptions {
  maxAgeSeconds: number;
  secure: boolean;
  path?: string;
}

export function serializeCookie(name: string, value: string, opts: CookieOptions): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${opts.path ?? "/dashboard"}`,
    `Max-Age=${Math.max(0, Math.floor(opts.maxAgeSeconds))}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

/* ── Rate limiting ──────────────────────────────────────────────────── */

export class RateLimiter {
  private readonly hits = new Map<string, { count: number; start: number }>();

  constructor(private readonly limit: number, private readonly windowMs: number, private readonly maxKeys = 10_000) {}

  /** Count one request for `key`. Returns whether it is allowed and, if not, seconds to wait. */
  hit(key: string, nowMs: number = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
    const current = this.hits.get(key);
    const entry = !current || nowMs - current.start >= this.windowMs ? { count: 0, start: nowMs } : current;
    entry.count++;
    this.hits.set(key, entry);
    if (this.hits.size > this.maxKeys) this.prune(nowMs);
    if (entry.count > this.limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.start + this.windowMs - nowMs) / 1000)) };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  private prune(nowMs: number): void {
    for (const [key, value] of this.hits) {
      if (nowMs - value.start >= this.windowMs) this.hits.delete(key);
    }
  }
}
