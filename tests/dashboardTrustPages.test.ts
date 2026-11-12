import { test } from "node:test";
import assert from "node:assert/strict";
import { styles } from "../src/web/theme";
import { dashboardScript } from "../src/web/dashboard/client";
import { Form } from "../src/web/dashboard/views/form";
import { automodRuleSummary, AUTOMOD_FORM_RULES } from "../src/web/dashboard/views/automodForm";
import { embedBuilder, embedTotal } from "../src/web/dashboard/views/embedBuilder";
import { trustMemberList, trustPill, trustTone } from "../src/web/dashboard/views/trustMembers";
import { auditGroup, renderActivity } from "../src/web/dashboard/views/activity";
import type { GuildContext } from "../src/web/dashboard/views";
import type { SiteConfig } from "../src/web/pages";

const cfg: SiteConfig = { inviteUrl: "https://discord.com/oauth2/authorize?client_id=1", supportUrl: "", version: "0.0.0", contactEmail: "", assetVersion: "t" };
const viewer = { userId: "900000000000000001", username: "aj", globalName: null, csrf: "tok" };
const ctx: GuildContext = { guild: { id: "800000000000000001", name: "G", memberCount: 3 }, viewer, nameOf: () => null };
const NO_INLINE = /style="|\son[a-z]+="/;

test("trust tones follow the bands and pills escape", () => {
  assert.deepEqual([85, 60, 45, 25, 5].map(trustTone), ["ok", "ok", "info", "warn", "bad"]);
  assert.equal(trustPill(12, "<High>"), '<span class="pill pill-bad">12 · &lt;High&gt;</span>');
});

test("trust member list gets search, band chips, sort and paging; empty pages keep a next step", () => {
  const rows = [
    { userId: "100000000000000001", name: "Ann", score: 85, bandLabel: "Trusted", low: false },
    { userId: "100000000000000002", name: "Bo", score: 15, bandLabel: "High risk", low: true },
  ];
  const html = trustMemberList(ctx, "/dashboard/800000000000000001/trust", { after: null, per: 50, lowOnly: false }, { rows, next: null, scanned: 2 });
  assert.match(html, /id="trust-member-table" data-filterable data-page-size="25"/);
  assert.match(html, /data-chip="High risk"/);
  assert.match(html, /data-chip-value="High risk" data-sort-score="15"/);
  assert.match(html, /data-more-for="trust-member-table"/);
  assert.doesNotMatch(html, NO_INLINE);
  const empty = trustMemberList(ctx, "/x", { after: null, per: 50, lowOnly: true }, { rows: [], next: "100000000000000009", scanned: 50 });
  assert.match(empty, /Try the next page/);
});

test("automod summary lists every rule with its state and links to its section", () => {
  const html = automodRuleSummary(new Form({ values: { invites_enabled: true, invites_action: "warn" }, errors: {} }));
  assert.match(html, /1 of 8 on/);
  assert.equal((html.match(/<li>/g) ?? []).length, AUTOMOD_FORM_RULES.length);
  assert.match(html, /href="#am-invites">Invites<\/a> <span class="pill pill-ok">On<\/span> <span class="faint">Delete and warn<\/span>/);
  const none = automodRuleSummary(new Form({ values: {}, errors: {} }));
  assert.match(none, /No rule is on yet/);
});

test("embed builder counts every limited field and flags an over-limit total without JS", () => {
  const long = "x".repeat(4096);
  const f = new Form({ values: { e_title: "Hi", e_description: long, e_fname_0: "n".repeat(256), e_fvalue_0: "v".repeat(1024), e_footer: "f".repeat(1000) }, errors: {} });
  assert.equal(embedTotal(f, "e_"), 2 + 4096 + 256 + 1024 + 1000);
  const html = embedBuilder(f, "e_", { legend: "Embed", sample: { user: "@aj", username: "aj", server: "Hub", memberCount: 3 } });
  assert.match(html, /name="e_author"[^>]*data-count-max="256"/);
  assert.match(html, /name="e_footer"[^>]*data-count-max="2048"/);
  assert.match(html, /<p class="callout warn embed-over" data-embed-over>/);
  assert.match(html, /Live preview/);
  assert.doesNotMatch(html, NO_INLINE);
  const ok = embedBuilder(new Form({ values: {}, errors: {} }), "e_", { legend: "E", sample: { user: "@a", username: "a", server: "S", memberCount: 1 } });
  assert.match(ok, /data-embed-over hidden/);
});

test("activity groups changes into filter chips and shows a summary", () => {
  assert.equal(auditGroup("settings.automod"), "Settings");
  assert.equal(auditGroup("case.revoke"), "Moderation");
  assert.equal(auditGroup("economy.give"), "Community");
  assert.equal(auditGroup("weird"), "Other");
  const at = new Date();
  const html = renderActivity(cfg, ctx, 1, { items: [
    { guildId: ctx.guild.id, userId: viewer.userId, username: "aj", action: "case.revoke", target: null, summary: "", createdAt: at },
    { guildId: ctx.guild.id, userId: viewer.userId, username: "aj", action: "trust.settings", target: null, summary: "", createdAt: at },
  ], total: 2 } as never, 50);
  assert.match(html, /aria-label="Activity summary"/);
  assert.match(html, /data-chip="Safety"/);
  assert.match(html, /id="audit-table" data-filterable data-page-size="25"/);
  assert.doesNotMatch(html, NO_INLINE);
});

test("the trust pages stylesheet and script are bundled", () => {
  assert.ok(styles.includes(".automod-rule-list"));
  assert.ok(styles.indexOf(".automod-rule-list") < styles.lastIndexOf("@media"));
  assert.ok(dashboardScript.includes("data-embed-total-wrap"));
});
