/**
 * Public page refresh: the Security and Why Aegis pages. Theme tokens only,
 * so Light, Dark, Steel & Ink and Glass all work; Glass touches at the end.
 */
export const cssSiteRefresh = String.raw`/* ── Site refresh ─────────────────────────────────────────────────── */
/* Security */
.sec-head .btn-row { margin-top: 1.1rem; }
.sec-head .eyebrow { display: block; margin-bottom: .35rem; }
.sec-glance { max-width: none; margin: 0 0 2.5rem; padding: 0; border: 0; background: transparent; }
.sec-glance h2 { margin: 0 0 .75rem; font-size: 1rem; }
.sec-glance .sec-glance-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(15rem, 100%), 1fr)); gap: .75rem; counter-reset: glance; }
.sec-glance-list li { position: relative; margin: 0; padding: 2.4rem 1rem 1rem; border: 1px solid var(--border); border-radius: var(--r); background: var(--surface); color: var(--text-2); font-size: .92rem; line-height: 1.5; counter-increment: glance; }
.sec-glance-list li::before { content: "0" counter(glance); position: absolute; top: .85rem; left: 1rem; font: 600 .75rem var(--mono); color: var(--accent); letter-spacing: .05em; }
.sec-split { border-top: 1px solid var(--border); padding-top: 2rem; }
.sec-body > h2, .sec-body > section > h2 { scroll-margin-top: calc(var(--nav-h, 4rem) + 1rem); }
.sec-body > h2 { margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border); }
.sec-report { padding: 1.1rem 1.25rem; border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: var(--r); background: var(--bg-sunk); }
.sec-report h2 { margin-top: 0; }
.sec-steps { padding-left: 1.3rem; }
.sec-steps li { margin: .35rem 0; }
.legal .sec-points { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(17rem, 100%), 1fr)); gap: .75rem; }
.sec-points li { margin: 0; padding: .85rem 1rem; border: 1px solid var(--border); border-radius: var(--r); }
.sec-points li strong { display: block; margin-bottom: .2rem; color: var(--text); }
.legal .csp-list { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(16rem, 100%), 1fr)); gap: .35rem; }
.csp-list li { margin: 0; }
.csp-list code.inline { display: block; padding: .35rem .55rem; overflow-wrap: anywhere; white-space: normal; }

/* Why Aegis */
.why-jump { margin: -.5rem 0 2rem; }
.why-jump ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: .4rem; }
.why-jump a { display: inline-flex; align-items: center; gap: .4rem; min-height: 36px; padding: .3rem .75rem; border: 1px solid var(--border); border-radius: 999px; color: var(--text-2); font-size: .88rem; text-decoration: none; }
.why-jump a:hover { border-color: var(--accent); color: var(--text); }
.why-jump a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.why-jump-icon { width: 1rem; height: 1rem; }
.why-grid { gap: 1rem; }
.why-card { display: flex; flex-direction: column; padding: 1.2rem 1.25rem 1rem; background: var(--surface); }
.why-card .f-card-head { margin-bottom: .6rem; }
.why-n { display: block; margin-bottom: .2rem; font: 600 .72rem var(--mono); color: var(--accent); letter-spacing: .05em; }
.why-text { flex: 1; }
.why-text p { margin: 0 0 .75rem; line-height: 1.6; color: var(--text-2); }
.why-proof { margin: 0; padding-top: .7rem; border-top: 1px dashed var(--border); font-size: .88rem; }
.why-proof-label { display: inline-block; margin-right: .3rem; font: 600 .68rem var(--mono); text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.why-table .f-why tbody th { width: 34%; }
.why-table .f-why td:nth-child(2) { color: var(--text); font-weight: 500; }
@media (max-width: 640px) {
  .why-table { border: 0; overflow: visible; }
  .why-table .f-why tr { padding: .8rem 0; }
  .why-table .f-why tbody th { width: auto; margin-bottom: .3rem; font-size: .8rem; letter-spacing: .04em; }
  .why-table .f-why td { display: grid; grid-template-columns: 6.5rem minmax(0, 1fr); gap: .5rem; }
  .why-table .f-why td::before { content: attr(data-label); font: 500 .75rem var(--mono); color: var(--faint); padding-top: .15rem; }
  .sec-report { padding: 1rem; }
}

/* Glass (beta) */
[data-theme="glass"] .sec-glance-list li,
[data-theme="glass"] .why-card { background: rgba(255, 255, 255, .03); border-color: rgba(255, 255, 255, .12); border-radius: var(--r-lg); }
[data-theme="glass"] .sec-report { background: rgba(255, 255, 255, .04); border-color: rgba(255, 255, 255, .12); border-left-color: var(--accent); border-radius: var(--r-lg); }
[data-theme="glass"] .sec-points li { border-color: rgba(255, 255, 255, .12); border-radius: var(--r); }
[data-theme="glass"] .why-jump a { border-color: rgba(255, 255, 255, .14); background: rgba(255, 255, 255, .03); }
`;
