/**
 * Discord In-App Subscriptions (SKU) configuration.
 *
 * Aegis Premium is sold only through Discord's in-app subscriptions. The SKU
 * is created in the Discord Developer Portal -> Monetization -> SKUs and set
 * as DISCORD_PREMIUM_SKU_ID. Only an entitlement to that SKU grants Premium.
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

/** The bot's application ID (DISCORD_APPLICATION_ID), or null when it is not a valid snowflake. */
export function discordApplicationId(env: Env = process.env): string | null {
  const id = clean(env.DISCORD_APPLICATION_ID);
  return SNOWFLAKE.test(id) ? id : null;
}

/**
 * The app's store page in Discord's App Directory, deep-linked to the Premium
 * SKU when it is set: https://discord.com/application-directory/{APP_ID}/store/{SKU_ID}.
 * Null without a valid application ID.
 */
export function discordStoreUrl(env: Env = process.env): string | null {
  const appId = discordApplicationId(env);
  if (!appId) return null;
  const sku = discordSkuId(env);
  return `https://discord.com/application-directory/${appId}/store${sku ? `/${sku}` : ""}`;
}

/** Premium as sold on Discord: where to send people to subscribe. */
export interface DiscordPremiumOffer {
  /** The SKU's page in the app's Discord store. */
  storeUrl: string;
  skuId: string;
}

/**
 * The Discord offer when Premium can be bought (the SKU and the application ID
 * are both set), else null and every surface says "Coming soon on Discord".
 */
export function discordPremiumOffer(env: Env = process.env): DiscordPremiumOffer | null {
  const skuId = discordSkuId(env);
  const storeUrl = discordStoreUrl(env);
  if (!skuId || !storeUrl) return null;
  return { storeUrl, skuId };
}
