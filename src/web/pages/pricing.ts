/**
 * Public /pricing page: clear comparison between Free and Premium tiers,
 * limit comparison table, FAQ, and link to checkout and refund policies.
 */
import { PREMIUM_LIMITS, PREMIUM_PRICE_LABEL } from "../../config/premium";
import { SUPPORT_SERVER_INVITE } from "../layout";
import { type SiteConfig, breadcrumb, escapeHtml as esc, faqBlock, page, safeUrl } from "./shared";

export function renderPricing(cfg: SiteConfig, offered: boolean): string {
  const supportUrl = safeUrl(cfg.supportUrl || SUPPORT_SERVER_INVITE);
  const inviteUrl = safeUrl(cfg.inviteUrl);

  const limitRows = Object.values(PREMIUM_LIMITS)
    .map(l => `<tr><td>${esc(l.label)}</td><td>${l.free}</td><td><strong>${l.premium}</strong></td></tr>`)
    .join("\n          ");

  const premiumCta = offered
    ? `<div class="btn-row"><a class="btn" href="/dashboard">Upgrade on Dashboard</a><a class="btn ghost" href="/premium">Checkout details</a></div>
       <p class="faint">Pick your server on the dashboard and open <strong>Premium</strong>, or run <code class="inline">/premium</code> in your Discord server.</p>`
    : `<p class="notice"><strong>Not on sale yet.</strong> Aegis Premium isn&#39;t available on this site yet. Everything Aegis does is free in the meantime.</p>`;

  const faqs = [
    { q: "Is Aegis really free?", a: "<p>Yes. Every single moderation, automod, logging, verification, ticket, leveling, and utility command is 100% free and will always remain free. Premium only raises quantitative limits and adds a server badge.</p>" },
    { q: "How much does Premium cost?", a: `<p>Aegis Premium is <strong>${esc(PREMIUM_PRICE_LABEL)}</strong> (USD) per Discord server. It is billed monthly and you can cancel anytime.</p>` },
    { q: "Can anyone in the server buy Premium?", a: "<p>Yes. Any member of the server can subscribe to Premium on behalf of the server through the dashboard. The server enjoys the benefits, and the subscriber manages the billing.</p>" },
    { q: "Who processes payments?", a: `<p>Paddle, our merchant of record. Paddle processes the payment, charges any sales tax or VAT, sends the receipt and handles refunds. Aegis never sees or stores your payment card details. See our <a href="/terms#premium">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.</p>` },
    { q: "What is your refund policy?", a: `<p>We offer a <strong>full 14-day money-back guarantee</strong> on any payment. You can request a refund directly through Paddle at <a href="https://paddle.net" rel="noopener noreferrer">paddle.net</a> or by contacting us on our <a href="${supportUrl}" rel="noopener noreferrer">support server</a>. Full details are on our <a href="/refunds">Refund Policy page</a>.</p>` },
    { q: "What happens if I cancel Premium?", a: "<p>Your subscription remains active until the end of the paid month. After that, nothing is deleted or disabled. Existing autoresponders, shop items, or snippets keep working; you just cannot create new ones beyond the free limits until you are below the free caps.</p>" },
    { q: "Which payment methods are supported?", a: "<p>Paddle accepts major credit and debit cards (Visa, MasterCard, American Express), PayPal, Apple Pay, Google Pay, and supported regional payment methods depending on your location.</p>" },
  ];

  const body = `
<div class="wrap">
  ${breadcrumb("Pricing")}
  <div class="page-head">
    <h1>Simple, transparent pricing</h1>
    <p class="lead">Everything in Aegis is free. Upgrade your Discord server to Premium for higher caps, priority processing, and a server badge.</p>
  </div>

  <div class="pricing-grid">
    <!-- Free Tier Card -->
    <div class="pricing-card">
      <div>
        <span class="pill">Free forever</span>
        <h2 class="pricing-price">$0 <span class="pricing-period">/ month</span></h2>
        <p class="faint">Everything you need to protect and manage your Discord community.</p>
        <ul class="pricing-features">
          <li>&#10003; <strong>All moderation commands:</strong> warn, timeout, kick, ban, cases</li>
          <li>&#10003; <strong>Complete automod:</strong> links, words, spam, mentions, caps, emoji</li>
          <li>&#10003; <strong>ModMail system:</strong> threads, anonymous replies, attachments</li>
          <li>&#10003; <strong>Ticket system:</strong> private channels, transcripts, auto-close</li>
          <li>&#10003; <strong>Verification:</strong> button or math CAPTCHA join gate</li>
          <li>&#10003; <strong>Full economy &amp; leveling:</strong> shop, streaks, gamble, leaderboards</li>
          <li>&#10003; <strong>Starboard, giveaways, polls &amp; suggestions</strong></li>
          <li>&#10003; <strong>Web dashboard:</strong> OAuth2 sign-in, case management, settings</li>
          <li>&#10003; Up to <strong>50 autoresponders</strong></li>
          <li>&#10003; Up to <strong>50 economy shop items</strong></li>
          <li>&#10003; Up to <strong>50 ModMail snippets</strong></li>
          <li>&#10003; Up to <strong>25 scheduled messages</strong></li>
        </ul>
      </div>
      <div>
        <a class="btn block" href="${inviteUrl}">Add Aegis to Discord</a>
        <p class="faint center">No credit card required</p>
      </div>
    </div>

    <!-- Premium Tier Card -->
    <div class="pricing-card recommended">
      <div class="pricing-tag">✦ Recommended</div>
      <div>
        <span class="pill ok">✦ Premium</span>
        <h2 class="pricing-price">${esc(PREMIUM_PRICE_LABEL)}</h2>
        <p class="faint">For larger servers that need doubled limits and extra power.</p>
        <ul class="pricing-features">
          <li>&#10003; <strong>Everything in Free included</strong></li>
          <li>&#10003; <strong>100 Autoresponders</strong> (2&times; limit)</li>
          <li>&#10003; <strong>100 Economy shop items</strong> (2&times; limit)</li>
          <li>&#10003; <strong>100 ModMail snippets</strong> (2&times; limit)</li>
          <li>&#10003; <strong>50 Scheduled messages</strong> (2&times; limit)</li>
          <li>&#10003; <strong>50 Role panel choices</strong> (2&times; limit)</li>
          <li>&#10003; <strong>✦ Premium badge</strong> in <code class="inline">/help</code> and dashboard</li>
          <li>&#10003; <strong>Priority event &amp; webhook processing</strong></li>
          <li>&#10003; <strong>Paddle Customer Portal</strong> for self-service invoices &amp; cancellation</li>
          <li>&#10003; <strong>14-day money-back guarantee</strong></li>
          <li>&#10003; Supports Aegis&#39;s hosting, uptime &amp; development</li>
        </ul>
      </div>
      <div>
        ${premiumCta}
      </div>
    </div>
  </div>

  <section class="panel-card" aria-labelledby="limits-table-h">
    <h2 id="limits-table-h">Quantitative limit comparison</h2>
    <p>Every feature stays free. Premium only raises these server-wide capacities:</p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Feature Limit</th>
            <th scope="col">Free Tier</th>
            <th scope="col">Premium Tier</th>
          </tr>
        </thead>
        <tbody>
          ${limitRows}
          <tr>
            <td>✦ Premium badge in <code class="inline">/help</code> &amp; dashboard</td>
            <td>&mdash;</td>
            <td><strong>Yes</strong></td>
          </tr>
          <tr>
            <td>Self-service invoice &amp; payment portal</td>
            <td>&mdash;</td>
            <td><strong>Yes</strong></td>
          </tr>
          <tr>
            <td>Priority infrastructure &amp; event handling</td>
            <td>Standard</td>
            <td><strong>High Priority</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="panel-card" aria-labelledby="billing-summary-h">
    <h2 id="billing-summary-h">Billing &amp; refund policy</h2>
    <p class="refund-policy">Aegis Premium is $5 USD per month per server, billed by Paddle as merchant of record. You can cancel anytime from the dashboard Premium page; Premium stays active until the end of the paid period and is not renewed. If you're not happy, request a full refund within 14 days of any payment through Paddle (<a href="https://paddle.net" rel="noopener noreferrer">paddle.net</a>) or our <a href="${supportUrl}" rel="noopener noreferrer">support server</a>; refunds after 14 days are not given except where required by law. Paddle processes all refunds.</p>
    <p class="faint">See our dedicated <a href="/refunds">Refund Policy</a> and <a href="/terms#premium">Terms of Service</a> for full details.</p>
  </section>

  <section aria-labelledby="faq-h">
    <h2 id="faq-h">Frequently asked questions</h2>
    ${faqBlock(faqs)}
  </section>
</div>`;

  return page(cfg, {
    title: "Pricing & Plans | Aegis",
    description: `Aegis pricing: 100% free core Discord moderation bot. Premium tier is ${PREMIUM_PRICE_LABEL} per server for higher limits and a server badge.`,
    path: "/pricing",
    body,
  });
}
