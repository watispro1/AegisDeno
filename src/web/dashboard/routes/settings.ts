/** Settings: /:guildId/settings[/:section]. */
import type { Router } from "express";
import { describeChanges } from "../audit";
import type { SettingsSnapshot, SettingsValue } from "../data";
import { isSettingsSection, parseAutomod, parseEscalation, parseLogging, parseStarboard, parseTickets, parseVerification, parseWelcome, Errors, LOG_CATEGORY_LABELS, type FormBody, type Parsed, type SettingsSection, type ValidationContext } from "../validation";
import { parseGoodbye, parseLogChannels, parseWelcomeEmbed } from "../moduleValidation";
import { MULTI_FIELDS, renderSettings, settingsValues, submittedValues } from "../views";
import { type RouteKit, type GuildLocals } from "./context";

export function registerSettingsRoutes(router: Router, k: RouteKit): void {
  const { deps, send, fail, actorOf, logAudit, noticeParam, validationContext, rolesFor, guildGet, settingsPost } = k;

  /* ── Settings ────────────────────────────────────────────────────── */

  // GET /:guildId/settings (every module) lives in routes/community.ts.

  function parseSection(section: SettingsSection, body: FormBody, vctx: ValidationContext, current: SettingsSnapshot): Parsed<SettingsValue> {
    const wrap = <T>(p: Parsed<T>, make: (v: T) => SettingsValue): Parsed<SettingsValue> => (p.ok ? { ok: true, value: make(p.value) } : p);
    switch (section) {
      case "logging": {
        const base = parseLogging(body, vctx);
        const errors = new Errors();
        const logChannels = parseLogChannels(body, vctx, LOG_CATEGORY_LABELS.map(([k]) => k), errors);
        if (!base.ok || !errors.empty) return { ok: false, errors: { ...(base.ok ? {} : base.errors), ...errors.map } };
        return { ok: true, value: { section, value: { ...base.value, logChannels } } };
      }
      case "escalation": return wrap(parseEscalation(body), value => ({ section, value }));
      case "automod": return wrap(parseAutomod(body, vctx, current.automod), value => ({ section, value }));
      case "welcome": {
        const base = parseWelcome(body, vctx, { welcomeRoleId: current.guild.welcomeRoleId });
        const errors = new Errors();
        const welcomeEmbed = parseWelcomeEmbed(body, errors);
        if (!base.ok || !errors.empty) return { ok: false, errors: { ...(base.ok ? {} : base.errors), ...errors.map } };
        return { ok: true, value: { section, value: { ...base.value, welcomeEmbed } } };
      }
      case "goodbye": return wrap(parseGoodbye(body, vctx), value => ({ section, value }));
      case "tickets": return wrap(parseTickets(body, vctx), value => ({ section, value }));
      case "verification": return wrap(parseVerification(body, vctx, { verifiedRoleId: current.verification?.verifiedRoleId ?? null }), value => ({ section, value }));
      case "starboard": return wrap(parseStarboard(body, vctx, current.starboard), value => ({ section, value }));
    }
  }

  router.get("/:guildId/settings/:section", ...guildGet, async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const section = req.params.section;
      if (!isSettingsSection(section)) return fail(res, 404, "No such settings page", "Pick a section from the settings menu.", ctx.viewer);
      const snapshot = await deps.data.loadSettings(ctx.guild.id);
      send(res, renderSettings(
        deps.site, ctx, section, snapshot,
        { values: settingsValues(section, snapshot), errors: {} },
        deps.bot.textChannels(ctx.guild.id), rolesFor(ctx), noticeParam(req), deps.bot.hiddenChannelIds(ctx.guild.id),
      ));
    } catch (err) {
      next(err);
    }
  });

  router.post("/:guildId/settings/:section", ...settingsPost, async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const section = req.params.section;
      if (!isSettingsSection(section)) return fail(res, 404, "No such settings page", "Pick a section from the settings menu.", ctx.viewer);
      const body = (req.body ?? {}) as FormBody;
      const before = await deps.data.loadSettings(ctx.guild.id);
      const parsed = parseSection(section, body, validationContext(ctx), before);
      if (!parsed.ok) {
        // Keep display-only values that are not form fields.
        const values = { ...settingsValues(section, before), ...submittedValues(body) };
        for (const [key, v] of Object.entries(settingsValues(section, before))) {
          if (typeof v === "boolean" && !(key in body)) values[key] = false;
        }
        for (const key of MULTI_FIELDS[section] ?? []) if (!(key in body)) values[key] = "";
        return send(res, renderSettings(
          deps.site, ctx, section, before, { values, errors: parsed.errors },
          deps.bot.textChannels(ctx.guild.id), rolesFor(ctx), null, deps.bot.hiddenChannelIds(ctx.guild.id),
        ), 400);
      }
      const saved = await deps.data.saveSettings(ctx.guild.id, parsed.value, actorOf(ctx));
      if (saved) {
        const after = await deps.data.loadSettings(ctx.guild.id).catch(() => before);
        await logAudit(ctx, `settings.${section}`, null, describeChanges(settingsValues(section, before), settingsValues(section, after)));
      }
      res.redirect(303, `/dashboard/${ctx.guild.id}/settings/${section}?notice=${saved ? "saved" : "verification-missing"}`);
    } catch (err) {
      next(err);
    }
  });
}
