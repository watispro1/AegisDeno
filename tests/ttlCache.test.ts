import { test } from "node:test";
import assert from "node:assert/strict";
import { TtlCache } from "../src/utils/ttlCache";
import { CooldownTracker } from "../src/commands/executor";

test("TtlCache expires entries after the TTL", () => {
  let now = 0;
  const cache = new TtlCache<number>(1000, 10, () => now);
  cache.set("a", 1);
  assert.equal(cache.get("a"), 1);
  now = 999;
  assert.equal(cache.get("a"), 1);
  now = 1000;
  assert.equal(cache.get("a"), undefined);
});

test("TtlCache evicts the oldest entry past its size bound", () => {
  const cache = new TtlCache<number>(60_000, 2);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.size, 2);
});

test("TtlCache.getOrLoad coalesces concurrent misses", async () => {
  const cache = new TtlCache<number>(60_000);
  let loads = 0;
  const load = async () => { loads++; await new Promise((r) => setTimeout(r, 5)); return 7; };
  const values = await Promise.all([cache.getOrLoad("k", load), cache.getOrLoad("k", load), cache.getOrLoad("k", load)]);
  assert.deepEqual(values, [7, 7, 7]);
  assert.equal(loads, 1);
  assert.equal(await cache.getOrLoad("k", load), 7);
  assert.equal(loads, 1);
});

test("TtlCache: a delete during a load stops the stale result being cached", async () => {
  const cache = new TtlCache<string>(60_000);
  let release!: (v: string) => void;
  const pending = cache.getOrLoad("k", () => new Promise<string>((r) => { release = r; }));
  cache.delete("k");
  release("old");
  assert.equal(await pending, "old");
  assert.equal(cache.get("k"), undefined);
});

test("TtlCache: a failed load is not cached", async () => {
  const cache = new TtlCache<number>(60_000);
  await assert.rejects(cache.getOrLoad("k", async () => { throw new Error("x"); }));
  assert.equal(await cache.getOrLoad("k", async () => 1), 1);
});

test("command cooldown reserves, blocks, and releases on failure", () => {
  const cd = new CooldownTracker();
  assert.equal(cd.reserve("ping:u", 1500, 0), null);
  assert.equal(cd.reserve("ping:u", 1500, 100), 2);
  cd.release("ping:u");
  assert.equal(cd.reserve("ping:u", 1500, 200), null);
  assert.equal(cd.reserve("ping:u", 1500, 1700), null);
});
