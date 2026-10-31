/** Public page styles: home, features/docs, commands, help, changelog, status, legal, 404 and footer. */
export const cssPages = String.raw`/* ── Home ───────────────────────────────────────────────────────────── */
.hero { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 3rem; align-items: start; padding: 3.5rem 0 3rem; }
.hero h1 { font-size: clamp(2rem, 1.5rem + 2.2vw, 2.9rem); max-width: 18ch; margin-bottom: 1rem; }
.hero .lead { margin-bottom: 1.5rem; }
.hero-meta { display: flex; flex-wrap: wrap; gap: .4rem 1rem; font: 400 .82rem/1.4 var(--mono); color: var(--faint); margin-bottom: 1.25rem; }
.hero-meta span { display: inline-flex; align-items: center; gap: .4rem; }
.hero-aside { display: flex; flex-direction: column; gap: .6rem; }
.hero-caption { font-size: .8rem; color: var(--faint); margin: 0; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--ok); flex-shrink: 0; }
.dot.warn { background: var(--warn); }
.dot.danger { background: var(--danger); }

.ref { border-top: 1px solid var(--border); }
.ref-row {
  display: grid; grid-template-columns: 11rem minmax(0, 1fr) minmax(0, 17rem);
  gap: 1.25rem; padding: 1rem 0; border-bottom: 1px solid var(--border); align-items: baseline;
}
.ref-row h3 { font-size: 1rem; margin: 0; }
.ref-row h3 a { color: var(--text); text-decoration: none; }
.ref-row h3 a:hover { color: var(--accent); text-decoration: underline; }
.ref-row p { margin: 0; color: var(--text-2); font-size: .95rem; }
.ref-cmd { font: 400 .82rem/1.5 var(--mono); color: var(--muted); }
.ref-cmd code { color: var(--text); }

.steps { list-style: none; padding: 0; margin: 0; counter-reset: step; display: grid; gap: 0; border-top: 1px solid var(--border); }
.steps li { counter-increment: step; display: grid; grid-template-columns: 2.25rem minmax(0, 1fr); gap: .5rem 1rem; padding: 1rem 0; border-bottom: 1px solid var(--border); margin: 0; }
.steps li::before { content: counter(step); font: 500 .9rem/1.6 var(--mono); color: var(--accent); }
.steps h3 { font-size: 1rem; margin: 0 0 .2rem; }
.steps p { margin: 0 0 .4rem; color: var(--text-2); font-size: .95rem; }
.steps pre.block { margin: .35rem 0 0; }

.two-col { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 2.5rem; }
.notes { list-style: none; padding: 0; margin: 0; }
.notes li { padding: .7rem 0; border-bottom: 1px solid var(--border); margin: 0; font-size: .95rem; color: var(--text-2); }
.notes li strong { color: var(--text); font-weight: 600; }

.accordion { border-top: 1px solid var(--border); }
.acc { border-bottom: 1px solid var(--border); }
.acc summary {
  cursor: pointer; list-style: none; padding: .85rem 0; font-weight: 500;
  display: flex; justify-content: space-between; gap: 1rem; min-height: 44px; align-items: center;
}
.acc summary::-webkit-details-marker { display: none; }
.acc summary::after { content: "+"; font-family: var(--mono); color: var(--faint); }
.acc[open] summary::after { content: "\2212"; }
.acc-body { padding: 0 0 1rem; color: var(--text-2); font-size: .95rem; max-width: 70ch; }
.acc-body p:last-child { margin-bottom: 0; }

.end-note { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem; padding: 1.5rem 0; }
.end-note p { margin: 0; color: var(--text-2); }

/* ── Two-pane pages (features, docs) ────────────────────────────────── */
.split { display: grid; grid-template-columns: 13rem minmax(0, 1fr); gap: 3rem; align-items: start; padding-bottom: 3rem; }
.toc { position: sticky; top: calc(var(--nav-h) + 1.5rem); font-size: .88rem; max-height: calc(100vh - var(--nav-h) - 3rem); overflow-y: auto; }
.side-title { font: 500 .75rem/1.4 var(--mono); color: var(--faint); text-transform: uppercase; letter-spacing: .05em; margin: 0 0 .5rem; }
.toc ul { list-style: none; padding: 0; margin: 0 0 1.5rem; border-left: 1px solid var(--border); }
.toc li { margin: 0; }
.toc a { display: block; padding: .25rem 0 .25rem .75rem; margin-left: -1px; color: var(--muted); text-decoration: none; border-left: 1px solid transparent; }
.toc a:hover { color: var(--text); }
.toc a.active { color: var(--text); border-left-color: var(--accent); font-weight: 500; }
.toc-mobile { display: none; border: 1px solid var(--border); border-radius: var(--r); margin-bottom: 1.5rem; background: var(--surface); }
.toc-mobile summary { cursor: pointer; padding: .6rem .8rem; font-weight: 500; font-size: .92rem; min-height: 44px; display: flex; align-items: center; }
.toc-mobile ul { list-style: none; margin: 0; padding: 0 .8rem .6rem; columns: 2; column-gap: 1rem; }
.toc-mobile li { margin: 0; }
.toc-mobile a { display: block; padding: .35rem 0; font-size: .9rem; }
.toc-mobile nav { padding: 0 .8rem .4rem; }
.toc-mobile nav .side-title { margin: .6rem 0 .2rem; }
.toc-mobile nav ul { padding: 0; }
.toc ul.toc-sub, .toc-mobile ul.toc-sub { border-left: 0; margin: 0 0 .25rem; padding-left: .75rem; columns: auto; }
.toc ul.toc-sub a { font-size: .84rem; padding-top: .15rem; padding-bottom: .15rem; }
.doc-h { scroll-margin-top: calc(var(--nav-h) + 1rem); }
.h-anchor { color: var(--faint); text-decoration: none; font: 400 .85em var(--mono); opacity: 0; margin-left: .2rem; }
.doc-h:hover .h-anchor, .h-anchor:focus { opacity: 1; }
.h-anchor:hover { color: var(--accent); }
.setup-steps li { margin-bottom: .55rem; }
.cmd-link { text-decoration: none; }
.cmd-link:hover code { border-color: var(--accent); }

.feature { padding: 0 0 2.5rem; margin-bottom: 2.5rem; border-bottom: 1px solid var(--border); }
.feature:last-child { border-bottom: 0; margin-bottom: 0; }
.feature h2 { margin-bottom: .4rem; }
.feature > p { color: var(--text-2); max-width: 68ch; }
.feature ul { max-width: 68ch; color: var(--text-2); }
.feature-cmds { display: grid; gap: 0; margin: 1rem 0; border: 1px solid var(--border); border-radius: var(--r); background: var(--surface); }
.feature-cmds div { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1rem; padding: .5rem .8rem; border-bottom: 1px solid var(--border); font-size: .9rem; }
.feature-cmds div:last-child { border-bottom: 0; }
.feature-cmds code { font-family: var(--mono); font-size: .84rem; color: var(--text); overflow-wrap: anywhere; }
.feature-cmds span { color: var(--muted); }
.feature-links { font-size: .9rem; }

.prose { max-width: 72ch; }
.prose h2 { margin-top: 2.75rem; padding-top: 1.75rem; border-top: 1px solid var(--border); }
.prose h2:first-child { margin-top: 0; padding-top: 0; border-top: 0; }
.prose h3 { margin-top: 1.75rem; }
.prose p, .prose li { color: var(--text-2); }
.prose .table-wrap { max-width: none; }

/* ── Commands ───────────────────────────────────────────────────────── */
.cmd-toolbar { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; margin-bottom: .75rem; }
.search {
  position: relative; flex: 1 1 320px; display: flex; align-items: center;
  border: 1px solid var(--border-strong); border-radius: var(--r); background: var(--surface);
}
.search:focus-within { border-color: var(--accent); }
.search .icon { position: absolute; left: .7rem; color: var(--faint); display: flex; }
.search input {
  flex: 1; min-width: 0; min-height: 44px; padding: 0 2.5rem 0 2.25rem;
  border: 0; outline: 0; background: transparent; color: var(--text); font: 400 .95rem var(--sans);
}
.search .hint { position: absolute; right: .6rem; }
.cmd-count { font: 400 .85rem var(--mono); color: var(--faint); }
.tabs { display: flex; flex-wrap: wrap; gap: .35rem; margin-bottom: 2rem; }
.tab {
  min-height: 44px; padding: .25rem .75rem;
  font: 400 .85rem var(--sans); color: var(--muted);
  background: transparent; border: 1px solid var(--border); border-radius: var(--r); cursor: pointer;
}
.tab:hover { color: var(--text); border-color: var(--border-strong); }
.tab[aria-pressed="true"] { color: var(--accent-ink); background: var(--accent); border-color: var(--accent); }
.tab .n { font-family: var(--mono); font-size: .78rem; opacity: .75; margin-left: .2rem; }
.empty-state { border: 1px dashed var(--border-strong); border-radius: var(--r); padding: 1.25rem; color: var(--muted); margin-bottom: 2rem; }
.empty-state[hidden] { display: none; }
.empty-state strong { display: block; color: var(--text); }

.cmd-group { margin-bottom: 2.5rem; }
.cmd-group[hidden] { display: none; }
.cmd-group-head { display: flex; align-items: baseline; gap: .75rem; flex-wrap: wrap; padding-bottom: .5rem; border-bottom: 1px solid var(--border-strong); }
.cmd-group-head h2 { font-size: 1.15rem; margin: 0; }
.cmd-group-head .blurb { color: var(--muted); font-size: .9rem; }
.cmd-group-head .n { margin-left: auto; font: 400 .8rem var(--mono); color: var(--faint); }

.cmd-card { border-bottom: 1px solid var(--border); }
.cmd-card[hidden] { display: none; }
.cmd-card > summary {
  list-style: none; cursor: pointer;
  display: grid; grid-template-columns: 1.25rem minmax(9rem, max-content) minmax(0, 1fr) auto 1rem;
  gap: .75rem; align-items: baseline; padding: .7rem 0; min-height: 44px;
}
.cmd-card > summary::-webkit-details-marker { display: none; }
.cmd-card > summary:hover .cmd-slash { color: var(--accent); }
.cmd-anchor { color: var(--faint); text-decoration: none; font-family: var(--mono); font-size: .85rem; opacity: .6; }
.cmd-anchor:hover { opacity: 1; color: var(--accent); }
.cmd-slash { font: 500 .95rem var(--mono); color: var(--text); }
.cmd-summary-text { min-width: 0; }
.cmd-desc { color: var(--text-2); font-size: .92rem; }
.cmd-meta { display: flex; gap: .3rem; flex-wrap: wrap; justify-content: flex-end; }
.cmd-chevron { font-family: var(--mono); color: var(--faint); }
.cmd-chevron::before { content: "+"; }
.cmd-card[open] .cmd-chevron::before { content: "\2212"; }
.cmd-card.flash > summary { background: var(--accent-soft); }
.cmd-body { padding: .25rem 0 1.25rem 2rem; display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; }
.cmd-body > * { min-width: 0; }
.cmd-run { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
.copy-btn {
  display: inline-flex; align-items: center; min-height: 44px; padding: 0 .75rem;
  font: 400 .8rem var(--sans); color: var(--muted); text-decoration: none;
  background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--r); cursor: pointer;
}
.copy-btn:hover { color: var(--text); }
.copy-btn.copied { color: var(--ok); border-color: var(--ok); }
.cmd-section-title { font: 500 .75rem/1.4 var(--mono); color: var(--faint); text-transform: uppercase; letter-spacing: .05em; margin-bottom: .4rem; }
.synopsis {
  margin: 0; padding: .6rem .8rem; background: var(--code-bg); border: 1px solid var(--border); border-radius: var(--r);
  font: 400 .84rem/1.75 var(--mono); overflow-x: auto; white-space: pre;
}
.synopsis .opt { color: var(--faint); }
.opt-table td:first-child code { font-family: var(--mono); font-size: .84rem; }
.opt-req { font: 500 .78rem var(--mono); color: var(--warn); }
.opt-opt { font: 400 .78rem var(--mono); color: var(--faint); }
.cmd-jump { margin: 0 0 1.25rem; }
.cmd-jump ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: .25rem 1.1rem; font-size: .9rem; }
.cmd-jump li { margin: 0; }
.cmd-sticky { position: sticky; top: calc(var(--nav-h) + env(safe-area-inset-top)); z-index: 5; background: var(--bg); padding: .6rem 0 .1rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); }
.cmd-sticky .tabs { margin-bottom: .5rem; }
.cmd-group, .cmd-card, .cmd-sub { scroll-margin-top: calc(var(--nav-h) + 8.5rem); }
.group-anchor { color: inherit; text-decoration: none; }
.group-anchor:hover { color: var(--accent); }
.empty-state .btn-row { margin-top: .75rem; }
.linklike { background: none; border: 0; padding: 0 .1rem; font: inherit; color: var(--accent); text-decoration: underline; cursor: pointer; min-height: 44px; }
.cmd-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(12rem, 100%), 1fr)); gap: .5rem 1.25rem; margin: 0; padding: .7rem .85rem; border: 1px solid var(--border); border-radius: var(--r); background: var(--surface); }
.cmd-facts > div { min-width: 0; }
.cmd-facts dt { font: 500 .72rem/1.4 var(--mono); color: var(--faint); text-transform: uppercase; letter-spacing: .05em; }
.cmd-facts dd { margin: .1rem 0 0; font-size: .9rem; color: var(--text-2); overflow-wrap: anywhere; }
.sub-group + .sub-group { margin-top: 1rem; }
.cmd-sub { border-top: 1px solid var(--border); padding: .75rem 0 .25rem; min-width: 0; }
.cmd-sub:target, .cmd-sub.flash { background: var(--accent-soft); }
.cmd-sub-title { font-size: .95rem; margin: 0 0 .25rem; display: flex; align-items: baseline; gap: .4rem; flex-wrap: wrap; }
.cmd-sub-title code { font-family: var(--mono); overflow-wrap: anywhere; }
.sub-anchor { color: var(--faint); text-decoration: none; font-family: var(--mono); font-size: .85rem; }
.sub-anchor:hover { color: var(--accent); }
.cmd-sub-desc { margin: 0 0 .6rem; color: var(--text-2); font-size: .92rem; }
.examples { list-style: none; margin: .6rem 0 0; padding: 0; display: grid; gap: .4rem; }
.examples li { margin: 0; display: flex; align-items: center; gap: .5rem; min-width: 0; }
.examples code { flex: 1 1 auto; min-width: 0; font: 400 .84rem/1.5 var(--mono); padding: .45rem .65rem; background: var(--code-bg); border: 1px solid var(--border); border-radius: var(--r); overflow-wrap: anywhere; white-space: normal; }
.examples .copy-btn { flex: 0 0 auto; }

/* ── Help page ──────────────────────────────────────────────────────── */
.help-search { max-width: 560px; margin-bottom: 2rem; }
.issue-group { margin-bottom: 2.25rem; }
.issue-group[hidden] { display: none; }
.issue-group h2 { font-size: 1.15rem; padding-bottom: .5rem; border-bottom: 1px solid var(--border-strong); margin-bottom: 0; }
.issue { border-bottom: 1px solid var(--border); }
.issue[hidden] { display: none; }
.issue summary { cursor: pointer; list-style: none; padding: .8rem 0; font-weight: 500; display: flex; justify-content: space-between; gap: 1rem; min-height: 44px; align-items: center; }
.issue summary::-webkit-details-marker { display: none; }
.issue summary::after { content: "+"; font-family: var(--mono); color: var(--faint); }
.issue[open] summary::after { content: "\2212"; }
.issue-body { padding: 0 0 1rem; color: var(--text-2); font-size: .95rem; max-width: 72ch; }
.issue-body ol { margin-bottom: 0; }
.hierarchy { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin: 0 0 1.25rem; }
.hierarchy > div { padding: .75rem 1rem; border: 1px solid var(--border); border-radius: var(--r); background: var(--surface); font-size: .92rem; }
.hierarchy ol { margin: 0; padding-left: 1.25rem; }
.hierarchy .bad { border-left: 3px solid var(--danger); }
.hierarchy .good { border-left: 3px solid var(--ok); }
.hierarchy-label { display: block; font: 500 .75rem var(--mono); text-transform: uppercase; letter-spacing: .05em; margin: 0 0 .35rem; color: var(--faint); }

/* ── Changelog ──────────────────────────────────────────────────────── */
.release { display: grid; grid-template-columns: 9rem minmax(0, 1fr); gap: 1.5rem; padding: 1.75rem 0; border-bottom: 1px solid var(--border); scroll-margin-top: 5rem; }
.release-meta { font-family: var(--mono); font-size: .85rem; color: var(--faint); padding-top: .2rem; }
.release-meta time, .release-pending { display: block; }
.release-pending { color: var(--warn); }
.release-diff { display: inline-block; margin-top: .35rem; color: var(--text-2); }
.release-title { font-size: 1.3rem; margin: 0 0 .5rem; font-family: var(--mono); }
.release-title a { color: var(--text); text-decoration: none; }
.release-title a:hover { color: var(--accent); text-decoration: underline; }
.release h3 { font-size: .8rem; margin: 1.1rem 0 .35rem; text-transform: uppercase; letter-spacing: .06em; color: var(--text-2); }
.release-summary { color: var(--text-2); margin-bottom: .75rem; max-width: 72ch; }
.changes { padding-left: 1.1rem; margin: 0; max-width: 76ch; }
.changes li { padding: .2rem 0; margin: 0; font-size: .93rem; color: var(--text-2); }
.changes li strong { color: var(--text); font-weight: 600; }
.changes li ul { padding-left: 1.1rem; margin: .2rem 0 0; list-style: circle; }
.changes li li { padding: .1rem 0; }

/* ── Status ─────────────────────────────────────────────────────────── */
.status-line {
  display: flex; flex-wrap: wrap; align-items: center; gap: .75rem 1.25rem;
  padding: 1rem 1.1rem; margin-bottom: 2rem;
  border: 1px solid var(--border); border-left: 3px solid var(--ok);
  border-radius: var(--r); background: var(--surface);
}
.status-line.bad { border-left-color: var(--danger); }
.status-line h2 { font-size: 1.15rem; margin: 0; }
.status-line p { margin: 0; color: var(--muted); font-size: .92rem; flex: 1 1 260px; }
.status-line .btn { margin-left: auto; }
.metrics td:nth-child(2) { font-family: var(--mono); white-space: nowrap; }
.metrics td:first-child { font-weight: 500; white-space: nowrap; }
.metrics td.good { color: var(--ok); }
.metrics td.warn { color: var(--warn); }
.metrics tr.current td { background: var(--accent-soft); }
.endpoints td:first-child { white-space: nowrap; }

/* ── Legal ──────────────────────────────────────────────────────────── */
.legal { max-width: 72ch; padding-bottom: 3rem; }
.legal h2 { font-size: 1.15rem; margin-top: 2rem; }
.legal h3 { font-size: 1rem; margin-top: 1.25rem; }
.legal p, .legal li { color: var(--text-2); }
.legal h2[id], .legal h3[id] { scroll-margin-top: 5rem; }
.legal table { width: 100%; }
.legal-meta { display: flex; flex-wrap: wrap; gap: .25rem 1rem; }
.at-a-glance { border: 1px solid var(--border); border-radius: var(--r); padding: 1rem 1.25rem; background: var(--bg-sunk); margin: 1rem 0 0; max-width: 72ch; }
.at-a-glance h2 { font-size: 1rem; margin: 0 0 .5rem; }
.at-a-glance ul { margin: 0; padding-left: 1.2rem; }
.at-a-glance li { color: var(--text-2); }
/* 404 suggestions and search */
.suggest { margin: 1rem 0 1.5rem; }
.suggest a { font-weight: 500; }
.notfound-search { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; max-width: 36rem; margin: 1rem 0 1.5rem; }
.notfound-search input { flex: 1 1 14rem; min-width: 0; min-height: 44px; padding: .5rem .75rem; border: 1px solid var(--border-strong); border-radius: var(--r); background: var(--bg); color: var(--text); font: inherit; }
@media (max-width: 860px), (pointer: coarse) { .notfound-search input { font-size: 16px; } }

/* ── Footer ─────────────────────────────────────────────────────────── */
footer.site { border-top: 1px solid var(--border); margin-top: 3rem; padding: 2.5rem 0 calc(1.5rem + env(safe-area-inset-bottom)); font-size: .88rem; background: var(--bg-sunk); }
.footer-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) repeat(3, minmax(0, 1fr)); gap: 2rem; }
.footer-brand p { color: var(--muted); max-width: 36ch; margin-top: .6rem; }
.footer-meta a { color: var(--text-2); }
.footer-title { font: 500 .75rem/1.4 var(--mono); color: var(--faint); text-transform: uppercase; letter-spacing: .05em; margin-bottom: .6rem; }
.footer-col ul { list-style: none; padding: 0; margin: 0; }
.footer-col li { margin: 0; }
.footer-col a { display: inline-block; padding: .2rem 0; color: var(--text-2); text-decoration: none; }
.footer-col a:hover { color: var(--accent); text-decoration: underline; }
.footer-bottom { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 1rem; margin-top: 2rem; padding-top: 1.25rem; border-top: 1px solid var(--border); color: var(--faint); font-size: .82rem; }
.footer-bottom nav { display: flex; flex-wrap: wrap; gap: 1rem; }
.footer-bottom a { color: var(--faint); }

/* Touch screens: give list links a 44px target. */
@media (pointer: coarse) {
  .toc a, .toc-mobile a { display: flex; align-items: center; min-height: 44px; padding-top: .25rem; padding-bottom: .25rem; }
  .footer-col a, .footer-bottom a, .footer-meta a, .breadcrumbs a, .suggest a, .text-link, .ref-row h3 a, .case-link, .release-title a, .release-diff {
    display: inline-flex; align-items: center; min-height: 44px;
  }
  .footer-col a { padding: 0; }
  .footer-bottom a { min-width: 44px; justify-content: center; }
  .cmd-anchor, .sub-anchor { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; }
  .cmd-jump a, .group-anchor { display: inline-flex; align-items: center; min-height: 44px; }
  .h-anchor { opacity: 1; display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; }
  .cmd-link { display: inline-flex; align-items: center; min-height: 44px; }
  .btn.sm { min-height: 44px; }
}


`;
