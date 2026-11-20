/**
 * Web review fixes: fetch-metadata CSRF guard, asset caching, gzip threshold,
 * the overview ticket card, dashboard fixtures, AegisDB on /status and the
 * 2.0 cards on the case, appeal and panels pages.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import express from "express";
import { fetchSiteAllowed } from "../src/web/dashboard/security";
import { assetCacheControl, compression, GZIP_MIN_BYTES } from "../src/web/serverMiddleware";
import { ticketsCard } from "../src/web/dashboard/views/overviewHero";
import { renderCase } from "../src/web/dashboard/views/cases";
import { renderAppeal } from "../src/web/dashboard/views/appeals";
import { renderPanels } from "../src/web/dashboard/views/panels";
import { dashboardAuditPages } from "../scripts/dashboard-fixtures";
import { buildStatusPayload } from "../src/web/statusData";
import { COMPONENT_ABOUT, renderStatus } from "../src/web/pages/status";
import type { GuildContext } from "../src/web/dashboard/views";
import type { CaseRecord } from "../src/web/dashboard/data";
import type { AppealRecord } from "../src/services/appeals";
import type { SiteConfig } from "../src/web/pages";

const cfg: SiteConfig = { inviteUrl: "https://discord.com/oauth2/authorize?client_id=1", supportUrl: "", version: "0.0.0", contactEmail: "", assetVersion: "t" };
const viewer = { userId: "900000000000000001", username: "aj", globalName: null, csrf: "tok" };
const ctx: GuildContext = { guild: { id: "800000000000000001", name: "G", memberCount: 3 }, viewer, nameOf: () => null };
const NO_INLINE = /style="|\son[a-z]+="/;

test("fetch metadata: only cross-site is refused; missing falls back to Origin + token", () => {
  assert.equal(fetchSiteAllowed(undefined), true);
  assert.equal(fetchSiteAllowed("same-origin"), true);
  assert.equal(fetchSiteAllowed("none"), true);
  assert.equal(fetchSiteAllowed("same-site"), true);
  assert.equal(fetchSiteAllowed("cross-site"), false);
});

test("assets: immutable only for the current ?v= build hash", () => {
  assert.equal(assetCacheControl("abc123", "abc123", 31536000), "public, max-age=31536000, immutable");
  assert.equal(assetCacheControl(undefined, "abc123", 31536000), "public, max-age=3600");
  assert.equal(assetCacheControl("old", "abc123", 31536000), "public, max-age=3600");
  assert.equal(assetCacheControl(["abc123", "x"], "abc123", 31536000), "public, max-age=3600");
  assert.equal(assetCacheControl(undefined, "abc123", 600), "public, max-age=600");
});

test("compression: small bodies go out as they are, large text is gzipped", async () => {
  const app = express();
  app.use(compression);
  app.get("/small", (_req, res) => { res.type("text/plain").send("x".repeat(GZIP_MIN_BYTES - 1)); });
  app.get("/large", (_req, res) => { res.type("text/html").send("<p>hi</p>".repeat(500)); });
  const server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const small = await fetch(`${base}/small`, { headers: { "Accept-Encoding": "gzip" } });
    assert.equal(small.headers.get("content-encoding"), null);
    assert.equal((await small.text()).length, GZIP_MIN_BYTES - 1);
    const large = await fetch(`${base}/large`, { headers: { "Accept-Encoding": "gzip" } });
    assert.equal(large.headers.get("content-encoding"), "gzip");
    assert.equal((await large.text()).length, "<p>hi</p>".length * 500);
  } finally {
    server.close();
  }
});

const overview = (count: number, listed: number) => ({
  cases7: 0, cases30: 0, warnings7: 0, warnings30: 0, recentCases: [], pendingAppeals: 0, openTicketCount: count,
  openTickets: Array.from({ length: listed }, (_, i) => ({ id: `T-${i}`, channelId: "1", userId: "500000000000000001", category: "general", claimedBy: null, createdAt: new Date(0) })),
});

test("tickets card never says 'No open tickets' next to a non-zero count", () => {
  assert.match(ticketsCard(ctx, overview(0, 0)), /No open tickets\./);
  const mismatch = ticketsCard(ctx, overview(12, 0));
  assert.doesNotMatch(mismatch, /No open tickets/);
  assert.match(mismatch, /12 open tickets, but none could be listed/);
  assert.match(ticketsCard(ctx, overview(1, 0)), /1 open ticket, but/);
  assert.match(ticketsCard(ctx, overview(12, 3)), /Showing the newest 3 of 12/);
});

test("dashboard fixtures: every overview's ticket count agrees with its list", () => {
  const pages = dashboardAuditPages(cfg).filter(([name]) => /^\/dashboard\/:id( \(full overview\))?$/.test(name));
  assert.equal(pages.length, 2);
  for (const [name, html] of pages) {
    const badge = html.match(/id="tickets-h">Open tickets<\/h2><span class="count-badge">([\d,]+)</);
    assert.ok(badge, name);
    if (badge[1] !== "0") assert.doesNotMatch(html, /No open tickets/, name);
  }
});

const record: CaseRecord = {
  id: "65a1b2c3d4e5f60718293a4b", kind: "case", userId: "500000000000000001", moderatorId: viewer.userId, action: "ban",
  reason: "<b>spam</b>", details: null, proofUrl: null, revoked: false, revokedBy: null, revokedAt: null, createdAt: new Date(0),
};

test("case page: 2.0 cards, error summary and described-by help", () => {
  const html = renderCase(cfg, ctx, record);
  for (const id of ["case-details-h", "case-reason-h", "case-revoke-h"]) assert.match(html, new RegExp(`<section class="panel-card" aria-labelledby="${id}"><h2 id="${id}">`));
  assert.match(html, /aria-describedby="reason-help"/);
  assert.doesNotMatch(html, /error-summary/);
  assert.match(html, /&lt;b&gt;spam&lt;\/b&gt;/);
  const bad = renderCase(cfg, ctx, record, { reasonError: "Write a <reason>.", reasonValue: "" });
  assert.match(bad, /class="error-summary" role="alert"/);
  assert.match(bad, /href="#f-reason">Write a &lt;reason&gt;\./);
  assert.match(bad, /aria-invalid="true" aria-describedby="reason-error reason-help"/);
  assert.doesNotMatch(bad, NO_INLINE);
});

test("appeal page: details, statement and review sit in cards; note help is linked", () => {
  const appeal: AppealRecord = {
    code: "AGS-K7X2", guildId: ctx.guild.id, userId: "500000000000000001", moderatorId: viewer.userId, banReason: "Raid",
    appealText: "<i>sorry</i>", status: "pending", reviewedBy: null, reviewNote: null, reviewedAt: null, createdAt: new Date(0),
  };
  const html = renderAppeal(cfg, ctx, appeal);
  for (const id of ["appeal-details-h", "appeal-statement-h", "appeal-review-h"]) assert.match(html, new RegExp(`aria-labelledby="${id}"`));
  assert.match(html, /aria-describedby="note-help"/);
  assert.match(html, /&lt;i&gt;sorry&lt;\/i&gt;/);
  const decided = renderAppeal(cfg, ctx, { ...appeal, status: "denied", reviewNote: "<no>" });
  assert.match(decided, /aria-labelledby="appeal-decision-h"/);
  assert.match(decided, /&lt;no&gt;/);
  assert.doesNotMatch(decided, NO_INLINE);
});

test("panels page: each panel is a card and the jump-link targets still exist", () => {
  const html = renderPanels(cfg, ctx, { channels: [], roles: [], verificationSetUp: false, rolePanels: [], missing: { tickets: null, roles: null } });
  for (const id of ["tickets", "verification", "roles"]) {
    assert.match(html, new RegExp(`<section class="panel-card" id="${id}" aria-labelledby="${id}-h"><h2 id="${id}-h">`));
    assert.match(html, new RegExp(`href="#${id}"`));
  }
});

const statusInput = {
  nowMs: Date.UTC(2026, 10, 18), online: true, ping: 40, guilds: 1, shards: 1, memoryRss: 1, version: "t", startedAt: Date.UTC(2026, 10, 17),
  commands: 1, dbConnected: true, dbLatency: 5, registration: { ok: true, count: 1, at: Date.UTC(2026, 10, 17) }, samples: [], notices: [],
} as unknown as Parameters<typeof buildStatusPayload>[0];

test("status: the AegisDB store is listed with plain copy and never changes the overall state", () => {
  const down = buildStatusPayload({ ...statusInput, aegisDbHealthy: false });
  const comp = down.components.find(c => c.id === "aegisdb");
  assert.equal(comp?.state, "degraded");
  assert.equal(down.status, buildStatusPayload(statusInput).status);
  assert.ok(COMPONENT_ABOUT.aegisdb.includes("source of truth"));
  const html = renderStatus(cfg, down);
  assert.equal((html.match(/<p class="comp-about">/g) ?? []).length, down.components.length);
});
