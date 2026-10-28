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
