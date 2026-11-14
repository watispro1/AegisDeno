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
import { renderHome, type SiteConfig } from "../src/web/pages";
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
