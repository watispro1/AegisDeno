/**
 * Community pages (views/communityKit.ts): search, filter chips, sort and
 * "show more" over card lists, plus the digest's live schedule line.
 * Plain ES5, progressive only: without it every card is shown as sent.
 */
export const dashboardCommunityPagesScript = String.raw`
(function () {
  'use strict';
  var doc = document;
  function all(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function cards(list) { return Array.prototype.slice.call(list.children); }

  var lists = {};
  function state(id) {
    var list = doc.getElementById(id);
    if (!list || !list.hasAttribute('data-card-list')) return null;
    if (!lists[id]) {
      var size = parseInt(list.getAttribute('data-page-size'), 10) || 0;
      lists[id] = { list: list, size: size, limit: size, original: cards(list) };
    }
    return lists[id];
  }

  function refresh(id) {
    var s = state(id);
    if (!s) return;
    var items = cards(s.list), visible = 0, matched = 0;
    items.forEach(function (c) {
      if (c.hasAttribute('data-cl-q-out') || c.hasAttribute('data-cl-chip-out')) { c.removeAttribute('data-cl-paged-out'); return; }
      matched++;
      if (s.size && matched > s.limit) c.setAttribute('data-cl-paged-out', '');
      else { c.removeAttribute('data-cl-paged-out'); visible++; }
    });
    var more = doc.querySelector('[data-cl-more="' + id + '"]');
    if (more) {
      var rest = matched - visible;
      more.hidden = rest <= 0;
      more.textContent = 'Show ' + Math.min(rest, s.size || rest) + ' more (' + rest + ' hidden)';
    }
    var empty = doc.querySelector('[data-cl-empty="' + id + '"]');
    if (empty) empty.hidden = matched > 0;
    var count = doc.querySelector('[data-cl-count="' + id + '"]');
    if (count) count.textContent = matched === items.length ? (s.size && items.length > s.limit ? visible + ' of ' + items.length + ' shown' : '') : matched + ' of ' + items.length + ' match';
  }

  all('[data-card-list]').forEach(function (l) { if (l.id) refresh(l.id); });

  all('[data-cl-more]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-cl-more'), s = state(id);
      if (!s) return;
      s.limit += s.size || 10;
      refresh(id);
    });
  });

  all('[data-cl-search]').forEach(function (input) {
    var id = input.getAttribute('data-cl-search');
    input.addEventListener('input', function () {
      var s = state(id);
      if (!s) return;
      var q = input.value.trim().toLowerCase();
      cards(s.list).forEach(function (c) {
        if (!q || c.textContent.toLowerCase().indexOf(q) !== -1) c.removeAttribute('data-cl-q-out'); else c.setAttribute('data-cl-q-out', '');
      });
      s.limit = s.size;
      refresh(id);
    });
  });

  all('[data-cl-chip-for]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var id = chip.getAttribute('data-cl-chip-for'), value = chip.getAttribute('data-cl-chip');
      all('[data-cl-chip-for="' + id + '"]').forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
      var s = state(id);
      if (!s) return;
      cards(s.list).forEach(function (c) {
        if (!value || c.getAttribute('data-chip-value') === value) c.removeAttribute('data-cl-chip-out'); else c.setAttribute('data-cl-chip-out', '');
      });
      s.limit = s.size;
      refresh(id);
    });
  });

  all('[data-cl-sort]').forEach(function (select) {
    var id = select.getAttribute('data-cl-sort');
    select.addEventListener('change', function () {
      var s = state(id);
      if (!s) return;
      var parts = (select.value || '').split(':');
      var key = 'data-sort-' + parts[0], dir = parts[1] === 'desc' ? -1 : 1;
      var items = s.original.slice();
      if (parts[0]) {
        items.sort(function (a, b) {
          var x = a.getAttribute(key), y = b.getAttribute(key);
          if (x === null && y === null) return 0;
          if (x === null) return 1;
          if (y === null) return -1;
          var nx = Number(x), ny = Number(y);
          return ((x !== '' && y !== '' && !isNaN(nx) && !isNaN(ny)) ? nx - ny : x.localeCompare(y)) * dir;
        });
      }
      items.forEach(function (c) { s.list.appendChild(c); });
      refresh(id);
    });
  });

  /* Digest: the schedule line follows the form before saving. */
  all('[data-schedule-preview]').forEach(function (out) {
    var px = out.getAttribute('data-schedule-preview');
    var days = (out.getAttribute('data-days') || '').split(',');
    var on = doc.getElementById('f-' + px + 'enabled');
    var day = doc.getElementById('f-' + px + 'day');
    var hour = doc.getElementById('f-' + px + 'hour');
    var tz = doc.getElementById('f-' + px + 'timezone');
    if (!day || !hour || !tz) return;
    var sync = function () {
      var d = parseInt(day.value, 10), h = parseInt(hour.value, 10);
      if (on && !on.checked) { out.textContent = 'Off: nothing will be posted.'; return; }
      if (isNaN(d) || !days[d] || isNaN(h) || h < 0 || h > 23 || String(h) !== hour.value.trim()) { out.textContent = 'Pick a day and an hour from 0 to 23.'; return; }
      out.textContent = 'Will post ' + days[d] + 's at ' + (h < 10 ? '0' : '') + h + ':00 ' + (tz.value.trim() || 'UTC') + '.';
    };
    [on, day, hour, tz].forEach(function (el) { if (el) { el.addEventListener('input', sync); el.addEventListener('change', sync); } });
  });
})();
`;
