export const clientScript = String.raw`
(function () {
  'use strict';

  var root = document.documentElement;

  /* ── Theme ─────────────────────────────────────────────────────── */
  var STORAGE_KEY = 'aegis-theme';
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      root.setAttribute('data-theme', saved);
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
    var dark = currentTheme() === 'dark';
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    btn.setAttribute('title', dark ? 'Switch to light theme' : 'Switch to dark theme');
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.theme-toggle');
    if (!btn) return;
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (err) {}
    syncToggle();
  });

  syncToggle();

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

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(restore).catch(restore);
    } else {
      restore();
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
    toast.className = 'toast';
    toast.style.cssText = 'background:var(--bg-card);color:var(--fg);border:1px solid var(--border);padding:0.75rem 1.2rem;border-radius:var(--r-sm);box-shadow:0 4px 12px rgba(0,0,0,0.15);font-size:0.9rem;font-weight:600;display:flex;align-items:center;gap:0.5rem;';
    toast.innerHTML = '⚡ <span>' + msg + '</span>';
    container.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }, 2800);
  };

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
      if (!user.startsWith('@')) user = '@' + user;
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

  /* ── AutoMod Toggle Simulation ───────────────────────────────── */
  document.addEventListener('change', function (e) {
    var toggle = e.target.closest && e.target.closest('.toggle-switch input');
    if (!toggle) return;
    var name = toggle.getAttribute('data-rule-name') || 'AutoMod Rule';
    var active = toggle.checked;
    window.showToast((active ? 'Enabled ' : 'Disabled ') + name);

    var logBox = document.querySelector('.log-stream-box');
    if (logBox) {
      var item = document.createElement('div');
      item.className = 'log-item';
      item.innerHTML = '<span class="log-tag automod">AUTOMOD</span> <span>' + name + ' set to <b>' + (active ? 'ACTIVE' : 'INACTIVE') + '</b></span>';
      logBox.insertBefore(item, logBox.firstChild);
    }
  });
})();
`;
