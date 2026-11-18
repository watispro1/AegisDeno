/**
 * Script served from /assets/premium.js, loaded only on the dashboard's Premium
 * page while Premium is for sale, after Paddle.js
 * (https://cdn.paddle.com/paddle/v2/paddle.js). Fetches the checkout settings
 * from the server (data-checkout-url, no inline script); the server answers 403
 * premium_not_for_sale while PREMIUM_SALES_ENABLED is off, and then no checkout
 * opens. Otherwise it initialises Paddle.js (including pwCustomer for Paddle
 * Retain) and opens the overlay checkout with custom_data {guildId, userId},
 * which the webhook uses to attribute the subscription to the server.
 */
export const premiumScript = String.raw`
(function () {
  'use strict';
  var box = document.querySelector('[data-premium-checkout]');
  if (!box) return;
  var button = box.querySelector('[data-premium-subscribe]');
  var status = box.querySelector('[data-premium-status]');
  var say = function (text) { if (status) status.textContent = text; };
  var url = box.getAttribute('data-checkout-url');
  var P = window.Paddle;
  if (!P || !button || !url || !window.fetch) {
    say('The secure checkout could not load. Check that nothing is blocking cdn.paddle.com, then reload.');
    return;
  }
  fetch(url, { credentials: 'same-origin', headers: { accept: 'application/json' } })
    .then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) { return { ok: res.ok, body: body || {} }; });
    })
    .then(function (r) {
      if (!r.ok || !r.body.clientToken || !r.body.priceId) {
        say(r.body.message || 'The secure checkout is not available right now. Nothing was charged.');
        return;
      }
      start(r.body);
    })
    .catch(function () { say('The secure checkout could not load. Reload the page and try again.'); });

  function start(raw) {
    var cfg = {
      env: raw.environment,
      token: raw.clientToken,
      price: raw.priceId,
      guild: raw.guildId,
      user: raw.userId,
      customer: raw.customerId,
      success: raw.successUrl
    };
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
  }
})();
`;
