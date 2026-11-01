/** Staff digest page: /:guildId/digest and its settings form. Manage Server (the guild guard). */
import type { Router } from "express";
import { parseDigestSettings } from "../modmailValidation";
import { submittedValues } from "../views/form";
import { digestValues, renderDigest } from "../views/digest";
import type { FormBody } from "../validation";
import { type GuildLocals, type RouteKit } from "./context";

export function registerDigestRoutes(router: Router, k: RouteKit): void {
  const { deps, extras, send, logAudit, noticeParam, validationContext, guildGet, guildPost } = k;
  const locals = (res: { locals: Record<string, unknown> }) => (res.locals.dash as GuildLocals).ctx;

  router.get("/:guildId/digest", ...guildGet, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const [config, preview] = await Promise.all([extras.digest.config(ctx.guild.id), extras.digest.preview(ctx.guild.id).catch(() => null)]);
      send(res, renderDigest(deps.site, ctx, { config, preview, channels: deps.bot.textChannels(ctx.guild.id), noticeCode: noticeParam(req) }));
    } catch (err) { next(err); }
  });

  router.post("/:guildId/digest/settings", ...guildPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const body = (req.body ?? {}) as FormBody;
      const config = await extras.digest.config(ctx.guild.id);
      const parsed = parseDigestSettings(body, validationContext(ctx), config);
      if (!parsed.ok) {
        return send(res, renderDigest(deps.site, ctx, { config, preview: null, channels: deps.bot.textChannels(ctx.guild.id), noticeCode: null, state: { values: { ...digestValues(config), ...submittedValues(body) }, errors: parsed.errors } }), 400);
      }
      const c = parsed.value;
      await extras.digest.saveConfig(ctx.guild.id, c);
      await logAudit(ctx, "digest.settings", null, `${c.enabled ? "on" : "off"}, day ${c.day}, hour ${c.hour}, ${c.timezone}, channel ${c.channelId ?? "mod log"}`);
      res.redirect(303, `/dashboard/${ctx.guild.id}/digest?notice=digest-saved`);
    } catch (err) { next(err); }
  });
}
