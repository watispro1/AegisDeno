/**
 * Mongo version of the economy store. Each balance change is a single
 * findOneAndUpdate whose filter carries the guard (balance ≥ amount, balance ≤
 * MAX − amount, cooldown field unchanged) and whose update uses $inc, so two
 * commands racing on one account cannot both pass.
 */
import { TtlCache } from "../utils/ttlCache";
import { MAX_BALANCE, MAX_SHOP_ITEMS, itemNameKey, normalizeEconomyConfig, type EconomyConfig, type ShopItem } from "./economyLogic";
import type { Account, EconomyStore, InventoryRow, Transaction } from "./economyStore";

type Doc = Record<string, unknown>;
type Lean<T> = { lean(): Promise<T> };
type Query<T> = Lean<T> & { sort(s: Doc): Query<T>; skip(n: number): Query<T>; limit(n: number): Query<T>; select(s: Doc | string): Query<T> };
/** The handful of model methods the store uses (kept structural so tests can pass fakes). */
export interface EconomyModelLike {
  findOne(filter: Doc): Lean<Doc | null>;
  find(filter: Doc): Query<Doc[]>;
  findOneAndUpdate(filter: Doc, update: Doc, options: Doc): Lean<Doc | null>;
  findOneAndDelete(filter: Doc): Lean<Doc | null>;
  updateOne(filter: Doc, update: Doc, options?: Doc): Promise<unknown>;
  countDocuments(filter: Doc): Promise<number>;
  create(doc: Doc): Promise<{ toObject(): Doc }>;
}

export interface EconomyModels {
  config: EconomyModelLike;
  account: EconomyModelLike;
  transaction: EconomyModelLike;
  item: EconomyModelLike;
  inventory: EconomyModelLike;
}

function defaultModels(): EconomyModels {
  // Required lazily so the memory store (tests, previews) never loads mongoose models.
  const m = require("../database/economyModels") as typeof import("../database/economyModels");
  return {
    config: m.EconomyConfigModel as unknown as EconomyModelLike,
    account: m.EconomyAccountModel as unknown as EconomyModelLike,
    transaction: m.EconomyTransactionModel as unknown as EconomyModelLike,
    item: m.ShopItemModel as unknown as EconomyModelLike,
    inventory: m.InventoryModel as unknown as EconomyModelLike,
  };
}

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const AFTER = { returnDocument: "after" } as const;

const date = (v: unknown): Date | null => (v instanceof Date ? v : v ? new Date(v as string) : null);
function toAccount(d: Doc, guildId: string, userId: string): Account {
  return { guildId, userId, balance: Number(d.balance ?? 0), lastDaily: date(d.lastDaily), dailyStreak: Number(d.dailyStreak ?? 0), lastWork: date(d.lastWork) };
}
function toItem(d: Doc): ShopItem {
  return {
    id: String(d._id), guildId: String(d.guildId), name: String(d.name), description: String(d.description ?? ""),
    price: Number(d.price), roleId: typeof d.roleId === "string" ? d.roleId : null,
    stock: typeof d.stock === "number" ? d.stock : null, createdAt: date(d.createdAt) ?? new Date(0),
  };
}
function toTx(d: Doc): Transaction {
  return {
    guildId: String(d.guildId), userId: String(d.userId), type: d.type as Transaction["type"], amount: Number(d.amount),
    balanceAfter: Number(d.balanceAfter), otherUserId: (d.otherUserId as string) ?? null, actorId: (d.actorId as string) ?? null,
    note: (d.note as string) ?? null, createdAt: date(d.createdAt) ?? new Date(0),
  };
}
const isDuplicateKey = (err: unknown) => (err as { code?: unknown })?.code === 11000;

