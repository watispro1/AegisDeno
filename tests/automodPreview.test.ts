/** The pure automod checks shared by the live handler and the dashboard preview. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { blockedWordHit, capsOrFlood, hasLink, previewAutomod, textMentionCount } from "../src/services/automodChecks";
import type { AutomodConfig } from "../src/services/automod";

const base = (): Omit<AutomodConfig, "guildId"> => ({
  words: { enabled: true, action: "delete", list: ["badword", "free nitro"] },
  links: { enabled: true, action: "warn" },
  mentions: { enabled: true, action: "timeout", threshold: 3 },
  spam: { enabled: true, action: "timeout", maxMessages: 5, windowSeconds: 5 },
  caps: { enabled: true, action: "delete", threshold: 80 },
  exemptRoleIds: [], exemptChannelIds: [],
});

test("blockedWordHit ignores case and zero-width tricks", () => {
  assert.equal(blockedWordHit(["badword"], "This is BADWORD"), "badword");
  assert.equal(blockedWordHit(["badword"], "bad\u200Bword"), "badword");
  assert.equal(blockedWordHit(["badword"], "clean"), null);
  assert.equal(blockedWordHit(["  "], "anything"), null);
});

test("hasLink, capsOrFlood and textMentionCount", () => {
  assert.equal(hasLink("go to https://example.com"), true);
  assert.equal(hasLink("example.com"), false);
  assert.equal(hasLink("HTTPS://EXAMPLE.COM"), true);
  assert.equal(capsOrFlood("THIS IS SHOUTING", 80), "Excessive Caps");
  assert.equal(capsOrFlood("SHORT", 80), null, "fewer than 8 letters");
  assert.equal(capsOrFlood("nooooooo", 80), "Character Flood");
  assert.equal(capsOrFlood("normal text", 80), null);
  assert.equal(textMentionCount("<@123456789012345678> <@!123456789012345678> <@&223456789012345678> @here @everyone"), 3);
});

test("previewAutomod: first enabled hit acts; others listed; off rules reported; spam never judged", () => {
  const r = previewAutomod(base(), "FREE NITRO AT HTTPS://SCAM.EXAMPLE");
  assert.deepEqual(r.hits.map(h => h.rule), ["words", "links", "caps"]);
  assert.equal(r.acting?.label, "Blocked words");
  assert.equal(r.acting?.action, "delete");
  assert.match(r.acting!.detail, /free nitro/);

  const cfg = base();
  cfg.words.enabled = false;
  cfg.links.enabled = false;
  const off = previewAutomod(cfg, "badword https://x.example");
  assert.equal(off.acting, null);
  assert.deepEqual(off.offButWouldMatch, ["Blocked words", "Links"]);

  const pings = previewAutomod(base(), "<@123456789012345678> <@223456789012345678> <@323456789012345678>");
  assert.equal(pings.acting?.rule, "mentions");
  assert.match(pings.acting!.detail, /3 mentions \(acts at 3\)/);

  assert.equal(previewAutomod(base(), "hello there").acting, null);
});

test("the live handler uses the shared checks", async () => {
  const src = (await import("node:fs")).readFileSync(`${__dirname}/../src/services/automodExecution.ts`, "utf8");
  for (const fn of ["blockedWordHit(", "hasLink(", "capsOrFlood("]) assert.ok(src.includes(fn), fn);
});
