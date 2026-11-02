/**
 * Giveaway end/reroll races: only one transition may win, losers get a
 * friendly message, and winners are never overwritten. Mongo is faked with a
 * store whose match-and-update happens in one step (as findOneAndUpdate does).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  endTransition, rerollTransition, finalizeEnd, rerollFilter, endClaimFilter, finalizeFilter,
  TRANSITION_MESSAGES, type GiveawayTransitionStore, type TransitionGiveaway, type DrawFn,
} from "../src/services/giveawayTransitions";

const GUILD = "900000000000000001";
const IDS = { guildId: GUILD, messageId: "m1" };

type Doc = TransitionGiveaway;

function matches(doc: Doc, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, cond]) => {
    const value = doc[key];
    if (cond && typeof cond === "object" && !Array.isArray(cond)) {
      const c = cond as Record<string, unknown>;
      if ("$ne" in c) return value !== c.$ne;
      if ("$in" in c) return (c.$in as unknown[]).some(v => (v === null ? value === null || value === undefined : value === v));
    }
    return value === cond;
  });
}

function apply(doc: Doc, update: Record<string, unknown>): void {
  Object.assign(doc, (update.$set ?? {}) as object);
  const add = (update.$addToSet ?? {}) as Record<string, { $each: string[] }>;
  for (const [key, { $each }] of Object.entries(add)) {
    const list = new Set((doc[key] as string[] | undefined) ?? []);
    for (const v of $each) list.add(v);
    doc[key] = [...list];
  }
}

/** Fake store; every call yields first so concurrent callers interleave. */
function fakeStore(doc: Doc, gate?: () => Promise<void>): GiveawayTransitionStore & { doc: Doc } {
  return {
    doc,
    async update(filter, update) {
      await new Promise(r => setImmediate(r));
      if (!matches(doc, filter)) return null;
      apply(doc, update);
      if (gate) await gate();
      return structuredClone(doc);
    },
    async find(filter) {
      await new Promise(r => setImmediate(r));
      return matches(doc, filter) ? structuredClone(doc) : null;
    },
  };
}

let drawCounter = 0;
/** Deterministic draw: next `count` entrants not excluded, rotating so each draw differs. */
const draw: DrawFn = (g, count, excludePast) => {
  const exclude = excludePast ? new Set([...(g.winners ?? []), ...(g.previousWinners ?? [])]) : new Set<string>();
  const pool = (g.entrants ?? []).filter(e => !exclude.has(e));
  const start = drawCounter++ % Math.max(pool.length, 1);
  return [...pool.slice(start), ...pool.slice(0, start)].slice(0, count);
};

function running(extra: Partial<Doc> = {}): Doc {
  return { ...IDS, ended: false, entrants: ["a", "b", "c", "d", "e", "f"], winners: [], previousWinners: [], winnerCount: 1, ...extra };
}

test("giveaway race: two ends at once (button vs scheduler auto-end) — exactly one wins", async () => {
  const store = fakeStore(running());
  const [x, y] = await Promise.all([endTransition(store, IDS, draw), endTransition(store, IDS, draw)]);
  const oks = [x, y].filter(r => r.ok);
  assert.equal(oks.length, 1);
  const loser = [x, y].find(r => !r.ok)!;
  assert.ok(!loser.ok && (loser.error === TRANSITION_MESSAGES.alreadyEnded || loser.error === TRANSITION_MESSAGES.ending));
  assert.deepEqual(store.doc.winners, oks[0].ok ? oks[0].winners : null);
  assert.equal(store.doc.winnersDrawn, true);
  assert.equal(store.doc.rerollSeq, 0);
});

test("giveaway race: a reroll during an end is refused and cannot be overwritten by the end's winners", async () => {
  let release!: () => void;
  const held = new Promise<void>(r => { release = r; });
  let first = true;
  // Hold the end right after its claim, before winners are stored.
  const store = fakeStore(running(), async () => { if (first) { first = false; await held; } });
  const ending = endTransition(store, IDS, draw);
  await new Promise(r => setTimeout(r, 5));
  assert.equal(store.doc.ended, true);
  assert.equal(store.doc.winnersDrawn, false);

  const reroll = await rerollTransition(store, IDS, null, draw);
  assert.deepEqual(reroll, { ok: false, error: TRANSITION_MESSAGES.ending });
  const secondEnd = await endTransition(store, IDS, draw);
  assert.deepEqual(secondEnd, { ok: false, error: TRANSITION_MESSAGES.ending });

  release();
  const ended = await ending;
  assert.ok(ended.ok);
  assert.deepEqual(store.doc.winners, ended.winners);
});

