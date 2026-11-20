/**
 * Premium page (/dashboard/:guildId/premium). Open to every member of the
 * server, not only staff: staff see it inside the usual sidebar layout,
 * members on a plain page.
 *
 * Premium is sold only as a Discord in-app subscription: the page shows a
 * "Subscribe in Discord" link (or "Coming soon on Discord") and never a web
 * checkout, and it loads no Stripe.js. For a subscription bought earlier on
 * the website, the buyer still gets Stripe billing-portal buttons.
 * No inline scripts or styles.
 */
import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { GuildSummary } from "../botView";
import { PREMIUM_BADGE, PREMIUM_GRACE_DAYS, PREMIUM_LIMITS, PREMIUM_PRICE_LABEL } from "../../../config/premium";
import { DISCORD_BILLING_HTML, discordCtaHtml, type DiscordPremiumOffer } from "../../pages/billingCopy";
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
  /** Where to subscribe in Discord, or null while the Discord SKU isn't configured ("Coming soon on Discord"). */
  discord: DiscordPremiumOffer | null;
  /** Whether Stripe is configured, so an earlier website subscriber can open Stripe's billing portal. */
  stripePortal: boolean;
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
  if (!e) return "This server doesn't have Premium yet.";
  if (v.premium && e.status === "past_due") {
    const end = graceEndsAt(e);
    return `The last renewal payment failed. Premium stays on until ${end ? fmtDate(end) : `${PREMIUM_GRACE_DAYS} days after it failed`} while Stripe retries it. The buyer can update the payment method below.`;
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

/** A subscription bought earlier on the website through Stripe (not a Discord entitlement). */
export function isStripeSubscription(e: Entitlement | null): boolean {
  return Boolean(e && !e.subscriptionId.startsWith("discord_") && e.customerId && !e.customerId.startsWith("discord_"));
}

function actions(v: PremiumView): string {
  const base = `/dashboard/${esc(v.guild.id)}/premium`;
  const e = v.entitlement;
  if (v.premium) {
    if (!isStripeSubscription(e)) {
      return `<p class="muted">Subscribed in Discord${v.buyerName ? ` by <strong>${esc(v.buyerName)}</strong>` : ""}. Whoever subscribed manages or cancels it from the Subscriptions section of their Discord settings.</p>
      <p class="faint">${DISCORD_BILLING_HTML}</p>`;
    }
    const isBuyer = Boolean(e && e.userId === v.viewer.userId);
    if (isBuyer && v.stripePortal) {
      const portal = (action: string, label: string, cls: string, confirm?: string) => `<form class="inline-form" method="post" action="${base}/portal"${confirm ? ` data-confirm="${esc(confirm)}"` : ""}>
        ${csrfField(v.viewer)}<input type="hidden" name="action" value="${action}"><button class="btn ${cls}" type="submit">${esc(label)}</button></form>`;
      return `<div class="btn-row">${portal("overview", "Manage billing", "")}${e?.status === "past_due" ? portal("payment", "Update payment method", "ghost") : ""}${e?.cancelAt ? "" : portal("cancel", "Cancel subscription", "ghost danger", "Cancel Premium for this server? It stays on until the end of the month already paid for.")}</div>
      <p class="faint">This subscription was bought on the website before Premium moved to Discord. These open Stripe's billing portal, where you can see invoices, change your card or cancel.</p>`;
    }
    return `<p class="muted">Bought by ${v.buyerName ? `<strong>${esc(v.buyerName)}</strong>` : "another member"}. Only they can manage or cancel the subscription.</p>`;
  }
  return discordCtaHtml(v.discord);
}

export function renderPremiumPage(cfg: SiteConfig, v: PremiumView): string {
  const e = v.entitlement;
  const stats = summaryStrip([
    { label: "Status", value: "", html: statusPill(v) },
    { label: "Price", value: `${PREMIUM_PRICE_LABEL} per server` },
    ...(e?.currentPeriodEnd && v.premium ? [{ label: e.cancelAt ? "Ends" : "Renews", value: fmtDate(e.cancelAt ?? e.currentPeriodEnd) }] : []),
  ], "Premium summary");
  const body = `${notice(v.noticeCode)}${stats}
  <section class="panel-card" aria-labelledby="pr-status-h"><h2 id="pr-status-h">This server</h2>
    <p>${esc(statusText(v))}</p>
    ${actions(v)}
  </section>
  <section class="panel-card" aria-labelledby="pr-adds-h"><h2 id="pr-adds-h">What Premium adds</h2>
    ${benefitsTable()}
    <p class="faint">Every feature stays free; Premium only raises these limits. If it ends, nothing is deleted. <a href="/premium">More about Premium</a>.</p>
  </section>`;
  const lead = "Aegis Premium for this server: higher limits and a badge. Anyone in the server can subscribe in Discord.";
  const path = `/dashboard/${v.guild.id}/premium`;
  if (v.ctx) {
    return modulePage(cfg, v.ctx, { active: "premium", title: "Premium", lead, path, body });
  }
  return shell(cfg, {
    title: `Premium, ${v.guild.name}`,
    path,
    body: `<div class="wrap m-wrap">${head("Premium", lead)}<main>${body}</main></div>`,
    viewer: v.viewer,
  });
}
