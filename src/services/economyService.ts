/**
 * Economy operations on top of an EconomyStore: daily and work claims with
 * persisted cooldowns, transfers, purchases, staff adjustments and the
 * transaction log. Results are plain objects; the slash commands and the
 * dashboard turn them into replies.
 */
import { randomInt as cryptoRandomInt } from "node:crypto";
import { logger } from "../utils/logger";
import {
  MAX_BALANCE, dailyClaim, workClaim, applyEconomySettings, validateShopItem,
  type EconomyConfig, type EconomySettingsInput, type ShopItem, type ShopItemInput,
} from "./economyLogic";
import { memoryEconomyStore, type Account, type EconomyStore, type LeaderboardSort, type Transaction, type TransactionFilter, type TransactionType } from "./economyStore";
import * as flows from "./economyFlows";
import * as activities from "./economyActivities";
import type { RandomInt } from "./economyRules";

export type { PayOutcome } from "./economyFlows";
export type { WorkOutcome, InterestOutcome, RobOutcome, EffectOutcome } from "./economyActivities";

export type ClaimOutcome =
  | { ok: true; amount: number; streak: number; balance: number }
  | { ok: false; reason: "cooldown"; retryAt: number }
  | { ok: false; reason: "cap" };

export type BuyOutcome =
  | { ok: true; item: ShopItem; balance: number }
  | { ok: false; reason: "not_found" | "sold_out" | "already_owned" }
  | { ok: false; reason: "limit"; limit: number }
  | { ok: false; reason: "insufficient"; balance: number; price: number }
  | { ok: false; reason: "role_failed"; detail: string };

export type AdjustAction = "give" | "take" | "reset";
export type AdjustOutcome =
  | { ok: true; balance: number; previous: number }
  | { ok: false; reason: "insufficient"; balance: number }
  | { ok: false; reason: "cap"; balance: number };

export interface AdjustEvent { guildId: string; userId: string; actorId: string; action: AdjustAction; amount: number; balance: number; reason: string | null }

export interface EconomyServiceOptions {
  now?: () => number;
  rng?: () => number;
  /** Integer in [0, max) for /crime and /gamble; crypto.randomInt by default. */
  randomInt?: RandomInt;
  /** Called after a staff adjustment is applied (the dashboard posts it to the mod log). */
  onAdjust?: (event: AdjustEvent) => Promise<void> | void;
}

const SWAP_RETRIES = 3;
/** Most transactions /transactions loads for paging (the log keeps 90 days). */
export const HISTORY_BROWSE_MAX = 250;

export class EconomyService {
  private readonly now: () => number;
  private readonly rng: () => number;
  private readonly flow: flows.FlowContext;

  constructor(readonly store: EconomyStore, private readonly options: EconomyServiceOptions = {}) {
    this.now = options.now ?? Date.now;
    this.rng = options.rng ?? Math.random;
    this.flow = {
      store, now: () => this.now(), randomInt: options.randomInt ?? (max => cryptoRandomInt(max)),
      log: (...args) => this.log(...args),
    };
  }

  config(guildId: string): Promise<EconomyConfig> { return this.store.getConfig(guildId); }

  /** Validate and save a settings change. */
  async updateConfig(guildId: string, input: EconomySettingsInput) {
    const result = applyEconomySettings(await this.store.getConfig(guildId), input);
    if (result.ok) await this.store.saveConfig(guildId, result.value);
    return result;
  }

  balance(guildId: string, userId: string): Promise<Account> { return this.store.account(guildId, userId); }

  private async log(guildId: string, userId: string, type: TransactionType, amount: number, balanceAfter: number, extra: Partial<Pick<Transaction, "otherUserId" | "actorId" | "note">> = {}) {
    // A lost log line must never undo or fail a balance change that already happened.
    await this.store.logTransaction({
      guildId, userId, type, amount, balanceAfter,
      otherUserId: extra.otherUserId ?? null, actorId: extra.actorId ?? null, note: extra.note ?? null,
      createdAt: new Date(this.now()),
    }).catch(err => logger.warn(`Economy: failed to log ${type} for ${userId} in ${guildId}`, err));
  }

