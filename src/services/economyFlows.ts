/**
 * Economy operations beyond daily/work/shop: /weekly, the bank, /crime,
 * /gamble, guarded /pay, item use and sale. Each balance change is one
 * guarded store.apply (a single findOneAndUpdate in Mongo); when a guard
 * fails because something else changed the account in between, the flow
 * re-reads and tries again a few times.
 */
import { logger } from "../utils/logger";
import { MAX_BALANCE, type EconomyConfig } from "./economyConfig";
import {
  WEEKLY_COOLDOWN_MS, betRefusal, cooldownLeft, nextUtcMidnight, payRoomToday, payTax, planDeposit, planWithdraw,
  playCoinflip, playSlots, rollCrime, sellPrice, useRefusal, utcDay,
  type BetRefusal, type GameResult, type RandomInt,
} from "./economyRules";
import type { ShopItem } from "./economyLogic";
import { playDice } from "./economyProgress";
import type { Account, AccountUpdate, EconomyStore, Transaction, TransactionType } from "./economyStore";

export interface FlowContext {
  store: EconomyStore;
  now: () => number;
  randomInt: RandomInt;
  log: (guildId: string, userId: string, type: TransactionType, amount: number, balanceAfter: number, extra?: Partial<Pick<Transaction, "otherUserId" | "actorId" | "note">>) => Promise<void>;
}

const RETRIES = 3;
type Off = { ok: false; reason: "off" };
type Cooldown = { ok: false; reason: "cooldown"; retryAt: number };
type Cap = { ok: false; reason: "cap" };
type Busy = { ok: false; reason: "busy" };

export type WeeklyOutcome = { ok: true; amount: number; balance: number } | Off | Cooldown | Cap;

export async function weekly(ctx: FlowContext, cfg: EconomyConfig, guildId: string, userId: string): Promise<WeeklyOutcome> {
  if (cfg.weeklyAmount <= 0) return { ok: false, reason: "off" };
  await ctx.store.ensureAccount(guildId, userId);
  const now = ctx.now();
  const after = await ctx.store.apply(guildId, userId, {
    inc: { balance: cfg.weeklyAmount },
    set: { lastWeekly: new Date(now) },
    guard: { notAfter: { lastWeekly: new Date(now - WEEKLY_COOLDOWN_MS) } },
  });
  if (!after) {
    const acct = await ctx.store.account(guildId, userId);
    const retryAt = cooldownLeft(acct.lastWeekly, WEEKLY_COOLDOWN_MS, now);
    return retryAt ? { ok: false, reason: "cooldown", retryAt } : { ok: false, reason: "cap" };
  }
  await ctx.log(guildId, userId, "weekly", cfg.weeklyAmount, after.balance);
  return { ok: true, amount: cfg.weeklyAmount, balance: after.balance };
}

export type BankOutcome =
  | { ok: true; amount: number; wallet: number; bank: number }
  | { ok: false; reason: "empty" | "insufficient" | "bank_full" | "wallet_full" | "invalid"; wallet: number; bank: number }
  | Busy;

/** Move coins between wallet and bank, both in one update. */
export async function moveBank(ctx: FlowContext, cfg: EconomyConfig, guildId: string, userId: string, direction: "deposit" | "withdraw", request: number | "all" | "half" | null): Promise<BankOutcome> {
  await ctx.store.ensureAccount(guildId, userId);
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const acct = await ctx.store.account(guildId, userId);
    const plan = direction === "deposit" ? planDeposit(request, acct.balance, acct.bank, cfg.bankCap) : planWithdraw(request, acct.balance, acct.bank);
    if (!plan.ok) return { ok: false, reason: plan.reason, wallet: acct.balance, bank: acct.bank };
    const amount = plan.amount;
    const update: AccountUpdate = direction === "deposit"
      ? { inc: { balance: -amount, bank: amount }, guard: cfg.bankCap > 0 ? { atMost: { bank: cfg.bankCap - amount } } : {} }
      : { inc: { balance: amount, bank: -amount } };
    const after = await ctx.store.apply(guildId, userId, update);
    if (after) {
      await ctx.log(guildId, userId, direction, direction === "deposit" ? -amount : amount, after.balance, { note: `bank ${after.bank}` });
      return { ok: true, amount, wallet: after.balance, bank: after.bank };
    }
  }
  return { ok: false, reason: "busy" };
}

