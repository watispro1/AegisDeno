/**
 * Dashboard QoL script (appended to /assets/dashboard.js): copy-ID buttons,
 * relative times kept current (<time data-rel>, rendered by views/layout relTime), the "?" shortcuts dialog, "/" to focus a table filter, and Ctrl/⌘+S to save
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

  /* Relative times: same wording as relTime() on the server, refreshed each minute. */
  var REL_UNITS = [[31536000000, 'year'], [2592000000, 'month'], [604800000, 'week'], [86400000, 'day'], [3600000, 'hour'], [60000, 'minute']];
  function relText(ms, now) {
    var diff = now - ms, abs = Math.abs(diff);
    for (var i = 0; i < REL_UNITS.length; i++) {
      if (abs >= REL_UNITS[i][0]) {
        var n = Math.floor(abs / REL_UNITS[i][0]), unit = REL_UNITS[i][1] + (n === 1 ? '' : 's');
        return diff >= 0 ? n + ' ' + unit + ' ago' : 'in ' + n + ' ' + unit;
      }
    }
    return 'just now';
  }
  function refreshRel() {
    var now = Date.now(), els = doc.querySelectorAll('time[data-rel][datetime]');
    for (var i = 0; i < els.length; i++) {
      var ms = Date.parse(els[i].getAttribute('datetime') || '');
      if (!isNaN(ms)) els[i].textContent = relText(ms, now);
    }
  }
  refreshRel();
  setInterval(refreshRel, 60000);

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
