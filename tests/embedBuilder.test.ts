/** Embed spec rules, the builder's validation and view, and the new guild config fields (3.6.2 dashboard overhaul). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { EMBED_LIMITS, buildEmbedFromSpec, embedLength, normalizeEmbedSpec, renderTemplate, safeEmbedUrl } from "../src/services/embedSpec";
import { normalizeGuildConfig, normalizeLogChannels, guildConfigSetPaths } from "../src/services/configuration";
import { parseAutomation, parseAutoResponder, parseColor, parseGoodbye, readEmbed, parseSuggestionFilter, isResponderId, isTaskId, isSuggestionId } from "../src/web/dashboard/moduleValidation";
import { Errors } from "../src/web/dashboard/validation";
import { dayKeys, densify } from "../src/web/dashboard/moduleData";
import { embedBuilder, embedValues } from "../src/web/dashboard/views/embedBuilder";
import { Form } from "../src/web/dashboard/views/form";
import { casesChart } from "../src/web/dashboard/views/overview";
import { CONTENT_SECURITY_POLICY } from "../src/web/securityHeaders";

const CH = "700000000000000001";
const ctx = { textChannelIds: new Set([CH]), hiddenChannelIds: new Set(["700000000000000050"]), roles: new Map() };

test("renderTemplate fills every variable once and never re-expands a value", () => {
  const v = { user: "<@1>", username: "{server}", server: "Hub", memberCount: 42 };
  assert.equal(renderTemplate("{user} {username} {server} {memberCount} {member_count} {count} {unknown}", v), "<@1> {server} Hub 42 42 42 {unknown}");
});

test("safeEmbedUrl takes https image links only", () => {
  assert.equal(safeEmbedUrl("https://cdn.example.com/a.png"), "https://cdn.example.com/a.png");
  for (const bad of ["http://example.com/a.png", "javascript:alert(1)", "data:image/png;base64,AA", "https://localhost/x", "https://a.com/x y", `https://a.com/${"x".repeat(2100)}`]) {
    assert.equal(safeEmbedUrl(bad), null, bad);
  }
});

test("normalizeEmbedSpec clamps stored embeds and drops empty or oversized ones", () => {
  assert.equal(normalizeEmbedSpec(null), null);
  assert.equal(normalizeEmbedSpec({ title: "   " }), null, "empty");
  const spec = normalizeEmbedSpec({ title: "x".repeat(400), color: 0x123456, imageUrl: "http://insecure", fields: [{ name: "a", value: "b", inline: true }, { name: "", value: "c" }] });
  assert.ok(spec);
  assert.equal(spec.title?.length, EMBED_LIMITS.title);
  assert.equal(spec.imageUrl, null);
  assert.deepEqual(spec.fields, [{ name: "a", value: "b", inline: true }]);
  assert.equal(normalizeEmbedSpec({ color: -1, description: "ok" })?.color, null);
  const big = { description: "d".repeat(4096), fields: Array.from({ length: 25 }, () => ({ name: "n", value: "v".repeat(1024) })) };
  assert.equal(normalizeEmbedSpec(big), null, "over the 6000 total");
});

test("buildEmbedFromSpec fills variables in every text part", () => {
  const e = buildEmbedFromSpec({ title: "Hi {username}", description: "{server}", color: 1, authorName: "{user}", footerText: "#{count}", imageUrl: null, thumbnailUrl: null, fields: [{ name: "{server}", value: "{memberCount}", inline: false }] },
    { user: "<@1>", username: "aj", server: "Hub", memberCount: 7 });
  assert.equal(e.data.title, "Hi aj");
  assert.equal(e.data.author?.name, "<@1>");
  assert.equal(e.data.footer?.text, "#7");
  assert.deepEqual(e.data.fields, [{ name: "Hub", value: "7", inline: false }]);
});

test("readEmbed enforces Discord limits and half-filled fields", () => {
  const errors = new Errors();
  const spec = readEmbed({ e_title: "t", e_description: "d".repeat(4097), e_color: "#zzzzzz", e_fname_1: "name only", e_fvalue_2: "value only" }, "e_", errors);
  assert.ok(spec);
  assert.ok(errors.map.e_description && errors.map.e_color && errors.map.e_fname_2 && errors.map.e_fvalue_1);
  assert.equal(readEmbed({}, "e_", new Errors()), null, "all blank is no embed");
  assert.equal(parseColor("#5865F2"), 0x5865f2);
  assert.equal(parseColor(""), null);
  const total = new Errors();
  readEmbed({ e_description: "d".repeat(4096), ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [[`e_fname_${i}`, "n"], [`e_fvalue_${i}`, "v".repeat(1000)]]).flat()) }, "e_", total);
  assert.match(total.map.e_description ?? "", /6,000/);
  assert.ok(embedLength({ title: "ab", description: "c", color: null, authorName: null, footerText: "d", imageUrl: null, thumbnailUrl: null, fields: [{ name: "e", value: "f", inline: false }] }) === 6);
});

test("goodbye, autoresponder and schedule parsers", () => {
  assert.equal(parseGoodbye({ goodbyeEnabled: "on", goodbyeChannelId: "700000000000000050", goodbyeMessage: "bye" }, ctx).ok, false, "hidden channel");
  assert.equal(parseGoodbye({ goodbyeEnabled: "on", goodbyeChannelId: CH, goodbyeMessage: "x".repeat(1001) }, ctx).ok, false);
  const g = parseGoodbye({ goodbyeChannelId: CH, goodbyeMessage: "a\r\nb" }, ctx);
  assert.ok(g.ok && g.value.goodbyeMessage === "a\nb" && g.value.goodbyeEnabled === false);
  assert.equal(parseAutoResponder({ trigger: "x".repeat(101), response: "y", matchType: "exact" }).ok, false);
  assert.equal(parseAutoResponder({ trigger: "hi", response: "y", matchType: "$where" }).ok, false);
  const s = parseAutomation({ channelId: CH, message: "m", delay: "2 hours", repeat: "" }, ctx);
  assert.ok(s.ok && s.value.delayMs === 7_200_000 && s.value.intervalMs === null);
  assert.equal(parseAutomation({ channelId: CH, message: "m", delay: "29d" }, ctx).ok, false);
  assert.deepEqual(parseSuggestionFilter({ status: "$ne", page: "-2" }), { filter: "open", page: 1 });
  assert.ok(isResponderId("ar-0f8fad5b-d9cb-469f-a165-70867728950e") && !isResponderId("ar-../x"));
  assert.ok(isTaskId("65a1b2c3d4e5f60718293a4b") && !isTaskId("65a1"));
  assert.ok(isSuggestionId("0f8fad5b-d9cb-469f-a165-70867728950e") && !isSuggestionId("x"));
});

test("new guild config fields default safely and normalise on save", () => {
  const c = normalizeGuildConfig("1", {});
  assert.equal(c.goodbyeEnabled, false);
  assert.equal(c.autorespondersEnabled, true, "autoresponders stay on for existing servers");
  assert.equal(c.welcomeEmbed, null);
  assert.deepEqual(normalizeLogChannels({ modActions: "700000000000000001", bogus: "700000000000000001", memberJoins: "abc" }), { modActions: "700000000000000001" });
  assert.equal(normalizeLogChannels({}), null);
  const set = guildConfigSetPaths({ welcomeEmbed: { title: "x".repeat(300) } as never, logChannels: { $where: "1" } as never, goodbyeEnabled: true });
  assert.equal((set.welcomeEmbed as { title: string }).title.length, 256);
  assert.equal(set.logChannels, null);
  assert.equal(set.goodbyeEnabled, true);
});

test("dayKeys and densify make a dense 30-day series", () => {
  const keys = dayKeys(Date.UTC(2026, 9, 31, 12), 3);
  assert.deepEqual(keys, ["2026-10-29", "2026-10-30", "2026-10-31"]);
  assert.deepEqual(densify([{ _id: "2026-10-31", n: 2 }, { _id: "2026-10-31", n: 1 }, { _id: "2026-01-01", n: 9 }], keys), [0, 0, 3]);
  const svg = casesChart([0, 1, 4], Date.UTC(2026, 9, 31));
  assert.match(svg, /role="img"/);
  assert.match(svg, /<title>2026-10-31: 4 cases<\/title>/);
});

test("the embed builder renders a server-side preview, escaped, with no inline style or script", () => {
  const f = new Form({ values: { ...embedValues({ title: "<b>{server}</b>", description: null, color: 0xff0000, authorName: null, footerText: null, imageUrl: "https://x.example/a.png", thumbnailUrl: null, fields: [] }, "e_") }, errors: {} });
  const html = embedBuilder(f, "e_", { legend: "Embed", sample: { user: "@aj", username: "aj", server: "Hub", memberCount: 3 } });
  assert.match(html, /&lt;b&gt;Hub&lt;\/b&gt;/);
  assert.match(html, /Image: x\.example/);
  assert.match(html, /\{memberCount\}/, "variable reference listed");
  assert.doesNotMatch(html, /\sstyle=|<script|\son[a-z]+=/);
});

test("the CSP still allows no inline script or style", () => {
  assert.doesNotMatch(CONTENT_SECURITY_POLICY, /unsafe-inline|unsafe-eval/);
});
