import { test } from "node:test";
import assert from "node:assert/strict";
import { BULK_DELETE_MAX_AGE_MS, chunk, isBulkDeletable, matchesPurgeCriteria, planPurge, type PurgeCandidate } from "../src/services/purgeFilters";

const NOW = Date.UTC(2026, 9, 28, 12);
const DAY = 86_400_000;
let seq = 0;
function msg(over: Partial<PurgeCandidate> = {}): PurgeCandidate {
  seq++;
  return {
    id: String(seq),
    authorId: "u1",
    authorBot: false,
    content: "hello",
    attachmentCount: 0,
    embedCount: 0,
    hasImageEmbed: false,
    pinned: false,
    createdTimestamp: NOW - seq * 1000,
    ...over,
  };
}

test("14-day limit (with safety margin)", () => {
  assert.equal(isBulkDeletable(NOW - DAY, NOW), true);
  assert.equal(isBulkDeletable(NOW - 14 * DAY, NOW), false);
  assert.equal(isBulkDeletable(NOW - BULK_DELETE_MAX_AGE_MS + 1, NOW), true);
});

test("each filter mode", () => {
  const bot = msg({ authorBot: true });
  const link = msg({ content: "join discord.gg/abc" });
  const http = msg({ content: "see https://x.y" });
  const img = msg({ attachmentCount: 1 });
  const imgEmbed = msg({ embedCount: 1, hasImageEmbed: true });
  const plain = msg();
  assert.equal(matchesPurgeCriteria(bot, { mode: "bots" }), true);
  assert.equal(matchesPurgeCriteria(plain, { mode: "bots" }), false);
  assert.equal(matchesPurgeCriteria(plain, { mode: "humans" }), true);
  assert.equal(matchesPurgeCriteria(link, { mode: "links" }), true);
  assert.equal(matchesPurgeCriteria(http, { mode: "links" }), true);
  assert.equal(matchesPurgeCriteria(plain, { mode: "links" }), false);
  assert.equal(matchesPurgeCriteria(img, { mode: "images" }), true);
  assert.equal(matchesPurgeCriteria(imgEmbed, { mode: "images" }), true);
  assert.equal(matchesPurgeCriteria(plain, { mode: "images" }), false);
  assert.equal(matchesPurgeCriteria(imgEmbed, { mode: "embeds" }), true);
});

test("user and contains-text narrow any mode; keyword mode needs text", () => {
  const a = msg({ authorId: "a", content: "Buy CHEAP nitro https://scam" });
  const b = msg({ authorId: "b", content: "cheap tricks" });
  assert.equal(matchesPurgeCriteria(a, { mode: "links", contains: "cheap" }), true);
  assert.equal(matchesPurgeCriteria(b, { mode: "links", contains: "cheap" }), false);
  assert.equal(matchesPurgeCriteria(b, { mode: "all", userId: "a" }), false);
  assert.equal(matchesPurgeCriteria(b, { mode: "keyword", contains: "TRICKS" }), true);
  assert.equal(matchesPurgeCriteria(b, { mode: "keyword" }), false);
});

test("pinned messages are skipped by default", () => {
  const pinned = msg({ pinned: true });
  assert.equal(matchesPurgeCriteria(pinned, { mode: "all" }), false);
  assert.equal(matchesPurgeCriteria(pinned, { mode: "all", skipPinned: false }), true);
});

test("planPurge caps at amount and counts too-old and pinned matches", () => {
  const scanned = [
    msg({ createdTimestamp: NOW - 1000 }),
    msg({ pinned: true, createdTimestamp: NOW - 2000 }),
    msg({ authorBot: true, createdTimestamp: NOW - 3000 }),
    msg({ createdTimestamp: NOW - 4000 }),
    msg({ createdTimestamp: NOW - 15 * DAY }),
    msg({ createdTimestamp: NOW - 16 * DAY }),
  ];
  const all = planPurge(scanned, { mode: "humans" }, 100, NOW);
  assert.deepEqual(all.toDelete.map((m) => m.id), [scanned[0].id, scanned[3].id]);
  assert.equal(all.tooOld, 2);
  assert.equal(all.pinnedSkipped, 1);

  const capped = planPurge(scanned, { mode: "all" }, 2, NOW);
  assert.equal(capped.toDelete.length, 2);
});

