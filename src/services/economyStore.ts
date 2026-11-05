/**
 * Storage behind the economy. Every balance change is one conditional,
 * atomic update (Mongo: findOneAndUpdate with a guard in the filter and $inc),
 * never read-modify-write, so concurrent commands cannot overdraw, double
 * claim a cooldown, or push a balance past MAX_BALANCE.
 *
 * The memory version below keeps the same semantics (each operation runs
 * without yielding between its check and its write) for tests and previews;
 * production uses economyMongo.ts.
 */
import { MAX_BALANCE, MAX_SHOP_ITEMS, itemNameKey, normalizeEconomyConfig, type EconomyConfig, type ShopItem, type ShopItemInput } from "./economyLogic";

export interface Account {
  guildId: string;
  userId: string;
  /** Wallet. */
  balance: number;
  bank: number;
  lastDaily: Date | null;
  dailyStreak: number;
  lastWork: Date | null;
  lastWeekly: Date | null;
  lastCrime: Date | null;
  lastGamble: Date | null;
  /** UTC day (YYYY-MM-DD) that gambleLoss counts, and the net loss that day (negative when up). */
  gambleDay: string | null;
  gambleLoss: number;
  /** UTC day that payTotal counts, and the coins sent that day. */
  payDay: string | null;
  payTotal: number;
}

export type AccountNumberField = "balance" | "bank" | "gambleLoss" | "payTotal";
export type AccountDateField = "lastDaily" | "lastWork" | "lastWeekly" | "lastCrime" | "lastGamble";
export type AccountDayField = "gambleDay" | "payDay";

/**
 * One guarded, atomic change to an account. Every guard must hold or nothing
 * changes. A missing number field counts as 0; a missing date passes
 * `notAfter`; `dayIs`/`dayIsNot` compare the stored UTC day.
 */
export interface AccountUpdate {
  inc?: Partial<Record<AccountNumberField, number>>;
  set?: Partial<Pick<Account, AccountNumberField | AccountDateField | AccountDayField | "dailyStreak">>;
  guard?: {
    atLeast?: Partial<Record<AccountNumberField, number>>;
    atMost?: Partial<Record<AccountNumberField, number>>;
    notAfter?: Partial<Record<AccountDateField, Date>>;
    dayIs?: Partial<Record<AccountDayField, string>>;
    dayIsNot?: Partial<Record<AccountDayField, string>>;
  };
}

export type LeaderboardSort = "total" | "wallet" | "bank";
export interface LeaderboardRow { userId: string; balance: number; bank: number; total: number }

export type CooldownField = "lastDaily" | "lastWork";

/** Compare-and-set on a cooldown field: the credit only applies while the field still holds `expected`. */
export interface CooldownSwap {
  field: CooldownField;
  expected: Date | null;
  set: { lastDaily?: Date; dailyStreak?: number; lastWork?: Date };
}

export type TransactionType =
  | "daily" | "weekly" | "work" | "crime" | "crime_fine" | "deposit" | "withdraw" | "gamble"
  | "pay_in" | "pay_out" | "buy" | "sell" | "use" | "refund" | "admin_give" | "admin_take" | "admin_reset";

export interface Transaction {
  guildId: string;
  userId: string;
  type: TransactionType;
  /** Signed: positive adds coins, negative removes them. */
  amount: number;
  balanceAfter: number;
  otherUserId: string | null;
  actorId: string | null;
  note: string | null;
  createdAt: Date;
}

export interface InventoryRow { itemId: string; name: string; quantity: number; roleId: string | null }

