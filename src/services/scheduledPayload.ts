/**
 * Scheduled messages store one string payload. A plain payload is posted as
 * the description of the "Scheduled Message" embed (how /automation message
 * has always worked). A payload made with the dashboard's embed builder is
 * this prefix plus JSON: the message text and a full embed spec, re-validated
 * with normalizeEmbedSpec every time it is read.
 */
import { normalizeEmbedSpec, type EmbedSpec } from "./embedSpec";

export const EMBED_PAYLOAD_PREFIX = "aegis:embed:v1:";

export function encodeScheduledPayload(text: string, embed: EmbedSpec | null): string {
  if (!embed) return text;
  return EMBED_PAYLOAD_PREFIX + JSON.stringify({ text, embed });
}

export function decodeScheduledPayload(payload: string): { text: string; embed: EmbedSpec | null } {
  if (typeof payload !== "string" || !payload.startsWith(EMBED_PAYLOAD_PREFIX)) return { text: String(payload ?? ""), embed: null };
  try {
    const o = JSON.parse(payload.slice(EMBED_PAYLOAD_PREFIX.length)) as { text?: unknown; embed?: unknown };
    return { text: typeof o.text === "string" ? o.text.slice(0, 2000) : "", embed: normalizeEmbedSpec(o.embed) };
  } catch {
    return { text: "", embed: null };
  }
}

/** One line for lists: the text, or the embed's title. */
export function scheduledPayloadPreview(payload: string): string {
  const { text, embed } = decodeScheduledPayload(payload);
  if (text) return embed ? `${text} (+ embed)` : text;
  if (embed) return `Embed: ${embed.title ?? embed.description ?? "untitled"}`;
  return "";
}
