/**
 * Economy page: /:guildId/economy, its switch and settings, the shop editor
 * and staff balance adjustments. Manage Server (the guild guard), CSRF on
 * every POST, the POST rate limit plus a tighter one for adjustments, and an
 * audit entry for every change.
 */
import type { Request, Response, Router } from "express";
import { parseAdjustForm, parseEconomySettings, parseShopItemForm } from "../economyValidation";
import { submittedValues } from "../views/form";
import { ECONOMY_LEADERBOARD_PAGE, ECONOMY_TX_LIMIT, economyValues, itemValues, renderEconomy, type EconomyPageState } from "../views/economy";
import { formatCoins } from "../../../services/economyLogic";
import type { FormBody } from "../validation";
import type { GuildContext } from "../views";
import { type GuildLocals, type RouteKit } from "./context";

const OBJECT_ID = /^[0-9a-f]{24}$/i;

export function registerEconomyRoutes(router: Router, k: RouteKit): void {
  const { deps, extras, send, fail, logAudit, noticeParam, validationContext, rolesFor, guildGet, guildPost, adjustLimit } = k;
  const locals = (res: Response) => (res.locals.dash as GuildLocals).ctx;
  const svc = () => extras.economy;
  const back = (res: Response, ctx: GuildContext, code: string, hash = "") => res.redirect(303, `/dashboard/${ctx.guild.id}/economy?notice=${code}${hash}`);

  async function page(req: Request, res: Response, ctx: GuildContext, pageState?: EconomyPageState, status = 200) {
    const guildId = ctx.guild.id;
    const raw = Number.parseInt(String(req.query.page ?? "1"), 10);
    const requested = Number.isFinite(raw) && raw >= 1 && raw <= 10_000 ? raw : 1;
    const [config, items, transactions, first] = await Promise.all([
      svc().config(guildId), svc().items(guildId), svc().recentTransactions(guildId, ECONOMY_TX_LIMIT),
      svc().leaderboard(guildId, requested, ECONOMY_LEADERBOARD_PAGE),
    ]);
    const pages = Math.max(1, Math.ceil(first.total / ECONOMY_LEADERBOARD_PAGE));
    const pageNo = Math.min(requested, pages);
    const lb = pageNo === requested ? first : await svc().leaderboard(guildId, pageNo, ECONOMY_LEADERBOARD_PAGE);
    send(res, renderEconomy(deps.site, ctx, {
      config, items, transactions, roles: rolesFor(ctx), noticeCode: pageState ? null : noticeParam(req),
      leaderboard: { ...lb, page: pageNo }, pageState,
    }), status);
  }

  router.get("/:guildId/economy", ...guildGet, async (req, res, next) => {
    try { await page(req, res, locals(res)); } catch (err) { next(err); }
  });

  router.post("/:guildId/economy/toggle", ...guildPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const enabled = String((req.body as FormBody)?.enabled ?? "") === "on";
      await svc().updateConfig(ctx.guild.id, { enabled });
      await logAudit(ctx, "economy.toggle", null, enabled ? "turned the economy on" : "turned the economy off");
      back(res, ctx, enabled ? "economy-on" : "economy-off");
    } catch (err) { next(err); }
  });

  router.post("/:guildId/economy/settings", ...guildPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const body = (req.body ?? {}) as FormBody;
      const saved = await svc().config(ctx.guild.id);
      const parsed = parseEconomySettings(body, saved);
      if (!parsed.ok) return page(req, res, ctx, { form: "settings", state: { values: { ...economyValues(saved), ...submittedValues(body) }, errors: parsed.errors } }, 400);
      const r = await svc().updateConfig(ctx.guild.id, parsed.value);
      if (!r.ok) return page(req, res, ctx, { form: "settings", state: { values: { ...economyValues(saved), ...submittedValues(body) }, errors: r.errors as Record<string, string> } }, 400);
      const c = r.value;
      await logAudit(ctx, "economy.settings", null, `${c.enabled ? "on" : "off"}, ${c.currencyName}, daily ${c.dailyAmount}/${c.dailyCooldownHours}h +${c.dailyStreakBonus}, work ${c.workMin}-${c.workMax}/${c.workCooldownMinutes}m, confirm ≥${c.payConfirmThreshold}`);
      back(res, ctx, "economy-saved");
    } catch (err) { next(err); }
  });

  router.post("/:guildId/economy/shop/add", ...guildPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const body = (req.body ?? {}) as FormBody;
      const again = (errors: Record<string, string>) => page(req, res, ctx, { form: "add", state: { values: { ...itemValues(null), ...submittedValues(body) }, errors } }, 400);
      const parsed = parseShopItemForm(body, validationContext(ctx), ctx.guild.id);
      if (!parsed.ok) return again(parsed.errors);
      const r = await svc().addItem(ctx.guild.id, parsed.value);
      if (!r.ok) return again(r.errors as Record<string, string>);
      await logAudit(ctx, "economy.shop.add", r.value.id, `added "${r.value.name}" for ${r.value.price}${r.value.roleId ? `, role ${r.value.roleId}` : ""}${r.value.stock === null ? "" : `, stock ${r.value.stock}`}`);
      back(res, ctx, "economy-item-added", "#eco-shop-h");
    } catch (err) { next(err); }
  });

  router.post("/:guildId/economy/shop/:itemId/edit", ...guildPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const id = String(req.params.itemId ?? "");
      const item = OBJECT_ID.test(id) ? await svc().item(ctx.guild.id, id) : null;
      if (!item) return fail(res, 404, "Item not found", "It may have been removed. Reload the Economy page.", ctx.viewer);
      const body = (req.body ?? {}) as FormBody;
      const again = (errors: Record<string, string>) => page(req, res, ctx, { form: `edit:${item.id}`, state: { values: { ...itemValues(item), ...submittedValues(body) }, errors } }, 400);
      const parsed = parseShopItemForm(body, validationContext(ctx), ctx.guild.id);
      if (!parsed.ok) return again(parsed.errors);
      const r = await svc().editItem(ctx.guild.id, item.id, parsed.value);
      if (!r.ok) return again(r.errors as Record<string, string>);
      await logAudit(ctx, "economy.shop.edit", item.id, `edited "${item.name}" → "${r.value.name}", ${r.value.price}${r.value.roleId ? `, role ${r.value.roleId}` : ""}`);
      back(res, ctx, "economy-item-saved", "#eco-shop-h");
    } catch (err) { next(err); }
  });

  router.post("/:guildId/economy/shop/:itemId/remove", ...guildPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const id = String(req.params.itemId ?? "");
      const removed = OBJECT_ID.test(id) ? await svc().removeItem(ctx.guild.id, id) : null;
      if (!removed) return back(res, ctx, "economy-item-missing", "#eco-shop-h");
      await logAudit(ctx, "economy.shop.remove", removed.id, `removed "${removed.name}"`);
      back(res, ctx, "economy-item-removed", "#eco-shop-h");
    } catch (err) { next(err); }
  });

  router.post("/:guildId/economy/adjust", adjustLimit, ...guildPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const body = (req.body ?? {}) as FormBody;
      const again = (errors: Record<string, string>, status = 400) => page(req, res, ctx, { form: "adjust", state: { values: { userId: "", action: "give", amount: "", reason: "", ...submittedValues(body) }, errors } }, status);
      const parsed = parseAdjustForm(body);
      if (!parsed.ok) return again(parsed.errors);
      const { userId, action, amount, reason } = parsed.value;
      const member = await extras.member(ctx.guild.id, userId).catch(() => null);
      if (!member) return again({ userId: "Discord has no user with that ID." });
      if (member.bot) return again({ userId: "Bots don't have balances." });
      const config = await svc().config(ctx.guild.id);
      const r = await svc().adjust(ctx.guild.id, userId, action, amount, ctx.viewer.userId, reason);
      if (!r.ok) {
        return again({ amount: r.reason === "insufficient"
          ? `They only have ${formatCoins(config, r.balance)}. Nothing was changed.`
          : `That would put them over the maximum balance. Nothing was changed.` }, 409);
      }
      await logAudit(ctx, `economy.${action}`, userId, `${action}${action === "reset" ? ` (was ${r.previous})` : ` ${amount}`} → ${r.balance}${reason ? `: ${reason.slice(0, 120)}` : ""}`);
      back(res, ctx, "economy-adjusted", "#eco-tx-h");
    } catch (err) { next(err); }
  });
}
