/** Web dashboard collections: sessions, rate-limit buckets and the audit log. Split out of mongo.ts. */
import mongoose from "mongoose";

// ─── Web dashboard sessions ───────────────────────────────────────────────────

/**
 * One signed-in dashboard browser. The cookie holds a signed random ID; only its
 * SHA-256 is stored here. The Discord access token never leaves the server.
 * Documents are removed by the TTL index once `expiresAt` passes (7 days).
 */
const DashboardSessionSchema = new mongoose.Schema({
  sidHash:        { type: String, required: true, unique: true },
  userId:         { type: String, required: true },
  username:       { type: String, required: true },
  globalName:     { type: String, default: null },
  avatar:         { type: String, default: null },
  accessToken:    { type: String, required: true },
  tokenExpiresAt: { type: Date, required: true },
  // Guilds from GET /users/@me/guilds at login or the last refresh: { id, name, icon, owner, permissions }.
  guilds:         { type: mongoose.Schema.Types.Mixed, default: [] },
  guildsFetchedAt:{ type: Date, default: Date.now },
  createdAt:      { type: Date, default: Date.now },
  expiresAt:      { type: Date, required: true },
}, { minimize: false });
DashboardSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
DashboardSessionSchema.index({ userId: 1 });
export const DashboardSessionModel = mongoose.model("DashboardSession", DashboardSessionSchema);

/**
 * Dashboard rate-limit counters, one document per client, bucket and fixed
 * one-minute window. Shared by every process, so limits hold across restarts
 * and machines. The TTL index removes a window shortly after it ends.
 * `key` is a SHA-256 of the client address, never the address itself.
 */
const DashboardRateLimitSchema = new mongoose.Schema({
  _id:       { type: String },            // `${bucket}:${keyHash}:${windowStart}`
  count:     { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
}, { versionKey: false });
DashboardRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const DashboardRateLimitModel = mongoose.model("DashboardRateLimit", DashboardRateLimitSchema);

/**
 * What was changed through the web dashboard, per server: who, what and when.
 * Shown on the dashboard's Activity page; kept for 180 days.
 */
const DashboardAuditSchema = new mongoose.Schema({
  guildId:   { type: String, required: true },
  userId:    { type: String, required: true },
  username:  { type: String, required: true },
  action:    { type: String, required: true },   // e.g. "settings.automod", "case.revoke", "appeal.approve"
  target:    { type: String, default: null },    // case ID, appeal code, channel ID…
  summary:   { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });
DashboardAuditSchema.index({ guildId: 1, createdAt: -1 });
DashboardAuditSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });
export const DashboardAuditModel = mongoose.model("DashboardAudit", DashboardAuditSchema);
