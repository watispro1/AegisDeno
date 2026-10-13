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

  /* ── Global page and command search ───────────────────────────── */
  var searchDialog = document.getElementById('site-search-dialog');
  var searchInput = document.getElementById('site-search-input');
  var searchResults = document.getElementById('site-search-results');
  var searchTrigger = document.querySelector('.site-search-trigger');
  var lastSearchFocus = null;
  var commandIndex = null;
  var pagesIndex = [
    { name: 'Dashboard', detail: 'Live bot metrics and service overview', href: '/dashboard', icon: '◈' },
    { name: 'Command reference', detail: 'Browse every Aegis slash command', href: '/commands', icon: '/' },
    { name: 'Features', detail: 'Tickets, moderation, automation, and more', href: '/features', icon: '✦' },
    { name: 'Documentation', detail: 'Setup guides and permission reference', href: '/docs', icon: '▤' },
    { name: 'Status', detail: 'Current bot health and gateway metrics', href: '/status', icon: '●' },
    { name: 'Changelog', detail: 'Product updates and release history', href: '/changelog', icon: '↗' },
    { name: 'Playground', detail: 'Explore interactive Aegis examples', href: '/playground', icon: '⌘' }
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
    setInterval(refresh, 30000);
  }

  /* ── Interactive Command & Embed Playground ───────────────────── */
  var pgSelect = document.getElementById('pg-command-select');
  var pgUser = document.getElementById('pg-user-input');
  var pgReason = document.getElementById('pg-reason-input');
  var pgSeverity = document.getElementById('pg-severity-select');
  var pgEmbedTitle = document.getElementById('pg-embed-title');
  var pgEmbedDesc = document.getElementById('pg-embed-desc');
  var pgEmbedColor = document.getElementById('pg-embed-card');
  var pgField1Val = document.getElementById('pg-f1-val');
  var pgField2Val = document.getElementById('pg-f2-val');
  var pgCmdString = document.getElementById('pg-cmd-string');
  var pgButtonsRow = document.getElementById('pg-buttons-row');

  if (pgSelect) {
    var updatePlayground = function () {
      var cmd = pgSelect.value || 'ticket';
      var user = (pgUser && pgUser.value.trim()) || '@Member';
      if (!user.startsWith('@') && !user.startsWith('#')) user = '@' + user;
      var reason = (pgReason && pgReason.value.trim()) || 'Support inquiry';
      var severity = (pgSeverity && pgSeverity.value) || 'medium';

      if (cmd === 'ticket') {
        if (pgEmbedTitle) pgEmbedTitle.textContent = '🎫 Support Tickets';
        if (pgEmbedDesc) pgEmbedDesc.textContent = 'Need assistance? Click the button below to open a private support ticket with our team.';
        if (pgEmbedColor) pgEmbedColor.style.borderLeftColor = '#3498db';
        if (pgField1Val) pgField1Val.textContent = 'General Support';
        if (pgField2Val) pgField2Val.textContent = 'Staff Role: @SupportTeam';
        if (pgCmdString) pgCmdString.textContent = '/ticket setup channel:#support staff_role:@SupportTeam title:"Support Tickets"';
        if (pgButtonsRow) {
          pgButtonsRow.innerHTML = '<button class="d-btn primary" type="button">🎫 Create Ticket</button>';
        }
      } else if (cmd === 'verify') {
        if (pgEmbedTitle) pgEmbedTitle.textContent = '🛡️ Server Verification Required';
        if (pgEmbedDesc) pgEmbedDesc.textContent = 'Click the button below to verify your account and gain access to the rest of the server.';
        if (pgEmbedColor) pgEmbedColor.style.borderLeftColor = '#2ecc71';
        if (pgField1Val) pgField1Val.textContent = '@Verified Member';
        if (pgField2Val) pgField2Val.textContent = 'Type: BUTTON';
        if (pgCmdString) pgCmdString.textContent = '/verify setup channel:#verify verified_role:@Verified type:button';
        if (pgButtonsRow) {
          pgButtonsRow.innerHTML = '<button class="d-btn success" type="button">✅ Verify Account</button>';
        }
      } else if (cmd === 'rolepanel') {
        if (pgEmbedTitle) pgEmbedTitle.textContent = '🎭 Choose Your Roles';
        if (pgEmbedDesc) pgEmbedDesc.textContent = 'Click the buttons below to toggle your self-assignable server roles.';
        if (pgEmbedColor) pgEmbedColor.style.borderLeftColor = '#9b59b6';
        if (pgField1Val) pgField1Val.textContent = '@Announcements, @Events, @Updates';
        if (pgField2Val) pgField2Val.textContent = 'Mode: Interactive Toggle';
        if (pgCmdString) pgCmdString.textContent = '/rolepanel create channel:#roles role1:@Announcements role2:@Events role3:@Updates';
        if (pgButtonsRow) {
          pgButtonsRow.innerHTML = '<button class="d-btn primary" type="button">📢 Announcements</button> <button class="d-btn primary" type="button">🎉 Events</button> <button class="d-btn primary" type="button">🔔 Updates</button>';
        }
      } else if (cmd === 'suggest') {
        if (pgEmbedTitle) pgEmbedTitle.textContent = '💡 Community Suggestion #4092';
        if (pgEmbedDesc) pgEmbedDesc.textContent = user + ': "' + reason + '"';
        if (pgEmbedColor) pgEmbedColor.style.borderLeftColor = '#f1c40f';
        if (pgField1Val) pgField1Val.textContent = '👍 24 | 👎 2';
        if (pgField2Val) pgField2Val.textContent = 'Status: PENDING';
        if (pgCmdString) pgCmdString.textContent = '/suggest suggestion:"' + reason + '"';
        if (pgButtonsRow) {
          pgButtonsRow.innerHTML = '<button class="d-btn secondary" type="button">👍 Upvote (24)</button> <button class="d-btn secondary" type="button">👎 Downvote (2)</button>';
        }
      } else if (cmd === 'warn') {
        if (pgEmbedTitle) pgEmbedTitle.textContent = '⚠️ Member Warned';
        if (pgEmbedDesc) pgEmbedDesc.textContent = user + ' was issued a formal warning by @Moderator.';
        if (pgEmbedColor) pgEmbedColor.style.borderLeftColor = severity === 'high' ? '#ed4245' : severity === 'medium' ? '#ffa500' : '#fee75c';
        if (pgField1Val) pgField1Val.textContent = reason;
        if (pgField2Val) pgField2Val.textContent = severity.toUpperCase();
        if (pgCmdString) pgCmdString.textContent = '/warn user:' + user + ' reason:"' + reason + '" severity:' + severity;
        if (pgButtonsRow) {
          pgButtonsRow.innerHTML = '<button class="d-btn primary" type="button">📜 Warning History</button> <button class="d-btn danger" type="button">❌ Undo Warn</button>';
        }
      } else if (cmd === 'purge') {
        if (pgEmbedTitle) pgEmbedTitle.textContent = '🗑️ Purge Preview';
        if (pgEmbedDesc) pgEmbedDesc.textContent = 'Found 25 message(s) matching your filter in #general.';
        if (pgEmbedColor) pgEmbedColor.style.borderLeftColor = '#ed4245';
        if (pgField1Val) pgField1Val.textContent = 'Filter: Bots Only';
        if (pgField2Val) pgField2Val.textContent = 'Sample: • @BotUser: hello...';
        if (pgCmdString) pgCmdString.textContent = '/purge amount:25 filter:bots';
        if (pgButtonsRow) {
          pgButtonsRow.innerHTML = '<button class="d-btn danger" type="button">🗑️ Delete 25 messages</button> <button class="d-btn secondary" type="button">✖️ Cancel</button>';
        }
      }
    };

    pgSelect.addEventListener('change', updatePlayground);
    if (pgUser) pgUser.addEventListener('input', updatePlayground);
    if (pgReason) pgReason.addEventListener('input', updatePlayground);
    if (pgSeverity) pgSeverity.addEventListener('change', updatePlayground);
    updatePlayground();
  }

  /* ── Interactive Server Calculator ───────────────────────────── */
  var calcSlider = document.getElementById('calc-members');
  var calcVal = document.getElementById('calc-members-val');
  var calcPing = document.getElementById('calc-ping');
  var calcRam = document.getElementById('calc-ram');
  var calcPreset = document.getElementById('calc-preset');

  if (calcSlider) {
    calcSlider.addEventListener('input', function () {
      var members = parseInt(calcSlider.value, 10);
      if (calcVal) calcVal.textContent = members.toLocaleString() + ' members';
      var ram = Math.round(18 + (members / 5000) * 4);
      var ping = Math.round(12 + (members / 10000) * 2);
      var preset = members > 25000 ? 'Strict Enterprise' : members > 5000 ? 'Community Standard' : 'Casual Friendly';
      if (calcRam) calcRam.textContent = ram + ' MB';
      if (calcPing) calcPing.textContent = ping + ' ms';
      if (calcPreset) calcPreset.textContent = preset;
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
})();
`;
