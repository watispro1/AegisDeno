/**
 * Trust, members and automod pages: flags an embed that goes over Discord's
 * total character limit as you type. Runs after the embed preview script has
 * updated [data-embed-total]. Plain ES5, progressive only.
 */
export const dashboardTrustPagesScript = String.raw`
(function () {
  'use strict';
  var doc = document;
  function check(b) {
    var wrap = b.querySelector('[data-embed-total-wrap]');
    var total = b.querySelector('[data-embed-total]');
    var over = b.querySelector('[data-embed-over]');
    if (!wrap || !total) return;
    var max = parseInt(wrap.getAttribute('data-embed-total-wrap'), 10) || 0;
    var n = parseInt(total.textContent, 10) || 0;
    var bad = max > 0 && n > max;
    if (bad) wrap.setAttribute('data-over', ''); else wrap.removeAttribute('data-over');
    if (over) over.hidden = !bad;
  }
  Array.prototype.slice.call(doc.querySelectorAll('[data-embed-builder]')).forEach(function (b) {
    var form = b.closest ? b.closest('form') : null;
    if (!form) return;
    var later = function () { setTimeout(function () { check(b); }, 0); };
    form.addEventListener('input', later);
    form.addEventListener('change', later);
    later();
  });
})();
`;
