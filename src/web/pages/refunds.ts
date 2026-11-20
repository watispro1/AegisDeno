/**
 * Dedicated /refunds page: Refund and Cancellation Policy for Aegis Premium.
 * Premium is sold only as a Discord in-app subscription, so Discord handles
 * billing, cancellation and refunds under Discord's terms. A short section
 * covers subscriptions bought earlier on the website (Stripe).
 */
import { SUPPORT_SERVER_INVITE } from "../layout";
import { type SiteConfig, breadcrumb, escapeHtml as esc, page, safeUrl } from "./shared";
import { LEGAL_LAST_UPDATED } from "./legal";
import {
  DISCORD_BILLING_HTML,
  DISCORD_REFUND_POLICY_URL,
  DISCORD_PAID_SERVICES_TERMS_URL,
  billingStatusHtml,
  earlierWebSubscriptionHtml,
  type DiscordPremiumOffer,
} from "./billingCopy";

export function renderRefunds(cfg: SiteConfig, offer: DiscordPremiumOffer | null = null): string {
  const onSale = offer !== null;
  const supportUrl = safeUrl(cfg.supportUrl || SUPPORT_SERVER_INVITE);
  const email = cfg.contactEmail ? `<a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>` : "";

  const body = `
<div class="wrap">
  ${breadcrumb("Refund Policy")}
  <div class="page-head">
    <h1>Refund and Cancellation Policy</h1>
    <p class="lead">How refunds, cancelling and billing work for Aegis Premium.</p>
    <p class="faint">Last updated: ${esc(LEGAL_LAST_UPDATED)}</p>
  </div>

  <section class="panel-card" aria-labelledby="policy-summary-h">
    <h2 id="policy-summary-h">Policy summary</h2>
    <p class="billing-status">${billingStatusHtml(onSale)}</p>
    <p>${DISCORD_BILLING_HTML}</p>
    ${onSale ? "" : `<p class="notice"><strong>Coming soon on Discord.</strong> Aegis Premium is not on sale yet. This policy applies once it is.</p>`}
  </section>

  <section class="panel-card" aria-labelledby="refund-guarantee-h">
    <h2 id="refund-guarantee-h">1. Refunds</h2>
    <p>Aegis Premium is a Discord in-app subscription, so Discord takes the payment and decides refunds under its own <a href="${DISCORD_REFUND_POLICY_URL}" rel="noopener noreferrer">Refund Policy</a> and <a href="${DISCORD_PAID_SERVICES_TERMS_URL}" rel="noopener noreferrer">Paid Services Terms</a>. Request a refund from Discord (Discord's support site or the Subscriptions section of your Discord settings). Aegis cannot issue or reverse refunds for Discord purchases.</p>
    <p>Your rights under consumer protection laws where you live (such as EU/UK statutory rights) are not affected.</p>
  </section>

  <section class="panel-card" aria-labelledby="cancel-policy-h">
    <h2 id="cancel-policy-h">2. Cancellation Policy</h2>
    <p>You may cancel your Aegis Premium subscription at any time without penalty or cancellation fees.</p>
    <h3>How to cancel:</h3>
    <ol>
      <li>In Discord, open <strong>User Settings</strong>.</li>
      <li>Go to <strong>Subscriptions</strong> and find Aegis Premium for your server.</li>
      <li>Cancel it there. It will not renew at the end of the current billing period.</li>
    </ol>
    <p><strong>Access remains active:</strong> When you cancel, Premium stays on for your server until the end of the paid billing period. You will not be billed again.</p>
  </section>

  <section class="panel-card" aria-labelledby="what-happens-h">
    <h2 id="what-happens-h">3. What Happens When Premium Ends (No Data Loss)</h2>
    <p>We believe in treating your server and its members with respect. When Premium ends or lapses:</p>
    <ul>
      <li><strong>Nothing is deleted:</strong> We never delete or deactivate any autoresponders, economy shop items, modmail snippets, or custom configurations you set up during your subscription.</li>
      <li><strong>Everything created keeps working:</strong> All existing items remain operational.</li>
      <li><strong>Free caps apply to new additions:</strong> You simply cannot add new items beyond the free tier limits until your server&#39;s total count is under the free limit.</li>
    </ul>
  </section>

  <section class="panel-card" aria-labelledby="merchant-record-h">
    <h2 id="merchant-record-h">4. Payment Processing</h2>
    <p>Discord processes and bills Aegis Premium under Discord&#39;s own terms, including any sales tax or VAT, receipts and renewal notices. Aegis Premium can&#39;t be bought on the Aegis website.</p>
    <p class="faint">Aegis never stores, transmits, or has access to your card number, security code, or banking details.</p>
  </section>

  <section class="panel-card" aria-labelledby="earlier-web-h">
    <h2 id="earlier-web-h">5. Subscriptions bought earlier on the website</h2>
    <p>${earlierWebSubscriptionHtml(cfg.supportUrl || SUPPORT_SERVER_INVITE)} Those payments were processed by Stripe, Inc., and refunds of them go back to the original payment method through Stripe.</p>
  </section>

  <section class="panel-card" aria-labelledby="contact-h">
    <h2 id="contact-h">6. Need Help or Have Billing Questions?</h2>
    <p>For a charge or refund on a Discord subscription, contact Discord. For anything about Aegis itself, or a subscription bought earlier on the website, contact us:</p>
    <ul>
      <li><strong>Discord Support Server:</strong> <a href="${supportUrl}" rel="noopener noreferrer">${supportUrl}</a></li>
      ${email ? `<li><strong>Direct Email:</strong> ${email}</li>` : ""}
      <li><strong>Terms of Service:</strong> <a href="/terms#premium">Aegis Terms of Service</a></li>
      <li><strong>Pricing Overview:</strong> <a href="/pricing">Aegis Pricing &amp; Plans</a></li>
    </ul>
  </section>
</div>`;

  return page(cfg, {
    title: "Refund and Cancellation Policy | Aegis",
    description: "Aegis Premium refund and cancellation policy: Premium is a Discord in-app subscription, so Discord handles billing, cancellation and refunds under Discord's terms.",
    path: "/refunds",
    body,
  });
}
