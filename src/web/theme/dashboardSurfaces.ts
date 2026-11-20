/**
 * Dashboard 2.0 surfaces, shared by every server page: page headers, cards,
 * stat cards, tables, forms and fields, empty states, notices, module cards,
 * the Common settings tiles, chips and small buttons. One radius scale
 * (--d-r, --d-r-lg), one depth (--d-shadow) and one focus ring, so every page
 * looks like part of the same app. Scoped to .app-body; tokens only.
 */
export const cssDashboardSurfaces = String.raw`/* ── Dashboard 2.0: surfaces ───────────────────────────────────────── */
/* Page header */
.app-body .app-content > .breadcrumbs { margin: 0 0 .5rem; padding: 0; font-size: .8rem; }
.app-body .dash-head { align-items: flex-end; gap: .75rem 1.5rem; margin: 0 0 1.5rem; padding: 0; border-bottom: 0; }
.app-body .dash-head h1 { margin: .1rem 0 .3rem; font-size: clamp(1.5rem, 2.4vw, 1.95rem); font-weight: 700; letter-spacing: -.02em; line-height: 1.15; }
.app-body .dash-head .lead { font-size: .95rem; }
.app-body .dash-eyebrow { color: var(--muted); font-size: .7rem; }
.app-body .dash-head-actions { gap: .5rem; }
.app-body .btn .ico { flex: none; width: 16px; height: 16px; }
.app-body .btn { border-radius: var(--d-r); }
.app-body .btn.sm { min-height: 38px; }
.app-body .btn.xs { min-height: 28px; border-radius: calc(var(--d-r) - 2px); }

/* Cards */
.app-body .app-content .panel-card { margin: 0 0 var(--d-gap); padding: 1.15rem 1.25rem; border: 1px solid var(--border); border-radius: var(--d-r-lg); background-color: var(--surface); box-shadow: var(--d-shadow); }
.app-body .panel-card > h2:first-child, .app-body .card-head h2 { margin: 0 0 .85rem; font-size: 1rem; font-weight: 650; letter-spacing: -.005em; }
.card-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .4rem 1rem; margin: 0 0 .85rem; }
.app-body .card-head h2 { margin: 0; }
.card-foot { margin: .85rem 0 0; }
.app-body .panel-card > :last-child { margin-bottom: 0; }
.app-body .text-link { font-weight: 500; font-size: .88rem; }

/* Stat cards (overview and module pages) */
.app-body .app-content .stat-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(min(11rem, 100%), 1fr)); gap: .75rem;
  margin: 0 0 var(--d-gap); padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; overflow: visible;
}
.app-body .app-content .stat-grid > * { margin: 0; border: 1px solid var(--border); border-radius: var(--d-r-lg); background-color: var(--surface); box-shadow: var(--d-shadow); }
.app-body .stat { padding: .9rem 1rem; transition: border-color .15s var(--d-ease), box-shadow .15s var(--d-ease); }
.app-body .stat:hover { background-color: var(--surface); }
.app-body .stat:has(.stat-link:hover) { border-color: var(--accent); box-shadow: var(--d-shadow-hover); }
.app-body .stat dt { display: flex; align-items: center; gap: .5rem; font: 500 .8rem/1.3 var(--sans); letter-spacing: 0; text-transform: none; color: var(--muted); }
.app-body .stat dd { margin: .55rem 0 0; font: 650 1.55rem/1.15 var(--sans); font-variant-numeric: tabular-nums; letter-spacing: -.01em; color: var(--text); }
.app-body .module-stats dd { font-size: 1.2rem; }
.app-body .stat dd small { font: 500 .75rem var(--sans); color: var(--faint); }
.app-body .stat-link:hover dd { color: var(--text); }
.stat-ico { display: inline-grid; place-items: center; flex: none; width: 1.75rem; height: 1.75rem; border-radius: var(--d-r); background: var(--accent-soft); color: var(--accent); }
.stat-ico .ico { width: 15px; height: 15px; }
.stat[data-tone="warn"] .stat-ico { background: color-mix(in srgb, var(--warn) 16%, transparent); color: var(--warn); }

/* Tables */
.app-body .app-content .table-wrap { border: 1px solid var(--border); border-radius: var(--d-r-lg); background-color: var(--surface); box-shadow: var(--d-shadow); }
.app-body .panel-card .table-wrap { box-shadow: none; }
@media (min-width: 641px) {
  .app-body .app-content th { padding: .6rem .9rem; background: var(--bg-sunk); font: 600 .72rem/1.3 var(--sans); letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
  .app-body .app-content td { padding: .65rem .9rem; vertical-align: middle; }
  .app-body .app-content tbody tr { transition: background-color .12s var(--d-ease); }
  .app-body .app-content tbody tr:hover { background: var(--hover); }
}
.app-body td[data-label="When"], .app-body td[data-label="Action"] { white-space: nowrap; }
.app-body td .faint { font-size: .78rem; }
.app-body .copy-id { display: inline-flex; align-items: center; justify-content: center; min-width: 28px; min-height: 28px; padding: 0 .3rem; vertical-align: middle; color: var(--muted); }
.app-body .copy-id:hover { color: var(--text); }
.copy-id .ico { width: 14px; height: 14px; }
.app-body .tag { border-radius: 999px; }

/* Forms and fields */
.app-body .dash-form fieldset, .app-body .mod-settings > fieldset { margin: 0 0 var(--d-gap); padding: 1.1rem 1.25rem 1.25rem; border: 1px solid var(--border); border-radius: var(--d-r-lg); background-color: var(--surface); box-shadow: var(--d-shadow); }
.app-body .dash-form legend { padding: 0 .35rem; font-size: 1rem; font-weight: 650; }
.app-body .field input[type="text"], .app-body .field input[type="number"], .app-body .field input[type="url"],
.app-body .field select, .app-body .field textarea, .app-body .filter-bar input, .app-body .filter-bar select,
.app-body .table-search, .app-body .mod-filter {
  min-height: 40px; border: 1px solid var(--border-strong); border-radius: var(--d-r); background-color: var(--bg); color: var(--text);
  transition: border-color .15s var(--d-ease), background-color .15s var(--d-ease);
}
.app-body .field input:hover, .app-body .field select:hover, .app-body .field textarea:hover { border-color: var(--muted); }
.app-body .field input:focus-visible, .app-body .field select:focus-visible, .app-body .field textarea:focus-visible,
.app-body .filter-bar input:focus-visible, .app-body .filter-bar select:focus-visible, .app-body .table-search:focus-visible, .app-body .mod-filter:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent);
}
.app-body .field [aria-invalid="true"] { border-color: var(--danger); }
.app-body .error-summary, .app-body .notice { border-radius: var(--d-r); }

/* Empty states */
.app-body .app-content .empty-state:not([hidden]) { display: flex; gap: .9rem; align-items: flex-start; padding: 1.15rem 1.25rem; border: 1px dashed var(--border-strong); border-radius: var(--d-r-lg); background: transparent; }
.app-body .app-content .empty-state:not([hidden]):not(:has(> .empty-body)) { display: block; }
.app-body .empty-icon { display: inline-grid; place-items: center; flex: none; width: 2.4rem; height: 2.4rem; border-radius: var(--d-r); background: var(--accent-soft); color: var(--accent); font-size: 1.05rem; }
.app-body .empty-body { color: var(--muted); font-size: .92rem; }
.app-body .empty-body > strong:first-child { color: var(--text); font-size: .98rem; }
.app-body .panel-card .empty-state { margin: 0; }

/* Module cards, Common settings tiles, chips */
.app-body .mod-card { border-radius: var(--d-r-lg); box-shadow: var(--d-shadow); transition: border-color .15s var(--d-ease), box-shadow .15s var(--d-ease); }
.app-body .mod-card:hover { box-shadow: var(--d-shadow-hover); }
.app-body .mod-icon { display: inline-grid; place-items: center; border-radius: var(--d-r); color: var(--accent); }
.mod-icon .ico { width: 17px; height: 17px; }
.app-body .quick-settings { grid-template-columns: repeat(auto-fill, minmax(min(12rem, 100%), 1fr)); gap: .6rem; }
.app-body .quick-settings li { margin: 0; }
.app-body .quick-head h2 { font-size: 1rem; font-weight: 650; }
.app-body .quick-tile { padding: .7rem .85rem; border-radius: var(--d-r); background-color: var(--bg); transition: border-color .15s var(--d-ease), background-color .15s var(--d-ease); }
.app-body .quick-tile:hover { border-color: var(--accent); background-color: var(--surface); }
.app-body .mod-chip, .app-body .chip { border-radius: 999px; }
.app-body .count-badge { border-radius: 999px; }
.app-body .tabs a { border-radius: var(--d-r) var(--d-r) 0 0; }

/* Checklist, feed and chart inside cards */
.app-body .checklist li { margin-bottom: .75rem; }
.app-body .feed li { padding: .55rem 0; }
.app-body .chart .bar { rx: 3px; ry: 3px; }
.app-body .check-ok { display: flex; align-items: center; gap: .5rem; margin: 0; }

@media (max-width: 640px) {
  .app-body .dash-head-actions { width: 100%; }
  .app-body .app-content .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .55rem; }
  .app-body .stat { padding: .75rem .8rem; }
  .app-body .stat dd { font-size: 1.3rem; }
  .app-body .app-content .panel-card { padding: 1rem; }
  .app-body .quick-settings { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;
