/** Guild overview and cases: /:guildId, /:guildId/cases[/:caseId[/reason|/revoke]]. */
import type { Router } from "express";
import { describeChanges } from "../audit";
import { parseRevoke, parseCaseFilter, parseCaseReason, type FormBody } from "../validation";
import { renderCase, renderCases, renderOverview } from "../views";
import { CASES_PER_PAGE, type RouteKit, type GuildLocals } from "./context";

export function registerCaseRoutes(router: Router, k: RouteKit): void {
  const { deps, send, fail, missingPermission, actorOf, logAudit, noticeParam, guildGet, guildPost } = k;

  /* ── Guild pages ─────────────────────────────────────────────────── */

  router.get("/:guildId", ...guildGet, async (_req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const id = ctx.guild.id;
      // The extra panels are best-effort: a failure in one never blocks the overview.
      const soft = <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
      const [data, extras, snapshot, panels] = await Promise.all([
        deps.data.overview(id),
        soft(k.modules.overviewExtras(id)),
        soft(deps.data.loadSettings(id)),
        soft(deps.data.listRolePanels(id)),
      ]);
      send(res, renderOverview(deps.site, ctx, data, {
        extras, snapshot, rolePanels: panels?.length ?? 0,
        hidden: deps.bot.hiddenChannelIds(id),
        missingBotPermissions: deps.bot.botMissingPermissions?.(id) ?? [],
      }));
    } catch (err) {
      next(err);
    }
  });

  router.get("/:guildId/cases", ...guildGet, async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const filter = parseCaseFilter(req.query as Record<string, unknown>);
      const per = filter.per ?? CASES_PER_PAGE;
      const result = await deps.data.listCases(ctx.guild.id, filter, per);
      send(res, renderCases(deps.site, ctx, filter, result, per));
    } catch (err) {
      next(err);
    }
  });

  router.get("/:guildId/cases/:caseId", ...guildGet, async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const record = await deps.data.getCase(ctx.guild.id, String(req.params.caseId));
      if (!record) return fail(res, 404, "Case not found", "No case or warning with that ID exists in this server.", ctx.viewer);
      send(res, renderCase(deps.site, ctx, record, { noticeCode: noticeParam(req) }));
    } catch (err) {
      next(err);
    }
  });

  router.post("/:guildId/cases/:caseId/reason", ...guildPost, async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const caseId = String(req.params.caseId);
      const record = await deps.data.getCase(ctx.guild.id, caseId);
      if (!record) return fail(res, 404, "Case not found", "No case or warning with that ID exists in this server.", ctx.viewer);
      const parsed = parseCaseReason(req.body as FormBody);
      if (!parsed.ok) {
        return send(res, renderCase(deps.site, ctx, record, { reasonError: parsed.errors.reason, reasonValue: String((req.body as FormBody).reason ?? "") }), 400);
      }
      const edited = await deps.data.editCaseReason(ctx.guild.id, caseId, parsed.value, actorOf(ctx));
      if (edited) await logAudit(ctx, "case.reason", caseId, describeChanges({ reason: record.reason }, { reason: parsed.value }));
      res.redirect(303, `/dashboard/${ctx.guild.id}/cases/${encodeURIComponent(caseId)}?notice=reason`);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:guildId/cases/:caseId/revoke", ...guildPost, async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const caseId = String(req.params.caseId);
      const caseUrl = `/dashboard/${ctx.guild.id}/cases/${encodeURIComponent(caseId)}`;
      const record = await deps.data.getCase(ctx.guild.id, caseId);
      if (!record) return fail(res, 404, "Case not found", "No case or warning with that ID exists in this server.", ctx.viewer);
      const wantsUnban = parseRevoke(req.body as FormBody).unban && record.kind === "case" && record.action === "ban";
      // Unbanning is checked before anything changes, so a refusal leaves the case as it was.
      if (wantsUnban) {
        const missing = await missingPermission(ctx, "BanMembers");
        if (missing) return fail(res, 403, "Missing permission", `Unbanning needs ${missing} in this server, the same as /unban. Nothing was changed.`, ctx.viewer);
      }
      const ok = await deps.data.revokeCase(ctx.guild.id, caseId, actorOf(ctx));
      if (!ok) return res.redirect(303, `${caseUrl}?notice=already-revoked`);
      if (!wantsUnban) {
        await logAudit(ctx, "case.revoke", caseId, `${record.action} for member ${record.userId}`);
        return res.redirect(303, `${caseUrl}?notice=revoked`);
      }
      const outcome = await deps.data.unbanCaseMember(ctx.guild.id, record, actorOf(ctx));
      await logAudit(ctx, "case.revoke+unban", caseId, `ban for member ${record.userId}; unban: ${outcome}`);
      const code = outcome === "done" ? "revoked-unbanned" : outcome === "not-banned" ? "revoked-not-banned" : "revoked-unban-failed";
      res.redirect(303, `${caseUrl}?notice=${code}`);
    } catch (err) {
      next(err);
    }
  });
}
