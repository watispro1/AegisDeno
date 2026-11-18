/**
 * Premium wording shared by /premium, /pricing, /refunds and the Terms, so the
 * billing and refund policy reads the same everywhere. Which version shows
 * follows the PREMIUM_SALES_ENABLED switch (premiumOffered()).
 */
import { PREMIUM_DEV_BADGE } from "../../config/premium";
import { escapeHtml as esc } from "./shared";

/** The policy while Premium is for sale. */
function forSalePolicy(supportUrl: string): string {
  return `Aegis Premium is $5 USD per month per server, billed by Paddle as merchant of record. You can cancel anytime from the dashboard Premium page; Premium stays active until the end of the paid period and is not renewed. If you're not happy, request a full refund within 14 days of any payment through Paddle (<a href="https://paddle.net" rel="noopener noreferrer">paddle.net</a>) or our <a href="${supportUrl}" rel="noopener noreferrer">support server</a>; refunds after 14 days are not given except where required by law. Paddle processes all refunds.`;
}

/** The policy while sales are paused: nothing can be bought; anything already bought is still covered. */
function pausedPolicy(supportUrl: string): string {
  return `Aegis Premium is in development and not for sale yet: no new subscriptions can be started. If you already have a subscription, it is still billed by Paddle as merchant of record. You can cancel anytime from the dashboard Premium page; Premium stays active until the end of the paid period and is not renewed. If you're not happy, request a full refund within 14 days of any payment through Paddle (<a href="https://paddle.net" rel="noopener noreferrer">paddle.net</a>) or our <a href="${supportUrl}" rel="noopener noreferrer">support server</a>; refunds after 14 days are not given except where required by law. Paddle processes all refunds.`;
}

/** The billing and refund policy sentence block (HTML, no wrapper). `supportUrl` must already be safe. */
export function premiumBillingPolicy(supportUrl: string, forSale: boolean): string {
  return forSale ? forSalePolicy(supportUrl) : pausedPolicy(supportUrl);
}

/** The small "In development" badge (styled by .premium-badge). */
export function premiumDevBadge(): string {
  return `<span class="premium-badge premium-dev-badge">${esc(PREMIUM_DEV_BADGE)}</span>`;
}

/** The call-to-action replacement wherever Premium would be bought. */
export function premiumNotForSaleNotice(): string {
  return `<p class="notice" data-premium-not-for-sale>${premiumDevBadge()} <strong>Not for sale yet.</strong> Aegis Premium is in development, so it can't be bought yet. Everything Aegis does is free in the meantime.</p>`;
}