export type CrimeOutcome =
  | { ok: true; success: true; amount: number; balance: number }
  | { ok: true; success: false; fine: number; balance: number }
  | Off | Cooldown | Cap | Busy;

/**
 * One /crime. The roll happens once, before any retry, so losing a race
 * never earns a second chance; a fine is re-capped to the wallet on retry.
 */
export async function crime(ctx: FlowContext, cfg: EconomyConfig, guildId: string, userId: string): Promise<CrimeOutcome> {
  if (!cfg.crimeEnabled) return { ok: false, reason: "off" };
  await ctx.store.ensureAccount(guildId, userId);
  const cooldown = cfg.crimeCooldownMinutes * 60_000;
  let roll: ReturnType<typeof rollCrime> | null = null;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const acct = await ctx.store.account(guildId, userId);
    const now = ctx.now();
    const retryAt = cooldownLeft(acct.lastCrime, cooldown, now);
    if (retryAt) return { ok: false, reason: "cooldown", retryAt };
    roll ??= rollCrime(cfg, acct.balance, ctx.randomInt);
    const guard = { notAfter: { lastCrime: new Date(now - cooldown) } };
    const set = { lastCrime: new Date(now) };
    if (roll.success) {
      if (acct.balance > MAX_BALANCE - roll.amount) return { ok: false, reason: "cap" };
      const after = await ctx.store.apply(guildId, userId, { inc: { balance: roll.amount }, set, guard });
      if (after) {
        await ctx.log(guildId, userId, "crime", roll.amount, after.balance);
        return { ok: true, success: true, amount: roll.amount, balance: after.balance };
      }
    } else {
      const fine = Math.min(cfg.crimeFine, acct.balance);
      const after = await ctx.store.apply(guildId, userId, { inc: fine > 0 ? { balance: -fine } : {}, set, guard });
      if (after) {
        if (fine > 0) await ctx.log(guildId, userId, "crime_fine", -fine, after.balance);
        return { ok: true, success: false, fine, balance: after.balance };
      }
    }
  }
  return { ok: false, reason: "busy" };
}

export type GambleGame = { game: "coinflip"; call: "heads" | "tails" } | { game: "slots" } | { game: "dice"; guess: number };
export type GambleOutcome =
  | { ok: true; result: GameResult; bet: number; balance: number; lossToday: number }
  | { ok: false; reason: "refused"; refusal: BetRefusal; resetsAt: number }
  | Cooldown | Busy;

/**
 * Place a bet and settle it. The bet is taken in one update that also checks
 * the cooldown and the daily loss cap (on the stored day, or starting a new
 * day), so concurrent bets can't slip past either.
 */
