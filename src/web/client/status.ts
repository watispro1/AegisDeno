/**
 * Script served from /assets/status.js. Plain ES5, progressive: the status
 * page is complete without it. It re-reads /api/status every 30 seconds while
 * the tab is visible and updates the page through textContent and className
 * only (no innerHTML, no inline styles), so the strict CSP holds.
 */
export const statusScript = String.raw`
(function () {
  'use strict';
  var root = document.querySelector('[data-status-page]');
  if (!root || !window.fetch) return;
  var LABEL = { operational: 'Operational', degraded: 'Degraded', outage: 'Outage', unknown: 'Unknown' };
  var BANNER = { operational: 'ok', degraded: 'warn', major_outage: 'bad', maintenance: 'info' };
  function q(sel) { return root.querySelector(sel); }
  function text(el, value) { if (el) el.textContent = value; }
  function pct(v) { return v === null || v === undefined ? 'No data' : (Math.floor(v * 10000) / 100).toFixed(2) + '%'; }
  function level(v) { return v === null || v === undefined ? 'none' : v >= 0.999 ? 'ok' : v >= 0.95 ? 'warn' : 'bad'; }
  function utc(iso) { return String(iso).replace('T', ' ').slice(0, 16) + ' UTC'; }
  function uptime(sec) {
    var d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    return d > 0 ? d + 'd ' + h + 'h' : h > 0 ? h + 'h ' + m + 'm' : m + 'm ' + (sec % 60) + 's';
  }
  function bars(key, w) {
    var list = q('[data-status-bars="' + key + '"]');
    text(q('[data-status-uptime="' + key + '"]'), pct(w.uptime));
    if (!list) return;
    while (list.firstChild) list.removeChild(list.firstChild);
    for (var i = 0; i < w.buckets.length; i++) {
      var b = w.buckets[i];
      var li = document.createElement('li');
      li.className = 'ub ub-' + level(b.uptime);
      var label = utc(b.start) + ': ' + pct(b.uptime);
      li.title = label;
      var sr = document.createElement('span');
      sr.className = 'visually-hidden';
      sr.textContent = label;
      li.appendChild(sr);
      list.appendChild(li);
    }
  }
  function apply(s) {
    var banner = q('[data-status-banner]');
    if (banner) banner.className = 'status-banner ' + (BANNER[s.status] || 'warn');
    text(q('[data-status-headline]'), s.headline);
    text(q('[data-status-updated]'), utc(s.updatedAt));
    for (var i = 0; i < s.components.length; i++) {
      var c = s.components[i];
      var row = q('[data-component="' + c.id + '"]');
      if (!row) continue;
      text(row.querySelector('[data-component-detail]'), c.detail);
      var pill = row.querySelector('[data-component-state]');
      if (pill) { pill.className = 'state-pill st-' + c.state; pill.textContent = LABEL[c.state] || c.state; }
    }
    var m = s.metrics;
    text(q('[data-status-metric="uptime"]'), uptime(m.uptimeSeconds));
    text(q('[data-status-metric="ping"]'), m.pingMs + ' ms');
    text(q('[data-status-metric="guilds"]'), Number(m.guilds).toLocaleString('en-US'));
    text(q('[data-status-metric="shards"]'), String(m.shards));
    text(q('[data-status-metric="memory"]'), m.memoryMb + ' MB');
    text(q('[data-status-metric="commands"]'), String(m.commands));
    bars('day', s.history.day);
    bars('week', s.history.week);
    text(q('[data-status-note]'), 'Last checked ' + new Date().toLocaleTimeString() + '. Values refresh every 30 seconds while this tab is open.');
  }
  var busy = false;
  function refresh() {
    if (busy || document.hidden) return;
    busy = true;
    fetch('/api/status', { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(apply)
      .catch(function () {
        text(q('[data-status-note]'), 'Could not reach the status API just now; showing the last values. Retrying in 30 seconds.');
      })
      .then(function () { busy = false; });
  }
  var btn = q('[data-status-refresh]');
  if (btn) btn.addEventListener('click', refresh);
  setInterval(refresh, 30000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
})();
`;
