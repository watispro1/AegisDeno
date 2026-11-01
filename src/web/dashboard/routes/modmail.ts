/** ModMail page: /:guildId/modmail, its settings, block list and transcripts. Manage Server (the guild guard). */
import type { Router } from "express";
import { parseModmailBlock, parseModmailSettings } from "../modmailValidation";
import { submittedValues } from "../views/form";
import { modmailValues, renderModmail, renderTranscript } from "../views/modmail";
import type { FormBody } from "../validation";
import { type GuildLocals, type RouteKit } from "./context";

export function registerModmailRoutes(router: Router, k: RouteKit): void {
  const { deps, extras, send, fail, logAudit, noticeParam, validationContext, rolesFor, guildGet, guildPost, embedPost } = k;
  const locals = (res: { locals: Record<string, unknown> }) => (res.locals.dash as GuildLocals).ctx;
  const channelsFor = (id: string) => deps.bot.textChannels(id);

  router.get("/:guildId/modmail", ...guildGet, async (req, res, next) => {
    try {
      const ctx = locals(res);
      send(res, renderModmail(deps.site, ctx, { overview: await extras.modmail.overview(ctx.guild.id), channels: channelsFor(ctx.guild.id), roles: rolesFor(ctx), noticeCode: noticeParam(req) }));
    } catch (err) { next(err); }
  });

  router.get("/:guildId/modmail/:ticketId", ...guildGet, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const id = String(req.params.ticketId ?? "");
      const t = /^[0-9a-f]{24}$/i.test(id) ? await extras.modmail.transcript(ctx.guild.id, id) : null;
      if (!t) return fail(res, 404, "Transcript not found", "It may have been deleted (transcripts are kept for 90 days), or the link is wrong.");
      send(res, renderTranscript(deps.site, ctx, t));
    } catch (err) { next(err); }
  });

  router.post("/:guildId/modmail/settings", ...embedPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const body = (req.body ?? {}) as FormBody;
      const overview = await extras.modmail.overview(ctx.guild.id);
      const parsed = parseModmailSettings(body, validationContext(ctx), overview.config);
      if (!parsed.ok) {
        return send(res, renderModmail(deps.site, ctx, { overview, channels: channelsFor(ctx.guild.id), roles: rolesFor(ctx), noticeCode: null, state: { values: { ...modmailValues(overview.config), ...submittedValues(body) }, errors: parsed.errors } }), 400);
      }
      await extras.modmail.saveConfig(ctx.guild.id, parsed.value);
      const c = parsed.value;
      await logAudit(ctx, "modmail.settings", null, `${c.enabled ? "on" : "off"}, channel ${c.channelId ?? "none"}, staff role ${c.staffRoleId ?? "none"}, ping ${c.pingStaff ? "on" : "off"}`);
      res.redirect(303, `/dashboard/${ctx.guild.id}/modmail?notice=modmail-saved`);
    } catch (err) { next(err); }
  });

  for (const action of ["block", "unblock"] as const) {
    router.post(`/:guildId/modmail/${action}`, ...guildPost, async (req, res, next) => {
      try {
        const ctx = locals(res);
        const overview = await extras.modmail.overview(ctx.guild.id);
        const parsed = parseModmailBlock((req.body ?? {}) as FormBody, overview.config, action === "block");
        if (!parsed.ok) return fail(res, 400, "Not a user ID", Object.values(parsed.errors)[0] ?? "Enter a Discord user ID.");
        if (action === "block" && parsed.value.userId === ctx.viewer.userId) return fail(res, 400, "Can't block yourself", "Pick someone else.");
        await extras.modmail.saveConfig(ctx.guild.id, parsed.value.config);
        await logAudit(ctx, `modmail.${action}`, parsed.value.userId, `${action}ed ${parsed.value.userId}`);
        res.redirect(303, `/dashboard/${ctx.guild.id}/modmail?notice=modmail-${action}ed`);
      } catch (err) { next(err); }
    });
  }
}
