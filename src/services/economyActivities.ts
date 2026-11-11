/**
 * The newer economy operations: /work with levels and boosts, bank interest,
 * /rob, and effect items (rob shields, work boosts). Same rules as
 * economyFlows.ts: every balance change is one guarded store.apply (a single
 * findOneAndUpdate in Mongo), cooldowns are claimed in the same update that
 * pays, and a roll happens once per attempt so losing a race never earns a
 * re-roll.
 */
import { logger } from "../utils/logger";
import { MAX_BALANCE, type EconomyConfig } from "./economyConfig";
import type { ShopItem } from "./economyLogic";
import {
  INTEREST_COOLDOWN_MS, activeBoost, boostedPay, levelBonusPercent, planEffect, planInterest, robFine, robRefusal, robSteal, rollRob, workLevel,
  type RobRefusal,
} from "./economyProgress";
import type { FlowContext } from "./economyFlows";
import type { Account, AccountUpdate } from "./economyStore";

const RETRIES = 3;
const MINUTE = 60_000;

/* Work */

export type WorkOutcome =
  | { ok: true; amount: number; base: number; levelBonus: number; boost: number; level: number; leveledUp: boolean; xp: number; balance: number }
  | { ok: false; reason: "cooldown"; retryAt: number }
  | { ok: false; reason: "cap" };

/**
 * One /work: base pay in [workMin, workMax] (crypto RNG), plus the level
 * bonus and any running work boost. Pay, the cooldown and the XP point are
 * one update guarded on the cooldown, so concurrent /work calls pay once.
 */
export async function work(ctx: FlowContext, cfg: EconomyConfig, guildId: string, userId: string): Promise<WorkOutcome> {
  await ctx.store.ensureAccount(guildId, userId);
  const cooldown = cfg.workCooldownMinutes * MINUTE;
  const base = cfg.workMin + ctx.randomInt(cfg.workMax - cfg.workMin + 1);
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const acct = await ctx.store.account(guildId, userId);
    const now = ctx.now();
    if (acct.lastWork && now - acct.lastWork.getTime() < cooldown) return { ok: false, reason: "cooldown", retryAt: acct.lastWork.getTime() + cooldown };
    const level = workLevel(acct.workXp);
    const levelBonus = levelBonusPercent(level, cfg.workLevelBonusPercent);
    const boost = activeBoost(acct.workBoostUntil, acct.workBoostPercent, now);
    const amount = boostedPay(base, levelBonus, boost);
    if (acct.balance > MAX_BALANCE - amount) return { ok: false, reason: "cap" };
    const after = await ctx.store.apply(guildId, userId, {
      inc: { balance: amount, workXp: 1 },
      set: { lastWork: new Date(now) },
      guard: { notAfter: { lastWork: new Date(now - cooldown) } },
    });
    if (after) {
      const newLevel = workLevel(after.workXp);
      await ctx.log(guildId, userId, "work", amount, after.balance, { note: `level ${newLevel}${boost ? `, boost +${boost}%` : ""}` });
      return { ok: true, amount, base, levelBonus, boost, level: newLevel, leveledUp: newLevel > level, xp: after.workXp, balance: after.balance };
    }
  }
  const acct = await ctx.store.account(guildId, userId);
  const now = ctx.now();
  return acct.lastWork && now - acct.lastWork.getTime() < cooldown
    ? { ok: false, reason: "cooldown", retryAt: acct.lastWork.getTime() + cooldown }
    : { ok: false, reason: "cap" };
}

/* Interest */

export type InterestOutcome =
  | { ok: true; amount: number; bank: number; wallet: number }
  | { ok: false; reason: "off" | "empty" | "bank_full" | "too_small" | "busy" }
  | { ok: false; reason: "cooldown"; retryAt: number };

