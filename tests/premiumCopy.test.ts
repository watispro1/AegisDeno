import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  renderDocs,
  renderFeatures,
  renderPremium,
  renderPricing,
  renderPrivacy,
  renderRefunds,
  renderRoadmap,
  renderSecurity,
  renderTerms,
  renderTroubleshooting,
  renderWhy,
  type SiteConfig,
} from "../src/web/pages";
import {
  COMING_SOON_ON_DISCORD,
  NO_WEB_PURCHASE_TEXT,
  SUBSCRIBE_IN_DISCORD_LABEL,
  billingStatusText,
} from "../src/web/pages/billingCopy";
import type { DiscordPremiumOffer } from "../src/config/discordSku";

const root = join(__dirname, "..");
const site: SiteConfig = {
  inviteUrl: "#",
  supportUrl: "",
  version: "test",
  contactEmail: "",
  assetVersion: "t",
};
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
const SKU = "123456789012345678";
const APP_ID = "223456789012345678";
const STORE_URL = `https://discord.com/application-directory/${APP_ID}/store/${SKU}`;
const offer: DiscordPremiumOffer = { storeUrl: STORE_URL, skuId: SKU };

// Billing moved from Paddle to Stripe and Discord in-app subscriptions (bot 3.15.0),
// then to Discord in-app subscriptions only (web checkout disabled). The changelog
// pages are a historical record and may still name Paddle, so they are not checked here.
const rendered: Record<string, string> = {
  "/premium (offered)": renderPremium(site, offer),
  "/premium (not offered)": renderPremium(site, null),
  "/pricing (offered)": renderPricing(site, offer),
  "/pricing (not offered)": renderPricing(site, null),
  "/refunds (offered)": renderRefunds(site, offer),
  "/refunds": renderRefunds(site),
  "/terms (offered)": renderTerms(site, offer),
  "/terms": renderTerms(site),
  "/privacy (offered)": renderPrivacy(site, offer),
  "/privacy": renderPrivacy(site),
  "/security": renderSecurity(site),
  "/roadmap": renderRoadmap(site),
  "/roadmap (offered)": renderRoadmap(site, true),
  "/docs": renderDocs(site),
  "/features": renderFeatures(site),
  "/why": renderWhy(site),
  "/troubleshooting": renderTroubleshooting(site),
};

test("no public page mentions Paddle", () => {
  for (const [path, html] of Object.entries(rendered)) {
    assert.doesNotMatch(html, /paddle/i, `${path} mentions Paddle`);
  }
});

test("no page source, README, DEPLOYMENT.md or .env.example mentions Paddle", () => {
  const pagesDir = join(root, "src", "web", "pages");
  const files = readdirSync(pagesDir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => join("src", "web", "pages", f));
  for (const f of [...files, "src/web/content.ts", "README.md", "DEPLOYMENT.md", ".env.example"]) {
    let body: string;
    try {
      body = readFileSync(join(root, f), "utf8");
    } catch {
      continue; // optional file (content.ts) not present
    }
    assert.doesNotMatch(body, /paddle/i, `${f} mentions Paddle`);
  }
});

const BILLING_PAGES = [
  "/premium (offered)",
  "/premium (not offered)",
  "/pricing (offered)",
  "/pricing (not offered)",
  "/refunds (offered)",
  "/refunds",
  "/terms (offered)",
  "/terms",
];

test("billing pages say Premium is sold only through Discord, which handles billing, cancellation and refunds", () => {
  for (const path of BILLING_PAGES) {
    const t = text(rendered[path]);
    assert.ok(/Discord(?:'s)? in-app subscriptions?/.test(t), `${path} names Discord in-app subscriptions`);
    assert.ok(t.includes("billed by Discord"), `${path} says Discord bills it`);
    assert.ok(
      t.includes("billing, cancellation and refunds"),
      `${path} says Discord handles billing, cancellation and refunds`,
    );
    assert.ok(t.includes(NO_WEB_PURCHASE_TEXT), `${path} says it can't be bought on the website`);
  }
  for (const path of ["/refunds", "/terms"]) {
    assert.ok(
      rendered[path].includes("https://discord.com/terms/paid-services-terms"),
      `${path} links Discord's Paid Services Terms`,
    );
  }
});

test("no public page offers a web checkout or loads Stripe.js", () => {
  for (const [path, html] of Object.entries(rendered)) {
    assert.doesNotMatch(html, /\/premium\/checkout|js\.stripe\.com|checkout\.stripe\.com/, `${path} has no web checkout`);
    assert.doesNotMatch(
      text(html),
      /billed monthly via Stripe|Upgrade on Dashboard|Checkout details|buy it on the dashboard/i,
      `${path} has no Stripe purchase copy`,
    );
  }
});

test("the Discord CTA shows when the SKU is configured; Coming soon on Discord with no price CTA when it isn't", () => {
  for (const path of ["/premium (offered)", "/pricing (offered)"]) {
    const html = rendered[path];
    assert.ok(html.includes(`href="${STORE_URL}"`), `${path} links the SKU's Discord store page`);
    assert.ok(html.includes(SUBSCRIBE_IN_DISCORD_LABEL), `${path} says Subscribe in Discord`);
    assert.ok(text(html).includes("open Aegis's profile"), `${path} has the how-to copy`);
    assert.ok(!text(html).includes(COMING_SOON_ON_DISCORD + "."), `${path} is not coming soon`);
    assert.ok(text(html).includes(billingStatusText(true)), `${path} carries the on-sale status`);
  }
  for (const path of ["/premium (not offered)", "/pricing (not offered)"]) {
    const html = rendered[path];
    assert.ok(text(html).includes(COMING_SOON_ON_DISCORD), `${path} says Coming soon on Discord`);
    assert.ok(!html.includes("application-directory"), `${path} has no store link`);
    assert.ok(!html.includes(SUBSCRIBE_IN_DISCORD_LABEL), `${path} has no Subscribe button`);
    assert.ok(text(html).includes(billingStatusText(false)), `${path} carries the not-on-sale status`);
  }
});

test("'in development / not for sale' wording is gone where it would be false", () => {
  for (const [path, html] of Object.entries(rendered)) {
    assert.doesNotMatch(text(html), /in development and not for sale|In Development · Not for Sale|Stripe \(checkout/, path);
  }
  for (const path of ["/premium (offered)", "/pricing (offered)", "/refunds (offered)", "/terms (offered)", "/privacy (offered)"]) {
    assert.doesNotMatch(text(rendered[path]), /not on sale yet|coming soon on Discord/i, `${path} is on sale`);
  }
  for (const path of ["/premium (not offered)", "/pricing (not offered)", "/refunds", "/terms", "/privacy", "/roadmap"]) {
    assert.match(text(rendered[path]), /not on sale yet/, `${path} says it isn't on sale yet`);
  }
  assert.ok(rendered["/roadmap"].includes('id="premium"'), "roadmap lists Premium while it isn't on sale");
  assert.ok(!rendered["/roadmap (offered)"].includes('id="premium"'), "and drops it once it is");
});

test("DEPLOYMENT.md and .env.example document the web checkout switch and the $5 price", () => {
  const deployment = readFileSync(join(root, "DEPLOYMENT.md"), "utf8");
  const env = readFileSync(join(root, ".env.example"), "utf8");
  for (const [name, body] of [["DEPLOYMENT.md", deployment], [".env.example", env]] as const) {
    assert.ok(body.includes("WEB_CHECKOUT_ENABLED"), `${name} documents WEB_CHECKOUT_ENABLED`);
    assert.doesNotMatch(body, /\$4\.99/, `${name} has no $4.99`);
  }
});
