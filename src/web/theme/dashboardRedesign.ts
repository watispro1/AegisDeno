/**
 * Dashboard redesign (v2): modern, high-contrast SaaS aesthetic with crisp
 * typography, sleek cards, refined stats grid, polished server picker,
 * and elegant responsive drawer. Loaded before responsive.ts.
 */
export const cssDashboardRedesign = `
/* Stats strip: modern SaaS metric band with crisp dividers and subtle hover. */
.stat-grid { gap: 0; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); overflow: hidden; grid-template-columns: repeat(auto-fit, minmax(min(10.5rem, 100%), 1fr)); box-shadow: 0 1px 3px rgba(0,0,0,.02); }
.stat-grid > .stat, .stat-grid > .stat-link > .stat, .stat-grid > li { border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.stat-grid > * { border-left: 1px solid var(--border); border-top: 1px solid var(--border); margin: -1px 0 0 -1px; min-width: 0; }
.stat { padding: 1.1rem 1.25rem; transition: background .15s ease; }
.stat:hover, .stat-link:hover .stat { background: var(--bg-sunk); box-shadow: none; border-color: var(--border); transform: none; }
.stat dt { font: 600 .72rem/1.4 var(--mono); color: var(--faint); text-transform: uppercase; letter-spacing: .06em; margin-bottom: .3rem; }
.stat dd { font: 700 1.65rem/1.1 var(--mono); font-variant-numeric: tabular-nums; color: var(--text); }
.stat dd small { font: 500 .8rem var(--sans); color: var(--muted); background: var(--bg-sunk); padding: .1rem .4rem; border-radius: 4px; vertical-align: middle; margin-left: .3rem; }
.stat-link:hover .stat dd, .stat-link:hover dd { color: var(--accent); }
.card, .panel, .guild-item, .dash-fact { box-shadow: none; }
.card:hover { transform: none; box-shadow: none; }

/* Sidebar: brand, filter, footer */
.side-brand { display: flex; align-items: center; gap: .75rem; min-width: 0; color: var(--text); text-decoration: none; border-radius: var(--r-lg, var(--r)); padding: .35rem .45rem; transition: background .12s ease; }
.side-brand:hover { background: var(--bg-sunk); }
.side-brand:hover .side-brand-name { color: var(--accent); }
.side-brand-text { display: flex; flex-direction: column; min-width: 0; }
.side-brand-name { font-weight: 600; font-size: .95rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.side-brand-meta { font: 500 .74rem/1.3 var(--mono); color: var(--faint); margin-top: .1rem; }
.side-filter { margin: .85rem 0 .65rem; }
.side-filter-input { width: 100%; min-height: 36px; padding: .35rem .65rem; font: inherit; font-size: .88rem; color: var(--text); background: var(--bg); border: 1px solid var(--border-strong); border-radius: var(--r-lg, var(--r)); transition: border-color .15s ease; }
.side-filter-input:focus { border-color: var(--accent); outline: 2px solid var(--accent-soft); outline-offset: 0; }
.side-filter-empty { margin: .45rem .25rem 0; font-size: .82rem; }
[data-nav-item][hidden], .nav-group[hidden] { display: none; }
.side-link mark { background: var(--accent-soft); color: inherit; border-radius: 2px; }
.side-foot { display: flex; flex-wrap: wrap; gap: .35rem 1rem; margin-top: 1.5rem; padding: .85rem .5rem 0; border-top: 1px solid var(--border); }
.side-foot-link { font: 600 .78rem var(--mono); color: var(--faint); text-decoration: none; transition: color .12s ease; }
.side-foot-link:hover { color: var(--accent); text-decoration: underline; }
.switcher-filter { padding: .4rem .5rem; }
.switcher-filter input { width: 100%; min-height: 36px; padding: .3rem .6rem; font: inherit; font-size: .88rem; color: var(--text); background: var(--bg); border: 1px solid var(--border-strong); border-radius: var(--r); }
.switcher-list li[hidden] { display: none; }

/* Sidebar collapse toggle and collapsed state (desktop only; set by dashboard.js). */
.side-collapse { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 1px solid var(--border); border-radius: var(--r-lg, var(--r)); background: transparent; color: var(--muted); cursor: pointer; transition: color .12s ease, border-color .12s ease, background .12s ease; }
.side-collapse:hover { color: var(--text); border-color: var(--border-strong); background: var(--bg-sunk); }
.side-collapse[aria-pressed="true"] span[aria-hidden] { display: inline-block; transform: scaleX(-1); }
.app[data-collapsed] { grid-template-columns: 4rem minmax(0, 1fr); }
.app[data-collapsed] .app-side { padding-left: .5rem; padding-right: .5rem; overflow-x: hidden; }
.app[data-collapsed] .side-brand-text, .app[data-collapsed] .side-filter, .app[data-collapsed] .side-foot,
.app[data-collapsed] .nav-group-title { display: none; }
.app[data-collapsed] .side-link { justify-content: center; padding: .4rem; font-size: 0; gap: 0; }
.app[data-collapsed] .side-link .side-icon { font-size: 1.15rem; width: auto; }
.app[data-collapsed] .side-brand { justify-content: center; padding: .3rem 0; }

/* Page header */
.dash-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: .85rem 1.5rem; margin: 0 0 1.75rem; padding: 0 0 1.25rem; border-bottom: 1px solid var(--border); }
.dash-head-text { min-width: 0; flex: 1 1 22rem; }
.dash-head h1 { margin: .15rem 0 .4rem; font-size: 1.85rem; font-weight: 700; letter-spacing: -.02em; }
.dash-head .lead { margin: 0; max-width: 72ch; font-size: .98rem; color: var(--muted); line-height: 1.5; }
.dash-eyebrow { display: block; font: 600 .74rem/1.4 var(--mono); color: var(--accent); text-transform: uppercase; letter-spacing: .08em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: .25rem; }
.dash-head-actions { display: flex; flex-wrap: wrap; gap: .6rem; align-items: center; }

/* Navigation progress bar */
.nav-progress { position: fixed; top: 0; left: 0; z-index: 1000; height: 3px; width: 0; background: var(--accent); opacity: 0; pointer-events: none; }
.nav-progress.is-active { opacity: 1; width: 80%; transition: width 8s cubic-bezier(.1,.7,.2,1), opacity .1s; }
.nav-progress.is-done { opacity: 0; width: 100%; transition: width .15s, opacity .3s .15s; }

/* Unsaved bar */
.unsaved-text { display: inline-flex; align-items: center; gap: .6rem; font-weight: 500; }
.unsaved-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--warn, #b7791f); flex: none; box-shadow: 0 0 0 3px rgba(183, 121, 31, .2); }
.unsaved-count { font: 600 .82rem var(--mono); color: var(--faint); }
.unsaved-count:empty { display: none; }
.unsaved-kbd { margin-left: .45rem; padding: .1rem .4rem; font: 600 .72rem var(--mono); border: 1px solid currentColor; border-radius: 4px; opacity: .85; }

/* Empty states */
.empty-state { display: flex; align-items: flex-start; gap: 1rem; padding: 1.25rem 1.4rem; border: 1px dashed var(--border-strong); border-radius: 12px; background: var(--surface); color: var(--muted); }
.empty-state[hidden] { display: none; }
.empty-icon { flex: none; display: inline-grid; place-items: center; width: 2.25rem; height: 2.25rem; border: 1px solid var(--border); border-radius: 8px; font: 600 1.1rem var(--mono); color: var(--faint); background: var(--bg-sunk); }
.empty-body strong { color: var(--text); }
.empty-action { margin-left: .5rem; }

/* Error page */
.dash-error { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2.25rem; align-items: start; max-width: 54rem; margin: 3rem auto; padding: 2rem; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); box-shadow: 0 4px 20px rgba(0,0,0,.04); }
.dash-error-code { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 8rem; padding: 1.25rem; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); }
.dash-error-code span { font: 700 2.6rem/1 var(--mono); color: var(--accent); font-variant-numeric: tabular-nums; }
.dash-error[data-status^="5"] .dash-error-code span { color: var(--danger, #b42318); }
.dash-error-code small { margin-top: .4rem; font: 600 .72rem var(--mono); color: var(--faint); text-transform: uppercase; letter-spacing: .06em; text-align: center; }
.dash-error-body h1 { margin-top: 0; }
.dash-error-hints { margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid var(--border); }
.dash-error-hints h2 { margin: 0 0 .5rem; font: 600 .75rem var(--mono); color: var(--faint); text-transform: uppercase; letter-spacing: .06em; }
.dash-error-hints ul { margin: 0; padding-left: 1.25rem; color: var(--muted); line-height: 1.5; }

/* Landing hero */
.dash-landing { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 2.5rem; align-items: center; margin: 2.5rem 0 2rem; padding: 2.25rem 2rem; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); box-shadow: 0 4px 24px rgba(0,0,0,.03); }
.dash-landing-text h1 { margin: .25rem 0 .75rem; font-size: 2rem; letter-spacing: -.02em; }
.dash-landing-preview { list-style: none; margin: 0; padding: 0; border: 1px solid var(--border); border-radius: 12px; background: var(--bg); box-shadow: 0 4px 16px rgba(0,0,0,.04); }
.dash-landing-preview li { display: flex; align-items: center; gap: .75rem; padding: .85rem 1.25rem; border-top: 1px solid var(--border); font-size: .92rem; font-weight: 500; }
.dash-landing-preview li:first-child { border-top: 0; }
.lp-dot { width: 9px; height: 9px; border-radius: 50%; border: 1px solid var(--border-strong); flex: none; }
.lp-dot.on { background: var(--accent); border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.lp-n { margin-left: auto; font: 500 .8rem var(--mono); color: var(--faint); }
.dash-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr)); gap: 0; list-style: none; padding: 0; margin: 0 0 2.5rem; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.dash-fact { display: grid; grid-template-columns: auto 1fr; gap: .2rem .85rem; padding: 1.2rem 1.35rem; border-left: 1px solid var(--border); border-top: 1px solid var(--border); margin: -1px 0 0 -1px; background: var(--surface); }
.dash-fact-icon { grid-row: span 2; color: var(--accent); font: 600 1.2rem var(--mono); }
.dash-fact span:last-child { color: var(--muted); font-size: .9rem; line-height: 1.45; }

/* Server picker cards */
.picker-tools { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem; margin: 0 0 1.25rem; }
.guild-list { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(19rem, 100%), 1fr)); gap: .85rem; }
.guild-list li[hidden] { display: none; }
.guild-item { display: flex; align-items: center; gap: .85rem; min-height: 68px; padding: .85rem 1.15rem; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--text); text-decoration: none; transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease; }
.guild-item:hover { border-color: var(--accent); box-shadow: 0 6px 20px rgba(0,0,0,.05); transform: translateY(-1px); }
.guild-item.last-used { border-color: var(--border-strong); }
.guild-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.guild-text .name { font-weight: 600; font-size: .98rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.guild-role { font: 500 .76rem var(--mono); color: var(--faint); margin-top: .15rem; }
.guild-go { color: var(--faint); font-size: 1.15rem; transition: transform .15s ease, color .15s ease; }
.guild-item:hover .guild-go { color: var(--accent); transform: translateX(3px); }
.picker-icon { flex: none; width: 44px; height: 44px; border-radius: 10px; font-size: 1.1rem; }
.picker-icon.has-img { object-fit: cover; }
.guild-list-invite .guild-item { border-style: dashed; background: transparent; }

/* Footer */
.dash-foot-links, .dash-foot-v { white-space: nowrap; }

/* Focus rings */
.side-link:focus-visible, .side-brand:focus-visible, .guild-item:focus-visible, .side-foot-link:focus-visible,
.side-collapse:focus-visible, .stat-link:focus-visible, .empty-action:focus-visible, .dash-head-actions :focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .nav-progress, .nav-progress.is-active, .nav-progress.is-done, .guild-item, .guild-go { transition: none; }
}

@media (max-width: 900px) {
  .side-collapse { display: none; }
  .app[data-collapsed] { grid-template-columns: minmax(0, 1fr); }
  .app[data-collapsed] .side-brand-text, .app[data-collapsed] .side-filter, .app[data-collapsed] .side-foot { display: revert; }
  .app[data-collapsed] .nav-group-title { display: flex; }
  .app[data-collapsed] .side-link { justify-content: flex-start; font-size: .91rem; gap: .65rem; padding: .35rem .65rem; }
  .dash-landing { grid-template-columns: minmax(0, 1fr); gap: 1.75rem; margin-top: 1.5rem; padding: 1.5rem; }
  .dash-error { grid-template-columns: minmax(0, 1fr); gap: 1.25rem; margin: 1.5rem 0; padding: 1.25rem; }
  .dash-error-code { flex-direction: row; gap: 1rem; justify-content: flex-start; min-width: 0; }
  .dash-error-code span { font-size: 2rem; }
  .dash-head { align-items: flex-start; flex-direction: column; }
  .dash-head-text { flex: 0 1 auto; width: 100%; }
}
@media (max-width: 560px) {
  .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .stat dd { font-size: 1.35rem; }
  .guild-list { grid-template-columns: minmax(0, 1fr); }
  .unsaved-kbd { display: none; }
}
`;