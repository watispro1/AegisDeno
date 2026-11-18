/**
 * Paddle Billing settings, read from the environment. Every value is optional:
 * without them nothing can be bought and the webhook answers 503. Selling also
 * needs PREMIUM_SALES_ENABLED (src/config/premium.ts), which is off by default.
 *
 *   PADDLE_ENV             sandbox | production (default sandbox)
 *   PADDLE_CLIENT_TOKEN    client-side token for Paddle.js (test_… or live_…)
 *   PADDLE_PRICE_ID        the $5/month price (pri_…)
 *   PADDLE_API_KEY         server-side API key, for customer portal sessions
 *   PADDLE_WEBHOOK_SECRET  the notification destination's secret key (pdl_ntfset_…)
 */

import { premiumSalesEnabled } from "./premium";

export type PaddleEnvironment = "sandbox" | "production";

export interface PaddleConfig {
  environment: PaddleEnvironment;
  clientToken: string;
  priceId: string;
  apiKey: string;
  webhookSecret: string;
}

type Env = Record<string, string | undefined>;

const PRICE_ID = /^pri_[a-z\d]{26}$/;
const CLIENT_TOKEN = /^(test|live)_[A-Za-z\d]{10,64}$/;

function clean(v: string | undefined): string {
  return (v ?? "").trim();
}

export function paddleEnvironment(env: Env = process.env): PaddleEnvironment {
  return clean(env.PADDLE_ENV).toLowerCase() === "production" ? "production" : "sandbox";
}

/** The webhook secret alone: enough to accept webhooks even before checkout is set up. */
export function paddleWebhookSecret(env: Env = process.env): string | null {
  return clean(env.PADDLE_WEBHOOK_SECRET) || null;
}

/**
 * The full config when checkout can be offered, else null. A client token whose
 * prefix does not match PADDLE_ENV (test_ is sandbox, live_ is production) counts
 * as missing, since Paddle.js would refuse it anyway.
 */
export function readPaddleConfig(env: Env = process.env): PaddleConfig | null {
  const environment = paddleEnvironment(env);
  const clientToken = clean(env.PADDLE_CLIENT_TOKEN);
  const priceId = clean(env.PADDLE_PRICE_ID);
  const apiKey = clean(env.PADDLE_API_KEY);
  const webhookSecret = clean(env.PADDLE_WEBHOOK_SECRET);
  if (!clientToken || !priceId || !apiKey || !webhookSecret) return null;
  if (!CLIENT_TOKEN.test(clientToken) || !PRICE_ID.test(priceId)) return null;
  if (clientToken.startsWith("test_") !== (environment === "sandbox")) return null;
  return { environment, clientToken, priceId, apiKey, webhookSecret };
}

/** Which Paddle settings are missing or malformed, for the startup log. Never includes values. */
export function missingPaddleSettings(env: Env = process.env): string[] {
  const out: string[] = [];
  const token = clean(env.PADDLE_CLIENT_TOKEN);
  if (!token || !CLIENT_TOKEN.test(token)) out.push("PADDLE_CLIENT_TOKEN");
  else if (token.startsWith("test_") !== (paddleEnvironment(env) === "sandbox")) out.push("PADDLE_CLIENT_TOKEN (does not match PADDLE_ENV)");
  if (!PRICE_ID.test(clean(env.PADDLE_PRICE_ID))) out.push("PADDLE_PRICE_ID");
  if (!clean(env.PADDLE_API_KEY)) out.push("PADDLE_API_KEY");
  if (!clean(env.PADDLE_WEBHOOK_SECRET)) out.push("PADDLE_WEBHOOK_SECRET");
  return out;
}

/**
 * Whether a new Premium purchase can start: sales switched on
 * (PREMIUM_SALES_ENABLED) and Paddle fully configured. Every buy button, the
 * checkout endpoint and every "how to buy" line follow this.
 */
export function premiumOffered(env: Env = process.env): boolean {
  return premiumSalesEnabled(env) && readPaddleConfig(env) !== null;
}

/** The Paddle settings a checkout may use, or null while Premium is not for sale. */
export function premiumCheckoutConfig(env: Env = process.env): PaddleConfig | null {
  return premiumSalesEnabled(env) ? readPaddleConfig(env) : null;
}

/**
 * Whether Premium is shown at all (dashboard nav and page): while sales are
 * paused it is shown as "in development"; once they are on it needs Paddle.
 */
export function premiumVisible(env: Env = process.env): boolean {
  return !premiumSalesEnabled(env) || readPaddleConfig(env) !== null;
}

export function paddleApiBase(environment: PaddleEnvironment): string {
  return environment === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
}
