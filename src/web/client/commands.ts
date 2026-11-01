/** Copy buttons and the command reference (search, category filter, keyboard, deep links). */
export const jsCommands = String.raw`  /* ── Copy buttons ([data-copy] text, [data-copy-link] page links) ─── */
  function copyText(btn, text, label) {
    var original = btn.textContent;

    var done = function () {
      btn.textContent = 'Copied';
      btn.classList.add('copied');
      showToast(label || ('Copied ' + text));
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
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-copy], [data-copy-link]');
    if (!btn) return;
    e.preventDefault();
    var hash = btn.getAttribute('data-copy-link');
    if (hash !== null) {
      var url = window.location.origin + window.location.pathname + hash;
      copyText(btn, url, 'Link copied');
      return;
    }
    copyText(btn, btn.getAttribute('data-copy') || '');
  });

  function debounce(fn, ms) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  /* ── Command reference: search, filters, pins, keyboard, deep links ── */
  var search = document.getElementById('cmd-search');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.cmd-card'));
  var groups = Array.prototype.slice.call(document.querySelectorAll('.cmd-group'));
  var filterBar = document.getElementById('cmd-filter');
  var accessBar = document.getElementById('cmd-access');
  var countEl = document.getElementById('cmd-count');

  if (search && cards.length) {
    var PINS_KEY = 'aegis-command-pins';
    var activeCat = 'all';
    var activeAccess = 'all';
    var flags = { pinned: false, subs: false, autocomplete: false };
    var chips = filterBar ? Array.prototype.slice.call(filterBar.querySelectorAll('.tab')) : [];
    var accessChips = accessBar ? Array.prototype.slice.call(accessBar.querySelectorAll('[data-access]')) : [];
    var flagChips = accessBar ? Array.prototype.slice.call(accessBar.querySelectorAll('[data-flag]')) : [];
    var expandBtn = document.getElementById('cmd-expand');
    var suggestEl = document.getElementById('cmd-didyoumean');
    var suggestDefault = suggestEl ? suggestEl.textContent : '';
    var names = cards.map(function (c) { return c.getAttribute('data-name') || ''; });

    var readPins = function () {
      try {
        var raw = JSON.parse(localStorage.getItem(PINS_KEY) || '[]');
        return Array.isArray(raw) ? raw.filter(function (n) { return typeof n === 'string'; }) : [];
      } catch (err) { return []; }
    };
    var pins = readPins();
    var isPinned = function (name) { return pins.indexOf(name) !== -1; };
    var setPinned = function (name, on) {
      if (on && !isPinned(name)) pins.push(name);
      if (!on) pins = pins.filter(function (n) { return n !== name; });
      try { localStorage.setItem(PINS_KEY, JSON.stringify(pins)); } catch (err) {}
    };

    var syncPins = function () {
      var buttons = document.querySelectorAll('[data-pin]');
      Array.prototype.forEach.call(buttons, function (b) {
        var name = b.getAttribute('data-pin') || '';
        var on = isPinned(name);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.setAttribute('aria-label', (on ? 'Unpin /' : 'Pin /') + name);
        b.setAttribute('title', on ? 'Unpin /' + name : 'Pin /' + name + ' to the top of this page');
      });
    };

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

    /* Edit distance, capped, for "did you mean" on an empty search. */
    var distance = function (a, b) {
      if (Math.abs(a.length - b.length) > 3) return 99;
      var prev = [];
      for (var j = 0; j <= b.length; j++) prev.push(j);
      for (var i = 1; i <= a.length; i++) {
        var cur = [i];
        for (var k = 1; k <= b.length; k++) {
          cur.push(Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + (a[i - 1] === b[k - 1] ? 0 : 1)));
        }
        prev = cur;
      }
      return prev[b.length];
    };

    var showSuggestions = function (query) {
      if (!suggestEl) return;
      var q = query.replace(/^\//, '').split(' ')[0];
      var near = q ? names
        .map(function (n) { return { n: n, d: distance(q, n) }; })
        .filter(function (x) { return x.d <= 2; })
        .sort(function (a, b) { return a.d - b.d; })
        .slice(0, 3) : [];
      if (!near.length) {
        suggestEl.textContent = suggestDefault;
        return;
      }
      suggestEl.textContent = 'Did you mean ';
      near.forEach(function (x, idx) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'linklike';
        b.setAttribute('data-cmd-suggest', x.n);
        b.textContent = '/' + x.n;
        suggestEl.appendChild(b);
        suggestEl.appendChild(document.createTextNode(idx < near.length - 1 ? ', ' : '?'));
      });
    };

    /* q, category, access level and the feature toggles all live in the URL. */
    var syncUrl = function () {
      if (!window.history || !window.history.replaceState) return;
      try {
        var url = new URL(window.location.href);
        var query = search.value.trim();
        if (query) url.searchParams.set('q', query); else url.searchParams.delete('q');
        if (activeCat !== 'all') url.searchParams.set('cat', activeCat); else url.searchParams.delete('cat');
        if (activeAccess !== 'all') url.searchParams.set('access', activeAccess); else url.searchParams.delete('access');
        if (flags.pinned) url.searchParams.set('pinned', '1'); else url.searchParams.delete('pinned');
        if (flags.subs) url.searchParams.set('subs', '1'); else url.searchParams.delete('subs');
        if (flags.autocomplete) url.searchParams.set('auto', '1'); else url.searchParams.delete('auto');
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      } catch (e) {}
    };

    var syncControls = function () {
      chips.forEach(function (c) {
        c.setAttribute('aria-pressed', String((c.getAttribute('data-cat') || 'all') === activeCat));
      });
      accessChips.forEach(function (c) {
        c.setAttribute('aria-pressed', String((c.getAttribute('data-access') || 'all') === activeAccess));
      });
      flagChips.forEach(function (c) {
        c.setAttribute('aria-pressed', String(Boolean(flags[c.getAttribute('data-flag')])));
      });
    };

    var visibleCards = function () {
      return cards.filter(function (c) { return !c.hidden; });
    };

    var apply = function () {
      var query = search.value.trim().toLowerCase();
      var visible = 0;
      var visibleGroups = {};

      cards.forEach(function (card) {
        var haystack = card.getAttribute('data-search') || '';
        var cat = card.getAttribute('data-category') || '';
        var access = card.getAttribute('data-access') || 'everyone';
        var name = card.getAttribute('data-name') || '';
        var q = query.charAt(0) === '/' ? query.slice(1) : query;
        var show = (!q || haystack.indexOf(q) !== -1) &&
          (activeCat === 'all' || cat === activeCat) &&
          (activeAccess === 'all' || access === activeAccess) &&
          (!flags.pinned || isPinned(name)) &&
          (!flags.subs || card.getAttribute('data-subs') === '1') &&
          (!flags.autocomplete || card.getAttribute('data-autocomplete') === '1');
        card.hidden = !show;
        if (show) {
          visible++;
          visibleGroups[cat] = true;
        }
        highlight(card, q);
      });

      groups.forEach(function (group) {
        group.hidden = !visibleGroups[group.getAttribute('data-cmd-group')];
      });

      if (countEl) countEl.textContent = visible === 1 ? '1 command' : visible + ' commands';
      var empty = document.getElementById('cmd-empty');
      if (empty) empty.hidden = visible !== 0;
      if (visible === 0) showSuggestions(query);
    };

    var selectChip = function (chip) {
      activeCat = chip.getAttribute('data-cat') || 'all';
      syncControls();
      apply();
      syncUrl();
    };

    var clearAll = function () {
      search.value = '';
      activeCat = 'all';
      activeAccess = 'all';
      flags = { pinned: false, subs: false, autocomplete: false };
      syncControls();
      apply();
      syncUrl();
      search.focus();
    };

    var focusCard = function (card) {
      if (!card) return;
      var summary = card.querySelector('summary');
      if (summary) summary.focus();
    };

    search.addEventListener('input', debounce(function () {
      apply();
      syncUrl();
    }, 80));

    search.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (search.value) {
          e.preventDefault();
          search.value = '';
          apply();
          syncUrl();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        var first = visibleCards()[0];
        if (first) {
          first.open = true;
          first.scrollIntoView({ block: 'start' });
          focusCard(first);
        }
      } else if (e.key === 'ArrowDown') {
        var firstCard = visibleCards()[0];
        if (firstCard) {
          e.preventDefault();
          focusCard(firstCard);
        }
      }
    });

    /* Up and down move between the visible commands; Escape goes back to the search box. */
    document.addEventListener('keydown', function (e) {
      var t = document.activeElement;
      if (!t || t.tagName !== 'SUMMARY' || !t.parentNode || !t.parentNode.classList.contains('cmd-card')) return;
      var list = visibleCards();
      var at = list.indexOf(t.parentNode);
      if (e.key === 'ArrowDown' && at < list.length - 1) {
        e.preventDefault();
        focusCard(list[at + 1]);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (at > 0) focusCard(list[at - 1]); else search.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        search.focus();
      }
    });

    if (filterBar) {
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

    if (accessBar) {
      accessBar.addEventListener('click', function (e) {
        var accessChip = e.target.closest('[data-access]');
        if (accessChip) {
          activeAccess = accessChip.getAttribute('data-access') || 'all';
          syncControls();
          apply();
          syncUrl();
          return;
        }
        var flagChip = e.target.closest('[data-flag]');
        if (flagChip) {
          var key = flagChip.getAttribute('data-flag');
          flags[key] = !flags[key];
          syncControls();
          apply();
          syncUrl();
        }
      });
      accessBar.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        var chips2 = accessChips.concat(flagChips);
        var current = chips2.indexOf(document.activeElement);
        if (current === -1) return;
        e.preventDefault();
        chips2[e.key === 'ArrowRight'
          ? (current + 1) % chips2.length
          : (current - 1 + chips2.length) % chips2.length].focus();
      });
    }

    document.addEventListener('click', function (e) {
      var clear = e.target.closest && e.target.closest('[data-cmd-clear]');
      if (clear) {
        e.preventDefault();
        clearAll();
        return;
      }
      var pin = e.target.closest && e.target.closest('[data-pin]');
      if (pin) {
        e.preventDefault();
        var pinnedName = pin.getAttribute('data-pin') || '';
        var on = !isPinned(pinnedName);
        setPinned(pinnedName, on);
        syncPins();
        showToast(on ? 'Pinned /' + pinnedName : 'Unpinned /' + pinnedName);
        if (flags.pinned) apply();
        return;
      }
      var pick = e.target.closest && e.target.closest('[data-cmd-suggest]');
      if (pick) {
        e.preventDefault();
        search.value = pick.getAttribute('data-cmd-suggest') || '';
        activeCat = 'all';
        syncControls();
        apply();
        syncUrl();
      }
    });

    if (expandBtn) {
      expandBtn.addEventListener('click', function () {
        var open = expandBtn.getAttribute('aria-pressed') !== 'true';
        visibleCards().forEach(function (c) { c.open = open; });
        expandBtn.setAttribute('aria-pressed', String(open));
        expandBtn.textContent = open ? 'Collapse all' : 'Expand all';
      });
    }

    var flash = function (el) {
      el.classList.add('flash');
      setTimeout(function () { el.classList.remove('flash'); }, 1600);
    };

    /* #cmd-ban opens /ban; #cmd-automod-words-add opens /automod and marks that subcommand. */
    var openHash = function () {
      var hash = window.location.hash;
      if (hash.indexOf('#cmd-') !== 0) return;
      var target = document.getElementById(hash.slice(1));
      if (!target) return;
      var card = target.classList.contains('cmd-card') ? target : target.closest('.cmd-card');
      if (!card) return;
      if (card.hidden) clearAll();
      card.open = true;
      flash(target === card ? card : target);
      target.scrollIntoView({ block: 'start' });
    };

    /* Read q, cat, access and toggles from the URL so filters can be shared. */
    var params = null;
    try { params = new URLSearchParams(window.location.search); } catch (err) {}
    if (params) {
      var initialQuery = (params.get('q') || '').slice(0, 100);
      if (initialQuery) search.value = initialQuery;
      var initialCat = params.get('cat');
      if (initialCat && chips.some(function (c) { return c.getAttribute('data-cat') === initialCat; })) {
        activeCat = initialCat;
      }
      var initialAccess = params.get('access');
      if (['everyone', 'moderator', 'admin'].indexOf(initialAccess) !== -1) activeAccess = initialAccess;
      flags.pinned = params.get('pinned') === '1';
      flags.subs = params.get('subs') === '1';
      flags.autocomplete = params.get('auto') === '1';
    }
    syncControls();
    syncPins();
    apply();
    openHash();
    window.addEventListener('hashchange', openHash);

    /* The permalink sits inside <summary>, so it must not toggle the card. */
    document.addEventListener('click', function (e) {
      var link = e.target.closest && e.target.closest('.cmd-anchor');
      if (!link) return;
      e.preventDefault();
      var card = link.closest('details');
      if (card) {
        card.open = true;
        flash(card);
      }
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
  }

`;
