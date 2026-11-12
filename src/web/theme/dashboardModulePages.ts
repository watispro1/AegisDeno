/**
 * Module pages (dashboard 1.4.x): summary strips, status pills, list toolbars
 * with filter chips and sorting, "show more", help panels and the on-page jump
 * list built by views/moduleKit.ts. Flat like the redesign: hairlines, no
 * shadows. Loaded after dashboardRedesign.ts and before responsive.ts.
 */
export const cssDashboardModulePages = `
/* Summary strip */
.module-stats { margin: 0 0 1.25rem; }
.module-stats .stat-hint { margin: .1rem 0 0; font: 400 .76rem/1.35 var(--sans); color: var(--muted); }
.module-stats .stat-ok dd:not(.stat-hint) { color: var(--ok); }
.module-stats .stat-warn dd:not(.stat-hint) { color: var(--warn); }
.module-stats .stat-bad dd:not(.stat-hint) { color: var(--danger); }
.module-stats .stat-off dd:not(.stat-hint) { color: var(--faint); }

/* Status pills */
.pill { display: inline-flex; align-items: center; gap: .35rem; padding: .08rem .55rem; border: 1px solid currentColor; border-radius: 999px; font: 600 .74rem/1.5 var(--mono); white-space: nowrap; vertical-align: middle; }
.pill::before { content: ""; width: .45rem; height: .45rem; border-radius: 50%; background: currentColor; }
.pill-ok { color: var(--ok); }
.pill-warn { color: var(--warn); }
.pill-bad { color: var(--danger); }
.pill-info { color: var(--accent); }
.pill-off { color: var(--faint); }

/* List toolbar: search, sort, chips */
.list-tools { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem .75rem; margin: .25rem 0 .75rem; }
.list-tools .table-search { flex: 1 1 14rem; min-width: 0; }
.list-sort { display: inline-flex; align-items: center; gap: .4rem; font-size: .85rem; color: var(--muted); }
.list-sort select { min-height: 36px; padding: .2rem .5rem; font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--border-strong); border-radius: var(--r); }
.chip-row { display: flex; flex-wrap: wrap; gap: .35rem; flex: 1 0 100%; }
.chip { display: inline-flex; align-items: center; gap: .35rem; min-height: 32px; padding: .2rem .7rem; font: 500 .82rem var(--sans); color: var(--muted); background: transparent; border: 1px solid var(--border-strong); border-radius: 999px; cursor: pointer; }
.chip:hover { color: var(--text); border-color: var(--text); }
.chip[aria-pressed="true"] { color: var(--accent-ink, var(--text)); background: var(--accent-soft); border-color: var(--accent); }
.chip-count { font: 600 .72rem var(--mono); color: var(--faint); }
.chip[aria-pressed="true"] .chip-count { color: inherit; }
html:not(.js) .chip-row, html:not(.js) .list-sort { display: none; }
tr[data-chip-out], tr[data-paged-out] { display: none; }
.list-more { margin: .6rem 0 0; }
.list-more[hidden], .list-empty[hidden] { display: none; }

/* Cells: a main line and a faint second line */
.cell-sub { display: block; margin-top: .1rem; font-size: .8rem; color: var(--faint); }
.cell-actions { display: flex; flex-wrap: wrap; gap: .35rem; align-items: center; }
.cell-actions .inline-form { margin: 0; }

.amount-in { color: var(--ok); font-variant-numeric: tabular-nums; }
.amount-out { color: var(--danger); font-variant-numeric: tabular-nums; }

/* Help panel */
.help-panel { margin: 0 0 1rem; border: 1px solid var(--border); border-radius: var(--r-lg, var(--r)); background: var(--surface); }
.help-panel > summary { padding: .6rem .9rem; cursor: pointer; font-weight: 600; font-size: .9rem; }
.help-panel > summary::marker { color: var(--faint); }
.help-panel[open] > summary { border-bottom: 1px solid var(--border); }
.help-panel dl { display: grid; grid-template-columns: minmax(8rem, 14rem) minmax(0, 1fr); gap: .45rem 1rem; margin: 0; padding: .75rem .9rem; font-size: .88rem; }
.help-panel dt { font-weight: 600; }
.help-panel dd { margin: 0; color: var(--muted); }

/* On this page */
.section-jump { margin: 0 0 1.25rem; }
.section-jump ul { display: flex; flex-wrap: wrap; gap: .35rem; margin: 0; padding: 0; list-style: none; }
.section-jump a { display: inline-block; padding: .2rem .65rem; font: 500 .8rem var(--mono); color: var(--muted); text-decoration: none; border: 1px solid var(--border); border-radius: var(--r); }
.section-jump a:hover { color: var(--accent); border-color: var(--accent); }
.panel-card[id], section[id] { scroll-margin-top: calc(var(--nav-h, 3.5rem) + 1rem); }

/* Section header with actions on the right */
.section-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: .5rem 1rem; }
.section-head h2 { margin-bottom: .25rem; }

/* Quick links above a list (case types, appeal tabs) */
.quick-filters { display: flex; flex-wrap: wrap; gap: .35rem; margin: 0 0 1rem; padding: 0; list-style: none; }
.quick-filters a { display: inline-flex; align-items: center; min-height: 32px; padding: .15rem .7rem; font-size: .84rem; color: var(--muted); text-decoration: none; border: 1px solid var(--border-strong); border-radius: 999px; }
.quick-filters a:hover { color: var(--text); border-color: var(--text); }
.quick-filters a[aria-current="true"] { color: var(--text); background: var(--accent-soft); border-color: var(--accent); }

/* Statement / quoted text */
.quote-block { margin: 0; padding: .75rem 1rem; border-left: 3px solid var(--border-strong); background: var(--bg-sunk, var(--surface)); border-radius: 0 var(--r) var(--r) 0; white-space: pre-wrap; overflow-wrap: anywhere; }

/* Collapsible filter form on small screens */
.filter-toggle > summary { cursor: pointer; font-weight: 600; margin: 0 0 .5rem; }

@media (max-width: 640px) {
  .help-panel dl { grid-template-columns: minmax(0, 1fr); gap: .15rem; }
  .help-panel dd { margin-bottom: .45rem; }
  .list-tools .table-search { flex-basis: 100%; }
  .case-table td.cell-actions-td { padding-left: 0; }
  .case-table td.cell-actions-td::before { display: none; }
  .module-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;
