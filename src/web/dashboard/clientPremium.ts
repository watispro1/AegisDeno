/**
 * Script served from /assets/premium.js, loaded only on the dashboard's Premium
 * page after Paddle.js (https://cdn.paddle.com/paddle/v2/paddle.js). Reads the
 * checkout settings from data-* attributes (no inline script), initialises
 * Paddle.js (including pwCustomer for Paddle Retain) and opens the overlay checkout
 * with custom_data {guildId, userId}, which the webhook uses to attribute the
 * subscription to the server.
 */
export const premiumScript = String.raw`
(function () {
  'use strict';
  var box = document.querySelector('[data-premium-checkout]');
  if (!box) return;
  var button = box.querySelector('[data-premium-subscribe]');
  var status = box.querySelector('[data-premium-status]');
  var say = function (text) { if (status) status.textContent = text; };
  var cfg = {
    env: box.getAttribute('data-env'),
    token: box.getAttribute('data-token'),
    price: box.getAttribute('data-price'),
    guild: box.getAttribute('data-guild'),
    user: box.getAttribute('data-user'),
    customer: box.getAttribute('data-customer'),
    success: box.getAttribute('data-success')
  };
  var P = window.Paddle;
  if (!P || !button || !cfg.token || !cfg.price) {
    say('The secure checkout could not load. Check that nothing is blocking cdn.paddle.com, then reload.');
    return;
  }
  try {
    if (cfg.env === 'sandbox') P.Environment.set('sandbox');
    var initOpts = {
      token: cfg.token,
      eventCallback: function (ev) {
        if (!ev || !ev.name) return;
        if (ev.name === 'checkout.completed') say('Payment received. Premium turns on as soon as Paddle confirms it, usually within a minute.');
        if (ev.name === 'checkout.error') say('The checkout hit an error. Nothing was charged. Try again.');
      }
    };
    if (cfg.customer && /^ctm_[a-z\d]{26}$/.test(cfg.customer)) {
      initOpts.pwCustomer = { id: cfg.customer };
    }
    P.Initialize(initOpts);
  } catch (e) {
    say('The secure checkout could not start. Reload the page and try again.');
    return;
  }
  button.disabled = false;
  say('');
  button.addEventListener('click', function () {
    P.Checkout.open({
      items: [{ priceId: cfg.price, quantity: 1 }],
      customData: { guildId: cfg.guild, userId: cfg.user },
      settings: { displayMode: 'overlay', variant: 'one-page', successUrl: cfg.success, allowLogout: false }
    });
  });
})();
`;