test("chunk splits into bulk-delete batches of 100", () => {
  const items = Array.from({ length: 250 }, (_, i) => i);
  assert.deepEqual(chunk(items).map((c) => c.length), [100, 100, 50]);
  assert.deepEqual(chunk([]), []);
});

test("purge: new filters for files, invites, mentions and stickers", async () => {
  const { matchesPurgeCriteria } = await import("../src/services/purgeFilters");
  const base: PurgeCandidate = { id: "100000000000000010", authorId: "1", authorBot: false, content: "", attachmentCount: 0, embedCount: 0, hasImageEmbed: false, pinned: false, createdTimestamp: Date.now() };
  assert.equal(matchesPurgeCriteria({ ...base, attachmentCount: 1 }, { mode: "attachments" }), true);
  assert.equal(matchesPurgeCriteria({ ...base, hasImageEmbed: true }, { mode: "attachments" }), false, "a link preview is not a file");
  assert.equal(matchesPurgeCriteria({ ...base, content: "join discord.gg/abc" }, { mode: "invites" }), true);
  assert.equal(matchesPurgeCriteria({ ...base, content: "https://discord.com/invite/x-y" }, { mode: "invites" }), true);
  assert.equal(matchesPurgeCriteria({ ...base, content: "https://example.com" }, { mode: "invites" }), false);
  assert.equal(matchesPurgeCriteria({ ...base, mentionCount: 2 }, { mode: "mentions" }), true);
  assert.equal(matchesPurgeCriteria(base, { mode: "mentions" }), false, "missing counts mean none");
  assert.equal(matchesPurgeCriteria({ ...base, stickerCount: 1 }, { mode: "stickers" }), true);
});

test("purge: after_message keeps only newer messages; invalid IDs never match", async () => {
  const { isAfterSnowflake, matchesPurgeCriteria } = await import("../src/services/purgeFilters");
  assert.equal(isAfterSnowflake("100000000000000010", "100000000000000009"), true);
  assert.equal(isAfterSnowflake("100000000000000009", "100000000000000009"), false, "the anchor itself is kept");
  assert.equal(isAfterSnowflake("abc", "1"), false);
  const msg: PurgeCandidate = { id: "100000000000000005", authorId: "1", authorBot: false, content: "", attachmentCount: 0, embedCount: 0, hasImageEmbed: false, pinned: false, createdTimestamp: Date.now() };
  assert.equal(matchesPurgeCriteria(msg, { mode: "all", afterId: "100000000000000004" }), true);
  assert.equal(matchesPurgeCriteria(msg, { mode: "all", afterId: "100000000000000006" }), false);
});

test("purge: confirmation only above the threshold unless a preview is asked for", async () => {
  const { needsPurgeConfirmation, PURGE_CONFIRM_ABOVE } = await import("../src/services/purgeFilters");
  assert.equal(needsPurgeConfirmation(PURGE_CONFIRM_ABOVE, false), false);
  assert.equal(needsPurgeConfirmation(PURGE_CONFIRM_ABOVE + 1, false), true);
  assert.equal(needsPurgeConfirmation(1, true), true);
});

test("purge: summary counts authors, bots, files and links", async () => {
  const { summarizePurge, purgeSummaryText } = await import("../src/services/purgeFilters");
  const mk = (authorId: string, extra: Partial<PurgeCandidate> = {}): PurgeCandidate => ({ id: "1", authorId, authorBot: false, content: "", attachmentCount: 0, embedCount: 0, hasImageEmbed: false, pinned: false, createdTimestamp: 0, ...extra });
  const s = summarizePurge([mk("a"), mk("a"), mk("a", { content: "see https://x.y" }), mk("b", { authorBot: true }), mk("c", { attachmentCount: 2 })], 2);
  assert.deepEqual(s.topAuthors, [{ authorId: "a", count: 3 }, { authorId: "b", count: 1 }]);
  assert.equal(s.otherAuthors, 1);
  assert.equal(s.bots, 1);
  assert.equal(purgeSummaryText(s), "<@a> ×3 · <@b> ×1 · +1 other\n4 human · 1 bot · 1 with files · 1 with links");
  assert.equal(purgeSummaryText(summarizePurge([])), "Nothing deleted.");
});