export interface EconomyStore {
  getConfig(guildId: string): Promise<EconomyConfig>;
  saveConfig(guildId: string, config: EconomyConfig): Promise<void>;
  /** The account, or a zero account (not stored) when they have none. */
  account(guildId: string, userId: string): Promise<Account>;
  /** Create the account if missing (idempotent). */
  ensureAccount(guildId: string, userId: string): Promise<void>;
  /** Add coins while the result stays ≤ MAX_BALANCE (and the swap matches). null when a guard failed or there is no account. */
  credit(guildId: string, userId: string, amount: number, swap?: CooldownSwap): Promise<Account | null>;
  /** Remove coins while the balance is ≥ amount. null when they can't afford it. */
  debit(guildId: string, userId: string, amount: number): Promise<Account | null>;
  /** Apply a guarded update to an existing account. null when a guard failed or there is no account. */
  apply(guildId: string, userId: string, update: AccountUpdate): Promise<Account | null>;
  /** Set the wallet (and the bank, when given), creating the account if needed. */
  setBalance(guildId: string, userId: string, balance: number, bank?: number): Promise<Account>;
  /** Accounts with coins, richest first by the chosen sort (ties by user ID); zero rows hidden. */
  leaderboard(guildId: string, offset: number, limit: number, sort?: LeaderboardSort): Promise<{ rows: LeaderboardRow[]; total: number }>;
  logTransaction(tx: Transaction): Promise<void>;
  recentTransactions(guildId: string, limit: number, userId?: string): Promise<Transaction[]>;
  listItems(guildId: string): Promise<ShopItem[]>;
  getItem(guildId: string, id: string): Promise<ShopItem | null>;
  addItem(guildId: string, input: ShopItemInput): Promise<ShopItem | "duplicate" | "full">;
  updateItem(guildId: string, id: string, input: ShopItemInput): Promise<ShopItem | "duplicate" | null>;
  removeItem(guildId: string, id: string): Promise<ShopItem | null>;
  /** Reserve one unit: true for unlimited stock or when stock > 0 (decremented atomically). */
  takeStock(guildId: string, id: string): Promise<boolean>;
  /** Give back a unit reserved by takeStock (no-op for unlimited items). */
  returnStock(guildId: string, id: string): Promise<void>;
  addInventory(guildId: string, userId: string, item: Pick<ShopItem, "id" | "name" | "roleId">): Promise<void>;
  /** Remove one unit while quantity ≥ 1. false when they have none. */
  takeInventory(guildId: string, userId: string, itemId: string): Promise<boolean>;
  /** Count one purchase toward a per-member limit, only while bought < limit. */
  reservePurchase(guildId: string, userId: string, item: Pick<ShopItem, "id" | "name" | "roleId">, limit: number): Promise<boolean>;
  /** Undo a reservePurchase after a later step failed. */
  releasePurchase(guildId: string, userId: string, itemId: string): Promise<void>;
  inventory(guildId: string, userId: string): Promise<InventoryRow[]>;
}

const NUMBER_FIELDS: AccountNumberField[] = ["balance", "bank", "gambleLoss", "payTotal"];

/** Whether an update's guards hold for an account (memory store; the Mongo filter is built from the same spec). */
export function guardsHold(a: Account, guard: AccountUpdate["guard"] = {}): boolean {
  for (const [f, v] of Object.entries(guard.atLeast ?? {}) as Array<[AccountNumberField, number]>) if ((a[f] ?? 0) < v) return false;
  for (const [f, v] of Object.entries(guard.atMost ?? {}) as Array<[AccountNumberField, number]>) if ((a[f] ?? 0) > v) return false;
  for (const [f, v] of Object.entries(guard.notAfter ?? {}) as Array<[AccountDateField, Date]>) {
    const at = a[f];
    if (at && at.getTime() > v.getTime()) return false;
  }
  for (const [f, v] of Object.entries(guard.dayIs ?? {}) as Array<[AccountDayField, string]>) if (a[f] !== v) return false;
  for (const [f, v] of Object.entries(guard.dayIsNot ?? {}) as Array<[AccountDayField, string]>) if (a[f] === v) return false;
  return true;
}

