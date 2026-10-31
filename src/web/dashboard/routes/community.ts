/**
 * Community module routes: /:guildId/giveaways, /suggestions, /watchlist and
 * the general /settings page. Same guards as every dashboard route.
 */
import type { Router } from "express";
import { isMessageId, isSuggestionId, parseSuggestionChannel, parseSuggestionFilter, parseSuggestionReview } from "../moduleValidation";
import { isSnowflake } from "../permissions";
import type { FormBody } from "../validation";
import { submittedValues, type GuildContext } from "../views";
import type { FormState } from "../views/form";
import { renderGeneralSettings, renderGiveaways, renderSuggestions, renderWatchlist } from "../views/community";
import { moduleStates } from "../views/overview";
import { type RouteKit, type GuildLocals } from "./context";

export const SUGGESTIONS_PER_PAGE = 20;

export function registerCommunityRoutes(router: Router, k: RouteKit): void {
  const { deps, modules, send, fail, actorOf, logAudit, noticeParam, validationContext, requirePermission, guildGet, guildPost } = k;
  const locals = (res: { locals: Record<string, unknown> }) => (res.locals.dash as GuildLocals).ctx;

  /* ── Settings (all modules) ──────────────────────────────────────── */

  router.get("/:guildId/settings", ...guildGet, async (_req, res, next) => {
    try {
      const ctx = locals(res);
      const id = ctx.guild.id;
      const soft = <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
      const [data, snapshot, extras, panels] = await Promise.all([
        deps.data.overview(id), deps.data.loadSettings(id), soft(modules.overviewExtras(id)), soft(deps.data.listRolePanels(id)),
      ]);
      send(res, renderGeneralSettings(deps.site, ctx, {
        states: moduleStates(id, data, { snapshot, extras, rolePanels: panels?.length ?? 0 }),
        missingBotPermissions: deps.bot.botMissingPermissions?.(id) ?? [],
        hiddenCount: deps.bot.hiddenChannelIds(id).size,
      }));
    } catch (err) { next(err); }
  });

  /* ── Giveaways ───────────────────────────────────────────────────── */

  router.get("/:guildId/giveaways", ...guildGet, async (req, res, next) => {
    try {
      const ctx = locals(res);
      send(res, renderGiveaways(deps.site, ctx, { rows: await modules.listGiveaways(ctx.guild.id), channels: deps.bot.textChannels(ctx.guild.id), noticeCode: noticeParam(req) }));
    } catch (err) { next(err); }
  });

  router.post("/:guildId/giveaways/:messageId/:action", ...guildPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const messageId = String(req.params.messageId);
      const action = String(req.params.action);
      if (!isMessageId(messageId) || (action !== "end" && action !== "reroll")) return fail(res, 404, "Not found", "That giveaway does not exist.", ctx.viewer);
      const result = action === "end"
        ? await modules.endGiveaway(ctx.guild.id, messageId, actorOf(ctx))
        : await modules.rerollGiveaway(ctx.guild.id, messageId, actorOf(ctx));
      if (result.ok) await logAudit(ctx, `giveaway.${action}`, messageId, action === "end" ? "ended early" : "rerolled");
      res.redirect(303, `/dashboard/${ctx.guild.id}/giveaways?notice=${result.ok ? (action === "end" ? "gw-ended" : "gw-rerolled") : "gw-failed"}`);
    } catch (err) { next(err); }
  });

  /* ── Suggestions ─────────────────────────────────────────────────── */

  async function suggestionsPage(ctx: GuildContext, query: Record<string, unknown>, noticeCode: string | null, state?: FormState): Promise<string> {
    const { filter, page } = parseSuggestionFilter(query);
    const [list, snapshot] = await Promise.all([
      modules.listSuggestions(ctx.guild.id, filter, page, SUGGESTIONS_PER_PAGE),
      deps.data.loadSettings(ctx.guild.id),
    ]);
    return renderSuggestions(deps.site, ctx, {
      ...list, page, perPage: SUGGESTIONS_PER_PAGE, filter,
      channelId: snapshot.guild.suggestionsChannelId,
      channels: deps.bot.textChannels(ctx.guild.id), hidden: deps.bot.hiddenChannelIds(ctx.guild.id),
      noticeCode, state,
    });
  }

  router.get("/:guildId/suggestions", ...guildGet, async (req, res, next) => {
    try { send(res, await suggestionsPage(locals(res), req.query as Record<string, unknown>, noticeParam(req))); } catch (err) { next(err); }
  });

  router.post("/:guildId/suggestions/channel", ...guildPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const body = (req.body ?? {}) as FormBody;
      const parsed = parseSuggestionChannel(body, validationContext(ctx));
      if (!parsed.ok) return send(res, await suggestionsPage(ctx, {}, null, { values: submittedValues(body), errors: parsed.errors }), 400);
      await modules.saveModuleConfig(ctx.guild.id, parsed.value, actorOf(ctx));
      await logAudit(ctx, "module.suggestions", parsed.value.suggestionsChannelId, parsed.value.suggestionsChannelId ? `channel ${parsed.value.suggestionsChannelId}` : "turned off");
      res.redirect(303, `/dashboard/${ctx.guild.id}/suggestions?notice=saved`);
    } catch (err) { next(err); }
  });

  router.post("/:guildId/suggestions/:id/review", ...guildPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const id = String(req.params.id);
      if (!isSuggestionId(id)) return fail(res, 404, "Not found", "That suggestion does not exist.", ctx.viewer);
      const parsed = parseSuggestionReview((req.body ?? {}) as FormBody);
      if (!parsed.ok) return fail(res, 400, "Pick a decision", Object.values(parsed.errors)[0], ctx.viewer);
      const result = await modules.reviewSuggestion(ctx.guild.id, id, parsed.value.action, parsed.value.note, actorOf(ctx));
      if (result.ok) await logAudit(ctx, `suggestion.${parsed.value.action}`, id, parsed.value.note ? `note: ${parsed.value.note.slice(0, 80)}` : "no note");
      res.redirect(303, `/dashboard/${ctx.guild.id}/suggestions?notice=${result.ok ? "sg-reviewed" : "sg-failed"}`);
    } catch (err) { next(err); }
  });

  /* ── Ghost Watch (the viewer's own list) ─────────────────────────── */

  router.get("/:guildId/watchlist", ...guildGet, async (req, res, next) => {
    try {
      const ctx = locals(res);
      send(res, renderWatchlist(deps.site, ctx, { rows: await modules.listWatches(ctx.guild.id, ctx.viewer.userId), noticeCode: noticeParam(req) }));
    } catch (err) { next(err); }
  });

  // Same permission as /watchlist.
  router.post("/:guildId/watchlist/:targetId/remove", ...guildPost, requirePermission("ModerateMembers"), async (req, res, next) => {
    try {
      const ctx = locals(res);
      const targetId = String(req.params.targetId);
      if (!isSnowflake(targetId)) return fail(res, 404, "Not found", "That member is not on your list.", ctx.viewer);
      const ok = await modules.removeWatch(ctx.guild.id, targetId, ctx.viewer.userId);
      if (ok) await logAudit(ctx, "watchlist.remove", targetId, "removed from own Ghost Watch list");
      res.redirect(303, `/dashboard/${ctx.guild.id}/watchlist?notice=${ok ? "watch-removed" : "watch-missing"}`);
    } catch (err) { next(err); }
  });
}
