/**
 * perf/web-serving: precompressed static assets with strong ETags, async gzip
 * for dynamic responses, the public HTML cache, private dashboard caching,
 * the memory-first rate limiter, the cached guild lookups and honest status
 * history gaps.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import {
  assetCacheControl, compression, etagMatches, GZIP_MIN_BYTES, HtmlCache, htmlCacheKey, prepareAsset, sendAsset,
} from "../src/web/serverMiddleware";
import { DASHBOARD_CACHE_CONTROL, createDashboardRouter } from "../src/web/dashboard/router";
import { readDashboardConfig } from "../src/web/dashboard/config";
import { memorySessionStore } from "../src/web/dashboard/sessions";
import { cookieNames, signSessionId } from "../src/web/dashboard/security";
import { rateLimitStoreKind, rateLimitStoreFromEnv } from "../src/web/dashboard/rateLimitStore";
import { cachedBotView, type BotView } from "../src/web/dashboard/botView";
import { buildStatusPayload, historyStart } from "../src/web/statusData";
import { NOT_RECORDED, historyStartLine, renderStatus } from "../src/web/pages/status";
import { registerApiRoutes } from "../src/web/apiRoutes";
import type { DashboardData } from "../src/web/dashboard/data";
import type { SiteConfig } from "../src/web/pages";

const site: SiteConfig = { inviteUrl: "https://discord.com/oauth2/authorize?client_id=1", supportUrl: "", version: "0.0.0", contactEmail: "", assetVersion: "build1" };

async function listen(app: express.Express): Promise<{ server: Server; base: string }> {
  const server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

/** Raw HTTP GET that does not transparently decompress (fetch would). */
async function rawGet(base: string, path: string, headers: Record<string, string> = {}) {
  const http = await import("node:http");
  return new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: Buffer }>((resolve, reject) => {
    http.get(base + path, { headers }, res => {
      const chunks: Buffer[] = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
    }).on("error", reject);
  });
}

test("prepareAsset: gzips text once at boot, keeps binary raw, strong content-hash ETag", () => {
  const css = prepareAsset("text/css", "body{color:red}\n".repeat(500));
  assert.ok(css.gz && css.gz.byteLength < css.raw.byteLength);
  assert.equal(gunzipSync(css.gz!).toString("utf8"), css.raw.toString("utf8"));
  assert.match(css.etag, /^"[A-Za-z0-9_-]{22}"$/);
  assert.equal(prepareAsset("text/css", "body{color:red}\n".repeat(500)).etag, css.etag, "same content, same ETag");
  assert.notEqual(prepareAsset("text/css", "x".repeat(2000)).etag, css.etag);
  assert.equal(prepareAsset("image/png", Buffer.alloc(4096, 1)).gz, null, "binary is never gzipped");
  assert.equal(prepareAsset("text/css", "a{}").gz, null, "tiny assets are not gzipped");
});

test("etagMatches: exact, weak form, lists and *", () => {
  assert.equal(etagMatches(undefined, '"abc"'), false);
  assert.equal(etagMatches('"abc"', '"abc"'), true);
  assert.equal(etagMatches('W/"abc"', '"abc"'), true);
  assert.equal(etagMatches('"x", "abc"', '"abc"'), true);
  assert.equal(etagMatches("*", '"abc"'), true);
  assert.equal(etagMatches('"abd"', '"abc"'), false);
});

test("sendAsset: precompressed gzip, 304 on ETag, immutable only for the current ?v, compression() bypassed", async () => {
  const body = "/* site */\n" + ".card{padding:1rem}\n".repeat(2000);
  const asset = prepareAsset("text/css", body);
  const app = express();
  app.use(compression);
  app.get("/assets/site.css", (req, res) => sendAsset(req, res, asset, assetCacheControl(req.query.v, "build1", 31536000)));
  const { server, base } = await listen(app);
  try {
    const gz = await rawGet(base, "/assets/site.css?v=build1", { "Accept-Encoding": "gzip, br" });
    assert.equal(gz.status, 200);
    assert.equal(gz.headers["content-encoding"], "gzip");
    assert.equal(gz.headers["cache-control"], "public, max-age=31536000, immutable");
    assert.equal(gz.headers.etag, asset.etag);
    assert.match(String(gz.headers.vary), /Accept-Encoding/);
    assert.match(String(gz.headers["content-type"]), /^text\/css; charset=utf-8/);
    assert.ok(gz.body.equals(asset.gz!), "the exact precompressed bytes, not recompressed");
    assert.equal(gunzipSync(gz.body).toString("utf8"), body);

    const plain = await rawGet(base, "/assets/site.css", {});
    assert.equal(plain.headers["content-encoding"], undefined);
    assert.equal(plain.body.toString("utf8"), body);
    assert.equal(plain.headers["cache-control"], "public, max-age=3600", "no ?v: short cache");

    const stale = await rawGet(base, "/assets/site.css?v=old", {});
    assert.doesNotMatch(String(stale.headers["cache-control"]), /immutable/);

    const notModified = await rawGet(base, "/assets/site.css?v=build1", { "If-None-Match": asset.etag, "Accept-Encoding": "gzip" });
    assert.equal(notModified.status, 304);
    assert.equal(notModified.body.byteLength, 0);
    assert.equal(notModified.headers.etag, asset.etag);
  } finally {
    server.close();
  }
});

