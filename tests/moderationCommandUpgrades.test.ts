import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  LOCK_REASON_PRESETS,
  PURGE_REASON_PRESETS,
  UNBAN_REASON_PRESETS,
  UNTIMEOUT_REASON_PRESETS,
  CLEARWARNINGS_REASON_PRESETS,
  UNLOCK_REASON_PRESETS,
  presetSuggestions,
} from "../src/commands/moderation/lib/presets";
import { parseMessageRef, wrongChannelError } from "../src/commands/moderation/lib/messageRef";
import { stripTempBanMarker, wouldShortenTimeout } from "../src/commands/moderation/lib/prompt";
import { banChoice } from "../src/commands/moderation/lib/bannedUsers";
import { caseColor, toCaseView } from "../src/commands/moderation/lib/caseLookup";
import { appealFieldText, banNoticeEmbed } from "../src/commands/moderation/ban/notices";
import { CASE_HISTORY_LIMIT, caseHistoryLine } from "../src/commands/moderation/timeout/actions";
import { tempBanMarker } from "../src/services/timedActions";

const MOD_DIR = join(__dirname, "../src/commands/moderation");
const ID = "123456789012345678";
const CH = "223456789012345678";

// Reason presets

test("presetSuggestions offers typed text first, keeps casing, then matching presets", () => {
  const s = presetSuggestions("  Raid by ALTS ", PURGE_REASON_PRESETS);
  assert.equal(s[0].value, "Raid by ALTS");
  assert.match(s[0].name, /^Custom: /);
  assert.ok(presetSuggestions("raid", PURGE_REASON_PRESETS).some(x => x.value === "Raid cleanup"));
});

test("presetSuggestions lists every preset for empty input and never duplicates an exact preset", () => {
  assert.equal(presetSuggestions("", LOCK_REASON_PRESETS).length, LOCK_REASON_PRESETS.length);
  assert.deepEqual(presetSuggestions("maintenance", LOCK_REASON_PRESETS).map(x => x.value), ["Maintenance"]);
});

test("presetSuggestions respects Discord's 100-character and 25-choice limits", () => {
  const s = presetSuggestions("x".repeat(300), UNBAN_REASON_PRESETS);
  assert.ok(s.every(x => x.name.length <= 100 && x.value.length <= 100));
  const many = Array.from({ length: 40 }, (_, i) => ({ name: `p${i}`, value: `p${i}` }));
  assert.ok(presetSuggestions("", many).length <= 25);
});

test("every new preset list fits Discord's choice limits", () => {
  for (const list of [PURGE_REASON_PRESETS, LOCK_REASON_PRESETS, UNLOCK_REASON_PRESETS, UNBAN_REASON_PRESETS, UNTIMEOUT_REASON_PRESETS, CLEARWARNINGS_REASON_PRESETS]) {
    assert.ok(list.length > 0 && list.length <= 25);
    for (const p of list) assert.ok(p.name.length <= 100 && p.value.length <= 100 && p.value.length > 0);
  }
});

// Message references for /purge

test("parseMessageRef accepts IDs, links (incl. ptb/canary and <wrapped>) and empty", () => {
  assert.deepEqual(parseMessageRef(null, "x"), { ok: true, id: undefined });
  assert.deepEqual(parseMessageRef("   ", "x"), { ok: true, id: undefined });
  assert.deepEqual(parseMessageRef(` ${ID} `, "x"), { ok: true, id: ID });
  assert.deepEqual(parseMessageRef(`https://discord.com/channels/${ID}/${CH}/${ID}`, "x"), { ok: true, id: ID, channelId: CH });
  assert.deepEqual(parseMessageRef(`<https://ptb.discord.com/channels/${ID}/${CH}/${ID}>`, "x"), { ok: true, id: ID, channelId: CH });
  assert.equal(parseMessageRef(`https://canary.discordapp.com/channels/${ID}/${CH}/${ID}`, "x").ok, true);
});

test("parseMessageRef rejects junk with an error naming the option", () => {
  const r = parseMessageRef("hello", "before_message");
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /before_message/);
  assert.equal(parseMessageRef("12345", "x").ok, false);
  assert.equal(parseMessageRef("https://example.com/channels/1/2/3", "x").ok, false);
});

