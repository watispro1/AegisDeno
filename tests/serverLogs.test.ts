import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bulkDeleteEmbed,
  bulkDeleteTranscript,
  channelChanges,
  channelEmbed,
  editLogEmbed,
  memberChanges,
  nicknameChangeEmbed,
  roleChangeEmbed,
  voiceEmbed,
  voiceMove,
  wordDiff,
} from "../src/services/logFormat";
import { isLogCategoryOn } from "../src/services/logCategories";

test("wordDiff keeps only the changed middle", () => {
  assert.deepEqual(wordDiff("the quick brown fox", "the slow brown fox"), { removed: "quick", added: "slow" });
  assert.deepEqual(wordDiff("same", "same"), { removed: "", added: "" });
});

test("edit log shows before, after and what changed, or says the old text was not cached", () => {
  const base = { authorTag: "a#1", authorId: "1", channelId: "2", url: "https://discord.com/x" };
  const full = editLogEmbed({ ...base, before: "hello world", after: "hello there" });
  assert.deepEqual(full.fields?.map(f => f.name), ["Before", "What changed", "After"]);
  const uncached = editLogEmbed({ ...base, before: null, after: "hi" });
  assert.deepEqual(uncached.fields?.map(f => f.name), ["Before", "After"]);
  assert.match(uncached.fields![0].value, /Not cached/);
});

test("bulk delete transcript is oldest first, marks unknown authors and respects the size cap", () => {
  const text = bulkDeleteTranscript("general", [
    { createdAt: 2000, authorTag: "b#2", authorId: "2", content: "second", attachments: 1 },
    { createdAt: 1000, authorTag: null, authorId: null, content: "first", attachments: 0 },
  ]);
  assert.ok(text.indexOf("first") < text.indexOf("second"));
  assert.match(text, /Unknown author/);
  assert.match(text, /\[1 attachment\(s\)\]/);
  const capped = bulkDeleteTranscript("general", Array.from({ length: 50 }, (_, i) => ({ createdAt: i, authorTag: "x", authorId: "1", content: "y".repeat(100), attachments: 0 })), 500);
  assert.ok(capped.length < 700);
  assert.match(capped, /cut to fit/);
  assert.match(bulkDeleteEmbed({ channelId: "1", total: 5, cached: 3, authors: 2 }).description!, /2 not cached/);
});

test("member changes: roles and nickname, nothing for an uncached old member", () => {
  assert.equal(memberChanges(null, { roleIds: ["1"], nickname: null }), null);
  assert.equal(memberChanges({ roleIds: ["1"], nickname: "a" }, { roleIds: ["1"], nickname: "a" }), null);
  const change = memberChanges({ roleIds: ["1", "2"], nickname: null }, { roleIds: ["2", "3"], nickname: "new" })!;
  assert.deepEqual(change.added, ["3"]);
  assert.deepEqual(change.removed, ["1"]);
  assert.ok(roleChangeEmbed("t", "9", change));
  assert.match(nicknameChangeEmbed("t", "9", change)!.description!, /new/);
  assert.equal(roleChangeEmbed("t", "9", { added: [], removed: [], nickname: change.nickname }), null);
});

test("voice moves ignore mute and deafen toggles", () => {
  assert.deepEqual(voiceMove(null, "1"), { kind: "join", to: "1" });
  assert.deepEqual(voiceMove("1", null), { kind: "leave", from: "1" });
  assert.deepEqual(voiceMove("1", "2"), { kind: "move", from: "1", to: "2" });
  assert.equal(voiceMove("1", "1"), null);
  assert.equal(voiceMove(null, null), null);
  assert.match(voiceEmbed("t", "9", { kind: "move", from: "1", to: "2" }).description!, /<#1> to <#2>/);
});

test("channel changes list renames and settings, not permission-only edits", () => {
  const before = { id: "1", name: "old", type: "GuildText", topic: null, nsfw: false, rateLimitPerUser: 0, parentId: null };
  assert.deepEqual(channelChanges(before, { ...before }), []);
  const lines = channelChanges(before, { ...before, name: "new", rateLimitPerUser: 10 });
  assert.equal(lines.length, 2);
  assert.match(channelEmbed("delete", before).description!, /#old/);
});

test("log categories default on, voice activity is opt-in", () => {
  assert.equal(isLogCategoryOn(null, "messageEdits"), true);
  assert.equal(isLogCategoryOn(null, "voiceEvents"), false);
  assert.equal(isLogCategoryOn({ voiceEvents: true }, "voiceEvents"), true);
  assert.equal(isLogCategoryOn({ messageEdits: false }, "messageEdits"), false);
});

test("an update to an uncached message only counts as an edit when it was just edited", async () => {
  const { isContentEdit } = await import("../src/bot/eventFilters");
  const now = 1_800_000_000_000;
  const uncached = { partial: true, content: null };
  assert.equal(isContentEdit(uncached, { content: "hi", editedTimestamp: now - 2_000 }, now), true, "a real edit");
  assert.equal(isContentEdit(uncached, { content: "hi", editedTimestamp: null }, now), false, "never edited: a pin, thread or link preview");
  assert.equal(isContentEdit(uncached, { content: "hi", editedTimestamp: now - 3 * 86_400_000 }, now), false, "edited days ago, now pinned");
  assert.equal(isContentEdit(uncached, { content: "hi" }, now), true, "edit time unknown: still checked");
  assert.equal(isContentEdit(uncached, { partial: true, content: null, editedTimestamp: null }, now), true, "partial new message: still checked");
  assert.equal(isContentEdit({ content: "a" }, { content: "a", editedTimestamp: now }, now), false, "cached and unchanged");
});
