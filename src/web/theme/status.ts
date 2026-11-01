/** Status page styles: banner, components, metric grid, uptime bars, notices. */
export const cssStatus = `
/* ── Status page ─────────────────────────────────────────────────── */
.status-banner { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 18px 20px; margin: 8px 0 28px; border: 1px solid var(--border); border-left: 6px solid var(--ok); border-radius: var(--r-lg); background: var(--surface); }
.status-banner h2 { margin: 0; font-size: 1.3rem; }
.status-banner p { margin: 2px 0 0; }
.status-banner .btn { margin-left: auto; }
.status-banner.warn { border-left-color: var(--warn); }
.status-banner.bad { border-left-color: var(--danger); }
.status-banner.info { border-left-color: var(--link); }
.status-glyph { width: 14px; height: 14px; border-radius: 50%; background: var(--ok); flex-shrink: 0; }
.status-banner.warn .status-glyph { background: var(--warn); }
.status-banner.bad .status-glyph { background: var(--danger); }
.status-banner.info .status-glyph { background: var(--link); }
.components { list-style: none; padding: 0; margin: 0 0 28px; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface); }
.component { display: grid; grid-template-columns: minmax(150px, 1fr) 2fr auto; gap: 12px; align-items: center; padding: 12px 16px; border-top: 1px solid var(--border); }
.component:first-child { border-top: 0; }
.comp-name { font-weight: 600; }
.state-pill { font-size: .8rem; font-weight: 600; padding: 2px 10px; border-radius: 999px; border: 1px solid currentColor; white-space: nowrap; }
.state-pill.st-operational { color: var(--ok); }
.state-pill.st-degraded { color: var(--warn); }
.state-pill.st-outage { color: var(--danger); }
.state-pill.st-unknown { color: var(--muted); }
.metric-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; margin: 0 0 28px; }
.metric { display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface); }
.metric-label { font-size: .8rem; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.metric-value { font-size: 1.25rem; font-variant-numeric: tabular-nums; }
.metric .faint { font-size: .8rem; }
.uptime-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; margin: 0 0 28px; }
.uptime-card { padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface); }
.uptime-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.uptime-head h3 { margin: 0 0 10px; font-size: 1rem; }
.uptime-bars { list-style: none; display: flex; gap: 3px; padding: 0; margin: 0; height: 36px; align-items: stretch; }
.ub { flex: 1 1 0; min-width: 3px; border-radius: 2px; background: var(--border-strong); }
.ub-ok { background: var(--ok); }
.ub-warn { background: var(--warn); }
.ub-bad { background: var(--danger); }
.ub-none { background: var(--border); }
.uptime-axis { display: flex; justify-content: space-between; font-size: .75rem; margin-top: 6px; }
.notices { list-style: none; padding: 0; margin: 0 0 28px; display: grid; gap: 10px; }
.notice-item { padding: 12px 16px; border: 1px solid var(--border); border-left: 4px solid var(--border-strong); border-radius: var(--r-lg); background: var(--surface); }
.notice-item.open.sev-major { border-left-color: var(--danger); }
.notice-item.open.sev-minor { border-left-color: var(--warn); }
.notice-item.open.sev-info { border-left-color: var(--link); }
.notice-item p { margin: 6px 0 0; }
.notice-top { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.notice-top .faint { margin-left: auto; font-size: .85rem; }
@media (max-width: 640px) {
  .component { grid-template-columns: 1fr auto; }
  .comp-detail { grid-column: 1 / -1; grid-row: 2; }
  .status-banner .btn { margin-left: 0; }
  .uptime-bars { gap: 2px; }
}
`;
