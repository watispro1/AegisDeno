/**
 * Dashboard redesign script (1.4.0, appended to /assets/dashboard.js): the
 * sidebar filter, sidebar collapse (remembered in localStorage), "g then key"
 * and "[" shortcuts, data-list-filter lists (server picker, server switcher),
 * the changed-field count in the unsaved bar, and the thin progress bar on
 * link navigation and form submit. Plain ES5, data attributes only, nothing
 * inline (CSP). Every page still works without it.
 */
export const dashboardRedesignScript = String.raw`
(function () {
  'use strict';
  var doc = document;
  var root = doc.documentElement;
  if (root.classList) root.classList.add('js');
  function all(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function typing(t) { return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } return null; }

  /* Sidebar filter */
  var navFilter = doc.querySelector('[data-nav-filter]');
  if (navFilter) {
    var navEmpty = doc.querySelector('[data-nav-filter-empty]');
    var runNav = function () {
      var q = navFilter.value.trim().toLowerCase(), shown = 0;
      all('.side-nav .nav-group').forEach(function (grp) {
        var groupHits = 0;
        all('[data-nav-item]', grp).forEach(function (li) {
          var hit = !q || li.textContent.toLowerCase().indexOf(q) !== -1;
          if (hit) { li.removeAttribute('hidden'); groupHits++; } else li.setAttribute('hidden', '');
        });
        if (groupHits) grp.removeAttribute('hidden'); else grp.setAttribute('hidden', '');
        var det = grp.querySelector('details');
        if (det && q && groupHits) det.open = true;
        shown += groupHits;
      });
      if (navEmpty) { if (shown) navEmpty.setAttribute('hidden', ''); else navEmpty.removeAttribute('hidden'); }
    };
    navFilter.addEventListener('input', runNav);
    navFilter.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { navFilter.value = ''; runNav(); navFilter.blur(); }
      else if (e.key === 'Enter') {
        var first = doc.querySelector('.side-nav [data-nav-item]:not([hidden]) a');
        if (first) { e.preventDefault(); first.click(); }
      }
    });
  }

  /* Sidebar collapse, remembered across pages */
  var app = doc.querySelector('[data-app]');
  var collapseBtn = doc.querySelector('[data-side-collapse]');
  var COLLAPSE_KEY = 'aegis.dash.sideCollapsed';
  function setCollapsed(on, save) {
    if (!app) return;
    if (on) app.setAttribute('data-collapsed', ''); else app.removeAttribute('data-collapsed');
    if (collapseBtn) {
      collapseBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      collapseBtn.setAttribute('title', (on ? 'Expand' : 'Collapse') + ' sidebar ([)');
      var label = collapseBtn.querySelector('.visually-hidden');
      if (label) label.textContent = (on ? 'Expand' : 'Collapse') + ' sidebar';
    }
    if (save) store(COLLAPSE_KEY, on ? '1' : null);
  }
  if (app) setCollapsed(store(COLLAPSE_KEY) === '1', false);
  if (collapseBtn) collapseBtn.addEventListener('click', function () { setCollapsed(!app.hasAttribute('data-collapsed'), true); });

  /* g then key, and [ */
  var GO = { o: 'overview', s: 'settings', c: 'cases', a: 'activity', m: 'members' };
  var pendingG = 0;
  doc.addEventListener('keydown', function (e) {
    if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (doc.querySelector('dialog[open]')) return;
    var k = (e.key || '').toLowerCase();
    if (k === '[' && collapseBtn && app) { e.preventDefault(); setCollapsed(!app.hasAttribute('data-collapsed'), true); return; }
    if (pendingG && Date.now() - pendingG < 1500 && GO[k]) {
      pendingG = 0;
      var link = doc.querySelector('[data-nav-key="' + GO[k] + '"]');
      if (link) { e.preventDefault(); link.click(); }
      return;
    }
    pendingG = k === 'g' ? Date.now() : 0;
  });

  /* Filterable lists: <input data-list-filter="id"> over <ul id="id"> items with data-filter-text */
  function listFilter(input, list, countEl, emptyEl) {
    var run = function () {
      var q = input.value.trim().toLowerCase();
      var items = all(':scope > li', list).filter(function (li) { return li.hasAttribute('data-filter-text') || !li.className; });
      var shown = 0;
      items.forEach(function (li) {
        var text = (li.getAttribute('data-filter-text') || li.textContent).toLowerCase();
        var hit = !q || text.indexOf(q) !== -1;
        if (hit) { li.removeAttribute('hidden'); shown++; } else li.setAttribute('hidden', '');
      });
      if (countEl) countEl.textContent = q ? shown + ' of ' + items.length + ' shown' : '';
      if (emptyEl) { if (q && !shown) emptyEl.removeAttribute('hidden'); else emptyEl.setAttribute('hidden', ''); }
    };
    input.addEventListener('input', run);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && input.value) { e.stopPropagation(); input.value = ''; run(); }
      else if (e.key === 'Enter') {
        var first = list.querySelector('li:not([hidden]) a');
        if (first) { e.preventDefault(); first.click(); }
      }
    });
  }
  all('[data-list-filter]').forEach(function (input) {
    var id = input.getAttribute('data-list-filter');
    var list = doc.getElementById(id);
    if (!list) return;
    listFilter(input, list, doc.querySelector('[data-list-filter-count="' + id + '"]'), doc.querySelector('[data-list-filter-empty="' + id + '"]'));
  });
  all('[data-switcher-filter]').forEach(function (input) {
    var list = input.closest('[data-switcher-list]');
    if (list) listFilter(input, list, null, null);
  });

  /* Changed-field count in the unsaved bar */
  var countEl = doc.querySelector('[data-unsaved-count]');
  if (countEl) {
    var fieldVal = function (el) { return (el.type === 'checkbox' || el.type === 'radio') ? String(el.checked) : el.value; };
    var fields = function (form) { return all('input, select, textarea', form).filter(function (el) { return el.name && el.name !== '_csrf' && el.type !== 'submit' && el.type !== 'hidden'; }); };
    all('form[data-track-changes]').forEach(function (form) {
      fields(form).forEach(function (el) { el.__aegisStart = fieldVal(el); });
      var update = function () {
        var n = fields(form).filter(function (el) { return el.__aegisStart !== undefined && fieldVal(el) !== el.__aegisStart; }).length;
        countEl.textContent = n ? '(' + n + ' field' + (n === 1 ? '' : 's') + ')' : '';
      };
      form.addEventListener('input', update);
      form.addEventListener('change', update);
      form.addEventListener('reset', function () { setTimeout(update, 0); });
      form.addEventListener('submit', function () { countEl.textContent = ''; });
    });
  }

  /* Progress bar on navigation */
  var bar = doc.querySelector('[data-nav-progress]');
  if (bar) {
    var start = function () { bar.classList.remove('is-done'); void bar.offsetWidth; bar.classList.add('is-active'); };
    var done = function () { bar.classList.remove('is-active'); bar.classList.add('is-done'); };
    doc.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || a.target || a.hasAttribute('download') || a.getAttribute('rel') === 'external') return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || /^(mailto|tel|javascript):/i.test(href)) return;
      if (a.host && a.host !== location.host) return;
      if (a.pathname === location.pathname && a.search === location.search && a.hash) return;
      start();
    });
    doc.addEventListener('submit', function (e) {
      if (e.defaultPrevented) return;
      var f = e.target;
      if (f && f.target && f.target !== '_self') return;
      setTimeout(function () { if (!e.defaultPrevented) start(); }, 0);
    });
    window.addEventListener('pageshow', done);
  }
})();
`;
