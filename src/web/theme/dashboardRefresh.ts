/**
 * Dashboard refresh: consistent empty states, toasts that never cover the
 * unsaved-changes bar, the overview's Common settings strip, foldable case
 * filters on phones, and phone fixes for tabs and the top bar. Colours come
 * from the theme tokens only, so Light, Dark, Steel & Ink and Glass all work;
 * Glass touches are in glassDashboard.ts.
 */
export const cssDashboardRefresh = String.raw`/* ── Dashboard refresh ───────────────────────────────────────────── */
/* Empty states. Older markup without the icon/body wrapper stacks as one block
   instead of turning every text node into a flex column. */
.empty-state:not([hidden]):not(:has(> .empty-body)) { display: block; }
.empty-body { flex: 1; min-width: 0; }
.empty-body > strong:first-child { display: block; margin-bottom: .2rem; }
.empty-actions { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .75rem; }
.empty-actions .empty-action { margin-left: 0; }
.app-content .empty-state { margin: 0 0 1.5rem; }

/* Toasts move above the unsaved bar while it is showing, so Save and Discard stay reachable. */
body[data-unsaved="true"] .toast-region,
body:has(.unsaved-bar:not([hidden])) .toast-region { bottom: 5.5rem; }

/* Common settings on the overview */
.quick-card { margin: 1.25rem 0; }
.quick-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: .25rem 1rem; margin-bottom: .8rem; }
.quick-head h2 { margin: 0; }
.quick-settings { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: .5rem; }
.quick-tile { display: grid; gap: .2rem; min-height: 44px; padding: .65rem .8rem; border: 1px solid var(--border); border-radius: var(--r); background: transparent; color: var(--text); text-decoration: none; }
.quick-tile:hover { border-color: var(--accent); }
.quick-tile:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.quick-label { font-weight: 600; }
.quick-state { display: inline-flex; align-items: center; gap: .35rem; font: 500 .75rem var(--mono); color: var(--muted); }
.quick-dot { flex: none; width: 7px; height: 7px; border-radius: 50%; background: var(--faint); }
.quick-state[data-state="on"] { color: var(--ok); }
.quick-state[data-state="on"] .quick-dot { background: var(--ok); }
.quick-state[data-state="ready"] .quick-dot { background: var(--accent); }
.quick-detail { overflow: hidden; font-size: .8rem; color: var(--faint); text-overflow: ellipsis; white-space: nowrap; }

/* Case filters: a plain panel on wide screens, a foldable one on phones */
.filter-panel { margin: 0 0 1.25rem; }
.filter-panel > .filter-bar { margin-bottom: 0; }
.filter-panel-summary { display: flex; align-items: center; gap: .5rem; min-height: 44px; padding: .45rem .9rem; border: 1px solid var(--border); border-radius: var(--r); background: var(--surface); font-weight: 600; cursor: pointer; list-style: none; }
.filter-panel-summary::-webkit-details-marker { display: none; }
.filter-panel-summary::after { content: "▾"; margin-left: auto; color: var(--faint); }
.filter-panel[open] > .filter-panel-summary { margin-bottom: .75rem; }
.filter-panel[open] > .filter-panel-summary::after { content: "▴"; }
.filter-count { padding: 0 .45rem; border-radius: 999px; background: var(--accent-soft); color: var(--text); font: 500 .75rem var(--mono); }
@media (min-width: 721px) {
  .filter-panel > .filter-panel-summary { display: none; }
}

@media (max-width: 640px) {
  /* The site-wide tab bleed is for the public pages' wider gutters; inside the app it overflowed the page. */
  .app-content .tabs { margin-right: 0; padding-right: 0; }
  /* Toasts drop from the top on phones, clear of the unsaved bar and the thumb. */
  .toast-region,
  body[data-unsaved="true"] .toast-region,
  body:has(.unsaved-bar:not([hidden])) .toast-region { top: .75rem; bottom: auto; left: 1rem; right: 1rem; width: auto; }
  .unsaved-bar { bottom: .75rem; }
  .unsaved-bar .btn-row { width: 100%; }
  .unsaved-bar .btn-row .btn { flex: 1 1 0; }
  .unsaved-kbd { display: none; }
  .quick-settings { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
/* Keyboard-shortcut help is no use on touch screens. */
@media (hover: none) and (pointer: coarse) {
  .app-top [data-shortcuts-open] { display: none; }
}

/* Dashboard sign-in page */
.dash-landing-v2 { align-items: center; padding: 1rem 0 2.5rem; border-bottom: 1px solid var(--border); margin-bottom: 2rem; }
.dash-landing-v2 h1 { font-size: clamp(2rem, 4vw, 2.8rem); line-height: 1.1; }
.landing-fine { margin: 1rem 0 0; font-size: .85rem; }
.landing-steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; border: 1px solid var(--border); border-radius: var(--r-lg, var(--r)); background: var(--surface); counter-reset: none; }
.landing-step { display: grid; grid-template-columns: 2.25rem minmax(0, 1fr); gap: .8rem; padding: 1rem 1.1rem; border-top: 1px solid var(--border); }
.landing-step:first-child { border-top: 0; }
.landing-step-n { display: inline-flex; align-items: center; justify-content: center; width: 2.25rem; height: 2.25rem; border-radius: 50%; background: var(--accent-soft); color: var(--text); font: 600 .9rem var(--mono); }
.landing-step-text { display: grid; gap: .15rem; }
.landing-step-text span { color: var(--muted); font-size: .9rem; }
.landing-facts .dash-facts { gap: .75rem; border: 0; }
.landing-facts .dash-fact { margin: 0; border: 1px solid var(--border); border-radius: var(--r); }

/* Server picker */
.dash-head-actions .picker-refresh { margin: 0; }
.picker-section { margin: 0 0 2rem; }
.picker-section .section-title { margin-top: 0; }
.picker-invite { padding: 1.1rem 1.25rem; border: 1px dashed var(--border-strong); border-radius: var(--r-lg, var(--r)); }
.picker-invite .guild-list { margin-bottom: 1rem; }
.picker-invite .invite-help { margin-bottom: 0; font-size: .88rem; }
.picker-foot { font-size: .88rem; }

/* Glass touches for these pieces live in glassDashboard.ts with the rest of Glass. */
`;
