/** Ban appeals: /:guildId/appeals[/:code[/review]]. */
import type { Router } from "express";
import { parseAppealFilter, parseAppealReview, type FormBody } from "../validation";
import { renderAppeal, renderAppeals } from "../views";
import { APPEALS_PER_PAGE, type RouteKit, type GuildLocals } from "./context";

export function registerAppealRoutes(router: Router, k: RouteKit): void {
  const { deps, send, fail, missingPermission, requirePermission, actorOf, logAudit, noticeParam, guildGet, guildPost } = k;

  /* ── Appeals ─────────────────────────────────────────────────────── */

  router.get("/:guildId/appeals", ...guildGet, async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const filter = parseAppealFilter(req.query as Record<string, unknown>);
      const [result, missing] = await Promise.all([
        deps.data.listAppeals(ctx.guild.id, filter.status, filter.page, APPEALS_PER_PAGE),
        missingPermission(ctx, "BanMembers"),
      ]);
      send(res, renderAppeals(deps.site, ctx, filter, result, APPEALS_PER_PAGE, { missingPermission: missing, noticeCode: noticeParam(req) }));
    } catch (err) {
      next(err);
    }
  });

  router.get("/:guildId/appeals/:code", ...guildGet, async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const appeal = await deps.data.getAppeal(ctx.guild.id, String(req.params.code));
      if (!appeal) return fail(res, 404, "Appeal not found", "No appeal with that code exists in this server.", ctx.viewer);
      const missing = await missingPermission(ctx, "BanMembers");
      send(res, renderAppeal(deps.site, ctx, appeal, { missingPermission: missing, noticeCode: noticeParam(req) }));
    } catch (err) {
      next(err);
    }
  });

  router.post("/:guildId/appeals/:code/review", ...guildPost, requirePermission("BanMembers"), async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const appeal = await deps.data.getAppeal(ctx.guild.id, String(req.params.code));
      if (!appeal) return fail(res, 404, "Appeal not found", "No appeal with that code exists in this server.", ctx.viewer);
      const url = `/dashboard/${ctx.guild.id}/appeals/${encodeURIComponent(appeal.code)}`;
      const body = (req.body ?? {}) as FormBody;
      const parsed = parseAppealReview(body);
      if (!parsed.ok) {
        return send(res, renderAppeal(deps.site, ctx, appeal, { errors: parsed.errors, noteValue: typeof body.note === "string" ? body.note : "" }), 400);
      }
      const outcome = await deps.data.reviewAppeal(ctx.guild.id, appeal.code, parsed.value.decision, parsed.value.note, actorOf(ctx));
      if (!outcome.ok) {
        if (outcome.reason === "not_found") return fail(res, 404, "Appeal not found", "No appeal with that code exists in this server.", ctx.viewer);
        return res.redirect(303, `${url}?notice=appeal-reviewed`);
      }
      await logAudit(ctx, `appeal.${parsed.value.decision}`, appeal.code,
        `member ${appeal.userId}${outcome.unban ? `; unban: ${outcome.unban}` : ""}${parsed.value.note ? `; note: ${parsed.value.note}` : ""}`);
      const code = parsed.value.decision === "denied" ? "appeal-denied" : outcome.unban === "failed" ? "appeal-approved-unban-failed" : "appeal-approved";
      res.redirect(303, `${url}?notice=${code}`);
    } catch (err) {
      next(err);
    }
  });
}
