/**
 * Express middleware shared by the site: the final error handler, the /api
 * rate limiter, gzip compression and the precompressed static assets. Split
 * out of server.ts.
 */
import { createHash } from "node:crypto";
import { gzip, gzipSync } from "node:zlib";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";
import { clientIp } from "./securityHeaders";

const COMPRESSIBLE = /^(text\/|application\/(json|xml|manifest\+json|atom\+xml|rss\+xml)|image\/svg)/;
/**
 * Bodies smaller than this are sent as they are: gzip's header and the CPU
 * cost outweigh the saving, and tiny bodies can even grow.
 */
export const GZIP_MIN_BYTES = 1024;

/**
 * Cache-Control for a static asset. Pages link assets with ?v=<content hash>,
 * so a request carrying the current hash may be cached for a year as
 * immutable. Anything else (no ?v=, or a hash from an older deploy, which now
 * gets the new content) is cached briefly, so a deploy is never hidden
 * behind a year-long cache entry under the wrong key.
 */
export function assetCacheControl(requestedVersion: unknown, currentVersion: string, maxAgeSeconds: number): string {
  if (typeof requestedVersion === "string" && requestedVersion === currentVersion) return `public, max-age=${maxAgeSeconds}, immutable`;
  return `public, max-age=${Math.min(maxAgeSeconds, 3600)}`;
}
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

/**
 * Tell crawlers not to index API, health, and /dashboard paths.
 * Robots.txt is advisory; X-Robots-Tag is enforced per-response.
 */
export function robotsNoIndex(req: Request, res: Response, next: NextFunction): void {
  const p = req.path;
  if (p.startsWith("/api/") || p === "/health" || p.startsWith("/dashboard")) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
  }
  next();
}

/** Async gzip on libuv's threadpool, so a large page never blocks the event loop. */
export function gzipAsync(body: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => gzip(body, { level: 6 }, (err, out) => (err ? reject(err) : resolve(out))));
}

/**
 * Gzip text responses. Fly terminates TLS and does not compress upstream.
 * Compression runs on the threadpool (zlib.gzip, never gzipSync); bodies under
 * GZIP_MIN_BYTES and responses that already carry a Content-Encoding (the
 * precompressed assets) are sent as they are.
 */
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
    if (Buffer.byteLength(body, "utf8") < GZIP_MIN_BYTES) {
      return original(body);
    }

    gzipAsync(Buffer.from(body, "utf8")).then(
      (packed) => {
        if (this.headersSent) return;
        this.setHeader("Content-Encoding", "gzip");
        this.setHeader("Content-Length", String(packed.byteLength));
        original(packed);
      },
      (err) => {
        logger.warn(`gzip failed for ${req.path}, sending uncompressed: ${(err as Error)?.message ?? err}`);
        if (!this.headersSent) original(body);
      },
    );
    return this;
  };

  next();
}

/** A static asset prepared once at boot: raw and gzipped bytes plus a content-hash ETag. */
export interface StaticAsset {
  type: string;
  raw: Buffer;
  /** Gzipped bytes, or null when gzip would not help (binary or tiny). */
  gz: Buffer | null;
  /** Strong ETag from the content hash, quoted. */
  etag: string;
}

/**
 * Build a StaticAsset. Gzip runs here, once per process (synchronously, at
 * startup, before the server listens), never per request.
 */
export function prepareAsset(type: string, body: string | Buffer): StaticAsset {
  const raw = typeof body === "string" ? Buffer.from(body, "utf8") : body;
  const etag = `"${createHash("sha256").update(raw).digest("base64url").slice(0, 22)}"`;
  let gz: Buffer | null = null;
  if (COMPRESSIBLE.test(type) && raw.byteLength >= GZIP_MIN_BYTES) {
    const packed = gzipSync(raw, { level: 9 });
    if (packed.byteLength < raw.byteLength) gz = packed;
  }
  return { type, raw, gz, etag };
}

/** Whether an If-None-Match header matches this ETag (strong or weak form, lists, or *). */
export function etagMatches(ifNoneMatch: string | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;
  if (ifNoneMatch.trim() === "*") return true;
  return ifNoneMatch.split(",").some(t => t.trim().replace(/^W\//, "") === etag);
}

/**
 * Serve a prepared asset: 304 on a matching ETag, the gzipped bytes when the
 * client accepts gzip, otherwise the raw bytes. Writes the bytes itself, so the
 * runtime compression() never touches them.
 */
export function sendAsset(req: Request, res: Response, asset: StaticAsset, cacheControl: string): void {
  res.setHeader("Cache-Control", cacheControl);
  res.setHeader("ETag", asset.etag);
  res.setHeader("Content-Type", /^(text\/|application\/(javascript|json|manifest\+json)|image\/svg)/.test(asset.type) ? `${asset.type}; charset=utf-8` : asset.type);
  if (asset.gz) res.setHeader("Vary", "Accept-Encoding");
  if (etagMatches(typeof req.headers["if-none-match"] === "string" ? req.headers["if-none-match"] : undefined, asset.etag)) {
    res.status(304).end();
    return;
  }
  const useGz = asset.gz !== null && /\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""));
  const body = useGz ? asset.gz! : asset.raw;
  if (useGz) res.setHeader("Content-Encoding", "gzip");
  res.setHeader("Content-Length", String(body.byteLength));
  res.status(200);
  if (req.method === "HEAD") res.end();
  else res.end(body);
}

/**
 * Short-lived cache of rendered public HTML. Keys must include every input
 * that changes the markup (path, query, flags). Size-bounded so random query
 * strings cannot grow it without limit. Never used for /dashboard or any
 * response that reads a cookie.
 */
export class HtmlCache {
  private readonly entries = new Map<string, { html: string; gz?: Buffer; expiresAt: number }>();
  constructor(private readonly ttlMs: number, private readonly maxEntries = 200, private readonly now: () => number = Date.now) {}

  private live(key: string) {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (this.now() >= hit.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return hit;
  }

  get(key: string): string | undefined {
    return this.live(key)?.html;
  }

  /** The entry's gzipped bytes, once a gzip-accepting request has produced them. */
  getGzip(key: string): Buffer | undefined {
    return this.live(key)?.gz;
  }

  /** Attach gzipped bytes to a live entry (ignored if it expired or was replaced meanwhile). */
  setGzip(key: string, html: string, gz: Buffer): void {
    const hit = this.live(key);
    if (hit && hit.html === html) hit.gz = gz;
  }

  set(key: string, html: string): void {
    this.entries.delete(key);
    this.entries.set(key, { html, expiresAt: this.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}

/** Stable cache key for a public page: path plus the sorted query string plus any extra varying inputs. */
export function htmlCacheKey(path: string, query: Record<string, unknown>, extra: ReadonlyArray<string | number | boolean> = []): string {
  const q = Object.keys(query).sort().map(k => {
    const v = query[k];
    return `${encodeURIComponent(k)}=${(Array.isArray(v) ? v : [v]).map(x => encodeURIComponent(String(x))).join(",")}`;
  }).join("&");
  return `${path}?${q}#${extra.join("|")}`;
}
