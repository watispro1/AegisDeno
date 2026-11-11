/** Pure pagination helpers for /case user. */

export const CASES_PER_PAGE = 5;
/** Upper bound on how many cases /case user loads for paging. */
export const MAX_CASES_BROWSABLE = 100;

export interface PageInfo {
  page: number;       // zero-based, clamped
  totalPages: number; // at least 1
  start: number;      // index of first item on the page
  end: number;        // exclusive
  hasPrev: boolean;
  hasNext: boolean;
}

export function pageInfo(total: number, requestedPage: number, perPage = CASES_PER_PAGE): PageInfo {
  const size = Math.max(1, Math.floor(perPage));
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / size));
  const page = Math.min(Math.max(0, Math.floor(requestedPage) || 0), totalPages - 1);
  const start = page * size;
  return {
    page,
    totalPages,
    start,
    end: Math.min(start + size, Math.max(0, total)),
    hasPrev: page > 0,
    hasNext: page < totalPages - 1,
  };
}

export function stepPage(current: number, direction: "prev" | "next", total: number, perPage = CASES_PER_PAGE): number {
  return pageInfo(total, current + (direction === "next" ? 1 : -1), perPage).page;
}

export type PageMove = "first" | "prev" | "next" | "last";

/** Move to the first/previous/next/last page, clamped to the range. */
export function movePage(current: number, move: PageMove, total: number, perPage = CASES_PER_PAGE): number {
  const { totalPages } = pageInfo(total, 0, perPage);
  if (move === "first") return 0;
  if (move === "last") return totalPages - 1;
  return stepPage(current, move, total, perPage);
}

/** First/Last buttons only earn their place once there are more than two pages. */
export function showJumpButtons(totalPages: number): boolean {
  return totalPages > 2;
}

/** Case actions /case user can filter by (the same set /case search offers). */
export const CASE_USER_ACTIONS = ["warn", "timeout", "untimeout", "kick", "ban", "softban", "unban", "temprole", "clearwarnings", "purge", "lock", "unlock"] as const;

export interface CaseUserFilter {
  action?: string | null;
  /** Leave out cases that were undone (revoked). */
  hideRevoked?: boolean;
}

/** The Mongo filter behind /case user. Uses the (guildId, userId, createdAt) index. */
export function caseUserQuery(guildId: string, userId: string, filter: CaseUserFilter = {}): Record<string, unknown> {
  const query: Record<string, unknown> = { guildId, userId };
  if (filter.action) query.action = filter.action;
  if (filter.hideRevoked) query.revoked = { $ne: true };
  return query;
}

/** "Case History for x (12)", or "(showing 100 of 240)" when the list was capped. */
export function caseCountLabel(loaded: number, total: number): string {
  return total > loaded ? `showing ${loaded} of ${total}` : String(loaded);
}

/** A human summary of the active filters for the embed footer, or "" when there are none. */
export function describeCaseFilter(filter: CaseUserFilter): string {
  const parts: string[] = [];
  if (filter.action) parts.push(`action: ${filter.action}`);
  if (filter.hideRevoked) parts.push("revoked hidden");
  return parts.join(" · ");
}
