/**
 * Economy operations on top of an EconomyStore: daily and work claims with
 * persisted cooldowns, transfers, purchases, staff adjustments and the
 * transaction log. Results are plain objects; the slash commands and the
 * dashboard turn them into replies.
 */
import { logger } from "../utils/logger";
import {
  MAX_BALANCE, dailyClaim, workClaim, applyEconomySettings, validateShopItem,
  type EconomyConfig, type EconomySettingsInput, type ShopItem, type ShopItemInput,
} from "./economyLogic";
import { memoryEconomyStore, type Account, type EconomyStore, type Transaction, type TransactionType } from "./economyStore";

export type ClaimOutcome =
  | { ok: true; amount: number; streak: number; balance: number }
  | { ok: false; reason: "cooldown"; retryAt: number }
  | { ok: false; reason: "cap" };

export type PayOutcome =
  | { ok: true; from: Account; to: Account }
  | { ok: false; reason: "insufficient"; balance: number }
  | { ok: false; reason: "recipient_full" };

export type BuyOutcome =
  | { ok: true; item: ShopItem; balance: number }
  | { ok: false; reason: "not_found" | "sold_out" | "already_owned" }
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
  /** Called after a staff adjustment is applied (the dashboard posts it to the mod log). */
  onAdjust?: (event: AdjustEvent) => Promise<void> | void;
}

const SWAP_RETRIES = 3;

export class EconomyService {
  private readonly now: () => number;
  private readonly rng: () => number;

  constructor(readonly store: EconomyStore, private readonly options: EconomyServiceOptions = {}) {
    this.now = options.now ?? Date.now;
    this.rng = options.rng ?? Math.random;
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
  work(guildId: string, userId: string) { return this.claim(guildId, userId, "work"); }

  /** Move coins: debit the sender (guarded), then credit the recipient; refund the sender if the recipient is full. */
  async pay(guildId: string, fromId: string, toId: string, amount: number): Promise<PayOutcome> {
    const from = await this.store.debit(guildId, fromId, amount);
    if (!from) return { ok: false, reason: "insufficient", balance: (await this.store.account(guildId, fromId)).balance };
    await this.store.ensureAccount(guildId, toId);
    const to = await this.store.credit(guildId, toId, amount);
    if (!to) {
      const refunded = await this.store.credit(guildId, fromId, amount);
      if (!refunded) logger.error(`Economy: could not refund ${amount} to ${fromId} in ${guildId} after a failed pay`);
      return { ok: false, reason: "recipient_full" };
    }
    await this.log(guildId, fromId, "pay_out", -amount, from.balance, { otherUserId: toId });
    await this.log(guildId, toId, "pay_in", amount, to.balance, { otherUserId: fromId });
    return { ok: true, from, to };
  }

  /**
   * Buy one unit. Order: reserve stock, take the coins, grant the role; each
   * later failure gives back what the earlier steps took.
   * `grantRole` returns null on success or a reason it failed.
   */
  async buy(guildId: string, userId: string, itemId: string, opts: { ownsRole?: (roleId: string) => boolean; grantRole?: (roleId: string) => Promise<string | null> } = {}): Promise<BuyOutcome> {
    const item = await this.store.getItem(guildId, itemId);
    if (!item) return { ok: false, reason: "not_found" };
    if (item.roleId && opts.ownsRole?.(item.roleId)) return { ok: false, reason: "already_owned" };
    if (!(await this.store.takeStock(guildId, item.id))) return { ok: false, reason: "sold_out" };
    const after = await this.store.debit(guildId, userId, item.price);
    if (!after) {
      await this.store.returnStock(guildId, item.id);
      return { ok: false, reason: "insufficient", balance: (await this.store.account(guildId, userId)).balance, price: item.price };
    }
    if (item.roleId) {
      const failed = opts.grantRole ? await opts.grantRole(item.roleId).catch((err: unknown) => (err instanceof Error ? err.message : "Discord refused the role.")) : "Roles can't be granted here.";
      if (failed) {
        await this.store.credit(guildId, userId, item.price);
        await this.store.returnStock(guildId, item.id);
        return { ok: false, reason: "role_failed", detail: failed };
      }
    }
    await this.store.addInventory(guildId, userId, item);
    await this.log(guildId, userId, "buy", -item.price, after.balance, { note: item.name.slice(0, 100) });
    return { ok: true, item: { ...item, stock: item.stock === null ? null : item.stock - 1 }, balance: after.balance };
  }

  /** Staff give/take/reset. Recorded in the transaction log with who did it and why. */
  async adjust(guildId: string, userId: string, action: AdjustAction, amount: number, actorId: string, reason: string | null): Promise<AdjustOutcome> {
    const previous = (await this.store.account(guildId, userId)).balance;
    let balance: number;
    if (action === "reset") {
      balance = (await this.store.setBalance(guildId, userId, 0)).balance;
      await this.log(guildId, userId, "admin_reset", -previous, balance, { actorId, note: reason });
      amount = previous;
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

  leaderboard(guildId: string, page: number, perPage: number) {
    const safePage = Math.max(1, Math.floor(page));
    return this.store.leaderboard(guildId, (safePage - 1) * perPage, perPage);
  }

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