test("wrongChannelError only fires for a link into another channel", () => {
  assert.equal(wrongChannelError(parseMessageRef(ID, "a"), "a", CH), null);
  assert.equal(wrongChannelError(parseMessageRef(`https://discord.com/channels/${ID}/${CH}/${ID}`, "a"), "a", CH), null);
  assert.match(String(wrongChannelError(parseMessageRef(`https://discord.com/channels/${ID}/${ID}/${ID}`, "a"), "a", CH)), /points to/);
});

// Prompt helpers

test("wouldShortenTimeout protects longer timeouts from the 10-minute quick action", () => {
  const now = 1_000_000;
  assert.equal(wouldShortenTimeout(null, 600_000, now), false);
  assert.equal(wouldShortenTimeout(new Date(now + 60_000), 600_000, now), false);
  assert.equal(wouldShortenTimeout(new Date(now + 3_600_000), 600_000, now), true);
});

test("stripTempBanMarker hides the timed-unban marker only at the start", () => {
  assert.equal(stripTempBanMarker(`${tempBanMarker("a1b2c3d4")} 7 days: Spam | Banned by x`), "7 days: Spam | Banned by x");
  assert.equal(stripTempBanMarker("Spam [temp:abcd]"), "Spam [temp:abcd]");
  assert.equal(stripTempBanMarker(null), "");
});

// /unban autocomplete

test("banChoice shows name, ID, temp flag and reason, with the ID as the value", () => {
  const c = banChoice({ user: { id: ID, username: "spammer", globalName: "Spam King" }, reason: `${tempBanMarker("abcd1234")} 1 day: Raiding` });
  assert.equal(c.value, ID);
  assert.match(c.name, /Spam King \(@spammer\)/);
  assert.match(c.name, /temp/);
  assert.ok(!c.name.includes("[temp:"));
  assert.match(String(c.keywords), /spammer/);
  const plain = banChoice({ user: { id: ID, username: "bob", globalName: null }, reason: null });
  assert.equal(plain.name, `@bob · ${ID}`);
});

// /case view

test("toCaseView normalises warnings as WARN and keeps case fields", () => {
  const w = toCaseView({ _id: "abc", userId: "u", moderatorId: "m", reason: "", createdAt: "2026-01-01T00:00:00Z" }, "warning");
  assert.equal(w.action, "warn");
  assert.equal(w.kind, "warning");
  assert.equal(w.reason, "No reason provided");
  assert.equal(w.revoked, false);
  assert.ok(w.createdAt instanceof Date);
  const c = toCaseView({ _id: "x", action: "ban", userId: "u", moderatorId: "m", reason: "r", proofUrl: "https://p", revoked: true, createdAt: new Date() }, "case");
  assert.equal(c.action, "ban");
  assert.equal(c.proofUrl, "https://p");
  assert.equal(c.revoked, true);
});

test("caseColor distinguishes actions and greys out revoked cases", () => {
  assert.equal(caseColor("ban"), 0xED4245);
  assert.equal(caseColor("KICK"), 0xE67E22);
  assert.equal(caseColor("unban"), 0x57F287);
  assert.equal(caseColor("ban", true), 0x95A5A6);
  assert.equal(caseColor("purge"), 0x3498DB);
});

// /ban notices

test("ban notice tells a temp-banned member how long and when it ends", () => {
  const temp = banNoticeEmbed("Guild", "Spam", { label: "7 days", endsAtMs: 1_700_000_000_000 }).toJSON();
  const names = (temp.fields ?? []).map(f => f.name);
  assert.ok(names.some(n => n.includes("Length")) && names.some(n => n.includes("Ends")));
  assert.match(String(temp.fields?.find(f => f.name.includes("Ends"))?.value), /<t:1700000000:F>/);
  const perm = banNoticeEmbed("Guild", "Spam", null).toJSON();
  assert.equal(perm.fields?.length, 1);
});

