import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, hashClientKey, memoryRateLimitStore, windowStartFor } from "../src/web/dashboard/rateLimitStore";
import { describeChanges, memoryAuditStore } from "../src/web/dashboard/audit";
import { auditLabel } from "../src/web/dashboard/views";

test("rate limit windows are clock-aligned so every process agrees", () => {
  assert.equal(windowStartFor(125_000, 60_000), 120_000);
  assert.equal(windowStartFor(119_999, 60_000), 60_000);
  assert.deepEqual(decide(30, 30, 120_000, 60_000, 125_000), { allowed: true, retryAfterSeconds: 0 });
  assert.deepEqual(decide(31, 30, 120_000, 60_000, 125_000), { allowed: false, retryAfterSeconds: 55 });
  assert.equal(decide(31, 30, 120_000, 60_000, 179_999).retryAfterSeconds, 1, "never 0 seconds");
});

test("client addresses are hashed before storage", () => {
  const h = hashClientKey("203.0.113.9");
  assert.match(h, /^[0-9a-f]{32}$/);
  assert.ok(!h.includes("203"));
  assert.equal(h, hashClientKey("203.0.113.9"));
  assert.notEqual(h, hashClientKey("203.0.113.10"));
});

test("memory rate limit store keeps buckets and clients apart", async () => {
  const store = memoryRateLimitStore();
  for (let i = 0; i < 3; i++) assert.ok((await store.hit("post", "a", 3, 60_000, 1000)).allowed);
  assert.equal((await store.hit("post", "a", 3, 60_000, 1000)).allowed, false);
  assert.ok((await store.hit("post", "b", 3, 60_000, 1000)).allowed, "other client");
  assert.ok((await store.hit("page", "a", 3, 60_000, 1000)).allowed, "other bucket");
  assert.ok((await store.hit("post", "a", 3, 60_000, 61_001)).allowed, "next window");
});

test("describeChanges lists changed fields, and list fields as added and removed", () => {
  assert.equal(describeChanges({ a: "1", b: true, c: "" }, { a: "2", b: false, c: "" }), "a: 1 → 2; b: on → off");
  assert.equal(describeChanges({ x: "same" }, { x: "same" }), "");
  assert.equal(
    describeChanges({ words_list: "spam\nscam", exempt_roles: "1,2" }, { words_list: "spam\nnitro", exempt_roles: "2" }),
    "blocked words: +nitro -scam; exempt roles: -1",
  );
  assert.match(describeChanges({ m: "" }, { m: "x".repeat(100) }), /m: \(none\) → x{57}…/);
});

test("memory audit store lists one server's entries newest first, paged", async () => {
  const store = memoryAuditStore();
  for (let i = 0; i < 5; i++) {
    await store.record({ guildId: "g1", userId: "u", username: "aj", action: "settings.logging", target: null, summary: `#${i}`, createdAt: new Date(1000 * i) });
  }
  await store.record({ guildId: "g2", userId: "u", username: "aj", action: "case.revoke", target: "c", summary: "x".repeat(2000) });
  const page1 = await store.list("g1", { page: 1, perPage: 2 });
  assert.equal(page1.total, 5);
  assert.deepEqual(page1.items.map(e => e.summary), ["#4", "#3"]);
  const g2 = await store.list("g2", { page: 1, perPage: 10 });
  assert.equal(g2.items[0].summary.length, 600, "summaries are capped");
});

test("audit labels read as sentences", () => {
  assert.equal(auditLabel("settings.automod"), "Changed automod settings");
  assert.equal(auditLabel("appeal.denied"), "Denied an appeal");
  assert.equal(auditLabel("settings.nope"), "settings.nope");
});
