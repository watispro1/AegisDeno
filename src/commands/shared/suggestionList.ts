/** /suggest list: the server's suggestions by status, newest first, with votes and jump links. */
import { SuggestionModel } from "../../database/mongo";
import { STATUS_LABELS } from "../../services/suggestionReview";
import { messageLink } from "./inputChecks";

export const SUGGESTION_LIST_STATUSES = ["open", "pending", "considered", "approved", "rejected", "all"] as const;
export type SuggestionListStatus = (typeof SUGGESTION_LIST_STATUSES)[number];
export const SUGGESTION_LIST_MAX = 100;

/** The Mongo filter for a status choice: "open" is pending + under consideration. Pure. */
export function suggestionListFilter(guildId: string, status: string | null): Record<string, unknown> {
  const s = (SUGGESTION_LIST_STATUSES as readonly string[]).includes(status ?? "") ? status : "open";
  if (s === "all") return { guildId };
  if (s === "open") return { guildId, status: { $in: ["pending", "considered"] } };
  return { guildId, status: s };
}

export interface ListedSuggestion { id: string; authorId: string; content: string; status: string; upvotes: string[]; downvotes: string[]; channelId: string | null; messageId: string | null; createdAt: Date | string }

/** One list line: title (first line), status, votes, author, age and a jump link. Pure. */
export function suggestionListLine(s: ListedSuggestion, guildId: string): string {
  const first = s.content.split("\n").find(l => l.trim())?.replace(/\*\*/g, "").trim() ?? "(empty)";
  const title = first.length > 80 ? `${first.slice(0, 79)}…` : first;
  const ts = Math.floor(new Date(s.createdAt).getTime() / 1000);
  const jump = s.channelId && s.messageId ? ` · [Jump](${messageLink(guildId, s.channelId, s.messageId)})` : "";
  return `**${title}**\n${STATUS_LABELS[s.status] ?? s.status} · 👍 ${s.upvotes.length} 👎 ${s.downvotes.length} · <@${s.authorId}> · <t:${ts}:R>${jump} · \`${s.id}\``;
}

export async function findSuggestions(guildId: string, status: string | null): Promise<ListedSuggestion[]> {
  const docs = await SuggestionModel.find(suggestionListFilter(guildId, status))
    .sort({ createdAt: -1 }).limit(SUGGESTION_LIST_MAX)
    .select("id authorId content status upvotes downvotes channelId messageId createdAt").lean();
  return docs.map(d => ({
    id: String(d.id), authorId: String(d.authorId), content: String(d.content), status: String(d.status),
    upvotes: d.upvotes ?? [], downvotes: d.downvotes ?? [], channelId: d.channelId ?? null, messageId: d.messageId ?? null, createdAt: d.createdAt,
  }));
}
