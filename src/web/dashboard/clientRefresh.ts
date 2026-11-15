/**
 * Dashboard refresh script (appended to /assets/dashboard.js): folds the case
 * filters away on phones when none is on, and puts a "•" in the tab title
 * while a form has unsaved changes so the state is visible from the tab strip
 * too. Plain ES5, data attributes only, nothing inline (CSP). Every page still
 * works without it: the filter panel is rendered open and the title unchanged.
 */
export const dashboardRefreshScript = String.raw`
(function () {
  'use strict';
  var doc = document;

  /* Case filters: open on wide screens and whenever a filter is on, folded on phones otherwise. */
  var narrow = window.matchMedia && window.matchMedia('(max-width: 720px)').matches;
  var panels = doc.querySelectorAll('[data-filter-panel]');
  for (var i = 0; i < panels.length; i++) {
    if (narrow && panels[i].getAttribute('data-active-count') === '0') panels[i].removeAttribute('open');
  }

  /* Unsaved changes: mirror the bar's state in the document title. */
  var bar = doc.querySelector('[data-unsaved-bar]');
  if (bar && window.MutationObserver) {
    var base = doc.title;
    var sync = function () {
      var dirty = !bar.hasAttribute('hidden');
      doc.title = dirty ? '\u2022 ' + base : base;
      if (doc.body) doc.body.setAttribute('data-unsaved', dirty ? 'true' : 'false');
    };
    new MutationObserver(sync).observe(bar, { attributes: true, attributeFilter: ['hidden'] });
    sync();
  }
})();
`;