export async function gamble(ctx: FlowContext, cfg: EconomyConfig, guildId: string, userId: string, bet: number, game: GambleGame): Promise<GambleOutcome> {
  if (game.game === "dice" && !(Number.isSafeInteger(game.guess) && game.guess >= 1 && game.guess <= 6)) {
    return { ok: false, reason: "refused", refusal: { reason: "invalid" }, resetsAt: nextUtcMidnight(ctx.now()) };
  }
  if (!Number.isSafeInteger(bet) || bet < 1) return { ok: false, reason: "refused", refusal: { reason: "invalid" }, resetsAt: nextUtcMidnight(ctx.now()) };
  await ctx.store.ensureAccount(guildId, userId);
  const cooldown = cfg.gambleCooldownSeconds * 1000;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const acct = await ctx.store.account(guildId, userId);
    const now = ctx.now();
    const day = utcDay(now);
    const retryAt = cooldownLeft(acct.lastGamble, cooldown, now);
    if (retryAt && cooldown > 0) return { ok: false, reason: "cooldown", retryAt };
    const lossToday = acct.gambleDay === day ? acct.gambleLoss : 0;
    const refusal = betRefusal(bet, { cfg, wallet: acct.balance, lossToday });
    if (refusal) return { ok: false, reason: "refused", refusal, resetsAt: nextUtcMidnight(now) };
    const notAfter = { lastGamble: new Date(now - cooldown) };
    const capGuard = cfg.gambleDailyLossCap > 0 ? { gambleLoss: cfg.gambleDailyLossCap - bet } : {};
    const placed = acct.gambleDay === day
      ? await ctx.store.apply(guildId, userId, { inc: { balance: -bet, gambleLoss: bet }, set: { lastGamble: new Date(now) }, guard: { dayIs: { gambleDay: day }, atMost: capGuard, notAfter } })
      : await ctx.store.apply(guildId, userId, { inc: { balance: -bet }, set: { gambleDay: day, gambleLoss: bet, lastGamble: new Date(now) }, guard: { dayIsNot: { gambleDay: day }, notAfter } });
    if (!placed) continue;
    const result: GameResult = game.game === "coinflip" ? playCoinflip(bet, game.call, ctx.randomInt)
      : game.game === "dice" ? playDice(bet, game.guess, ctx.randomInt)
      : playSlots(bet, ctx.randomInt);
    let after: Account = placed;
    if (result.payout > 0) {
      // Winnings go to the wallet; if coins that arrived meanwhile filled it, they go to the bank instead of vanishing.
      const settled = await ctx.store.apply(guildId, userId, { inc: { balance: result.payout, gambleLoss: -result.payout } })
        ?? await ctx.store.apply(guildId, userId, { inc: { bank: result.payout, gambleLoss: -result.payout } });
      if (settled) after = settled;
      else logger.error(`Economy: could not pay out ${result.payout} to ${userId} in ${guildId} after a ${game.game} bet`);
    }
    await ctx.log(guildId, userId, "gamble", result.payout - bet, after.balance, { note: `${game.game} bet ${bet}: ${result.detail}`.slice(0, 100) });
    return { ok: true, result, bet, balance: after.balance, lossToday: after.gambleLoss };
  }
  return { ok: false, reason: "busy" };
}

export type PayOutcome =
  | { ok: true; from: Account; to: Account; sent: number; tax: number }
  | { ok: false; reason: "insufficient"; balance: number }
  | { ok: false; reason: "limit"; room: number; resetsAt: number }
  | { ok: false; reason: "recipient_full" }
  | Busy;

/**
 * Move coins: debit the sender (balance and daily limit checked in the same
 * update), credit the recipient the amount minus tax, and refund the sender
 * if the recipient is full. Tax is removed from circulation.
 */
export async function pay(ctx: FlowContext, cfg: EconomyConfig, guildId: string, fromId: string, toId: string, amount: number): Promise<PayOutcome> {
  await ctx.store.ensureAccount(guildId, fromId);
  const tax = payTax(amount, cfg.payTaxPercent);
  const net = amount - tax;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const acct = await ctx.store.account(guildId, fromId);
    const now = ctx.now();
    const day = utcDay(now);
    const room = payRoomToday(cfg.payDailyLimit, acct.payDay, acct.payTotal, day);
    if (amount > room) return { ok: false, reason: "limit", room, resetsAt: nextUtcMidnight(now) };
    if (acct.balance < amount) return { ok: false, reason: "insufficient", balance: acct.balance };
    const limitGuard = cfg.payDailyLimit > 0 ? { payTotal: cfg.payDailyLimit - amount } : {};
    const from = acct.payDay === day
      ? await ctx.store.apply(guildId, fromId, { inc: { balance: -amount, payTotal: amount }, guard: { dayIs: { payDay: day }, atMost: limitGuard } })
      : await ctx.store.apply(guildId, fromId, { inc: { balance: -amount }, set: { payDay: day, payTotal: amount }, guard: { dayIsNot: { payDay: day } } });
    if (!from) continue;
    await ctx.store.ensureAccount(guildId, toId);
    const to = net > 0 ? await ctx.store.credit(guildId, toId, net) : await ctx.store.account(guildId, toId);
    if (!to) {
      const refunded = await ctx.store.apply(guildId, fromId, { inc: { balance: amount, payTotal: -amount }, guard: { dayIs: { payDay: day } } })
        ?? await ctx.store.credit(guildId, fromId, amount)
        ?? await ctx.store.apply(guildId, fromId, { inc: { bank: amount } });
      if (!refunded) logger.error(`Economy: could not refund ${amount} to ${fromId} in ${guildId} after a failed pay`);
      return { ok: false, reason: "recipient_full" };
    }
    await ctx.log(guildId, fromId, "pay_out", -amount, from.balance, { otherUserId: toId, note: tax > 0 ? `tax ${tax}` : null });
    await ctx.log(guildId, toId, "pay_in", net, to.balance, { otherUserId: fromId, note: tax > 0 ? `after ${tax} tax` : null });
    return { ok: true, from, to, sent: net, tax };
  }
  return { ok: false, reason: "busy" };
}

