/**
 * Express middleware shared by the site: the final error handler, the /api
 * rate limiter and gzip compression. Split out of server.ts.
 */
import { gzipSync } from "node:zlib";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";
import { clientIp } from "./securityHeaders";

const COMPRESSIBLE = /^(text\/|application\/(json|xml|manifest\+json|atom\+xml|rss\+xml)|image\/svg)/;
/**
 * Final Express error handler: logs the error server-side and answers with a
 * generic message (JSON under /api, plain text elsewhere). Never echoes the
 * error, its message or a stack trace.
 */
export function siteErrorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const status = typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : 500;
  const code = status >= 400 && status < 600 ? status : 500;
  if (code >= 500) logger.error(`Web error on ${req.method} ${req.path}:`, err instanceof Error ? err.message : err);
  if (res.headersSent) return;
  res.setHeader("Cache-Control", "no-store");
  if (req.path.startsWith("/api/")) {
    res.status(code).json({ error: code === 413 ? "payload_too_large" : code === 400 ? "bad_request" : "server_error" });
    return;
  }
  res.status(code).type("text/plain").send(code === 413 ? "Request too large" : code === 400 ? "Bad request" : "Something went wrong");
}

const RATE_WINDOW_MS = 60_000;
const API_REQUESTS_PER_WINDOW = 120;
const requestCounts = new Map<string, { count: number; windowStartedAt: number }>();

export function apiRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  // Behind Fly's proxy req.ip is the proxy, so every visitor shared one bucket.
  const key = clientIp(req);
  const current = requestCounts.get(key);
  const entry = !current || now - current.windowStartedAt >= RATE_WINDOW_MS
    ? { count: 0, windowStartedAt: now }
    : current;
  entry.count++;
  requestCounts.set(key, entry);
  if (requestCounts.size > 10_000) {
    for (const [address, value] of requestCounts) {
      if (now - value.windowStartedAt >= RATE_WINDOW_MS) requestCounts.delete(address);
    }
  }
  if (entry.count > API_REQUESTS_PER_WINDOW) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "rate_limited" });
    return;
  }
  next();
}

/** Gzip text responses. Fly terminates TLS and does not compress upstream. */
export function compression(req: Request, res: Response, next: NextFunction): void {
  const accepted = String(req.headers["accept-encoding"] ?? "");
  res.setHeader("Vary", "Accept-Encoding");

  if (!accepted.includes("gzip")) {
    next();
    return;
  }

  const original = res.send.bind(res) as (body?: unknown) => Response;

  res.send = function send(this: Response, body?: unknown): Response {
    if (this.headersSent || typeof body !== "string" || this.getHeader("Content-Encoding")) {
      return original(body);
    }
    if (!COMPRESSIBLE.test(String(this.getHeader("Content-Type") ?? ""))) {
      return original(body);
    }

    const packed = gzipSync(Buffer.from(body, "utf8"), { level: 6 });
    this.setHeader("Content-Encoding", "gzip");
    this.setHeader("Content-Length", String(packed.byteLength));
    return original(packed);
  };

  next();
}

