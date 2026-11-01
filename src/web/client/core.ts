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
  var pagesIndex = [
    { name: 'Features', detail: 'What each part of the bot does', href: '/features', icon: '#' },
    { name: 'Commands', detail: 'Every slash command with its options', href: '/commands', icon: '#' },
    { name: 'Docs', detail: 'Setup, configuration and permissions', href: '/docs', icon: '#' },
    { name: 'Dashboard', detail: 'Log in with Discord to manage cases and settings', href: '/dashboard', icon: '#' },
    { name: 'Troubleshooting', detail: 'Missing permissions, missing commands and other fixes', href: '/troubleshooting', icon: '#' },
    { name: 'Changelog', detail: 'Release history', href: '/changelog', icon: '#' },
    { name: 'Status', detail: 'Gateway latency and uptime', href: '/status', icon: '#' },
    { name: 'Privacy', detail: 'What is stored and for how long', href: '/privacy', icon: '#' },
    { name: 'Terms', detail: 'Terms of service', href: '/terms', icon: '#' },
    { name: 'Security', detail: 'Report a vulnerability', href: '/security', icon: '#' }
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

`;
