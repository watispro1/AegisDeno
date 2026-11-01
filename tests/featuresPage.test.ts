/**
 * The /features page (3.7.0 rework): every command it references exists in the
 * real command definitions, links point at real /commands anchors, and the
 * markup stays CSP-clean, accessible and organised by category.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { loadCommands } from "../src/commands/loader";
import { clearCatalogCache } from "../src/web/catalog";
import { renderCommands, type SiteConfig } from "../src/web/pages";
import { renderFeatures, featureCommandRefs, resolveCommandRef } from "../src/web/pages/features";
import { FEATURE_CATEGORIES, FEATURE_ICONS } from "../src/web/pages/featuresData";
import { VERSION } from "../src/version";

const cfg: SiteConfig = { inviteUrl: "https://discord.com/oauth2/authorize?client_id=1", supportUrl: "", version: VERSION, contactEmail: "", assetVersion: "t" };

before(async () => { await loadCommands(); clearCatalogCache(); });

test("every referenced command and subcommand exists", () => {
  const refs = featureCommandRefs();
  assert.ok(refs.length > 40);
  const missing = refs.filter(r => resolveCommandRef(r) === null);
  assert.deepEqual(missing, []);
  assert.equal(resolveCommandRef("definitely-not"), null);
  assert.equal(resolveCommandRef("trust nope"), null);
  assert.deepEqual(resolveCommandRef("trust user"), { label: "/trust user", href: "/commands#cmd-trust-user" });
});

test("every command link points at an anchor that exists on /commands", () => {
  const features = renderFeatures(cfg);
  const commandsHtml = renderCommands(cfg);
  const anchors = [...features.matchAll(/href="\/commands#([^"]+)"/g)].map(m => m[1]);
  assert.ok(anchors.length >= featureCommandRefs().length);
  for (const a of new Set(anchors)) assert.ok(commandsHtml.includes(`id="${a}"`), a);
});

test("categories, in-page nav, icons, badges and CTAs", () => {
  const html = renderFeatures(cfg);
  const ids = FEATURE_CATEGORIES.map(c => c.id);
  assert.deepEqual(ids, ["moderation", "automod", "incident", "trust", "community", "tickets", "dashboard", "reliability"]);
  for (const id of [...ids, "why"]) {
    assert.ok(html.includes(`id="${id}"`), id);
    assert.ok(html.includes(`href="#${id}"`), `nav ${id}`);
  }
  for (const c of FEATURE_CATEGORIES) for (const card of c.cards) assert.ok(card.icon in FEATURE_ICONS, card.id);
  assert.match(html, /<use href="#fi-gauge"\/>/);
  assert.match(html, /<symbol id="fi-gauge"/);
  assert.match(html, /class="f-badge"[^>]*>On the dashboard: Trust Score/);
  assert.match(html, /href="\/invite"/);
  assert.match(html, /href="\/dashboard"/);
  assert.equal((html.match(/<h1/g) ?? []).length, 1);
  const cardIds = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(cardIds).size, cardIds.length, "ids unique");
});

test("CSP-clean: no inline styles, event handlers or inline scripts", () => {
  const html = renderFeatures(cfg);
  assert.doesNotMatch(html, /\sstyle=/);
  assert.doesNotMatch(html, /\son[a-z]+=/i);
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].filter(m => !/application\/ld\+json/.test(m[1]));
  assert.equal(inline.length, 0);
  assert.match(html, /aria-hidden="true" focusable="false"/);
});
