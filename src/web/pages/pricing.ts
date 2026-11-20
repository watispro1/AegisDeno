/**
 * Public /pricing page: clear comparison between Free and Premium tiers,
 * limit comparison table, FAQ, and links to the refund policy. Premium is sold
 * only as a Discord in-app subscription ("Subscribe in Discord"); there is no
 * web checkout.
 */
import { PREMIUM_LIMITS, PREMIUM_PRICE_LABEL } from "../../config/premium";
import { SUPPORT_SERVER_INVITE } from "../layout";
import { type SiteConfig, breadcrumb, escapeHtml as esc, faqBlock, page, safeUrl } from "./shared";
import {
  DISCORD_BILLING_HTML,
  HOW_TO_SUBSCRIBE_HTML,
  LOCAL_PRICE_TEXT,
  billingStatusHtml,
  discordCtaHtml,
  earlierWebSubscriptionHtml,
  type DiscordPremiumOffer,
} from "./billingCopy";

export function renderPricing(cfg: SiteConfig, offer: DiscordPremiumOffer | null): string {
  const onSale = offer !== null;
  const supportUrl = cfg.supportUrl || SUPPORT_SERVER_INVITE;
  const inviteUrl = safeUrl(cfg.inviteUrl);

  const limitRows = Object.values(PREMIUM_LIMITS)
    .map(l => `<tr><td>${esc(l.label)}</td><td>${l.free}</td><td><strong>${l.premium}</strong></td></tr>`)
    .join("\n          ");

  const premiumCta = discordCtaHtml(offer);

  const faqs = [
    { q: "Is Aegis really free?", a: "<p>Yes. Every single moderation, automod, logging, verification, ticket, leveling, and utility command is 100% free and will always remain free. Premium only raises quantitative limits and adds a server badge.</p>" },
    { q: "How much does Premium cost?", a: `<p>Aegis Premium is <strong>${esc(PREMIUM_PRICE_LABEL)}</strong> (USD) per Discord server, billed monthly by Discord; cancel anytime. ${esc(LOCAL_PRICE_TEXT)}</p>` },
    { q: "How do I subscribe?", a: `<p>${onSale ? "" : "Premium isn't on sale yet. When it is: "}${HOW_TO_SUBSCRIBE_HTML} Premium can't be bought on the Aegis website.</p>` },
    { q: "Who processes payments?", a: `<p>Discord. Premium is a Discord in-app subscription, billed by Discord under Discord's own terms. Aegis never sees or stores your payment card details. See our <a href="/terms#premium">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.</p>` },
    { q: "What is your refund policy?", a: `<p>Refunds for Discord in-app subscriptions are handled by Discord under Discord's refund policy. ${earlierWebSubscriptionHtml(supportUrl)} Full details are on our <a href="/refunds">Refund Policy page</a>.</p>` },
    { q: "What happens if I cancel Premium?", a: "<p>Your subscription remains active until the end of the paid month. After that, nothing is deleted or disabled. Existing autoresponders, shop items, or snippets keep working; you just cannot create new ones beyond the free limits until you are below the free caps.</p>" },
    { q: "Which payment methods are supported?", a: "<p>Whatever Discord accepts for in-app subscriptions in your region, using the payment methods saved in your Discord account.</p>" },
    { q: "What happens to my data when Premium ends?", a: "<p>Nothing is deleted. Your autoresponders, shop items, snippets and scheduled messages continue to work. You just cannot create new ones beyond the free tier limits until your usage drops below those limits naturally.</p>" },
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
      <div class="pricing-tag">${onSale ? "On Discord" : "Coming soon on Discord"}</div>
      <div>
        <span class="pill ok">✦ Premium</span> <span class="pill${onSale ? "" : " warn"}">${onSale ? "Subscribe in Discord" : "Coming soon on Discord"}</span>
        <h2 class="pricing-price">${esc(PREMIUM_PRICE_LABEL)}</h2>
        <p class="faint">For larger servers that need doubled limits and extra power. Sold only as a Discord in-app subscription${onSale ? "" : " (not on sale yet)"}.</p>
        <ul class="pricing-features">
          <li>&#10003; <strong>Everything in Free included</strong></li>
          <li>&#10003; <strong>100 Autoresponders</strong> (2&times; limit)</li>
          <li>&#10003; <strong>100 Economy shop items</strong> (2&times; limit)</li>
          <li>&#10003; <strong>100 ModMail snippets</strong> (2&times; limit)</li>
          <li>&#10003; <strong>50 Scheduled messages</strong> (2&times; limit)</li>
          <li>&#10003; <strong>50 Role panel choices</strong> (2&times; limit)</li>
          <li>&#10003; <strong>✦ Premium badge</strong> in <code class="inline">/help</code> and dashboard</li>
          <li>&#10003; <strong>Priority event &amp; webhook processing</strong></li>
          <li>&#10003; <strong>Billed by Discord:</strong> manage or cancel from your Discord settings</li>
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
    <p class="billing-status">${billingStatusHtml(onSale)}</p>
    <p>${DISCORD_BILLING_HTML}</p>
    <p class="faint">${earlierWebSubscriptionHtml(supportUrl)}</p>
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
