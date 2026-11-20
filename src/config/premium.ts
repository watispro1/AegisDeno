/**
 * Aegis Premium: what it costs and what it changes. The one place to edit the
 * offer. Everything Aegis does for free stays free; Premium only raises caps
 * that already exist and adds a badge.
 *
 * A server that lapses keeps everything it already made (nothing is deleted or
 * switched off); it just can't add more past the free cap until it is under it.
 */

/** Shown on the dashboard, the public /premium page and /premium. Must match the Stripe price. */
export const PREMIUM_PRICE_LABEL = "$5 / month";

/** Days a server keeps Premium after a renewal payment fails (Stripe status past_due). */
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