test("appealFieldText covers silent, delivered and failed DMs", () => {
  assert.match(appealFieldText("ABC", true, false), /not sent \(silent\)/);
  assert.match(appealFieldText("ABC", false, true), /DM sent/);
  assert.match(appealFieldText("ABC", false, false), /didn't go through/);
});

// /timeout Case History

test("caseHistoryLine numbers, flags revoked and clips long reasons", () => {
  const line = caseHistoryLine({ _id: "0123456789abcdef01234567", action: "ban", reason: "x".repeat(500), revoked: true, createdAt: new Date(0) }, 2);
  assert.match(line, /^\*\*3\.\*\* `BAN` \*\(revoked\)\*/);
  assert.match(line, /…234567/);
  assert.ok(line.length < 320);
  assert.ok(CASE_HISTORY_LIMIT >= 10);
});

// Commands: options kept, autocomplete added, Discord limits

type Opt = { name: string; description: string; autocomplete?: boolean; options?: Opt[] };
async function commandJson(file: string): Promise<{ name: string; description: string; options?: Opt[] }> {
  const mod = await import(`../src/commands/moderation/${file}`);
  return (mod.command ?? mod.default).data.toJSON();
}
function flat(opts: Opt[] = []): Opt[] {
  return opts.flatMap(o => [o, ...flat(o.options)]);
}

test("existing options are kept and the new ones are additive", async () => {
  const expect: Record<string, string[]> = {
    "removetimeout.ts": ["user", "reason", "notify"],
    "unban.ts": ["user_id", "reason"],
    "clearwarnings.ts": ["user", "reason"],
    "ban.ts": ["user", "preset", "reason", "delete_messages", "silent", "proof", "duration"],
    "kick.ts": ["user", "reason", "silent", "proof"],
    "timeout.ts": ["user", "duration", "preset", "reason", "silent", "proof", "custom_duration"],
    "warn.ts": ["user", "preset", "reason", "proof", "severity", "silent"],
    "purge.ts": ["amount", "filter", "user", "keyword", "reason", "before_message", "after_message", "keep_pinned", "preview"],
  };
  for (const [file, names] of Object.entries(expect)) {
    const json = await commandJson(file);
    assert.deepEqual((json.options ?? []).map(o => o.name), names, file);
  }
  const caseJson = await commandJson("case.ts");
  assert.deepEqual((caseJson.options ?? []).map(o => o.name), ["view", "user", "search", "edit", "delete", "export"]);
});

test("reason, ban-list and case options now autocomplete, with handlers", async () => {
  const want: Record<string, string[]> = {
    "unban.ts": ["user_id", "reason"],
    "removetimeout.ts": ["reason"],
    "clearwarnings.ts": ["reason"],
    "purge.ts": ["reason"],
    "massban.ts": ["reason"],
    "lock.ts": ["reason"],
    "case.ts": ["case_id", "reason"],
  };
  for (const [file, names] of Object.entries(want)) {
    const mod = await import(`../src/commands/moderation/${file}`);
    const cmd = mod.command ?? mod.default;
    assert.equal(typeof cmd.autocomplete, "function", `${file} has an autocomplete handler`);
    const opts = flat(cmd.data.toJSON().options);
    for (const n of names) assert.ok(opts.some(o => o.name === n && o.autocomplete), `${file} ${n} autocompletes`);
  }
});

test("moderation command and option descriptions fit Discord's 100-character limit", async () => {
  for (const file of readdirSync(MOD_DIR).filter(f => f.endsWith(".ts"))) {
    const json = await commandJson(file);
    assert.ok(json.description.length >= 1 && json.description.length <= 100, `${file}: ${json.description}`);
    for (const o of flat(json.options)) assert.ok(o.description.length >= 1 && o.description.length <= 100, `${file} ${o.name}: ${o.description}`);
  }
});

test("no moderation file uses the deprecated fetchReply or exceeds 400 lines", () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
  });
  for (const file of walk(MOD_DIR)) {
    const src = readFileSync(file, "utf8");
    if (!file.endsWith("prompt.ts")) assert.ok(!/fetchReply:\s*true/.test(src), `${file} uses fetchReply`);
    assert.ok(src.split("\n").length < 400, `${file} is over 400 lines`);
  }
});

test("button collectors in ban, timeout and lock are guarded", () => {
  for (const f of ["ban.ts", "timeout/actions.ts", "lock.ts"]) {
    const src = readFileSync(join(MOD_DIR, f), "utf8");
    assert.ok(!/on\("collect", async/.test(src), `${f} has an unguarded collect handler`);
  }
});
