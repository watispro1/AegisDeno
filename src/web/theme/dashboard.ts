/** Dashboard styles. */
export const cssDashboard = String.raw`/* ── Dashboard ──────────────────────────────────────────────────────── */
.dash-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; padding: 1rem 0; border-bottom: 1px solid var(--border); font-size: .9rem; color: var(--muted); }
.dash-bar form { margin: 0; }
.dash-bar > span { min-width: 0; overflow-wrap: anywhere; }
.dash-action { margin: 0 0 2rem; }
.section-title { margin-top: 2.5rem; }
.dash-nav { display: flex; flex-wrap: wrap; gap: .35rem; margin: 0 0 2rem; padding: 0; list-style: none; }
.dash-nav li { margin: 0; }
.dash-nav a {
  display: inline-flex; align-items: center; min-height: 44px; padding: .25rem .9rem;
  font-size: .9rem; color: var(--text-2); text-decoration: none;
  border: 1px solid var(--border); border-radius: var(--r); background: var(--surface);
}
.dash-nav a:hover { border-color: var(--border-strong); color: var(--text); }
.dash-nav a[aria-current="page"] { color: var(--accent-ink); background: var(--accent); border-color: var(--accent); }
.guild-list { list-style: none; padding: 0; margin: 0 0 2rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(16rem, 100%), 1fr)); gap: .75rem; }
.guild-list li { margin: 0; }
.guild-item {
  display: flex; align-items: center; justify-content: space-between; gap: .75rem; min-height: 56px;
  padding: .7rem 1rem; border: 1px solid var(--border); border-radius: var(--r); background: var(--surface);
  color: var(--text); text-decoration: none;
}
a.guild-item:hover { border-color: var(--accent); color: var(--text); }
.guild-item .name { font-weight: 500; overflow-wrap: anywhere; }
.guild-actions { display: inline-flex; flex-wrap: wrap; gap: .5rem; align-items: center; justify-content: flex-end; }
.invite-help { margin-top: .75rem; font-size: .875rem; }
.stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(11rem, 100%), 1fr)); gap: .75rem; margin: 0 0 2rem; padding: 0; }
.stat { border: 1px solid var(--border); border-radius: var(--r); background: var(--surface); padding: .8rem 1rem; margin: 0; }
.stat dt { font-size: .82rem; color: var(--muted); }
.stat dd { margin: .15rem 0 0; font: 600 1.5rem/1.2 var(--mono); color: var(--text); }
.stat dd small { font: 400 .8rem var(--sans); color: var(--faint); }
.dash-form { max-width: 44rem; margin: 0 0 2.5rem; }
.dash-form fieldset { min-width: 0; border: 1px solid var(--border); border-radius: var(--r); background: var(--surface); padding: 1rem 1.1rem .25rem; margin: 0 0 1.25rem; }
.dash-form legend { font-weight: 600; padding: 0 .35rem; }
.field { margin: 0 0 1rem; }
.field > label { display: block; font-weight: 500; margin-bottom: .3rem; }
.field input[type="text"], .field input[type="number"], .field select, .field textarea, .filter-bar input, .filter-bar select {
  width: 100%; min-height: 44px; padding: .45rem .65rem;
  font: 400 .95rem var(--sans); color: var(--text); background: var(--bg);
  border: 1px solid var(--border-strong); border-radius: var(--r);
}
.field textarea { min-height: 7rem; resize: vertical; font-family: var(--mono); font-size: .88rem; line-height: 1.5; }
.field input:focus, .field select:focus, .field textarea:focus, .filter-bar input:focus, .filter-bar select:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
.field [aria-invalid="true"] { border-color: var(--danger); }
.field-help { display: block; font-size: .85rem; color: var(--muted); margin-top: .3rem; }
.field-error { display: block; font-size: .87rem; color: var(--danger); margin-top: .3rem; font-weight: 500; }
.check { display: flex; align-items: flex-start; gap: .6rem; min-height: 44px; padding: .55rem 0; margin: 0 0 .5rem; cursor: pointer; }
.check input { width: 1.2rem; height: 1.2rem; margin: .15rem 0 0; flex-shrink: 0; accent-color: var(--accent); }
.check span small { display: block; color: var(--muted); font-size: .85rem; }
.field-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem; }
.error-summary { border: 1px solid var(--danger); border-left-width: 3px; border-radius: var(--r); background: var(--surface); padding: .75rem 1rem; margin: 0 0 1.5rem; }
.error-summary h2 { font-size: 1rem; margin: 0 0 .4rem; color: var(--danger); }
.error-summary ul { margin: 0; }
.notice { border: 1px solid var(--border); border-left: 3px solid var(--ok); border-radius: var(--r); background: var(--surface); padding: .75rem 1rem; margin: 0 0 1.5rem; }
.notice.bad { border-left-color: var(--danger); }
.notice p { margin: 0; }
.filter-bar { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(11rem, 100%), 1fr)); gap: .75rem; align-items: end; margin: 0 0 1.5rem; }
.filter-bar label { display: block; font-size: .85rem; font-weight: 500; margin-bottom: .25rem; }
.pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; margin: 0 0 2rem; font-size: .9rem; color: var(--muted); }
.case-table td { overflow-wrap: anywhere; }
.case-table td:first-child { white-space: nowrap; }
.preview { border: 1px solid var(--border); border-radius: var(--r); background: var(--bg-sunk); padding: .75rem 1rem; margin: 0 0 1rem; white-space: pre-wrap; overflow-wrap: anywhere; font-size: .93rem; }
.detail-list { display: grid; grid-template-columns: 10rem minmax(0, 1fr); gap: .5rem 1rem; margin: 0 0 2rem; }
.detail-list dt { color: var(--muted); font-size: .9rem; }
.detail-list dd { margin: 0; overflow-wrap: anywhere; }
.btn.danger { background: var(--danger); border-color: var(--danger); color: #fff; }
.btn.danger:hover { background: var(--danger); border-color: var(--danger); color: #fff; filter: brightness(.92); }
/* Disabled controls look disabled: greyed-out role panels, the busy state while a form is sending, unused timeout fields. */
.btn:disabled, .btn:disabled:hover { opacity: .55; cursor: not-allowed; filter: none; }
form[aria-busy="true"] .btn:disabled { cursor: progress; }
.dash-form input:disabled, .dash-form select:disabled, .dash-form textarea:disabled,
.panel-repost select:disabled { opacity: .6; cursor: not-allowed; }
.tag.ok { color: var(--ok); border-color: currentColor; }
.prewrap { white-space: pre-wrap; }
.pick-list .pick-scroll { max-height: 18rem; overflow-y: auto; margin: 0 -.35rem .75rem; padding: 0 .35rem; }
.pick-group { margin: 0 0 .5rem; }
.pick-group-title { font-size: .78rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin: .5rem 0 .1rem; }
.check.pick { margin: 0; padding: .3rem 0; overflow-wrap: anywhere; }
.check.pick span { min-width: 0; }
.panel-list { list-style: none; padding: 0; margin: 0 0 2.5rem; display: grid; gap: .75rem; max-width: 44rem; }
.panel-item { margin: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 20rem); gap: .75rem 1rem; align-items: end; padding: .85rem 1rem; border: 1px solid var(--border); border-radius: var(--r); background: var(--surface); }
.panel-meta { min-width: 0; overflow-wrap: anywhere; align-self: center; }
.panel-meta .faint { display: block; font-size: .87rem; }
.panel-repost { display: flex; align-items: flex-end; gap: .5rem; margin: 0; min-width: 0; }
.panel-repost .field { flex: 1 1 auto; min-width: 0; margin: 0; }
.panel-repost .field > label { font-size: .85rem; }
.review-buttons { margin-top: .5rem; }
@media (max-width: 640px) {
  .field-row { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .detail-list { grid-template-columns: minmax(0, 1fr); gap: .1rem; }
  .detail-list dd { margin-bottom: .6rem; }
  .detail-list code.inline { white-space: normal; overflow-wrap: anywhere; }
  .dash-form fieldset { padding: .85rem .85rem .25rem; }
  .dash-form > .btn, .dash-action .btn { width: 100%; }
  .panel-item { grid-template-columns: minmax(0, 1fr); }
  .panel-repost { flex-direction: column; align-items: stretch; }
  .panel-repost .btn, .review-buttons .btn { width: 100%; }
  .review-buttons { flex-direction: column; }
  .filter-bar .btn-row .btn { flex: 1 1 0; }
  .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; }
  .stat { padding: .65rem .8rem; }
  .stat dd small { display: block; margin-top: .15rem; }
  .pager { flex-direction: column; align-items: stretch; }
  .pager .btn-row .btn { flex: 1 1 0; }
  /* Case lists become one card per record; each cell is labelled from data-label. */
  .case-table, .case-table tbody, .case-table tr, .case-table td { display: block; width: 100%; }
  .case-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .case-table tr { padding: .6rem .85rem; border-bottom: 1px solid var(--border); }
  .case-table tbody tr:last-child { border-bottom: 0; }
  .case-table td, .case-table td:first-child { position: relative; padding: .2rem 0 .2rem 6.75rem; border: 0; white-space: normal; }
  .case-table td::before {
    content: attr(data-label); position: absolute; left: 0; top: .2rem; width: 6rem;
    font-size: .78rem; line-height: 1.6rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .04em;
  }
  .case-table td code.inline { white-space: normal; overflow-wrap: anywhere; }
}

`;
