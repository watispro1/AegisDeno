/** Theme picker (fragment of the site.js IIFE opened in core): applies, saves and reflects the chosen theme. */
export const jsTheme = String.raw`
  /* Theme picker: System (default), Light, Dark, Steel & Ink, Glass (beta).
     theme-init.js applies the saved choice before paint; this keeps it in sync. */
  var STORAGE_KEY = 'aegis-theme';
  var THEME_LABELS = { system: 'System', light: 'Light', dark: 'Dark', steel: 'Steel & Ink', glass: 'Glass (beta)' };
  var THEME_COLORS = { light: '#fbfaf8', dark: '#161716', steel: '#0c0d0f', glass: '#0b0d12' };

  function getSavedTheme() {
    var t = null;
    try { t = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    return t && Object.prototype.hasOwnProperty.call(THEME_LABELS, t) ? t : 'system';
  }

  function resolveSystemDark() {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function syncTheme() {
    var setting = getSavedTheme();
    var active = setting === 'system' ? (resolveSystemDark() ? 'dark' : 'light') : setting;
    root.setAttribute('data-theme', active);
    root.setAttribute('data-theme-setting', setting);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[active]);
    var label = 'Theme: ' + THEME_LABELS[setting];
    var toggles = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].setAttribute('aria-label', label + '. Choose theme');
      toggles[i].setAttribute('title', label);
    }
    var opts = document.querySelectorAll('[data-set-theme]');
    for (var j = 0; j < opts.length; j++) {
      opts[j].setAttribute('aria-pressed', opts[j].getAttribute('data-set-theme') === setting ? 'true' : 'false');
    }
  }

  function applyTheme(theme) {
    if (!Object.prototype.hasOwnProperty.call(THEME_LABELS, theme)) return;
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
    syncTheme();
  }

  function closeThemePicker(picker, refocus) {
    picker.removeAttribute('open');
    var s = picker.querySelector('summary');
    if (refocus && s) s.focus();
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var opt = e.target.closest('[data-set-theme]');
    if (opt) {
      applyTheme(opt.getAttribute('data-set-theme'));
      var owner = opt.closest('.theme-picker');
      if (owner) closeThemePicker(owner, true);
      return;
    }
    var inside = e.target.closest('.theme-picker');
    var open = document.querySelectorAll('.theme-picker[open]');
    for (var k = 0; k < open.length; k++) if (open[k] !== inside) closeThemePicker(open[k], false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = document.querySelector('.theme-picker[open]');
    if (open) closeThemePicker(open, true);
  });

  if (window.matchMedia) {
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
        if (getSavedTheme() === 'system') syncTheme();
      });
    } catch (e) {}
  }
  syncTheme();

`;
