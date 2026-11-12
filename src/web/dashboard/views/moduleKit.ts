/**
 * Building blocks for the module pages (cases, appeals, ModMail, automation,
 * economy, Incident Mode…): a summary strip, status pills, a list toolbar
 * (search, filter chips, sort, "show more"), help panels and an on-page jump
 * list. Styled by theme/dashboardModulePages.ts; the toolbar is driven by
 * clientModulePages.ts and every list still shows in full without JavaScript.
 * No inline styles, scripts or handlers.
 */
import { escapeHtml as esc } from "../../pages";

export type Tone = "ok" | "warn" | "bad" | "info" | "off";

export interface SummaryItem {
  label: string;
  value: string | number;
  /** Trusted markup shown instead of value, such as relTime()'s <time>. */
  html?: string;
  /** A short line under the value (plain text). */
  hint?: string;
  /** Makes the cell a link, such as to a filtered list. */
  href?: string;
  tone?: Tone;
}

function fmtValue(v: string | number): string {
  return typeof v === "number" ? v.toLocaleString("en-US") : v;
}

/** The page's summary strip: one bordered band of figures, like the overview's. */
export function summaryStrip(items: SummaryItem[], label = "Summary"): string {
  if (!items.length) return "";
  const cell = (i: SummaryItem) => {
    const stat = `<div class="stat${i.tone ? ` stat-${i.tone}` : ""}"><dt>${esc(i.label)}</dt><dd>${i.html ?? esc(fmtValue(i.value))}</dd>${i.hint ? `<dd class="stat-hint">${esc(i.hint)}</dd>` : ""}</div>`;
    return i.href ? `<a class="stat-link" href="${esc(i.href)}">${stat}</a>` : stat;
  };
  return `<dl class="stat-grid module-stats" aria-label="${esc(label)}">${items.map(cell).join("")}</dl>`;
}

/** A small coloured status label. */
export function pill(label: string, tone: Tone = "info"): string {
  return `<span class="pill pill-${tone}">${esc(label)}</span>`;
}

export interface ChipOption { value: string; label: string; count?: number }
export interface SortOption { value: string; label: string }

/**
 * Toolbar for table #id: a search box (the existing data-filter-target filter),
 * optional filter chips matching each row's data-chip-value, and an optional
 * sort menu ("key:asc" / "key:desc" over each row's data-sort-key).
 */
export function listTools(id: string, o: { search: string; chips?: ChipOption[]; chipLabel?: string; sorts?: SortOption[] }): string {
  const i = esc(id);
  const total = o.chips?.reduce((n, c) => n + (c.count ?? 0), 0);
  const chips = o.chips?.length
    ? `<div class="chip-row" role="group" aria-label="${esc(o.chipLabel ?? "Show")}">
      <button type="button" class="chip" data-chip-for="${i}" data-chip="" aria-pressed="true">All${total !== undefined ? ` <span class="chip-count">${total}</span>` : ""}</button>
      ${o.chips.map(c => `<button type="button" class="chip" data-chip-for="${i}" data-chip="${esc(c.value)}" aria-pressed="false">${esc(c.label)}${c.count !== undefined ? ` <span class="chip-count">${c.count}</span>` : ""}</button>`).join("")}
    </div>`
    : "";
  const sort = o.sorts?.length
    ? `<span class="list-sort"><label for="sort-${i}">Sort</label>
      <select id="sort-${i}" data-sort-target="${i}"><option value="">As listed</option>${o.sorts.map(s => `<option value="${esc(s.value)}">${esc(s.label)}</option>`).join("")}</select></span>`
    : "";
  return `<div class="list-tools table-tools">
    <label class="visually-hidden" for="filter-${i}">${esc(o.search)}</label>
    <input class="table-search" type="search" id="filter-${i}" placeholder="${esc(o.search)}" data-filter-target="${i}" autocomplete="off">
    ${sort}
    <span class="faint" data-filter-count="${i}" aria-live="polite"></span>
    ${chips}
  </div>`;
}

/** Row attributes for listTools: the chip value and the sort keys. */
export function rowAttrs(chip: string | null, sort: Record<string, string | number | null | undefined> = {}): string {
  const parts: string[] = [];
  if (chip !== null) parts.push(` data-chip-value="${esc(chip)}"`);
  for (const [k, v] of Object.entries(sort)) {
    if (v === null || v === undefined) continue;
    parts.push(` data-sort-${esc(k.toLowerCase().replace(/[^a-z0-9-]/g, ""))}="${esc(String(v))}"`);
  }
  return parts.join("");
}

/** The "Show more" button and the "nothing matches" line that follow a list built with listTools. */
export function listFoot(id: string, emptyText = "Nothing matches. Clear the search or pick another filter."): string {
  const i = esc(id);
  return `<p class="muted list-empty" data-list-empty="${i}" hidden>${esc(emptyText)}</p>
  <button type="button" class="btn ghost sm list-more" data-more-for="${i}" hidden>Show more</button>`;
}

/** Table attributes for "show more" paging in the browser; every row is still sent. */
export function pagedTable(pageSize = 20): string {
  return ` data-filterable data-page-size="${Math.max(1, Math.floor(pageSize))}"`;
}

/** Collapsible "How this works" notes. Descriptions may hold trusted markup (code tags). */
export function helpPanel(title: string, items: Array<[string, string]>, open = false): string {
  return `<details class="help-panel"${open ? " open" : ""}><summary>${esc(title)}</summary>
    <dl>${items.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${d}</dd>`).join("")}</dl></details>`;
}

/** A jump list for long pages: [anchor id, label]. */
export function sectionJump(links: Array<[string, string]>): string {
  return `<nav class="section-jump" aria-label="On this page"><ul>${links.map(([id, label]) => `<li><a href="#${esc(id)}">${esc(label)}</a></li>`).join("")}</ul></nav>`;
}

/** Counts rows by a key, keeping the order keys first appear in. */
export function countBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** The earliest date in a list, or null. */
export function soonest(dates: ReadonlyArray<Date | null | undefined>): Date | null {
  let best: Date | null = null;
  for (const d of dates) if (d && !Number.isNaN(d.getTime()) && (!best || d < best)) best = d;
  return best;
}

/** "3 of 25 used": a share for the summary strip, with a warning tone near the limit. */
export function usage(used: number, max: number): SummaryItem & { tone: Tone } {
  const share = max > 0 ? used / max : 0;
  return { label: "Used", value: `${used} / ${max}`, tone: share >= 1 ? "bad" : share >= 0.8 ? "warn" : "ok", hint: share >= 1 ? "At the limit" : `${Math.max(0, max - used)} left` };
}
