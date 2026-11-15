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

/**
 * The dashboard's Premium page (and its portal form) only: the same policy
 * plus exactly what Paddle.js needs for the overlay checkout. Still no
 * 'unsafe-inline' anywhere. Paddle.js tries to set inline style attributes on
 * its overlay frame; those are refused, and site.css positions the frame
 * instead (theme/premium.ts).
 */
export const PREMIUM_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://cdn.paddle.com",
  "style-src 'self' https://cdn.paddle.com https://sandbox-cdn.paddle.com",
  "img-src 'self' data: https://cdn.discordapp.com https://cdn.paddle.com https://sandbox-cdn.paddle.com",
  "font-src 'self'",
  "connect-src 'self' https://*.paddle.com",
  "manifest-src 'self'",
  "media-src 'none'",
  "worker-src 'none'",
  "object-src 'none'",
  // The checkout frame, and Paddle's error page if the checkout cannot load.
  "frame-src https://buy.paddle.com https://sandbox-buy.paddle.com https://cdn.paddle.com https://sandbox-cdn.paddle.com",
  "base-uri 'none'",
  // The portal form posts here and is redirected to Paddle's customer portal.
  "form-action 'self' https://customer-portal.paddle.com https://sandbox-customer-portal.paddle.com",
  "frame-ancestors 'none'",
].join("; ");

/** /dashboard/<server ID>/premium and /dashboard/<server ID>/premium/portal. */
export function isPremiumCheckoutPath(path: string): boolean {
  return /^\/dashboard\/\d{17,20}\/premium(\/portal)?\/?$/.test(path);
}

const PERMISSIONS_POLICY = "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), browsing-topics=()";
/** Apple Pay and Google Pay inside Paddle's checkout frame need the payment feature delegated to it. */
const PREMIUM_PERMISSIONS_POLICY = PERMISSIONS_POLICY.replace("payment=()", 'payment=(self "https://buy.paddle.com" "https://sandbox-buy.paddle.com")');

/** Paths other sites may legitimately embed or fetch (share images, status badges, the public JSON API). */
export function isCrossOriginResource(path: string): boolean {
  return path.startsWith("/api/") || path === "/api" || path.startsWith("/badge/") || /^\/assets\/(og\.(png|svg)|favicon\.svg)$/.test(path);
}

export function securityHeaders(path: string): Record<string, string> {
  const premium = isPremiumCheckoutPath(path);
  return {
    "Content-Security-Policy": premium ? PREMIUM_CONTENT_SECURITY_POLICY : CONTENT_SECURITY_POLICY,
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": premium ? PREMIUM_PERMISSIONS_POLICY : PERMISSIONS_POLICY,
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
