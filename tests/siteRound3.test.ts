/**
 * Site round 3: the recreated bot replies (made-up names, numbers from the
 * real engines, CSP-clean) and where they appear.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { loadCommands } from "../src/commands/loader";
import { clearCatalogCache } from "../src/web/catalog";
import { renderHome, renderFeatures, type SiteConfig } from "../src/web/pages";
import type { Stats } from "../src/web/pages/shared";
import { renderWhy } from "../src/web/pages/why";
import { botShowcase, showcaseTrust, showcaseIncidentSummary, SHOWCASE_NAMES } from "../src/web/pages/botReplies";
import { VERSION } from "../src/version";

const cfg: SiteConfig = { inviteUrl: "https://discord.com/oauth2/authorize?client_id=1", supportUrl: "", version: VERSION, contactEmail: "", assetVersion: "t" };
const stats: Stats = { guilds: 3, ping: 40, uptime: 100, users: 0, commands: 0 };

before(async () => { await loadCommands(); clearCatalogCache(); });

test("Trust Score example is computed by the real engine and adds up", () => {
  const r = showcaseTrust();
  assert.equal(r.score, 80);
  assert.equal(r.bandLabel, "Trusted");
  const sum = r.factors.reduce((s, f) => s + f.points, 0);
  assert.equal(Math.round(sum), r.score);
  assert.equal(r.factors[r.factors.length - 1].label, "Starting score");
});

test("Incident example summary uses the bot's own wording", () => {
  const lines = showcaseIncidentSummary();
  assert.match(lines[0], /^Duration: /);
  assert.match(lines.join("\n"), /Channels: 4 slowed, 0 locked/);
});

test("showcase is labelled as an example, uses made-up names and stays CSP-clean", () => {
  const html = botShowcase({ id: "x", title: "T", lead: "L" });
  assert.equal((html.match(/Example — names are made up/g) ?? []).length, 2);
  for (const n of Object.values(SHOWCASE_NAMES)) assert.ok(html.includes(n));
  assert.doesNotMatch(html, /watispro1|\btaw\b|\d{17,20}/);
  assert.doesNotMatch(html, /style=|<script|\son[a-z]+=/i);
  assert.match(html, /never message content/);
});

test("showcase appears on home, /features and /why", () => {
  for (const html of [renderHome(cfg, stats, true), renderFeatures(cfg), renderWhy(cfg)]) {
    assert.match(html, /class="showcase"/);
    assert.match(html, /Incident Mode is on/);
    assert.match(html, /80\/100 · Trusted/);
  }
  const home = renderHome(cfg, stats, true);
  assert.ok(home.indexOf('class="showcase"') < home.indexOf("highlights-title"), "showcase sits above Built for the bad days");
});
