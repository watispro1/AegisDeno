/** Starboard, Ghost Watch, ban appeals, automod hit log and member activity models. Split out of mongo.ts. */
import mongoose from "mongoose";

// ─── Starboard ────────────────────────────────────────────────────────────────

/**
 * Per-guild starboard configuration stored in MongoDB.
 * Read on every starboard reaction (cached in services/starboard.ts).
 */
const StarboardConfigSchema = new mongoose.Schema({
  guildId:         { type: String, required: true, unique: true },
  channelId:       { type: String, default: null },       // target channel
  emoji:           { type: String, default: "⭐" },        // trigger emoji
  threshold:       { type: Number, default: 3 },          // minimum reactions
  selfStar:        { type: Boolean, default: false },      // allow author to star own message
  ignoredChannels: { type: [String], default: [] },       // channels excluded from starring
  ignoredRoles:    { type: [String], default: [] },       // roles whose messages are excluded
  enabled:         { type: Boolean, default: true },
  updatedAt:       { type: Date, default: Date.now },
});
export const StarboardConfigModel = mongoose.model("StarboardConfig", StarboardConfigSchema);

/**
 * Tracks messages that have already been posted to the starboard to prevent
 * duplicate entries and enable live count updates on the starboard embed.
 */
const StarboardEntrySchema = new mongoose.Schema({
  guildId:         { type: String, required: true },
  sourceChannelId: { type: String, required: true },  // channel of original message
  sourceMessageId: { type: String, required: true },  // ID of original message
  authorId:        { type: String, required: true },
  starboardMessageId: { type: String, required: true }, // posted embed message ID
  starCount:       { type: Number, default: 0 },
  createdAt:       { type: Date, default: Date.now },
});
StarboardEntrySchema.index({ guildId: 1, sourceMessageId: 1 }, { unique: true });
StarboardEntrySchema.index({ guildId: 1, createdAt: -1 });
export const StarboardEntryModel = mongoose.model("StarboardEntry", StarboardEntrySchema);

// ─── Ghost Watch (Watchlist) ──────────────────────────────────────────────────

/**
 * A watchlist entry places a member under silent staff surveillance.
 * Any activity event (message, edit, delete, join, leave, role change) fires
 * an instant DM to the moderator who placed the watch.
 */
const WatchlistEntrySchema = new mongoose.Schema({
  guildId:      { type: String, required: true },
  targetId:     { type: String, required: true },   // watched member
  moderatorId:  { type: String, required: true },   // receives DM alerts
  reason:       { type: String, default: null },
  expiresAt:    { type: Date, default: null },       // null = indefinite
  events:       { type: [String], default: ["message", "edit", "delete", "join", "leave", "roleChange"] },
  alertCount:   { type: Number, default: 0 },        // how many alerts fired
  alertChannelId: { type: String, default: null },   // optional staff channel that also gets alerts
  createdAt:    { type: Date, default: Date.now },
});
WatchlistEntrySchema.index({ guildId: 1, targetId: 1, moderatorId: 1 }, { unique: true });
WatchlistEntrySchema.index({ guildId: 1, targetId: 1 });
export const WatchlistEntryModel = mongoose.model("WatchlistEntry", WatchlistEntrySchema);

// ─── Ban Appeal Workflow ──────────────────────────────────────────────────────

/**
 * When a member is banned, Aegis generates a unique appeal code and persists
 * the appeal record. Staff can approve/deny via the /appeal command.
 */
const BanAppealSchema = new mongoose.Schema({
  appealCode:   { type: String, required: true, unique: true },  // e.g. "AGS-3F9X"
  guildId:      { type: String, required: true },
  userId:       { type: String, required: true },
  moderatorId:  { type: String, required: true },               // who issued the ban
  banReason:    { type: String, required: true },
  appealText:   { type: String, default: null },                // submitted by the banned user
  status:       { type: String, enum: ["pending", "approved", "denied", "expired"], default: "pending" },
  reviewedBy:   { type: String, default: null },
  reviewNote:   { type: String, default: null },
  reviewedAt:   { type: Date, default: null },
  createdAt:    { type: Date, default: Date.now },
  expiresAt:    { type: Date, default: null },                  // optional appeal deadline
});
BanAppealSchema.index({ guildId: 1, status: 1, createdAt: -1 });
BanAppealSchema.index({ guildId: 1, userId: 1 });
export const BanAppealModel = mongoose.model("BanAppeal", BanAppealSchema);

// ─── Automod Hit Log (for Mod Report analytics) ───────────────────────────────

/**
 * Each automod enforcement action is recorded here so /modreport can aggregate
 * trend data: top triggered rules, busiest hours, most flagged users, etc.
 */
const AutomodHitSchema = new mongoose.Schema({
  guildId:    { type: String, required: true },
  userId:     { type: String, required: true },
  channelId:  { type: String, required: true },
  rule:       { type: String, required: true },   // "words" | "links" | "mentions" | "spam" | "caps"
  action:     { type: String, required: true },   // "delete" | "timeout" | "warn"
  content:    { type: String, default: null },    // truncated snippet (max 200 chars)
  triggeredAt:{ type: Date, default: Date.now },
});
AutomodHitSchema.index({ guildId: 1, triggeredAt: -1 });
AutomodHitSchema.index({ guildId: 1, userId: 1, triggeredAt: -1 });
AutomodHitSchema.index({ guildId: 1, rule: 1, triggeredAt: -1 });
export const AutomodHitModel = mongoose.model("AutomodHit", AutomodHitSchema);

const UserActivitySchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  messageCount: { type: Number, default: 0 },
  lastMessageAt: { type: Date, default: Date.now },
  lastMessageDate: { type: String, default: '' },
  // UTC days ("2026-11-01") with at least one message, last 30 days only. Counts, never content.
  recentDays: { type: [String], default: [] },
});
UserActivitySchema.index({ guildId: 1, userId: 1 }, { unique: true });
// Members silent for 180 days lose their activity counters (Trust Score privacy TTL).
UserActivitySchema.index({ lastMessageAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });
export const UserActivityModel = mongoose.model('UserActivity', UserActivitySchema);

