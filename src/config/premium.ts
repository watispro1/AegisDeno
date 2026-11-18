/**
 * Aegis Premium: what it costs and what it changes. The one place to edit the
 * offer. Everything Aegis does for free stays free; Premium only raises caps
 * that already exist and adds a badge.
 *
 * A server that lapses keeps everything it already made (nothing is deleted or
 * switched off); it just can't add more past the free cap until it is under it.
 */

/**
 * The price, shown only while Premium is for sale (see premiumSalesEnabled). Must
 * match the Paddle price. While sales are paused nothing advertises it.
 */
export const PREMIUM_PRICE_LABEL = "$5 / month";

type Env = Record<string, string | undefined>;

/**
 * The single switch for selling Premium: PREMIUM_SALES_ENABLED=true (or 1, yes,
 * on). Off by default, so Premium is "in development, not for sale yet": no new
 * checkout can start anywhere. Existing subscriptions keep working either way
 * (the webhook, entitlements, the badge and the billing portal are not gated).
 */
export function premiumSalesEnabled(env: Env = process.env): boolean {
  return /^(1|true|yes|on)$/i.test((env.PREMIUM_SALES_ENABLED ?? "").trim());
}

/** The badge shown next to Premium wherever it appears while sales are paused. */
export const PREMIUM_DEV_BADGE = "In development";

/** One line for every place that would otherwise offer Premium for sale. */
export const PREMIUM_NOT_FOR_SALE = "Aegis Premium is in development and not for sale yet. Everything Aegis does stays free.";

/** Days a server keeps Premium after a renewal payment fails (Paddle status past_due). */
export const PREMIUM_GRACE_DAYS = 3;

/** How long isPremium() trusts a cached answer, in milliseconds. */
export const PREMIUM_CACHE_MS = 60_000;

/** Caps Premium raises. `free` is today's cap and must never go down. */
export const PREMIUM_LIMITS = {
  autoresponders: { free: 50, premium: 100, label: "Autoresponders" },
  shopItems: { free: 50, premium: 100, label: "Economy shop items" },
  modmailSnippets: { free: 50, premium: 100, label: "ModMail snippets" },
  scheduledMessages: { free: 25, premium: 50, label: "Scheduled automation messages" },
  rolePanelChoices: { free: 25, premium: 50, label: "Role panel choices" },
} as const;

export type PremiumLimitKey = keyof typeof PREMIUM_LIMITS;

/** The cap for one limit, given whether the server has Premium. */
export function limitValue(key: PremiumLimitKey, premium: boolean): number {
  const l = PREMIUM_LIMITS[key];
  return premium ? l.premium : l.free;
}

/** The largest cap any server can have, for queries that list existing rows. */
export function maxLimitValue(key: PremiumLimitKey): number {
  const l = PREMIUM_LIMITS[key];
  return Math.max(l.free, l.premium);
}

/** One line per benefit, for the dashboard, the public page and /premium. */
export function premiumBenefitLines(): string[] {
  const caps = Object.values(PREMIUM_LIMITS).map(l => `${l.label}: ${l.premium} instead of ${l.free}`);
  return [
    ...caps,
    "A Premium badge for your server in /help and on the dashboard",
    "Priority webhook & notification delivery",
    "Customer portal for one-click invoice management and self-service cancellation",
    "Supports Aegis's hosting, high-availability infrastructure, and development",
  ];
}

/** Shown wherever the badge appears. */
export const PREMIUM_BADGE = "✦ Premium";
