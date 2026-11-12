/**
 * Card-list tools for the community pages (polls, suggestions…): the same
 * search / filter chips / sort / "show more" toolbar as moduleKit.listTools,
 * but over a <ul> of cards instead of table rows. Driven by
 * clientCommunityPages.ts; without JavaScript every card is shown as sent and
 * the toolbar is hidden. No inline styles, scripts or handlers.
 */
import { escapeHtml as esc } from "../../pages";
import type { ChipOption, SortOption } from "./moduleKit";

export function cardTools(id: string, o: { search: string; chips?: ChipOption[]; chipLabel?: string; sorts?: SortOption[] }): string {
  const i = esc(id);
  const total = o.chips?.reduce((n, c) => n + (c.count ?? 0), 0);
  const chip = (value: string, label: string, count: number | undefined, on: boolean) =>
    `<button type="button" class="chip" data-cl-chip-for="${i}" data-cl-chip="${esc(value)}" aria-pressed="${on}">${esc(label)}${count !== undefined ? ` <span class="chip-count">${count}</span>` : ""}</button>`;
  const chips = o.chips?.length
    ? `<div class="chip-row" role="group" aria-label="${esc(o.chipLabel ?? "Show")}">${chip("", "All", total, true)}${o.chips.map(c => chip(c.value, c.label, c.count, false)).join("")}</div>`
    : "";
  const sort = o.sorts?.length
    ? `<span class="list-sort"><label for="cl-sort-${i}">Sort</label>
      <select id="cl-sort-${i}" data-cl-sort="${i}"><option value="">As listed</option>${o.sorts.map(s => `<option value="${esc(s.value)}">${esc(s.label)}</option>`).join("")}</select></span>`
    : "";
  return `<div class="list-tools card-tools">
    <label class="visually-hidden" for="cl-q-${i}">${esc(o.search)}</label>
    <input class="table-search" type="search" id="cl-q-${i}" placeholder="${esc(o.search)}" data-cl-search="${i}" autocomplete="off">
    ${sort}
    <span class="faint" data-cl-count="${i}" aria-live="polite"></span>
    ${chips}
  </div>`;
}

/** Attributes for a <ul> driven by cardTools: its page size for "show more". */
export function cardList(pageSize = 10): string {
  return ` data-card-list data-page-size="${Math.max(1, Math.floor(pageSize))}"`;
}

/** The "nothing matches" line and "Show more" button after a card list. */
export function cardFoot(id: string, emptyText = "Nothing matches. Clear the search or pick another filter."): string {
  const i = esc(id);
  return `<p class="muted list-empty" data-cl-empty="${i}" hidden>${esc(emptyText)}</p>
  <button type="button" class="btn ghost sm list-more" data-cl-more="${i}" hidden>Show more</button>`;
}

/** Whole seconds since the epoch for sort keys, or null. */
export function epoch(d: Date | null | undefined): number | null {
  return d && !Number.isNaN(d.getTime()) ? Math.floor(d.getTime() / 1000) : null;
}

/** "Mondays at 09:00 UTC" from raw form values; null when a value is out of range. */
export function scheduleLine(day: number, hour: number, timezone: string, days: readonly string[]): string | null {
  if (!Number.isInteger(day) || day < 0 || day >= days.length) return null;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  const tz = timezone.trim() || "UTC";
  return `${days[day]}s at ${String(hour).padStart(2, "0")}:00 ${tz}`;
}
