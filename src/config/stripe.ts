/**
 * Stripe Billing settings, read from the environment. Every value is optional.
 *
 * Aegis Premium is NOT sold on the website: it is sold only through Discord's
 * in-app subscriptions (see ./discordSku). Stripe stays wired up only so any
 * existing Stripe subscriber keeps working: the webhook keeps their status in
 * sync and the buyer can still open Stripe's billing portal to manage or cancel.
 * Web checkout is switched off by WEB_CHECKOUT_ENABLED below, whatever the env.
 *
 *   STRIPE_SECRET_KEY       server-side secret key (sk_test_… or sk_live_…)
 *   STRIPE_PUBLISHABLE_KEY  publishable key for Stripe.js (pk_test_… or pk_live_…)
 *   STRIPE_PRICE_ID         the $5/month recurring price ID (price_…)
 *   STRIPE_WEBHOOK_SECRET   the webhook signing secret (whsec_…)
 */

export interface StripeConfig {
  secretKey: string;
  publishableKey: string;
  priceId: string;
  webhookSecret: string;
  isLive: boolean;
}

type Env = Record<string, string | undefined>;

const SECRET_KEY = /^sk_(test|live)_[A-Za-z0-9]+$/;
const PUBLISHABLE_KEY = /^pk_(test|live)_[A-Za-z0-9]+$/;
const PRICE_ID = /^price_[A-Za-z0-9]+$/;
const WEBHOOK_SECRET = /^whsec_[A-Za-z0-9]+$/;

function clean(v: string | undefined): string {
  return (v ?? "").trim();
}

/** The webhook secret alone: enough to accept webhooks even before checkout is set up. */
export function stripeWebhookSecret(env: Env = process.env): string | null {
  return clean(env.STRIPE_WEBHOOK_SECRET) || null;
}

/**
 * The full config when checkout can be offered, else null.
 */
export function readStripeConfig(env: Env = process.env): StripeConfig | null {
  const secretKey = clean(env.STRIPE_SECRET_KEY);
  const publishableKey = clean(env.STRIPE_PUBLISHABLE_KEY);
  const priceId = clean(env.STRIPE_PRICE_ID);
  const webhookSecret = clean(env.STRIPE_WEBHOOK_SECRET);

  if (!secretKey || !publishableKey || !priceId || !webhookSecret) return null;
  if (!SECRET_KEY.test(secretKey) || !PUBLISHABLE_KEY.test(publishableKey) || !PRICE_ID.test(priceId) || !WEBHOOK_SECRET.test(webhookSecret)) {
    return null;
  }
  const isLive = secretKey.startsWith("sk_live_");
  // Don't mix live secret key with test publishable key or vice versa
  if (publishableKey.startsWith("pk_live_") !== isLive) return null;

  return { secretKey, publishableKey, priceId, webhookSecret, isLive };
}

/** Which Stripe settings are missing or malformed, for the startup log. Never includes values. */
export function missingStripeSettings(env: Env = process.env): string[] {
  const out: string[] = [];
  const secretKey = clean(env.STRIPE_SECRET_KEY);
  const publishableKey = clean(env.STRIPE_PUBLISHABLE_KEY);
  const priceId = clean(env.STRIPE_PRICE_ID);
  const webhookSecret = clean(env.STRIPE_WEBHOOK_SECRET);

  if (!secretKey) out.push("STRIPE_SECRET_KEY (missing)");
  else if (!SECRET_KEY.test(secretKey)) out.push("STRIPE_SECRET_KEY (must start with sk_test_ or sk_live_)");

  if (!publishableKey) out.push("STRIPE_PUBLISHABLE_KEY (missing)");
  else if (!PUBLISHABLE_KEY.test(publishableKey)) out.push("STRIPE_PUBLISHABLE_KEY (must start with pk_test_ or pk_live_)");

  if (!priceId) out.push("STRIPE_PRICE_ID (missing)");
  else if (!PRICE_ID.test(priceId)) out.push("STRIPE_PRICE_ID (must start with price_)");

  if (!webhookSecret) out.push("STRIPE_WEBHOOK_SECRET (missing)");
  else if (!WEBHOOK_SECRET.test(webhookSecret)) out.push("STRIPE_WEBHOOK_SECRET (must start with whsec_)");

  return out;
}

import { discordPremiumOffer } from "./discordSku";

/**
 * Web (Stripe) checkout for Aegis Premium. Off by the owner's decision: Premium
 * is sold only as a Discord in-app subscription. This is a code constant, not
 * an environment variable, so setting every STRIPE_* secret cannot turn web
 * checkout back on: the dashboard shows no Subscribe button and loads no
 * Stripe.js, and POST /dashboard/:guildId/premium/checkout answers
 * 403 {"error":"web_checkout_disabled"}. The Stripe webhook and billing portal
 * keep working for existing Stripe subscribers.
 */
export const WEB_CHECKOUT_ENABLED: boolean = false;

/** Whether the website may start a Stripe checkout. Always false today; see WEB_CHECKOUT_ENABLED. */
export function webCheckoutEnabled(): boolean {
  return WEB_CHECKOUT_ENABLED;
}

/** Whether Premium can be bought: only through Discord, so only when the Discord SKU (and app ID) are set. */
export function premiumOffered(env: Env = process.env): boolean {
  return discordPremiumOffer(env) !== null;
}

/**
 * Whether the dashboard's Premium page exists: when Premium is sold on Discord,
 * or when Stripe is configured so an existing Stripe subscriber can still manage
 * or cancel through Stripe's billing portal.
 */
export function premiumPageAvailable(env: Env = process.env): boolean {
  return premiumOffered(env) || readStripeConfig(env) !== null;
}
