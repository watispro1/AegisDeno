/**
 * Premium page (/dashboard/:guildId/premium). Open to every member of the
 * server, not only staff: staff see it inside the usual sidebar layout,
 * members on a plain page. Billing controls show only for the buyer.
 *
 * No inline scripts or styles. While Premium is for sale, /assets/premium.js
 * fetches the checkout settings from /dashboard/:guildId/premium/checkout and
 * opens Paddle's overlay. While sales are paused (PREMIUM_SALES_ENABLED off)
 * the page shows an "In development" badge, offers no checkout and loads
 * nothing from Paddle; billing controls for an existing subscription remain.
 */
import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { GuildSummary } from "../botView";
import { PREMIUM_BADGE, PREMIUM_DEV_BADGE, PREMIUM_GRACE_DAYS, PREMIUM_LIMITS, PREMIUM_NOT_FOR_SALE, PREMIUM_PRICE_LABEL } from "../../../config/premium";
import { graceEndsAt, type Entitlement } from "../../../services/premiumState";
import { type GuildContext, type Viewer, csrfField, fmtDate, head, notice, shell } from "./layout";
import { modulePage } from "./parts";
import { pill, summaryStrip } from "./moduleKit";

export interface PremiumView {
  guild: GuildSummary;
  viewer: Viewer;
  /** Present when the viewer manages the server (sidebar layout). */
  ctx?: GuildContext;
  premium: boolean;
  entitlement: Entitlement | null;
  /** Whether a new purchase can start (sales on and Paddle configured). */
  forSale: boolean;
  /** Whether Paddle is configured, so the buyer's billing portal can open. */
  billingPortal: boolean;
  /** Display name of the buyer, if the bot knows them. */
  buyerName: string | null;
  noticeCode: string | null;
}

function statusPill(v: PremiumView): string {
  const e = v.entitlement;
  if (v.premium && e?.status === "past_due") return pill("Payment failed: in grace period", "warn");
  if (v.premium && e?.cancelAt) return pill("On until it ends", "warn");
  if (v.premium) return pill(PREMIUM_BADGE, "ok");
  if (e?.status === "paused") return pill("Paused", "off");
  return pill("Not active", "off");
}

function statusText(v: PremiumView): string {
  const e = v.entitlement;
  if (!e) return v.forSale ? "This server doesn't have Premium yet." : PREMIUM_NOT_FOR_SALE;
  if (v.premium && e.status === "past_due") {
    const end = graceEndsAt(e);
    return `The last renewal payment failed. Premium stays on until ${end ? fmtDate(end) : `${PREMIUM_GRACE_DAYS} days after it failed`} while Paddle retries it. The buyer can update the payment method below.`;
  }
  if (v.premium && e.cancelAt) return `Cancelled. Premium stays on until ${fmtDate(e.cancelAt)}, then ends.`;
  if (v.premium) return e.currentPeriodEnd ? `Active. Renews ${fmtDate(e.currentPeriodEnd)}.` : "Active.";
  if (e.status === "paused") return "Premium is paused.";
  return "Premium has ended for this server. Nothing it unlocked was deleted; you just can't add more past the free limits.";
}

