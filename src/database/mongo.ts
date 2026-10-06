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
  prefix: { type: String, default: "!" },
  language: { type: String, default: "en" },
  loggingEnabled: { type: Boolean, default: false },
  loggingChannelId: { type: String, default: null },
  welcomeEnabled: { type: Boolean, default: false },
  welcomeChannelId: { type: String, default: null },
  welcomeMessage: { type: String, default: "Welcome {user} to **{server}**! You are member #{member_count}." },
  welcomeRoleId: { type: String, default: null },
  suggestionsChannelId: { type: String, default: null },
  // Escalation: auto-actions when a user hits X warnings
  escalation: {
    enabled: { type: Boolean, default: false },
    // e.g. [{atWarnings: 3, action: "timeout", durationMinutes: 60}, {atWarnings: 5, action: "ban"}]
    thresholds: { type: mongoose.Schema.Types.Mixed, default: [] },
  },
});
export const GuildConfigModel = mongoose.model("GuildConfig", GuildConfigSchema);

const WarningSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  moderatorId: { type: String, required: true },
  reason: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
export const WarningModel = mongoose.model("Warning", WarningSchema);

const ModerationCaseSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  moderatorId: { type: String, required: true },
  action: { type: String, required: true },
  reason: { type: String, required: true },
  details: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});
ModerationCaseSchema.index({ guildId: 1, userId: 1, createdAt: -1 });
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
  createdAt: { type: Date, default: Date.now },
});
export const SuggestionModel = mongoose.model("Suggestion", SuggestionSchema);