test("compression: dynamic bodies use async zlib.gzip (never gzipSync) and keep the 1 KB floor", async () => {
  const src = readFileSync(join(__dirname, "..", "src", "web", "serverMiddleware.ts"), "utf8");
  const fn = src.slice(src.indexOf("export function compression("), src.indexOf("/** A static asset prepared once at boot"));
  assert.ok(fn.length > 100);
  assert.doesNotMatch(fn, /gzipSync/, "per-request compression must not block the event loop");
  assert.match(fn, /gzipAsync\(/);

  const app = express();
  app.use(compression);
  const big = "<p>hello</p>".repeat(1000);
  app.get("/big", (_req, res) => { res.type("html").send(big); });
  app.get("/small", (_req, res) => { res.type("html").send("x".repeat(GZIP_MIN_BYTES - 1)); });
  app.get("/json", (_req, res) => { res.json({ items: Array.from({ length: 200 }, (_, i) => ({ i, name: `item-${i}` })) }); });
  const { server, base } = await listen(app);
  try {
    const r = await rawGet(base, "/big", { "Accept-Encoding": "gzip" });
    assert.equal(r.headers["content-encoding"], "gzip");
    assert.equal(Number(r.headers["content-length"]), r.body.byteLength);
    assert.equal(gunzipSync(r.body).toString("utf8"), big);
    const small = await rawGet(base, "/small", { "Accept-Encoding": "gzip" });
    assert.equal(small.headers["content-encoding"], undefined);
    const json = await rawGet(base, "/json", { "Accept-Encoding": "gzip" });
    assert.equal(json.headers["content-encoding"], "gzip");
    assert.equal(JSON.parse(gunzipSync(json.body).toString("utf8")).items.length, 200);
    const identity = await rawGet(base, "/big", {});
    assert.equal(identity.headers["content-encoding"], undefined);
    assert.equal(identity.body.toString("utf8"), big);
  } finally {
    server.close();
  }
});

test("HtmlCache: TTL, size bound, and keys that cover every varying input", () => {
  let now = 1_000;
  const cache = new HtmlCache(45_000, 3, () => now);
  cache.set("a", "<a>");
  assert.equal(cache.get("a"), "<a>");
  now += 44_999;
  assert.equal(cache.get("a"), "<a>");
  now += 1;
  assert.equal(cache.get("a"), undefined, "expired at the TTL");
  for (const k of ["1", "2", "3", "4"]) cache.set(k, k);
  assert.equal(cache.size, 3);
  assert.equal(cache.get("1"), undefined, "oldest evicted at the bound");

  cache.set("p", "<p>page</p>");
  assert.equal(cache.getGzip("p"), undefined);
  cache.setGzip("p", "<p>other</p>", Buffer.from("x"));
  assert.equal(cache.getGzip("p"), undefined, "bytes for different html are ignored");
  cache.setGzip("p", "<p>page</p>", Buffer.from("gz"));
  assert.equal(cache.getGzip("p")?.toString(), "gz", "gzipped once, reused");
  now += 45_000;
  assert.equal(cache.getGzip("p"), undefined, "expires with the page");

  assert.equal(htmlCacheKey("/commands", { b: "2", a: "1" }), htmlCacheKey("/commands", { a: "1", b: "2" }), "query order does not matter");
  assert.notEqual(htmlCacheKey("/commands", { q: "ban" }), htmlCacheKey("/commands", {}));
  assert.notEqual(htmlCacheKey("/", {}, [true]), htmlCacheKey("/", {}, [false]), "online flag is part of the key");
  assert.notEqual(htmlCacheKey("/docs", {}), htmlCacheKey("/features", {}));
});

test("server.ts: public pages go through the HTML cache, /status and the dashboard do not", () => {
  const src = readFileSync(join(__dirname, "..", "src", "web", "server.ts"), "utf8");
  assert.match(src, /PUBLIC_HTML_TTL_MS = (\d+)_000/);
  const ttl = Number(/PUBLIC_HTML_TTL_MS = (\d+)_000/.exec(src)![1]);
  assert.ok(ttl >= 30 && ttl <= 60, "30–60 s");
  assert.match(src, /route\.path !== "\/status"/);
  assert.doesNotMatch(src, /gzipSync/);
  // Assets are prepared once, outside any request handler.
  assert.match(src, /prepareAsset\("text\/css", styles\)/);
});

test("dashboard: signed-in responses are Cache-Control: private, no-store and Vary on Cookie", async () => {
  assert.equal(DASHBOARD_CACHE_CONTROL, "private, no-store");
  const secret = "s".repeat(64);
  const config = readDashboardConfig({
    DISCORD_APPLICATION_ID: "123456789012345678",
    DISCORD_CLIENT_SECRET: "test-client-secret",
    DASHBOARD_SESSION_SECRET: secret,
    DASHBOARD_REDIRECT_URI: "http://127.0.0.1/dashboard/callback",
  });
  assert.ok(config);
  const sessions = memorySessionStore();
  const sessionId = "S".repeat(40);
  const nowMs = Date.now();
  await sessions.create(sessionId, {
    userId: "900000000000000001", username: "aj", globalName: null, accessToken: "t",
    tokenExpiresAt: new Date(nowMs + 3_600_000), guilds: [], guildsFetchedAt: new Date(nowMs),
    createdAt: new Date(nowMs), expiresAt: new Date(nowMs + 3_600_000),
  });
  const bot = {
    hasGuild: () => false, guild: () => null, memberCanManage: async () => false, memberHasPermission: async () => false,
    textChannels: () => [], hiddenChannelIds: () => new Set<string>(), roles: () => [],
    viewerRoleLimit: async () => ({ ownerId: null, topPosition: null }), userName: () => null,
  } satisfies BotView;
  const app = express();
  app.use("/dashboard", createDashboardRouter({ site, config, bot, data: {} as DashboardData, sessions }));
  const { server, base } = await listen(app);
  const cookie = `${cookieNames(config.secureCookies).session}=${encodeURIComponent(signSessionId(secret, sessionId))}`;
  try {
    const picker = await fetch(`${base}/dashboard`, { headers: { cookie }, redirect: "manual" });
    const html = await picker.text();
    assert.equal(picker.status, 200);
    assert.doesNotMatch(html, /Log in with Discord/, "this is the signed-in server picker");
    assert.equal(picker.headers.get("cache-control"), "private, no-store");
    assert.match(picker.headers.get("vary") ?? "", /\bCookie\b/);

    const guild = await fetch(`${base}/dashboard/800000000000000001`, { headers: { cookie }, redirect: "manual" });
    await guild.text();
    assert.equal(guild.headers.get("cache-control"), "private, no-store");
    assert.match(guild.headers.get("vary") ?? "", /\bCookie\b/);
  } finally {
    server.close();
  }
});

test("rate limits: memory by default, Mongo only with RATE_LIMIT_STORE=mongo", async () => {
  assert.equal(rateLimitStoreKind({}), "memory");
  assert.equal(rateLimitStoreKind({ RATE_LIMIT_STORE: "" }), "memory");
  assert.equal(rateLimitStoreKind({ RATE_LIMIT_STORE: "redis" }), "memory");
  assert.equal(rateLimitStoreKind({ RATE_LIMIT_STORE: "mongo" }), "mongo");
  assert.equal(rateLimitStoreKind({ RATE_LIMIT_STORE: " MONGO " }), "mongo");
  const store = rateLimitStoreFromEnv({});
  const now = 1_000_000;
  assert.equal((await store.hit("page", "1.2.3.4", 2, 60_000, now)).allowed, true);
  assert.equal((await store.hit("page", "1.2.3.4", 2, 60_000, now)).allowed, true);
  const third = await store.hit("page", "1.2.3.4", 2, 60_000, now);
  assert.equal(third.allowed, false);
  assert.ok(third.retryAfterSeconds >= 1);
  assert.equal((await store.hit("page", "5.6.7.8", 2, 60_000, now)).allowed, true, "per client");
  const docs = readFileSync(join(__dirname, "..", "DEPLOYMENT.md"), "utf8");
  assert.match(docs, /RATE_LIMIT_STORE=mongo/);
  const serverSrc = readFileSync(join(__dirname, "..", "src", "web", "server.ts"), "utf8");
  assert.match(serverSrc, /rateLimits: rateLimitStoreFromEnv\(\)/);
});

test("cachedBotView: guild summary and lookups are reused, and invalidate(guildId) drops them", async () => {
  const calls = { guild: 0, hidden: 0, missing: 0, manage: 0 };
  const inner: BotView = {
    hasGuild: () => true,
    guild: id => { calls.guild++; return id === "1" ? { id, name: "G", memberCount: 3 } : null; },
    memberCanManage: async () => { calls.manage++; return true; },
    memberHasPermission: async () => true,
    textChannels: () => [],
    hiddenChannelIds: () => { calls.hidden++; return new Set(["9"]); },
    roles: () => [],
    viewerRoleLimit: async () => ({ ownerId: null, topPosition: 1 }),
    userName: () => null,
    botMissingPermissions: () => { calls.missing++; return ["Ban Members"]; },
  };
  const view = cachedBotView(inner);
  for (let i = 0; i < 5; i++) {
    view.guild("1");
    view.hiddenChannelIds("1");
    view.botMissingPermissions!("1");
    await view.memberCanManage("1", "u");
  }
  assert.deepEqual(calls, { guild: 1, hidden: 1, missing: 1, manage: 1 });
  view.guild("2");
  view.guild("2");
  assert.equal(calls.guild, 3, "a server Aegis is not in is never cached");

  view.invalidate!("1");
  view.guild("1");
  view.hiddenChannelIds("1");
  view.botMissingPermissions!("1");
  await view.memberCanManage("1", "u");
  assert.deepEqual(calls, { guild: 4, hidden: 2, missing: 2, manage: 2 }, "everything for the guild reloads after a write");

  const ctxSrc = readFileSync(join(__dirname, "..", "src", "web", "dashboard", "routes", "context.ts"), "utf8");
  assert.match(ctxSrc, /req\.method === "POST" && deps\.bot\.invalidate/);
});

test("status: periods without samples say Not recorded, with when history starts", () => {
  const nowMs = Date.parse("2026-11-20T12:00:00Z");
  const firstAt = nowMs - 3 * 3_600_000;
  const samples = Array.from({ length: 180 }, (_, i) => ({ at: firstAt + i * 60_000, gateway: true, db: true, ping: 40 }));
  assert.equal(historyStart(samples, nowMs), new Date(firstAt).toISOString());
  assert.equal(historyStart([], nowMs), null);
  const payload = buildStatusPayload({
    nowMs, online: true, ping: 40, guilds: 1, shards: 1, memoryRss: 1, version: "1", startedAt: firstAt, commands: 1,
    dbConnected: true, dbLatency: 5, registration: { ok: true, count: 1, at: null } as never, samples: samples as never, notices: [],
  });
  assert.equal(payload.historyStartsAt, new Date(firstAt).toISOString());
  assert.ok(payload.history.week.buckets.some(b => b.uptime === null), "older buckets have no samples");
  const html = renderStatus(site, payload);
  assert.match(html, new RegExp(NOT_RECORDED));
  assert.doesNotMatch(html, /No data/);
  assert.doesNotMatch(html, /Every number on this page is measured/);
  assert.match(html, /data-status-history-start>Monitoring history starts 2026-11-20 09:00 UTC/);
  assert.match(historyStartLine(null), /No checks have been recorded yet/);
});

test("/health reports the AegisDB mirror queue (counts only)", async () => {
  const app = express();
  registerApiRoutes(app, {
    online: () => true, databaseReady: () => true,
    stats: () => ({ guilds: 1, users: 1, commands: 1, ping: 1, uptime: 1000 }), version: "1", startedAt: Date.now(),
  });
  const { server, base } = await listen(app);
  try {
    const body = await (await fetch(`${base}/health`)).json() as { aegisDbMirror?: { pending: number; dropped: number } };
    assert.equal(typeof body.aegisDbMirror?.pending, "number");
    assert.equal(typeof body.aegisDbMirror?.dropped, "number");
  } finally {
    server.close();
  }
});
