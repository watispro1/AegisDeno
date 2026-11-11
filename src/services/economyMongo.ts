/**
 * Mongo version of the economy store. Each balance change is a single
 * findOneAndUpdate whose filter carries the guard (balance ≥ amount, balance ≤
 * MAX − amount, cooldown field unchanged) and whose update uses $inc, so two
 * commands racing on one account cannot both pass.
 */
import { TtlCache } from "../utils/ttlCache";
import { MAX_BALANCE, MAX_SHOP_ITEMS, itemNameKey, normalizeEconomyConfig, type EconomyConfig, type ShopItem } from "./economyLogic";
import { TRANSACTION_TYPES, withBounds, type Account, type AccountUpdate, type EconomyStore, type InventoryRow, type LeaderboardRow, type Transaction, type TransactionType } from "./economyStore";
import { isItemEffect } from "./economyProgress";

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
  aggregate?(pipeline: Doc[]): Promise<Doc[]>;
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
const day = (v: unknown): string | null => (typeof v === "string" ? v : null);
function toAccount(d: Doc, guildId: string, userId: string): Account {
  return {
    guildId, userId, balance: Number(d.balance ?? 0), bank: Number(d.bank ?? 0),
    lastDaily: date(d.lastDaily), dailyStreak: Number(d.dailyStreak ?? 0), lastWork: date(d.lastWork),
    lastWeekly: date(d.lastWeekly), lastCrime: date(d.lastCrime), lastGamble: date(d.lastGamble),
    gambleDay: day(d.gambleDay), gambleLoss: Number(d.gambleLoss ?? 0), payDay: day(d.payDay), payTotal: Number(d.payTotal ?? 0),
    workXp: Number(d.workXp ?? 0), workBoostPercent: Number(d.workBoostPercent ?? 0), workBoostUntil: date(d.workBoostUntil),
    shieldUntil: date(d.shieldUntil), lastRob: date(d.lastRob), lastRobbed: date(d.lastRobbed), lastInterest: date(d.lastInterest),
  };
}

/**
 * The Mongo filter for an update's guards. Number fields may be missing on
 * older accounts: `$gte` fails on a missing field (correct, it counts as 0
 * and every lower bound is ≥ 1), while upper bounds use `$not: { $gt }` so a
 * missing field (0) passes. A missing date passes `notAfter` the same way.
 */
export function accountFilter(guildId: string, userId: string, update: AccountUpdate): Doc {
  const g = update.guard ?? {};
  const filter: Doc = { guildId, userId };
  const field = (f: string): Doc => (filter[f] ??= {}) as Doc;
  for (const [f, v] of Object.entries(g.atLeast ?? {})) if (v > 0) field(f).$gte = v;
  for (const [f, v] of Object.entries(g.atMost ?? {})) field(f).$not = { $gt: v };
  for (const [f, v] of Object.entries(g.notAfter ?? {})) field(f).$not = { $gt: v };
  for (const [f, v] of Object.entries(g.dayIs ?? {})) filter[f] = v;
  for (const [f, v] of Object.entries(g.dayIsNot ?? {})) field(f).$ne = v;
  return filter;
}

