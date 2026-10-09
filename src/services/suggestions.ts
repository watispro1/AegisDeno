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
  const suggestion = await getSuggestion(guildId, id);
  if (!suggestion) return null;

  // Remove from both to prevent duplicate / switched votes
  const upvotes   = suggestion.upvotes.filter(u => u !== userId);
  const downvotes = suggestion.downvotes.filter(d => d !== userId);

  if (vote === "up") upvotes.push(userId);
  else downvotes.push(userId);

  const updated = await SuggestionModel.findOneAndUpdate(
    { guildId, id },
    { $set: { upvotes, downvotes } },
    { new: true }
  );
  return updated ? updated.toObject() as Suggestion : null;
}
