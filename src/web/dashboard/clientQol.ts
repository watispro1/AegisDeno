/**
 * Dashboard QoL script (appended to /assets/dashboard.js): copy-ID buttons,
 * the "?" shortcuts dialog, "/" to focus a table filter, and Ctrl/⌘+S to save
 * the changed form. Plain ES5, data attributes only, nothing inline (CSP).
 */
export const dashboardQolScript = String.raw`
(function () {
  'use strict';
  var doc = document;
  function typing(t) { return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); }

  doc.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('button[data-copy]') : null;
    if (!btn) return;
    var text = btn.getAttribute('data-copy') || '';
    var done = function () { var old = btn.textContent; btn.textContent = '✓'; btn.setAttribute('aria-label', 'Copied'); setTimeout(function () { btn.textContent = old; }, 1200); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
  });

  var dlg = doc.querySelector('[data-shortcuts]');
  function openShortcuts() { if (dlg && dlg.showModal && !dlg.open) dlg.showModal(); }
  var opener = doc.querySelector('[data-shortcuts-open]');
  if (opener) opener.addEventListener('click', openShortcuts);

  doc.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      var bar = doc.querySelector('[data-unsaved-bar]:not([hidden]) [data-unsaved-save]');
      if (bar) { e.preventDefault(); bar.click(); }
      return;
    }
    if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '?') { e.preventDefault(); openShortcuts(); }
    else if (e.key === '/') {
      var f = doc.querySelector('.table-search');
      if (f) { e.preventDefault(); f.focus(); }
    }
  });
})();
`;