  /**
   * One claim attempt per loop: read the cooldown, compute the payout, then
   * credit only if the cooldown field is still what was read. A second claim
   * racing this one fails the swap, re-reads and sees the cooldown.
   */
  private async claim(guildId: string, userId: string, kind: "daily" | "work"): Promise<ClaimOutcome> {
    const cfg = await this.store.getConfig(guildId);
    await this.store.ensureAccount(guildId, userId);
    for (let attempt = 0; attempt < SWAP_RETRIES; attempt++) {
      const acct = await this.store.account(guildId, userId);
      const now = this.now();
      const field = kind === "daily" ? "lastDaily" : "lastWork";
      const result = kind === "daily" ? dailyClaim(acct.lastDaily, acct.dailyStreak, now, cfg) : workClaim(acct.lastWork, now, cfg, this.rng);
      if (!result.ok) return { ok: false, reason: "cooldown", retryAt: result.retryAt };
      if (acct.balance > MAX_BALANCE - result.amount) return { ok: false, reason: "cap" };
      const set = kind === "daily" ? { lastDaily: new Date(now), dailyStreak: result.streak } : { lastWork: new Date(now) };
      const after = await this.store.credit(guildId, userId, result.amount, { field, expected: acct[field], set });
      if (after) {
        await this.log(guildId, userId, kind, result.amount, after.balance, kind === "daily" ? { note: `streak ${result.streak}` } : {});
        return { ok: true, amount: result.amount, streak: result.streak, balance: after.balance };
      }
    }
    // Lost every swap: someone else claimed in between; report their cooldown.
    const acct = await this.store.account(guildId, userId);
    const retry = kind === "daily" ? dailyClaim(acct.lastDaily, acct.dailyStreak, this.now(), cfg) : workClaim(acct.lastWork, this.now(), cfg, this.rng);
    return retry.ok ? { ok: false, reason: "cap" } : { ok: false, reason: "cooldown", retryAt: retry.retryAt };
  }

  daily(guildId: string, userId: string) { return this.claim(guildId, userId, "daily"); }
  /** /work with levels, boosts and crypto RNG (see economyActivities.work). */
  async work(guildId: string, userId: string) { return activities.work(this.flow, await this.config(guildId), guildId, userId); }
  async interest(guildId: string, userId: string) { return activities.interest(this.flow, await this.config(guildId), guildId, userId); }
  /** Rob another member. Membership, tenure and the target being a real member are checked by the caller. */
  async rob(guildId: string, robberId: string, targetId: string, targetIsBot: boolean) { return activities.rob(this.flow, await this.config(guildId), guildId, robberId, targetId, targetIsBot); }
  /** A member's own recent transactions (this server only). */
  history(guildId: string, userId: string, limit = 10) { return this.store.recentTransactions(guildId, Math.max(1, Math.min(25, Math.floor(limit))), userId); }
  /** Up to `limit` (≤ HISTORY_BROWSE_MAX) of a member's transactions, newest first, narrowed by type and time; for paged /transactions. */
  browseHistory(guildId: string, userId: string, filter: TransactionFilter = {}, limit = HISTORY_BROWSE_MAX) {
    return this.store.recentTransactions(guildId, Math.max(1, Math.min(HISTORY_BROWSE_MAX, Math.floor(limit))), userId, filter);
  }
  /** Server totals and the last `days` days of activity (this server only). */
  stats(guildId: string, days = 7) { return this.store.stats(guildId, new Date(this.now() - Math.max(1, Math.min(90, days)) * 86_400_000)); }

