/**
 * Read a message reference typed into an option: a bare message ID, or a
 * message link ("Copy Message Link"), which is what moderators usually have
 * on the clipboard. Pure; unit-tested.
 */

const ID = /^\d{17,20}$/;
const LINK = /^<?https?:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/channels\/(?:\d{17,20}|@me)\/(\d{17,20})\/(\d{17,20})\/?>?$/i;

export type MessageRef =
  | { ok: true; id: string | undefined; channelId?: string }
  | { ok: false; error: string };

/**
 * `{ ok: true, id: undefined }` for an empty value; the ID (and the link's
 * channel) for a valid one; an error naming the option otherwise.
 */
export function parseMessageRef(raw: string | null | undefined, optionName: string): MessageRef {
  const text = String(raw ?? "").trim();
  if (!text) return { ok: true, id: undefined };
  if (ID.test(text)) return { ok: true, id: text };
  const link = LINK.exec(text);
  if (link) return { ok: true, id: link[2], channelId: link[1] };
  return {
    ok: false,
    error: `❌ \`${optionName}\` must be a message ID (17–20 digits) or a message link. Right-click a message → Copy Message Link (or Copy Message ID with Developer Mode on).`,
  };
}

/** Error text when a message link points at a different channel than the one being purged, else null. */
export function wrongChannelError(ref: MessageRef, optionName: string, channelId: string): string | null {
  if (!ref.ok || !ref.channelId || ref.channelId === channelId) return null;
  return `❌ The \`${optionName}\` link points to <#${ref.channelId}>, but you are purging <#${channelId}>. Run the command in that channel, or use a message from this one.`;
}
