/**
 * Changelog page (/changelog and /dashboard/changelog): search, change-type
 * filter, expand/collapse, shareable ?q= and ?type= and opening the release a
 * link points at. A fragment of the site.js IIFE (uses `debounce` from
 * commands.ts). The page is complete without it: releases are native
 * <details>, and the toolbar is hidden until the `js` class is set.
 */
export const jsChangelog = String.raw`  /* ── Changelog ───────────────────────────────────────────────────── */
  var clRoot = document.querySelector('[data-cl-page]');
  var clSearch = document.getElementById('cl-search');
  if (clRoot && clSearch) {
    var clReleases = Array.prototype.slice.call(clRoot.querySelectorAll('.release')).map(function (el) {
      var body = el.querySelector('.release-body');
      var head = el.querySelector('.release-head');
      var notes = Array.prototype.slice.call(el.querySelectorAll('.release-summary')).map(function (p) { return p.textContent; }).join(' ');
      return {
        el: el,
        body: body,
        defaultOpen: body ? body.getAttribute('data-default-open') === '1' : false,
        headText: ((head ? head.textContent : '') + ' ' + notes).toLowerCase(),
        nomatch: el.querySelector('.release-nomatch'),
        groups: Array.prototype.slice.call(el.querySelectorAll('.change-group')).map(function (g) {
          return {
            el: g,
            kind: g.getAttribute('data-kind') || 'other',
            items: Array.prototype.slice.call(g.querySelectorAll('.changes > li')).map(function (li) {
              return { el: li, text: li.textContent.toLowerCase() };
            })
          };
        })
      };
    });
    var clCount = document.getElementById('cl-count');
    var clEmpty = document.getElementById('cl-empty');
    var clToc = Array.prototype.slice.call(document.querySelectorAll('li[data-release]'));
    var clGroups = Array.prototype.slice.call(document.querySelectorAll('[data-toc-group]'));
    var clKinds = Array.prototype.slice.call(clRoot.querySelectorAll('[data-cl-kind]'));
    var clExpand = clRoot.querySelector('[data-cl-expand]');
    var clKind = 'all';
    var clQuery = '';

    var plural = function (n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); };

    var syncUrl = function () {
      if (!window.history || !history.replaceState || !window.URL) return;
      try {
        var url = new URL(window.location.href);
        if (clQuery) url.searchParams.set('q', clQuery); else url.searchParams.delete('q');
        if (clKind !== 'all') url.searchParams.set('type', clKind); else url.searchParams.delete('type');
        history.replaceState(history.state, '', url.pathname + url.search + url.hash);
      } catch (e) {}
    };

    var applyChangelog = function (fromUser) {
      var q = clQuery;
      var filtering = !!q || clKind !== 'all';
      var shownReleases = 0;
      var shownItems = 0;
      clReleases.forEach(function (r) {
        var headHit = !q || r.headText.indexOf(q) !== -1;
        var visible = 0;
        r.groups.forEach(function (g) {
          var kindOk = clKind === 'all' || g.kind === clKind;
          var inGroup = 0;
          g.items.forEach(function (it) {
            var show = kindOk && (headHit || it.text.indexOf(q) !== -1);
            it.el.hidden = !show;
            if (show) inGroup++;
          });
          g.el.hidden = inGroup === 0 && filtering;
          if (!filtering) g.el.hidden = false;
          visible += inGroup;
        });
        var keep = !filtering || visible > 0 || (headHit && !!q && clKind === 'all');
        r.el.hidden = !keep;
        if (r.nomatch) r.nomatch.hidden = !(keep && filtering && visible === 0);
        if (keep) { shownReleases++; shownItems += visible; }
        if (r.body) r.body.open = filtering ? keep : r.defaultOpen;
        clToc.forEach(function (li) {
          if (li.getAttribute('data-release') === r.el.id) li.hidden = !keep;
        });
      });
      clGroups.forEach(function (g) { g.hidden = !g.querySelector('li[data-release]:not([hidden])'); });
      if (clCount) {
        clCount.textContent = filtering
          ? plural(shownItems, 'change') + ' in ' + plural(shownReleases, 'release')
          : plural(clReleases.length, 'release');
      }
      if (clEmpty) clEmpty.hidden = shownReleases !== 0;
      if (clExpand) clExpand.setAttribute('aria-pressed', 'false');
      if (clExpand) clExpand.textContent = 'Expand all';
      clKinds.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-cl-kind') === clKind)); });
      if (fromUser) syncUrl();
    };

    var openTarget = function () {
      var id = decodeURIComponent((window.location.hash || '').slice(1));
      if (!id) return;
      var el = document.getElementById(id);
      var rel = el && el.closest ? el.closest('.release') : null;
      if (!rel) return;
      if (rel.hidden) { clQuery = ''; clSearch.value = ''; clKind = 'all'; applyChangelog(true); }
      var body = rel.querySelector('.release-body');
      if (body && !body.open) {
        body.open = true;
        rel.scrollIntoView();
      }
    };

    clSearch.addEventListener('input', debounce(function () {
      clQuery = clSearch.value.trim().toLowerCase();
      applyChangelog(true);
    }, 100));
    clSearch.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && clSearch.value) {
        e.preventDefault();
        clSearch.value = '';
        clQuery = '';
        applyChangelog(true);
      }
    });
    clKinds.forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-cl-kind') || 'all';
        clKind = clKind === k ? 'all' : k;
        applyChangelog(true);
      });
    });
    if (clExpand) {
      clExpand.addEventListener('click', function () {
        var expand = clExpand.getAttribute('aria-pressed') !== 'true';
        clReleases.forEach(function (r) { if (r.body && !r.el.hidden) r.body.open = expand; });
        clExpand.setAttribute('aria-pressed', String(expand));
        clExpand.textContent = expand ? 'Collapse all' : 'Expand all';
      });
    }
    document.addEventListener('click', function (e) {
      var clear = e.target.closest && e.target.closest('[data-cl-clear]');
      if (!clear) return;
      e.preventDefault();
      clSearch.value = '';
      clQuery = '';
      clKind = 'all';
      applyChangelog(true);
      clSearch.focus();
    });
    window.addEventListener('hashchange', openTarget);

    try {
      var clParams = new URLSearchParams(window.location.search);
      var startQ = (clParams.get('q') || '').slice(0, 100);
      var startKind = clParams.get('type') || 'all';
      if (startQ) { clSearch.value = startQ; clQuery = startQ.trim().toLowerCase(); }
      if (clKinds.some(function (b) { return b.getAttribute('data-cl-kind') === startKind; })) clKind = startKind;
    } catch (e) {}
    if (clQuery || clKind !== 'all') applyChangelog(false);
    openTarget();
  }
`;
