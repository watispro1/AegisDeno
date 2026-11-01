/** Dashboard change log: /:guildId/activity. */
import type { Router } from "express";
import { renderActivity } from "../views";
import { AUDIT_PER_PAGE, type RouteKit, type GuildLocals } from "./context";

export function registerActivityRoutes(router: Router, k: RouteKit): void {
  const { deps, audit, send, guildGet } = k;

  /* ── Activity ────────────────────────────────────────────────────── */

  router.get("/:guildId/activity", ...guildGet, async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const raw = Number(typeof req.query.page === "string" ? req.query.page : "");
      const page = Number.isInteger(raw) && raw >= 1 && raw <= 10_000 ? raw : 1;
      const result = await audit.list(ctx.guild.id, { page, perPage: AUDIT_PER_PAGE });
      send(res, renderActivity(deps.site, ctx, page, result, AUDIT_PER_PAGE));
    } catch (err) {
      next(err);
    }
  });
}
