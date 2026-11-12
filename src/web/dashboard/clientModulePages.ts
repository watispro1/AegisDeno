/**
 * Module page lists (views/moduleKit.ts): filter chips, sort menu and
 * "show more" paging over tables that already carry the search filter.
 * Plain ES5, progressive only: without it every row is shown as sent.
 */
export const dashboardModulePagesScript = String.raw`
(function () {
  'use strict';
  var doc = document;
  function all(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function rowsOf(table) { var b = table.tBodies && table.tBodies[0]; return b ? Array.prototype.slice.call(b.rows) : []; }

  var tables = {};
  function state(id) {
    var table = doc.getElementById(id);
    if (!table) return null;
    if (!tables[id]) {
      var size = parseInt(table.getAttribute('data-page-size'), 10) || 0;
      tables[id] = { table: table, size: size, limit: size };
    }
    return tables[id];
  }

  /* Hide rows past the current limit, update the count, "show more" and the empty line. */
  function refresh(id) {
    var s = state(id);
    if (!s) return;
    var rows = rowsOf(s.table), visible = 0, matched = 0;
    rows.forEach(function (r) {
      if (r.hasAttribute('data-filtered-out') || r.hasAttribute('data-chip-out')) { r.removeAttribute('data-paged-out'); return; }
      matched++;
      if (s.size && matched > s.limit) r.setAttribute('data-paged-out', '');
      else { r.removeAttribute('data-paged-out'); visible++; }
    });
    var more = doc.querySelector('[data-more-for="' + id + '"]');
    if (more) {
      var rest = matched - visible;
      more.hidden = rest <= 0;
      more.textContent = 'Show ' + Math.min(rest, s.size || rest) + ' more (' + rest + ' hidden)';
    }
    var empty = doc.querySelector('[data-list-empty="' + id + '"]');
    if (empty) empty.hidden = matched > 0;
    var count = doc.querySelector('[data-filter-count="' + id + '"]');
    if (count) count.textContent = matched === rows.length ? (s.size && rows.length > s.limit ? visible + ' of ' + rows.length + ' shown' : '') : matched + ' of ' + rows.length + ' match';
  }

  all('table[data-page-size]').forEach(function (t) { if (t.id) refresh(t.id); });
  all('[data-more-for]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var s = state(btn.getAttribute('data-more-for'));
      if (!s) return;
      s.limit += s.size || 20;
      refresh(btn.getAttribute('data-more-for'));
    });
  });

  /* Search: the base filter marks rows first; then re-page. */
  all('[data-filter-target]').forEach(function (input) {
    var id = input.getAttribute('data-filter-target');
    if (!doc.querySelector('[data-more-for="' + id + '"], [data-chip-for="' + id + '"]')) return;
    input.addEventListener('input', function () {
      var s = state(id);
      if (s) s.limit = s.size;
      window.setTimeout(function () { refresh(id); }, 0);
    });
  });

  /* Filter chips */
  all('[data-chip-for]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var id = chip.getAttribute('data-chip-for');
      var value = chip.getAttribute('data-chip');
      all('[data-chip-for="' + id + '"]').forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
      var s = state(id);
      if (!s) return;
      s.limit = s.size;
      rowsOf(s.table).forEach(function (r) {
        var v = r.getAttribute('data-chip-value');
        if (!value || v === value) r.removeAttribute('data-chip-out'); else r.setAttribute('data-chip-out', '');
      });
      refresh(id);
    });
  });

  /* Sort menu: "key:asc" or "key:desc" over data-sort-key; numbers compare as numbers. */
  all('[data-sort-target]').forEach(function (select) {
    var id = select.getAttribute('data-sort-target');
    var s = state(id);
    if (!s) return;
    var body = s.table.tBodies[0];
    var original = rowsOf(s.table);
    select.addEventListener('change', function () {
      var parts = (select.value || '').split(':');
      var key = 'data-sort-' + parts[0], dir = parts[1] === 'desc' ? -1 : 1;
      var rows = original.slice();
      if (parts[0]) {
        rows.sort(function (a, b) {
          var x = a.getAttribute(key), y = b.getAttribute(key);
          if (x === null && y === null) return 0;
          if (x === null) return 1;
          if (y === null) return -1;
          var nx = Number(x), ny = Number(y);
          var c = (x !== '' && y !== '' && !isNaN(nx) && !isNaN(ny)) ? nx - ny : x.localeCompare(y);
          return c * dir;
        });
      }
      rows.forEach(function (r) { body.appendChild(r); });
      refresh(id);
    });
  });
})();
`;
