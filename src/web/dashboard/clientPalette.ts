/**
 * Command palette (Ctrl/Cmd+K) and the settings-import file reader, appended
 * to /assets/dashboard.js. Plain ES5 and progressive: the palette lists the
 * sidebar's own links (so it never offers a page the viewer can't open), and
 * Enter on free text runs the server's search. DOM is built with
 * createElement/textContent only; no innerHTML, no inline styles.
 */
export const dashboardPaletteScript = String.raw`
(function () {
  'use strict';
  var doc = document;
  var dialog = doc.querySelector('[data-palette]');
  var input = doc.querySelector('[data-palette-input]');
  var list = doc.querySelector('[data-palette-list]');
  var search = doc.querySelector('.top-search');
  if (dialog && input && list && typeof dialog.showModal === 'function') {
    var items = [];
    var links = doc.querySelectorAll('.side-link, .switcher-list a');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var group = a.closest('.nav-group');
      var title = group ? group.querySelector('.nav-group-title') : null;
      items.push({ label: (a.textContent || '').replace(/\s+/g, ' ').trim(), group: title ? title.textContent : 'Servers', href: a.getAttribute('href') });
    }
    var shown = [];
    var active = 0;
    function render() {
      var q = input.value.toLowerCase().trim();
      shown = items.filter(function (it) { return !q || it.label.toLowerCase().indexOf(q) !== -1 || it.group.toLowerCase().indexOf(q) !== -1; }).slice(0, 12);
      if (q && search) shown.push({ label: 'Search cases and members for "' + input.value.trim() + '"', group: 'Search', href: search.getAttribute('action') + '?q=' + encodeURIComponent(input.value.trim()) });
      if (active >= shown.length) active = Math.max(0, shown.length - 1);
      while (list.firstChild) list.removeChild(list.firstChild);
      shown.forEach(function (it, n) {
        var li = doc.createElement('li');
        li.id = 'palette-opt-' + n;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', n === active ? 'true' : 'false');
        li.className = 'palette-item' + (n === active ? ' active' : '');
        var label = doc.createElement('span');
        label.textContent = it.label;
        var grp = doc.createElement('span');
        grp.className = 'faint';
        grp.textContent = it.group;
        li.appendChild(label);
        li.appendChild(grp);
        li.addEventListener('mousedown', function (e) { e.preventDefault(); go(n); });
        list.appendChild(li);
      });
      input.setAttribute('aria-activedescendant', shown.length ? 'palette-opt-' + active : '');
    }
    function go(n) { var it = shown[n]; if (it && it.href) window.location.href = it.href; }
    function open() { if (dialog.open) return; input.value = ''; active = 0; render(); dialog.showModal(); input.focus(); }
    doc.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if (dialog.open) dialog.close(); else open(); }
    });
    var btn = doc.querySelector('[data-palette-open]');
    if (btn) btn.addEventListener('click', open);
    input.addEventListener('input', function () { active = 0; render(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(shown.length - 1, active + 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); render(); }
      else if (e.key === 'Enter') { e.preventDefault(); go(active); }
    });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  }

  /* Settings import: read the chosen file into the textarea (nothing is uploaded until you submit). */
  var file = doc.querySelector('[data-import-file]');
  if (file && window.FileReader) {
    file.addEventListener('change', function () {
      var target = doc.getElementById(file.getAttribute('data-import-file'));
      var f = file.files && file.files[0];
      if (!target || !f) return;
      if (f.size > 200000) { target.value = ''; window.alert('That file is too large to be an Aegis settings export.'); return; }
      var reader = new FileReader();
      reader.onload = function () { target.value = String(reader.result || ''); };
      reader.readAsText(f);
    });
  }
})();
`;