test("giveaway race: two rerolls at once — one wins, the other gets the friendly message", async () => {
  const store = fakeStore(running({ ended: true, winnersDrawn: true, rerollSeq: 0, winners: ["a"] }));
  const [x, y] = await Promise.all([rerollTransition(store, IDS, null, draw), rerollTransition(store, IDS, null, draw)]);
  const oks = [x, y].filter(r => r.ok);
  assert.equal(oks.length, 1);
  assert.deepEqual([x, y].find(r => !r.ok), { ok: false, error: TRANSITION_MESSAGES.rerollRace });
  assert.equal(store.doc.rerollSeq, 1);
  assert.deepEqual(store.doc.previousWinners, ["a"]);
  assert.deepEqual(store.doc.winners, oks[0].ok ? oks[0].winners : null);
  assert.ok(!store.doc.winners!.includes("a"));
});

test("giveaway race: end vs reroll after the end finished — the later reroll wins cleanly, a late end is refused", async () => {
  const store = fakeStore(running());
  const ended = await endTransition(store, IDS, draw);
  assert.ok(ended.ok);
  const [lateEnd, reroll] = await Promise.all([endTransition(store, IDS, draw), rerollTransition(store, IDS, null, draw)]);
  assert.deepEqual(lateEnd, { ok: false, error: TRANSITION_MESSAGES.alreadyEnded });
  assert.ok(reroll.ok);
  assert.deepEqual(store.doc.winners, reroll.winners);
  assert.deepEqual(store.doc.previousWinners, ended.winners);
});

test("giveaway transitions: legacy ended documents (no guard fields) can still be rerolled once per read", async () => {
  const store = fakeStore({ ...IDS, ended: true, entrants: ["a", "b", "c"], winners: ["a"], previousWinners: [], winnerCount: 1 });
  const first = await rerollTransition(store, IDS, null, draw);
  assert.ok(first.ok);
  assert.equal(store.doc.rerollSeq, 1);
  assert.deepEqual(rerollFilter(GUILD, "m1", 0).rerollSeq, { $in: [0, null] });
  assert.equal(rerollFilter(GUILD, "m1", 3).rerollSeq, 3);
});

test("giveaway transitions: unknown, still-running and exhausted giveaways get clear errors", async () => {
  const none = fakeStore({ guildId: GUILD, messageId: "other", ended: false });
  assert.deepEqual(await endTransition(none, IDS, draw), { ok: false, error: TRANSITION_MESSAGES.notFound });
  assert.deepEqual(await rerollTransition(fakeStore(running()), IDS, null, draw), { ok: false, error: TRANSITION_MESSAGES.notEnded });
  const exhausted = fakeStore({ ...IDS, ended: true, winnersDrawn: true, entrants: ["a"], winners: ["a"], previousWinners: [] });
  assert.deepEqual(await rerollTransition(exhausted, IDS, null, draw), { ok: false, error: TRANSITION_MESSAGES.nobodyLeft });
});

test("giveaway transitions: a half-ended giveaway (crash after claim) is finished exactly once", async () => {
  const store = fakeStore(running({ ended: true, winnersDrawn: false }));
  const [x, y] = await Promise.all([finalizeEnd(store, store.doc, draw), finalizeEnd(store, store.doc, draw)]);
  assert.equal([x, y].filter(r => r.ok).length, 1);
  assert.equal(store.doc.winnersDrawn, true);
  assert.deepEqual(endClaimFilter(GUILD, "m1"), { guildId: GUILD, messageId: "m1", ended: false });
  assert.deepEqual(finalizeFilter(GUILD, "m1"), { guildId: GUILD, messageId: "m1", ended: true, winnersDrawn: false });
});

test("giveaway service uses the guarded transitions, not a blind winners write", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("src/services/giveawayService.ts", "utf8");
  assert.match(src, /endTransition\(/);
  assert.match(src, /rerollTransition\(/);
  assert.doesNotMatch(src, /updateOne\(\{ guildId, messageId \}, \{ \$set: \{ winners \} \}\)/);
});
