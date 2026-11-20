/**
 * Shared-secret checks for AegisDB and the backend stats endpoint.
 * One variable, AEGIS_BACKEND_SECRET, is used by the bot and this engine.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";

/** True only when BOT_ENV (else NODE_ENV) says development or test. */
export function isDevEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  const mode = env.BOT_ENV || env.NODE_ENV || "";
  return mode === "development" || mode === "test";
}

/** Constant-time comparison (hashing first makes the lengths equal). */
export function constantTimeEquals(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b) && provided.length === expected.length;
}

/** The secret a request presents in `x-aegis-secret` or `Authorization: Bearer`. */
export function presentedSecret(headers: IncomingHttpHeaders): string {
  const header = headers["x-aegis-secret"];
  if (typeof header === "string" && header) return header;
  const auth = headers.authorization;
  return typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

/**
 * Whether a request carries the admin secret. With `allowWhenUnset`, an empty
 * configured secret lets everything through (development only: the server
 * refuses to start without a secret elsewhere).
 */
export function isAuthorized(headers: IncomingHttpHeaders, secret: string, allowWhenUnset = false): boolean {
  if (!secret) return allowWhenUnset;
  const provided = presentedSecret(headers);
  return provided.length > 0 && constantTimeEquals(provided, secret);
}
