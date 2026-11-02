/** Economy models: per-server settings, balances (with persisted cooldowns), transactions (90-day TTL), shop items and inventories. */
import mongoose from "mongoose";
import { TRANSACTION_TTL_DAYS } from "../services/economyLogic";

const EconomyConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  currencyName: { type: String, maxlength: 24 },
  currencyEmoji: { type: String, maxlength: 64 },
  dailyAmount: Number,
  dailyStreakBonus: Number,
  dailyCooldownHours: Number,
  workMin: Number,
  workMax: Number,
  workCooldownMinutes: Number,
  payConfirmThreshold: Number,
  updatedAt: { type: Date, default: Date.now },
});
export const EconomyConfigModel = mongoose.model("EconomyConfig", EconomyConfigSchema);

const EconomyAccountSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  balance: { type: Number, default: 0, min: 0 },
  lastDaily: { type: Date, default: null },
  dailyStreak: { type: Number, default: 0 },
  lastWork: { type: Date, default: null },
});
EconomyAccountSchema.index({ guildId: 1, userId: 1 }, { unique: true });
EconomyAccountSchema.index({ guildId: 1, balance: -1, userId: 1 });
export const EconomyAccountModel = mongoose.model("EconomyAccount", EconomyAccountSchema);

const EconomyTransactionSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  type: { type: String, required: true },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  otherUserId: { type: String, default: null },
  actorId: { type: String, default: null },
  note: { type: String, default: null, maxlength: 300 },
  createdAt: { type: Date, default: Date.now },
});
EconomyTransactionSchema.index({ guildId: 1, createdAt: -1 });
EconomyTransactionSchema.index({ guildId: 1, userId: 1, createdAt: -1 });
EconomyTransactionSchema.index({ createdAt: 1 }, { expireAfterSeconds: TRANSACTION_TTL_DAYS * 24 * 60 * 60 });
export const EconomyTransactionModel = mongoose.model("EconomyTransaction", EconomyTransactionSchema);

const ShopItemSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  name: { type: String, required: true, maxlength: 40 },
  nameKey: { type: String, required: true },
  description: { type: String, default: "", maxlength: 200 },
  price: { type: Number, required: true, min: 1 },
  roleId: { type: String, default: null },
  stock: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now },
});
ShopItemSchema.index({ guildId: 1, nameKey: 1 }, { unique: true });
export const ShopItemModel = mongoose.model("EconomyShopItem", ShopItemSchema);

const InventorySchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  itemId: { type: String, required: true },
  name: { type: String, required: true },
  roleId: { type: String, default: null },
  quantity: { type: Number, default: 0 },
});
InventorySchema.index({ guildId: 1, userId: 1, itemId: 1 }, { unique: true });
export const InventoryModel = mongoose.model("EconomyInventory", InventorySchema);
