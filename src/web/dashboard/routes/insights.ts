/** Analytics (/:guildId/analytics) and Modules & backup (/:guildId/tools[/modules|/export|/import]). */
import express, { type Router } from "express";
import { normalizeModuleSwitches, MODULE_SWITCH_KEYS } from "../../../services/guildConfigNormalize";
import { parseModuleSwitches } from "../extrasValidation";
import { exportSettings, parseSettingsImport } from "../settingsTransfer";
import { ANALYTICS_RANGES, renderAnalytics, renderTools } from "../views/insights";
import type { FormBody } from "../validation";
import type { GuildContext } from "../views";
import { type GuildLocals, type RouteKit } from "./context";

/** Import bodies carry a whole settings file (a full word list URL-encodes to a few hundred KB). */
export const IMPORT_FORM_LIMIT = "512kb";

export function registerInsightRoutes(router: Router, k: RouteKit): void {
  const { deps, extras, send, logAudit, noticeParam, validationContext, guildGet, guildPost, postLimit, requireSession, requireCsrf, requireGuild } = k;
  const locals = (res: { locals: Record<string, unknown> }) => (res.locals.dash as GuildLocals).ctx;
  const importForm = express.urlencoded({ extended: false, limit: IMPORT_FORM_LIMIT, parameterLimit: 10 });
  const importPost = [postLimit, importForm, requireSession, requireCsrf, requireGuild];

  router.get("/:guildId/analytics", ...guildGet, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const asked = Number(typeof req.query.days === "string" ? req.query.days : 30);
      const days = (ANALYTICS_RANGES as readonly number[]).includes(asked) ? asked : 30;
      send(res, renderAnalytics(deps.site, ctx, { days, data: await extras.analytics(ctx.guild.id, days) }));
    } catch (err) { next(err); }
  });

  const switchesOf = async (ctx: GuildContext) => normalizeModuleSwitches((await deps.data.loadSettings(ctx.guild.id)).guild.modules);

  router.get("/:guildId/tools", ...guildGet, async (req, res, next) => {
    try {
      const ctx = locals(res);
      send(res, renderTools(deps.site, ctx, { switches: await switchesOf(ctx), noticeCode: noticeParam(req) }));
    } catch (err) { next(err); }
  });

  router.post("/:guildId/tools/modules", ...guildPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const before = await switchesOf(ctx);
      const after = parseModuleSwitches((req.body ?? {}) as FormBody);
      await extras.saveModuleSwitches(ctx.guild.id, after);
      const changed = MODULE_SWITCH_KEYS.filter(key => before[key] !== after[key]).map(key => `${key} ${after[key] ? "on" : "off"}`);
      await logAudit(ctx, "modules.save", null, changed.length ? changed.join(", ") : "no change");
      res.redirect(303, `/dashboard/${ctx.guild.id}/tools?notice=modules-saved`);
    } catch (err) { next(err); }
  });

  router.get("/:guildId/tools/export", ...guildGet, async (_req, res, next) => {
    try {
      const ctx = locals(res);
      const snapshot = await deps.data.loadSettings(ctx.guild.id);
      const file = exportSettings(ctx.guild.id, ctx.guild.name, snapshot.guild, snapshot.automod);
      await logAudit(ctx, "settings.export", null, "downloaded a settings export");
      res.setHeader("Content-Disposition", `attachment; filename="aegis-settings-${ctx.guild.id}.json"`);
      res.status(200).type("application/json").send(JSON.stringify(file, null, 2));
    } catch (err) { next(err); }
  });

  router.post("/:guildId/tools/import", ...importPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const text = String((req.body as FormBody)?.json ?? "");
      const parsed = parseSettingsImport(text, validationContext(ctx));
      const switches = await switchesOf(ctx);
      if (!parsed.ok) return send(res, renderTools(deps.site, ctx, { switches, noticeCode: null, importError: parsed.error, importText: text.slice(0, 200_000) }), 400);
      await extras.applySettingsImport(ctx.guild.id, parsed.update, parsed.automod as Record<string, unknown> | null);
      await logAudit(ctx, "settings.import", null, `imported settings${parsed.warnings.length ? ` with ${parsed.warnings.length} adjustment(s)` : ""}`);
      if (!parsed.warnings.length) return res.redirect(303, `/dashboard/${ctx.guild.id}/tools?notice=import-done`);
      send(res, renderTools(deps.site, ctx, { switches: normalizeModuleSwitches(parsed.update.modules), noticeCode: "import-done", importWarnings: parsed.warnings }));
    } catch (err) { next(err); }
  });
}
