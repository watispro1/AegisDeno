/** Docs table-of-contents filter and troubleshooting deep links. Part of the site IIFE (see index.ts). */
export const jsSitePages = String.raw`  /* ── Docs: filter the table of contents ──────────────────────────── */
  var tocFilter = document.getElementById('toc-filter');
  var tocList = document.getElementById('docs-toc-list');
  if (tocFilter && tocList) {
    var tocEmpty = document.getElementById('toc-empty');
    var tocItems = Array.prototype.slice.call(tocList.querySelectorAll('li'));
    var tocTitles = Array.prototype.slice.call(tocList.querySelectorAll('.side-title'));
    var filterToc = function () {
      var q = tocFilter.value.trim().toLowerCase();
      var anyShown = false;
      /* Children first, so a parent stays visible when one of its sub-sections matches. */
      tocItems.slice().reverse().forEach(function (li) {
        var own = li.querySelector('a');
        var match = !q || (own && own.textContent.toLowerCase().indexOf(q) !== -1) ||
          Boolean(li.querySelector('li:not([hidden])'));
        li.hidden = !match;
        if (match) anyShown = true;
      });
      tocTitles.forEach(function (title) {
        var list = title.nextElementSibling;
        var has = Boolean(list && list.querySelector('li:not([hidden])'));
        title.hidden = !has;
        if (list) list.hidden = !has;
      });
      if (tocEmpty) tocEmpty.hidden = anyShown;
    };
    tocFilter.addEventListener('input', debounce(filterToc, 60));
    tocFilter.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && tocFilter.value) {
        e.preventDefault();
        tocFilter.value = '';
        filterToc();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        var firstLink = tocList.querySelector('li:not([hidden]) > a');
        if (firstLink) {
          window.location.hash = firstLink.getAttribute('href');
        }
      }
    });
  }

  /* ── Troubleshooting: #cat-commands-1 opens that fix ───────────────── */
  var openIssueFromHash = function () {
    var hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    var el = document.getElementById(hash.slice(1));
    if (!el || !el.classList || !el.classList.contains('issue')) return;
    el.hidden = false;
    el.open = true;
  };
  if (document.querySelector('.issue')) {
    openIssueFromHash();
    window.addEventListener('hashchange', openIssueFromHash);
  }

`;
