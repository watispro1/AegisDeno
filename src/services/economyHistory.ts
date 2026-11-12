/**
 * Pure helpers for /transactions: type groups, time periods and the
 * earned/spent summary for whatever the member is looking at.
 */
import type { Transaction, TransactionType } from "./economyStore";

export const HISTORY_PAGE_SIZE = 10;

export type HistoryGroup = "all" | "earnings" | "transfers" | "gambling" | "shop" | "bank" | "crime" | "staff";
export const HISTORY_GROUPS: Record<HistoryGroup, { label: string; types: readonly TransactionType[] | null }> = {
  all: { label: "Everything", types: null },
  earnings: { label: "Daily, weekly, work and interest", types: ["daily", "weekly", "work", "interest"] },
  transfers: { label: "Payments sent and received", types: ["pay_in", "pay_out"] },
  gambling: { label: "Gambling", types: ["gamble"] },
  shop: { label: "Shop: bought, sold, used, refunds", types: ["buy", "sell", "use", "refund"] },
  bank: { label: "Bank deposits and withdrawals", types: ["deposit", "withdraw"] },
  crime: { label: "Crime and robbery", types: ["crime", "crime_fine", "rob", "robbed", "rob_fine"] },
  staff: { label: "Staff changes", types: ["admin_give", "admin_take", "admin_reset"] },
};
export const isHistoryGroup = (v: unknown): v is HistoryGroup => typeof v === "string" && Object.hasOwn(HISTORY_GROUPS, v);

export type HistoryPeriod = "day" | "week" | "month" | "all";
export const HISTORY_PERIODS: Record<HistoryPeriod, { label: string; days: number | null }> = {
  day: { label: "Last 24 hours", days: 1 },
  week: { label: "Last 7 days", days: 7 },
  month: { label: "Last 30 days", days: 30 },
  all: { label: "Everything kept (90 days)", days: null },
};
export const isHistoryPeriod = (v: unknown): v is HistoryPeriod => typeof v === "string" && Object.hasOwn(HISTORY_PERIODS, v);

/** When a period starts, or undefined for everything kept. */
export function periodSince(period: HistoryPeriod, now: number): Date | undefined {
  const days = HISTORY_PERIODS[period].days;
  return days === null ? undefined : new Date(now - days * 86_400_000);
}

/** Moves between wallet and bank don't change what a member owns, so they stay out of earned/spent. */
const BANK_MOVES: ReadonlySet<TransactionType> = new Set(["deposit", "withdraw"]);

export interface HistorySummary { earned: number; spent: number; net: number; count: number }

export function summarizeHistory(rows: readonly Transaction[]): HistorySummary {
  let earned = 0;
  let spent = 0;
  for (const t of rows) {
    if (BANK_MOVES.has(t.type)) continue;
    if (t.amount > 0) earned += t.amount;
    else spent += -t.amount;
  }
  return { earned, spent, net: earned - spent, count: rows.length };
}
