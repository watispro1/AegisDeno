/** Trust Score page: /:guildId/trust and its settings form. Manage Server (the guild guard). */
import type { Router } from "express";
import { parseTrustSettings } from "../extrasValidation";
import { submittedValues } from "../views/form";
import { renderTrust, trustValues } from "../views/trust";
import type { FormBody } from "../validation";
import { type GuildLocals, type RouteKit } from "./context";

export function registerTrustRoutes(router: Router, k: RouteKit): void {
  const { deps, extras, send, logAudit, noticeParam, validationContext, rolesFor, guildGet, guildPost } = k;
  const locals = (res: { locals: Record<string, unknown> }) => (res.locals.dash as GuildLocals).ctx;

  router.get("/:guildId/trust", ...guildGet, async (req, res, next) => {
    try {
      const ctx = locals(res);
      send(res, renderTrust(deps.site, ctx, { overview: await extras.trust.overview(ctx.guild.id), roles: rolesFor(ctx), noticeCode: noticeParam(req) }));
    } catch (err) { next(err); }
  });

  router.post("/:guildId/trust/settings", ...guildPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const body = (req.body ?? {}) as FormBody;
      const overview = await extras.trust.overview(ctx.guild.id);
      const parsed = parseTrustSettings(body, validationContext(ctx), overview.config);
      if (!parsed.ok) {
        return send(res, renderTrust(deps.site, ctx, { overview, roles: rolesFor(ctx), noticeCode: null, state: { values: { ...trustValues(overview.config), ...submittedValues(body) }, errors: parsed.errors } }), 400);
      }
      await extras.trust.saveConfig(ctx.guild.id, parsed.value);
      const c = parsed.value;
      await logAudit(ctx, "trust.settings", null, `integrations ${c.enabled ? "on" : "off"}, ${c.preset}, threshold ${c.lowThreshold}, links ${c.linkFilterLowTrustOnly ? "low-trust only" : "everyone"}, incident gate ${c.incidentGate ? "on" : "off"}, role ${c.lowTrustRoleId ?? "none"}`);
      res.redirect(303, `/dashboard/${ctx.guild.id}/trust?notice=trust-saved`);
    } catch (err) { next(err); }
  });
}
