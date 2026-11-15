/**
 * Premium page (/dashboard/:guildId/premium). Open to every member of the
 * server, not only staff: staff see it inside the usual sidebar layout,
 * members on a plain page. Billing controls show only for the buyer.
 *
 * No inline scripts or styles. The checkout settings ride on data-* attributes
 * and /assets/premium.js opens Paddle's overlay from them.
 */
import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { GuildSummary } from "../botView";
import { PREMIUM_BADGE, PREMIUM_GRACE_DAYS, PREMIUM_LIMITS, PREMIUM_PRICE_LABEL } from "../../../config/premium";
import type { PaddleConfig } from "../../../config/paddle";
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
  paddle: Pick<PaddleConfig, "environment" | "clientToken" | "priceId">;
  /** Absolute URL Paddle sends the buyer back to after paying. */
  successUrl: string;
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
    if (isBuyer) {
      const portal = (action: string, label: string, cls: string, confirm?: string) => `<form class="inline-form" method="post" action="${base}/portal"${confirm ? ` data-confirm="${esc(confirm)}"` : ""}>
        ${csrfField(v.viewer)}<input type="hidden" name="action" value="${action}"><button class="btn ${cls}" type="submit">${esc(label)}</button></form>`;
      return `<div class="btn-row">${portal("overview", "Manage billing", "")}${e?.status === "past_due" ? portal("payment", "Update payment method", "ghost") : ""}${e?.cancelAt ? "" : portal("cancel", "Cancel subscription", "ghost danger", "Cancel Premium for this server? It stays on until the end of the month already paid for.")}</div>
      <p class="faint">These open Paddle's customer portal, where you can see invoices, change your card or cancel.</p>`;
    }
    return `<p class="muted">Bought by ${v.buyerName ? `<strong>${esc(v.buyerName)}</strong>` : "another member"}. Only they can manage or cancel the subscription.</p>`;
  }
  const d = v.paddle;
  const customerId = v.entitlement?.customerId ?? "";
  const custAttr = customerId ? ` data-customer="${esc(customerId)}"` : "";
  return `<div class="premium-checkout" data-premium-checkout data-env="${esc(d.environment)}" data-token="${esc(d.clientToken)}" data-price="${esc(d.priceId)}" data-guild="${esc(v.guild.id)}" data-user="${esc(v.viewer.userId)}"${custAttr} data-success="${esc(v.successUrl)}">
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
  const scripts = `<script src="https://cdn.paddle.com/paddle/v2/paddle.js" defer></script><script src="/assets/premium.js${cfg.assetVersion ? `?v=${encodeURIComponent(cfg.assetVersion)}` : ""}" defer></script>`;
  const lead = "Aegis Premium for this server: higher limits and a badge. Anyone in the server can buy it.";
  const path = `/dashboard/${v.guild.id}/premium`;
  if (v.ctx) {
    return modulePage(cfg, v.ctx, { active: "premium", title: "Premium", lead, path, body, extraScripts: v.premium ? "" : scripts });
  }
  return shell(cfg, {
    title: `Premium, ${v.guild.name}`,
    path,
    viewer: v.viewer,
    extraScripts: v.premium ? "" : scripts,
    body: `${head("Premium", lead, [["Servers", "/dashboard"], [v.guild.name, null], ["Premium", null]], { eyebrow: v.guild.name })}${body}`,
  });
}
