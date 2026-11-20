/**
 * Public /premium page: the price, what Aegis Premium adds (from
 * src/config/premium.ts), what stays free, and how to subscribe. Premium is
 * sold only as a Discord in-app subscription: the call to action is
 * "Subscribe in Discord" when the Discord SKU is configured, else
 * "Coming soon on Discord". There is no web checkout. Billing wording is shared
 * with the other pages through ./billingCopy.
 */
import { PREMIUM_GRACE_DAYS, PREMIUM_LIMITS, PREMIUM_PRICE_LABEL } from "../../config/premium";
import { SUPPORT_SERVER_INVITE } from "../layout";
import { type SiteConfig, breadcrumb, escapeHtml as esc, faqBlock, page } from "./shared";
import {
  DISCORD_BILLING_HTML,
  HOW_TO_SUBSCRIBE_HTML,
  LOCAL_PRICE_TEXT,
  billingStatusHtml,
  discordCtaHtml,
  earlierWebSubscriptionHtml,
  type DiscordPremiumOffer,
} from "./billingCopy";

export function renderPremium(cfg: SiteConfig, offer: DiscordPremiumOffer | null): string {
  const onSale = offer !== null;
  const rows = Object.values(PREMIUM_LIMITS)
    .map(l => `<tr><td>${esc(l.label)}</td><td>${l.free}</td><td><strong>${l.premium}</strong></td></tr>`)
    .join("\n          ");
  const cta = discordCtaHtml(offer);
  const supportUrl = cfg.supportUrl || SUPPORT_SERVER_INVITE;
  const faqs = [
    { q: "Is anything free being moved behind Premium?", a: "<p>No. Every command and feature stays free. Premium only raises a few limits that already exist and adds a badge.</p>" },
    { q: "How do I subscribe?", a: `<p>${onSale ? "" : "Premium isn't on sale yet. When it is: "}${HOW_TO_SUBSCRIBE_HTML} It can't be bought on the Aegis website.</p>` },
    { q: "Who handles the payment?", a: `<p>Discord. Premium is a Discord in-app subscription, so Discord takes the payment, charges any tax, and handles renewals, cancellation and refunds under Discord's terms. Aegis never sees your card or email; it stores only Discord's entitlement ID and its status. See the <a href="/terms#premium">terms</a> and <a href="/privacy#sharing">privacy policy</a>.</p>` },
    { q: "How do I cancel?", a: "<p>Cancel from the Subscriptions section of your Discord settings. Premium stays active until the end of the paid period and is not renewed.</p>" },
    { q: "Can I get a refund?", a: `<p>Refunds are handled by Discord under Discord's refund policy; request them from Discord. ${earlierWebSubscriptionHtml(supportUrl)}</p>` },
    { q: "What if a payment fails?", a: `<p>Discord handles failed payments for an in-app subscription under its own terms. For a subscription bought earlier on the website, Premium stays on for ${PREMIUM_GRACE_DAYS} days while Stripe retries it.</p>` },
    { q: "What happens when Premium ends?", a: "<p>Nothing is deleted or switched off. The server just can't add more autoresponders, shop items or snippets past the free limits until it is back under them.</p>" },
  ];
  const body = `
<div class="wrap">
  ${breadcrumb("Premium")}
  <div class="page-head">
    <h1>Aegis Premium</h1>
    <p class="lead">${onSale ? "A" : "An upcoming"} ${esc(PREMIUM_PRICE_LABEL)} subscription for one server, sold only through Discord${onSale ? "" : " (coming soon, not on sale yet)"}. It raises a few limits and adds a badge. Everything else in Aegis is, and stays, free.</p>
  </div>
  <section class="panel-card premium-price" aria-labelledby="price-h">
    <h2 id="price-h">${esc(PREMIUM_PRICE_LABEL)} per server</h2>
    <p>A monthly Discord in-app subscription. Cancel any time in Discord; it runs to the end of the paid month. ${esc(LOCAL_PRICE_TEXT)}</p>
    ${cta}
  </section>
  <section aria-labelledby="refunds-h">
    <h2 id="refunds-h">Billing, cancelling and refunds</h2>
    <p class="billing-status">${billingStatusHtml(onSale)}</p>
    <p>${DISCORD_BILLING_HTML}</p>
    <p class="faint">${earlierWebSubscriptionHtml(supportUrl)}</p>
    <p class="faint">Full details are in our <a href="/refunds">refund policy</a>, <a href="/pricing">pricing overview</a>, and <a href="/terms#premium">terms</a>.</p>
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
