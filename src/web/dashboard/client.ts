/**
 * Script served from /assets/dashboard.js. Plain ES5, progressive only: every
 * dashboard form works without it. It adds the live welcome preview, dims
 * unused timeout fields, asks before revoking, and focuses the error summary.
 */
export const dashboardScript = String.raw`
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
    var render = function () {
      preview.textContent = input.value.replace(/\{(user|username|server|count|member_count)\}/g, function (_, key) {
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

  /* Ask before destructive actions. */
  document.addEventListener('submit', function (e) {
    var form = e.target;
    var message = form && form.getAttribute && form.getAttribute('data-confirm');
    if (message && !window.confirm(message)) e.preventDefault();
  });

  /* Move focus to the error summary so screen readers announce it. */
  var summary = document.querySelector('[data-error-summary]');
  if (summary && summary.focus) summary.focus();
})();
`;
