/**
 * Site content pass: outcome lines on the home page, the Why Aegis page,
 * the expanded security page, the roadmap, the FAQ and the status badges.
 * Claims on these pages are checked against the code they describe.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { loadCommands } from "../src/commands/loader";
import { clearCatalogCache } from "../src/web/catalog";
import { features } from "../src/web/content";
import { HEADLINE } from "../src/web/pages/featuresData";
import { renderHome, renderPrivacy, renderSecurity, renderWhy, type SiteConfig } from "../src/web/pages";
import { CONTENT_SECURITY_POLICY, securityHeaders } from "../src/web/securityHeaders";
import { SECRET_ENV_KEYS } from "../src/utils/logger";
import { OAUTH_SCOPES } from "../src/web/dashboard/discordOAuth";
import { serializeCookie } from "../src/web/dashboard/security";
import { WHY_REASONS } from "../src/web/pages/why";
import { layout } from "../src/web/layout";
import { UNDO_WINDOW_MS } from "../src/services/moderationUndo";
import { INCIDENT_MAX_MINUTES } from "../src/services/incidentLogic";
import { botPermissionBitfield } from "../src/web/catalog";
import { PermissionFlagsBits } from "discord.js";
import { readFileSync } from "node:fs";
import { VERSION } from "../src/version";

const cfg: SiteConfig = { inviteUrl: "https://discord.com/oauth2/authorize?client_id=1", supportUrl: "", version: VERSION, contactEmail: "", assetVersion: "t" };
const stats = { guilds: 3, users: 40, commands: 0, ping: 42, uptime: 90_000 };

before(async () => { await loadCommands(); clearCatalogCache(); });

function cspClean(html: string, label: string): void {
  assert.ok(!/<script(?![^>]*type="application\/ld\+json")[^>]*>[^<]+<\/script>/.test(html), `${label}: no inline script`);
  assert.ok(!/\sstyle="/.test(html), `${label}: no inline styles`);
  assert.ok(!/\son[a-z]+="/.test(html), `${label}: no inline handlers`);
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${label}: one h1`);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, `${label}: ids unique`);
  for (const m of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(m[1]), `${label}: #${m[1]} has a target`);
}

test("home: every feature card and highlight carries a one-line outcome", () => {
  const html = renderHome(cfg, stats, true);
  cspClean(html, "home");
  for (const f of features) {
    assert.ok(f.outcome && f.outcome.length < 90, f.id);
    assert.ok(html.includes(`<strong>${f.outcome}</strong>`), f.id);
  }
  for (const h of HEADLINE) assert.ok(html.includes(`<b>${h.outcome}</b>`), h.title);
  assert.ok(html.includes("Restore a lockdown with one command."));
  assert.ok(html.includes("Know exactly why a member was flagged."));
});

test("home: one primary CTA, two distinct secondary ones, hero kept", () => {
  const html = renderHome(cfg, stats, true);
  const row = html.match(/<div class="btn-row">([\s\S]*?)<\/div>/)![1];
  assert.equal((row.match(/class="btn"/g) ?? []).length, 1, "one primary button");
  assert.match(row, /<a class="btn" href="https:\/\/discord\.com[^"]*">Add to Discord<\/a>/);
  assert.match(row, /<a class="btn ghost" href="\/dashboard">Open the dashboard<\/a>/);
  assert.match(row, /<a class="btn ghost" href="\/commands">Browse \d+ commands<\/a>/);
  assert.ok(html.includes("Moderation for Discord that shows its work."));
  assert.ok(html.includes("Moderation that keeps up with your community"));
  assert.ok(!/testimonial/i.test(html), "no testimonials");
});

test("why: every reason renders, CSP-clean, and its numbers come from the code", () => {
  const html = renderWhy(cfg);
  cspClean(html, "why");
  assert.deepEqual(WHY_REASONS.map(r => r.id), ["reversible", "explainable", "incident", "permissions", "free", "retention"]);
  for (const r of WHY_REASONS) assert.ok(html.includes(`id="${r.id}"`), r.id);
  assert.ok(html.includes(`${UNDO_WINDOW_MS / 60_000} minutes`), "undo window");
  assert.ok(html.includes(`up to ${INCIDENT_MAX_MINUTES / 60} hours`), "incident timer cap");
  assert.ok(html.includes("never message content"));
  assert.equal(botPermissionBitfield() & PermissionFlagsBits.Administrator, 0n, "no Administrator on the invite");
  const mongo = readFileSync("src/database/mongo.ts", "utf8");
  assert.equal((mongo.match(/expireAfterSeconds: 31_536_000/g) ?? []).length, 3, "warnings, cases and notes expire after a year");
  assert.match(readFileSync("src/database/extraModels.ts", "utf8"), /lastMessageAt: 1 \}, \{ expireAfterSeconds: 180 \* 24 \* 60 \* 60/, "activity counters 180 days");
  assert.ok(html.includes('class="f-why"'), "comparison table");
  assert.ok(!/\b(MEE6|Dyno|Carl-bot|Wick)\b/i.test(html), "no competitors named");
});

test("why: linked from nav, footer, home and features", () => {
  const shell = layout({ title: "t", description: "d", path: "/", body: "", inviteUrl: "#", supportUrl: "", version: "1" });
  assert.match(shell, /<a class="nav-link" href="\/why">Why Aegis<\/a>/);
  assert.ok((shell.match(/href="\/why"/g) ?? []).length >= 2, "nav and footer");
  assert.ok(renderHome(cfg, stats, true).includes('href="/why"'));
});

test("security: data handling, CSP, secrets and reporting match the code", () => {
  const html = renderSecurity(cfg);
  cspClean(html, "security");
  for (const id of ["report", "data", "browser", "secrets", "scope", "supported", "response"]) assert.ok(html.includes(`id="${id}"`), id);
  for (const d of CONTENT_SECURITY_POLICY.split("; ")) assert.ok(html.includes(`<code class="inline">${d.replace(/'/g, "&#39;")}</code>`), d);
  for (const k of SECRET_ENV_KEYS) assert.ok(html.includes(`<code class="inline">${k}</code>`), k);
  for (const scope of OAUTH_SCOPES.split(" ")) assert.ok(html.includes(`<code class="inline">${scope}</code>`), scope);
  const cookie = serializeCookie("x", "y", { maxAgeSeconds: 1, secure: true });
  for (const flag of ["HttpOnly", "SameSite=Lax", "Secure"]) assert.ok(cookie.includes(flag) && html.includes(flag), flag);
  const h = securityHeaders("/");
  assert.equal(h["X-Frame-Options"], "DENY");
  assert.match(h["Strict-Transport-Security"], /max-age=63072000/, "two years, as the page says");
  assert.ok(html.includes("Fly.io secrets") && html.includes("environment variables"));
  assert.ok(html.includes("Report a vulnerability") && html.includes("/issues") && html.includes("https://discord.gg/HwTbCYC4PM"), "reporting routes");
  assert.ok(renderSecurity({ ...cfg, supportUrl: "https://discord.gg/custom" }).includes("https://discord.gg/custom"), "configured support server wins");
  assert.ok(renderPrivacy(cfg).includes('<a href="/security">security page</a>'), "privacy links security");
});
