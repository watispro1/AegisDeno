/** Styles for the dashboard upgrade round: palette, search, avatars, members, Incident Mode, analytics, tools. */
export const cssDashboardExtras = `
/* ── Top bar search and command palette ──────────────────────────── */
.top-search { margin-left: auto; flex: 0 1 18rem; }
.top-search input { width: 100%; padding: .35rem .6rem; font-size: .9rem; }
.palette-btn { font-family: var(--mono); }
.palette { width: min(36rem, 94vw); max-height: 70vh; padding: .75rem; border: 1px solid var(--border-strong); border-radius: var(--r-lg); background: var(--surface); color: var(--text); margin-top: 12vh; }
.palette::backdrop { background: rgba(0, 0, 0, .45); }
.palette input { width: 100%; font-size: 1rem; padding: .55rem .7rem; }
.palette-list { list-style: none; margin: .5rem 0 0; padding: 0; max-height: 48vh; overflow: auto; }
.palette-item { display: flex; justify-content: space-between; gap: 1rem; padding: .45rem .6rem; border-radius: var(--r); cursor: pointer; }
.palette-item.active, .palette-item:hover { background: var(--accent-soft); }
.palette-hint { margin: .5rem 0 0; font-size: .8rem; }
/* ── Real avatars and server icons (Discord CDN) ──────────────────── */
img.g-icon, img.avatar { object-fit: cover; background: var(--bg-sunk); padding: 0; }
.avatar-img { width: 2.5rem; height: 2.5rem; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.avatar-lg { width: 5rem; height: 5rem; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.avatar-fallback { display: inline-grid; place-items: center; background: var(--accent); color: var(--accent-ink); font-weight: 700; }
.avatar-lg.avatar-fallback { font-size: 2rem; }
/* ── Members and search ───────────────────────────────────────────── */
.search-row { display: flex; gap: .5rem; margin: 0 0 1.25rem; flex-wrap: wrap; }
.search-row input { flex: 1 1 16rem; }
.member-list, .search-hits, .note-list, .stat-list { list-style: none; padding: 0; margin: 0 0 1.5rem; }
.member-list a { display: flex; align-items: center; gap: .75rem; padding: .5rem; border-bottom: 1px solid var(--border); color: inherit; text-decoration: none; }
.member-list a:hover { background: var(--bg-sunk); }
.search-hits li { padding: .4rem 0; border-bottom: 1px solid var(--border); }
.member-head { display: flex; gap: 1.25rem; align-items: flex-start; flex-wrap: wrap; margin: 0 0 1.25rem; }
.member-facts { display: grid; grid-template-columns: max-content 1fr; gap: .3rem 1rem; margin: 0; flex: 1 1 18rem; }
.member-facts dt { color: var(--muted); }
.member-facts dd { margin: 0; }
.note-list li { padding: .5rem 0; border-bottom: 1px solid var(--border); }
.note-list p { margin: 0; }
tr.revoked td { opacity: .6; }
/* ── Trust Score ─────────────────────────────────────────────────── */
.trust-chart .bar.low { fill: var(--danger); }
.trust-factors { list-style: none; padding: 0; margin: 0 0 1rem; }
.trust-factors li { padding: .3rem 0; border-bottom: 1px solid var(--border); }
.trust-pts { display: inline-block; min-width: 3.5rem; font-family: var(--mono); font-weight: 600; }
.trust-factors .pos .trust-pts { color: var(--success, var(--accent)); }
.trust-factors .neg .trust-pts { color: var(--danger); }
.trust-factors .base, .trust-factors .zero { color: var(--muted); }
.trust-score { font-size: 1.15rem; margin: 0 0 .5rem; }
/* ── Incident Mode ───────────────────────────────────────────────── */
.incident-live { border-left: 4px solid var(--danger); }
.stat-list li { padding: .2rem 0; }
.timeline { list-style: none; padding: 0; margin: 0; max-height: 28rem; overflow: auto; border-top: 1px solid var(--border); }
.timeline li { padding: .35rem 0; border-bottom: 1px solid var(--border); font-size: .9rem; }
.timeline time { font-family: var(--mono); color: var(--muted); margin-right: .5rem; }
.timeline .tl-gate .tag, .timeline .tl-error .tag { color: var(--danger); }
.timeline .tl-start .tag, .timeline .tl-end .tag { color: var(--accent); }
/* ── Analytics ───────────────────────────────────────────────────── */
.insight-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr)); gap: .75rem; }
.insight-grid .span-2 { grid-column: 1 / -1; }
.range-nav { margin: 0 0 1rem; }
.chart .bar.alt { fill: var(--warn); }
.line-chart .line { stroke-width: 2; }
.line-chart .s-join { stroke: var(--ok); }
.line-chart .s-leave { stroke: var(--danger); }
.legend .key { display: inline-block; width: .7rem; height: .7rem; border-radius: 2px; vertical-align: middle; margin: 0 .25rem 0 .5rem; }
.legend .key.s-join { background: var(--ok); }
.legend .key.s-leave { background: var(--danger); }
.rank-bars { list-style: none; padding: 0; margin: 0; display: grid; gap: .4rem; }
.rank-bars li { display: grid; grid-template-columns: minmax(6rem, 10rem) 1fr auto; gap: .6rem; align-items: center; }
.rank-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-svg { width: 100%; height: .6rem; display: block; }
.rank-fill { fill: var(--accent); }
.rank-n { font-variant-numeric: tabular-nums; }
/* ── Modules & backup ────────────────────────────────────────────── */
.embed-optional { margin: .5rem 0 1rem; }
.embed-optional > summary { cursor: pointer; font-weight: 600; margin-bottom: .5rem; }
@media (max-width: 720px) {
  .top-search { display: none; }
  .rank-bars li { grid-template-columns: 1fr auto; }
  .rank-svg { grid-column: 1 / -1; grid-row: 2; }
}
`;
