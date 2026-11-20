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
import { BILLING_STATUS_TEXT } from "../src/web/pages/billingCopy";

const root = join(__dirname, "..");
const site: SiteConfig = {
  inviteUrl: "#",
  supportUrl: "",
  version: "test",
  contactEmail: "",
  assetVersion: "t",
};
const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");

// Billing moved from Paddle to Stripe and Discord in-app subscriptions (bot 3.15.0).
// The changelog pages are a historical record and may still name Paddle, so they
// are not checked here.
const rendered: Record<string, string> = {
  "/premium (offered)": renderPremium(site, true),
  "/premium (not offered)": renderPremium(site, false),
  "/pricing (offered)": renderPricing(site, true),
  "/pricing (not offered)": renderPricing(site, false),
  "/refunds": renderRefunds(site),
  "/terms": renderTerms(site),
  "/privacy": renderPrivacy(site),
  "/security": renderSecurity(site),
  "/roadmap": renderRoadmap(site),
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

test("billing pages name Stripe and Discord in-app subscriptions and Discord's own terms", () => {
  for (const path of ["/premium (not offered)", "/pricing (not offered)", "/refunds", "/terms"]) {
    const t = text(rendered[path]);
    assert.ok(t.includes("Stripe"), `${path} names Stripe`);
    assert.ok(
      /Discord in-app subscription|Discord's in-app subscriptions/.test(t),
      `${path} names Discord in-app subscriptions`,
    );
    assert.ok(t.includes("billed by Discord"), `${path} says Discord bills in-app subscriptions`);
  }
  for (const path of ["/refunds", "/terms"]) {
    assert.ok(
      rendered[path].includes("https://discord.com/terms/paid-services-terms"),
      `${path} links Discord's Paid Services Terms`,
    );
  }
});

test("Premium stays in development and not for sale, and billing is not yet available", () => {
  for (const path of [
    "/premium (not offered)",
    "/pricing (not offered)",
    "/refunds",
    "/terms",
    "/roadmap",
  ]) {
    const t = text(rendered[path]);
    assert.ok(/not yet available/.test(t), `${path} says billing is not yet available`);
  }
  for (const path of ["/premium (not offered)", "/pricing (not offered)"]) {
    const t = text(rendered[path]);
    assert.ok(t.includes("Not on sale yet."), `${path} keeps the not-on-sale notice`);
    assert.ok(
      t.includes("currently in development and not for sale"),
      `${path} keeps the in-development wording`,
    );
    assert.ok(
      t.includes(BILLING_STATUS_TEXT),
      `${path} carries the shared billing status sentence`,
    );
  }
  // The lead and the pricing card say it whether or not Stripe is configured, as on main.
  assert.ok(
    text(rendered["/premium (offered)"]).includes("currently in development and not for sale"),
  );
  assert.ok(text(rendered["/pricing (offered)"]).includes("In Development · Not for Sale"));
});
