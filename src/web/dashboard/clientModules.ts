/**
 * Dashboard modules script (appended to /assets/dashboard.js): filters the
 * overview's module board by text, category and readiness; adds a filter box
 * to long selects; chips, search and Select all / none to checkbox lists; and
 * checks required, min/max, length and pattern before a form is sent,
 * showing the message under the field and focusing the first one. Plain ES5,
 * data attributes only, nothing inline (CSP). Every form works without it and
 * the server validates everything again.
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

  /* Long selects: a filter box above the list */
  all('select[data-searchable]').forEach(function (sel) {
    var box = doc.createElement('input');
    box.type = 'search';
    box.className = 'select-search';
    box.setAttribute('autocomplete', 'off');
    box.setAttribute('placeholder', 'Type to filter…');
    var lab = sel.id ? doc.querySelector('label[for="' + sel.id + '"]') : null;
    box.setAttribute('aria-label', 'Filter ' + (lab ? lab.textContent.trim() : 'options'));
    if (sel.id) box.setAttribute('aria-controls', sel.id);
    sel.parentNode.insertBefore(box, sel);
    box.addEventListener('input', function () {
      var q = box.value.trim().toLowerCase(), firstHit = null;
      all('option', sel).forEach(function (o) {
        var keep = !q || o.selected || o.value === '' || o.textContent.toLowerCase().indexOf(q) !== -1;
        o.hidden = !keep;
        if (keep && q && !firstHit && o.value !== '' && !o.disabled) firstHit = o;
      });
      all('optgroup', sel).forEach(function (g) {
        var vis = all('option', g).some(function (o) { return !o.hidden; });
        g.hidden = !vis;
      });
      box.__aegisFirst = firstHit;
    });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (box.__aegisFirst) { sel.value = box.__aegisFirst.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
        sel.focus();
      } else if (e.key === 'Escape' && box.value) { e.stopPropagation(); box.value = ''; box.dispatchEvent(new Event('input')); }
    });
  });

  /* Checkbox lists: chips, search, select all / none */
  all('[data-pick-list]').forEach(function (list) {
    var tools = list.querySelector('[data-pick-tools]');
    var chips = list.querySelector('[data-pick-chips]');
    var search = list.querySelector('[data-pick-search]');
    var boxes = all('.pick input[type="checkbox"]', list);
    if (!tools || !boxes.length) return;
    tools.removeAttribute('hidden');
    var labelOf = function (cb) { var sp = cb.parentNode.querySelector('span'); return sp ? sp.textContent : cb.value; };
    var fire = function (cb) { cb.dispatchEvent(new Event('change', { bubbles: true })); };
    var drawChips = function () {
      if (!chips) return;
      while (chips.firstChild) chips.removeChild(chips.firstChild);
      var on = boxes.filter(function (cb) { return cb.checked; });
      on.forEach(function (cb) {
        var li = doc.createElement('li'); li.className = 'pick-chip';
        var t = doc.createElement('span'); t.textContent = labelOf(cb); li.appendChild(t);
        var x = doc.createElement('button'); x.type = 'button'; x.textContent = '×';
        x.setAttribute('aria-label', 'Remove ' + labelOf(cb));
        x.addEventListener('click', function () { cb.checked = false; fire(cb); cb.focus(); });
        li.appendChild(x); chips.appendChild(li);
      });
      if (on.length) chips.removeAttribute('hidden'); else chips.setAttribute('hidden', '');
    };
    var visible = function () { return boxes.filter(function (cb) { return !cb.parentNode.hidden; }); };
    var setAll = function (value) {
      var changed = null;
      visible().forEach(function (cb) { if (cb.checked !== value) { cb.checked = value; changed = cb; } });
      if (changed) fire(changed);
    };
    var allBtn = tools.querySelector('[data-pick-all]');
    var noneBtn = tools.querySelector('[data-pick-none]');
    if (allBtn) allBtn.addEventListener('click', function () { setAll(true); });
    if (noneBtn) noneBtn.addEventListener('click', function () { setAll(false); });
    if (search) {
      search.addEventListener('input', function () {
        var q = search.value.trim().toLowerCase();
        boxes.forEach(function (cb) { cb.parentNode.hidden = !!q && labelOf(cb).toLowerCase().indexOf(q) === -1; });
        all('.pick-group', list).forEach(function (g) { g.hidden = !all('.pick', g).some(function (l) { return !l.hidden; }); });
      });
      search.addEventListener('keydown', function (e) { if (e.key === 'Enter') e.preventDefault(); });
    }
    list.addEventListener('change', drawChips);
    var form = list.closest ? list.closest('form') : null;
    if (form) form.addEventListener('reset', function () { setTimeout(drawChips, 0); });
    drawChips();
  });

  /* Inline validation before submit */
  function fieldLabel(el) {
    var lab = el.id ? doc.querySelector('label[for="' + el.id + '"]') : null;
    return lab ? lab.textContent.trim() : '';
  }
  function problem(el) {
    if (el.disabled || el.type === 'hidden' || el.type === 'checkbox' || el.type === 'radio' || el.type === 'search') return '';
    var v = el.value, trimmed = v.trim();
    var required = el.hasAttribute('required') || el.getAttribute('aria-required') === 'true';
    if (required && !trimmed) return el.tagName === 'SELECT' ? 'Pick one.' : 'Fill this in.';
    if (!trimmed) return '';
    if (el.type === 'number') {
      var n = Number(trimmed);
      if (!isFinite(n)) return 'Enter a number.';
      if (el.getAttribute('step') === '1' && Math.floor(n) !== n) return 'Enter a whole number.';
      var min = el.getAttribute('min'), max = el.getAttribute('max');
      if (min !== null && min !== '' && n < Number(min)) return 'Use ' + min + ' or more.';
      if (max !== null && max !== '' && n > Number(max)) return 'Use ' + max + ' or less.';
    }
    var maxLen = parseInt(el.getAttribute('maxlength'), 10), minLen = parseInt(el.getAttribute('minlength'), 10);
    if (maxLen && v.length > maxLen) return 'Use at most ' + maxLen + ' characters (now ' + v.length + ').';
    if (minLen && v.length < minLen) return 'Use at least ' + minLen + ' characters.';
    var pat = el.getAttribute('pattern');
    if (pat) {
      var re = null;
      try { re = new RegExp('^(?:' + pat + ')$'); } catch (e) { re = null; }
      if (re && !re.test(v)) return el.getAttribute('data-pattern-message') || 'This is not in the expected format.';
    }
    return '';
  }
  function describedBy(el, id, on) {
    var ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (x) { return x && x !== id; });
    if (on) ids.unshift(id);
    if (ids.length) el.setAttribute('aria-describedby', ids.join(' ')); else el.removeAttribute('aria-describedby');
  }
  function showError(el, msg) {
    var id = (el.id || el.name) + '-client-error';
    var box = doc.getElementById(id);
    var server = el.id ? doc.getElementById(el.id.replace(/^f-/, '') + '-error') : null;
    if (msg) {
      if (!box) {
        box = doc.createElement('span'); box.className = 'field-error'; box.id = id; box.setAttribute('data-client-error', '');
        var nx = el.nextSibling;
        var after = nx && typeof nx.className === 'string' && nx.className.indexOf('char-count') !== -1 ? nx : el;
        after.parentNode.insertBefore(box, after.nextSibling);
      }
      box.textContent = msg; box.removeAttribute('hidden');
      if (server) server.setAttribute('hidden', '');
      el.setAttribute('aria-invalid', 'true');
      describedBy(el, id, true);
    } else {
      if (box) { box.setAttribute('hidden', ''); box.textContent = ''; describedBy(el, id, false); }
      if (!server || server.hasAttribute('hidden')) el.removeAttribute('aria-invalid');
    }
  }
  function checkable(form) { return all('input, select, textarea', form).filter(function (el) { return el.name && el.name !== '_csrf'; }); }
  doc.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM' || !form.hasAttribute('novalidate')) return;
    var first = null;
    checkable(form).forEach(function (el) {
      var msg = problem(el);
      showError(el, msg);
      if (msg && !first) first = el;
    });
    if (!first) return;
    e.preventDefault();
    e.stopPropagation();
    if (first.focus) first.focus();
    if (first.scrollIntoView) first.scrollIntoView({ block: 'center' });
    var label = fieldLabel(first);
    var live = doc.querySelector('[data-unsaved-count]');
    if (live && label) live.textContent = '(check ' + label + ')';
  }, true);
  doc.addEventListener('input', function (e) {
    var el = e.target;
    if (!el || !el.form || !el.form.hasAttribute('novalidate') || !el.name) return;
    if (el.getAttribute('aria-invalid') === 'true') {
      var server = el.id ? doc.getElementById(el.id.replace(/^f-/, '') + '-error') : null;
      if (server && !problem(el)) server.setAttribute('hidden', '');
      showError(el, problem(el));
    }
  });
  doc.addEventListener('change', function (e) {
    var el = e.target;
    if (el && el.form && el.form.hasAttribute('novalidate') && el.getAttribute('aria-invalid') === 'true' && el.tagName === 'SELECT') showError(el, problem(el));
  });

  /* Character counters: warn near the limit (the counter itself is clientApp's) */
  all('[data-count-max]').forEach(function (el) {
    var max = parseInt(el.getAttribute('data-count-max'), 10);
    var c = el.nextSibling;
    if (!max || !c || typeof c.className !== 'string' || c.className.indexOf('char-count') === -1) return;
    var upd = function () { var n = el.value.length; c.classList.toggle('near', n >= max * 0.9 && n <= max); };
    el.addEventListener('input', upd); upd();
  });
})();
`;