  async weekly(guildId: string, userId: string) { return flows.weekly(this.flow, await this.config(guildId), guildId, userId); }
  async crime(guildId: string, userId: string) { return flows.crime(this.flow, await this.config(guildId), guildId, userId); }
  async deposit(guildId: string, userId: string, request: number | "all" | "half" | null) { return flows.moveBank(this.flow, await this.config(guildId), guildId, userId, "deposit", request); }
  async withdraw(guildId: string, userId: string, request: number | "all" | "half" | null) { return flows.moveBank(this.flow, await this.config(guildId), guildId, userId, "withdraw", request); }
  async gamble(guildId: string, userId: string, bet: number, game: flows.GambleGame) { return flows.gamble(this.flow, await this.config(guildId), guildId, userId, bet, game); }
  /** Transfer with the server's daily limit and tax. Membership age and self/bot rules are checked by the caller. */
  async pay(guildId: string, fromId: string, toId: string, amount: number) { return flows.pay(this.flow, await this.config(guildId), guildId, fromId, toId, amount); }
  /** Use an inventory item: an effect item (shield, boost) or a role pass. */
  async useItem(guildId: string, userId: string, itemId: string, hooks: flows.RoleGrantHooks): Promise<flows.UseOutcome | activities.EffectOutcome> {
    const item = await this.store.getItem(guildId, itemId);
    if (item?.effect) {
      const owned = (await this.store.inventory(guildId, userId)).some(r => r.itemId === itemId);
      if (!owned) return { ok: false, reason: "not_owned" };
      return activities.useEffect(this.flow, guildId, userId, item);
    }
    return flows.useItem(this.flow, guildId, userId, itemId, hooks);
  }
  async sellItem(guildId: string, userId: string, itemId: string) { return flows.sellItem(this.flow, await this.config(guildId), guildId, userId, itemId); }

  /**
   * Buy one unit. Order: count it toward the per-member limit, reserve stock,
   * take the coins, grant the role (unless it is given by /use); each later
   * failure gives back what the earlier steps took.
   * `grantRole` returns null on success or a reason it failed.
   */
  async buy(guildId: string, userId: string, itemId: string, opts: flows.RoleGrantHooks = {}): Promise<BuyOutcome> {
    const item = await this.store.getItem(guildId, itemId);
    if (!item) return { ok: false, reason: "not_found" };
    const grantNow = Boolean(item.roleId) && !item.useToGrant;
    if (grantNow && opts.ownsRole?.(item.roleId!)) return { ok: false, reason: "already_owned" };
    const limited = item.perUserLimit !== null;
    if (limited && !(await this.store.reservePurchase(guildId, userId, item, item.perUserLimit!))) return { ok: false, reason: "limit", limit: item.perUserLimit! };
    const release = async () => { if (limited) await this.store.releasePurchase(guildId, userId, item.id); };
    if (!(await this.store.takeStock(guildId, item.id))) {
      await release();
      return { ok: false, reason: "sold_out" };
    }
    const after = await this.store.debit(guildId, userId, item.price);
    if (!after) {
      await this.store.returnStock(guildId, item.id);
      await release();
      return { ok: false, reason: "insufficient", balance: (await this.store.account(guildId, userId)).balance, price: item.price };
    }
    if (grantNow) {
      const failed = opts.grantRole ? await opts.grantRole(item.roleId!, item.roleDurationHours).catch((err: unknown) => (err instanceof Error ? err.message : "Discord refused the role.")) : "Roles can't be granted here.";
      if (failed) {
        const refunded = await this.store.credit(guildId, userId, item.price) ?? await this.store.apply(guildId, userId, { inc: { bank: item.price } });
        if (!refunded) logger.error(`Economy: could not refund ${item.price} to ${userId} in ${guildId} after a failed role grant`);
        await this.store.returnStock(guildId, item.id);
        await release();
        return { ok: false, reason: "role_failed", detail: failed };
      }
    }
    await this.store.addInventory(guildId, userId, item);
    await this.log(guildId, userId, "buy", -item.price, after.balance, { note: item.name.slice(0, 100) });
    return { ok: true, item: { ...item, stock: item.stock === null ? null : item.stock - 1 }, balance: after.balance };
  }

