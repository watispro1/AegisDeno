/**
 * Script served from /assets/status.js. Plain ES5, progressive: the status
 * page is complete without it. It re-reads /api/status every 30 seconds while
 * the tab is visible (with a visible countdown, a pause switch and "Check
 * now"), shows times in the reader's own time zone and updates the page
 * through textContent, className and SVG attributes only (no innerHTML, no
 * inline styles), so the strict CSP holds.
 */
export const statusScript = String.raw`
(function () {
  'use strict';
  var root = document.querySelector('[data-status-page]');
  if (!root || !window.fetch) return;
  var PERIOD = Number(root.getAttribute('data-refresh-seconds')) || 30;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var LABEL = { operational: 'Operational', degraded: 'Degraded', outage: 'Outage', unknown: 'Unknown' };
  var BANNER = { operational: 'ok', degraded: 'warn', major_outage: 'bad', maintenance: 'info' };
  var ICON = {
    operational: ['M5 10.5l3.2 3.2L15 7'],
    ok: ['M5 10.5l3.2 3.2L15 7'],
    degraded: ['M10 5.5v5.5', 'M10 14.2v.3'],
    warn: ['M10 5.5v5.5', 'M10 14.2v.3'],
    outage: ['M6.5 6.5l7 7M13.5 6.5l-7 7'],
    bad: ['M6.5 6.5l7 7M13.5 6.5l-7 7'],
    info: ['M10 9v5.5', 'M10 5.8v.3'],
    unknown: ['M7.8 7.6a2.3 2.3 0 1 1 3 2.2c-.6.3-.8.7-.8 1.3', 'M10 14.2v.3']
  };
  function q(sel) { return root.querySelector(sel); }
  function qa(sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  function text(el, value) { if (el) el.textContent = value; }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function pct(v) { return v === null || v === undefined ? 'No data' : (Math.floor(v * 10000) / 100).toFixed(2) + '%'; }
  function level(v) { return v === null || v === undefined ? 'none' : v >= 0.999 ? 'ok' : v >= 0.95 ? 'warn' : 'bad'; }
  function pingLevel(ms) { return !ms || ms <= 0 ? 'none' : ms < 300 ? 'ok' : ms < 1000 ? 'warn' : 'bad'; }
  function local(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    try {
      return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
    } catch (e) { return d.toLocaleString(); }
  }
  function ago(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    if (s < 5) return 'just now';
    if (s < 60) return s + 's ago';
    var m = Math.floor(s / 60);
    if (m < 60) return m + ' min ago';
    return Math.floor(m / 60) + 'h ago';
  }
  function uptime(sec) {
    var d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    return d > 0 ? d + 'd ' + h + 'h' : h > 0 ? h + 'h ' + m + 'm' : m + 'm ' + (sec % 60) + 's';
  }
  function setIcon(svg, key) {
    if (!svg) return;
    clear(svg);
    var paths = ICON[key] || ICON.unknown;
    for (var i = 0; i < paths.length; i++) {
      var p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('d', paths[i]);
      svg.appendChild(p);
    }
  }
  function localizeTimes() {
    var times = root.querySelectorAll('time[data-local-time]');
    for (var i = 0; i < times.length; i++) {
      var iso = times[i].getAttribute('datetime');
      if (iso) { times[i].textContent = local(iso); times[i].title = String(iso).replace('T', ' ').slice(0, 19) + ' UTC'; }
    }
  }
  function summary(components) {
    var ok = 0, bad = 0, slow = 0;
    for (var i = 0; i < components.length; i++) {
      if (components[i].state === 'operational') ok++;
      else if (components[i].state === 'outage') bad++;
      else if (components[i].state === 'degraded') slow++;
    }
    if (ok === components.length) return 'All ' + ok + ' components operational';
    var parts = [ok + ' of ' + components.length + ' operational'];
    if (bad) parts.push(bad + ' down');
    if (slow) parts.push(slow + ' degraded');
    return parts.join(', ');
  }
  function bars(key, w) {
    var list = q('[data-status-bars="' + key + '"]');
    text(q('[data-status-uptime="' + key + '"]'), pct(w.uptime));
    if (!list) return;
    clear(list);
    for (var i = 0; i < w.buckets.length; i++) {
      var b = w.buckets[i];
      var li = document.createElement('li');
      li.className = 'ub ub-' + level(b.uptime);
      var label = local(b.start) + ': ' + pct(b.uptime);
      li.title = label;
      var sr = document.createElement('span');
      sr.className = 'visually-hidden';
      sr.textContent = label;
      li.appendChild(sr);
      list.appendChild(li);
    }
  }
  function latency(key, w) {
    var svg = q('[data-status-latency="' + key + '"]');
    if (!svg) return;
    var H = 48, max = 300, i;
    for (i = 0; i < w.buckets.length; i++) if (w.buckets[i].pingMs > max) max = w.buckets[i].pingMs;
    clear(svg);
    svg.setAttribute('viewBox', '0 0 ' + (w.buckets.length * 10 || 10) + ' ' + H);
    for (i = 0; i < w.buckets.length; i++) {
      var b = w.buckets[i];
      var v = b.pingMs === undefined ? null : b.pingMs;
      var h = v === null ? 2 : Math.max(3, Math.round((v / max) * H));
      var r = document.createElementNS(SVGNS, 'rect');
      r.setAttribute('class', 'lb lb-' + pingLevel(v));
      r.setAttribute('x', String(i * 10 + 1));
      r.setAttribute('y', String(H - h));
      r.setAttribute('width', '8');
      r.setAttribute('height', String(h));
      r.setAttribute('rx', '1');
      var t = document.createElementNS(SVGNS, 'title');
      t.textContent = local(b.start) + ': ' + (v === null ? 'no data' : v + ' ms average');
      r.appendChild(t);
      svg.appendChild(r);
    }
  }

  var lastOk = Date.now();
  var serverUpdated = Date.parse((q('[data-status-updated] time') || { getAttribute: function () { return ''; } }).getAttribute('datetime') || '');
  if (!isNaN(serverUpdated)) lastOk = Math.min(Date.now(), serverUpdated);

  function apply(s) {
    var cls = BANNER[s.status] || 'warn';
    var banner = q('[data-status-banner]');
    if (banner) banner.className = 'status-banner ' + cls;
    setIcon(q('[data-status-glyph] svg'), cls);
    text(q('[data-status-headline]'), s.headline);
    text(q('[data-status-summary]'), summary(s.components) + ' · v' + s.metrics.version);
    var upd = q('[data-status-updated] time');
    if (upd) upd.setAttribute('datetime', s.updatedAt);
    for (var i = 0; i < s.components.length; i++) {
      var c = s.components[i];
      var row = q('[data-component="' + c.id + '"]');
      if (!row) continue;
      row.className = 'component is-' + c.state;
      text(row.querySelector('[data-component-detail]'), c.detail);
      var pill = row.querySelector('[data-component-state]');
      if (pill) {
        pill.className = 'state-pill st-' + c.state;
        setIcon(pill.querySelector('svg'), c.state);
        text(pill.querySelector('[data-component-label]'), LABEL[c.state] || c.state);
      }
    }
    var m = s.metrics;
    var ping = q('[data-status-ping]');
    if (ping) { ping.className = 'latency-value lv-' + pingLevel(m.pingMs); ping.textContent = m.pingMs > 0 ? m.pingMs + ' ms' : 'No reading'; }
    var avgDay = q('[data-status-ping-avg="day"]');
    text(avgDay, s.history.day.pingMs === null || s.history.day.pingMs === undefined ? 'No data' : s.history.day.pingMs + ' ms');
    var avgWeek = q('[data-status-ping-avg="week"]');
    text(avgWeek, s.history.week.pingMs === null || s.history.week.pingMs === undefined ? 'no data' : s.history.week.pingMs + ' ms');
    latency('day', s.history.day);
    text(q('[data-status-metric="uptime"]'), uptime(m.uptimeSeconds));
    text(q('[data-status-metric="ping"]'), m.pingMs + ' ms');
    text(q('[data-status-metric="guilds"]'), Number(m.guilds).toLocaleString('en-US'));
    text(q('[data-status-metric="shards"]'), String(m.shards));
    text(q('[data-status-metric="memory"]'), m.memoryMb + ' MB');
    text(q('[data-status-metric="commands"]'), String(m.commands));
    bars('day', s.history.day);
    bars('week', s.history.week);
    localizeTimes();
    var stale = q('[data-status-stale]');
    if (stale) stale.hidden = true;
    lastOk = Date.now();
  }

  var busy = false;
  var paused = false;
  var remaining = PERIOD;
  var progress = q('[data-status-progress]');
  var countdown = q('[data-status-countdown]');
  var agoEl = q('[data-status-ago]');
  var pauseBtn = q('[data-status-pause]');
  var refreshBtn = q('[data-status-refresh]');

  function render() {
    if (progress) progress.value = paused ? 0 : remaining;
    text(countdown, busy ? 'Checking…' : paused ? 'Auto-refresh paused' : 'Next check in ' + remaining + 's');
    text(agoEl, '(' + ago(Date.now() - lastOk) + ')');
  }
  function refresh() {
    if (busy) return;
    busy = true;
    render();
    if (refreshBtn) refreshBtn.disabled = true;
    fetch('/api/status', { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(apply)
      .catch(function () {
        var banner = q('[data-status-banner]');
        if (banner && banner.className.indexOf('is-stale') === -1) banner.className += ' is-stale';
        var stale = q('[data-status-stale]');
        if (stale) stale.hidden = false;
      })
      .then(function () {
        busy = false;
        remaining = PERIOD;
        if (refreshBtn) refreshBtn.disabled = false;
        render();
      });
  }
  if (refreshBtn) refreshBtn.addEventListener('click', refresh);
  if (pauseBtn) {
    pauseBtn.addEventListener('click', function () {
      paused = !paused;
      pauseBtn.setAttribute('aria-pressed', String(paused));
      pauseBtn.textContent = paused ? 'Resume' : 'Pause';
      if (!paused) remaining = PERIOD;
      render();
    });
  }
  setInterval(function () {
    if (!paused && !busy && !document.hidden) {
      remaining -= 1;
      if (remaining <= 0) { refresh(); return; }
    }
    render();
  }, 1000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && !paused && Date.now() - lastOk > PERIOD * 1000) refresh();
  });
  localizeTimes();
  text(q('[data-status-note]'), 'Times are in your local time zone. Values refresh every ' + PERIOD + ' seconds while this tab is open; hover a bar for its exact window.');
  render();
})();
`;
