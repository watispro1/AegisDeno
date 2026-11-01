import { dashboardAppScript } from "./clientApp";
import { dashboardPaletteScript } from "./clientPalette";
import { dashboardQolScript } from "./clientQol";

/**
 * Script served from /assets/dashboard.js. Plain ES5, progressive only: every
 * dashboard form works without it. It adds the live welcome preview, dims
 * unused timeout fields, asks before revoking or deciding an appeal, keeps
 * checkbox-list counts current, stops a form from being sent twice, drops a
 * shown ?notice= from the address bar, and focuses the error summary.
 */
const baseScript = String.raw`
(function () {
  'use strict';

  /* Welcome preview: same placeholders as the bot, one pass, no HTML. */
  var input = document.querySelector('[data-welcome-input]');
  var preview = document.querySelector('[data-welcome-preview]');
  if (input && preview) {
    var user = input.getAttribute('data-sample-user') || 'member';
    var values = {
      user: '@' + user,
      username: user,
      server: input.getAttribute('data-sample-server') || 'this server',
      count: input.getAttribute('data-sample-count') || '?'
    };
    values.member_count = values.count;
    values.memberCount = values.count;
    var render = function () {
      preview.textContent = input.value.replace(/\{(user|username|server|count|member_count|memberCount)\}/g, function (_, key) {
        return values[key];
      });
    };
    input.addEventListener('input', render);
  }

  /* Escalation: the timeout length only applies to time outs. */
  var rows = document.querySelectorAll('[data-escalation-row]');
  for (var i = 0; i < rows.length; i++) {
    (function (row) {
      var action = row.querySelector('[data-escalation-action]');
      var duration = row.querySelector('input[name^="t_duration_"]');
      if (!action || !duration) return;
      var sync = function () {
        var on = action.value === 'timeout';
        duration.disabled = !on;
        duration.setAttribute('aria-disabled', on ? 'false' : 'true');
      };
      action.addEventListener('change', sync);
      sync();
    })(rows[i]);
  }

  /* Confirm dialog: the page's <dialog data-confirm-dialog> when the browser supports it, else window.confirm. */
  function askConfirm(message, onYes) {
    var dialog = document.querySelector('[data-confirm-dialog]');
    if (!dialog || typeof dialog.showModal !== 'function') { if (window.confirm(message)) onYes(); return; }
    var text = dialog.querySelector('[data-confirm-text]');
    if (text) text.textContent = message;
    dialog.returnValue = '';
    var done = function () {
      dialog.removeEventListener('close', done);
      if (dialog.returnValue === 'ok') onYes();
    };
    dialog.addEventListener('close', done);
    dialog.showModal();
    var ok = dialog.querySelector('[data-confirm-ok]');
    if (ok && ok.focus) ok.focus();
  }

  /* Ask before destructive actions. A clicked button's own data-confirm-button wins. */
  var lastButton = null;
  document.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== document && !(t.tagName === 'BUTTON' && t.type === 'submit')) t = t.parentNode;
    lastButton = t && t !== document ? t : null;
  }, true);
  document.addEventListener('submit', function (e) {
    var form = e.target;
    var button = e.submitter || lastButton;
    var message = (button && button.form === form && button.getAttribute('data-confirm-button')) ||
      (form && form.getAttribute && form.getAttribute('data-confirm'));
    lastButton = null;
    if (message && form.getAttribute('data-confirmed') !== 'true') {
      /* Ask in the page's own dialog (window.confirm without <dialog>), then send with the same button. */
      e.preventDefault();
      askConfirm(message, function () {
        form.setAttribute('data-confirmed', 'true');
        if (form.requestSubmit) form.requestSubmit(button && button.form === form ? button : undefined);
        else form.submit();
      });
      return;
    }
    if (form && form.removeAttribute) form.removeAttribute('data-confirmed');
    if (!form || !form.getAttribute || form.getAttribute('method') !== 'post') return;
    /* A second click while the first post is on its way would send it twice. */
    if (form.getAttribute('data-busy') === 'true') { e.preventDefault(); return; }
    form.setAttribute('data-busy', 'true');
    form.setAttribute('aria-busy', 'true');
    /* Disable after the browser has read the form, so the clicked button's value is still sent. */
    setTimeout(function () {
      var buttons = form.querySelectorAll('button[type="submit"]');
      for (var b = 0; b < buttons.length; b++) buttons[b].disabled = true;
    }, 0);
  });

  /* Coming back with the Back button restores the page as it was left: make its forms usable again. */
  window.addEventListener('pageshow', function () {
    var busy = document.querySelectorAll('form[data-busy="true"]');
    for (var f = 0; f < busy.length; f++) {
      busy[f].removeAttribute('data-busy');
      busy[f].removeAttribute('aria-busy');
      var bs = busy[f].querySelectorAll('button[type="submit"]');
      for (var k = 0; k < bs.length; k++) bs[k].disabled = false;
    }
  });

  /* Show a "Saved" style notice once: drop ?notice= from the address so a reload or bookmark does not repeat it. */
  if (window.history && window.history.replaceState && /[?&]notice=/.test(window.location.search)) {
    var query = window.location.search.replace(/^\?/, '').split('&').filter(function (p) {
      return p.indexOf('notice=') !== 0;
    }).join('&');
    window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);
  }

  /* Checkbox lists: keep the "(n picked)" count current. */
  var lists = document.querySelectorAll('.pick-list');
  for (var j = 0; j < lists.length; j++) {
    (function (list) {
      var count = list.querySelector('legend .faint');
      if (!count) return;
      var update = function () {
        count.textContent = '(' + list.querySelectorAll('input[type="checkbox"]:checked').length + ' picked)';
      };
      list.addEventListener('change', update);
    })(lists[j]);
  }

  /* Move focus to the error summary so screen readers announce it. */
  var summary = document.querySelector('[data-error-summary]');
  if (summary && summary.focus) summary.focus();
})();
`;

/** Everything served from /assets/dashboard.js: the original helpers, then the app shell's. */
export const dashboardScript = baseScript + dashboardAppScript + dashboardPaletteScript + dashboardQolScript;
