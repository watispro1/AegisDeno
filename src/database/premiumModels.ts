/**
 * Aegis Premium records. Aegis stores only Paddle IDs and subscription state:
 * no names, emails, addresses or card details (Paddle is the merchant of record).
 */
import mongoose from "mongoose";
import { PREMIUM_STATUSES } from "../services/premiumState";

const PremiumEntitlementSchema = new mongoose.Schema({
  guildId: { type: String, required: true, maxlength: 20 },
  userId: { type: String, default: null, maxlength: 20 },
  subscriptionId: { type: String, required: true, maxlength: 40 },
  customerId: { type: String, default: null, maxlength: 40 },
  status: { type: String, enum: PREMIUM_STATUSES, required: true },
  currentPeriodEnd: { type: Date, default: null },
  pastDueSince: { type: Date, default: null },
  cancelAt: { type: Date, default: null },
  lastEventAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
PremiumEntitlementSchema.index({ subscriptionId: 1 }, { unique: true });
PremiumEntitlementSchema.index({ guildId: 1, updatedAt: -1 });
export const PremiumEntitlementModel = mongoose.model("PremiumEntitlement", PremiumEntitlementSchema);

/** Paddle event IDs already handled, so a redelivered webhook is a no-op. Kept 30 days (Paddle retries for 3). */
const PaddleEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, maxlength: 40 },
  eventType: { type: String, required: true, maxlength: 64 },
  processedAt: { type: Date, default: Date.now },
});
PaddleEventSchema.index({ eventId: 1 }, { unique: true });
PaddleEventSchema.index({ processedAt: 1 }, { expireAfterSeconds: 30 * 86_400 });
export const PaddleEventModel = mongoose.model("PaddleEvent", PaddleEventSchema);
