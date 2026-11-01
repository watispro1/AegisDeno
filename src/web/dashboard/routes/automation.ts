/**
 * Automation module routes: /:guildId/autoresponders, /automations and
 * /announce. Every route goes through the shared guards (session, CSRF on
 * posts, live guild check); actions that need more than Manage Server ask for
 * the same permission as their slash command.
 */
import type { Router } from "express";
import type { PanelResult } from "../data";
import { MAX_AUTORESPONDERS } from "../moduleData";
import { isResponderId, isTaskId, parseAnnouncement, parseAutoResponder, parseAutomation } from "../moduleValidation";
import { checkbox, type FormBody } from "../validation";
import { submittedValues, type GuildContext } from "../views";
import type { FormState } from "../views/form";
import { renderAnnounce, renderAutoResponders, renderAutomations } from "../views/automation";
import { type RouteKit, type GuildLocals } from "./context";

export function registerAutomationRoutes(router: Router, k: RouteKit): void {
  const { deps, modules, send, fail, actorOf, logAudit, noticeParam, validationContext, requirePermission, guildGet, guildPost, embedPost } = k;
  const locals = (res: { locals: Record<string, unknown> }) => (res.locals.dash as GuildLocals).ctx;
  /** Whether the Scheduled messages module is on (the Settings page switch); unreadable settings count as on. */
  const scheduledEnabled = async (guildId: string) =>
    (await deps.data.loadSettings(guildId).catch(() => null))?.guild.modules?.scheduled !== false;
  const panelNotice = (r: PanelResult, ok: string) => (r === "posted" ? ok : r === "channel-missing" ? "panel-channel-missing" : "panel-failed");

  /* ── Autoresponders ──────────────────────────────────────────────── */

  async function arPage(ctx: GuildContext, noticeCode: string | null, state?: FormState): Promise<string> {
    const [rows, snapshot] = await Promise.all([modules.listAutoResponders(ctx.guild.id), deps.data.loadSettings(ctx.guild.id)]);
    return renderAutoResponders(deps.site, ctx, { rows, enabled: snapshot.guild.autorespondersEnabled !== false, noticeCode, state, max: MAX_AUTORESPONDERS });
  }

  router.get("/:guildId/autoresponders", ...guildGet, async (req, res, next) => {
    try { send(res, await arPage(locals(res), noticeParam(req))); } catch (err) { next(err); }
  });

  router.post("/:guildId/autoresponders", ...guildPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const body = (req.body ?? {}) as FormBody;
      const parsed = parseAutoResponder(body);
      if (!parsed.ok) return send(res, await arPage(ctx, null, { values: submittedValues(body), errors: parsed.errors }), 400);
      const result = await modules.addAutoResponder(ctx.guild.id, parsed.value, actorOf(ctx));
      if (!result.ok) return send(res, await arPage(ctx, null, { values: submittedValues(body), errors: { trigger: result.error } }), 400);
      await logAudit(ctx, "autoresponder.add", result.detail ?? null, `trigger "${parsed.value.trigger.slice(0, 60)}" (${parsed.value.matchType})`);
      res.redirect(303, `/dashboard/${ctx.guild.id}/autoresponders?notice=ar-added`);
    } catch (err) { next(err); }
  });

  router.post("/:guildId/autoresponders/module", ...guildPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const enabled = checkbox((req.body ?? {}) as FormBody, "enabled");
      await modules.saveModuleConfig(ctx.guild.id, { autorespondersEnabled: enabled }, actorOf(ctx));
      await logAudit(ctx, "module.autoresponders", null, enabled ? "turned on" : "turned off");
      res.redirect(303, `/dashboard/${ctx.guild.id}/autoresponders?notice=${enabled ? "module-on" : "module-off"}`);
    } catch (err) { next(err); }
  });

  router.post("/:guildId/autoresponders/:id/:action", ...guildPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const id = String(req.params.id);
      const action = String(req.params.action);
      if (!isResponderId(id) || (action !== "toggle" && action !== "delete")) return fail(res, 404, "Not found", "That autoresponder does not exist.", ctx.viewer);
      if (action === "delete") {
        const ok = await modules.removeAutoResponder(ctx.guild.id, id);
        if (ok) await logAudit(ctx, "autoresponder.remove", id, "deleted");
        return res.redirect(303, `/dashboard/${ctx.guild.id}/autoresponders?notice=${ok ? "ar-removed" : "ar-missing"}`);
      }
      const enabled = checkbox((req.body ?? {}) as FormBody, "enabled");
      const ok = await modules.setAutoResponderEnabled(ctx.guild.id, id, enabled);
      if (ok) await logAudit(ctx, "autoresponder.toggle", id, enabled ? "turned on" : "turned off");
      res.redirect(303, `/dashboard/${ctx.guild.id}/autoresponders?notice=${ok ? (enabled ? "ar-on" : "ar-off") : "ar-missing"}`);
    } catch (err) { next(err); }
  });

  /* ── Scheduled messages ──────────────────────────────────────────── */

  async function taskPage(ctx: GuildContext, noticeCode: string | null, state?: FormState): Promise<string> {
    return renderAutomations(deps.site, ctx, {
      rows: await modules.listAutomations(ctx.guild.id),
      channels: deps.bot.textChannels(ctx.guild.id),
      hidden: deps.bot.hiddenChannelIds(ctx.guild.id),
      noticeCode, state,
      moduleOff: !(await scheduledEnabled(ctx.guild.id)),
    });
  }

  router.get("/:guildId/automations", ...guildGet, async (req, res, next) => {
    try { send(res, await taskPage(locals(res), noticeParam(req))); } catch (err) { next(err); }
  });

  router.post("/:guildId/automations", ...embedPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const body = (req.body ?? {}) as FormBody;
      if (!(await scheduledEnabled(ctx.guild.id))) return res.redirect(303, `/dashboard/${ctx.guild.id}/automations?notice=module-disabled`);
      const parsed = parseAutomation(body, validationContext(ctx));
      if (!parsed.ok) return send(res, await taskPage(ctx, null, { values: submittedValues(body), errors: parsed.errors }), 400);
      const result = await modules.createAutomation(ctx.guild.id, parsed.value, actorOf(ctx));
      if (result === "posted") {
        await logAudit(ctx, "automation.create", parsed.value.channelId,
          `in channel ${parsed.value.channelId}, in ${Math.round(parsed.value.delayMs / 60_000)} min${parsed.value.intervalMs ? `, every ${Math.round(parsed.value.intervalMs / 60_000)} min` : ""}`);
      }
      res.redirect(303, `/dashboard/${ctx.guild.id}/automations?notice=${panelNotice(result, "task-created")}`);
    } catch (err) { next(err); }
  });

  router.post("/:guildId/automations/:id/cancel", ...guildPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const id = String(req.params.id);
      if (!isTaskId(id)) return fail(res, 404, "Not found", "That scheduled message does not exist.", ctx.viewer);
      const ok = await modules.cancelAutomation(ctx.guild.id, id);
      if (ok) await logAudit(ctx, "automation.cancel", id, "cancelled");
      res.redirect(303, `/dashboard/${ctx.guild.id}/automations?notice=${ok ? "task-cancelled" : "task-missing"}`);
    } catch (err) { next(err); }
  });

  /* ── Announcements (embed builder) ───────────────────────────────── */

  const announcePage = (ctx: GuildContext, noticeCode: string | null, state?: FormState) => renderAnnounce(deps.site, ctx, {
    channels: deps.bot.textChannels(ctx.guild.id), hidden: deps.bot.hiddenChannelIds(ctx.guild.id), noticeCode, state,
  });

  router.get("/:guildId/announce", ...guildGet, (req, res) => {
    send(res, announcePage(locals(res), noticeParam(req)));
  });

  // Same permission as /announce and /embed.
  router.post("/:guildId/announce", ...embedPost, requirePermission("ManageMessages"), async (req, res, next) => {
    try {
      const ctx = locals(res);
      const body = (req.body ?? {}) as FormBody;
      const parsed = parseAnnouncement(body, validationContext(ctx));
      if (!parsed.ok) return send(res, announcePage(ctx, null, { values: submittedValues(body), errors: parsed.errors }), 400);
      const result = await modules.postEmbed(ctx.guild.id, parsed.value.channelId, parsed.value.content, parsed.value.embed, actorOf(ctx));
      if (result === "posted") await logAudit(ctx, "announce.post", parsed.value.channelId, `embed "${(parsed.value.embed.title ?? "untitled").slice(0, 60)}" to channel ${parsed.value.channelId}`);
      res.redirect(303, `/dashboard/${ctx.guild.id}/announce?notice=${panelNotice(result, "announced")}`);
    } catch (err) { next(err); }
  });
}