  /** Staff give/take (wallet) and reset (wallet and bank). Recorded in the transaction log with who did it and why. */
  async adjust(guildId: string, userId: string, action: AdjustAction, amount: number, actorId: string, reason: string | null): Promise<AdjustOutcome> {
    const before = await this.store.account(guildId, userId);
    let previous = before.balance;
    let balance: number;
    if (action === "reset") {
      // One atomic update that reports what it removed, so the log always matches what was actually taken.
      const was = await this.store.resetAccount(guildId, userId);
      previous = was ? was.balance + was.bank : 0;
      balance = 0;
      amount = previous;
      // An account that was already empty has no balance change to record.
      if (previous > 0) await this.log(guildId, userId, "admin_reset", -previous, balance, { actorId, note: reason });
    } else if (action === "give") {
      await this.store.ensureAccount(guildId, userId);
      const after = await this.store.credit(guildId, userId, amount);
      if (!after) return { ok: false, reason: "cap", balance: previous };
      balance = after.balance;
      await this.log(guildId, userId, "admin_give", amount, balance, { actorId, note: reason });
    } else {
      const after = await this.store.debit(guildId, userId, amount);
      if (!after) return { ok: false, reason: "insufficient", balance: previous };
      balance = after.balance;
      await this.log(guildId, userId, "admin_take", -amount, balance, { actorId, note: reason });
    }
    await Promise.resolve(this.options.onAdjust?.({ guildId, userId, actorId, action, amount, balance, reason })).catch(err => logger.warn("Economy: adjust hook failed", err));
    return { ok: true, balance, previous };
  }

  leaderboard(guildId: string, page: number, perPage: number, sort: LeaderboardSort = "total") {
    const safePage = Math.max(1, Math.floor(page));
    return this.store.leaderboard(guildId, (safePage - 1) * perPage, perPage, sort);
  }

  /** A member's place on the leaderboard, or null when they have no coins. */
  rank(guildId: string, userId: string, sort: LeaderboardSort = "total") { return this.store.rank(guildId, userId, sort); }

  recentTransactions(guildId: string, limit: number, userId?: string) { return this.store.recentTransactions(guildId, limit, userId); }
  items(guildId: string) { return this.store.listItems(guildId); }
  item(guildId: string, id: string) { return this.store.getItem(guildId, id); }
  inventory(guildId: string, userId: string) { return this.store.inventory(guildId, userId); }

  /** Validate then add. Role hierarchy is checked by the caller, which knows the roles. */
  async addItem(guildId: string, raw: Parameters<typeof validateShopItem>[0]) {
    const v = validateShopItem(raw);
    if (!v.ok) return v;
    const r = await this.store.addItem(guildId, v.value);
    if (r === "full") return { ok: false as const, errors: { name: "The shop is full (50 items). Remove one first." } };
    if (r === "duplicate") return { ok: false as const, errors: { name: "An item with that name already exists." } };
    return { ok: true as const, value: r };
  }

  async editItem(guildId: string, id: string, input: ShopItemInput) {
    const v = validateShopItem(input);
    if (!v.ok) return v;
    const r = await this.store.updateItem(guildId, id, v.value);
    if (r === null) return { ok: false as const, errors: { name: "That item no longer exists." } };
    if (r === "duplicate") return { ok: false as const, errors: { name: "An item with that name already exists." } };
    return { ok: true as const, value: r };
  }

  removeItem(guildId: string, id: string) { return this.store.removeItem(guildId, id); }
}

let sharedStore: EconomyStore | null = null;
let shared: EconomyService | null = null;

function mongoStore(): EconomyStore {
  if (!sharedStore) {
    const { mongoEconomyStore } = require("./economyMongo") as typeof import("./economyMongo");
    sharedStore = mongoEconomyStore();
  }
  return sharedStore;
}

/** The bot's economy service (Mongo). Created on first use. */
export function economy(): EconomyService {
  shared ??= new EconomyService(mongoStore());
  return shared;
}

/** A service on the same Mongo store (and settings cache) with its own options, e.g. the dashboard's mod-log hook. */
export function economyWith(options: EconomyServiceOptions): EconomyService {
  return new EconomyService(mongoStore(), options);
}

/** In-memory service for tests and previews. */
export function memoryEconomy(seed: Parameters<typeof memoryEconomyStore>[0] = {}, options: EconomyServiceOptions = {}) {
  const store = memoryEconomyStore(seed);
  return { store, service: new EconomyService(store, { now: seed.now, ...options }) };
}
