/**
 * Public /premium page: the price, what Aegis Premium adds (from
 * src/config/premium.ts), what stays free, and how to buy it. Shown even before
 * Stripe is configured; until then the call to action says it is not on sale yet.
 */
import { PREMIUM_GRACE_DAYS, PREMIUM_LIMITS, PREMIUM_PRICE_LABEL } from "../../config/premium";
import { SUPPORT_SERVER_INVITE } from "../layout";
import { type SiteConfig, breadcrumb, escapeHtml as esc, faqBlock, page, safeUrl } from "./shared";

export function renderPremium(cfg: SiteConfig, offered: boolean): string {
  const rows = Object.values(PREMIUM_LIMITS)
    .map(l => `<tr><td>${esc(l.label)}</td><td>${l.free}</td><td><strong>${l.premium}</strong></td></tr>`)
    .join("\n          ");
  const cta = offered
    ? `<div class="btn-row"><a class="btn" href="/dashboard">Open the dashboard</a><a class="btn ghost" href="/terms#premium">Billing terms</a></div>
      <p class="faint">In the dashboard, pick your server and open <strong>Premium</strong>, or run <code class="inline">/premium</code> in the server for a direct link. Any member of the server can buy it.</p>`
    : `<p class="notice"><strong>Not on sale yet.</strong> The $5/month Premium subscription is currently in development and not for sale. Everything Aegis does is free in the meantime.</p>`;
  const supportUrl = safeUrl(cfg.supportUrl || SUPPORT_SERVER_INVITE);
  const faqs = [
    { q: "Is anything free being moved behind Premium?", a: "<p>No. Every command and feature stays free. Premium only raises a few limits that already exist and adds a badge.</p>" },
    { q: "Who can buy it?", a: "<p>Anyone in the server, from the server's Premium page on the dashboard. It applies to that one server.</p>" },
    { q: "Who handles the payment?", a: `<p>Stripe processes the payment, charges any sales tax or VAT, sends the receipt and handles billing portal sessions and refunds. Aegis never sees your card or email; it stores only Stripe's subscription ID and its status. See the <a href="/terms#premium">terms</a> and <a href="/privacy#sharing">privacy policy</a>.</p>` },
    { q: "How do I cancel?", a: "<p>Whoever bought it opens the server's Premium page on the dashboard and chooses <strong>Cancel subscription</strong>, which opens Stripe's customer portal. Premium stays active until the end of the paid period and is not renewed.</p>" },
    { q: "Can I get a refund?", a: `<p>Yes, within 14 days of any payment. Request a full refund through our <a href="${supportUrl}" rel="noopener noreferrer">support server</a>. Refunds after 14 days are not given except where required by law. All refunds are processed securely via Stripe.</p>` },
    { q: "What if a payment fails?", a: `<p>Premium stays on for ${PREMIUM_GRACE_DAYS} days while Stripe retries the payment.</p>` },
    { q: "What happens when Premium ends?", a: "<p>Nothing is deleted or switched off. The server just can't add more autoresponders, shop items or snippets past the free limits until it is back under them.</p>" },
  ];
  const body = `
<div class="wrap">
  ${breadcrumb("Premium")}
  <div class="page-head">
    <h1>Aegis Premium</h1>
    <p class="lead">An upcoming ${esc(PREMIUM_PRICE_LABEL)} subscription for one server (currently in development and not for sale). It raises a few limits and adds a badge. Everything else in Aegis is, and stays, free.</p>
  </div>
  <section class="panel-card premium-price" aria-labelledby="price-h">
    <h2 id="price-h">${esc(PREMIUM_PRICE_LABEL)} per server</h2>
    <p>Billed monthly via Stripe. Cancel any time; it runs to the end of the paid month.</p>
  </section>
  <section aria-labelledby="refunds-h">
    <h2 id="refunds-h">Billing, cancelling and refunds</h2>
    <p class="refund-policy">Aegis Premium is $5 USD per month per server, billed monthly via Stripe. You can cancel anytime from the dashboard Premium page; Premium stays active until the end of the paid period and is not renewed. If you're not happy, request a full refund within 14 days of any payment through our <a href="${supportUrl}" rel="noopener noreferrer">support server</a>; refunds after 14 days are not given except where required by law. All refunds are processed securely via Stripe.</p>
    <p class="faint">Full details are in our <a href="/refunds">refund policy</a>, <a href="/pricing">pricing overview</a>, and <a href="/terms#premium">terms</a>.</p>
    ${cta}
  </section>
  <section aria-labelledby="adds-h">
    <h2 id="adds-h">What Premium adds</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Limit</th><th>Free</th><th>Premium</th></tr></thead>
        <tbody>
          ${rows}
          <tr><td>Premium badge in <code class="inline">/help</code> and on the dashboard</td><td>—</td><td><strong>Yes</strong></td></tr>
        </tbody>
      </table>
    </div>
    <p class="faint">It also helps pay for Aegis's hosting and development.</p>
  </section>
  <section aria-labelledby="faq-h">
    <h2 id="faq-h">Questions</h2>
    ${faqBlock(faqs)}
  </section>
</div>`;
  return page(cfg, {
    title: "Aegis Premium | Aegis",
    description: `Aegis Premium: ${PREMIUM_PRICE_LABEL} per Discord server. Higher limits and a badge; every feature stays free.`,
    path: "/premium",
    body,
  });
}
