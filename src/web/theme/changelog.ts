/**
 * Changelog styles (/changelog and /dashboard/changelog): header with the
 * Bot/Dashboard switch, stats strip, toolbar with change-type chips, the
 * version timeline and the sticky version list. Same tokens as the rest of the
 * site: thin borders, 4px corners, mono for versions, no shadows or gradients.
 */
export const cssChangelog = String.raw`
/* ── Changelog ─────────────────────────────────────────────────────── */
:root {
  --k-added: var(--ok);
  --k-changed: #2f5f9e;
  --k-fixed: #7a4fa0;
  --k-security: var(--danger);
  --k-removed: var(--muted);
  --k-deprecated: var(--warn);
  --k-known: var(--warn);
  --k-other: var(--muted);
}
[data-theme="dark"] {
  --k-changed: #8db4ec;
  --k-fixed: #c9a6ea;
}

/* JavaScript-only controls stay out of the way when the script is off. */
html:not(.js) [data-js-only] { display: none; }

.cl-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 1.25rem 2rem; margin-bottom: 1.5rem; }
.cl-head-text { flex: 1 1 28rem; min-width: 0; }
.cl-feeds { margin: .75rem 0 0; font: 400 .82rem/1.5 var(--mono); color: var(--faint); display: flex; flex-wrap: wrap; align-items: center; gap: .25rem .5rem; }
.cl-feeds a { color: var(--text-2); }
.cl-feeds a:hover { color: var(--accent); }
.cl-feeds .sep { color: var(--border-strong); }

.cl-product { display: inline-flex; padding: 3px; gap: 3px; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--bg-sunk); }
.cl-product-tab {
  display: inline-flex; align-items: center; gap: .45rem; min-height: 40px; padding: .25rem .9rem;
  border-radius: var(--r); color: var(--muted); text-decoration: none; font-weight: 500; font-size: .92rem;
  border: 1px solid transparent;
}
.cl-product-tab:hover { color: var(--text); }
.cl-product-tab[aria-current="page"] { background: var(--surface); color: var(--text); border-color: var(--border); }
.cl-product-v { font: 400 .75rem var(--mono); color: var(--faint); }

.cl-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0 0 1.5rem; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface); }
.cl-stat { padding: .85rem 1.1rem; border-left: 1px solid var(--border); min-width: 0; }
.cl-stat:first-child { border-left: 0; }
.cl-stat dt { font: 500 .72rem/1.4 var(--mono); color: var(--faint); text-transform: uppercase; letter-spacing: .05em; }
.cl-stat dd { margin: .15rem 0 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: .15rem .6rem; }
.cl-stat strong { font: 600 1.35rem/1.3 var(--mono); font-variant-numeric: tabular-nums; color: var(--text); }
.cl-stat strong a { color: inherit; text-decoration: none; }
.cl-stat strong a:hover { color: var(--accent); text-decoration: underline; }
.cl-stat span { font-size: .82rem; color: var(--muted); }

.cl-intro { max-width: 76ch; margin: 0 0 1.5rem; font-size: .9rem; color: var(--faint); }
.cl-intro p { margin: 0 0 .5rem; }

.cl-toolbar { position: sticky; top: var(--nav-h); z-index: 5; margin: 0 0 1.5rem; padding: .75rem 0; background: var(--bg); border-bottom: 1px solid var(--border); }
.release-search { display: flex; flex-wrap: wrap; gap: .6rem; align-items: center; margin-bottom: .6rem; }
.release-search .search { flex: 1 1 320px; }
.cl-filter { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .5rem 1rem; }
.cl-kinds { display: flex; flex-wrap: wrap; gap: .35rem; }
.cl-kind {
  display: inline-flex; align-items: center; gap: .4rem; min-height: 36px; padding: .15rem .65rem;
  font: 400 .82rem var(--sans); color: var(--text-2); background: var(--surface);
  border: 1px solid var(--border); border-radius: 999px; cursor: pointer;
}
.cl-kind:hover { border-color: var(--border-strong); color: var(--text); }
.cl-kind[aria-pressed="true"] { border-color: currentColor; color: var(--text); background: var(--bg-sunk); font-weight: 600; }
.cl-kind[data-cl-kind="all"][aria-pressed="true"] { color: var(--accent); background: var(--accent-soft); }
.cl-kind .n { font: 400 .75rem var(--mono); color: var(--faint); }

/* Change-type colours: chips, tally dots and filter buttons share them. */
.kc-added { --k: var(--k-added); }
.kc-changed { --k: var(--k-changed); }
.kc-fixed { --k: var(--k-fixed); }
.kc-security { --k: var(--k-security); }
.kc-removed { --k: var(--k-removed); }
.kc-deprecated { --k: var(--k-deprecated); }
.kc-known { --k: var(--k-known); }
.kc-other { --k: var(--k-other); }
.tally-dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; background: var(--k, var(--muted)); flex-shrink: 0; }
.cl-kind[aria-pressed="true"]:not([data-cl-kind="all"]) { color: var(--k); }
.kchip {
  display: inline-block; font: 600 .72rem/1.6 var(--mono); text-transform: uppercase; letter-spacing: .05em;
  color: var(--k, var(--muted)); border: 1px solid currentColor; border-radius: 3px; padding: 0 .4rem;
}

/* Timeline */
.cl-split { gap: 2.5rem; }
.cl-timeline { position: relative; min-width: 0; }
.cl-timeline::before { content: ""; position: absolute; left: 5px; top: .9rem; bottom: 6rem; width: 1px; background: var(--border-strong); }
.release { position: relative; padding: 0 0 2.25rem 2rem; scroll-margin-top: calc(var(--nav-h) + 9rem); }
.release[hidden], li[data-release][hidden] { display: none; }
.release-node {
  position: absolute; left: 0; top: .55rem; width: 11px; height: 11px; border-radius: 50%;
  background: var(--bg); border: 2px solid var(--border-strong);
}
.cl-page { padding-bottom: 1rem; }
.release-node.node-patch { border-color: var(--border-strong); }
.release-node.node-minor { border-color: var(--accent); }
.release-node.node-major, .release-node.node-initial { width: 15px; height: 15px; left: -2px; top: .45rem; border-color: var(--accent); background: var(--accent-soft); }
.release.is-latest .release-node { background: var(--accent); border-color: var(--accent); }
.release.is-latest { padding-bottom: 2.5rem; }

.release-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: .35rem 1rem; margin-bottom: .5rem; }
.release-heading { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; min-width: 0; }
.release-title { font: 600 1.35rem/1.3 var(--mono); margin: 0; }
.release-title a { color: var(--text); text-decoration: none; }
.release-title a:hover { color: var(--accent); text-decoration: underline; }
.release.is-latest .release-title { font-size: 1.6rem; }
.release-latest {
  display: inline-block; padding: .05rem .45rem;
  border-radius: var(--r); background: var(--accent); color: var(--accent-ink);
  font: 500 .68rem/1.6 var(--mono); text-transform: uppercase; letter-spacing: .05em;
}
.vbadge { display: inline-block; font: 500 .68rem/1.6 var(--mono); text-transform: uppercase; letter-spacing: .05em; padding: 0 .4rem; border-radius: 3px; border: 1px solid var(--border-strong); color: var(--muted); }
.vbadge.vb-major, .vbadge.vb-initial { color: var(--accent); border-color: currentColor; }
.vbadge.vb-minor { color: var(--text-2); }
.vbadge.vb-patch { color: var(--faint); border-style: dashed; }
.release-meta { display: flex; flex-wrap: wrap; align-items: center; gap: .25rem .9rem; font: 400 .82rem/1.5 var(--mono); color: var(--faint); }
.release-pending { color: var(--warn); }
.release-diff { color: var(--text-2); }
.release-copy {
  display: inline-flex; align-items: center; min-height: 32px; padding: 0;
  background: none; border: 0; color: var(--text-2);
  font: inherit; cursor: pointer; text-decoration: underline;
}
.release-copy:hover, .release-diff:hover { color: var(--accent); }
.release-summary { color: var(--text-2); margin: 0 0 .6rem; max-width: 72ch; }
.release-tally { list-style: none; display: flex; flex-wrap: wrap; gap: .3rem 1rem; padding: 0; margin: 0 0 .6rem; font: 400 .8rem/1.5 var(--mono); color: var(--muted); }
.tally-item { display: inline-flex; align-items: center; gap: .4rem; margin: 0; }

.release-body { border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface); }
.release.is-latest .release-body { border-color: var(--accent); }
.release-toggle {
  display: flex; align-items: center; gap: .5rem; min-height: 44px; padding: .4rem 1rem;
  cursor: pointer; list-style: none; font-size: .88rem; font-weight: 500; color: var(--text-2);
}
.release-toggle::-webkit-details-marker { display: none; }
.release-toggle::before { content: "+"; font-family: var(--mono); color: var(--faint); width: 1ch; }
.release-body[open] > .release-toggle::before { content: "\2212"; }
.release-body[open] > .release-toggle { border-bottom: 1px solid var(--border); }
.release-toggle:hover { color: var(--accent); }
.release-body:not([open]) .when-open, .release-body[open] .when-closed { display: none; }

.change-group { padding: .85rem 1rem .4rem; }
.change-group + .change-group { border-top: 1px solid var(--border); }
.change-group[hidden] { display: none; }
.change-head { display: flex; align-items: center; gap: .5rem; margin: 0 0 .4rem; font-size: inherit; }
.change-n { font: 400 .75rem var(--mono); color: var(--faint); }
.changes { padding-left: 1.1rem; margin: 0 0 .5rem; max-width: 80ch; }
.changes li { padding: .2rem 0; margin: 0; font-size: .93rem; color: var(--text-2); }
.changes li::marker { color: var(--border-strong); }
.changes li[hidden] { display: none; }
.changes li strong { color: var(--text); font-weight: 600; }
.changes li ul { padding-left: 1.1rem; margin: .2rem 0 0; list-style: circle; }
.changes li li { padding: .1rem 0; }
.release-nomatch { margin: 0; padding: .75rem 1rem; font-size: .88rem; color: var(--muted); }
.release-nomatch[hidden] { display: none; }

/* Version list */
.cl-toc { top: calc(var(--nav-h) + 9rem); max-height: calc(100vh - var(--nav-h) - 10rem); }
.cl-toc ul, .toc-mobile nav ul { margin-bottom: 1rem; }
.cl-toc a, .toc-mobile nav a { display: flex; justify-content: space-between; gap: .5rem; }
.toc-group[hidden] { display: none; }
.toc-group-title { text-transform: none; }
.toc-v { font-family: var(--mono); }
.toc-d { font: 400 .75rem var(--mono); color: var(--faint); white-space: nowrap; }
.cl-top { font-size: .82rem; color: var(--faint); }
.cl-top:hover { color: var(--accent); }

@media (max-width: 960px) {
  .cl-toolbar { top: var(--nav-h); }
  .release { scroll-margin-top: calc(var(--nav-h) + 8rem); }
}
@media (max-width: 640px) {
  .cl-head { align-items: stretch; }
  .cl-product { display: flex; width: 100%; }
  .cl-product-tab { flex: 1 1 0; justify-content: center; }
  .cl-stats { grid-template-columns: minmax(0, 1fr); }
  .cl-stat { border-left: 0; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; }
  .cl-stat:first-child { border-top: 0; }
  .cl-stat dd { justify-content: flex-end; text-align: right; }
  .cl-stat strong { font-size: 1.1rem; }
  .cl-toolbar { position: static; }
  .cl-kinds { flex-wrap: nowrap; overflow-x: auto; margin-right: -1.25rem; padding-right: 1.25rem; padding-bottom: .2rem; }
  .cl-kind { flex-shrink: 0; }
  .release { padding-left: 1.5rem; scroll-margin-top: calc(var(--nav-h) + 1rem); }
  .release-title, .release.is-latest .release-title { font-size: 1.2rem; }
  .release-head { flex-direction: column; align-items: flex-start; }
  .change-group { padding: .75rem .8rem .3rem; }
  .release-toggle { padding: .4rem .8rem; }
}
@media print {
  .cl-toolbar, .cl-product, .release-copy, .release-toggle { display: none !important; }
  .release-body { border: 0; }
}
`;
