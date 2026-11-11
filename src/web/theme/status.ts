/** Status page styles: hero banner, component cards, latency chart, uptime bars, metrics and notices. */
export const cssStatus = `
/* Status page */
.status-page { padding-bottom: 1rem; }
.st-section { margin: 0 0 2.25rem; }
.st-section h2 { margin-bottom: .75rem; }
.st-section-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: .5rem 1rem; margin-bottom: .75rem; }
.st-section-head h2 { margin: 0; }
.st-explain { max-width: 72ch; font-size: .92rem; }

/* Hero banner */
.status-banner {
  --st: var(--ok);
  display: flex; align-items: center; justify-content: space-between; gap: 1.25rem 2rem; flex-wrap: wrap;
  padding: 1.5rem; margin: 0 0 2rem;
  border: 1px solid var(--border); border-top: 4px solid var(--st); border-radius: var(--r-lg); background: var(--surface);
}
.status-banner.warn { --st: var(--warn); }
.status-banner.bad { --st: var(--danger); }
.status-banner.info { --st: var(--link); }
.status-banner.is-stale { border-top-style: dashed; }
.st-hero-main { display: flex; align-items: center; gap: 1rem; min-width: 0; flex: 1 1 22rem; }
.status-glyph {
  position: relative; display: inline-flex; align-items: center; justify-content: center;
  width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0;
  color: var(--surface); background: var(--st);
}
.status-glyph .st-icon { width: 28px; height: 28px; stroke-width: 2.4; }
.st-hero-text { min-width: 0; }
.status-banner h2 { margin: 0; font-size: clamp(1.3rem, 1.1rem + .9vw, 1.75rem); line-height: 1.25; }
.st-summary { margin: .2rem 0 0; color: var(--text-2); font-size: .95rem; }
.st-hero-side { display: flex; flex-direction: column; align-items: flex-end; gap: .45rem; text-align: right; }
.st-checked { margin: 0; font: 400 .82rem/1.5 var(--mono); color: var(--faint); }
.st-ago { color: var(--muted); }
.st-refresh { display: flex; align-items: center; gap: .6rem; font: 400 .8rem/1.4 var(--mono); color: var(--faint); }
.st-progress { -webkit-appearance: none; appearance: none; width: 7rem; height: 4px; border: 0; border-radius: 2px; background: var(--border); color: var(--accent); overflow: hidden; }
.st-progress::-webkit-progress-bar { background: var(--border); border-radius: 2px; }
.st-progress::-webkit-progress-value { background: var(--accent); border-radius: 2px; }
.st-progress::-moz-progress-bar { background: var(--accent); border-radius: 2px; }
.st-countdown { font-variant-numeric: tabular-nums; }
.st-actions { display: flex; flex-wrap: wrap; gap: .4rem; justify-content: flex-end; }
[data-status-pause][aria-pressed="true"] { border-color: var(--warn); color: var(--warn); }
.st-stale { margin: -1.25rem 0 2rem; padding: .6rem .9rem; border: 1px dashed var(--warn); border-radius: var(--r); color: var(--warn); font-size: .9rem; }
.st-stale[hidden] { display: none; }

/* A slow pulse on the healthy glyph, only for people who have not asked for less motion. */
@media (prefers-reduced-motion: no-preference) {
  .status-banner.ok .status-glyph::after {
    content: ""; position: absolute; inset: -5px; border-radius: 50%; border: 2px solid var(--st);
    opacity: 0; animation: st-pulse 3s ease-out infinite;
  }
  @keyframes st-pulse { 0% { opacity: .55; transform: scale(.9); } 70%, 100% { opacity: 0; transform: scale(1.25); } }
}

/* State pills and legend */
.st-icon { display: inline-block; flex-shrink: 0; }
.state-pill {
  display: inline-flex; align-items: center; gap: .3rem;
  font-size: .8rem; font-weight: 600; padding: .05rem .6rem .05rem .4rem; border-radius: 999px;
  border: 1px solid currentColor; white-space: nowrap;
}
.state-pill .st-icon { width: 14px; height: 14px; stroke-width: 2.4; }
.state-pill.st-operational { color: var(--ok); }
.state-pill.st-degraded { color: var(--warn); }
.state-pill.st-outage { color: var(--danger); }
.state-pill.st-unknown { color: var(--muted); }
.st-legend { list-style: none; display: flex; flex-wrap: wrap; gap: .35rem; padding: 0; margin: 0; }
.st-legend li { margin: 0; }
.st-legend .state-pill { font-weight: 500; font-size: .75rem; border-color: var(--border); }

/* Component cards */
.components { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: .75rem; }
.component {
  --st: var(--ok);
  display: flex; flex-direction: column; gap: .35rem; margin: 0; padding: 1rem 1.1rem;
  border: 1px solid var(--border); border-left: 3px solid var(--st); border-radius: var(--r-lg); background: var(--surface);
}
.component.is-operational { --st: var(--ok); }
.component.is-degraded { --st: var(--warn); }
.component.is-outage { --st: var(--danger); background: var(--bg-sunk); }
.component.is-unknown { --st: var(--border-strong); }
.comp-top { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
.comp-name { margin: 0; font-size: 1rem; font-weight: 600; }
.comp-detail { margin: 0; color: var(--text); font-size: .92rem; }
.comp-about { margin: 0; color: var(--faint); font-size: .82rem; line-height: 1.5; }

/* Latency */
.latency-card {
  display: grid; grid-template-columns: auto auto minmax(0, 1fr); gap: 1.25rem 2rem; align-items: end;
  padding: 1.1rem 1.25rem; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface);
}
.latency-now { display: flex; flex-direction: column; gap: .1rem; min-width: 9rem; }
.latency-value { font: 600 1.7rem/1.2 var(--mono); font-variant-numeric: tabular-nums; color: var(--text); }
.latency-value.lv-ok { color: var(--ok); }
.latency-value.lv-warn { color: var(--warn); }
.latency-value.lv-bad { color: var(--danger); }
.latency-value.lv-none { color: var(--muted); }
.latency-figure { margin: 0; min-width: 0; }
.latency-chart { display: block; width: 100%; height: 56px; }
.lb { fill: var(--border-strong); }
.lb-ok { fill: var(--accent); }
.lb-warn { fill: var(--warn); }
.lb-bad { fill: var(--danger); }
.lb-none { fill: var(--border); }

/* Uptime */
.uptime-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: .75rem; margin: 0 0 .75rem; }
.uptime-card { padding: 1rem 1.1rem; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface); }
.uptime-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: .6rem; }
.uptime-head h3 { margin: 0; font-size: 1rem; }
.uptime-pct { font: 600 1.15rem var(--mono); font-variant-numeric: tabular-nums; }
.uptime-bars { list-style: none; display: flex; gap: 3px; padding: 0; margin: 0; height: 40px; align-items: stretch; }
.ub { flex: 1 1 0; min-width: 3px; margin: 0; border-radius: 2px; background: var(--border-strong); }
.uptime-bars .ub:hover { opacity: .75; }
.ub-ok { background: var(--ok); }
.ub-warn { background: var(--warn); }
.ub-bad { background: var(--danger); }
.ub-none { background: var(--border); }
.uptime-axis { display: flex; justify-content: space-between; gap: .5rem; font-size: .75rem; margin-top: 6px; }
.ub-legend { list-style: none; display: flex; flex-wrap: wrap; gap: .35rem 1.1rem; padding: 0; margin: 0; font-size: .8rem; }
.ub-legend li { display: inline-flex; align-items: center; gap: .4rem; margin: 0; }
.ub-legend .ub { display: inline-block; flex: none; width: 10px; height: 10px; min-width: 0; }

/* Metrics */
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; margin: 0; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface); overflow: hidden; }
.metric { display: flex; flex-direction: column; gap: 2px; padding: .9rem 1.1rem; box-shadow: inset -1px -1px 0 var(--border); min-width: 0; }
.metric-label { font: 500 .72rem/1.4 var(--mono); color: var(--faint); text-transform: uppercase; letter-spacing: .05em; }
.metric-value { font: 600 1.2rem/1.35 var(--mono); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.metric-value time { font-size: .95rem; }
.metric-hint { font-size: .8rem; color: var(--faint); }

/* Notices */
.notices { list-style: none; padding: 0; margin: 0; display: grid; gap: .6rem; }
.notice-item { margin: 0; padding: .85rem 1.1rem; border: 1px solid var(--border); border-left: 3px solid var(--border-strong); border-radius: var(--r-lg); background: var(--surface); }
.notice-item.open.sev-major { border-left-color: var(--danger); }
.notice-item.open.sev-minor { border-left-color: var(--warn); }
.notice-item.open.sev-info { border-left-color: var(--link); }
.notice-item.closed { background: transparent; }
.notice-item.none { border-left-color: var(--ok); color: var(--text-2); }
.notice-item p { margin: 6px 0 0; }
.notice-item.none p { margin: 0; }
.notices-active .notice-item { background: var(--surface); }
.notice-top { display: flex; gap: .5rem; align-items: baseline; flex-wrap: wrap; }
.notice-title { font-weight: 600; }
.notice-state { margin-left: auto; font: 500 .75rem var(--mono); text-transform: uppercase; letter-spacing: .05em; }
.notice-state.is-open { color: var(--warn); }
.notice-state.is-closed { color: var(--ok); }
.notice-times { font-size: .82rem; }

@media (max-width: 760px) {
  .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .latency-card { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .latency-figure { grid-column: 1 / -1; }
}
@media (max-width: 640px) {
  .status-banner { padding: 1.1rem; }
  .st-hero-side { align-items: flex-start; text-align: left; width: 100%; }
  .st-countdown { font-variant-numeric: tabular-nums; }
.st-actions { justify-content: flex-start; }
  .status-glyph { width: 42px; height: 42px; }
  .status-glyph .st-icon { width: 22px; height: 22px; }
  .uptime-bars { gap: 2px; height: 34px; }
  .uptime-axis span:nth-child(2) { display: none; }
  .latency-value { font-size: 1.35rem; }
  .latency-now { min-width: 0; }
  .st-legend { display: none; }
}
@media print {
  .st-actions, .st-refresh { display: none !important; }
}
`;
