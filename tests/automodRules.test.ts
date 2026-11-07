/** Automod rules: invites, duplicates, emoji/zalgo, link allowlists, timeout length and action validation. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanDomain, cleanInviteCode, mergeAutomodConfig, normalizeAutomodConfig } from "../src/services/automod";
import {
  blockedInvite, blockedLinkHost, duplicateKey, DuplicateTracker, emojiCount, emojiOrZalgo, inviteCodes, isZalgo, linkHosts, previewAutomod,
} from "../src/services/automodChecks";
import { automodEdit } from "../src/services/automodSettings";
import { automodData } from "../src/commands/automod/automod/builder";
import { buildStatusPayload, toggleKeyFromId } from "../src/commands/automod/automod/status";
import { parseScope } from "../src/services/automodExempt";

const G = "100000000000000001";

test("new rules default to off with sane limits, and old documents still load", () => {
  const c = normalizeAutomodConfig(G, { words: { enabled: true, action: "warn", list: ["x1"] } } as never);
  assert.equal(c.invites.enabled, false);
  assert.equal(c.duplicates.maxRepeats, 3);
  assert.equal(c.duplicates.windowSeconds, 60);
  assert.equal(c.emoji.maxEmoji, 10);
  assert.equal(c.emoji.zalgo, true);
  assert.deepEqual(c.links.allowedDomains, []);
  assert.equal(c.timeoutMinutes, 5);
  assert.equal(c.words.action, "warn");
});

test("normalize clamps limits, drops bad allowlist entries and rejects unknown actions", () => {
  const c = normalizeAutomodConfig(G, {
    links: { enabled: true, action: "ban", allowedDomains: ["https://www.YouTube.com/watch?v=1", "*.github.io", "not a domain", "$ne", "youtube.com"] },
    invites: { enabled: "yes", action: "timeout", allowedCodes: ["discord.gg/Partner", "x", "a b", { $gt: "" }] },
    duplicates: { enabled: true, action: "delete", maxRepeats: 999, windowSeconds: 1 },
    emoji: { enabled: true, action: "warn", maxEmoji: -4, zalgo: false },
    timeoutMinutes: 999_999,
  } as never);
  assert.equal(c.links.action, "delete", "an unknown action falls back to the rule default");
  assert.deepEqual(c.links.allowedDomains, ["youtube.com", "github.io"]);
  assert.equal(c.invites.enabled, false, "only a real boolean turns a rule on");
  assert.deepEqual(c.invites.allowedCodes, ["Partner"]);
  assert.equal(c.duplicates.maxRepeats, 10);
  assert.equal(c.duplicates.windowSeconds, 10);
  assert.equal(c.emoji.maxEmoji, 3);
  assert.equal(c.emoji.zalgo, false);
  assert.equal(c.timeoutMinutes, 10_080);
});

test("merge keeps allowlists when a caller only flips enabled", () => {
  const start = normalizeAutomodConfig(G, { links: { enabled: false, action: "delete", allowedDomains: ["youtube.com"] } } as never);
  const next = mergeAutomodConfig(start, { links: { enabled: true }, timeoutMinutes: 30 });
  assert.equal(next.links.enabled, true);
  assert.deepEqual(next.links.allowedDomains, ["youtube.com"]);
  assert.equal(next.timeoutMinutes, 30);
});

test("domain and invite cleaning", () => {
  assert.equal(cleanDomain("HTTPS://Sub.Example.co.uk/path"), "sub.example.co.uk");
  assert.equal(cleanDomain("localhost"), null);
  assert.equal(cleanDomain("javascript:alert(1)"), null);
  assert.equal(cleanInviteCode("https://discord.com/invite/AbC-12"), "AbC-12");
  assert.equal(cleanInviteCode("discordapp.com/invite/zz9"), "zz9");
  assert.equal(cleanInviteCode("<script>"), null);
});

test("link allowlist covers subdomains, not lookalikes", () => {
  assert.deepEqual(linkHosts("see https://www.youtube.com/x and http://user@evil.example:8080/"), ["youtube.com", "evil.example"]);
  assert.equal(blockedLinkHost("https://m.youtube.com/watch", ["youtube.com"]), null);
  assert.equal(blockedLinkHost("https://youtube.com.evil.example/", ["youtube.com"]), "youtube.com.evil.example");
  assert.equal(blockedLinkHost("https://notyoutube.com/", ["youtube.com"]), "notyoutube.com");
  assert.equal(blockedLinkHost("no links here", []), null);
  assert.equal(blockedLinkHost("https://a.example", []), "a.example");
});

test("invite detection: forms, zero-width tricks, allowlist and vanity", () => {
  assert.deepEqual(inviteCodes("join discord.gg/abc123 or https://discord.com/invite/XyZ or disc\u200Bord.gg/zw1"), ["abc123", "XyZ", "zw1"]);
  assert.equal(blockedInvite("discord.gg/Partner", ["Partner"]), null, "an allowed code passes");
  assert.equal(blockedInvite("discord.gg/partner", ["Partner"]), "partner", "invite codes are case-sensitive, so a different case is a different invite");
  assert.equal(blockedInvite("discord.gg/myserver", [], "MyServer"), null, "the server's vanity passes in any case");
  assert.equal(blockedInvite("discord.gg/MYSERVER", [], "myserver"), null);
  assert.equal(blockedInvite("discord.gg/other discord.gg/partner", ["partner"]), "other");
  assert.equal(blockedInvite("discord is great", []), null);
});

test("emoji counting and zalgo", () => {
  assert.equal(emojiCount("hi 😀😀 <:pepe:123456789012345678> <a:dance:123456789012345678>"), 4);
  assert.equal(emojiCount("👨‍👩‍👧‍👦 🇺🇸 👍🏽"), 3, "joined sequences, flags and skin tones count once");
  assert.equal(emojiCount("plain text: ok"), 0);
  assert.equal(isZalgo("Z\u0351\u0352\u0357\u0358a"), true);
  assert.equal(isZalgo("Tiếng Việt có dấu"), false);
  assert.equal(isZalgo("नमस्ते दुनिया"), false);
  assert.equal(emojiOrZalgo("😀".repeat(11), { maxEmoji: 10, zalgo: true }), "Emoji Spam");
  assert.equal(emojiOrZalgo("😀".repeat(10), { maxEmoji: 10, zalgo: true }), null);
  assert.equal(emojiOrZalgo("Z\u0351\u0352\u0357\u0358", { maxEmoji: 10, zalgo: false }), null);
});

test("duplicate tracker counts identical messages per member inside the window", () => {
  const t = new DuplicateTracker(3);
  assert.equal(duplicateKey("  Buy   NOW\u200B "), "buy now");
  assert.equal(t.record("g:u", "buy now", 60_000, 1000), 1);
  assert.equal(t.record("g:u", "BUY  now", 60_000, 2000), 2);
  assert.equal(t.record("g:u", "buy now", 60_000, 3000), 3);
  assert.equal(t.record("g:u", "something else", 60_000, 4000), 1, "a different message resets the run");
  assert.equal(t.record("g:u", "something else", 60_000, 70_000), 1, "outside the window");
  assert.equal(t.record("g:u", "", 60_000, 71_000), 0, "attachment-only messages are ignored");
  assert.equal(t.record("g:other", "x", 60_000, 1), 1, "members are tracked apart");
  for (let i = 0; i < 10; i++) t.record(`g:${i}`, "x", 60_000, 1);
  assert.equal((t as unknown as { seen: Map<string, unknown> }).seen.size, 3, "memory stays bounded");
});

test("preview covers invites, allow-listed links and emoji, and works on configs without the new rules", () => {
  const cfg = normalizeAutomodConfig(G, {
    links: { enabled: true, action: "delete", allowedDomains: ["youtube.com"] },
    invites: { enabled: true, action: "warn", allowedCodes: [] },
    emoji: { enabled: true, action: "delete", maxEmoji: 3, zalgo: true },
  } as never);
  assert.equal(previewAutomod(cfg, "https://youtube.com/watch").acting, null);
  assert.equal(previewAutomod(cfg, "https://evil.example").acting?.rule, "links");
  assert.equal(previewAutomod(cfg, "discord.gg/raid").hits[0].rule, "invites");
  assert.equal(previewAutomod(cfg, "😀😀😀😀").acting?.rule, "emoji");
  const legacy = { words: cfg.words, links: { enabled: true, action: "delete" as const }, mentions: cfg.mentions, spam: cfg.spam, caps: cfg.caps, exemptRoleIds: [], exemptChannelIds: [] };
  assert.equal(previewAutomod(legacy, "https://a.example").acting?.rule, "links");
});

test("/automod edits: toggles, allowlists, limits and the timeout length", () => {
  const cfg = normalizeAutomodConfig(G);
  const on = automodEdit(cfg, "invites", "toggle", { enabled: true });
  assert.ok(on.ok);
  assert.deepEqual(on.ok && on.patch, { invites: { enabled: true } });

  const allow = automodEdit(cfg, "links", "allow", { domain: "https://www.YouTube.com/" });
  assert.ok(allow.ok && allow.message.includes("youtube.com"));
  const withDomain = mergeAutomodConfig(cfg, allow.ok ? allow.patch : {});
  assert.equal(automodEdit(withDomain, "links", "allow", { domain: "youtube.com" }).ok, false, "no duplicates");
  assert.equal(automodEdit(cfg, "links", "unallow", { domain: "youtube.com" }).ok, false);
  assert.equal(automodEdit(cfg, "links", "allow", { domain: "nope" }).ok, false);

  const full = normalizeAutomodConfig(G, { links: { enabled: true, action: "delete", allowedDomains: Array.from({ length: 50 }, (_, i) => `d${i}.example`) } } as never);
  assert.match(automodEdit(full, "links", "allow", { domain: "new.example" }).message, /at most 50/);

  const inv = automodEdit(cfg, "invites", "allow", { code: "discord.gg/Partner" });
  assert.deepEqual(inv.ok && inv.patch, { invites: { allowedCodes: ["Partner"] } });
  const withCode = normalizeAutomodConfig(G, { invites: { enabled: true, action: "delete", allowedCodes: ["Partner"] } } as never);
  const otherCase = automodEdit(withCode, "invites", "allow", { code: "partner" });
  assert.deepEqual(otherCase.ok && otherCase.patch, { invites: { allowedCodes: ["Partner", "partner"] } }, "a different case is a different invite");
  assert.equal(automodEdit(withCode, "invites", "unallow", { code: "partner" }).ok, false);
  assert.equal(automodEdit(withCode, "invites", "allow", { code: "Partner" }).ok, false);

  const dup = automodEdit(cfg, "duplicates", "limit", { repeats: 4, window: 120 });
  assert.deepEqual(dup.ok && dup.patch, { duplicates: { maxRepeats: 4, windowSeconds: 120 } });
  const emoji = automodEdit(cfg, "emoji", "limit", { max: 8 });
  assert.deepEqual(emoji.ok && emoji.patch, { emoji: { maxEmoji: 8, zalgo: true } }, "zalgo keeps its saved value when not given");

  const timeout = automodEdit(cfg, null, "timeout", { minutes: 60 });
  assert.deepEqual(timeout.ok && timeout.patch, { timeoutMinutes: 60 });
  assert.equal(automodEdit(cfg, null, "timeout", { minutes: 0 }).ok, false);
  assert.equal(automodEdit(cfg, "spam", "action", { action: "ban" }).ok, false);
  assert.match(automodEdit(cfg, "spam", "action", { action: "timeout" }).message, /5 minute/);
  assert.equal(automodEdit(cfg, "nope", "toggle", { enabled: true }).ok, false);
  assert.equal(automodEdit(cfg, "words", "add", { word: "x" }).ok, false, "too short");
});

test("/automod registers every rule group and the status card has a button per rule", () => {
  const json = automodData.toJSON();
  const names = (json.options ?? []).map(o => o.name);
  for (const n of ["words", "links", "invites", "mentions", "spam", "duplicates", "caps", "emoji", "exempt", "timeout", "status"]) assert.ok(names.includes(n), n);
  assert.ok(names.length <= 25);
  const { rows, embed } = buildStatusPayload(normalizeAutomodConfig(G));
  assert.equal(rows.length, 2);
  assert.equal(rows.flatMap(r => r.components).length, 8);
  assert.ok(rows.every(r => r.components.length <= 5));
  assert.ok((embed.data.fields ?? []).every(f => f.value.length <= 1024));
  assert.equal(toggleKeyFromId("am_toggle_duplicates"), "duplicates");
  assert.equal(toggleKeyFromId("am_toggle_nope"), null);
  assert.equal(parseScope("emoji"), "emoji");
});

test("allowed links followed by punctuation stay allowed", () => {
  const allowed = ["youtube.com"];
  for (const text of [
    "watch (https://youtube.com)",
    "see https://youtube.com.",
    "https://www.youtube.com/watch?v=abc), thanks",
    "link: https://youtube.com, and more",
    "\"https://youtube.com\"",
    "https://music.youtube.com!",
    "[clip](https://youtube.com)",
    "https://youtube.com:443)",
  ]) assert.equal(blockedLinkHost(text, allowed), null, text);
  assert.equal(blockedLinkHost("(https://evil.example)", allowed), "evil.example");
  assert.equal(blockedLinkHost("https://youtube.com.evil.example)", allowed), "youtube.com.evil.example");
});

test("a backslash ends the hostname, as it does in browsers", () => {
  const allowed = ["youtube.com"];
  assert.equal(blockedLinkHost("https://evil.example\\.youtube.com", allowed), "evil.example");
  assert.equal(blockedLinkHost("https://evil.example\\@youtube.com/x", allowed), "evil.example");
  assert.equal(blockedLinkHost("https://youtube.com\\watch", allowed), null);
});
