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
