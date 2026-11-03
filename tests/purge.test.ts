import { test } from "node:test";
import assert from "node:assert/strict";
import { describePurgeSkips, runPurge, type PurgeTarget } from "../src/services/purgeRunner";
import { BULK_DELETE_MAX_AGE_MS } from "../src/services/purgeFilters";

const NOW = Date.UTC(2026, 10, 3, 12);
const msgs = (n: number, ageMs = 1000): PurgeTarget[] =>
  Array.from({ length: n }, (_, i) => ({ id: `m${i}`, createdTimestamp: NOW - ageMs - i }));

test("purge keeps counting when a later batch throws", async () => {
  const errors: number[] = [];
  let call = 0;
  const out = await runPurge(msgs(250), {
    deleteOne: async () => undefined,
    bulkDelete: async (batch) => {
      call++;
      if (call === 2) throw new Error("rate limited");
      return batch.map((m) => m.id);
    },
    onBatchError: (_e, size) => errors.push(size),
  }, () => NOW);
  assert.equal(out.deleted, 150);
  assert.equal(out.failed, 100);
  assert.deepEqual(errors, [100]);
  assert.equal(describePurgeSkips(out), "100 failed");
});

test("purge separates already-gone and too-old messages", async () => {
  const fresh = msgs(3);
  const old = msgs(2, BULK_DELETE_MAX_AGE_MS + 10).map((m, i) => ({ ...m, id: `old${i}` }));
  const out = await runPurge([...fresh, ...old], {
    deleteOne: async () => undefined,
    // Discord removes two of the fresh ones; one was deleted by someone else.
    bulkDelete: async () => ["m0", "m1"],
  }, () => NOW);
  assert.deepEqual(out, { requested: 5, deleted: 2, alreadyGone: 1, tooOld: 2, failed: 0 });
  assert.equal(describePurgeSkips(out), "1 already gone, 2 older than 14 days");
});

test("single-message batch maps Unknown Message to already gone", async () => {
  const gone = await runPurge(msgs(1), {
    deleteOne: async () => { throw Object.assign(new Error("Unknown Message"), { code: 10008 }); },
    bulkDelete: async () => [],
  });
  assert.equal(gone.alreadyGone, 1);
  assert.equal(gone.failed, 0);
  const denied = await runPurge(msgs(1), {
    deleteOne: async () => { throw Object.assign(new Error("Missing Permissions"), { code: 50013 }); },
    bulkDelete: async () => [],
  });
  assert.equal(denied.failed, 1);
  assert.equal(denied.deleted, 0);
});

test("purge with no skips has an empty skip line", async () => {
  const out = await runPurge(msgs(120), {
    deleteOne: async () => undefined,
    bulkDelete: async (batch) => batch.map((m) => m.id),
  }, () => NOW);
  assert.equal(out.deleted, 120);
  assert.equal(describePurgeSkips(out), "");
});

test("purge command no longer renders a progress bar", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("src/commands/moderation/purge.ts", "utf8");
  assert.ok(!src.includes("progressBar"));
  assert.match(src, /Deleted \*\*\$\{deletedCount\}\*\* of/);
});
