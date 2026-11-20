/**
 * Script served from /assets/premium.js, loaded on the dashboard's Premium
 * page. Handles checkout interactions and button state.
 */
export const premiumScript = String.raw`
(function () {
  'use strict';
  var box = document.querySelector('[data-premium-checkout]');
  if (!box) return;
  var button = box.querySelector('[data-premium-subscribe]');
  var status = box.querySelector('[data-premium-status]');
  var say = function (text) { if (status) status.textContent = text; };

  if (button) {
    button.disabled = false;
    say('');
    button.addEventListener('click', function () {
      var form = box.querySelector('form');
      if (form) {
        say('Redirecting to secure Stripe checkout…');
        form.submit();
      }
    });
  }
})();
`;