export function mongoEconomyStore(models: EconomyModels = defaultModels()): EconomyStore {
  const configCache = new TtlCache<EconomyConfig>(30_000, 5_000);
  const blankCooldowns = { balance: 0, lastDaily: null, dailyStreak: 0, lastWork: null };

  return {
    async getConfig(guildId) {
      const hit = configCache.get(guildId);
      if (hit) return hit;
      const d = await models.config.findOne({ guildId }).lean();
      const cfg = normalizeEconomyConfig(d ?? {});
      configCache.set(guildId, cfg);
      return cfg;
    },
    async saveConfig(guildId, config) {
      await models.config.updateOne({ guildId }, { $set: { ...config, updatedAt: new Date() } }, { upsert: true });
      configCache.delete(guildId);
    },
    async account(guildId, userId) {
      const d = await models.account.findOne({ guildId, userId }).lean();
      return toAccount(d ?? {}, guildId, userId);
    },
    async ensureAccount(guildId, userId) {
      try {
        await models.account.updateOne({ guildId, userId }, { $setOnInsert: { guildId, userId, ...blankCooldowns } }, { upsert: true });
      } catch (err) {
        // Two first-time commands raced on the upsert; the other one created it.
        if (!isDuplicateKey(err)) throw err;
      }
    },
    async credit(guildId, userId, amount, swap) {
      const filter: Doc = { guildId, userId, balance: { $lte: MAX_BALANCE - amount } };
      const update: Doc = { $inc: { balance: amount } };
      if (swap) {
        filter[swap.field] = swap.expected;
        update.$set = { ...swap.set };
      }
      const d = await models.account.findOneAndUpdate(filter, update, AFTER).lean();
      return d ? toAccount(d, guildId, userId) : null;
    },
    async debit(guildId, userId, amount) {
      const d = await models.account.findOneAndUpdate({ guildId, userId, balance: { $gte: amount } }, { $inc: { balance: -amount } }, AFTER).lean();
      return d ? toAccount(d, guildId, userId) : null;
    },
    async setBalance(guildId, userId, balance) {
      const d = await models.account.findOneAndUpdate(
        { guildId, userId },
        { $set: { balance }, $setOnInsert: { guildId, userId, lastDaily: null, dailyStreak: 0, lastWork: null } },
        { ...AFTER, upsert: true },
      ).lean();
      return toAccount(d ?? { balance }, guildId, userId);
    },
    async leaderboard(guildId, offset, limit) {
      const filter = { guildId, balance: { $gt: 0 } };
      const [rows, total] = await Promise.all([
        models.account.find(filter).sort({ balance: -1, userId: 1 }).skip(offset).limit(limit).select({ userId: 1, balance: 1 }).lean(),
        models.account.countDocuments(filter),
      ]);
      return { rows: rows.map(r => ({ userId: String(r.userId), balance: Number(r.balance) })), total };
    },
    async logTransaction(tx) { await models.transaction.create({ ...tx, note: tx.note ? tx.note.slice(0, 300) : null }); },
    async recentTransactions(guildId, limit, userId) {
      const rows = await models.transaction.find(userId ? { guildId, userId } : { guildId }).sort({ createdAt: -1 }).limit(limit).lean();
      return rows.map(toTx);
    },
    async listItems(guildId) {
      const rows = await models.item.find({ guildId }).sort({ price: 1, name: 1 }).limit(MAX_SHOP_ITEMS).lean();
      return rows.map(toItem);
    },
    async getItem(guildId, id) {
      if (!OBJECT_ID.test(id)) return null;
      const d = await models.item.findOne({ guildId, _id: id }).lean();
      return d ? toItem(d) : null;
    },
    async addItem(guildId, input) {
      if ((await models.item.countDocuments({ guildId })) >= MAX_SHOP_ITEMS) return "full";
      try {
        const doc = await models.item.create({ guildId, ...input, nameKey: itemNameKey(input.name), createdAt: new Date() });
        return toItem(doc.toObject());
      } catch (err) {
        if (isDuplicateKey(err)) return "duplicate";
        throw err;
      }
    },
    async updateItem(guildId, id, input) {
      if (!OBJECT_ID.test(id)) return null;
      try {
        const d = await models.item.findOneAndUpdate({ guildId, _id: id }, { $set: { ...input, nameKey: itemNameKey(input.name) } }, AFTER).lean();
        return d ? toItem(d) : null;
      } catch (err) {
        if (isDuplicateKey(err)) return "duplicate";
        throw err;
      }
    },
    async removeItem(guildId, id) {
      if (!OBJECT_ID.test(id)) return null;
      const d = await models.item.findOneAndDelete({ guildId, _id: id }).lean();
      return d ? toItem(d) : null;
    },
    async takeStock(guildId, id) {
      if (!OBJECT_ID.test(id)) return false;
      const unlimited = await models.item.findOne({ guildId, _id: id, stock: null }).lean();
      if (unlimited) return true;
      const d = await models.item.findOneAndUpdate({ guildId, _id: id, stock: { $gt: 0 } }, { $inc: { stock: -1 } }, AFTER).lean();
      return Boolean(d);
    },
    async returnStock(guildId, id) {
      if (!OBJECT_ID.test(id)) return;
      await models.item.updateOne({ guildId, _id: id, stock: { $type: "number" } }, { $inc: { stock: 1 } });
    },
    async addInventory(guildId, userId, item) {
      await models.inventory.updateOne(
        { guildId, userId, itemId: item.id },
        { $inc: { quantity: 1 }, $set: { name: item.name, roleId: item.roleId } },
        { upsert: true },
      );
    },
    async inventory(guildId, userId) {
      const rows = await models.inventory.find({ guildId, userId, quantity: { $gt: 0 } }).sort({ name: 1 }).limit(100).lean();
      return rows.map((r): InventoryRow => ({ itemId: String(r.itemId), name: String(r.name), quantity: Number(r.quantity), roleId: (r.roleId as string) ?? null }));
    },
  };
}