export async function interest(ctx: FlowContext, cfg: EconomyConfig, guildId: string, userId: string): Promise<InterestOutcome> {
  if (cfg.bankInterestBps <= 0) return { ok: false, reason: "off" };
  await ctx.store.ensureAccount(guildId, userId);
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const acct = await ctx.store.account(guildId, userId);
    const now = ctx.now();
    const plan = planInterest(acct.bank, acct.lastInterest, now, cfg);
    if (!plan.ok) return plan;
    const update: AccountUpdate = {
      inc: { bank: plan.amount },
      set: { lastInterest: new Date(now) },
      guard: {
        notAfter: { lastInterest: new Date(now - INTEREST_COOLDOWN_MS) },
        // The bank limit is checked in the update itself, so a deposit racing the claim can't push it over.
        atMost: cfg.bankCap > 0 ? { bank: cfg.bankCap - plan.amount } : {},
      },
    };
    const after = await ctx.store.apply(guildId, userId, update);
    if (after) {
      await ctx.log(guildId, userId, "interest", plan.amount, after.balance, { note: `bank ${after.bank}` });
      return { ok: true, amount: plan.amount, bank: after.bank, wallet: after.balance };
    }
  }
  return { ok: false, reason: "busy" };
}

/* Rob */

export type RobOutcome =
  | { ok: true; success: true; amount: number; balance: number; targetBalance: number }
  | { ok: true; success: false; fine: number; balance: number }
  | { ok: true; success: false; escaped: true; balance: number }
  | { ok: false; refusal: RobRefusal }
  | { ok: false; reason: "cap" | "busy" };

const side = (a: Account, isBot: boolean) => ({ userId: a.userId, wallet: a.balance, isBot, lastRob: a.lastRob, lastRobbed: a.lastRobbed, shieldUntil: a.shieldUntil });

/**
 * One /rob. Order: check everything (refusals cost nothing); claim the
 * robber's cooldown in an update that also checks the robber still holds
 * the minimum wallet; roll once; then either take the coins from the target
 * in one update guarded on its wallet, shield and protection window, or
 * fine the robber. A fine is removed from circulation rather than paid to
 * the target, so a member can't use a deliberately failed rob to move coins
 * from an alt past /pay's limits and tax. Bank coins can never be robbed.
 */
export async function rob(ctx: FlowContext, cfg: EconomyConfig, guildId: string, robberId: string, targetId: string, targetIsBot: boolean): Promise<RobOutcome> {
  const quick = robRefusal(
    { userId: robberId, wallet: Number.MAX_SAFE_INTEGER, isBot: false, lastRob: null, lastRobbed: null, shieldUntil: null },
    { userId: targetId, wallet: Number.MAX_SAFE_INTEGER, isBot: targetIsBot, lastRob: null, lastRobbed: null, shieldUntil: null },
    ctx.now(), cfg,
  );
  if (quick) return { ok: false, refusal: quick };
  await ctx.store.ensureAccount(guildId, robberId);
  const [robber, target] = await Promise.all([ctx.store.account(guildId, robberId), ctx.store.account(guildId, targetId)]);
  const now = ctx.now();
  const refusal = robRefusal(side(robber, false), side(target, targetIsBot), now, cfg);
  if (refusal) return { ok: false, refusal };

  const cooldown = cfg.robCooldownMinutes * MINUTE;
  const claimed = await ctx.store.apply(guildId, robberId, {
    set: { lastRob: new Date(now) },
    guard: { notAfter: { lastRob: new Date(now - cooldown) }, atLeast: { balance: cfg.robMinWallet } },
  });
  if (!claimed) {
    const again = robRefusal(side(await ctx.store.account(guildId, robberId), false), side(target, targetIsBot), now, cfg);
    return again ? { ok: false, refusal: again } : { ok: false, reason: "busy" };
  }

  const roll = rollRob(cfg, ctx.randomInt);
  if (!roll.success) {
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      const acct = attempt === 0 ? claimed : await ctx.store.account(guildId, robberId);
      const fine = robFine(acct.balance, cfg);
      if (fine <= 0) return { ok: true, success: false, fine: 0, balance: acct.balance };
      const after = await ctx.store.apply(guildId, robberId, { inc: { balance: -fine } });
      if (after) {
        await ctx.log(guildId, robberId, "rob_fine", -fine, after.balance, { otherUserId: targetId });
        return { ok: true, success: false, fine, balance: after.balance };
      }
    }
    return { ok: true, success: false, fine: 0, balance: (await ctx.store.account(guildId, robberId)).balance };
  }

  const protect = cfg.robProtectMinutes * MINUTE;
  let taken: { amount: number; target: Account } | null = null;
  for (let attempt = 0; attempt < RETRIES && !taken; attempt++) {
    const t = attempt === 0 ? target : await ctx.store.account(guildId, targetId);
    if (t.balance < cfg.robMinTargetWallet) break;
    const amount = robSteal(t.balance, roll.percent, cfg);
    if (amount <= 0) break;
    const after = await ctx.store.apply(guildId, targetId, {
      inc: { balance: -amount },
      set: { lastRobbed: new Date(now) },
      guard: {
        atLeast: { balance: Math.max(amount, cfg.robMinTargetWallet) },
        notAfter: { shieldUntil: new Date(now), ...(protect > 0 ? { lastRobbed: new Date(now - protect) } : {}) },
      },
    });
    if (after) taken = { amount, target: after };
  }
  // The target moved their coins, put up a shield or was robbed by someone else first: the robber gets away empty-handed.
  if (!taken) return { ok: true, success: false, escaped: true, balance: claimed.balance };

  const credited = await ctx.store.credit(guildId, robberId, taken.amount) ?? await ctx.store.apply(guildId, robberId, { inc: { bank: taken.amount } });
  if (!credited) {
    const back = await ctx.store.credit(guildId, targetId, taken.amount) ?? await ctx.store.apply(guildId, targetId, { inc: { bank: taken.amount } });
    if (!back) logger.error(`Economy: could not return ${taken.amount} to ${targetId} in ${guildId} after a failed rob`);
    return { ok: false, reason: "cap" };
  }
  await ctx.log(guildId, robberId, "rob", taken.amount, credited.balance, { otherUserId: targetId });
  await ctx.log(guildId, targetId, "robbed", -taken.amount, taken.target.balance, { otherUserId: robberId });
  return { ok: true, success: true, amount: taken.amount, balance: credited.balance, targetBalance: taken.target.balance };
}

