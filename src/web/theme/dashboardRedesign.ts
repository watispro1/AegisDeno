/**
 * Dashboard redesign (1.4.0): the flat look of the redesigned public pages
 * (changelog, status) carried into the dashboard. Thin borders, no shadows,
 * no hover lifts. Styles the hooks added in views/layout.ts and views/public.ts:
 * the stats strip, sidebar filter / footer / collapsed state, the page header,
 * the error page, the landing hero, picker cards, the navigation progress bar,
 * empty states and focus rings. Loaded before responsive.ts.
 */
export const cssDashboardRedesign = `
/* Stats strip: one bordered band, cells split by hairlines (like .cl-stats). */
.stat-grid { gap: 0; border: 1px solid var(--border); border-radius: var(--r-lg, var(--r)); background: var(--surface); overflow: hidden; grid-template-columns: repeat(auto-fit, minmax(min(10rem, 100%), 1fr)); }
.stat-grid > .stat, .stat-grid > .stat-link > .stat, .stat-grid > li { border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.stat-grid > * { border-left: 1px solid var(--border); border-top: 1px solid var(--border); margin: -1px 0 0 -1px; min-width: 0; }
.stat { transition: none; }
.stat:hover { box-shadow: none; border-color: var(--border); transform: none; }
.stat dt { font: 500 .72rem/1.4 var(--mono); color: var(--faint); text-transform: uppercase; letter-spacing: .05em; }
.stat dd { font: 600 1.35rem/1.3 var(--mono); font-variant-numeric: tabular-nums; }
.stat-link:hover .stat dd { color: var(--accent); }
.card, .panel, .stat, .guild-item, .dash-fact { box-shadow: none; }
.card:hover, .guild-item:hover { transform: none; box-shadow: none; }

/* Sidebar: brand, filter, footer */
.side-brand { display: flex; align-items: center; gap: .6rem; min-width: 0; color: var(--text); text-decoration: none; border-radius: var(--r); padding: .2rem; }
.side-brand:hover .side-brand-name { color: var(--accent); }
.side-brand-text { display: flex; flex-direction: column; min-width: 0; }
.side-brand-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.side-brand-meta { font: 400 .74rem/1.3 var(--mono); color: var(--faint); }
.side-filter { margin: .75rem 0 .5rem; }
.side-filter-input { width: 100%; min-height: 36px; padding: .3rem .6rem; font: inherit; font-size: .88rem; color: var(--text); background: var(--bg); border: 1px solid var(--border-strong); border-radius: var(--r); }
.side-filter-input:focus { border-color: var(--accent); outline: 2px solid var(--accent-soft); outline-offset: 0; }
.side-filter-empty { margin: .4rem .2rem 0; font-size: .82rem; }
[data-nav-item][hidden], .nav-group[hidden] { display: none; }
.side-link mark { background: var(--accent-soft); color: inherit; border-radius: 2px; }
.side-foot { display: flex; flex-wrap: wrap; gap: .25rem .9rem; margin-top: 1.25rem; padding: .75rem .4rem 0; border-top: 1px solid var(--border); }
.side-foot-link { font: 500 .78rem var(--mono); color: var(--faint); text-decoration: none; }
.side-foot-link:hover { color: var(--accent); text-decoration: underline; }
.switcher-filter { padding: .35rem .4rem; }
.switcher-filter input { width: 100%; min-height: 34px; padding: .25rem .5rem; font: inherit; font-size: .88rem; color: var(--text); background: var(--bg); border: 1px solid var(--border-strong); border-radius: var(--r); }
.switcher-list li[hidden] { display: none; }

/* Sidebar collapse toggle and collapsed state (desktop only; set by dashboard.js). */
.side-collapse { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 1px solid var(--border); border-radius: var(--r); background: transparent; color: var(--muted); cursor: pointer; }
.side-collapse:hover { color: var(--text); border-color: var(--border-strong); }
.side-collapse[aria-pressed="true"] span[aria-hidden] { display: inline-block; transform: scaleX(-1); }
.app[data-collapsed] { grid-template-columns: 3.75rem minmax(0, 1fr); }
.app[data-collapsed] .app-side { padding-left: .4rem; padding-right: .4rem; overflow-x: hidden; }
.app[data-collapsed] .side-brand-text, .app[data-collapsed] .side-filter, .app[data-collapsed] .side-foot,
.app[data-collapsed] .nav-group-title { display: none; }
.app[data-collapsed] .side-link { justify-content: center; padding: .3rem; font-size: 0; gap: 0; }
.app[data-collapsed] .side-link .side-icon { font-size: 1rem; width: auto; }
.app[data-collapsed] .side-brand { justify-content: center; }

/* Page header */
.dash-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: .75rem 1.5rem; margin: 0 0 1.5rem; padding: 0 0 1rem; border-bottom: 1px solid var(--border); }
.dash-head-text { min-width: 0; flex: 1 1 22rem; }
.dash-head h1 { margin: .1rem 0 .3rem; }
.dash-head .lead { margin: 0; max-width: 72ch; }
.dash-eyebrow { display: block; font: 500 .74rem/1.4 var(--mono); color: var(--faint); text-transform: uppercase; letter-spacing: .05em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dash-head-actions { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }

/* Navigation progress bar */
.nav-progress { position: fixed; top: 0; left: 0; z-index: 1000; height: 2px; width: 0; background: var(--accent); opacity: 0; pointer-events: none; }
.nav-progress.is-active { opacity: 1; width: 80%; transition: width 8s cubic-bezier(.1,.7,.2,1), opacity .1s; }
.nav-progress.is-done { opacity: 0; width: 100%; transition: width .15s, opacity .3s .15s; }

/* Unsaved bar */
.unsaved-text { display: inline-flex; align-items: center; gap: .5rem; }
.unsaved-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--warn, #b7791f); flex: none; }
.unsaved-count { font: 500 .8rem var(--mono); color: var(--faint); }
.unsaved-count:empty { display: none; }
.unsaved-kbd { margin-left: .35rem; padding: 0 .3rem; font: 500 .7rem var(--mono); border: 1px solid currentColor; border-radius: 3px; opacity: .7; }

/* Empty states */
.empty-state { display: flex; align-items: flex-start; gap: .8rem; padding: 1rem 1.1rem; border: 1px dashed var(--border-strong); border-radius: var(--r-lg, var(--r)); background: transparent; color: var(--muted); }
.empty-state[hidden] { display: none; }
.empty-icon { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border: 1px solid var(--border); border-radius: 50%; font: 500 1rem var(--mono); color: var(--faint); }
.empty-body strong { color: var(--text); }
.empty-action { margin-left: .4rem; }

/* Error page */
.dash-error { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2rem; align-items: start; max-width: 52rem; margin: 3rem auto; padding: 1.5rem; border: 1px solid var(--border); border-radius: var(--r-lg, var(--r)); background: var(--surface); }
.dash-error-code { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 7rem; padding: 1rem; border: 1px solid var(--border); border-radius: var(--r); background: var(--bg); }
.dash-error-code span { font: 600 2.4rem/1 var(--mono); color: var(--accent); font-variant-numeric: tabular-nums; }
.dash-error[data-status^="5"] .dash-error-code span { color: var(--danger, #b42318); }
.dash-error-code small { margin-top: .35rem; font: 500 .72rem var(--mono); color: var(--faint); text-transform: uppercase; letter-spacing: .05em; text-align: center; }
.dash-error-body h1 { margin-top: 0; }
.dash-error-hints { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border); }
.dash-error-hints h2 { margin: 0 0 .4rem; font: 500 .74rem var(--mono); color: var(--faint); text-transform: uppercase; letter-spacing: .05em; }
.dash-error-hints ul { margin: 0; padding-left: 1.1rem; color: var(--muted); }

/* Landing hero */
.dash-landing { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 2.5rem; align-items: center; margin: 2.5rem 0 2rem; padding-bottom: 2rem; border-bottom: 1px solid var(--border); }
.dash-landing-text h1 { margin: .2rem 0 .6rem; }
.dash-landing-preview { list-style: none; margin: 0; padding: 0; border: 1px solid var(--border); border-radius: var(--r-lg, var(--r)); background: var(--surface); }
.dash-landing-preview li { display: flex; align-items: center; gap: .6rem; padding: .7rem 1rem; border-top: 1px solid var(--border); font-size: .92rem; }
.dash-landing-preview li:first-child { border-top: 0; }
.lp-dot { width: 8px; height: 8px; border-radius: 50%; border: 1px solid var(--border-strong); flex: none; }
.lp-dot.on { background: var(--accent); border-color: var(--accent); }
.lp-n { margin-left: auto; font: 400 .78rem var(--mono); color: var(--faint); }
.dash-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(15rem, 100%), 1fr)); gap: 0; list-style: none; padding: 0; margin: 0 0 2rem; border: 1px solid var(--border); border-radius: var(--r-lg, var(--r)); }
.dash-fact { display: grid; grid-template-columns: auto 1fr; gap: .15rem .7rem; padding: 1rem 1.1rem; border-left: 1px solid var(--border); border-top: 1px solid var(--border); margin: -1px 0 0 -1px; }
.dash-fact-icon { grid-row: span 2; color: var(--accent); font: 500 1.1rem var(--mono); }
.dash-fact span:last-child { color: var(--muted); font-size: .9rem; }

/* Server picker cards */
.picker-tools { display: flex; flex-wrap: wrap; align-items: center; gap: .6rem; margin: 0 0 1rem; }
.guild-list { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(18rem, 100%), 1fr)); gap: .6rem; }
.guild-list li[hidden] { display: none; }
.guild-item { display: flex; align-items: center; gap: .75rem; min-height: 64px; padding: .7rem .9rem; border: 1px solid var(--border); border-radius: var(--r-lg, var(--r)); background: var(--surface); color: var(--text); text-decoration: none; transition: border-color .12s ease; }
.guild-item:hover { border-color: var(--accent); }
.guild-item.last-used { border-color: var(--border-strong); }
.guild-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.guild-text .name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.guild-role { font: 400 .76rem var(--mono); color: var(--faint); }
.guild-go { color: var(--faint); }
.guild-item:hover .guild-go { color: var(--accent); }
.picker-icon { flex: none; width: 40px; height: 40px; border-radius: 50%; }
.picker-icon.has-img { object-fit: cover; }
.guild-list-invite .guild-item { border-style: dashed; background: transparent; }

/* Footer */
.dash-foot-links { white-space: nowrap; }

/* Focus rings */
.side-link:focus-visible, .side-brand:focus-visible, .guild-item:focus-visible, .side-foot-link:focus-visible,
.side-collapse:focus-visible, .stat-link:focus-visible, .empty-action:focus-visible, .dash-head-actions :focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .nav-progress, .nav-progress.is-active, .nav-progress.is-done, .guild-item { transition: none; }
}

@media (max-width: 900px) {
  .side-collapse { display: none; }
  .app[data-collapsed] { grid-template-columns: minmax(0, 1fr); }
  .app[data-collapsed] .side-brand-text, .app[data-collapsed] .side-filter, .app[data-collapsed] .side-foot { display: revert; }
  .app[data-collapsed] .nav-group-title { display: flex; }
  .app[data-collapsed] .side-link { justify-content: flex-start; font-size: .93rem; gap: .6rem; padding: .3rem .6rem; }
  .dash-landing { grid-template-columns: minmax(0, 1fr); gap: 1.5rem; margin-top: 1.5rem; }
  .dash-error { grid-template-columns: minmax(0, 1fr); gap: 1rem; margin: 1.5rem 0; padding: 1rem; }
  .dash-error-code { flex-direction: row; gap: .75rem; justify-content: flex-start; min-width: 0; }
  .dash-error-code span { font-size: 1.8rem; }
  .dash-head { align-items: flex-start; flex-direction: column; }
}
@media (max-width: 560px) {
  .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .stat dd { font-size: 1.15rem; }
  .guild-list { grid-template-columns: minmax(0, 1fr); }
  .unsaved-kbd { display: none; }
}
`;
