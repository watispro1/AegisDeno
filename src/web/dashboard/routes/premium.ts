/**
 * Premium page: GET /:guildId/premium, POST /:guildId/premium/checkout, and POST /:guildId/premium/portal.
 *
 * Premium is sold only as a Discord in-app subscription, so this page links to
 * Discord ("Subscribe in Discord") and web checkout is off whatever the env:
 * POST .../checkout answers 403 {"error":"web_checkout_disabled"} even when
 * every STRIPE_* secret is set (WEB_CHECKOUT_ENABLED in src/config/stripe.ts).
 *
 * Unlike the rest of the dashboard this page is open to every member of the
 * server (from the login's server list). Staff get the normal guild layout
 * through requireGuild. The buyer of an earlier website (Stripe) subscription
 * may always open it, even after leaving the server, to manage or cancel, and
 * only they get Stripe billing-portal links, since the portal shows their billing.
 * Hidden (404) unless Premium is sold on Discord or Stripe is configured for
 * those earlier subscribers.
 */
import type { NextFunction, Request, Response, Router } from "express";
import { logger } from "../../../utils/logger";
import { readStripeConfig, webCheckoutEnabled, type StripeConfig } from "../../../config/stripe";
import { discordPremiumOffer, type DiscordPremiumOffer } from "../../../config/discordSku";
import { createCheckoutSession, createPortalSession, portalUrl, type FetchLike } from "../../../services/stripeApi";
import { entitlementActive, primaryEntitlement } from "../../../services/premiumState";
import { premiumStore } from "../../../services/premium";
import type { PremiumStore } from "../../../services/premiumStore";
import { isSnowflake } from "../permissions";
import type { FormBody } from "../validation";
import { isStripeSubscription, renderPremiumPage } from "../views/premium";
import type { Authed, GuildLocals, RouteKit } from "./context";

export interface PremiumDeps {
  store?: PremiumStore;
  stripe?: () => StripeConfig | null;
  /** The Discord offer (tests pass a fixed one); defaults to discordPremiumOffer() from the env. */
  discord?: () => DiscordPremiumOffer | null;
  /** Stripe API fetch, for checkout and portal sessions (tests pass a fake). */
  stripeFetch?: FetchLike;
}

