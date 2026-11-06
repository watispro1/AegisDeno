/**
 * Applying the media-safety guard to each kind of repost: starboard posts,
 * ModMail relay links, ticket transcript links, and cleaning up a repost
 * after Discord flags the media late. Pure; see mediaSafety.ts for the flags.
 */
import type { MediaAttachment, MediaEmbed } from "./communityLogic";
import {
  hiddenMediaLine, mediaUrlKey, reasonsText, spoilerMediaLine,
  type MediaFlagReason, type MediaSafetyMode,
} from "./mediaSafety";

export type FlaggedAttachment = MediaAttachment & { reasons?: readonly MediaFlagReason[] };
export type FlaggedEmbed = MediaEmbed & { reasons?: readonly MediaFlagReason[] };

/** Field title for the hidden-media lines on a repost. */
export const HIDDEN_MEDIA_FIELD = "⚠️ Hidden media";

export interface GuardedStarboardMedia {
  attachments: MediaAttachment[];
  embeds: MediaEmbed[];
  /** One line per flagged item: a placeholder, or a spoilered link in spoiler mode. */
  notes: string[];
}

/**
 * Take flagged media out of a starboard post's inputs. With no mode (guard
 * off or an age-restricted starboard) everything passes through unchanged.
 * A flagged embed keeps its text but loses its image and thumbnail.
 */
export function guardStarboardMedia(
  attachments: readonly FlaggedAttachment[],
  embeds: readonly FlaggedEmbed[],
  mode: MediaSafetyMode | null,
): GuardedStarboardMedia {
  const strip = <T extends { reasons?: unknown }>(x: T): Omit<T, "reasons"> => {
    const { reasons: _r, ...rest } = x;
    return rest;
  };
  if (!mode) return { attachments: attachments.map(strip), embeds: embeds.map(strip), notes: [] };
  const notes: string[] = [];
  const keptAttachments: MediaAttachment[] = [];
  for (const a of attachments) {
    if (!a.reasons?.length) { keptAttachments.push(strip(a)); continue; }
    const name = a.name ?? "file";
    notes.push(mode === "spoiler" ? spoilerMediaLine(a.reasons, name, a.url) : hiddenMediaLine(a.reasons, name));
  }
  const keptEmbeds = embeds.map(e => {
    const plain = strip(e);
    if (!e.reasons?.length) return plain;
    const url = e.imageUrl ?? e.thumbnailUrl ?? null;
    if (url) notes.push(mode === "spoiler" ? spoilerMediaLine(e.reasons, "embedded image", url) : hiddenMediaLine(e.reasons));
    return { ...plain, imageUrl: null, thumbnailUrl: null };
  });
  return { attachments: keptAttachments, embeds: keptEmbeds, notes };
}

/** Lines for the hidden-media field, kept under Discord's 1024-character field limit. */
export function hiddenMediaFieldValue(notes: readonly string[]): string {
  const out: string[] = [];
  let used = 0;
  for (const n of notes) {
    if (used + n.length + 1 > 1000) { out.push(`…and ${notes.length - out.length} more`); break; }
    out.push(n);
    used += n.length + 1;
  }
  return out.join("\n");
}

/** A ModMail relay attachment, possibly flagged. */
export interface GuardableRelayAttachment { name: string; url: string; size: number; reasons?: readonly MediaFlagReason[] }

/**
 * The relay line for a flagged attachment, or null to relay it as usual.
 * Placeholder mode drops the link; spoiler mode keeps it behind a spoiler.
 */
export function guardedRelayLine(a: GuardableRelayAttachment, mode: MediaSafetyMode | null): string | null {
  if (!mode || !a.reasons?.length) return null;
  return `📎 ${mode === "spoiler" ? spoilerMediaLine(a.reasons, a.name, a.url) : hiddenMediaLine(a.reasons, a.name)}`;
}

/** A ticket transcript attachment with the guard applied: placeholder mode has no link. */
export function guardTranscriptAttachment(
  a: { name: string; url: string; reasons?: readonly MediaFlagReason[] },
  mode: MediaSafetyMode | null,
): { name: string; url: string } {
  if (!mode || !a.reasons?.length) return { name: a.name, url: a.url };
  if (mode === "spoiler") return { name: `${a.name} (flagged by Discord as ${reasonsText(a.reasons)})`, url: a.url };
  return { name: hiddenMediaLine(a.reasons, a.name), url: "" };
}

/** The parts of a posted embed a flagged URL could appear in. */
export interface RepostEmbedView {
  description?: string | null;
  image?: { url?: string | null } | null;
  thumbnail?: { url?: string | null } | null;
  fields?: ReadonlyArray<{ name: string; value: string }> | null;
}

/**
 * Whether a repost still shows any of the given media, as an image or as a
 * plain link in a field (not the hidden-media field). Used to skip edits a late flag
 * does not need, so repeated updates of the source do not re-edit the post.
 */
export function repostShowsMedia(embeds: readonly RepostEmbedView[], urls: readonly string[]): boolean {
  const keys = urls.map(mediaUrlKey).filter(Boolean);
  if (!keys.length) return false;
  const hit = (u: string | null | undefined) => !!u && keys.includes(mediaUrlKey(u));
  for (const e of embeds) {
    if (hit(e.image?.url) || hit(e.thumbnail?.url)) return true;
    // The description is the message text, where a link never renders as media.
    const texts = (e.fields ?? []).filter(f => f.name !== HIDDEN_MEDIA_FIELD).map(f => f.value);
    if (texts.some(t => keys.some(k => t.includes(k)))) return true;
  }
  return false;
}

/** A posted embed with its image and thumbnail removed and a placeholder field added. */
export function stripEmbedMedia<T extends RepostEmbedView>(embed: T, reasons: readonly MediaFlagReason[]): T {
  const { image: _i, thumbnail: _t, ...rest } = embed;
  const fields = [...(embed.fields ?? [])];
  if (!fields.some(f => f.name === HIDDEN_MEDIA_FIELD) && fields.length < 25) {
    fields.push({ name: HIDDEN_MEDIA_FIELD, value: hiddenMediaLine(reasons) });
  }
  return { ...rest, fields } as unknown as T;
}
