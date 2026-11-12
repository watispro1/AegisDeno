import { test } from "node:test";
import assert from "node:assert/strict";
import { pageInfo } from "../src/services/casePaging";
import { navButtonSpecs, pagerIds, disabledRows, navRow } from "../src/services/economyPager";
import { pageOfRank, viewerRankText } from "../src/commands/economy/leaderboard";
import { DEFAULT_ECONOMY_CONFIG } from "../src/services/economyLogic";
import { memoryEconomyStore } from "../src/services/economyStore";
import { boardFilter, rankAheadFilter, transactionQuery } from "../src/services/economyMongo";

const G = "100000000000000001";

test("pager ids are scoped to one command run", () => {
  const a = pagerIds("lb", "111");
  const b = pagerIds("lb", "222");
  assert.notEqual(a.next, b.next);
  for (const id of [a.first, a.prev, a.me, a.next, a.last]) assert.ok(id.startsWith(a.base));
});

test("nav buttons: First/Last only past two pages; Jump to me disabled when unranked or already there", () => {
  const two = navButtonSpecs(pageInfo(15, 0, 10));
  assert.deepEqual(two.map(s => s.move), ["prev", "next"]);
  assert.deepEqual(two.map(s => s.disabled), [true, false]);
  const many = navButtonSpecs(pageInfo(95, 4, 10), { jumpToMe: true, myPage: 7 });
  assert.deepEqual(many.map(s => s.move), ["first", "prev", "me", "next", "last"]);
  assert.ok(many.every(s => !s.disabled));
  assert.equal(navButtonSpecs(pageInfo(95, 7, 10), { jumpToMe: true, myPage: 7 }).find(s => s.move === "me")!.disabled, true);
  assert.equal(navButtonSpecs(pageInfo(95, 0, 10), { jumpToMe: true, myPage: null }).find(s => s.move === "me")!.disabled, true);
  const last = navButtonSpecs(pageInfo(95, 99, 10));
  assert.deepEqual(last.map(s => s.disabled), [false, false, true, true], "clamped to the last page");
});

test("timed-out rows come back with every component disabled", () => {
  const row = navRow(pagerIds("x", "1"), pageInfo(50, 1, 10));
  const [json] = disabledRows([row]);
  assert.equal(json.components.length, 4);
  assert.ok(json.components.every(c => (c as { disabled?: boolean }).disabled === true));
});

test("leaderboard: page of a rank and the viewer footer", () => {
  assert.equal(pageOfRank(1), 0);
  assert.equal(pageOfRank(10), 0);
  assert.equal(pageOfRank(11), 1);
  assert.equal(pageOfRank(0), 0);
  assert.match(viewerRankText(DEFAULT_ECONOMY_CONFIG, null), /not ranked/);
  assert.equal(viewerRankText(DEFAULT_ECONOMY_CONFIG, { rank: 3, total: 40, value: 1200 }), "You: #3 of 40 · 🪙 1,200 coins · top 8%");
});

test("memory store rank matches the leaderboard order, ties by user ID, zero hidden", async () => {
  const store = memoryEconomyStore();
  await store.setBalance(G, "3", 100, 0);
  await store.setBalance(G, "1", 50, 50);
  await store.setBalance(G, "2", 0, 300);
  await store.setBalance(G, "4", 0, 0);
  await store.setBalance("other", "9", 999, 0);
  assert.deepEqual(await store.rank(G, "2"), { rank: 1, total: 3, value: 300 });
  assert.deepEqual(await store.rank(G, "1"), { rank: 2, total: 3, value: 100 }, "tie with 3 broken by user ID");
  assert.deepEqual(await store.rank(G, "3"), { rank: 3, total: 3, value: 100 });
  assert.equal(await store.rank(G, "4"), null);
  assert.equal(await store.rank(G, "9"), null, "other servers never count");
  assert.deepEqual(await store.rank(G, "3", "wallet"), { rank: 1, total: 2, value: 100 });
  assert.equal(await store.rank(G, "2", "wallet"), null);
  const { rows } = await store.leaderboard(G, 0, 10);
  for (const [i, r] of rows.entries()) assert.equal((await store.rank(G, r.userId))!.rank, i + 1);
});

test("mongo rank filters: higher score or same score with a smaller ID, scoped to the server", () => {
  assert.deepEqual(rankAheadFilter(G, "5", "wallet", 70), { guildId: G, $or: [{ balance: { $gt: 70 } }, { balance: 70, userId: { $lt: "5" } }] });
  assert.deepEqual(rankAheadFilter(G, "5", "bank", 1), { guildId: G, $or: [{ bank: { $gt: 1 } }, { bank: 1, userId: { $lt: "5" } }] });
  const total = rankAheadFilter(G, "5", "total", 9) as { guildId: string; $expr: unknown };
  assert.equal(total.guildId, G);
  assert.ok(JSON.stringify(total.$expr).includes("$ifNull"), "missing fields count as 0");
  assert.deepEqual(boardFilter(G, "bank"), { guildId: G, bank: { $gt: 0 } });
  assert.deepEqual(boardFilter(G, "total"), { guildId: G, $or: [{ balance: { $gt: 0 } }, { bank: { $gt: 0 } }] });
});

test("transaction query narrows by type and time", () => {
  const since = new Date(5000);
  assert.deepEqual(transactionQuery(G, "1"), { guildId: G, userId: "1" });
  assert.deepEqual(transactionQuery(G, "1", { types: ["gamble"], since }), { guildId: G, userId: "1", type: { $in: ["gamble"] }, createdAt: { $gte: since } });
  assert.deepEqual(transactionQuery(G, undefined, { types: [] }), { guildId: G });
});
