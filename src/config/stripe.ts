/**
 * Stripe Billing settings, read from the environment. Every value is optional:
 * without them Premium is hidden everywhere and the webhook answers 503.
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

import { isDiscordSkuConfigured } from "./discordSku";

/** Whether Premium is configured and should be offered to users (via Stripe or Discord SKU). */
export function premiumOffered(env: Env = process.env): boolean {
  return readStripeConfig(env) !== null || isDiscordSkuConfigured(env);
}
