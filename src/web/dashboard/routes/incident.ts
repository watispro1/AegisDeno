/** Incident Mode pages: /:guildId/incident[/:id], start, end and defaults. Manage Server (the guild guard). */
import type { Router } from "express";
import { normalizeIncidentConfig } from "../../../services/incidentLogic";
import { parseIncidentSettings, parseIncidentStart } from "../extrasValidation";
import { submittedValues } from "../views/form";
import { incidentValues, renderIncident, renderIncidentReport } from "../views/incident";
import type { FormBody } from "../validation";
import type { GuildContext } from "../views";
import { type GuildLocals, type RouteKit } from "./context";

const INCIDENT_ID = /^[0-9a-f-]{36}$/;

/** Multi-value fields come back as lists; the form shows them joined. */
function formValues(body: FormBody) {
  const v = submittedValues(body);
  for (const key of ["slowmodeChannelIds", "lockChannelIds"]) {
    const raw = body[key];
    v[key] = Array.isArray(raw) ? raw.join(",") : typeof raw === "string" ? raw : "";
  }
  return v;
}

export function registerIncidentRoutes(router: Router, k: RouteKit): void {
  const { deps, extras, send, fail, actorOf, logAudit, noticeParam, validationContext, guildGet, guildPost } = k;
  const locals = (res: { locals: Record<string, unknown> }) => (res.locals.dash as GuildLocals).ctx;

  async function page(ctx: GuildContext, noticeCode: string | null, states: { start?: { values: Record<string, string | boolean>; errors: Record<string, string> }; settings?: { values: Record<string, string | boolean>; errors: Record<string, string> } } = {}) {
    const id = ctx.guild.id;
    const [active, recent, snapshot] = await Promise.all([
      extras.incidents.active(id),
      extras.incidents.list(id, 10),
      deps.data.loadSettings(id).catch(() => null),
    ]);
    return renderIncident(deps.site, ctx, {
      active, recent, config: normalizeIncidentConfig(snapshot?.guild.incident),
      channels: deps.bot.textChannels(id), hidden: deps.bot.hiddenChannelIds(id),
      noticeCode, startState: states.start, settingsState: states.settings,
    });
  }

  router.get("/:guildId/incident", ...guildGet, async (req, res, next) => {
    try { send(res, await page(locals(res), noticeParam(req))); } catch (err) { next(err); }
  });

  router.get("/:guildId/incident/:id", ...guildGet, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const id = String(req.params.id);
      const rec = INCIDENT_ID.test(id) ? await extras.incidents.get(ctx.guild.id, id) : null;
      if (!rec) return fail(res, 404, "Incident not found", "No incident with that ID exists in this server. Reports are kept for 90 days.", ctx.viewer);
      send(res, renderIncidentReport(deps.site, ctx, rec));
    } catch (err) { next(err); }
  });

  router.post("/:guildId/incident/start", ...guildPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const body = (req.body ?? {}) as FormBody;
      const parsed = parseIncidentStart(body, validationContext(ctx));
      if (!parsed.ok) return send(res, await page(ctx, null, { start: { values: formValues(body), errors: parsed.errors } }), 400);
      const result = await extras.incidents.start(ctx.guild.id, parsed.value.options, parsed.value.reason, actorOf(ctx));
      if (!result.ok) return res.redirect(303, `/dashboard/${ctx.guild.id}/incident?notice=${result.error === "busy" ? "incident-busy" : "incident-active"}`);
      await logAudit(ctx, "incident.start", result.incident.id,
        `slowmode ${parsed.value.options.slowmodeSeconds}s, lock ${parsed.value.options.lockMode}, gate ${parsed.value.options.joinGate}, ${parsed.value.options.durationMinutes} min: ${result.applied.length} channel(s) changed`);
      res.redirect(303, `/dashboard/${ctx.guild.id}/incident?notice=incident-started`);
    } catch (err) { next(err); }
  });

  router.post("/:guildId/incident/end", ...guildPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const reason = String((req.body as FormBody)?.reason ?? "").trim().slice(0, 300) || "Ended from the dashboard";
      const result = await extras.incidents.end(ctx.guild.id, reason, actorOf(ctx));
      if (!result.ok) return res.redirect(303, `/dashboard/${ctx.guild.id}/incident?notice=${result.error === "busy" ? "incident-busy" : "incident-not-active"}`);
      await logAudit(ctx, "incident.end", result.incident.id, `restored ${result.restored} channel(s)${result.notes.length ? `, ${result.notes.length} note(s)` : ""}`);
      res.redirect(303, `/dashboard/${ctx.guild.id}/incident/${result.incident.id}?notice=incident-ended`);
    } catch (err) { next(err); }
  });

  router.post("/:guildId/incident/settings", ...guildPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const body = (req.body ?? {}) as FormBody;
      const parsed = parseIncidentSettings(body, validationContext(ctx));
      if (!parsed.ok) return send(res, await page(ctx, null, { settings: { values: { ...incidentValues(normalizeIncidentConfig(undefined).defaults), ...formValues(body) }, errors: parsed.errors } }), 400);
      await extras.saveIncidentConfig(ctx.guild.id, parsed.value);
      await logAudit(ctx, "incident.settings", null, `auto-trigger ${parsed.value.autoTrigger.enabled ? `on (${parsed.value.autoTrigger.joins} joins / ${parsed.value.autoTrigger.seconds}s)` : "off"}`);
      res.redirect(303, `/dashboard/${ctx.guild.id}/incident?notice=incident-saved`);
    } catch (err) { next(err); }
  });
}
