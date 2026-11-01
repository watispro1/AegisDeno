/**
 * 3.7.0 command round 4: /nickname, /slowmode, /note delete, /kick, /serverinfo
 * and /userinfo. Pure helpers and command shapes; backward compatible options.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ChannelType } from "discord.js";
import { command as nickname, nicknamePlan } from "../src/commands/moderation/nickname";
import { command as slowmode, formatSlowmode, SLOWMODE_CHANNEL_TYPES } from "../src/commands/moderation/slowmode";
import { command as note, canDeleteNote, isNoteId, noteIdSuggestions } from "../src/commands/moderation/note";
import { command as kick } from "../src/commands/moderation/kick";
import { command as serverinfo } from "../src/commands/general/serverinfo";

type Opt = { name: string; required?: boolean; autocomplete?: boolean; channel_types?: number[]; options?: Opt[] };
const json = (c: { data: { toJSON(): unknown } }) => c.data.toJSON() as { options: Opt[] };

test("/nickname: owner refused, no-op detected, length enforced, reason option is optional", () => {
  const base = { targetId: "2", ownerId: "1", botId: "9", current: "old", requested: "new" };
  assert.deepEqual(nicknamePlan(base), { ok: true, changed: true });
  assert.equal(nicknamePlan({ ...base, targetId: "1" }).ok, false);
  assert.deepEqual(nicknamePlan({ ...base, requested: "  old " }), { ok: true, changed: false });
  assert.deepEqual(nicknamePlan({ ...base, current: null, requested: "   " }), { ok: true, changed: false });
  assert.deepEqual(nicknamePlan({ ...base, requested: null }), { ok: true, changed: true });
  assert.equal(nicknamePlan({ ...base, requested: "x".repeat(33) }).ok, false);
  const opts = json(nickname).options;
  assert.deepEqual(opts.map(o => o.name), ["user", "name", "reason"]);
  assert.equal(opts.find(o => o.name === "reason")?.required, false);
});

test("/slowmode: readable custom durations and channel pickers limited to rate-limited kinds", () => {
  assert.equal(formatSlowmode(0), "**Disabled**");
  assert.equal(formatSlowmode(90), "**1 minute 30 seconds**");
  assert.equal(formatSlowmode(3600), "**1 hour**");
  assert.ok(SLOWMODE_CHANNEL_TYPES.includes(ChannelType.GuildForum));
  assert.ok(!(SLOWMODE_CHANNEL_TYPES as readonly number[]).includes(ChannelType.GuildCategory));
  for (const sub of json(slowmode).options) {
    const ch = sub.options?.find(o => o.name === "channel");
    assert.ok(ch?.channel_types?.length, `${sub.name} channel types`);
  }
});

test("/note delete: ID validation, author-or-Manage-Server rule, autocomplete suggestions", () => {
  assert.equal(isNoteId("65a1b2c3d4e5f60718293a4b"), true);
  assert.equal(isNoteId("not-an-id"), false);
  assert.equal(isNoteId('{"$ne":null}'), false);
  assert.equal(canDeleteNote("1", "1", false), true);
  assert.equal(canDeleteNote("1", "2", false), false);
  assert.equal(canDeleteNote("1", "2", true), true);
  const rows = Array.from({ length: 30 }, (_, i) => ({ id: `65a1b2c3d4e5f60718293a${String(i).padStart(2, "0")}`, userId: "123", note: `note ${i} ${"long ".repeat(30)}`, createdAt: new Date("2026-10-30T12:00:00Z") }));
  const all = noteIdSuggestions(rows, "");
  assert.equal(all.length, 25);
  for (const c of all) assert.ok(c.name.length <= 100 && isNoteId(c.value));
  assert.deepEqual(noteIdSuggestions(rows, "note 7 ").map(c => c.value), [rows[7].id]);
  const del = json(note).options.find(o => o.name === "delete")!;
  assert.equal(del.options?.find(o => o.name === "id")?.autocomplete, true);
  assert.equal(typeof note.autocomplete, "function");
});

test("/kick: reason suggestions like /warn; /serverinfo gains an optional ephemeral flag", () => {
  assert.equal(json(kick).options.find(o => o.name === "reason")?.autocomplete, true);
  assert.equal(typeof kick.autocomplete, "function");
  const si = json(serverinfo).options;
  assert.deepEqual(si.map(o => o.name), ["ephemeral"]);
  assert.equal(si[0].required, false);
});
