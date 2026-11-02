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
  balance: number;
  lastDaily: Date | null;
  dailyStreak: number;
  lastWork: Date | null;
}

export type CooldownField = "lastDaily" | "lastWork";

/** Compare-and-set on a cooldown field: the credit only applies while the field still holds `expected`. */
export interface CooldownSwap {
  field: CooldownField;
  expected: Date | null;
  set: { lastDaily?: Date; dailyStreak?: number; lastWork?: Date };
}

export type TransactionType = "daily" | "work" | "pay_in" | "pay_out" | "buy" | "refund" | "admin_give" | "admin_take" | "admin_reset";

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
  setBalance(guildId: string, userId: string, balance: number): Promise<Account>;
  /** Accounts with a positive balance, richest first (ties by user ID). */
  leaderboard(guildId: string, offset: number, limit: number): Promise<{ rows: Array<{ userId: string; balance: number }>; total: number }>;
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
  inventory(guildId: string, userId: string): Promise<InventoryRow[]>;
}

const zero = (guildId: string, userId: string): Account => ({ guildId, userId, balance: 0, lastDaily: null, dailyStreak: 0, lastWork: null });
const sameTime = (a: Date | null, b: Date | null) => (a === null || b === null ? a === b : a.getTime() === b.getTime());

export function memoryEconomyStore(seed: { config?: Partial<EconomyConfig>; now?: () => number } = {}): EconomyStore & {
  accounts: Map<string, Account>; transactions: Transaction[]; items: ShopItem[];
} {
  const now = seed.now ?? Date.now;
  const configs = new Map<string, EconomyConfig>();
  const accounts = new Map<string, Account>();
  const transactions: Transaction[] = [];
  const items: ShopItem[] = [];
  const inv = new Map<string, InventoryRow[]>();
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
    async setBalance(guildId, userId, balance) {
      const k = key(guildId, userId);
      const a = accounts.get(k) ?? zero(guildId, userId);
      a.balance = balance;
      accounts.set(k, a);
      return copy(a);
    },
    async leaderboard(guildId, offset, limit) {
      const all = [...accounts.values()].filter(a => a.guildId === guildId && a.balance > 0)
        .sort((x, y) => y.balance - x.balance || (x.userId < y.userId ? -1 : 1));
      return { rows: all.slice(offset, offset + limit).map(a => ({ userId: a.userId, balance: a.balance })), total: all.length };
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
      if (row) row.quantity += 1;
      else rows.push({ itemId: item.id, name: item.name, quantity: 1, roleId: item.roleId });
      inv.set(key(guildId, userId), rows);
    },
    async inventory(guildId, userId) { return (inv.get(key(guildId, userId)) ?? []).map(r => ({ ...r })); },
  };
}
