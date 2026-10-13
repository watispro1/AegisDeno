import { SuggestionModel } from "../database/mongo";

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
