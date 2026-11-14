/** SVG status badges: markup, escaping, brief caching, the routes and the status page snippets. */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import express from "express";
import { BADGES, BADGE_CACHE_SECONDS, badgeSvg, cached, registerBadgeRoutes, serversBadge, statusBadge } from "../src/web/badges";
import { buildStatusPayload, type StatusInput, type StatusPayload } from "../src/web/statusData";
import { renderStatus } from "../src/web/pages/status";
import { isCrossOriginResource, securityHeaders } from "../src/web/securityHeaders";
import type { SiteConfig } from "../src/web/pages";

const NOW = Date.parse("2026-11-01T14:00:00Z");
const cfg: SiteConfig = { inviteUrl: "#", supportUrl: "", version: "9.9.9", contactEmail: "", assetVersion: "t" };
function payload(over: Partial<StatusInput> = {}): StatusPayload {
  return buildStatusPayload({
    nowMs: NOW, online: true, ping: 42, guilds: 1234, shards: 1, memoryRss: 1, version: "9.9.9", startedAt: NOW - 1000,
    commands: 50, dbConnected: true, dbLatency: 8, registration: { ok: true, count: 50, at: NOW - 1000 }, samples: [], notices: [], ...over,
  });
}

test("badgeSvg: valid two-part SVG, escaped text, safe colours only", () => {
  const svg = badgeSvg("a<b", "x&y", "#2ea043");
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="\d+" height="20" role="img" aria-label="a&lt;b: x&amp;y">/);
  assert.ok(!svg.includes("<b") && svg.includes("a&lt;b") && svg.includes("x&amp;y"));
  assert.ok(!/<script|style=|\son[a-z]+=/i.test(svg), "no script, inline style or handlers");
  assert.ok(badgeSvg("a", "b", "red;}</svg>").includes('fill="#9f9f9f"'), "bad colour falls back");
  const w = (s: string) => Number(s.match(/width="(\d+)"/)![1]);
  assert.ok(w(badgeSvg("aegis", "major outage", "#000")) > w(badgeSvg("aegis", "ok", "#000")), "width follows the text");
});

test("status and servers badges follow the payload", () => {
  assert.match(statusBadge(payload()), /aria-label="aegis: operational"/);
  assert.match(statusBadge(payload({ online: false })), /aria-label="aegis: major outage"/);
  assert.match(serversBadge(payload()), /aria-label="servers: 1,234"/);
  assert.match(serversBadge(payload({ guilds: 0 })), />0<\/text>/);
});

test("cached: reuses a value inside the window, reloads after, never caches a failure", async () => {
  let clock = 0, calls = 0, fail = true;
  const load = cached(async () => { calls++; if (fail) throw new Error("x"); return calls; }, 1000, () => clock);
  await assert.rejects(load());
  fail = false;
  assert.equal(await load(), 2);
  clock = 999;
  assert.equal(await load(), 2, "cached");
  clock = 2000;
  assert.equal(await load(), 3, "reloaded");
});

test("routes: SVG with a short public cache, embeddable cross-origin, falls back when status fails", async () => {
  const app = express();
  let calls = 0, broken = false;
  registerBadgeRoutes(app, async () => { calls++; if (broken) throw new Error("db down"); return payload(); });
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const res = await fetch(`${base}/badge/status.svg`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /^image\/svg\+xml/);
    assert.equal(res.headers.get("cache-control"), `public, max-age=${BADGE_CACHE_SECONDS}, stale-while-revalidate=${BADGE_CACHE_SECONDS * 5}`);
    assert.match(await res.text(), /operational/);
    assert.match(await (await fetch(`${base}/badge/servers.svg`)).text(), /1,234/);
    assert.equal(calls, 1, "second badge reused the cached payload");
    assert.equal((await fetch(`${base}/badge/nope.svg`)).status, 404);
  } finally {
    server.close();
  }
  const app2 = express();
  broken = true;
  registerBadgeRoutes(app2, async () => { throw new Error("db down"); });
  const s2 = app2.listen(0);
  try {
    const body = await (await fetch(`http://127.0.0.1:${(s2.address() as AddressInfo).port}/badge/status.svg`)).text();
    assert.match(body, /aegis: unknown/);
    assert.ok(!body.includes("db down"), "no error text leaks");
  } finally {
    s2.close();
  }
  assert.ok(isCrossOriginResource("/badge/status.svg"));
  assert.equal(securityHeaders("/badge/servers.svg")["Cross-Origin-Resource-Policy"], "cross-origin");
});

test("status page documents each badge with copyable Markdown", () => {
  const html = renderStatus(cfg, payload());
  assert.ok(html.includes('id="badges"'));
  for (const b of BADGES) {
    assert.ok(html.includes(`<img src="${b.path}"`), b.path);
    assert.match(html, new RegExp(`\\[!\\[${b.alt}\\]\\(https?://[^)]+${b.path.replace(/\./g, "\\.")}\\)\\]\\(https?://[^)]+/status\\)`), `markdown for ${b.path}`);
  }
  assert.ok(!/\sstyle="/.test(html) && !/\son[a-z]+="/.test(html), "CSP-clean");
});
