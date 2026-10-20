export const clientScript = String.raw`
(function () {
  'use strict';

  var root = document.documentElement;

  /* ── Theme ─────────────────────────────────────────────────────── */
  var STORAGE_KEY = 'aegis-theme';
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      root.setAttribute('data-theme', saved);
    } else if (saved) {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {}

  function currentTheme() {
    var attr = root.getAttribute('data-theme');
    if (attr) return attr;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }

  function syncToggle() {
    var btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    var dark = currentTheme() !== 'light';
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    btn.setAttribute('title', dark ? 'Switch to light theme' : 'Switch to dark theme');
  }

  function syncThemeDots(theme) {
    var dots = document.querySelectorAll('.window-dots');
    dots.forEach(function (d) {
      d.style.opacity = theme === 'light' ? '0.85' : '1';
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.theme-toggle');
    if (!btn) return;
    var next = currentTheme() === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (err) {}
    syncToggle();
    syncThemeDots(next);
  });

  syncToggle();

  /* ── Liquid Glass Toggle ───────────────────────────────────────── */
  var GLASS_STORAGE_KEY = 'aegis-glass';
  function currentGlass() {
    var attr = root.getAttribute('data-glass');
    if (attr) return attr;
    try {
      var saved = localStorage.getItem(GLASS_STORAGE_KEY);
      if (saved === 'off') return 'off';
    } catch (e) {}
    return 'on';
  }

  function syncGlassToggle() {
    var btns = document.querySelectorAll('.glass-toggle');
    var isGlassOn = currentGlass() !== 'off';
    btns.forEach(function (btn) {
      btn.setAttribute('aria-pressed', isGlassOn ? 'true' : 'false');
      btn.setAttribute('aria-label', isGlassOn ? 'Switch to solid performance mode' : 'Switch to liquid glass frosted mode');
      btn.setAttribute('title', isGlassOn ? 'Liquid Glass: ON (Click to disable) [G]' : 'Liquid Glass: OFF (Click to enable) [G]');
    });
  }

  function toggleGlass() {
    var next = currentGlass() === 'on' ? 'off' : 'on';
    root.setAttribute('data-glass', next);
    try { localStorage.setItem(GLASS_STORAGE_KEY, next); } catch (err) {}
    syncGlassToggle();
    if (window.showToast) {
      window.showToast(next === 'on' ? '✨ Liquid Glass: Enabled (VisionOS Frosted Materials)' : '⚡ Liquid Glass: Disabled (Performance Opaque Mode)');
    }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.glass-toggle');
    if (!btn) return;
    toggleGlass();
  });

  syncGlassToggle();

  /* ── Global page and command search ───────────────────────────── */
  var searchDialog = document.getElementById('site-search-dialog');
  var searchInput = document.getElementById('site-search-input');
  var searchResults = document.getElementById('site-search-results');
  var searchTrigger = document.querySelector('.site-search-trigger');
  var lastSearchFocus = null;
  var commandIndex = null;
  var pagesIndex = [
    { name: 'Features', detail: 'AutoMod, tickets, anti-raid, and moderation', href: '/features', icon: '✦' },
    { name: 'Command reference', detail: 'Browse every Aegis slash command', href: '/commands', icon: '/' },
    { name: 'Documentation', detail: 'Setup guides and permission reference', href: '/docs', icon: '▤' },
    { name: 'Status', detail: 'Current bot health and gateway metrics', href: '/status', icon: '●' },
    { name: 'Changelog', detail: 'Product updates and release history', href: '/changelog', icon: '↗' },
    { name: 'Troubleshooting & Help', detail: 'Diagnostics, common questions and fixes', href: '/troubleshooting', icon: '?' }
  ];

  function closeSiteSearch() {
    if (!searchDialog || searchDialog.hidden) return;
    searchDialog.hidden = true;
    document.body.style.overflow = '';
    if (lastSearchFocus && lastSearchFocus.focus) lastSearchFocus.focus();
  }

  function addSearchResult(item) {
    if (!searchResults) return;
    var link = document.createElement('a');
    link.className = 'site-search-result';
    link.href = item.href;
    link.setAttribute('role', 'option');
    var icon = document.createElement('span');
    icon.className = 'site-search-result-icon';
    icon.textContent = item.icon;
    var copy = document.createElement('span');
    copy.className = 'site-search-result-copy';
    var name = document.createElement('strong');
    name.textContent = item.name;
    var detail = document.createElement('small');
    detail.textContent = item.detail;
    copy.appendChild(name); copy.appendChild(detail); link.appendChild(icon); link.appendChild(copy);
    searchResults.appendChild(link);
  }

  function renderSiteSearch() {
    if (!searchInput || !searchResults) return;
    var query = searchInput.value.trim().toLowerCase();
    searchResults.textContent = '';
    if (query.length < 2) return;
    var matches = pagesIndex.filter(function (item) { return (item.name + ' ' + item.detail).toLowerCase().indexOf(query) !== -1; });
    if (commandIndex) {
      commandIndex.forEach(function (command) {
        var haystack = [command.name, command.description, command.category].join(' ').toLowerCase();
        if (haystack.indexOf(query) !== -1) matches.push({ name: '/' + command.name, detail: command.description, href: '/commands#cmd-' + command.name, icon: '/' });
      });
    }
    matches.slice(0, 8).forEach(addSearchResult);
    if (matches.length === 0) {
      var empty = document.createElement('p'); empty.className = 'site-search-empty'; empty.textContent = 'No pages or commands match that search.'; searchResults.appendChild(empty);
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
        .then(function (data) { commandIndex = data && Array.isArray(data.commands) ? data.commands : []; renderSiteSearch(); })
        .catch(function () { commandIndex = []; });
    }
  }

  if (searchTrigger) searchTrigger.addEventListener('click', openSiteSearch);
  if (searchInput) {
    searchInput.addEventListener('input', renderSiteSearch);
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var first = searchResults && searchResults.querySelector('a'); if (first) first.click(); }
    });
  }
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-site-search-close]')) closeSiteSearch(); });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSiteSearch(); }
    else if (e.key === 'Escape') closeSiteSearch();
    else if ((e.key === 'g' || e.key === 'G') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      var tag = (e.target && e.target.tagName) || '';
      var isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable);
      if (!isInput && (!searchDialog || searchDialog.hidden)) {
        e.preventDefault();
        toggleGlass();
      }
    }
  });

  /* ── Sticky nav shadow ────────────────────────────────────────── */
  var nav = document.querySelector('.nav');
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle('scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ── Mobile nav ───────────────────────────────────────────────── */
  var navToggle = document.querySelector('.nav-toggle');
  var navLinks = document.getElementById('nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    navLinks.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navLinks.classList.contains('open')) {
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.focus();
      }
    });
  }

  /* ── Reveal on scroll ─────────────────────────────────────────── */
  var reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    if (!('IntersectionObserver' in window)) {
      for (var r = 0; r < reveals.length; r++) reveals[r].classList.add('visible');
    } else {
      root.classList.add('reveal-ready');
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            io.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      for (var i = 0; i < reveals.length; i++) io.observe(reveals[i]);
    }
  }

  /* ── Animated counters ────────────────────────────────────────── */
  var counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        co.unobserve(el);
        var target = parseFloat(el.getAttribute('data-count')) || 0;
        var suffix = el.getAttribute('data-suffix') || '';
        if (reduce) {
          el.textContent = target.toLocaleString() + suffix;
          return;
        }
        var start = performance.now();
        var dur = 1100;
        function step(now) {
          var t = Math.min(1, (now - start) / dur);
          var eased = 1 - Math.pow(1 - t, 3);
          el.textContent = Math.round(target * eased).toLocaleString() + suffix;
          if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.4 });
    for (var c = 0; c < counters.length; c++) co.observe(counters[c]);
  }

  /* ── Copy to clipboard ────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-copy]');
    if (!btn) return;
    e.preventDefault();
    var text = btn.getAttribute('data-copy') || '';
    var label = btn.getAttribute('data-copy-label') || 'Copied';

    var restore = function () {
      var original = btn.innerHTML;
      btn.textContent = label;
      btn.classList.add('copied');
      btn.setAttribute('aria-live', 'polite');
      if (window.showToast && text) {
        window.showToast('Copied "' + text + '" to clipboard');
      }
      setTimeout(function () {
        btn.innerHTML = original;
        btn.classList.remove('copied');
        btn.removeAttribute('aria-live');
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
        restore();
      } catch (err) {}
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(restore, fallback);
    } else {
      fallback();
    }
  });

  /* ── Toast notifications ─────────────────────────────────────── */
  window.showToast = function (msg) {
    var container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;display:flex;flex-direction:column;gap:0.5rem;pointer-events:none;';
      document.body.appendChild(container);
    }
    var toast = document.createElement('div');
    toast.classList.add('toast');
    toast.appendChild(document.createTextNode('⚡ '));
    var toastText = document.createElement('span');
    toastText.textContent = String(msg);
    toast.appendChild(toastText);
    container.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }, 2800);
  };

  /* ── Commands Search & Category Filter ────────────────────────── */
  var search = document.getElementById('cmd-search');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.cmd-card'));
  var groups = Array.prototype.slice.call(document.querySelectorAll('.cmd-group'));
  var filterBar = document.getElementById('cmd-filter');
  var countEl = document.getElementById('cmd-count');

  if (search && cards.length) {
    var activeCat = 'all';

    function clearHighlight(card, query) {
      if (!query) return;
      var nameEl = card.querySelector('[data-cmd-name]');
      if (!nameEl) return;
      if (nameEl.dataset.original === undefined) {
        nameEl.dataset.original = nameEl.textContent;
      }
      nameEl.textContent = nameEl.dataset.original;
      var i = nameEl.dataset.original.toLowerCase().indexOf(query);
      if (i === -1) {
        nameEl.textContent = nameEl.dataset.original;
        return;
      }
      nameEl.innerHTML =
        escapeHtml(nameEl.dataset.original.slice(0, i)) +
        '<mark>' + escapeHtml(nameEl.dataset.original.slice(i, i + query.length)) + '</mark>' +
        escapeHtml(nameEl.dataset.original.slice(i + query.length));
    }

    function escapeHtml(s) {
      return s.replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
    }

    function apply() {
      var query = search.value.trim().toLowerCase();
      var visible = 0;
      var visibleGroups = {};

      cards.forEach(function (card) {
        var haystack = card.getAttribute('data-search') || '';
        var cat = card.getAttribute('data-category') || '';
        var matchesQuery = !query || haystack.indexOf(query) !== -1;
        var matchesCat = activeCat === 'all' || cat === activeCat;
        var show = matchesQuery && matchesCat;
        card.hidden = !show;
        if (show) {
          visible++;
          visibleGroups[cat] = true;
          if (query && card.open === false) card.open = true;
          clearHighlight(card, query);
        }
      });

      groups.forEach(function (group) {
        var cat = group.getAttribute('data-cmd-group');
        group.hidden = !visibleGroups[cat];
      });

      if (countEl) {
        countEl.textContent = visible === 1 ? '1 command' : visible + ' commands';
      }

      var empty = document.getElementById('cmd-empty');
      if (empty) empty.hidden = visible !== 0;
    }

    function debounce(fn, ms) {
      var t;
      return function () {
        clearTimeout(t);
        t = setTimeout(fn, ms);
      };
    }

    search.addEventListener('input', debounce(apply, 110));
    search.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        search.value = '';
        apply();
      }
    });

    if (filterBar) {
      var chips = Array.prototype.slice.call(filterBar.querySelectorAll('.tab'));

      function selectChip(chip) {
        activeCat = chip.getAttribute('data-cat') || 'all';
        chips.forEach(function (c) {
          c.setAttribute('aria-pressed', String(c === chip));
        });
        apply();
      }

      filterBar.addEventListener('click', function (e) {
        var chip = e.target.closest('.tab');
        if (chip) selectChip(chip);
      });

      /* Left/right arrows move between filters, as expected for a group of toggle buttons. */
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

    /* Open a command from a deep link such as /commands#cmd-ban */
    function revealCard(id) {
      var card = document.getElementById(id);
      if (!card) return;
      card.open = true;
      card.classList.add('flash');
      setTimeout(function () { card.classList.remove('flash'); }, 2000);
    }

    if (window.location.hash.indexOf('#cmd-') === 0) {
      revealCard(window.location.hash.slice(1));
    }

    /* The permalink sits inside <summary> so it must not collapse the card. */
    document.addEventListener('click', function (e) {
      var link = e.target.closest && e.target.closest('.cmd-anchor');
      if (!link) return;
      e.preventDefault();
      var card = link.closest('details');
      if (card) {
        card.open = true;
        card.classList.add('flash');
        setTimeout(function () { card.classList.remove('flash'); }, 2000);
      }
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', link.getAttribute('href'));
      }
    });

    // "/" focuses search, unless already typing somewhere
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

  /* ── FAQ: only one open at a time ─────────────────────────────── */
  var faqs = document.querySelectorAll('[data-faq] details');
  for (var f = 0; f < faqs.length; f++) {
    faqs[f].addEventListener('toggle', function (e) {
      if (!e.target.open) return;
      for (var j = 0; j < faqs.length; j++) {
        if (faqs[j] !== e.target) faqs[j].open = false;
      }
    });
  }

  /* ── Docs scroll spy ──────────────────────────────────────────── */
  var sideLinks = document.querySelectorAll('.docs-side a[href^="#"]');
  if (sideLinks.length && 'IntersectionObserver' in window) {
    var targets = [];
    sideLinks.forEach(function (link) {
      var id = link.getAttribute('href').slice(1);
      var el = document.getElementById(id);
      if (el) targets.push({ el: el, link: link });
    });

    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        for (var i = 0; i < targets.length; i++) targets[i].link.classList.remove('active');
        var match = null;
        for (var k = 0; k < targets.length; k++) {
          if (targets[k].el === entry.target) match = targets[k].link;
        }
        if (match) match.classList.add('active');
      });
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });

    for (var t2 = 0; t2 < targets.length; t2++) spy.observe(targets[t2].el);
  }

  /* ── Live uptime ticker ───────────────────────────────────────── */
  var uptimeEl = document.querySelector('[data-uptime-from]');
  if (uptimeEl) {
    var startedAt = Date.now() - (parseFloat(uptimeEl.getAttribute('data-uptime-from')) || 0);
    var tick = function () {
      var s = Math.floor((Date.now() - startedAt) / 1000);
      var d = Math.floor(s / 86400);
      var h = Math.floor((s % 86400) / 3600);
      var m = Math.floor((s % 3600) / 60);
      uptimeEl.textContent = d > 0 ? d + 'd ' + h + 'h' : h > 0 ? h + 'h ' + m + 'm' : m + 'm ' + (s % 60) + 's';
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ── Live metrics via /api/stats ──────────────────────────────── */
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
            var suffix = el.getAttribute('data-suffix') || '';
            el.textContent = Number(d[key]).toLocaleString() + suffix;
          });
          var banner = document.querySelector('[data-status-banner]');
          if (banner) {
            var online = Boolean(d.online);
            var ping = Number(d.ping) || 0;
            var state = !online ? 'Offline' : ping === 0 ? 'Connecting' : ping < 150 ? 'Operational' : ping < 350 ? 'Degraded' : 'Unstable';
            var healthy = state === 'Operational';
            banner.classList.toggle('bad', !healthy);
            var title = document.querySelector('[data-status-title]');
            var description = document.querySelector('[data-status-description]');
            var label = document.querySelector('[data-status-label]');
            var dot = document.querySelector('[data-status-dot]');
            var refreshed = document.querySelector('[data-status-refreshed]');
            if (title) title.textContent = healthy ? 'All systems operational' : state;
            if (description) description.textContent = healthy ? 'Aegis is connected to Discord and responding normally.' : 'Aegis may be experiencing degraded performance. Check the metrics below.';
            if (label) { label.textContent = state; label.className = 'pill ' + (healthy ? 'ok' : 'danger'); }
            if (dot) dot.style.background = healthy ? 'var(--accent)' : 'var(--danger)';
            if (refreshed) refreshed.textContent = 'Last refreshed just now.';
          }
        })
        .catch(function () {});
    };
    refresh();
    var refreshBtn = document.querySelector('[data-status-refresh-btn]');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        refreshBtn.classList.add('spinning');
        refresh();
        if (window.showToast) window.showToast('Live status refreshed');
        setTimeout(function () {
          refreshBtn.classList.remove('spinning');
        }, 600);
      });
    }
    setInterval(refresh, 30000);
  }

  /* ── Interactive Hero Preview Tabs ───────────────────────────── */
  var previewTabBtns = document.querySelectorAll('.preview-tab-btn');
  var previewPanels = document.querySelectorAll('.preview-panel');
  if (previewTabBtns.length && previewPanels.length) {
    previewTabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var targetId = btn.getAttribute('data-tab');
        previewTabBtns.forEach(function (b) {
          b.setAttribute('aria-pressed', String(b === btn));
        });
        previewPanels.forEach(function (p) {
          p.classList.toggle('active', p.id === targetId);
        });
      });
    });
  }

  /* ── Command Copy Pills ───────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var pill = e.target.closest && e.target.closest('.cmd-pill');
    if (!pill) return;
    var cmd = pill.getAttribute('data-cmd');
    if (!cmd) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cmd).then(function () {
        if (window.showToast) window.showToast('Copied ' + cmd + ' to clipboard!');
      }).catch(function () {
        if (window.showToast) window.showToast('Selected ' + cmd);
      });
    } else if (window.showToast) {
      window.showToast('Selected ' + cmd);
    }
  });

  /* ── Interactive Feature Demo Buttons ─────────────────────────── */
  document.addEventListener('click', function (e) {
    var demoBtn = e.target.closest && e.target.closest('.ft-demo-btn');
    if (!demoBtn) return;
    var msg = demoBtn.getAttribute('data-demo-msg');
    if (msg && window.showToast) {
      window.showToast(msg);
    }
  });

  /* ── Features Page Category Filter ────────────────────────────── */
  var ftCatBtns = document.querySelectorAll('.ft-cat-btn');
  var ftCards = document.querySelectorAll('.ft-showcase-card');
  if (ftCatBtns.length && ftCards.length) {
    ftCatBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var filter = btn.getAttribute('data-filter') || 'all';
        ftCatBtns.forEach(function (b) {
          b.setAttribute('aria-pressed', String(b === btn));
        });
        ftCards.forEach(function (card) {
          var cat = card.getAttribute('data-category');
          var visible = filter === 'all' || cat === filter;
          card.style.display = visible ? '' : 'none';
        });
      });
    });
  }

  /* ── AutoMod Toggle Simulation ───────────────────────────────── */
  document.addEventListener('change', function (e) {
    var toggle = e.target.closest && e.target.closest('.toggle-switch input');
    if (!toggle) return;
    var name = toggle.getAttribute('data-rule-name') || 'AutoMod Rule';
    var active = toggle.checked;
    if (window.showToast) {
      window.showToast((active ? 'Enabled ' : 'Disabled ') + name);
    }

    var logBox = document.querySelector('.log-stream-box');
    if (logBox) {
      var item = document.createElement('div');
      item.className = 'log-item';
      var tag = document.createElement('span');
      tag.className = 'log-tag automod';
      tag.textContent = 'AUTOMOD';
      var description = document.createElement('span');
      description.appendChild(document.createTextNode(' ' + name + ' set to '));
      var state = document.createElement('b');
      state.textContent = active ? 'ACTIVE' : 'INACTIVE';
      description.appendChild(state);
      item.appendChild(tag);
      item.appendChild(description);
      logBox.insertBefore(item, logBox.firstChild);
    }
  });

  /* ── Back to Top Floating Button ──────────────────────────────── */
  var backToTop = document.createElement('button');
  backToTop.className = 'back-to-top';
  backToTop.setAttribute('type', 'button');
  backToTop.setAttribute('aria-label', 'Back to top');
  backToTop.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>';
  document.body.appendChild(backToTop);

  window.addEventListener('scroll', function () {
    if (window.scrollY > 320) {
      backToTop.classList.add('visible');
    } else {
      backToTop.classList.remove('visible');
    }
  }, { passive: true });

  backToTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ── Reading Scroll Progress Bar ────────────────────────────── */
  var progressBar = document.createElement('div');
  progressBar.className = 'reading-progress-bar';
  document.body.appendChild(progressBar);

  function updateProgress() {
    var total = document.documentElement.scrollHeight - window.innerHeight;
    if (total <= 0) {
      progressBar.style.width = '0%';
      return;
    }
    var current = window.scrollY;
    var pct = Math.min(100, Math.max(0, (current / total) * 100));
    progressBar.style.width = pct.toFixed(2) + '%';
  }
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });
  updateProgress();

  /* ── Code Block Copy Buttons ─────────────────────────────────── */
  var codeBlocks = document.querySelectorAll('pre.block');
  codeBlocks.forEach(function (pre) {
    if (pre.querySelector('.code-copy-btn')) return;
    var btn = document.createElement('button');
    btn.className = 'code-copy-btn';
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', 'Copy code snippet');
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><span>Copy</span>';

    btn.addEventListener('click', function () {
      var code = pre.querySelector('code');
      var text = (code ? code.textContent : pre.textContent) || '';
      text = text.trim();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          btn.innerHTML = '<span style="color:var(--accent)">✓</span><span>Copied!</span>';
          if (window.showToast) window.showToast('Copied code to clipboard');
          setTimeout(function () {
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><span>Copy</span>';
          }, 2000);
        }).catch(function () {});
      }
    });

    pre.appendChild(btn);
  });

  /* ── Docs Section Highlighting ───────────────────────────────── */
  var docHeadings = document.querySelectorAll('.docs-content h2[id]');
  var docLinks = document.querySelectorAll('.docs-side a[href^="#"]');
  var mobileSelect = document.getElementById('docs-section-select');
  if (docHeadings.length && (docLinks.length || mobileSelect)) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.id;
          docLinks.forEach(function (a) {
            var href = a.getAttribute('href');
            var match = href === '#' + id;
            a.classList.toggle('active', match);
          });
          if (mobileSelect) {
            mobileSelect.value = '#' + id;
          }
        }
      });
    }, { rootMargin: '-80px 0px -70% 0px' });

    docHeadings.forEach(function (h) {
      observer.observe(h);
    });
  }
})();
`;
