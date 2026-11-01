import { SuggestionModel } from "../database/mongo";
import { escapeRegex } from "../utils/mongoSafe";

export interface Suggestion {
  id: string;
  guildId: string;
  authorId: string;
  content: string;
  messageId: string | null;
  channelId: string | null;
  status: "pending" | "approved" | "rejected" | "considered" | "archived";
  upvotes: string[];
  downvotes: string[];
  reviewedBy?: string | null;
  reviewReason?: string | null;
  reviewedAt?: Date | null;
  createdAt: Date;
}

export async function createSuggestion(
  guildId: string,
  authorId: string,
  content: string,
): Promise<Suggestion> {
  const id = crypto.randomUUID();
  const doc = await SuggestionModel.create({
    id,
    guildId,
    authorId,
    content,
    status: "pending",
  });
  return doc.toObject() as Suggestion;
}

export async function getSuggestion(guildId: string, id: string): Promise<Suggestion | null> {
  const doc = await SuggestionModel.findOne({ guildId, id });
  return doc ? doc.toObject() as Suggestion : null;
}

export async function updateSuggestion(guildId: string, id: string, partial: Partial<Suggestion>): Promise<void> {
  await SuggestionModel.updateOne({ guildId, id }, { $set: partial });
}

export async function voteOnSuggestion(
  guildId: string,
  id: string,
  userId: string,
  vote: "up" | "down"
): Promise<Suggestion | null> {
  // Keep a voter in exactly one collection without a read/modify/write race.
  const addField = vote === "up" ? "upvotes" : "downvotes";
  const removeField = vote === "up" ? "downvotes" : "upvotes";
  const updated = await SuggestionModel.findOneAndUpdate(
    { guildId, id, status: { $in: ["pending", "considered"] } },
    { $pull: { [removeField]: userId }, $addToSet: { [addField]: userId } },
    { new: true },
  );
  return updated ? updated.toObject() as Suggestion : null;
}

/**
 * Move a suggestion to a reviewed status, but only if it is still open
 * (pending or under consideration), so two moderators can't both finalise it.
 */
export async function reviewSuggestion(
  guildId: string,
  id: string,
  status: "approved" | "rejected" | "considered",
  reviewerId: string,
  reason: string | null,
): Promise<Suggestion | null> {
  const updated = await SuggestionModel.findOneAndUpdate(
    { guildId, id, status: { $in: ["pending", "considered"] } },
    { $set: { status, reviewedBy: reviewerId, reviewReason: reason, reviewedAt: new Date() } },
    { new: true },
  );
  return updated ? updated.toObject() as Suggestion : null;
}

export async function deleteSuggestion(guildId: string, id: string): Promise<void> {
  await SuggestionModel.deleteOne({ guildId, id });
}

/**
 * Up to 25 recent suggestions for an autocomplete list, newest first,
 * optionally only those still open for review, filtered by typed text
 * (matched literally against the content or the start of the ID).
 */
export async function listSuggestionsForPicker(
  guildId: string,
  openOnly: boolean,
  typed: string,
): Promise<Array<Pick<Suggestion, "id" | "content" | "status">>> {
  const query = typed.trim().slice(0, 50);
  const filter: Record<string, unknown> = { guildId };
  if (openOnly) filter.status = { $in: ["pending", "considered"] };
  if (query) {
    const literal = escapeRegex(query);
    filter.$or = [{ content: { $regex: literal, $options: "i" } }, { id: { $regex: `^${literal}`, $options: "i" } }];
  }
  const docs = await SuggestionModel.find(filter).sort({ createdAt: -1 }).limit(25).select("id content status").lean();
  return docs.map(d => ({ id: String(d.id), content: String(d.content), status: String(d.status) as Suggestion["status"] }));
}
