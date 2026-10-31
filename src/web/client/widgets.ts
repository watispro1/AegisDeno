/** Troubleshooting filter, FAQ accordion, TOC highlighting, uptime ticker and live stats; closes the IIFE. */
export const jsWidgets = String.raw`  /* ── Troubleshooting filter ──────────────────────────────────────── */
  var helpSearch = document.getElementById('help-search');
  if (helpSearch) {
    var issues = Array.prototype.slice.call(document.querySelectorAll('.issue'));
    var issueGroups = Array.prototype.slice.call(document.querySelectorAll('.issue-group'));
    var helpEmpty = document.getElementById('help-empty');
    helpSearch.addEventListener('input', debounce(function () {
      var q = helpSearch.value.trim().toLowerCase();
      var shown = 0;
      issues.forEach(function (issue) {
        var match = !q || issue.textContent.toLowerCase().indexOf(q) !== -1;
        issue.hidden = !match;
        if (match) shown++;
      });
      issueGroups.forEach(function (group) {
        group.hidden = !group.querySelector('.issue:not([hidden])');
      });
      if (helpEmpty) helpEmpty.hidden = shown !== 0;
    }, 80));
  }

  /* ── FAQ: one answer open at a time ──────────────────────────────── */
  var faqs = document.querySelectorAll('[data-faq] details');
  for (var f = 0; f < faqs.length; f++) {
    faqs[f].addEventListener('toggle', function (e) {
      if (!e.target.open) return;
      for (var j = 0; j < faqs.length; j++) if (faqs[j] !== e.target) faqs[j].open = false;
    });
  }

  /* ── Table of contents: mark the section in view ─────────────────── */
  var tocLinks = document.querySelectorAll('.toc a[href^="#"]');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var targets = [];
    tocLinks.forEach(function (link) {
      var el = document.getElementById(link.getAttribute('href').slice(1));
      if (el) targets.push({ el: el, link: link });
    });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        targets.forEach(function (t) {
          t.link.classList.toggle('active', t.el === entry.target);
        });
      });
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });
    targets.forEach(function (t) { spy.observe(t.el); });
  }

  /* ── Uptime ticker ───────────────────────────────────────────────── */
  var uptimeEls = document.querySelectorAll('[data-uptime-from]');
  if (uptimeEls.length) {
    var startedAt = Date.now() - (parseFloat(uptimeEls[0].getAttribute('data-uptime-from')) || 0);
    var tick = function () {
      var s = Math.floor((Date.now() - startedAt) / 1000);
      var d = Math.floor(s / 86400);
      var h = Math.floor((s % 86400) / 3600);
      var m = Math.floor((s % 3600) / 60);
      var text = d > 0 ? d + 'd ' + h + 'h' : h > 0 ? h + 'h ' + m + 'm' : m + 'm ' + (s % 60) + 's';
      uptimeEls.forEach(function (el) { el.textContent = text; });
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ── Live numbers from /api/stats ────────────────────────────────── */
  var live = document.querySelectorAll('[data-live]');
  if (live.length) {
    var refresh = function () {
      fetch('/api/stats', { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d) return;
          live.forEach(function (el) {
            var key = el.getAttribute('data-live');
            if (d[key] === undefined || d[key] === null) return;
            el.textContent = Number(d[key]).toLocaleString() + (el.getAttribute('data-suffix') || '');
          });
          var online = Boolean(d.online);
          var ping = Number(d.ping) || 0;
          var state = !online ? 'Offline' : ping === 0 ? 'Connecting' : ping < 150 ? 'Operational' : ping < 350 ? 'Degraded' : 'Unstable';
          var healthy = state === 'Operational';
          var dots = document.querySelectorAll('[data-status-dot]');
          dots.forEach(function (dot) { dot.className = 'dot' + (healthy ? '' : ' danger'); });
          var stateEls = document.querySelectorAll('[data-status-state]');
          stateEls.forEach(function (el) { el.textContent = state; });
          var banner = document.querySelector('[data-status-banner]');
          if (banner) {
            banner.classList.toggle('bad', !healthy);
            var title = document.querySelector('[data-status-title]');
            var description = document.querySelector('[data-status-description]');
            var refreshed = document.querySelector('[data-status-refreshed]');
            if (title) title.textContent = healthy ? 'Everything is running' : state;
            if (description) description.textContent = healthy
              ? 'Connected to Discord and answering commands.'
              : 'Commands may be slow or failing. Numbers below are live.';
            if (refreshed) refreshed.textContent = 'Last checked ' + new Date().toLocaleTimeString() + '.';
          }
        })
        .catch(function () {});
    };
    refresh();
    var refreshBtn = document.querySelector('[data-status-refresh-btn]');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        refresh();
        showToast('Checked just now');
      });
    }
    setInterval(refresh, 30000);
  }
})();
`;
