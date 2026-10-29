import { test } from "node:test";
import assert from "node:assert/strict";
import { TtlCache } from "../src/utils/ttlCache";
import { ActivityThrottle } from "../src/services/ticketActivity";
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

test("ticket activity: one write per channel per interval, longer backoff for non-tickets", () => {
  const t = new ActivityThrottle(60_000, 600_000);
  assert.equal(t.shouldWrite("c1", 0), true);
  assert.equal(t.shouldWrite("c1", 1_000), false);
  t.settle("c1", true, 1_000);
  assert.equal(t.shouldWrite("c1", 60_999), false);
  assert.equal(t.shouldWrite("c1", 61_000), true);

  assert.equal(t.shouldWrite("chat", 0), true);
  t.settle("chat", false, 10);
  assert.equal(t.shouldWrite("chat", 300_000), false);
  assert.equal(t.shouldWrite("chat", 600_010), true);
});

test("ticket activity: 1000 messages in one channel within a minute cause one write", () => {
  const t = new ActivityThrottle();
  let writes = 0;
  for (let i = 0; i < 1000; i++) if (t.shouldWrite("busy", i * 50)) writes++;
  assert.equal(writes, 1);
});

test("ticket activity throttle stays bounded", () => {
  const t = new ActivityThrottle(60_000, 600_000, 3);
  for (const c of ["a", "b", "c", "d"]) t.shouldWrite(c, 0);
  assert.equal(t.size, 3);
});

test("command cooldown reserves, blocks, and releases on failure", () => {
  const cd = new CooldownTracker();
  assert.equal(cd.reserve("ping:u", 1500, 0), null);
  assert.equal(cd.reserve("ping:u", 1500, 100), 2);
  cd.release("ping:u");
  assert.equal(cd.reserve("ping:u", 1500, 200), null);
  assert.equal(cd.reserve("ping:u", 1500, 1700), null);
});
