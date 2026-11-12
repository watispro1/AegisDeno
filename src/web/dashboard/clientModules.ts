/**
 * Dashboard modules script (appended to /assets/dashboard.js): filters the
 * overview's module board by text, category and readiness. Plain ES5, data
 * attributes only, nothing inline (CSP). Without it every card shows.
 */
export const dashboardModulesScript = String.raw`
(function () {
  'use strict';
  var doc = document;
  function all(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }

  /* Overview module board */
  var board = doc.querySelector('[data-module-board]');
  if (board) {
    var tools = board.querySelector('[data-module-tools]');
    var input = board.querySelector('[data-module-filter]');
    var count = board.querySelector('[data-module-count]');
    var empty = board.querySelector('[data-module-empty]');
    var chips = all('[data-module-chip]', board);
    var mode = 'all';
    if (tools) tools.removeAttribute('hidden');
    var run = function () {
      var q = input ? input.value.trim().toLowerCase() : '';
      var shown = 0, total = 0;
      all('[data-module-group]', board).forEach(function (grp) {
        var cat = grp.getAttribute('data-module-group');
        var hits = 0;
        all('[data-module-key]', grp).forEach(function (card) {
          total++;
          var r = card.getAttribute('data-readiness');
          var okMode = mode === 'all' || mode === cat || (mode === 'attention' && (r === 'setup' || r === 'problem'));
          var okText = !q || (card.getAttribute('data-filter-text') || '').indexOf(q) !== -1;
          if (okMode && okText) { card.removeAttribute('hidden'); hits++; } else card.setAttribute('hidden', '');
        });
        if (hits) grp.removeAttribute('hidden'); else grp.setAttribute('hidden', '');
        shown += hits;
      });
      if (count) count.textContent = (q || mode !== 'all') ? shown + ' of ' + total + ' shown' : '';
      if (empty) { if (shown) empty.setAttribute('hidden', ''); else empty.removeAttribute('hidden'); }
    };
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        mode = chip.getAttribute('data-module-chip') || 'all';
        chips.forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
        run();
      });
    });
    if (input) {
      input.addEventListener('input', run);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && input.value) { e.stopPropagation(); input.value = ''; run(); }
        else if (e.key === 'Enter') {
          var first = board.querySelector('[data-module-key]:not([hidden]) a');
          if (first) { e.preventDefault(); first.click(); }
        }
      });
    }
  }
})();
`;