export interface RoleGrantHooks {
  ownsRole?: (roleId: string) => boolean;
  /** Give the role (for `durationHours`, or for good when null); null on success, else why it failed. */
  grantRole?: (roleId: string, durationHours: number | null) => Promise<string | null>;
}

export type UseOutcome =
  | { ok: true; item: ShopItem }
  | { ok: false; reason: "not_owned" }
  | { ok: false; reason: "refused" | "role_failed"; detail: string };

/** Use one unit of an inventory item: take it, then grant its role; a failed grant gives the unit back. */
export async function useItem(ctx: FlowContext, guildId: string, userId: string, itemId: string, hooks: RoleGrantHooks): Promise<UseOutcome> {
  const owned = (await ctx.store.inventory(guildId, userId)).find(r => r.itemId === itemId);
  if (!owned) return { ok: false, reason: "not_owned" };
  const item = await ctx.store.getItem(guildId, itemId);
  const refusal = useRefusal(item, Boolean(item?.roleId && hooks.ownsRole?.(item.roleId)));
  if (refusal || !item?.roleId) return { ok: false, reason: "refused", detail: refusal ?? "That item can't be used." };
  if (!(await ctx.store.takeInventory(guildId, userId, item.id))) return { ok: false, reason: "not_owned" };
  const failed = hooks.grantRole
    ? await hooks.grantRole(item.roleId, item.roleDurationHours).catch((err: unknown) => (err instanceof Error ? err.message : "Discord refused the role."))
    : "Roles can't be granted here.";
  if (failed) {
    await ctx.store.addInventory(guildId, userId, item);
    return { ok: false, reason: "role_failed", detail: failed };
  }
  const acct = await ctx.store.account(guildId, userId);
  await ctx.log(guildId, userId, "use", 0, acct.balance, { note: item.name.slice(0, 100) });
  return { ok: true, item };
}

export type SellOutcome =
  | { ok: true; item: ShopItem; price: number; balance: number }
  | { ok: false; reason: "not_owned" | "not_sellable" | "off" | "cap" };

export async function sellItem(ctx: FlowContext, cfg: EconomyConfig, guildId: string, userId: string, itemId: string): Promise<SellOutcome> {
  if (cfg.shopSellPercent <= 0) return { ok: false, reason: "off" };
  const owned = (await ctx.store.inventory(guildId, userId)).find(r => r.itemId === itemId);
  if (!owned) return { ok: false, reason: "not_owned" };
  const item = await ctx.store.getItem(guildId, itemId);
  const price = item ? sellPrice(item, cfg.shopSellPercent) : null;
  if (!item || price === null) return { ok: false, reason: "not_sellable" };
  if (!(await ctx.store.takeInventory(guildId, userId, item.id))) return { ok: false, reason: "not_owned" };
  await ctx.store.ensureAccount(guildId, userId);
  const after = price > 0 ? await ctx.store.credit(guildId, userId, price) : await ctx.store.account(guildId, userId);
  if (!after) {
    await ctx.store.addInventory(guildId, userId, item);
    return { ok: false, reason: "cap" };
  }
  await ctx.log(guildId, userId, "sell", price, after.balance, { note: item.name.slice(0, 100) });
  return { ok: true, item, price, balance: after.balance };
}
