/** Dashboard styles: forms, tables, metric cards, action badges and dialogs. */
export const cssDashboard = String.raw`/* ── Dashboard ──────────────────────────────────────────────────────── */
.dash-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .85rem; padding: 1.1rem 0; border-bottom: 1px solid var(--border); font-size: .92rem; color: var(--muted); }
.dash-bar form { margin: 0; }
.dash-bar > span { min-width: 0; overflow-wrap: anywhere; }
.dash-action { margin: 0 0 2rem; }
.section-title { margin-top: 2.75rem; font-size: 1.35rem; font-weight: 600; letter-spacing: -.01em; }
.dash-nav { display: flex; flex-wrap: wrap; gap: .4rem; margin: 0 0 2rem; padding: 0; list-style: none; }
.dash-nav li { margin: 0; }
.dash-nav a {
  display: inline-flex; align-items: center; min-height: 44px; padding: .3rem 1rem;
  font-size: .92rem; font-weight: 500; color: var(--text-2); text-decoration: none;
  border: 1px solid var(--border); border-radius: 8px; background: var(--surface);
  transition: border-color .15s ease, color .15s ease, background .15s ease;
}
.dash-nav a:hover { border-color: var(--border-strong); color: var(--text); background: var(--bg-sunk); }
.dash-nav a[aria-current="page"] { color: var(--accent-ink); background: var(--accent); border-color: var(--accent); font-weight: 600; }
.guild-list { list-style: none; padding: 0; margin: 0 0 2rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(18rem, 100%), 1fr)); gap: .85rem; }
.guild-list li { margin: 0; }
.guild-item {
  display: flex; align-items: center; justify-content: space-between; gap: .85rem; min-height: 64px;
  padding: .85rem 1.15rem; border: 1px solid var(--border); border-radius: 12px; background: var(--surface);
  color: var(--text); text-decoration: none; transition: border-color .15s ease, box-shadow .15s ease;
}
a.guild-item:hover { border-color: var(--accent); color: var(--text); box-shadow: 0 4px 16px rgba(0,0,0,.04); }
.guild-item .name { font-weight: 600; font-size: .95rem; overflow-wrap: anywhere; }
.guild-actions { display: inline-flex; flex-wrap: wrap; gap: .5rem; align-items: center; justify-content: flex-end; }
.invite-help { margin-top: .85rem; font-size: .88rem; line-height: 1.5; }
.stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(11rem, 100%), 1fr)); gap: .85rem; margin: 0 0 2rem; padding: 0; }
.stat { border: 1px solid var(--border); border-radius: 12px; background: var(--surface); padding: 1rem 1.25rem; margin: 0; transition: border-color .15s ease, box-shadow .15s ease; }
.stat:hover { border-color: var(--border-strong); box-shadow: 0 4px 14px rgba(0,0,0,.04); }
.stat dt { font-size: .82rem; color: var(--muted); }
.stat dd { margin: .2rem 0 0; font: 700 1.65rem/1.2 var(--mono); color: var(--text); }
.stat dd small { font: 500 .8rem var(--sans); color: var(--faint); }
.dash-form { max-width: 44rem; margin: 0 0 2.5rem; }
.dash-form fieldset { min-width: 0; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); padding: 1.25rem 1.35rem .5rem; margin: 0 0 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.02); }
.dash-form legend { font-weight: 600; font-size: 1rem; padding: 0 .4rem; }
.field { margin: 0 0 1.15rem; }
.field > label { display: block; font-weight: 500; font-size: .92rem; margin-bottom: .35rem; }
.field input[type="text"], .field input[type="number"], .field select, .field textarea, .filter-bar input, .filter-bar select {
  width: 100%; min-height: 44px; padding: .5rem .75rem;
  font: 400 .95rem var(--sans); color: var(--text); background: var(--bg);
  border: 1px solid var(--border-strong); border-radius: 8px;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.field textarea { min-height: 7.5rem; resize: vertical; font-family: var(--mono); font-size: .88rem; line-height: 1.5; }
.field input:focus, .field select:focus, .field textarea:focus, .filter-bar input:focus, .filter-bar select:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.field [aria-invalid="true"] { border-color: var(--danger); }
.field-help { display: block; font-size: .84rem; color: var(--muted); margin-top: .35rem; line-height: 1.4; }
.field-error { display: block; font-size: .87rem; color: var(--danger); margin-top: .35rem; font-weight: 500; }
.check { display: flex; align-items: flex-start; gap: .65rem; min-height: 44px; padding: .55rem 0; margin: 0 0 .5rem; cursor: pointer; }
.check input { width: 1.25rem; height: 1.25rem; margin: .15rem 0 0; flex-shrink: 0; accent-color: var(--accent); }
.check span small { display: block; color: var(--muted); font-size: .85rem; margin-top: .15rem; }
.field-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .85rem; }
.error-summary { border: 1px solid var(--danger); border-left-width: 4px; border-radius: 8px; background: var(--surface); padding: .85rem 1.15rem; margin: 0 0 1.5rem; }
.error-summary h2 { font-size: 1.05rem; margin: 0 0 .45rem; color: var(--danger); }
.error-summary ul { margin: 0; padding-left: 1.2rem; }
.notice { border: 1px solid var(--border); border-left: 4px solid var(--ok); border-radius: 8px; background: var(--surface); padding: .85rem 1.15rem; margin: 0 0 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,.03); }
.notice.bad { border-left-color: var(--danger); }
.notice p { margin: 0; font-size: .92rem; }
.filter-bar { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(11rem, 100%), 1fr)); gap: .85rem; align-items: end; margin: 0 0 1.5rem; }
.filter-bar label { display: block; font-size: .85rem; font-weight: 500; margin-bottom: .3rem; }
.pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .85rem; margin: 0 0 2rem; font-size: .9rem; color: var(--muted); }
.case-table { width: 100%; border-collapse: separate; border-spacing: 0; }
.case-table th { padding: .75rem 1rem; font: 600 .74rem/1.2 var(--mono); text-transform: uppercase; letter-spacing: .06em; color: var(--faint); text-align: left; border-bottom: 2px solid var(--border); }
.case-table td { padding: .85rem 1rem; border-bottom: 1px solid var(--border); font-size: .92rem; vertical-align: middle; overflow-wrap: anywhere; }
.case-table td:first-child { white-space: nowrap; font-family: var(--mono); font-size: .85rem; color: var(--muted); }
.case-table tbody tr { transition: background-color .12s ease; }
.case-table tbody tr:hover { background-color: var(--bg-sunk); }
.case-link { text-decoration: none; }
.preview { border: 1px solid var(--border); border-radius: 8px; background: var(--bg-sunk); padding: .85rem 1.1rem; margin: 0 0 1rem; white-space: pre-wrap; overflow-wrap: anywhere; font-size: .93rem; }
.detail-list { display: grid; grid-template-columns: 10rem minmax(0, 1fr); gap: .6rem 1.25rem; margin: 0 0 2rem; }
.detail-list dt { color: var(--muted); font-size: .9rem; font-weight: 500; }
.detail-list dd { margin: 0; overflow-wrap: anywhere; }
.btn.danger { background: var(--danger); border-color: var(--danger); color: #fff; }
.btn.danger:hover { background: var(--danger); border-color: var(--danger); color: #fff; filter: brightness(.92); }
/* Disabled controls look disabled: greyed-out role panels, the busy state while a form is sending, unused timeout fields. */
.btn:disabled, .btn:disabled:hover { opacity: .55; cursor: not-allowed; filter: none; }
form[aria-busy="true"] .btn:disabled { cursor: progress; }
.dash-form input:disabled, .dash-form select:disabled, .dash-form textarea:disabled,
.panel-repost select:disabled { opacity: .6; cursor: not-allowed; }
.tag { display: inline-flex; align-items: center; gap: .3rem; padding: .15rem .6rem; border-radius: 999px; font-size: .78rem; font-weight: 600; text-transform: lowercase; line-height: 1.2; letter-spacing: .02em; border: 1px solid currentColor; }
.tag.ok { color: var(--ok); border-color: rgba(29, 122, 67, .3); background: rgba(29, 122, 67, .08); }
.tag.danger { color: var(--danger); border-color: rgba(179, 38, 30, .3); background: rgba(179, 38, 30, .08); }
.tag.ban { color: var(--danger); border-color: rgba(179, 38, 30, .3); background: rgba(179, 38, 30, .08); }
.tag.kick { color: var(--warn); border-color: rgba(154, 91, 0, .3); background: rgba(154, 91, 0, .08); }
.tag.timeout { color: var(--warn); border-color: rgba(154, 91, 0, .3); background: rgba(154, 91, 0, .08); }
.tag.warning { color: var(--muted); border-color: var(--border-strong); background: var(--bg-sunk); }
.tag.softban { color: var(--warn); border-color: rgba(154, 91, 0, .3); background: rgba(154, 91, 0, .08); }
.tag.note { color: var(--muted); border-color: var(--border-strong); background: var(--bg-sunk); }
.prewrap { white-space: pre-wrap; }
.pick-list .pick-scroll { max-height: 18rem; overflow-y: auto; margin: 0 -.35rem .75rem; padding: 0 .35rem; }
.pick-group { margin: 0 0 .6rem; }
.pick-group-title { font-size: .76rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; margin: .6rem 0 .2rem; font-family: var(--mono); }
.check.pick { margin: 0; padding: .35rem 0; overflow-wrap: anywhere; }
.check.pick span { min-width: 0; }
.panel-list { list-style: none; padding: 0; margin: 0 0 2.5rem; display: grid; gap: .85rem; max-width: 44rem; }
.panel-item { margin: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 20rem); gap: .75rem 1rem; align-items: end; padding: .95rem 1.15rem; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); box-shadow: 0 1px 3px rgba(0,0,0,.02); }
.panel-meta { min-width: 0; overflow-wrap: anywhere; align-self: center; }
.panel-meta .faint { display: block; font-size: .87rem; }
.panel-repost { display: flex; align-items: flex-end; gap: .5rem; margin: 0; min-width: 0; }
.panel-repost .field { flex: 1 1 auto; min-width: 0; margin: 0; }
.panel-repost .field > label { font-size: .85rem; }
.review-buttons { margin-top: .6rem; }
@media (max-width: 640px) {
  .field-row { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .panel-item { grid-template-columns: minmax(0, 1fr); }
}
`;