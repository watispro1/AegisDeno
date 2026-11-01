/**
 * Response security headers for every route on the site and dashboard.
 * Pure, so the exact values are unit-tested.
 *
 * The CSP needs no 'unsafe-inline' anywhere: every page loads its CSS and JS
 * from /assets, no element carries a style= or on*= attribute, and the only
 * inline <script> is JSON-LD (a data block browsers never execute).
 */
import { timingSafeEqual } from "node:crypto";

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  // Discord's CDN only, for real avatars and server icons on the dashboard.
  "img-src 'self' data: https://cdn.discordapp.com",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "media-src 'none'",
  "worker-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** Paths other sites may legitimately embed or fetch (share images, the public JSON API). */
export function isCrossOriginResource(path: string): boolean {
  return path.startsWith("/api/") || path === "/api" || /^\/assets\/(og\.(png|svg)|favicon\.svg)$/.test(path);
}

export function securityHeaders(path: string): Record<string, string> {
  return {
    "Content-Security-Policy": CONTENT_SECURITY_POLICY,
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), browsing-topics=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": isCrossOriginResource(path) ? "cross-origin" : "same-origin",
    "X-Permitted-Cross-Domain-Policies": "none",
    "Origin-Agent-Cluster": "?1",
    "X-DNS-Prefetch-Control": "off",
  };
}

/** Constant-time comparison for shared secrets such as the Top.gg webhook Authorization header. */
export function secretMatches(received: unknown, expected: string): boolean {
  if (typeof received !== "string" || !expected) return false;
  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

/** The client address for rate limiting: Fly's Fly-Client-IP, else the socket address. */
export function clientIp(req: { headers: Record<string, string | string[] | undefined>; ip?: string; socket?: { remoteAddress?: string } }): string {
  const fly = req.headers["fly-client-ip"];
  if (typeof fly === "string" && fly.length > 0 && fly.length <= 64) return fly;
  return req.ip || req.socket?.remoteAddress || "unknown";
}

/** A same-site path for a redirect built from user input: anything that could leave the site falls back. */
export function safeLocalPath(candidate: string, fallback = "/"): string {
  if (typeof candidate !== "string" || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\")) return fallback;
  if (/[\r\n\t\0]/.test(candidate)) return fallback;
  return candidate;
}
