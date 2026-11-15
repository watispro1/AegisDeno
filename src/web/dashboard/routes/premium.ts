/**
 * Premium page: GET /:guildId/premium and POST /:guildId/premium/portal.
 *
 * Unlike the rest of the dashboard this page is open to every member of the
 * server (from the login's server list), so anyone can buy Premium for it.
 * Staff get the normal guild layout through requireGuild. The buyer may always
 * open it, even after leaving the server, to manage or cancel. Only the buyer
 * gets Paddle customer-portal links, since the portal shows their billing.
 * Hidden (404) unless Paddle is fully configured.
 */
import type { NextFunction, Request, Response, Router } from "express";
import { logger } from "../../../utils/logger";
import { readPaddleConfig, type PaddleConfig } from "../../../config/paddle";
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
}

export function registerPremiumRoutes(router: Router, k: RouteKit, p: PremiumDeps = {}): void {
  const { deps, cfg, fail, send, noticeParam, pageLimit, postLimit, form, requireSession, requireCsrf, requireGuild, now } = k;
  const store = () => p.store ?? premiumStore();
  const paddle = () => (p.paddle ?? readPaddleConfig)();

  /** Member, staff (delegates to requireGuild) or buyer; 404 when Premium is not offered. */
  const requirePremiumAccess = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authed = res.locals.dash as Authed;
      const guildId = String(req.params.guildId ?? "");
      if (!paddle()) return fail(res, 404, "Premium isn't offered", "Aegis Premium isn't available on this Aegis yet. Everything stays free.", authed.viewer);
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
      const pc = paddle()!;
      send(res, renderPremiumPage(deps.site, {
        guild,
        viewer: authed.viewer,
        ctx: authed.ctx ? { ...authed.ctx, premium } : undefined,
        premium,
        entitlement,
        paddle: { environment: pc.environment, clientToken: pc.clientToken, priceId: pc.priceId },
        successUrl: `${cfg.origin}/dashboard/${guild.id}/premium?notice=premium-thanks`,
        buyerName: entitlement?.userId ? deps.bot.userName(entitlement.userId) : null,
        noticeCode: noticeParam(req),
      }));
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
      const links = await createPortalSession(paddle()!, mine.customerId, mine.subscriptionId, p.paddleFetch).catch((err) => {
        logger.warn(`Paddle portal session failed for guild ${guildId}: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      });
      if (!links) return res.redirect(303, `${back}?notice=premium-portal-failed`);
      const target = action === "cancel" ? links.cancel ?? links.overview : action === "payment" ? links.updatePayment ?? links.overview : links.overview;
      res.redirect(303, target);
    } catch (err) { next(err); }
  });
}