/** An update can never leave a number field negative or above MAX_BALANCE. */
export function withBounds(update: AccountUpdate): AccountUpdate {
  const guard = { ...update.guard, atLeast: { ...update.guard?.atLeast }, atMost: { ...update.guard?.atMost } };
  for (const [f, by] of Object.entries(update.inc ?? {}) as Array<[AccountNumberField, number]>) {
    if (f !== "balance" && f !== "bank") continue;
    if (by < 0) guard.atLeast[f] = Math.max(guard.atLeast[f] ?? 0, -by);
    if (by > 0) guard.atMost[f] = Math.min(guard.atMost[f] ?? MAX_BALANCE, MAX_BALANCE - by);
  }
  return { ...update, guard };
}

export const zeroAccount = (guildId: string, userId: string): Account => ({
  guildId, userId, balance: 0, bank: 0, lastDaily: null, dailyStreak: 0, lastWork: null,
  lastWeekly: null, lastCrime: null, lastGamble: null, gambleDay: null, gambleLoss: 0, payDay: null, payTotal: 0,
});
const zero = zeroAccount;
const sameTime = (a: Date | null, b: Date | null) => (a === null || b === null ? a === b : a.getTime() === b.getTime());

export function memoryEconomyStore(seed: { config?: Partial<EconomyConfig>; now?: () => number } = {}): EconomyStore & {
  accounts: Map<string, Account>; transactions: Transaction[]; items: ShopItem[];
} {
  const now = seed.now ?? Date.now;
  const configs = new Map<string, EconomyConfig>();
  const accounts = new Map<string, Account>();
  const transactions: Transaction[] = [];
  const items: ShopItem[] = [];
  const inv = new Map<string, Array<InventoryRow & { bought: number }>>();
  let seq = 0;
  const key = (g: string, u: string) => `${g}:${u}`;
  const copy = (a: Account): Account => ({ ...a });
  const nameTaken = (guildId: string, name: string, except?: string) =>
    items.some(i => i.guildId === guildId && i.id !== except && itemNameKey(i.name) === itemNameKey(name));

  return {
    accounts, transactions, items,
    async getConfig(guildId) { return configs.get(guildId) ?? normalizeEconomyConfig({ ...seed.config }); },
    async saveConfig(guildId, config) { configs.set(guildId, { ...config }); },
    async account(guildId, userId) { const a = accounts.get(key(guildId, userId)); return a ? copy(a) : zero(guildId, userId); },
    async ensureAccount(guildId, userId) { if (!accounts.has(key(guildId, userId))) accounts.set(key(guildId, userId), zero(guildId, userId)); },
    async credit(guildId, userId, amount, swap) {
      const a = accounts.get(key(guildId, userId));
      if (!a || a.balance > MAX_BALANCE - amount) return null;
      if (swap && !sameTime(a[swap.field], swap.expected)) return null;
      a.balance += amount;
      if (swap) Object.assign(a, swap.set);
      return copy(a);
    },
    async debit(guildId, userId, amount) {
      const a = accounts.get(key(guildId, userId));
      if (!a || a.balance < amount) return null;
      a.balance -= amount;
      return copy(a);
    },
    async apply(guildId, userId, raw) {
      const a = accounts.get(key(guildId, userId));
      const update = withBounds(raw);
      if (!a || !guardsHold(a, update.guard)) return null;
      for (const [f, by] of Object.entries(update.inc ?? {}) as Array<[AccountNumberField, number]>) a[f] = (a[f] ?? 0) + by;
      Object.assign(a, update.set ?? {});
      return copy(a);
    },
    async setBalance(guildId, userId, balance, bank) {
      const k = key(guildId, userId);
      const a = accounts.get(k) ?? zero(guildId, userId);
      a.balance = balance;
      if (bank !== undefined) a.bank = bank;
      accounts.set(k, a);
      return copy(a);
    },
    async leaderboard(guildId, offset, limit, sort = "total") {
      const score = (a: Account) => (sort === "wallet" ? a.balance : sort === "bank" ? a.bank : a.balance + a.bank);
      const all = [...accounts.values()].filter(a => a.guildId === guildId && score(a) > 0)
        .sort((x, y) => score(y) - score(x) || (x.userId < y.userId ? -1 : 1));
      return { rows: all.slice(offset, offset + limit).map(a => ({ userId: a.userId, balance: a.balance, bank: a.bank, total: a.balance + a.bank })), total: all.length };
    },
    async logTransaction(tx) { transactions.push({ ...tx }); },
    async recentTransactions(guildId, limit, userId) {
      return transactions.filter(t => t.guildId === guildId && (!userId || t.userId === userId)).slice().reverse().slice(0, limit);
    },
    async listItems(guildId) { return items.filter(i => i.guildId === guildId).sort((a, b) => a.price - b.price || a.name.localeCompare(b.name)).map(i => ({ ...i })); },
    async getItem(guildId, id) { const i = items.find(x => x.guildId === guildId && x.id === id); return i ? { ...i } : null; },
    async addItem(guildId, input) {
      if (items.filter(i => i.guildId === guildId).length >= MAX_SHOP_ITEMS) return "full";
      if (nameTaken(guildId, input.name)) return "duplicate";
      const item: ShopItem = { ...input, id: (++seq).toString(16).padStart(24, "0"), guildId, createdAt: new Date(now()) };
      items.push(item);
      return { ...item };
    },
    async updateItem(guildId, id, input) {
      const i = items.find(x => x.guildId === guildId && x.id === id);
      if (!i) return null;
      if (nameTaken(guildId, input.name, id)) return "duplicate";
      Object.assign(i, input);
      return { ...i };
    },
    async removeItem(guildId, id) {
      const at = items.findIndex(x => x.guildId === guildId && x.id === id);
      return at < 0 ? null : items.splice(at, 1)[0];
    },
    async takeStock(guildId, id) {
      const i = items.find(x => x.guildId === guildId && x.id === id);
      if (!i) return false;
      if (i.stock === null) return true;
      if (i.stock <= 0) return false;
      i.stock -= 1;
      return true;
    },
    async returnStock(guildId, id) {
      const i = items.find(x => x.guildId === guildId && x.id === id);
      if (i && i.stock !== null) i.stock += 1;
    },
    async addInventory(guildId, userId, item) {
      const rows = inv.get(key(guildId, userId)) ?? [];
      const row = rows.find(r => r.itemId === item.id);
      if (row) Object.assign(row, { quantity: row.quantity + 1, name: item.name, roleId: item.roleId });
      else rows.push({ itemId: item.id, name: item.name, quantity: 1, roleId: item.roleId, bought: 0 });
      inv.set(key(guildId, userId), rows);
    },
    async takeInventory(guildId, userId, itemId) {
      const row = (inv.get(key(guildId, userId)) ?? []).find(r => r.itemId === itemId);
      if (!row || row.quantity < 1) return false;
      row.quantity -= 1;
      return true;
    },
    async reservePurchase(guildId, userId, item, limit) {
      const rows = inv.get(key(guildId, userId)) ?? [];
      let row = rows.find(r => r.itemId === item.id);
      if (!row) { row = { itemId: item.id, name: item.name, quantity: 0, roleId: item.roleId, bought: 0 }; rows.push(row); inv.set(key(guildId, userId), rows); }
      if (row.bought >= limit) return false;
      row.bought += 1;
      return true;
    },
    async releasePurchase(guildId, userId, itemId) {
      const row = (inv.get(key(guildId, userId)) ?? []).find(r => r.itemId === itemId);
      if (row && row.bought > 0) row.bought -= 1;
    },
    async inventory(guildId, userId) {
      return (inv.get(key(guildId, userId)) ?? []).filter(r => r.quantity > 0).map(({ bought: _bought, ...r }) => ({ ...r }));
    },
  };
}
