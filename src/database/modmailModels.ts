/** ModMail tickets, snippets, and the weekly digest's idempotency record. */
import mongoose from "mongoose";

const ModmailLineSchema = new mongoose.Schema({
  authorId: { type: String, required: true },
  authorTag: { type: String, required: true, maxlength: 64 },
  fromStaff: { type: Boolean, default: false },
  anonymous: { type: Boolean, default: false },
  content: { type: String, default: "", maxlength: 4000 },
  at: { type: Date, default: Date.now },
}, { _id: false });

const ModmailThreadSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  userTag: { type: String, default: "", maxlength: 64 },
  threadId: { type: String, required: true },
  status: { type: String, enum: ["open", "closed"], default: "open" },
  lines: { type: [ModmailLineSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null },
  closedBy: { type: String, default: null },
  closeReason: { type: String, default: null, maxlength: 512 },
  /** Set on close: the transcript is deleted 90 days later. */
  expiresAt: { type: Date, default: null },
});
// One open ticket per member per server, enforced by the database (race-safe).
ModmailThreadSchema.index({ guildId: 1, userId: 1 }, { unique: true, partialFilterExpression: { status: "open" } });
ModmailThreadSchema.index({ threadId: 1 });
ModmailThreadSchema.index({ userId: 1, status: 1 });
ModmailThreadSchema.index({ guildId: 1, status: 1, createdAt: -1 });
ModmailThreadSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const ModmailThreadModel = mongoose.model("ModmailThread", ModmailThreadSchema);

const ModmailSnippetSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  name: { type: String, required: true, maxlength: 32 },
  content: { type: String, required: true, maxlength: 1800 },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
ModmailSnippetSchema.index({ guildId: 1, name: 1 }, { unique: true });
export const ModmailSnippetModel = mongoose.model("ModmailSnippet", ModmailSnippetSchema);

/** One row per guild-week posted; the unique key stops a second post after a restart or retry. */
const DigestRunSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  weekKey: { type: String, required: true },
  lowTrust: { type: Number, default: null },
  postedAt: { type: Date, default: Date.now },
});
DigestRunSchema.index({ guildId: 1, weekKey: 1 }, { unique: true });
DigestRunSchema.index({ postedAt: 1 }, { expireAfterSeconds: 400 * 86_400 });
export const DigestRunModel = mongoose.model("DigestRun", DigestRunSchema);

export function isDuplicateKey(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as { code?: unknown }).code === 11000);
}
