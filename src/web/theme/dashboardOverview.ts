/**
 * Dashboard 2.0 overview: the server health card, the two-column body,
 * quick actions and the module board spacing. Tokens only, scoped to
 * .app-body; Glass and Aurora add their own touches in their files.
 */
export const cssDashboardOverview = String.raw`/* ── Dashboard 2.0: overview ───────────────────────────────────────── */
.ov-health {
  position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 1rem 1.25rem;
  margin: 0 0 var(--d-gap); padding: 1.15rem 1.35rem 1.15rem 1.5rem; overflow: hidden;
  border: 1px solid var(--border); border-radius: var(--d-r-lg); background-color: var(--surface); box-shadow: var(--d-shadow);
  /* A faint wash of the health tone from the stripe in. */
  background-image: linear-gradient(100deg, color-mix(in srgb, var(--tone) 7%, transparent), transparent 48%);
  --tone: var(--ok);
}
.ov-health[data-health="attention"] { --tone: var(--warn); }
.ov-health[data-health="problem"] { --tone: var(--danger); }
.ov-health::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 4px; background: var(--tone); }
.ov-health-badge { display: grid; place-items: center; width: 2.9rem; height: 2.9rem; border-radius: 50%; color: var(--tone); background: color-mix(in srgb, var(--tone) 15%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tone) 35%, transparent); }
.ov-health-badge .ico { width: 22px; height: 22px; stroke-width: 2.2; }
.ov-health-kicker { margin: 0; font: 600 .7rem/1.4 var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.app-body .ov-health h2 { margin: .1rem 0 .25rem; font-size: 1.2rem; font-weight: 650; letter-spacing: -.01em; }
.ov-health-detail { margin: 0; max-width: 68ch; font-size: .9rem; color: var(--muted); }
.ov-health-facts { display: flex; flex-wrap: wrap; gap: .3rem 1.1rem; margin: .65rem 0 0; padding: 0; list-style: none; font-size: .82rem; color: var(--muted); }
.ov-health-facts li { margin: 0; }
.ov-health-facts strong { color: var(--text); font-weight: 600; font-variant-numeric: tabular-nums; }
.ov-health-actions { display: flex; flex-direction: column; gap: .5rem; }
.ov-health-actions .btn { justify-content: center; }

.ov-glance { margin: 0; }
.app-body .quick-card { margin: 0 0 var(--d-gap); }

/* Two columns: the work on the left, shortcuts and status on the right. */
.ov-columns { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); align-items: start; gap: var(--d-gap); margin: 0 0 var(--d-gap); }
.ov-col-main, .ov-col-side { display: grid; gap: var(--d-gap); min-width: 0; }
.app-body .ov-columns .panel-card { margin: 0; }
.ov-cases .table-wrap { margin: 0; }
.ov-tickets { margin: 0; padding: 0; }

/* Quick actions */
.qa-list { display: grid; gap: .25rem; margin: 0; padding: 0; list-style: none; }
.qa-list li { margin: 0; }
.qa-item { display: flex; align-items: center; gap: .75rem; min-height: 50px; padding: .45rem .55rem; border: 1px solid transparent; border-radius: var(--d-r); color: var(--text); text-decoration: none; transition: background-color .15s var(--d-ease), border-color .15s var(--d-ease); }
.qa-item:hover { border-color: var(--border); background: var(--hover); color: var(--text); }
.qa-ico { display: grid; place-items: center; flex: none; width: 2.2rem; height: 2.2rem; border-radius: var(--d-r); background: var(--accent-soft); color: var(--accent); }
.qa-ico .ico { width: 17px; height: 17px; }
.qa-text { display: grid; flex: 1; min-width: 0; line-height: 1.3; }
.qa-label { font-weight: 600; font-size: .9rem; }
.qa-detail { overflow: hidden; font-size: .8rem; color: var(--muted); text-overflow: ellipsis; white-space: nowrap; }
.qa-arrow { display: flex; color: var(--faint); transition: transform .15s var(--d-ease), color .15s var(--d-ease); }
.qa-arrow .ico { width: 16px; height: 16px; }
.qa-item:hover .qa-arrow { color: var(--accent); transform: translateX(2px); }
.app-body .qa-badge { background: color-mix(in srgb, var(--warn) 18%, transparent); color: var(--text); }

/* Module board */
.app-body .mod-section { margin-top: calc(var(--d-gap) * 1.5); }
.app-body .mod-section > h2 { margin: 0 0 .75rem; font-size: 1.15rem; }

@media (max-width: 1180px) {
  .ov-columns { grid-template-columns: minmax(0, 1fr); }
  .ov-col-side { grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr)); align-items: start; }
}
@media (max-width: 720px) {
  .ov-health { grid-template-columns: auto minmax(0, 1fr); padding: 1rem 1rem 1rem 1.2rem; }
  .ov-health-actions { grid-column: 1 / -1; flex-direction: row; flex-wrap: wrap; }
  .ov-health-actions .btn { flex: 1 1 auto; }
  .ov-health-badge { align-self: start; width: 2.4rem; height: 2.4rem; }
}
`;
