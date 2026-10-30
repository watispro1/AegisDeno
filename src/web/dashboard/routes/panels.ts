/** Panels: /:guildId/panels and the ticket, verification and role panel posts. */
import type { Router } from "express";
import type { PanelResult } from "../data";
import { parseRolePanelRepost, parseTicketPanel, parseVerificationPanel, type FormBody } from "../validation";
import { renderPanels, submittedValues, type GuildContext, type PanelsState } from "../views";
import { type RouteKit, type GuildLocals } from "./context";

export function registerPanelRoutes(router: Router, k: RouteKit): void {
  const { deps, send, fail, missingPermission, requirePermission, actorOf, logAudit, noticeParam, validationContext, guildGet, guildPost } = k;

  /* ── Panels ──────────────────────────────────────────────────────── */

  async function panelsPage(ctx: GuildContext, noticeCode: string | null, state?: PanelsState): Promise<string> {
    const [rolePanels, snapshot, ticketsMissing, rolesMissing] = await Promise.all([
      deps.data.listRolePanels(ctx.guild.id),
      deps.data.loadSettings(ctx.guild.id),
      missingPermission(ctx, "ManageChannels"),
      missingPermission(ctx, "ManageRoles"),
    ]);
    return renderPanels(deps.site, ctx, {
      channels: deps.bot.textChannels(ctx.guild.id),
      hiddenChannelIds: deps.bot.hiddenChannelIds(ctx.guild.id),
      roles: deps.bot.roles(ctx.guild.id),
      rolePanels,
      verificationSetUp: snapshot.verification !== null,
      state,
      noticeCode,
      missing: { tickets: ticketsMissing, roles: rolesMissing },
    });
  }

  const panelNotice = (result: PanelResult, okCode: string) =>
    result === "posted" ? okCode : result === "channel-missing" ? "panel-channel-missing" : result === "not-found" ? "panel-not-found" : "panel-failed";

  router.get("/:guildId/panels", ...guildGet, async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      send(res, await panelsPage(ctx, noticeParam(req)));
    } catch (err) {
      next(err);
    }
  });

  router.post("/:guildId/panels/tickets", ...guildPost, requirePermission("ManageChannels"), async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const body = (req.body ?? {}) as FormBody;
      const parsed = parseTicketPanel(body, validationContext(ctx.guild.id));
      if (!parsed.ok) return send(res, await panelsPage(ctx, null, { form: "ticket", values: submittedValues(body), errors: parsed.errors }), 400);
      const result = await deps.data.postTicketPanel(ctx.guild.id, parsed.value, actorOf(ctx));
      if (result === "posted") await logAudit(ctx, "panel.ticket", parsed.value.channelId, `in channel ${parsed.value.channelId}${parsed.value.staffRoleId ? `, staff role ${parsed.value.staffRoleId}` : ""}`);
      res.redirect(303, `/dashboard/${ctx.guild.id}/panels?notice=${panelNotice(result, "panel-posted")}#tickets`);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:guildId/panels/verification", ...guildPost, requirePermission("ManageRoles"), async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const body = (req.body ?? {}) as FormBody;
      const parsed = parseVerificationPanel(body, validationContext(ctx.guild.id));
      if (!parsed.ok) return send(res, await panelsPage(ctx, null, { form: "verification", values: submittedValues(body), errors: parsed.errors }), 400);
      const result = await deps.data.setupVerificationPanel(ctx.guild.id, parsed.value, actorOf(ctx));
      if (result === "posted") {
        await logAudit(ctx, "panel.verification", parsed.value.channelId,
          `in channel ${parsed.value.channelId}, role ${parsed.value.verifiedRoleId}, ${parsed.value.type}, auto-kick ${parsed.value.kickUnverifiedMinutes} min`);
        return res.redirect(303, `/dashboard/${ctx.guild.id}/settings/verification?notice=verification-posted`);
      }
      res.redirect(303, `/dashboard/${ctx.guild.id}/panels?notice=${panelNotice(result, "panel-posted")}#verification`);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:guildId/panels/roles/:panelId", ...guildPost, requirePermission("ManageRoles"), async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const panelId = String(req.params.panelId);
      if (!/^panel-[\w-]{1,64}$/.test(panelId)) return fail(res, 404, "Panel not found", "That role panel does not exist.", ctx.viewer);
      const parsed = parseRolePanelRepost((req.body ?? {}) as FormBody, validationContext(ctx.guild.id));
      if (!parsed.ok) return res.redirect(303, `/dashboard/${ctx.guild.id}/panels?notice=panel-channel-missing#roles`);
      const result = await deps.data.repostRolePanel(ctx.guild.id, panelId, parsed.value.channelId, actorOf(ctx));
      if (result === "posted") await logAudit(ctx, "panel.role", panelId, `to channel ${parsed.value.channelId}`);
      res.redirect(303, `/dashboard/${ctx.guild.id}/panels?notice=${panelNotice(result, "rolepanel-posted")}#roles`);
    } catch (err) {
      next(err);
    }
  });
}
