/**
 * Discord In-App Subscriptions (SKU) configuration.
 *
 * Configured in Discord Developer Portal -> Monetization -> SKUs.
 * Users can subscribe directly inside Discord via native in-app checkout modals.
 */

type Env = Record<string, string | undefined>;

const SNOWFLAKE = /^\d{17,20}$/;

function clean(v: string | undefined): string {
  return (v ?? "").trim();
}

/** The Discord Premium Subscription SKU ID, or null when not configured. */
export function discordSkuId(env: Env = process.env): string | null {
  const id = clean(env.DISCORD_PREMIUM_SKU_ID);
  return SNOWFLAKE.test(id) ? id : null;
}

/** Whether Discord native SKU monetization is configured. */
export function isDiscordSkuConfigured(env: Env = process.env): boolean {
  return discordSkuId(env) !== null;
}
