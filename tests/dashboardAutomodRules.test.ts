/** Dashboard automod form: invites, duplicates, emoji, allowed domains and the timeout length. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_DOMAINS_TEXT_MAX,
  EXEMPTION_RULES,
  isExemptionRule,
  parseAutomod,
  parseDomainList,
  parseInviteList,
  parseRuleExemptions,
  type ValidationContext,
} from "../src/web/dashboard/validation";
import { describeChanges } from "../src/web/dashboard/audit";
import { settingsValues } from "../src/web/dashboard/views/form";
import { automodForm } from "../src/web/dashboard/views/automodForm";
import { Form } from "../src/web/dashboard/views/form";
import { AUTOMOD_RULE_KEYS, mergeAutomodConfig, normalizeAutomodConfig } from "../src/services/automod";
import type { SettingsSnapshot } from "../src/web/dashboard/data";

const G = "800000000000000001";
const CH = "111111111111111111";
const ROLE = "333333333333333333";
const ctx: ValidationContext = { textChannelIds: new Set([CH]), roles: new Map([[ROLE, { assignable: true }]]) };

const body = {
  words_action: "delete", links_action: "delete", mentions_action: "timeout", mentions_threshold: "5",
  spam_action: "timeout", spam_maxMessages: "5", spam_windowSeconds: "5", caps_action: "delete", caps_threshold: "80",
  invites_action: "warn", duplicates_action: "delete", duplicates_maxRepeats: "3", duplicates_windowSeconds: "60",
  emoji_action: "timeout", emoji_maxEmoji: "10", timeoutMinutes: "5",
};

test("new rules parse with their toggles, actions and limits", () => {
  const r = parseAutomod({
    ...body, invites_enabled: "on", duplicates_enabled: "on", emoji_enabled: "on", emoji_zalgo: "on",
    links_allowedDomains: "https://www.YouTube.com/watch?v=1\n*.github.io\nyoutube.com\n",
    invites_allowedCodes: "discord.gg/Partner\nhttps://discord.com/invite/abc-123\npartner",
    duplicates_maxRepeats: "10", duplicates_windowSeconds: "600", emoji_maxEmoji: "3", timeoutMinutes: "10080",
  }, ctx);
  assert.ok(r.ok);
  assert.deepEqual(r.value.links.allowedDomains, ["youtube.com", "github.io"], "cleaned like /automod links allow, duplicates dropped");
  assert.deepEqual(r.value.invites, { enabled: true, action: "warn", allowedCodes: ["Partner", "abc-123"] }, "case kept, duplicates ignore case");
  assert.deepEqual(r.value.duplicates, { enabled: true, action: "delete", maxRepeats: 10, windowSeconds: 600 });
  assert.deepEqual(r.value.emoji, { enabled: true, action: "timeout", maxEmoji: 3, zalgo: true });
  assert.equal(r.value.timeoutMinutes, 10_080);
});

test("unticked boxes are off, blank lists are empty", () => {
  const r = parseAutomod(body, ctx);
  assert.ok(r.ok);
  assert.equal(r.value.invites.enabled, false);
  assert.equal(r.value.emoji.zalgo, false);
  assert.deepEqual(r.value.links.allowedDomains, []);
  assert.deepEqual(r.value.invites.allowedCodes, []);
});

test("bounds match the slash command and normalizeAutomodConfig", () => {
  const cases: Array<[string, string]> = [
    ["duplicates_maxRepeats", "1"], ["duplicates_maxRepeats", "11"],
    ["duplicates_windowSeconds", "9"], ["duplicates_windowSeconds", "601"],
    ["emoji_maxEmoji", "2"], ["emoji_maxEmoji", "51"],
    ["timeoutMinutes", "0"], ["timeoutMinutes", "10081"], ["timeoutMinutes", "1.5"], ["timeoutMinutes", ""],
    ["duplicates_maxRepeats", "abc"],
  ];
  for (const [key, value] of cases) {
    const r = parseAutomod({ ...body, [key]: value }, ctx);
    assert.ok(!r.ok && r.errors[key], `${key}=${value}`);
  }
  const low = parseAutomod({ ...body, duplicates_maxRepeats: "2", duplicates_windowSeconds: "10", emoji_maxEmoji: "50", timeoutMinutes: "1" }, ctx);
  assert.ok(low.ok);
});

test("bad or missing actions are rejected for every new rule", () => {
  for (const key of ["invites_action", "duplicates_action", "emoji_action"]) {
    for (const value of ["ban", "", "$ne", "kick"]) {
      const r = parseAutomod({ ...body, [key]: value }, ctx);
      assert.ok(!r.ok && r.errors[key] === "Pick delete, warn or timeout.", `${key}=${value}`);
    }
    const { [key as keyof typeof body]: _drop, ...rest } = body;
    const missing = parseAutomod(rest, ctx);
    assert.ok(!missing.ok && missing.errors[key], `${key} missing`);
  }
});

test("allowed lists reject bad lines, too many entries and oversized text", () => {
  assert.match(parseDomainList("youtube.com\nnot a domain").error ?? "", /"not a domain" doesn't look like a domain/);
  assert.match(parseDomainList("localhost").error ?? "", /doesn't look like a domain/);
  assert.match(parseInviteList("discord.gg/a").error ?? "", /doesn't look like an invite/, "codes need 2+ characters");
  assert.match(parseInviteList("x".repeat(101)).error ?? "", /doesn't look like an invite/, "over the 100-character option limit");

  const fifty = Array.from({ length: 50 }, (_, i) => `site${i}.com`).join("\n");
  assert.equal(parseDomainList(fifty).list.length, 50);
  assert.match(parseDomainList(`${fifty}\nextra.com`).error ?? "", /50 domains or fewer \(it has 51\)/);
  const codes = Array.from({ length: 51 }, (_, i) => `code${i}`).join("\r\n");
  assert.match(parseInviteList(codes).error ?? "", /50 invites or fewer/);

  const huge = parseAutomod({ ...body, links_allowedDomains: "a".repeat(ALLOWED_DOMAINS_TEXT_MAX + 1) }, ctx);
  assert.ok(!huge.ok && /too long/.test(huge.errors.links_allowedDomains));
  const bad = parseAutomod({ ...body, invites_allowedCodes: "fine\n<script>" }, ctx);
  assert.ok(!bad.ok && bad.errors.invites_allowedCodes);
  const notString = parseAutomod({ ...body, links_allowedDomains: ["a.com", "b.com"] }, ctx);
  assert.ok(notString.ok && notString.value.links.allowedDomains.length === 0, "repeated fields are not a list");
});

test("a parsed form saved through mergeAutomodConfig keeps what the form parsed and the per-rule exemptions", () => {
  const current = normalizeAutomodConfig(G, { invites: { enabled: false, action: "delete", allowedCodes: [], exemptRoleIds: [ROLE] } });
  const r = parseAutomod({ ...body, invites_enabled: "on", invites_allowedCodes: "Partner", links_allowedDomains: "youtube.com", timeoutMinutes: "60" }, ctx);
  assert.ok(r.ok);
  const v = r.value;
  const saved = mergeAutomodConfig(current, {
    words: v.words, links: v.links, invites: v.invites, mentions: v.mentions, spam: v.spam,
    duplicates: v.duplicates, caps: v.caps, emoji: v.emoji, timeoutMinutes: v.timeoutMinutes,
    exemptRoleIds: v.exemptRoleIds, exemptChannelIds: v.exemptChannelIds,
  });
  assert.deepEqual(saved.invites.allowedCodes, ["Partner"]);
  assert.deepEqual(saved.invites.exemptRoleIds, [ROLE]);
  assert.deepEqual(saved.links.allowedDomains, ["youtube.com"]);
  assert.equal(saved.timeoutMinutes, 60);
  assert.equal(saved.emoji.zalgo, false);
});

test("form values and the audit summary cover the new fields", () => {
  const snap = (automod: Parameters<typeof normalizeAutomodConfig>[1]) => ({ automod: normalizeAutomodConfig(G, automod) }) as unknown as SettingsSnapshot;
  const before = settingsValues("automod", snap({}));
  assert.equal(before.emoji_zalgo, true);
  assert.equal(before.duplicates_maxRepeats, "3");
  assert.equal(before.timeoutMinutes, "5");
  const after = settingsValues("automod", snap({
    links: { enabled: true, action: "delete", allowedDomains: ["youtube.com", "github.io"] },
    invites: { enabled: true, action: "warn", allowedCodes: ["Partner"] },
    timeoutMinutes: 60,
  }));
  assert.equal(after.links_allowedDomains, "youtube.com\ngithub.io");
  const summary = describeChanges(before, after);
  assert.match(summary, /allowed link domains: \+youtube\.com, github\.io/);
  assert.match(summary, /allowed invites: \+Partner/);
  assert.match(summary, /invites_enabled: off → on/);
  assert.match(summary, /automod timeout minutes: 5 → 60/);

  const old = settingsValues("automod", { automod: { guildId: G, words: { enabled: false, action: "delete", list: [] } } } as unknown as SettingsSnapshot);
  assert.equal(old.invites_action, "delete", "a snapshot from before the new rules gets their defaults");
});

test("the form renders every new field with the right limits", () => {
  const values = settingsValues("automod", { automod: normalizeAutomodConfig(G, { invites: { enabled: true, action: "warn", allowedCodes: ["Partner"] } }) } as unknown as SettingsSnapshot);
  const html = automodForm(new Form({ values, errors: {} }), [], [], new Set());
  for (const name of ["invites_enabled", "invites_action", "duplicates_enabled", "duplicates_action", "emoji_enabled", "emoji_action", "emoji_zalgo"]) {
    assert.ok(html.includes(`name="${name}"`), name);
  }
  assert.match(html, /name="duplicates_maxRepeats" min="2" max="10"/);
  assert.match(html, /name="duplicates_windowSeconds" min="10" max="600"/);
  assert.match(html, /name="emoji_maxEmoji" min="3" max="50"/);
  assert.match(html, /name="timeoutMinutes" min="1" max="10080"/);
  assert.match(html, /<textarea id="f-invites_allowedCodes" name="invites_allowedCodes"[^>]*>Partner<\/textarea>/);
  assert.match(html, /<textarea id="f-links_allowedDomains" name="links_allowedDomains"/);
  assert.ok(!/<script|style="/.test(html), "no inline script or style");
});

test("per-rule exemptions cover every automod rule", () => {
  assert.deepEqual([...EXEMPTION_RULES].sort(), [...AUTOMOD_RULE_KEYS].sort());
  for (const rule of ["invites", "duplicates", "emoji"]) {
    assert.ok(isExemptionRule(rule));
    const r = parseRuleExemptions({ rule, roles: ROLE, channels: CH }, ctx, {});
    assert.ok(r.ok && r.value.rule === rule && r.value.exemptChannelIds[0] === CH, rule);
  }
});

test("overview and setup checklist count the invite, duplicate and emoji rules", async () => {
  const { moduleStates, setupChecklist } = await import("../src/web/dashboard/views/overview");
  const automod = normalizeAutomodConfig("100000000000000001", { emoji: { enabled: true, action: "delete", maxEmoji: 10, zalgo: true } });
  const snapshot = {
    automod,
    guild: { escalation: { enabled: false, thresholds: [] }, loggingEnabled: true, loggingChannelId: "100000000000000002", welcomeEnabled: false, modules: {} },
    starboard: { enabled: false, channelId: null, threshold: 3, emoji: "⭐" },
    tickets: { logChannelId: null },
    verification: null,
  } as unknown as SettingsSnapshot;
  const states = moduleStates("100000000000000001", { openTicketCount: 0, pendingAppeals: 0 } as never, { snapshot });
  const line = states.find(st => st.key === "automod")!;
  assert.equal(line.on, true);
  assert.equal(line.detail, `1 of ${AUTOMOD_RULE_KEYS.length} rules on`);
  assert.ok(!setupChecklist("100000000000000001", { snapshot }).some(i => i.text === "No automod rules are on."));
});
