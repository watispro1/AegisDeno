/**
 * Shared public copy about how Aegis Premium is sold and billed, so /premium,
 * /pricing, /refunds, /roadmap, the Terms and the Privacy Policy (and the
 * dashboard's Premium page) say the same thing.
 *
 * Owner's decision: Premium is sold only through Discord's in-app
 * subscriptions (src/config/discordSku.ts, src/services/discordEntitlements.ts).
 * It cannot be bought on the website: web (Stripe) checkout is switched off in
 * code (WEB_CHECKOUT_ENABLED in src/config/stripe.ts). Discord handles billing,
 * cancellation and refunds under Discord's terms. Stripe stays only so an
 * earlier Stripe subscriber can still manage or cancel through Stripe's portal.
 *
 * Whether Premium is on sale follows the config: it is on sale when the Discord
 * SKU and application ID are set (discordPremiumOffer()), and every surface
 * says "Coming soon on Discord" until then.
 */
import type { DiscordPremiumOffer } from "../../config/discordSku";
import { escapeHtml as esc, safeUrl } from "./shared";

export type { DiscordPremiumOffer } from "../../config/discordSku";

export const DISCORD_PAID_SERVICES_TERMS_URL = "https://discord.com/terms/paid-services-terms";
export const DISCORD_REFUND_POLICY_URL =
  "https://support.discord.com/hc/en-us/articles/360012668071-Refund-Policy";

/** The label on every web button that sends people to Discord to subscribe. */
export const SUBSCRIBE_IN_DISCORD_LABEL = "Subscribe in Discord";

/** Shown instead of any price call to action while the Discord SKU isn't configured. */
export const COMING_SOON_ON_DISCORD = "Coming soon on Discord";

/** One sentence: Premium can't be bought on the website. Plain text. */
export const NO_WEB_PURCHASE_TEXT = "Aegis Premium can't be bought on the Aegis website.";

/** Where billing stands, as plain text (no HTML). Accurate to whether the Discord SKU is configured. */
export function billingStatusText(onSale: boolean): string {
  return onSale
    ? `Aegis Premium is sold only through Discord's in-app subscriptions. Discord handles billing, cancellation and refunds under Discord's terms. ${NO_WEB_PURCHASE_TEXT}`
    : `Aegis Premium is coming soon on Discord and is not on sale yet. It will be sold only through Discord's in-app subscriptions, with billing, cancellation and refunds handled by Discord under Discord's terms. ${NO_WEB_PURCHASE_TEXT}`;
}

/** billingStatusText as HTML (escaped). */
export function billingStatusHtml(onSale: boolean): string {
  return esc(billingStatusText(onSale));
}

/** How to subscribe inside Discord. HTML, fixed text. */
export const HOW_TO_SUBSCRIBE_HTML =
  'In Discord, open Aegis\'s profile (click Aegis in the member list or on one of its messages) and choose <strong>Subscribe</strong>, or run <code class="inline">/premium</code> in your server and press <strong>Subscribe</strong>. Premium applies to the server you subscribe for, and anyone in the server can subscribe.';

/** Discord sets the price people see. Plain text. */
export const LOCAL_PRICE_TEXT =
  "Discord shows the price in your local currency and adds any tax where it applies, so the amount you see in Discord may differ slightly from the USD price.";

/**
 * How Discord bills, cancels and refunds Premium. HTML; the links are fixed
 * Discord URLs, nothing user-supplied.
 */
export const DISCORD_BILLING_HTML = `Aegis Premium is billed by Discord as an in-app subscription. Discord's own <a href="${DISCORD_PAID_SERVICES_TERMS_URL}" rel="noopener noreferrer">Paid Services Terms</a> and <a href="${DISCORD_REFUND_POLICY_URL}" rel="noopener noreferrer">Refund Policy</a> apply to it: you cancel it from the Subscriptions section of your Discord settings, and refunds are requested from Discord under Discord's policy. Aegis never sees your payment details.`;

/**
 * For anyone who subscribed through the website before Premium moved to
 * Discord. HTML. Stripe's webhook and portal stay on for them.
 */
export function earlierWebSubscriptionHtml(supportUrl: string): string {
  return `If you subscribed on the Aegis website before Premium moved to Discord, that subscription keeps working until you cancel it: whoever bought it manages or cancels it from the server's Premium page on the <a href="/dashboard">dashboard</a>, which opens Stripe's billing portal. For a refund of one of those website payments, ask in our <a href="${safeUrl(supportUrl)}" rel="noopener noreferrer">support server</a> within 14 days of the payment.`;
}

/**
 * The call to action for /premium, /pricing and the dashboard Premium page:
 * a "Subscribe in Discord" link to the SKU's page in the app's Discord store
 * plus how-to copy when the SKU is configured, else "Coming soon on Discord"
 * with no price call to action. Never a web checkout.
 */
export function discordCtaHtml(offer: DiscordPremiumOffer | null): string {
  if (!offer) {
    return `<p class="notice" data-premium-coming-soon><strong>${COMING_SOON_ON_DISCORD}.</strong> Aegis Premium will be sold only as a Discord in-app subscription and is not on sale yet. Everything Aegis does is free in the meantime.</p>
      <p class="faint">${esc(NO_WEB_PURCHASE_TEXT)}</p>`;
  }
  return `<div class="btn-row"><a class="btn" data-premium-discord href="${safeUrl(offer.storeUrl)}" rel="noopener noreferrer" target="_blank">${SUBSCRIBE_IN_DISCORD_LABEL}</a></div>
      <p class="faint">${HOW_TO_SUBSCRIBE_HTML}</p>
      <p class="faint">${esc(NO_WEB_PURCHASE_TEXT)} Discord handles billing, cancellation and refunds.</p>`;
}
