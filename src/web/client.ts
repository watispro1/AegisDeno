/**
 * Client script served from /assets/site.js. Plain ES5, no dependencies.
 * Everything here is progressive: the site reads fine with it disabled.
 */
export const clientScript = String.raw`
(function () {
  'use strict';

  var root = document.documentElement;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ── Theme: light by default, dark when chosen ───────────────────── */
  var STORAGE_KEY = 'aegis-theme';

  function currentTheme() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function syncToggle() {
    var btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    var label = currentTheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    btn.setAttribute('aria-pressed', currentTheme() === 'dark' ? 'true' : 'false');
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
    syncToggle();
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.theme-toggle')) {
      applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    }
  });
  syncToggle();

  /* ── Site search (Ctrl/Cmd+K) ────────────────────────────────────── */
  var searchDialog = document.getElementById('site-search-dialog');
  var searchInput = document.getElementById('site-search-input');
  var searchResults = document.getElementById('site-search-results');
  var searchTrigger = document.querySelector('.site-search-trigger');
  var lastSearchFocus = null;
  var commandIndex = null;
  var pagesIndex = [
    { name: 'Features', detail: 'What each part of the bot does', href: '/features', icon: '#' },
    { name: 'Commands', detail: 'Every slash command with its options', href: '/commands', icon: '#' },
    { name: 'Docs', detail: 'Setup, configuration and permissions', href: '/docs', icon: '#' },
    { name: 'Dashboard', detail: 'Log in with Discord to manage cases and settings', href: '/dashboard', icon: '#' },
    { name: 'Troubleshooting', detail: 'Missing permissions, missing commands and other fixes', href: '/troubleshooting', icon: '#' },
    { name: 'Changelog', detail: 'Release history', href: '/changelog', icon: '#' },
    { name: 'Status', detail: 'Gateway latency and uptime', href: '/status', icon: '#' },
    { name: 'Privacy', detail: 'What is stored and for how long', href: '/privacy', icon: '#' },
    { name: 'Terms', detail: 'Terms of service', href: '/terms', icon: '#' }
  ];

  function closeSiteSearch() {
    if (!searchDialog || searchDialog.hidden) return;
    searchDialog.hidden = true;
    document.body.style.overflow = '';
    if (lastSearchFocus && lastSearchFocus.focus) lastSearchFocus.focus();
  }

  function addSearchResult(item) {
    var link = document.createElement('a');
    link.className = 'site-search-result';
    link.href = item.href;
    link.setAttribute('role', 'option');
    var icon = document.createElement('span');
    icon.className = 'site-search-result-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = item.icon;
    var copy = document.createElement('span');
    copy.className = 'site-search-result-copy';
    var name = document.createElement('strong');
    name.textContent = item.name;
    var detail = document.createElement('small');
    detail.textContent = item.detail;
    copy.appendChild(name);
    copy.appendChild(detail);
    link.appendChild(icon);
    link.appendChild(copy);
    searchResults.appendChild(link);
  }

  function renderSiteSearch() {
    if (!searchInput || !searchResults) return;
    var query = searchInput.value.trim().toLowerCase();
    searchResults.textContent = '';
    if (query.length < 2) return;
    var matches = pagesIndex.filter(function (item) {
      return (item.name + ' ' + item.detail).toLowerCase().indexOf(query) !== -1;
    });
    if (commandIndex) {
      commandIndex.forEach(function (command) {
        var haystack = [command.name, command.description, command.category].join(' ').toLowerCase();
        if (haystack.indexOf(query) !== -1) {
          matches.push({ name: '/' + command.name, detail: command.description, href: '/commands#cmd-' + command.name, icon: '/' });
        }
      });
    }
    matches.slice(0, 8).forEach(addSearchResult);
    if (matches.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'site-search-empty';
      empty.textContent = 'Nothing matches that.';
      searchResults.appendChild(empty);
    }
  }

  function openSiteSearch() {
    if (!searchDialog || !searchInput) return;
    lastSearchFocus = document.activeElement;
    searchDialog.hidden = false;
    document.body.style.overflow = 'hidden';
    searchInput.value = '';
    renderSiteSearch();
    setTimeout(function () { searchInput.focus(); }, 0);
    if (!commandIndex) {
      fetch('/api/commands', { headers: { Accept: 'application/json' } })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (data) {
          commandIndex = data && Array.isArray(data.commands) ? data.commands : [];
          renderSiteSearch();
        })
        .catch(function () { commandIndex = []; });
    }
  }

  if (searchTrigger) searchTrigger.addEventListener('click', openSiteSearch);
  if (searchInput) {
    searchInput.addEventListener('input', renderSiteSearch);
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var first = searchResults && searchResults.querySelector('a');
        if (first) first.click();
      }
    });
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-site-search-close]')) closeSiteSearch();
  });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSiteSearch();
    } else if (e.key === 'Escape') {
      closeSiteSearch();
    }
  });

  /* ── Mobile nav ──────────────────────────────────────────────────── */
  var navToggle = document.querySelector('.nav-toggle');
  var navLinks = document.getElementById('nav-links');
  if (navToggle && navLinks) {
    var setNav = function (open) {
      navLinks.classList.toggle('open', open);
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    navToggle.addEventListener('click', function () {
      setNav(!navLinks.classList.contains('open'));
    });
    navLinks.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') setNav(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navLinks.classList.contains('open')) {
        setNav(false);
        navToggle.focus();
      }
    });
  }

  /* ── Toasts ──────────────────────────────────────────────────────── */
  function showToast(msg) {
    var container = document.getElementById('toast-container');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.textContent = String(msg);
    container.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2400);
  }

  /* ── Copy buttons ([data-copy]) ──────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-copy]');
    if (!btn) return;
    e.preventDefault();
    var text = btn.getAttribute('data-copy') || '';
    var original = btn.textContent;

    var done = function () {
      btn.textContent = 'Copied';
      btn.classList.add('copied');
      showToast('Copied ' + text);
      setTimeout(function () {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 1400);
    };

    var fallback = function () {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done();
      } catch (err) {}
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  });

  function debounce(fn, ms) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  /* ── Command reference: search, category filter, deep links ──────── */
  var search = document.getElementById('cmd-search');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.cmd-card'));
  var groups = Array.prototype.slice.call(document.querySelectorAll('.cmd-group'));
  var filterBar = document.getElementById('cmd-filter');
  var countEl = document.getElementById('cmd-count');

  if (search && cards.length) {
    var activeCat = 'all';

    var highlight = function (card, query) {
      var nameEl = card.querySelector('[data-cmd-name]');
      if (!nameEl) return;
      if (nameEl.getAttribute('data-original') === null) nameEl.setAttribute('data-original', nameEl.textContent);
      var original = nameEl.getAttribute('data-original');
      var i = query ? original.toLowerCase().indexOf(query) : -1;
      if (i === -1) {
        nameEl.textContent = original;
        return;
      }
      nameEl.innerHTML =
        escapeHtml(original.slice(0, i)) +
        '<mark>' + escapeHtml(original.slice(i, i + query.length)) + '</mark>' +
        escapeHtml(original.slice(i + query.length));
    };

    var apply = function () {
      var query = search.value.trim().toLowerCase();
      var visible = 0;
      var visibleGroups = {};

      cards.forEach(function (card) {
        var haystack = card.getAttribute('data-search') || '';
        var cat = card.getAttribute('data-category') || '';
        var show = (!query || haystack.indexOf(query) !== -1) && (activeCat === 'all' || cat === activeCat);
        card.hidden = !show;
        if (show) {
          visible++;
          visibleGroups[cat] = true;
        }
        highlight(card, query);
      });

      groups.forEach(function (group) {
        group.hidden = !visibleGroups[group.getAttribute('data-cmd-group')];
      });

      if (countEl) countEl.textContent = visible === 1 ? '1 command' : visible + ' commands';
      var empty = document.getElementById('cmd-empty');
      if (empty) empty.hidden = visible !== 0;
    };

    search.addEventListener('input', debounce(apply, 80));
    search.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        search.value = '';
        apply();
      }
    });

    if (filterBar) {
      var chips = Array.prototype.slice.call(filterBar.querySelectorAll('.tab'));
      var selectChip = function (chip) {
        activeCat = chip.getAttribute('data-cat') || 'all';
        chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
        apply();
      };
      filterBar.addEventListener('click', function (e) {
        var chip = e.target.closest('.tab');
        if (chip) selectChip(chip);
      });
      filterBar.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        var current = chips.indexOf(document.activeElement);
        if (current === -1) return;
        e.preventDefault();
        var next = e.key === 'ArrowRight'
          ? chips[(current + 1) % chips.length]
          : chips[(current - 1 + chips.length) % chips.length];
        next.focus();
        selectChip(next);
      });
    }

    var flash = function (card) {
      card.open = true;
      card.classList.add('flash');
      setTimeout(function () { card.classList.remove('flash'); }, 1600);
    };

    if (window.location.hash.indexOf('#cmd-') === 0) {
      var target = document.getElementById(window.location.hash.slice(1));
      if (target) flash(target);
    }

    /* The permalink sits inside <summary>, so it must not toggle the card. */
    document.addEventListener('click', function (e) {
      var link = e.target.closest && e.target.closest('.cmd-anchor');
      if (!link) return;
      e.preventDefault();
      var card = link.closest('details');
      if (card) flash(card);
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', link.getAttribute('href'));
      }
    });

    /* "/" jumps to the search box unless you are already typing. */
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      var t = document.activeElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      search.focus();
      search.select();
    });

    apply();
  }

  /* ── Troubleshooting filter ──────────────────────────────────────── */
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
