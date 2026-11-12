import { test } from "node:test";
import assert from "node:assert/strict";
import { HISTORY_GROUPS, isHistoryGroup, isHistoryPeriod, periodSince, summarizeHistory } from "../src/services/economyHistory";
import { summaryText } from "../src/commands/economy/transactions";
import { DEFAULT_ECONOMY_CONFIG } from "../src/services/economyLogic";
import { TRANSACTION_TYPES, type Transaction, type TransactionType } from "../src/services/economyStore";
import { memoryEconomy } from "../src/services/economyService";

const tx = (type: TransactionType, amount: number, at = 0): Transaction => ({
  guildId: "g", userId: "u", type, amount, balanceAfter: 0, otherUserId: null, actorId: null, note: null, createdAt: new Date(at),
});

test("every transaction type belongs to exactly one filter group", () => {
  for (const type of TRANSACTION_TYPES) {
    const groups = Object.entries(HISTORY_GROUPS).filter(([, g]) => g.types?.includes(type));
    assert.equal(groups.length, 1, type);
  }
  assert.equal(isHistoryGroup("gambling"), true);
  assert.equal(isHistoryGroup("nope"), false);
  assert.equal(isHistoryGroup("toString"), false, "prototype keys are not groups");
  assert.equal(isHistoryPeriod("constructor"), false);
  assert.equal(isHistoryPeriod("week"), true);
});

test("periods: start time, or none for everything kept", () => {
  assert.equal(periodSince("day", 100 * 86_400_000)!.getTime(), 99 * 86_400_000);
  assert.equal(periodSince("all", 5), undefined);
});

test("summary: earned and spent, bank moves left out", () => {
  const s = summarizeHistory([tx("daily", 100), tx("gamble", -40), tx("gamble", 30), tx("deposit", -500), tx("withdraw", 200), tx("pay_out", -10)]);
  assert.deepEqual(s, { earned: 130, spent: 50, net: 80, count: 6 });
  assert.equal(summaryText(DEFAULT_ECONOMY_CONFIG, s), "📥 Earned **+🪙 130 coins** · 📤 Spent **−🪙 50 coins** · Net **+🪙 80 coins**");
  assert.match(summaryText(DEFAULT_ECONOMY_CONFIG, summarizeHistory([tx("buy", -5)])), /Net \*\*−🪙 5 coins\*\*/);
});

test("browseHistory filters by type and time, scoped to the member and capped", async () => {
  let now = 1_000_000_000;
  const { service, store } = memoryEconomy({ now: () => now });
  for (const [i, type] of (["daily", "gamble", "gamble", "work"] as const).entries()) {
    await store.logTransaction({ ...tx(type, 10), createdAt: new Date(now - (3 - i) * 86_400_000) });
  }
  await store.logTransaction({ ...tx("gamble", 10), userId: "other", createdAt: new Date(now) });
  assert.equal((await service.browseHistory("g", "u")).length, 4);
  assert.deepEqual((await service.browseHistory("g", "u", { types: ["gamble"] })).map(t => t.type), ["gamble", "gamble"]);
  const recent = await service.browseHistory("g", "u", { since: new Date(now - 1.5 * 86_400_000) });
  assert.deepEqual(recent.map(t => t.type), ["work", "gamble"], "newest first, older ones cut");
  assert.equal((await service.browseHistory("g", "u", {}, 10_000)).length, 4);
  now += 1;
});