/* Effect items */

export type EffectOutcome =
  | { ok: true; item: ShopItem; until: Date; percent: number | null }
  | { ok: false; reason: "not_owned" | "not_effect" | "shield_max" | "busy" }
  | { ok: false; reason: "boost_active"; until: number };

/**
 * Use one effect item: take the unit, then set the effect with a
 * compare-and-set on the effect's end time (a second item used at the same
 * moment re-reads and extends from the new end, so no unit is wasted). If
 * the effect can't be applied, the unit goes back to the inventory.
 */
export async function useEffect(ctx: FlowContext, guildId: string, userId: string, item: ShopItem): Promise<EffectOutcome> {
  if (!item.effect || !item.effectHours) return { ok: false, reason: "not_effect" };
  await ctx.store.ensureAccount(guildId, userId);
  const first = planEffect(item.effect, item.effectHours, item.effectPercent, await ctx.store.account(guildId, userId), ctx.now());
  if (!first.ok) return first;
  if (!(await ctx.store.takeInventory(guildId, userId, item.id))) return { ok: false, reason: "not_owned" };
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const acct = await ctx.store.account(guildId, userId);
    const now = ctx.now();
    const plan = planEffect(item.effect, item.effectHours, item.effectPercent, acct, now);
    if (!plan.ok) {
      await ctx.store.addInventory(guildId, userId, item);
      return plan;
    }
    const update: AccountUpdate = item.effect === "rob_shield"
      ? { set: { shieldUntil: plan.until }, guard: { notAfter: { shieldUntil: acct.shieldUntil ?? new Date(0) } } }
      : { set: { workBoostUntil: plan.until, workBoostPercent: plan.percent ?? 0 }, guard: { notAfter: { workBoostUntil: new Date(now) } } };
    const after = await ctx.store.apply(guildId, userId, update);
    if (after) {
      await ctx.log(guildId, userId, "use", 0, after.balance, { note: `${item.name.slice(0, 80)} (${item.effect})` });
      return { ok: true, item, until: plan.until, percent: plan.percent ?? null };
    }
  }
  await ctx.store.addInventory(guildId, userId, item);
  return { ok: false, reason: "busy" };
}
