/**
 * Premium page: GET /:guildId/premium, GET /:guildId/premium/checkout and
 * POST /:guildId/premium/portal.
 *
 * Unlike the rest of the dashboard this page is open to every member of the
 * server (from the login's server list), so anyone can buy Premium for it.
 * Staff get the normal guild layout through requireGuild. The buyer may always
 * open it, even after leaving the server, to manage or cancel. Only the buyer
 * gets Paddle customer-portal links, since the portal shows their billing.
 *
 * Sales are behind PREMIUM_SALES_ENABLED (off by default). While it is off the
 * page shows Premium as "in development, not for sale yet", loads nothing from
 * Paddle, and the checkout endpoint answers 403 premium_not_for_sale, so no
 * Paddle checkout can be opened. The portal keeps working for anyone who
 * already subscribed. With sales on, the page is hidden (404) unless Paddle is
 * fully configured.
 */
import type { NextFunction, Request, Response, Router } from "express";
import { logger } from "../../../utils/logger";
import { readPaddleConfig, type PaddleConfig } from "../../../config/paddle";
import { PREMIUM_NOT_FOR_SALE, premiumSalesEnabled } from "../../../config/premium";
import { createPortalSession, type FetchLike } from "../../../services/paddleApi";
import { entitlementActive, primaryEntitlement } from "../../../services/premiumState";
import { premiumStore } from "../../../services/premium";
import type { PremiumStore } from "../../../services/premiumStore";
import { isSnowflake } from "../permissions";
import type { FormBody } from "../validation";
import { renderPremiumPage } from "../views/premium";
import type { Authed, GuildLocals, RouteKit } from "./context";

export interface PremiumDeps {
  store?: PremiumStore;
  paddle?: () => PaddleConfig | null;
  /** Paddle API fetch, for portal sessions (tests pass a fake). */
  paddleFetch?: FetchLike;
  /** Whether new purchases may start (PREMIUM_SALES_ENABLED by default). */
  salesEnabled?: () => boolean;
}

/** The JSON the checkout endpoint answers while Premium is not for sale. */
export const PREMIUM_NOT_FOR_SALE_ERROR = "premium_not_for_sale";

export function registerPremiumRoutes(router: Router, k: RouteKit, p: PremiumDeps = {}): void {
  const { deps, cfg, fail, send, noticeParam, pageLimit, postLimit, form, requireSession, requireCsrf, requireGuild, now } = k;
  const store = () => p.store ?? premiumStore();
  const paddle = () => (p.paddle ?? readPaddleConfig)();
  const sales = () => (p.salesEnabled ?? premiumSalesEnabled)();
  /** Paddle settings for a new checkout, or null while Premium is not for sale. */
  const checkoutConfig = () => (sales() ? paddle() : null);

  /** Member, staff (delegates to requireGuild) or buyer; 404 when sales are on but Paddle is not set up. */
  const requirePremiumAccess = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authed = res.locals.dash as Authed;
      const guildId = String(req.params.guildId ?? "");
      if (sales() && !paddle()) return fail(res, 404, "Premium isn't offered", "Aegis Premium isn't available on this Aegis yet. Everything stays free.", authed.viewer);
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
      const pc = checkoutConfig();
      send(res, renderPremiumPage(deps.site, {
        guild,
        viewer: authed.viewer,
        ctx: authed.ctx ? { ...authed.ctx, premium } : undefined,
        premium,
        entitlement,
        forSale: pc !== null,
        billingPortal: paddle() !== null,
        buyerName: entitlement?.userId ? deps.bot.userName(entitlement.userId) : null,
        noticeCode: noticeParam(req),
      }));
    } catch (err) { next(err); }
  });

  /**
   * The settings premium.js needs to open Paddle's overlay checkout. This is the
   * only way the page gets them, so while sales are paused no checkout can start.
   * The server and buyer IDs come from the session, never from the client.
   */
  router.get("/:guildId/premium/checkout", pageLimit, requireSession, (_req, res, next) => {
    if (checkoutConfig()) return next();
    res.setHeader("Cache-Control", "no-store");
    res.status(403).json({ error: PREMIUM_NOT_FOR_SALE_ERROR, message: PREMIUM_NOT_FOR_SALE });
  }, requirePremiumAccess, async (req, res, next) => {
    try {
      const authed = res.locals.dash as Authed & Partial<GuildLocals>;
      const guild = authed.ctx?.guild ?? res.locals.premiumGuild;
      const pc = checkoutConfig();
      res.setHeader("Cache-Control", "no-store");
      if (!pc) return res.status(403).json({ error: PREMIUM_NOT_FOR_SALE_ERROR, message: PREMIUM_NOT_FOR_SALE });
      const rows = await store().forGuild(guild.id);
      const at = new Date(now());
      if (rows.some(r => entitlementActive(r, at))) {
        return res.status(409).json({ error: "premium_already_active", message: "This server already has Premium." });
      }
      const customerId = primaryEntitlement(rows.filter(r => r.userId === authed.session.userId && r.customerId), at)?.customerId ?? null;
      res.json({
        environment: pc.environment,
        clientToken: pc.clientToken,
        priceId: pc.priceId,
        guildId: guild.id,
        userId: authed.session.userId,
        customerId,
        successUrl: `${cfg.origin}/dashboard/${guild.id}/premium?notice=premium-thanks`,
      });
    } catch (err) { next(err); }
  });

  router.post("/:guildId/premium/portal", postLimit, form, requireSession, requireCsrf, requirePremiumAccess, async (req, res, next) => {
    try {
      const authed = res.locals.dash as Authed & Partial<GuildLocals>;
      const guildId = (authed.ctx?.guild ?? res.locals.premiumGuild).id as string;
      const back = `/dashboard/${guildId}/premium`;
      const rows = await store().forGuild(guildId);
      const mine = primaryEntitlement(rows.filter(r => r.userId === authed.session.userId && r.customerId), new Date(now()));
      if (!mine?.customerId) {
        return fail(res, 403, "Not your subscription", "Only the person who bought Premium for this server can manage its billing.", authed.viewer);
      }
      const action = String(((req.body ?? {}) as FormBody).action ?? "overview");
      const pc = paddle();
      if (!pc) return res.redirect(303, `${back}?notice=premium-portal-failed`);
      const links = await createPortalSession(pc, mine.customerId, mine.subscriptionId, p.paddleFetch).catch((err) => {
        logger.warn(`Paddle portal session failed for guild ${guildId}: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      });
      if (!links) return res.redirect(303, `${back}?notice=premium-portal-failed`);
      const target = action === "cancel" ? links.cancel ?? links.overview : action === "payment" ? links.updatePayment ?? links.overview : links.overview;
      res.redirect(303, target);
    } catch (err) { next(err); }
  });
}