export function accountChange(update: AccountUpdate): Doc {
  const change: Doc = {};
  if (update.inc && Object.keys(update.inc).length) change.$inc = { ...update.inc };
  if (update.set && Object.keys(update.set).length) change.$set = { ...update.set };
  return change;
}
function toItem(d: Doc): ShopItem {
  return {
    id: String(d._id), guildId: String(d.guildId), name: String(d.name), description: String(d.description ?? ""),
    price: Number(d.price), roleId: typeof d.roleId === "string" ? d.roleId : null,
    stock: typeof d.stock === "number" ? d.stock : null, createdAt: date(d.createdAt) ?? new Date(0),
    perUserLimit: typeof d.perUserLimit === "number" ? d.perUserLimit : null,
    roleDurationHours: typeof d.roleDurationHours === "number" ? d.roleDurationHours : null,
    useToGrant: d.useToGrant === true && typeof d.roleId === "string",
    // An effect never rides along with a role (validation refuses it; old or hand-edited documents are read the same way).
    effect: isItemEffect(d.effect) && typeof d.roleId !== "string" ? d.effect : null,
    effectHours: typeof d.effectHours === "number" ? d.effectHours : null,
    effectPercent: typeof d.effectPercent === "number" ? d.effectPercent : null,
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
  // The upsert copies guildId/userId from the filter; only the other fields are set on insert.
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
        await models.account.updateOne({ guildId, userId }, { $setOnInsert: { ...blankCooldowns } }, { upsert: true });
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
    async apply(guildId, userId, raw) {
      const update = withBounds(raw);
      const change = accountChange(update);
      if (!change.$inc && !change.$set) return null;
      const d = await models.account.findOneAndUpdate(accountFilter(guildId, userId, update), change, AFTER).lean();
      return d ? toAccount(d, guildId, userId) : null;
    },
    async resetAccount(guildId, userId) {
      // One update that returns the document as it was, so a credit racing the reset is either before it (and
      // counted in what the log says was removed) or after it (and kept). Nothing is lost from the audit trail.
      const d = await models.account.findOneAndUpdate({ guildId, userId }, { $set: { balance: 0, bank: 0 } }, { returnDocument: "before" }).lean();
      return d ? toAccount(d, guildId, userId) : null;
    },
    async stats(guildId, since) {
      const wealth = { guildId, $or: [{ balance: { $gt: 0 } }, { bank: { $gt: 0 } }] };
      if (!models.account.aggregate || !models.transaction.aggregate) {
        return { accounts: await models.account.countDocuments(wealth), wallet: 0, bank: 0, activity: [], since };
      }
      const [totals, activity] = await Promise.all([
        models.account.aggregate([
          { $match: wealth },
          { $group: { _id: null, accounts: { $sum: 1 }, wallet: { $sum: { $ifNull: ["$balance", 0] } }, bank: { $sum: { $ifNull: ["$bank", 0] } } } },
        ]),
        models.transaction.aggregate([
          { $match: { guildId, createdAt: { $gte: since } } },
          { $group: { _id: "$type", count: { $sum: 1 }, total: { $sum: "$amount" } } },
          { $sort: { count: -1, _id: 1 } },
        ]),
      ]);
      const t = totals[0] ?? {};
      return {
        accounts: Number(t.accounts ?? 0), wallet: Number(t.wallet ?? 0), bank: Number(t.bank ?? 0),
        activity: activity
          .filter(r => (TRANSACTION_TYPES as readonly unknown[]).includes(r._id))
          .map(r => ({ type: r._id as TransactionType, count: Number(r.count ?? 0), total: Number(r.total ?? 0) })),
        since,
      };
    },
    async setBalance(guildId, userId, balance, bank) {
      const set: Doc = bank === undefined ? { balance } : { balance, bank };
      const d = await models.account.findOneAndUpdate(
        { guildId, userId },
        { $set: set, $setOnInsert: { lastDaily: null, dailyStreak: 0, lastWork: null } },
        { ...AFTER, upsert: true },
      ).lean();
      return toAccount(d ?? set, guildId, userId);
    },
    async leaderboard(guildId, offset, limit, sort = "total") {
      const row = (r: Doc): LeaderboardRow => {
        const balance = Number(r.balance ?? 0), bank = Number(r.bank ?? 0);
        return { userId: String(r.userId), balance, bank, total: balance + bank };
      };
      if (sort !== "total" || !models.account.aggregate) {
        const f = sort === "bank" ? "bank" : "balance";
        const filter = { guildId, [f]: { $gt: 0 } };
        const [rows, total] = await Promise.all([
          models.account.find(filter).sort({ [f]: -1, userId: 1 }).skip(offset).limit(limit).select({ userId: 1, balance: 1, bank: 1 }).lean(),
          models.account.countDocuments(filter),
        ]);
        return { rows: rows.map(row), total };
      }
      const filter = { guildId, $or: [{ balance: { $gt: 0 } }, { bank: { $gt: 0 } }] };
      const [rows, total] = await Promise.all([
        models.account.aggregate([
          { $match: filter },
          { $project: { userId: 1, balance: 1, bank: 1, total: { $add: [{ $ifNull: ["$balance", 0] }, { $ifNull: ["$bank", 0] }] } } },
          { $sort: { total: -1, userId: 1 } },
          { $skip: offset },
          { $limit: limit },
        ]),
        models.account.countDocuments(filter),
      ]);
      return { rows: rows.map(row), total };
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
    async takeInventory(guildId, userId, itemId) {
      const d = await models.inventory.findOneAndUpdate({ guildId, userId, itemId, quantity: { $gte: 1 } }, { $inc: { quantity: -1 } }, AFTER).lean();
      return Boolean(d);
    },
    async reservePurchase(guildId, userId, item, limit) {
      try {
        await models.inventory.updateOne(
          { guildId, userId, itemId: item.id },
          { $setOnInsert: { name: item.name, roleId: item.roleId, quantity: 0, bought: 0 } },
          { upsert: true },
        );
      } catch (err) {
        if (!isDuplicateKey(err)) throw err;
      }
      // A missing counter (rows from before limits existed) counts as 0 and passes `$not: { $gte }`.
      const d = await models.inventory.findOneAndUpdate(
        { guildId, userId, itemId: item.id, bought: { $not: { $gte: limit } } },
        { $inc: { bought: 1 } },
        AFTER,
      ).lean();
      return Boolean(d);
    },
    async releasePurchase(guildId, userId, itemId) {
      await models.inventory.updateOne({ guildId, userId, itemId, bought: { $gte: 1 } }, { $inc: { bought: -1 } });
    },
    async inventory(guildId, userId) {
      const rows = await models.inventory.find({ guildId, userId, quantity: { $gt: 0 } }).sort({ name: 1 }).limit(100).lean();
      return rows.map((r): InventoryRow => ({ itemId: String(r.itemId), name: String(r.name), quantity: Number(r.quantity), roleId: (r.roleId as string) ?? null }));
    },
  };
}