function benefitsTable(): string {
  const rows = Object.values(PREMIUM_LIMITS).map(l => `<tr><td>${esc(l.label)}</td><td>${l.free}</td><td><strong>${l.premium}</strong></td></tr>`).join("");
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">Limit</th><th scope="col">Free</th><th scope="col">Premium</th></tr></thead>
    <tbody>${rows}<tr><td>Premium badge in /help and on the dashboard</td><td>—</td><td><strong>Yes</strong></td></tr></tbody></table></div>`;
}

function actions(v: PremiumView): string {
  const base = `/dashboard/${esc(v.guild.id)}/premium`;
  const e = v.entitlement;
  const isBuyer = Boolean(e && e.userId === v.viewer.userId && e.customerId);
  if (v.premium) {
    if (isBuyer && v.billingPortal) {
      const portal = (action: string, label: string, cls: string, confirm?: string) => `<form class="inline-form" method="post" action="${base}/portal"${confirm ? ` data-confirm="${esc(confirm)}"` : ""}>
        ${csrfField(v.viewer)}<input type="hidden" name="action" value="${action}"><button class="btn ${cls}" type="submit">${esc(label)}</button></form>`;
      return `<div class="btn-row">${portal("overview", "Manage billing", "")}${e?.status === "past_due" ? portal("payment", "Update payment method", "ghost") : ""}${e?.cancelAt ? "" : portal("cancel", "Cancel subscription", "ghost danger", "Cancel Premium for this server? It stays on until the end of the month already paid for.")}</div>
      <p class="faint">These open Paddle's customer portal, where you can see invoices, change your card or cancel.</p>`;
    }
    return `<p class="muted">Bought by ${v.buyerName ? `<strong>${esc(v.buyerName)}</strong>` : "another member"}. Only they can manage or cancel the subscription.</p>`;
  }
  if (!v.forSale) {
    return `<p class="notice" data-premium-not-for-sale><span class="premium-badge">${esc(PREMIUM_DEV_BADGE)}</span> <strong>Not for sale yet.</strong> Premium can't be bought while it is in development. Nothing here charges you, and every feature stays free.</p>`;
  }
  return `<div class="premium-checkout" data-premium-checkout data-checkout-url="${base}/checkout">
      <button class="btn" type="button" data-premium-subscribe disabled>Subscribe for ${esc(PREMIUM_PRICE_LABEL)}</button>
      <p class="faint" data-premium-status role="status" aria-live="polite">Loading the secure checkout…</p>
      <noscript><p class="notice bad">The checkout needs JavaScript. Turn it on for this page, or run /premium in the server for help.</p></noscript>
    </div>
    <p class="faint">Payments are processed by Paddle, our merchant of record. Aegis never sees your card or email. By subscribing you agree to the <a href="/terms#premium">terms</a>.</p>`;
}

export function renderPremiumPage(cfg: SiteConfig, v: PremiumView): string {
  const e = v.entitlement;
  const stats = summaryStrip([
    { label: "Status", value: "", html: statusPill(v) },
    v.forSale
      ? { label: "Price", value: `${PREMIUM_PRICE_LABEL} per server` }
      : { label: "Availability", value: "", html: pill(`${PREMIUM_DEV_BADGE}: not for sale yet`, "info") },
    ...(e?.currentPeriodEnd && v.premium ? [{ label: e.cancelAt ? "Ends" : "Renews", value: fmtDate(e.cancelAt ?? e.currentPeriodEnd) }] : []),
  ], "Premium summary");
  const body = `${notice(v.noticeCode)}${stats}
  <section class="panel-card" aria-labelledby="pr-status-h"><h2 id="pr-status-h">This server</h2>
    <p>${esc(statusText(v))}</p>
    ${actions(v)}
  </section>
  <section class="panel-card" aria-labelledby="pr-adds-h"><h2 id="pr-adds-h">What Premium ${v.forSale ? "adds" : "will add"}</h2>
    ${benefitsTable()}
    <p class="faint">Every feature stays free; Premium only raises these limits. If it ends, nothing is deleted. <a href="/premium">More about Premium</a>.</p>
  </section>`;
  const scripts = `<script src="https://cdn.paddle.com/paddle/v2/paddle.js" defer></script><script src="/assets/premium.js${cfg.assetVersion ? `?v=${encodeURIComponent(cfg.assetVersion)}` : ""}" defer></script>`;
  const lead = v.forSale
    ? "Aegis Premium for this server: higher limits and a badge. Anyone in the server can buy it."
    : "Aegis Premium for this server: higher limits and a badge. It is in development and not for sale yet.";
  const checkout = v.forSale && !v.premium;
  const path = `/dashboard/${v.guild.id}/premium`;
  if (v.ctx) {
    return modulePage(cfg, v.ctx, { active: "premium", title: "Premium", lead, path, body, extraScripts: checkout ? scripts : "" });
  }
  return shell(cfg, {
    title: `Premium, ${v.guild.name}`,
    path,
    viewer: v.viewer,
    extraScripts: checkout ? scripts : "",
    body: `${head("Premium", lead, [["Servers", "/dashboard"], [v.guild.name, null], ["Premium", null]], { eyebrow: v.guild.name })}${body}`,
  });
}
