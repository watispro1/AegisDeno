/** Responsive breakpoints, touch targets and print styles. */
export const cssResponsive = String.raw`/* ── Responsive ─────────────────────────────────────────────────────── */
@media (max-width: 960px) {
  .hero { grid-template-columns: minmax(0, 1fr); gap: 2rem; padding-top: 2.5rem; }
  .split { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .toc { display: none; }
  .toc-mobile { display: block; }
  .ref-row { grid-template-columns: minmax(0, 1fr); gap: .3rem; }
  .two-col { grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
  .footer-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .footer-brand { grid-column: 1 / -1; }
}
@media (max-width: 640px) {
  body { font-size: 15.5px; }
  .section { padding: 2.25rem 0; }
  .page-head { padding: 1.75rem 0 1.25rem; margin-bottom: 1.5rem; }
  .cmd-card > summary { grid-template-columns: minmax(0, 1fr) 1rem; gap: .2rem .5rem; }
  .cmd-anchor, .cmd-meta { display: none; }
  .cmd-slash { grid-column: 1; }
  .cmd-summary-text { grid-column: 1; grid-row: 2; }
  .cmd-chevron { grid-column: 2; grid-row: 1; }
  .cmd-body { padding-left: 0; }
  .cmd-jump { display: none; }
  .cmd-sticky { padding-top: .4rem; }
  .cmd-sticky .cmd-toolbar { gap: .5rem; margin-bottom: .5rem; }
  .cmd-sticky #cmd-expand { display: none; }
  .examples li { align-items: stretch; }
  .release { grid-template-columns: minmax(0, 1fr); gap: .5rem; }
  .feature-cmds div { grid-template-columns: minmax(0, 1fr); gap: .1rem; }
  .toc-mobile ul { columns: 1; }
  .dc-embed { max-width: none; }
  .metrics td.faint { display: none; }
  .tabs { flex-wrap: nowrap; overflow-x: auto; margin-right: -1.25rem; padding-right: 1.25rem; padding-bottom: .25rem; }
  .tab { flex-shrink: 0; }
  .prose code, .legal code, .callout code.inline { white-space: normal; overflow-wrap: anywhere; }
  .table-wrap code { white-space: nowrap; }
}

/* Phones and touch screens: 16px form text, so iOS Safari does not zoom in on focus. */
@media (max-width: 860px), (pointer: coarse) {
  .search input, .site-search-input-wrap input,
  .field input[type="text"], .field input[type="number"], .field select, .field textarea,
  .filter-bar input, .filter-bar select { font-size: 16px; }
}

@media print {
  .nav, footer.site, .site-search, .toc, .toc-mobile { display: none !important; }
  body { background: #fff; color: #000; }
}
`;
