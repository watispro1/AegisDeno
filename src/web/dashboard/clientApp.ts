/**
 * The dashboard app shell's script, appended to /assets/dashboard.js. Plain
 * ES5 and progressive: every page works without it. It adds the mobile
 * drawer, closes menus on Escape or an outside click, turns notices into
 * toasts, shows the "You have unsaved changes" bar, filters tables, counts
 * characters, and keeps the embed preview current. No inline script or style
 * is involved: everything hangs off data attributes, and colours are set
 * through the CSSOM, which the CSP allows.
 */
export const dashboardAppScript = String.raw`
(function () {
  'use strict';
  var doc = document;
  function all(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }

  /* ── Drawer (small screens) ─────────────────────────────────────── */
  var app = doc.querySelector('[data-app]');
  var toggle = doc.querySelector('[data-drawer-toggle]');
  var side = doc.querySelector('[data-drawer]');
  function setDrawer(open) {
    if (!app || !toggle) return;
    if (open) app.setAttribute('data-drawer-open', ''); else app.removeAttribute('data-drawer-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && side) { var first = side.querySelector('summary, a'); if (first && first.focus) first.focus(); }
  }
  if (toggle) toggle.addEventListener('click', function (e) { e.stopPropagation(); setDrawer(!app.hasAttribute('data-drawer-open')); });
  doc.addEventListener('click', function (e) {
    if (app && app.hasAttribute('data-drawer-open') && side && !side.contains(e.target)) setDrawer(false);
    all('details[data-menu][open]').forEach(function (d) { if (!d.contains(e.target)) d.removeAttribute('open'); });
  });
  doc.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (app && app.hasAttribute('data-drawer-open')) { setDrawer(false); if (toggle) toggle.focus(); }
    all('details[data-menu][open]').forEach(function (d) {
      d.removeAttribute('open');
      var s = d.querySelector('summary'); if (s && s.focus) s.focus();
    });
  });

  /* ── Toasts from notices ────────────────────────────────────────── */
  var region = doc.querySelector('[data-toasts]');
  function toast(text, bad) {
    if (!region) return;
    var t = doc.createElement('div');
    t.className = 'toast' + (bad ? ' bad' : '');
    t.setAttribute('role', bad ? 'alert' : 'status');
    var p = doc.createElement('p'); p.textContent = text; t.appendChild(p);
    var x = doc.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', 'Dismiss'); x.textContent = '×';
    x.addEventListener('click', function () { if (t.parentNode) t.parentNode.removeChild(t); });
    t.appendChild(x);
    region.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, bad ? 12000 : 6000);
  }
  if (region) all('[data-toast-source]').forEach(function (n) { toast(n.textContent.trim(), n.hasAttribute('data-toast-bad')); });

  /* ── Unsaved changes bar ────────────────────────────────────────── */
  var bar = doc.querySelector('[data-unsaved-bar]');
  var dirtyForm = null;
  function serialize(form) {
    return all('input, select, textarea', form).filter(function (el) { return el.name && el.name !== '_csrf' && el.type !== 'submit'; })
      .map(function (el) { return el.name + '=' + ((el.type === 'checkbox' || el.type === 'radio') ? (el.checked ? el.value || 'on' : '') : el.value); }).join('&');
  }
  var tracked = all('form[data-track-changes]');
  tracked.forEach(function (form) {
    form.__aegisInitial = serialize(form);
    var check = function () {
      var dirty = serialize(form) !== form.__aegisInitial;
      if (dirty) dirtyForm = form; else if (dirtyForm === form) dirtyForm = null;
      if (bar) { if (dirtyForm) bar.removeAttribute('hidden'); else bar.setAttribute('hidden', ''); }
    };
    form.addEventListener('input', check);
    form.addEventListener('change', check);
    form.addEventListener('submit', function () { dirtyForm = null; if (bar) bar.setAttribute('hidden', ''); });
    form.addEventListener('reset', function () { setTimeout(function () { refreshAll(form); check(); }, 0); });
  });
  if (bar) {
    var reset = bar.querySelector('[data-unsaved-reset]');
    var save = bar.querySelector('[data-unsaved-save]');
    if (reset) reset.addEventListener('click', function () { if (dirtyForm) dirtyForm.reset(); });
    if (save) save.addEventListener('click', function () {
      if (!dirtyForm) return;
      var btn = dirtyForm.querySelector('[data-save-button]');
      if (dirtyForm.requestSubmit) dirtyForm.requestSubmit(btn || undefined); else if (btn) btn.click(); else dirtyForm.submit();
    });
  }
  window.addEventListener('beforeunload', function (e) {
    if (dirtyForm) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ── Table filter ───────────────────────────────────────────────── */
  all('[data-filter-target]').forEach(function (input) {
    var id = input.getAttribute('data-filter-target');
    var table = doc.getElementById(id);
    var count = doc.querySelector('[data-filter-count="' + id + '"]');
    if (!table) return;
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      var rows = all('tbody tr', table), shown = 0;
      rows.forEach(function (r) {
        var hit = !q || r.textContent.toLowerCase().indexOf(q) !== -1;
        if (hit) { r.removeAttribute('data-filtered-out'); shown++; } else r.setAttribute('data-filtered-out', '');
      });
      if (count) count.textContent = q ? shown + ' of ' + rows.length + ' shown' : '';
    });
  });

  /* ── Character counters ─────────────────────────────────────────── */
  function counter(el) {
    var max = parseInt(el.getAttribute('data-count-max'), 10);
    if (!max) return;
    var c = doc.createElement('span'); c.className = 'char-count'; c.setAttribute('aria-hidden', 'true');
    el.parentNode.insertBefore(c, el.nextSibling);
    var upd = function () { c.textContent = el.value.length + ' / ' + max; c.className = 'char-count' + (el.value.length > max ? ' over' : ''); };
    el.addEventListener('input', upd); el.__aegisCount = upd; upd();
  }
  all('[data-count-max]').forEach(counter);

  /* ── Embed preview ──────────────────────────────────────────────── */
  function fill(text, b) {
    return String(text || '').replace(/\{(user|username|server|memberCount|member_count|count)\}/g, function (_, k) {
      if (k === 'user') return b.getAttribute('data-sample-user') || '@member';
      if (k === 'username') return b.getAttribute('data-sample-username') || 'member';
      if (k === 'server') return b.getAttribute('data-sample-server') || 'this server';
      return b.getAttribute('data-sample-count') || '?';
    });
  }
  function host(url) { var m = /^https:\/\/([^\/\s]+)/i.exec(url || ''); return m ? m[1] : 'not an https link'; }
  function renderEmbed(b) {
    var p = b.getAttribute('data-embed-builder');
    var form = b.closest ? b.closest('form') : null;
    var val = function (name) { var el = form ? form.elements[name] : null; return el ? (el.type === 'checkbox' ? el.checked : el.value) : ''; };
    var preview = b.querySelector('[data-embed-preview]');
    if (!preview) return;
    var set = function (key, text) { var el = preview.querySelector('[data-ep="' + key + '"]'); if (el) el.textContent = fill(text, b); };
    ['title', 'description', 'author', 'footer'].forEach(function (k) { set(k, val(p + k)); });
    var content = preview.querySelector('[data-ep="content"]');
    if (content && content.getAttribute('data-ep-source')) content.textContent = fill(val(content.getAttribute('data-ep-source')), b);
    var fields = preview.querySelector('[data-ep="fields"]');
    var total = 0;
    if (fields) {
      while (fields.firstChild) fields.removeChild(fields.firstChild);
      for (var i = 0; i < 25; i++) {
        if (!form || !form.elements[p + 'fname_' + i]) break;
        var n = val(p + 'fname_' + i), v = val(p + 'fvalue_' + i);
        total += String(n).length + String(v).length;
        if (!n || !v) continue;
        var f = doc.createElement('div'); f.className = 'ep-field' + (val(p + 'finline_' + i) ? ' inline' : '');
        var fn = doc.createElement('div'); fn.className = 'ep-fname'; fn.textContent = fill(n, b);
        var fv = doc.createElement('div'); fv.className = 'ep-fvalue'; fv.textContent = fill(v, b);
        f.appendChild(fn); f.appendChild(fv); fields.appendChild(f);
      }
    }
    ['image', 'thumbnail'].forEach(function (k) {
      var el = preview.querySelector('[data-ep="' + k + '"]'); var u = val(p + k);
      if (!el) return;
      if (u) { el.removeAttribute('hidden'); el.textContent = (k === 'image' ? 'Image: ' : 'Thumbnail: ') + host(u); } else el.setAttribute('hidden', '');
    });
    var embed = preview.querySelector('[data-ep="embed"]');
    if (embed) {
      var color = String(val(p + 'color')).replace(/^#/, '');
      embed.style.borderLeftColor = /^[0-9a-f]{6}$/i.test(color) ? '#' + color : '';
      var empty = !val(p + 'title') && !val(p + 'description') && !val(p + 'author') && !val(p + 'footer') && !val(p + 'image') && !val(p + 'thumbnail') && !(fields && fields.firstChild);
      if (empty) embed.setAttribute('data-empty', ''); else embed.removeAttribute('data-empty');
    }
    ['title', 'description', 'author', 'footer'].forEach(function (k) { total += String(val(p + k)).length; });
    var t = b.querySelector('[data-embed-total]'); if (t) t.textContent = String(total);
  }
  var builders = all('[data-embed-builder]');
  builders.forEach(function (b) {
    var form = b.closest ? b.closest('form') : null;
    if (!form) return;
    form.addEventListener('input', function () { renderEmbed(b); });
    form.addEventListener('change', function () { renderEmbed(b); });
    renderEmbed(b);
  });
  function refreshAll(form) {
    builders.forEach(function (b) { if (!form || form.contains(b)) renderEmbed(b); });
    all('[data-count-max]', form).forEach(function (el) { if (el.__aegisCount) el.__aegisCount(); });
  }
})();
`;
