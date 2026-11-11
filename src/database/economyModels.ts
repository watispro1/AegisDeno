/** Economy models: per-server settings, wallets and banks (with persisted cooldowns, daily limits, work XP, shields and boosts), transactions (90-day TTL), shop items and inventories. */
import mongoose from "mongoose";
import { TRANSACTION_TTL_DAYS } from "../services/economyLogic";

const EconomyConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  currencyName: { type: String, maxlength: 24 },
  currencyEmoji: { type: String, maxlength: 64 },
  dailyAmount: Number,
  dailyStreakBonus: Number,
  dailyStreakCapDays: Number,
  dailyCooldownHours: Number,
  weeklyAmount: Number,
  workMin: Number,
  workMax: Number,
  workCooldownMinutes: Number,
  bankCap: Number,
  payConfirmThreshold: Number,
  payMinMemberHours: Number,
  payDailyLimit: Number,
  payTaxPercent: Number,
  shopSellPercent: Number,
  crimeEnabled: Boolean,
  crimeSuccessPercent: Number,
  crimeMin: Number,
  crimeMax: Number,
  crimeFine: Number,
  crimeCooldownMinutes: Number,
  gamblingEnabled: Boolean,
  gambleMinBet: Number,
  gambleMaxBet: Number,
  gambleDailyLossCap: Number,
  gambleCooldownSeconds: Number,
  workLevelBonusPercent: Number,
  bankInterestBps: Number,
  bankInterestMaxDaily: Number,
  robEnabled: Boolean,
  robSuccessPercent: Number,
  robMaxStealPercent: Number,
  robMaxSteal: Number,
  robFinePercent: Number,
  robMinWallet: Number,
  robMinTargetWallet: Number,
  robCooldownMinutes: Number,
  robProtectMinutes: Number,
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
  bank: { type: Number, default: 0, min: 0 },
  lastWeekly: { type: Date, default: null },
  lastCrime: { type: Date, default: null },
  lastGamble: { type: Date, default: null },
  gambleDay: { type: String, default: null },
  gambleLoss: { type: Number, default: 0 },
  payDay: { type: String, default: null },
  payTotal: { type: Number, default: 0 },
  workXp: { type: Number, default: 0 },
  workBoostPercent: { type: Number, default: 0 },
  workBoostUntil: { type: Date, default: null },
  shieldUntil: { type: Date, default: null },
  lastRob: { type: Date, default: null },
  lastRobbed: { type: Date, default: null },
  lastInterest: { type: Date, default: null },
});
EconomyAccountSchema.index({ guildId: 1, userId: 1 }, { unique: true });
EconomyAccountSchema.index({ guildId: 1, balance: -1, userId: 1 });
EconomyAccountSchema.index({ guildId: 1, bank: -1, userId: 1 });
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
  perUserLimit: { type: Number, default: null },
  roleDurationHours: { type: Number, default: null },
  useToGrant: { type: Boolean, default: false },
  effect: { type: String, default: null, enum: ["rob_shield", "work_boost"] },
  effectHours: { type: Number, default: null },
  effectPercent: { type: Number, default: null },
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
  /** Units ever bought, for per-member purchase limits (use and sale don't lower it). */
  bought: { type: Number, default: 0 },
});
InventorySchema.index({ guildId: 1, userId: 1, itemId: 1 }, { unique: true });
export const InventoryModel = mongoose.model("EconomyInventory", InventorySchema);
