/**
 * Aegis Premium records. Aegis stores only subscription IDs and subscription state:
 * no names, emails, addresses or card details (Stripe is the secure payment processor).
 */
import mongoose from "mongoose";
import { PREMIUM_STATUSES } from "../services/premiumState";

const PremiumEntitlementSchema = new mongoose.Schema({
  guildId: { type: String, required: true, maxlength: 20 },
  userId: { type: String, default: null, maxlength: 20 },
  subscriptionId: { type: String, required: true, maxlength: 64 },
  customerId: { type: String, default: null, maxlength: 64 },
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

/** Stripe event IDs already handled, so a redelivered webhook is a no-op. Kept 30 days. */
const StripeEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, maxlength: 64 },
  eventType: { type: String, required: true, maxlength: 64 },
  processedAt: { type: Date, default: Date.now },
});
StripeEventSchema.index({ eventId: 1 }, { unique: true });
StripeEventSchema.index({ processedAt: 1 }, { expireAfterSeconds: 30 * 86_400 });
export const StripeEventModel = mongoose.model("StripeEvent", StripeEventSchema);
