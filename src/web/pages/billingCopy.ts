/**
 * Shared public copy about how Aegis Premium is billed, so /premium, /pricing,
 * /refunds and the Terms and Privacy Policy say the same thing.
 *
 * Premium has two payment paths in the code: Stripe checkout from the
 * dashboard (src/config/stripe.ts, src/web/stripeWebhook.ts) and Discord's
 * native in-app subscriptions from /premium (src/config/discordSku.ts,
 * src/services/discordEntitlements.ts). Neither is live yet: Premium is in
 * development and not for sale. Keep that status here and on the pages as it is
 * until the owner decides otherwise.
 */

export const DISCORD_PAID_SERVICES_TERMS_URL = "https://discord.com/terms/paid-services-terms";
export const DISCORD_REFUND_POLICY_URL =
  "https://support.discord.com/hc/en-us/articles/360012668071-Refund-Policy";

/** One sentence on where billing stands. Plain text (no HTML). */
export const BILLING_STATUS_TEXT =
  "Billing is being set up through Stripe (checkout on the dashboard) and Discord's in-app subscriptions (from /premium in Discord), and is not yet available.";

/** BILLING_STATUS_TEXT with /premium marked up as code. */
export const BILLING_STATUS_HTML = BILLING_STATUS_TEXT.replace(
  "/premium",
  '<code class="inline">/premium</code>',
);

/**
 * How a Discord in-app subscription differs from a Stripe one. HTML; the links
 * are fixed Discord URLs, nothing user-supplied.
 */
export const DISCORD_BILLING_HTML = `Premium bought inside Discord as an in-app subscription is billed by Discord, not Stripe. Discord's own <a href="${DISCORD_PAID_SERVICES_TERMS_URL}" rel="noopener noreferrer">Paid Services Terms</a> and <a href="${DISCORD_REFUND_POLICY_URL}" rel="noopener noreferrer">Refund Policy</a> apply to it: you cancel it from the Subscriptions section of your Discord settings and ask Discord for any refund. The 14-day refund policy above covers payments made through Stripe on the dashboard.`;
