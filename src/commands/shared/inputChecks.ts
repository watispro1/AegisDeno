/**
 * Input checks shared by the general and community commands (/embed,
 * /announce, /poll, /starboard, /giveaway). Every check is pure and returns
 * either the cleaned value or a friendly sentence for an ephemeral error, so
 * a bad colour or link never reaches Discord as a generic "something failed".
 */

/** Discord's embed limits (title 256, description 4096, footer 2048, author 256, total 6000). */
export const EMBED_TEXT_LIMITS = { title: 256, description: 4096, footer: 2048, author: 256, total: 6000, url: 2048 } as const;

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

/** Named colours offered by colour autocomplete, in the order they are offered. */
export const COLOR_PRESETS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: "Blurple", hex: "#5865F2" },
  { name: "Aegis Blue", hex: "#3498DB" },
  { name: "Green", hex: "#57F287" },
  { name: "Yellow", hex: "#FEE75C" },
  { name: "Orange", hex: "#E67E22" },
  { name: "Red", hex: "#ED4245" },
  { name: "Fuchsia", hex: "#EB459E" },
  { name: "Gold", hex: "#FFD700" },
  { name: "Gray", hex: "#99AAB5" },
  { name: "Black", hex: "#23272A" },
  { name: "White", hex: "#FFFFFF" },
];

/**
 * A colour from "#5865F2", "5865F2", "0x5865F2", "#fff" or a preset name.
 * Empty input gives `fallback`. Pure.
 */
export function parseHexColor(input: string | null | undefined, fallback = 0x5865f2): Checked<number> {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: true, value: fallback };
  const preset = COLOR_PRESETS.find(p => p.name.toLowerCase() === raw.toLowerCase());
  if (preset) return { ok: true, value: parseInt(preset.hex.slice(1), 16) };
  const hex = raw.replace(/^(#|0x)/i, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) return { ok: true, value: parseInt(hex.split("").map(c => c + c).join(""), 16) };
  if (/^[0-9a-f]{6}$/i.test(hex)) return { ok: true, value: parseInt(hex, 16) };
  return { ok: false, error: `\`${raw.slice(0, 40)}\` isn't a colour. Use a hex code like \`#5865F2\` or \`#fff\`, or pick one from the list.` };
}

/** Colour autocomplete: presets matching what was typed, plus the typed hex when it is valid. Pure. */
export function colorChoices(typed: string): Array<{ name: string; value: string }> {
  const q = typed.trim().toLowerCase();
  const out: Array<{ name: string; value: string }> = [];
  const own = parseHexColor(typed, -1);
  if (q && own.ok && own.value >= 0 && !COLOR_PRESETS.some(p => p.name.toLowerCase() === q)) {
    const hex = `#${own.value.toString(16).padStart(6, "0").toUpperCase()}`;
    out.push({ name: `${hex} (your colour)`, value: hex });
  }
  for (const p of COLOR_PRESETS) {
    if (!q || p.name.toLowerCase().includes(q) || p.hex.toLowerCase().includes(q.replace(/^#?/, "#"))) out.push({ name: `${p.name} · ${p.hex}`, value: p.hex });
  }
  return out.slice(0, 25);
}

/**
 * An http(s) link for an embed (image, thumbnail, title link). Empty input
 * is "no link". Pure.
 */
export function checkLink(input: string | null | undefined, label: string): Checked<string | null> {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: true, value: null };
  const bad = { ok: false as const, error: `The ${label} has to be a full web link starting with \`https://\` (or \`http://\`).` };
  if (raw.length > EMBED_TEXT_LIMITS.url || /\s/.test(raw)) return bad;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return bad;
    if (!url.hostname.includes(".")) return bad;
    return { ok: true, value: url.toString() };
  } catch {
    return bad;
  }
}

/** Total characters Discord counts against the 6000 limit for one embed. Pure. */
export function embedTextLength(parts: { title?: string | null; description?: string | null; footer?: string | null; author?: string | null }): number {
  return (parts.title ?? "").length + (parts.description ?? "").length + (parts.footer ?? "").length + (parts.author ?? "").length;
}

/** Why an embed's text can't be posted, or null. Pure. */
export function embedTextProblem(parts: { title?: string | null; description?: string | null; footer?: string | null; author?: string | null }): string | null {
  if ((parts.title ?? "").length > EMBED_TEXT_LIMITS.title) return `Keep the title under ${EMBED_TEXT_LIMITS.title} characters.`;
  if ((parts.description ?? "").length > EMBED_TEXT_LIMITS.description) return `Keep the description under ${EMBED_TEXT_LIMITS.description} characters.`;
  if ((parts.footer ?? "").length > EMBED_TEXT_LIMITS.footer) return `Keep the footer under ${EMBED_TEXT_LIMITS.footer} characters.`;
  if ((parts.author ?? "").length > EMBED_TEXT_LIMITS.author) return `Keep the author name under ${EMBED_TEXT_LIMITS.author} characters.`;
  const total = embedTextLength(parts);
  if (total > EMBED_TEXT_LIMITS.total) return `That embed has ${total} characters; Discord allows ${EMBED_TEXT_LIMITS.total} in total. Shorten the description.`;
  return null;
}

/** "\n" typed in a slash option becomes a real line break. Pure. */
export function expandNewlines(text: string): string {
  return text.replace(/\\n/g, "\n");
}

/** A message link Discord opens in the app. Pure. */
export function messageLink(guildId: string, channelId: string, messageId: string): string {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

/** A channel link Discord opens in the app. Pure. */
export function channelLink(guildId: string, channelId: string): string {
  return `https://discord.com/channels/${guildId}/${channelId}`;
}

const CUSTOM_EMOJI = /^<(a?):([A-Za-z0-9_]{2,32}):(\d{17,20})>$/;
const PICTOGRAPH = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u0023\u002A\u0030-\u0039]\uFE0F?\u20E3/u;

/**
 * A reaction emoji: one Unicode emoji (⭐, ❤️, 👍🏽, 🇺🇸) or a custom one
 * written `<:name:id>` / `<a:name:id>`. Pure.
 */
export function checkReactionEmoji(input: string): Checked<string> {
  const raw = input.trim();
  const bad = { ok: false as const, error: "That isn't an emoji. Use one emoji such as ⭐ or 🌟, or pick a server emoji from the list." };
  if (!raw || raw.length > 64) return bad;
  if (CUSTOM_EMOJI.test(raw)) return { ok: true, value: raw };
  if (/[A-Za-z0-9<>:@#\s]/.test(raw.replace(/[\u0023\u002A\u0030-\u0039]\uFE0F?\u20E3/gu, ""))) return bad;
  if (!PICTOGRAPH.test(raw)) return bad;
  // One emoji, allowing modifiers and ZWJ sequences: at most one grapheme.
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(raw)];
  if (graphemes.length !== 1) return { ok: false, error: "Use just one emoji (for example ⭐)." };
  return { ok: true, value: raw };
}
