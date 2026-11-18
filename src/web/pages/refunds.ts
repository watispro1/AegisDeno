/**
 * Dedicated /refunds page: complete Refund and Cancellation Policy for Aegis Premium.
 * Covers the 14-day refund guarantee, cancellation steps, Paddle merchant of record
 * processing, and post-cancellation status.
 */
import { SUPPORT_SERVER_INVITE } from "../layout";
import { type SiteConfig, breadcrumb, escapeHtml as esc, page, safeUrl } from "./shared";
import { LEGAL_LAST_UPDATED } from "./legal";
import { premiumBillingPolicy, premiumNotForSaleNotice } from "./premiumCopy";

/** `premiumForSale` is premiumOffered(); while it is false the policy says sales are paused. */
export function renderRefunds(cfg: SiteConfig, premiumForSale = false): string {
  const supportUrl = safeUrl(cfg.supportUrl || SUPPORT_SERVER_INVITE);
  const email = cfg.contactEmail ? `<a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>` : "";

  const body = `
<div class="wrap">
  ${breadcrumb("Refund Policy")}
  <div class="page-head">
    <h1>Refund and Cancellation Policy</h1>
    <p class="lead">Everything you need to know about refunds, cancelling subscriptions, and billing for Aegis Premium.</p>
    <p class="faint">Last updated: ${esc(LEGAL_LAST_UPDATED)}</p>
  </div>

  <section class="panel-card" aria-labelledby="policy-summary-h">
    <h2 id="policy-summary-h">Policy summary</h2>
    ${premiumForSale ? "" : premiumNotForSaleNotice()}
    <p class="refund-policy">${premiumBillingPolicy(supportUrl, premiumForSale)}</p>
  </section>

  <section class="panel-card" aria-labelledby="refund-guarantee-h">
    <h2 id="refund-guarantee-h">1. 14-Day Money-Back Guarantee</h2>
    <p>We want you to be completely satisfied with Aegis Premium. If for any reason Aegis Premium does not meet your expectations, you are entitled to a <strong>full refund within 14 days</strong> of your initial purchase or any renewal payment date.</p>
    <ul>
      <li><strong>Standard period:</strong> 14 calendar days from the moment of payment.</li>
      <li><strong>No questions asked:</strong> Full refund provided for any request submitted within the 14-day window.</li>
      <li><strong>After 14 days:</strong> Payments become non-refundable once the 14-day window has elapsed, except where required by applicable consumer protection laws in your jurisdiction (such as EU/UK statutory consumer regulations).</li>
    </ul>
  </section>

  <section class="panel-card" aria-labelledby="request-refund-h">
    <h2 id="request-refund-h">2. How to Request a Refund</h2>
    <p>You can request a refund using either of the following methods:</p>
    <div class="refund-grid">
      <div class="refund-card">
        <h3>Option A: Via Paddle (Fastest)</h3>
        <p>Paddle is our Merchant of Record and handles payment and refund processing directly. Visit Paddle&#39;s buyer support portal:</p>
        <p><a class="btn sm" href="https://paddle.net" rel="noopener noreferrer" target="_blank">Visit paddle.net &rarr;</a></p>
        <p class="faint">You will need either your email address or the transaction ID found in your receipt email.</p>
      </div>
      <div class="refund-card">
        <h3>Option B: Via Our Support Server</h3>
        <p>Join our Discord support server and open a billing support ticket with our team:</p>
        <p><a class="btn ghost sm" href="${supportUrl}" rel="noopener noreferrer" target="_blank">Join Support Server &rarr;</a></p>
        <p class="faint">Provide your Discord User ID, Server ID, and transaction date. Our staff will initiate the refund via Paddle on your behalf.</p>
      </div>
    </div>
  </section>

  <section class="panel-card" aria-labelledby="cancel-policy-h">
    <h2 id="cancel-policy-h">3. Cancellation Policy</h2>
    <p>You may cancel your Aegis Premium subscription at any time without penalty or cancellation fees.</p>
    <h3>How to cancel:</h3>
    <ol>
      <li>Log in to the Aegis dashboard at <a href="/dashboard">/dashboard</a>.</li>
      <li>Select the Discord server that holds the Premium subscription.</li>
      <li>Navigate to <strong>Premium</strong> in the sidebar (or run <code class="inline">/premium</code> inside your Discord server).</li>
      <li>Click <strong>Cancel subscription</strong> to open Paddle&#39;s self-service customer portal.</li>
      <li>Confirm cancellation. Your subscription will not renew at the end of the current billing cycle.</li>
    </ol>
    <p><strong>Access remains active:</strong> When you cancel, Premium features and benefits remain active on your server until the end of the paid billing period. You will not be billed again.</p>
  </section>

  <section class="panel-card" aria-labelledby="what-happens-h">
    <h2 id="what-happens-h">4. What Happens When Premium Ends (No Data Loss)</h2>
    <p>We believe in treating your server and its members with respect. When Premium ends or lapses:</p>
    <ul>
      <li><strong>Nothing is deleted:</strong> We never delete or deactivate any autoresponders, economy shop items, modmail snippets, or custom configurations you set up during your subscription.</li>
      <li><strong>Everything created keeps working:</strong> All existing items remain operational.</li>
      <li><strong>Free caps apply to new additions:</strong> You simply cannot add new items beyond the free tier limits until your server&#39;s total count is under the free limit.</li>
    </ul>
  </section>

  <section class="panel-card" aria-labelledby="merchant-record-h">
    <h2 id="merchant-record-h">5. Merchant of Record &amp; Security</h2>
    <p>All payments for Aegis Premium are processed by <strong>Paddle.com Market Ltd</strong> (Paddle), acting as Merchant of Record. Paddle is responsible for:</p>
    <ul>
      <li>Secure payment transactions complying with PCI-DSS Level 1 standards.</li>
      <li>Calculating, collecting, and remitting appropriate sales tax, VAT, and GST worldwide.</li>
      <li>Delivering purchase receipts, VAT invoices, and renewal notifications.</li>
      <li>Processing authorized refunds back to your original payment method.</li>
    </ul>
    <p class="faint">Aegis never stores, transmits, or has access to your full credit card number, security code, or banking details.</p>
  </section>

  <section class="panel-card" aria-labelledby="contact-h">
    <h2 id="contact-h">6. Need Help or Have Billing Questions?</h2>
    <p>If you have questions about a charge or need assistance with your subscription, please contact us before initiating a bank dispute or chargeback:</p>
    <ul>
      <li><strong>Discord Support Server:</strong> <a href="${supportUrl}" rel="noopener noreferrer">${supportUrl}</a></li>
      <li><strong>Paddle Support:</strong> <a href="https://paddle.net" rel="noopener noreferrer">paddle.net</a></li>
      ${email ? `<li><strong>Direct Email:</strong> ${email}</li>` : ""}
      <li><strong>Terms of Service:</strong> <a href="/terms#premium">Aegis Terms of Service</a></li>
      <li><strong>Pricing Overview:</strong> <a href="/pricing">Aegis Pricing &amp; Plans</a></li>
    </ul>
  </section>
</div>`;

  return page(cfg, {
    title: "Refund and Cancellation Policy | Aegis",
    description: "Aegis Premium refund and cancellation policy: full 14-day refund window, cancel anytime, processed by Paddle as merchant of record.",
    path: "/refunds",
    body,
  });
}
