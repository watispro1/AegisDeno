import mongoose from "mongoose";
import { logger } from "../utils/logger";

export async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGO_URI;
  
  if (!uri) {
    logger.error("MONGO_URI is missing in your .env file!");
    logger.error("Please create a free cluster at MongoDB Atlas (mongodb.com) and paste your connection string.");
    process.exit(1);
  }

  try {
    mongoose.set("strictQuery", false);
    await mongoose.connect(uri);
    logger.info("✅ Successfully connected to MongoDB!");
  } catch (error) {
    logger.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
}

export async function closeDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info("Closed MongoDB connection.");
}

// ─── Schemas & Models ────────────────────────────────────────────────────────

const GuildConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  prefix: { type: String, default: "!", maxlength: 16 },
  language: { type: String, default: "en", maxlength: 10 },
  loggingEnabled: { type: Boolean, default: false },
  loggingChannelId: { type: String, default: null },
  // Per-category toggles for the audit log, e.g. { modActions: true, messageDeletes: false }.
  logCategories: { type: mongoose.Schema.Types.Mixed, default: null },
  welcomeEnabled: { type: Boolean, default: false },
  welcomeChannelId: { type: String, default: null },
  welcomeMessage: { type: String, default: "Welcome {user} to **{server}**! You are member #{member_count}.", maxlength: 1000 },
  welcomeRoleId: { type: String, default: null },
  suggestionsChannelId: { type: String, default: null },
  // Added in 3.6.2 (dashboard overhaul). Normalised in services/configuration.ts.
  welcomeEmbed: { type: mongoose.Schema.Types.Mixed, default: null },
  goodbyeEnabled: { type: Boolean, default: false },
  goodbyeChannelId: { type: String, default: null },
  goodbyeMessage: { type: String, maxlength: 1000 },
  goodbyeEmbed: { type: mongoose.Schema.Types.Mixed, default: null },
  autorespondersEnabled: { type: Boolean, default: true },
  // Incident Mode defaults and auto-trigger; module switches. Normalised in guildConfigNormalize.ts.
  incident: { type: mongoose.Schema.Types.Mixed, default: null },
  modules: { type: mongoose.Schema.Types.Mixed, default: null },
  logChannels: { type: mongoose.Schema.Types.Mixed, default: null },
  // Escalation: auto-actions when a user hits X warnings
  escalation: {
    enabled: { type: Boolean, default: false },
    // e.g. [{atWarnings: 3, action: "timeout", durationMinutes: 60}, {atWarnings: 5, action: "ban"}]
    thresholds: { type: mongoose.Schema.Types.Mixed, default: [] },
    warnExpiryDays: { type: Number, default: null },
  },
  // No schema defaults: services/configuration.ts fills them, and an absent
  // field is how the one-time copy of retired settings knows what is unset.
  tickets: {
    logChannelId: { type: String },
    autoCloseHours: { type: Number },
    transcriptLogging: { type: Boolean },
  },
  roles: {
    maxRolesPerPanel: { type: Number },
  },
  legacySettingsMigratedAt: { type: Date, default: null },
});
export const GuildConfigModel = mongoose.model("GuildConfig", GuildConfigSchema);

const WarningSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  moderatorId: { type: String, required: true },
  reason: { type: String, required: true },
  proofUrl: { type: String, default: null },
  // Set by the /warn Undo button. Revoked warnings are kept for the record but
  // no longer count toward totals, escalation or the trust score.
  revoked: { type: Boolean, default: false },
  revokedBy: { type: String, default: null },
  revokedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});
WarningSchema.index({ guildId: 1, userId: 1, createdAt: -1 });
// Active-warning counts and lists (escalation, /warnings, trust score) filter on revoked.
WarningSchema.index({ guildId: 1, userId: 1, revoked: 1, createdAt: -1 });
// Guild-wide recent counts (/modreport, activity summary, dashboard).
WarningSchema.index({ guildId: 1, createdAt: -1 });
WarningSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31_536_000 });
export const WarningModel = mongoose.model("Warning", WarningSchema);

const ModerationCaseSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  moderatorId: { type: String, required: true },
  action: { type: String, required: true },
  reason: { type: String, required: true },
  details: { type: String, default: null },
  proofUrl: { type: String, default: null },
  // Set when the action is reversed with the Undo button on /timeout or /ban.
  revoked: { type: Boolean, default: false },
  revokedBy: { type: String, default: null },
  revokedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});
