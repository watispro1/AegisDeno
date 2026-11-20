import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  describeMirrorHealth,
  drainMirrorQueue,
  mirrorQueueStats,
  mirrorToAegis,
  resetMirrorQueue,
  MIRROR_MAX_ATTEMPTS,
} from "../src/services/aegisMirror";

afterEach(() => resetMirrorQueue());

function deferred(): { promise: Promise<void>; resolve(): void; reject(err: Error): void } {
  let resolve!: () => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test("a job never overtakes an earlier job for the same key that is still running", async () => {
  const order: string[] = [];
  const slow = deferred();
  const first = mirrorToAegis({ key: "case:g", label: "create", run: async () => { await slow.promise; order.push("create"); } });
  // Arrives while the create is in flight: before the fix it ran at once and finished first.
  const second = mirrorToAegis({ key: "case:g", label: "revoke", run: async () => { order.push("revoke"); } });
  await second;
  assert.deepEqual(order, [], "the revoke waits");
  assert.equal(mirrorQueueStats().pending, 1);
  assert.equal(mirrorQueueStats().inFlight, 1);
  slow.resolve();
  await first;
  await drainMirrorQueue();
  assert.deepEqual(order, ["create", "revoke"]);
  assert.equal(mirrorQueueStats().pending, 0);
  assert.equal(mirrorQueueStats().succeeded, 2);
});

test("different keys still run in parallel", async () => {
  const slow = deferred();
  let otherRan = false;
  const a = mirrorToAegis({ key: "case:a", label: "a", run: () => slow.promise });
  await mirrorToAegis({ key: "case:b", label: "b", run: async () => { otherRan = true; } });
  assert.equal(otherRan, true);
  slow.resolve();
  await a;
});

test("a failed first attempt is retried before later jobs for its key", async () => {
  const order: string[] = [];
  const slow = deferred();
  const first = mirrorToAegis({
    key: "case:g", label: "create",
    run: async () => { await slow.promise; order.push("create-fail"); throw new Error("ECONNREFUSED"); },
  });
  await mirrorToAegis({ key: "case:g", label: "revoke", run: async () => { order.push("revoke"); } });
  slow.resolve();
  await first;
  // Next attempt of the create must succeed now.
  const stats = mirrorQueueStats();
  assert.equal(stats.pending, 2);
  assert.equal(stats.lastFailure?.label, "create");
  assert.match(stats.lastFailure?.error ?? "", /ECONNREFUSED/);
  assert.equal(stats.failedAttempts, 1);
});

test("retry order: create retried, then revoke", async () => {
  const order: string[] = [];
  let createAttempts = 0;
  await mirrorToAegis({
    key: "case:g", label: "create",
    run: async () => { createAttempts++; if (createAttempts === 1) throw new Error("down"); order.push("create"); },
  });
  await mirrorToAegis({ key: "case:g", label: "revoke", run: async () => { order.push("revoke"); } });
  await drainMirrorQueue({ force: true });
  assert.deepEqual(order, ["create", "revoke"]);
});

test("a newer config snapshot replaces queued older ones instead of piling up", async () => {
  const sent: number[] = [];
  const slow = deferred();
  const first = mirrorToAegis({ key: "cfg:g", label: "cfg1", supersedes: true, run: async () => { await slow.promise; sent.push(1); } });
  await mirrorToAegis({ key: "cfg:g", label: "cfg2", supersedes: true, run: async () => { sent.push(2); } });
  await mirrorToAegis({ key: "cfg:g", label: "cfg3", supersedes: true, run: async () => { sent.push(3); } });
  assert.equal(mirrorQueueStats().pending, 1, "cfg2 was replaced by cfg3");
  assert.equal(mirrorQueueStats().superseded, 1);
  slow.resolve();
  await first;
  await drainMirrorQueue();
  assert.deepEqual(sent, [1, 3], "the newest snapshot lands last");
});

test("a failed older snapshot is not retried once a newer one is waiting", async () => {
  const sent: string[] = [];
  const slow = deferred();
  const first = mirrorToAegis({
    key: "cfg:g", label: "old", supersedes: true,
    run: async () => { await slow.promise; throw new Error("timeout"); },
  });
  await mirrorToAegis({ key: "cfg:g", label: "new", supersedes: true, run: async () => { sent.push("new"); } });
  slow.resolve();
  await first;
  assert.equal(mirrorQueueStats().pending, 1);
  await drainMirrorQueue({ force: true });
  assert.deepEqual(sent, ["new"], "the stale snapshot never overwrites the newer one");
});

test("a job is dropped after MIRROR_MAX_ATTEMPTS and counted", async () => {
  await mirrorToAegis({ key: "k", label: "always-fails", run: async () => { throw new Error("nope"); } });
  for (let i = 1; i < MIRROR_MAX_ATTEMPTS; i++) await drainMirrorQueue({ force: true });
  const stats = mirrorQueueStats();
  assert.equal(stats.pending, 0);
  assert.equal(stats.dropped, 1);
  assert.equal(stats.failedAttempts, MIRROR_MAX_ATTEMPTS);
});

test("a forced drain called during a running drain waits for it and still runs", async () => {
  const slow = deferred();
  let ran = 0;
  await mirrorToAegis({ key: "a", label: "a", run: async () => { if (ran++ === 0) throw new Error("x"); await slow.promise; } });
  await mirrorToAegis({ key: "b", label: "b", run: async () => { throw new Error("y"); } });
  const firstDrain = drainMirrorQueue({ force: true });
  // Before the fix this returned at once because a drain was already running.
  const forced = drainMirrorQueue({ force: true });
  slow.resolve();
  await Promise.all([firstDrain, forced]);
  // Key b failed in both drains: 1 first attempt + 2 drains = 3 attempts, still queued.
  assert.equal(mirrorQueueStats().pending, 1);
  assert.equal(mirrorQueueStats().failedAttempts, 4);
});

test("a drain budget stops new attempts once spent", async () => {
  let calls = 0;
  for (const key of ["a", "b", "c"]) {
    await mirrorToAegis({ key, label: key, run: async () => { calls++; if (calls <= 3) throw new Error("down"); await new Promise((r) => setTimeout(r, 30)); } });
  }
  await drainMirrorQueue({ force: true, budgetMs: 20 });
  assert.equal(calls, 4, "only one retry started inside the 20 ms budget");
  assert.equal(mirrorQueueStats().pending, 2);
});

test("describeMirrorHealth summarises queue state for owners", () => {
  assert.equal(describeMirrorHealth({
    pending: 0, inFlight: 0, dropped: 0, superseded: 0, succeeded: 3, failedAttempts: 0,
    oldestPendingMs: 0, lastFailure: null, lastSuccessAt: 1,
  }), "ok");
  const text = describeMirrorHealth({
    pending: 2, inFlight: 1, dropped: 1, superseded: 0, succeeded: 0, failedAttempts: 4,
    oldestPendingMs: 12_000, lastFailure: { label: "createCase g/1", error: "ECONNREFUSED", at: 1_000 }, lastSuccessAt: null,
  }, 61_000);
  assert.equal(text, "2 pending (oldest 12s), 1 in flight, 1 dropped · last failure 60s ago: createCase g/1: ECONNREFUSED");
});