export function registerPremiumRoutes(router: Router, k: RouteKit, p: PremiumDeps = {}): void {
  const { deps, cfg, fail, send, noticeParam, pageLimit, postLimit, form, requireSession, requireCsrf, requireGuild, now } = k;
  const store = () => p.store ?? premiumStore();
  const stripe = () => (p.stripe ?? readStripeConfig)();
  const discord = () => (p.discord ?? discordPremiumOffer)();

  /** Member, staff (delegates to requireGuild) or buyer; 404 when Premium is not offered. */
  const requirePremiumAccess = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authed = res.locals.dash as Authed;
      const guildId = String(req.params.guildId ?? "");
      if (!discord() && !stripe()) return fail(res, 404, "Premium isn't offered", "Aegis Premium is coming soon on Discord. Everything stays free.", authed.viewer);
      if (!isSnowflake(guildId)) return fail(res, 404, "Server not found", "That is not a server ID.", authed.viewer);
      const guild = deps.bot.guild(guildId);
      if (!guild) return fail(res, 404, "Aegis is not in that server", "Premium can only be bought for a server Aegis is in.", authed.viewer);
      if (await deps.bot.memberCanManage(guildId, authed.session.userId).catch(() => false)) return requireGuild(req, res, next);
      const member = (authed.session.guilds ?? []).some(g => g.id === guildId);
      const buyer = member ? false : (await store().forGuild(guildId)).some(e => e.userId === authed.session.userId);
      if (!member && !buyer) {
        return fail(res, 403, "Not a member of that server", "Join the server first, then log out and back in so the dashboard sees it.", authed.viewer);
      }
      res.locals.premiumGuild = guild;
      next();
    } catch (err) { next(err); }
  };

  router.get("/:guildId/premium", pageLimit, requireSession, requirePremiumAccess, async (req, res, next) => {
    try {
      const authed = res.locals.dash as Authed & Partial<GuildLocals>;
      const guild = authed.ctx?.guild ?? res.locals.premiumGuild;
      const rows = await store().forGuild(guild.id);
      const at = new Date(now());
      const entitlement = primaryEntitlement(rows, at);
      const premium = rows.some(r => entitlementActive(r, at));
      send(res, renderPremiumPage(deps.site, {
        guild,
        viewer: authed.viewer,
        ctx: authed.ctx ? { ...authed.ctx, premium } : undefined,
        premium,
        entitlement,
        discord: discord(),
        stripePortal: stripe() !== null,
        buyerName: entitlement?.userId ? deps.bot.userName(entitlement.userId) : null,
        noticeCode: noticeParam(req),
      }));
    } catch (err) { next(err); }
  });

  // Web checkout is disabled: Premium is sold only through Discord. Checked before
  // anything else (session, CSRF, Stripe config), so no request can start a checkout.
  router.post("/:guildId/premium/checkout", postLimit, async (req, res, next) => {
    try {
      if (!webCheckoutEnabled()) {
        res.status(403).json({ error: "web_checkout_disabled" });
        return;
      }
      next();
    } catch (err) { next(err); }
  }, form, requireSession, requireCsrf, requirePremiumAccess, async (req, res, next) => {
    try {
      const authed = res.locals.dash as Authed & Partial<GuildLocals>;
      const guildId = (authed.ctx?.guild ?? res.locals.premiumGuild).id as string;
      const sc = stripe();
      if (!sc) return fail(res, 404, "Checkout unavailable", "Stripe is not configured.", authed.viewer);
      const rows = await store().forGuild(guildId);
      const existing = primaryEntitlement(rows, new Date(now()));
      const session = await createCheckoutSession({
        secretKey: sc.secretKey,
        priceId: sc.priceId,
        guildId,
        userId: authed.session.userId,
        customerId: existing?.customerId,
        successUrl: `${cfg.origin}/dashboard/${guildId}/premium?notice=premium-thanks`,
        cancelUrl: `${cfg.origin}/dashboard/${guildId}/premium`,
        fetchFn: p.stripeFetch,
      });
      if (!session?.url) {
        return fail(res, 502, "Checkout unavailable", "Could not start a Stripe checkout session right now. Try again in a minute.", authed.viewer);
      }
      res.redirect(303, session.url);
    } catch (err) { next(err); }
  });

  router.post("/:guildId/premium/portal", postLimit, form, requireSession, requireCsrf, requirePremiumAccess, async (req, res, next) => {
    try {
      const authed = res.locals.dash as Authed & Partial<GuildLocals>;
      const guildId = (authed.ctx?.guild ?? res.locals.premiumGuild).id as string;
      const back = `/dashboard/${guildId}/premium`;
      const rows = await store().forGuild(guildId);
      // Only Stripe subscriptions bought earlier on the website; Discord subscriptions are managed in Discord.
      const mine = primaryEntitlement(rows.filter(r => r.userId === authed.session.userId && isStripeSubscription(r)), new Date(now()));
      if (!mine?.customerId) {
        return fail(res, 403, "Not your subscription", "Only the person who bought Premium for this server on the website can manage its billing here. Discord subscriptions are managed in your Discord settings.", authed.viewer);
      }
      const sc = stripe();
      if (!sc) return res.redirect(303, `${back}?notice=premium-portal-failed`);
      const session = await createPortalSession({
        secretKey: sc.secretKey,
        customerId: mine.customerId,
        returnUrl: `${cfg.origin}/dashboard/${guildId}/premium`,
        fetchFn: p.stripeFetch,
      }).catch((err) => {
        logger.warn(`Stripe portal session failed for guild ${guildId}: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      });
      if (!session?.url) return res.redirect(303, `${back}?notice=premium-portal-failed`);
      const target = portalUrl(session.url);
      if (!target) return res.redirect(303, `${back}?notice=premium-portal-failed`);
      res.redirect(303, target);
    } catch (err) { next(err); }
  });
}