ModerationCaseSchema.index({ guildId: 1, userId: 1, createdAt: -1 });
// Guild case lists and recent counts (/case list, /modreport, /modstats, dashboard).
ModerationCaseSchema.index({ guildId: 1, createdAt: -1 });
ModerationCaseSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31_536_000 });
export const ModerationCaseModel = mongoose.model("ModerationCase", ModerationCaseSchema);

const TaskSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  creatorId: { type: String, required: true },
  type: { type: String, required: true },
  payload: { type: String, required: true },
  executeAt: { type: Date, required: true },
  intervalMs: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now },
});
TaskSchema.index({ guildId: 1, executeAt: 1 });
TaskSchema.index({ creatorId: 1, type: 1, executeAt: 1 });
// Boot-time restore: `$or: [{ executeAt >= cutoff }, { type in [...] }]` needs one index per branch.
TaskSchema.index({ executeAt: 1 });
TaskSchema.index({ type: 1, executeAt: 1 });
// Per-channel lookups (ticket auto-close, /lock auto-unlock).
TaskSchema.index({ guildId: 1, channelId: 1, type: 1 });
export const TaskModel = mongoose.model("ScheduledTask", TaskSchema);

const AutomodSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  words: {
    enabled: { type: Boolean, default: false },
    list: { type: [String], default: [] },
    action: { type: String, default: "delete" },
  },
  links: {
    enabled: { type: Boolean, default: false },
    action: { type: String, default: "delete" },
  },
  mentions: {
    enabled: { type: Boolean, default: false },
    threshold: { type: Number, default: 5 },
    action: { type: String, default: "timeout" },
  },
  spam: {
    enabled: { type: Boolean, default: false },
    // Max messages per windowSeconds before enforcement triggers
    maxMessages: { type: Number, default: 5 },
    windowSeconds: { type: Number, default: 5 },
    action: { type: String, default: "timeout" },
  },
  caps: {
    enabled: { type: Boolean, default: false },
    threshold: { type: Number, default: 80 },
    action: { type: String, default: "delete" },
  },
  // Role or channel IDs that are exempt from all automod rules
  exemptRoleIds:    { type: [String], default: [] },
  exemptChannelIds: { type: [String], default: [] },
});
export const AutomodModel = mongoose.model("AutomodConfig", AutomodSchema);

const SuggestionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  authorId: { type: String, required: true },
  content: { type: String, required: true },
  messageId: { type: String, default: null },
  channelId: { type: String, default: null },
  status: { type: String, default: "pending" },
  upvotes: { type: [String], default: [] },
  downvotes: { type: [String], default: [] },
  reviewedBy: { type: String, default: null },
  reviewReason: { type: String, default: null },
  reviewedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});
export const SuggestionModel = mongoose.model("Suggestion", SuggestionSchema);

const TicketSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  userId: { type: String, required: true },
  staffRoleId: { type: String, default: null },
  category: { type: String, default: "general" },
  claimedBy: { type: String, default: null },
  lastActivityAt: { type: Date, default: Date.now },
  status: { type: String, default: "open" },
  closedBy: { type: String, default: null },
  closedAt: { type: Date, default: null },
  reason: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});
TicketSchema.index({ guildId: 1, userId: 1, status: 1 });
// Message-path activity updates and channel → ticket lookups filter by channel.
TicketSchema.index({ channelId: 1, status: 1 });
// Enforce the one-open-ticket-per-member policy even across restarts or
// multiple bot instances. Closed tickets remain fully queryable as history.
TicketSchema.index(
  { guildId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { status: "open" } },
);
export const TicketModel = mongoose.model("Ticket", TicketSchema);

const VerificationSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  verifiedRoleId: { type: String, required: true },
  type: { type: String, enum: ["button", "captcha"], default: "button" },
  channelId: { type: String, default: null },
  messageId: { type: String, default: null },
  kickUnverifiedMinutes: { type: Number, default: 0 },
});
export const VerificationModel = mongoose.model("Verification", VerificationSchema);

const AutoResponderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  trigger: { type: String, required: true },
  response: { type: String, required: true },
  matchType: { type: String, enum: ["exact", "contains", "startsWith"], default: "contains" },
  enabled: { type: Boolean, default: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
AutoResponderSchema.index({ guildId: 1, trigger: 1 });
export const AutoResponderModel = mongoose.model("AutoResponder", AutoResponderSchema);

const StaffNoteSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  moderatorId: { type: String, required: true },
  note: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
StaffNoteSchema.index({ guildId: 1, userId: 1, createdAt: -1 });
StaffNoteSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31_536_000 });
export const StaffNoteModel = mongoose.model("StaffNote", StaffNoteSchema);

const RolePanelSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  messageId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  panelStyle: { type: String, default: 'button' },
  mode: { type: String, default: 'multi' },
  requiredRoleId: { type: String, default: null },
  roles: [
    {
      roleId: { type: String, required: true },
      label: { type: String, required: true },
      emoji: { type: String, default: null },
      style: { type: Number, default: 1 }, // 1 Primary, 2 Secondary, 3 Success, 4 Danger
    },
  ],
  createdAt: { type: Date, default: Date.now },
});
export const RolePanelModel = mongoose.model("RolePanel", RolePanelSchema);

const GiveawaySchema = new mongoose.Schema({
  guildId:       { type: String, required: true },
  channelId:     { type: String, required: true },
  messageId:     { type: String, required: true, unique: true },
  prize:         { type: String, required: true },
  description:   { type: String, default: null },
  winnerCount:   { type: Number, default: 1 },
  requiredRoleId:{ type: String, default: null },
  requiredLevel: { type: Number, default: 0 },
  hostId:        { type: String, required: true },
  entrants:      { type: [String], default: [] },
  winners:       { type: [String], default: [] },
  // Everyone who has won this giveaway before a reroll, so rerolls pick new people.
  previousWinners: { type: [String], default: [] },
  // Server boosters get `boosterMultiplier` tickets; boosting is checked when they enter.
  boosterMultiplier: { type: Number, default: 1, min: 1, max: 10 },
  boosterEntrants: { type: [String], default: [] },
  endsAt:        { type: Date, required: true },
  endedAt:       { type: Date, default: null },
  ended:         { type: Boolean, default: false },
  createdAt:     { type: Date, default: Date.now },
});
GiveawaySchema.index({ guildId: 1, ended: 1, endsAt: 1 });
export const GiveawayModel = mongoose.model("Giveaway", GiveawaySchema);

/**
 * A /poll. Votes live here (not in memory) so buttons keep working and timed
 * polls still close after a restart. `votes` maps user ID → picked option indices.
 */
const PollSchema = new mongoose.Schema({
  guildId:      { type: String, required: true },
  channelId:    { type: String, required: true },
  messageId:    { type: String, required: true, unique: true },
  creatorId:    { type: String, required: true },
  creatorTag:   { type: String, default: "" },
  question:     { type: String, required: true, maxlength: 300 },
  options:      { type: [String], required: true },
  multiselect:  { type: Boolean, default: false },
  anonymous:    { type: Boolean, default: false },
  imageUrl:     { type: String, default: null },
  votes:        { type: mongoose.Schema.Types.Mixed, default: {} },
  endsAt:       { type: Date, default: null },
  closeTaskId:  { type: String, default: null },
  ended:        { type: Boolean, default: false },
  endedAt:      { type: Date, default: null },
  createdAt:    { type: Date, default: Date.now },
}, { minimize: false });
PollSchema.index({ guildId: 1, ended: 1 });
export const PollModel = mongoose.model("Poll", PollSchema);


/**
 * Retired per-feature settings (one document per guild and feature). Read only,
 * once per guild, to copy ticket and role-panel settings into GuildConfig; see
 * services/configuration.ts. Nothing writes here any more, and `autoIndex` is
 * off so the bot never touches this collection's indexes. Safe to drop once
 * every guild's config has `legacySettingsMigratedAt` set.
 */
const LegacyPluginSettingsSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  pluginName: { type: String, required: true },
  enabled: { type: Boolean },
  config: { type: mongoose.Schema.Types.Mixed },
}, { collection: "pluginconfigs", autoIndex: false, autoCreate: false });
export const LegacyPluginSettingsModel = mongoose.model("LegacyPluginSettings", LegacyPluginSettingsSchema);

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
});
UserActivitySchema.index({ guildId: 1, userId: 1 }, { unique: true });
export const UserActivityModel = mongoose.model('UserActivity', UserActivitySchema);

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
