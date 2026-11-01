/** Opens the IIFE: theme toggle, site search (Ctrl/Cmd+K), mobile nav and toasts. */
export const jsCore = String.raw`
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
  var resultItems = [];
  var activeResult = -1;
  var RECENT_KEY = 'aegis-search-recent';

  var pagesIndex = [
    { name: 'Features', detail: 'What each part of the bot does', href: '/features' },
    { name: 'Commands', detail: 'Every slash command with its options', href: '/commands' },
    { name: 'Docs', detail: 'Setup, configuration and permissions', href: '/docs' },
    { name: 'Dashboard', detail: 'Log in with Discord to manage cases and settings', href: '/dashboard' },
    { name: 'Troubleshooting', detail: 'Missing permissions, missing commands and other fixes', href: '/troubleshooting' },
    { name: 'Changelog', detail: 'Release history', href: '/changelog' },
    { name: 'Status', detail: 'Gateway latency and uptime', href: '/status' },
    { name: 'Privacy', detail: 'What is stored and for how long', href: '/privacy' },
    { name: 'Terms', detail: 'Terms of service', href: '/terms' },
    { name: 'Security', detail: 'Report a vulnerability', href: '/security' }
  ];

  /*
   * Fuzzy match, highest score wins. Prefix matches beat substring matches,
   * which beat in-order letter matches, so typing "bna" still finds /ban
   * without pushing it above an exact prefix.
   */
  function fuzzyScore(text, query) {
    if (!query) return 0;
    var hay = String(text || '').toLowerCase();
    if (hay === query) return 1000;
    if (hay.indexOf(query) === 0) return 900 - Math.min(200, hay.length);
    var at = hay.indexOf(query);
    if (at > 0) return 700 - Math.min(200, at);
    var cursor = 0;
    var score = 0;
    for (var i = 0; i < query.length; i++) {
      var found = hay.indexOf(query.charAt(i), cursor);
      if (found === -1) return -1;
      score += 20 - Math.min(18, found - cursor);
      cursor = found + 1;
    }
    return score;
  }

  function readRecent() {
    try {
      var raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter(function (s) { return typeof s === 'string' && s; }).slice(0, 5) : [];
    } catch (e) { return []; }
  }

  function saveRecent(query) {
    var value = String(query || '').trim();
    if (!value) return;
    var list = readRecent().filter(function (s) { return s.toLowerCase() !== value.toLowerCase(); });
    list.unshift(value);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5))); } catch (e) {}
  }

  function closeSiteSearch() {
    if (!searchDialog || searchDialog.hidden) return;
    searchDialog.hidden = true;
    document.body.style.overflow = '';
    if (lastSearchFocus && lastSearchFocus.focus) lastSearchFocus.focus();
  }

  function appendGroup(label, entries) {
    if (!entries.length) return;
    entries.sort(function (a, b) { return b.score - a.score; });
    var heading = document.createElement('p');
    heading.className = 'site-search-group';
    heading.textContent = label;
    searchResults.appendChild(heading);
    entries.slice(0, 6).forEach(function (entry) {
      var link = document.createElement('a');
      link.className = 'site-search-result';
      link.href = entry.href;
      link.setAttribute('role', 'option');
      link.setAttribute('aria-selected', 'false');
      var icon = document.createElement('span');
      icon.className = 'site-search-result-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = entry.icon;
      var copy = document.createElement('span');
      copy.className = 'site-search-result-copy';
      var name = document.createElement('strong');
      name.textContent = entry.name;
      var detail = document.createElement('small');
      detail.textContent = entry.detail;
      copy.appendChild(name);
      copy.appendChild(detail);
      link.appendChild(icon);
      link.appendChild(copy);
      link.setAttribute('data-search-query', searchInput.value.trim());
      searchResults.appendChild(link);
      resultItems.push(link);
    });
  }

  function setActive(index) {
    if (!resultItems.length) {
      activeResult = -1;
      return;
    }
    if (index < 0) index = resultItems.length - 1;
    if (index >= resultItems.length) index = 0;
    resultItems.forEach(function (el, i) {
      var on = i === index;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    activeResult = index;
    if (resultItems[index].scrollIntoView) {
      resultItems[index].scrollIntoView({ block: 'nearest' });
    }
  }

  function appendRecent() {
    var recent = readRecent();
    var wrap = document.createElement('div');
    wrap.className = 'site-search-recent-wrap';
    if (recent.length) {
      var heading = document.createElement('p');
      heading.className = 'site-search-group';
      heading.textContent = 'Recent searches';
      wrap.appendChild(heading);
      var row = document.createElement('div');
      row.className = 'site-search-recent-row';
      recent.forEach(function (value) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'site-search-recent';
        chip.setAttribute('data-site-search-recent', value);
        chip.textContent = value;
        row.appendChild(chip);
      });
      wrap.appendChild(row);
    }
    var hint = document.createElement('p');
    hint.className = 'site-search-empty';
    hint.textContent = 'Try a page (docs), a command (/ban), or a subcommand (automod words).';
    wrap.appendChild(hint);
    searchResults.appendChild(wrap);
  }

  function renderSiteSearch() {
    if (!searchInput || !searchResults) return;
    var raw = searchInput.value.trim();
    var query = raw.toLowerCase();
    searchResults.textContent = '';
    resultItems = [];
    activeResult = -1;
    if (query.length < 2) {
      appendRecent();
      return;
    }

    var pages = [];
    pagesIndex.forEach(function (item) {
      var score = Math.max(fuzzyScore(item.name, query), fuzzyScore(item.detail, query) - 250);
      if (score > 0) pages.push({ name: item.name, detail: item.detail, href: item.href, icon: '#', score: score });
    });

    var commands = [];
    var subcommands = [];
    if (commandIndex) {
      commandIndex.forEach(function (command) {
        var score = Math.max(
          fuzzyScore(command.name, query),
          fuzzyScore(command.description, query) - 350,
          fuzzyScore(command.category, query) - 450
        );
        if (score > 0) {
          commands.push({
            name: '/' + command.name,
            detail: command.description,
            href: '/commands#cmd-' + command.name,
            icon: '/',
            score: score
          });
        }
        (command.subcommands || []).forEach(function (sub) {
          var substack = command.name + ' ' + sub.path;
          var subScore = Math.max(fuzzyScore(substack, query), fuzzyScore(sub.description, query) - 350);
          if (subScore > 0) {
            subcommands.push({
              name: '/' + substack,
              detail: sub.description,
              href: '/commands#cmd-' + substack.replace(/\s+/g, '-'),
              icon: '/',
              score: subScore
            });
          }
        });
      });
    }

    appendGroup('Pages', pages);
    appendGroup('Commands', commands);
    appendGroup('Subcommands', subcommands);

    if (!resultItems.length) {
      var empty = document.createElement('p');
      empty.className = 'site-search-empty';
      empty.textContent = commandIndex ? 'Nothing matches that.' : 'Searching…';
      searchResults.appendChild(empty);
    } else {
      setActive(0);
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
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(activeResult + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(activeResult - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        var chosen = resultItems[activeResult] || resultItems[0];
        if (chosen) {
          saveRecent(searchInput.value);
          window.location.href = chosen.href;
        }
      }
    });
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-site-search-close]')) {
      closeSiteSearch();
      return;
    }
    var recent = e.target.closest && e.target.closest('[data-site-search-recent]');
    if (recent) {
      e.preventDefault();
      searchInput.value = recent.getAttribute('data-site-search-recent') || '';
      renderSiteSearch();
      searchInput.focus();
      return;
    }
    var result = e.target.closest && e.target.closest('.site-search-result');
    if (result && result.getAttribute('data-search-query')) {
      saveRecent(result.getAttribute('data-search-query'));
    }
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

`;
