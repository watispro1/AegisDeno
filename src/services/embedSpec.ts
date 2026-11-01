/**
 * A stored embed (welcome, goodbye and dashboard announcements), its Discord
 * limits, and how it is turned into a discord.js embed. Pure apart from the
 * EmbedBuilder import, so the dashboard and the bot share one set of rules.
 */
import { EmbedBuilder } from "discord.js";

/** Discord's documented embed limits (https://docs.discord.com/developers/resources/message#embed-object-embed-limits). */
export const EMBED_LIMITS = {
  title: 256,
  description: 4096,
  fields: 25,
  fieldName: 256,
  fieldValue: 1024,
  footer: 2048,
  author: 256,
  total: 6000,
  content: 2000,
  url: 2048,
} as const;

/** Most field rows the dashboard builder shows (Discord allows 25). */
export const EMBED_BUILDER_FIELDS = 10;

export interface EmbedFieldSpec {
  name: string;
  value: string;
  inline: boolean;
}

export interface EmbedSpec {
  title: string | null;
  description: string | null;
  /** 0xRRGGBB, or null for Discord's default. */
  color: number | null;
  authorName: string | null;
  footerText: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  fields: EmbedFieldSpec[];
}

/** Template variables the welcome/goodbye/announcement texts understand. */
export const TEMPLATE_VARIABLES: ReadonlyArray<[string, string]> = [
  ["{user}", "Mentions the member (@name)"],
  ["{username}", "The member's username, no ping"],
  ["{server}", "The server's name"],
  ["{memberCount}", "Members in the server now"],
  ["{member_count}", "Same as {memberCount}"],
  ["{count}", "Same as {memberCount}"],
];

export interface TemplateValues {
  user: string;
  username: string;
  server: string;
  memberCount: number | string;
}

/** Replaces the variables in one pass, so a value containing "{server}" is never expanded again. */
export function renderTemplate(text: string, v: TemplateValues): string {
  return text.replace(/\{(user|username|server|memberCount|member_count|count)\}/g, (_m, key: string) => {
    if (key === "user") return v.user;
    if (key === "username") return v.username;
    if (key === "server") return v.server;
    return String(v.memberCount);
  });
}

/** An https URL Discord will accept for an embed image, or null. */
export function safeEmbedUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s || s.length > EMBED_LIMITS.url || /[\s<>"']/.test(s)) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" && u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s.slice(0, max) : null;
}

/** Characters counted toward Discord's 6000-character embed total. */
export function embedLength(spec: EmbedSpec): number {
  return (spec.title?.length ?? 0) + (spec.description?.length ?? 0) + (spec.authorName?.length ?? 0) +
    (spec.footerText?.length ?? 0) + spec.fields.reduce((n, f) => n + f.name.length + f.value.length, 0);
}

/** Whether a spec would render as an empty embed (Discord refuses those). */
export function embedIsEmpty(spec: EmbedSpec): boolean {
  return !spec.title && !spec.description && !spec.authorName && !spec.footerText && !spec.imageUrl && !spec.thumbnailUrl && spec.fields.length === 0;
}

/**
 * Reads a stored spec defensively (documents may be old or hand-edited):
 * clamps every length, drops non-https URLs, and returns null for anything
 * that is not an object or would be empty.
 */
export function normalizeEmbedSpec(value: unknown): EmbedSpec | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const color = typeof o.color === "number" && Number.isInteger(o.color) && o.color >= 0 && o.color <= 0xffffff ? o.color : null;
  const fields = Array.isArray(o.fields)
    ? o.fields.slice(0, EMBED_LIMITS.fields).flatMap((f) => {
        if (!f || typeof f !== "object") return [];
        const r = f as Record<string, unknown>;
        const name = text(r.name, EMBED_LIMITS.fieldName);
        const val = text(r.value, EMBED_LIMITS.fieldValue);
        return name && val ? [{ name, value: val, inline: r.inline === true }] : [];
      })
    : [];
  const spec: EmbedSpec = {
    title: text(o.title, EMBED_LIMITS.title),
    description: text(o.description, EMBED_LIMITS.description),
    color,
    authorName: text(o.authorName, EMBED_LIMITS.author),
    footerText: text(o.footerText, EMBED_LIMITS.footer),
    imageUrl: safeEmbedUrl(o.imageUrl),
    thumbnailUrl: safeEmbedUrl(o.thumbnailUrl),
    fields,
  };
  if (embedIsEmpty(spec) || embedLength(spec) > EMBED_LIMITS.total) return null;
  return spec;
}

/**
 * Fills template variables in every text part, clamps each part, then keeps
 * the aggregate under Discord's 6,000-character embed limit. A stored spec
 * passes that check before expansion, but placeholders such as {server} can
 * grow it past the limit afterwards, and Discord rejects the whole message.
 * Trimming order: trailing fields first, then the description, footer,
 * author and title, so the most important text survives.
 */
export function fillEmbedSpec(spec: EmbedSpec, values?: TemplateValues): EmbedSpec {
  const fill = (s: string | null, max: number) => (s ? (values ? renderTemplate(s, values) : s).slice(0, max) : null);
  const out: EmbedSpec = {
    ...spec,
    title: fill(spec.title, EMBED_LIMITS.title),
    description: fill(spec.description, EMBED_LIMITS.description),
    authorName: fill(spec.authorName, EMBED_LIMITS.author),
    footerText: fill(spec.footerText, EMBED_LIMITS.footer),
    fields: spec.fields.map(f => ({
      name: fill(f.name, EMBED_LIMITS.fieldName) ?? "",
      value: fill(f.value, EMBED_LIMITS.fieldValue) ?? "",
      inline: f.inline,
    })).filter(f => f.name && f.value),
  };
  let over = embedLength(out) - EMBED_LIMITS.total;
  while (over > 0 && out.fields.length) {
    const f = out.fields.pop()!;
    over -= f.name.length + f.value.length;
  }
  for (const key of ["description", "footerText", "authorName", "title"] as const) {
    if (over <= 0) break;
    const text = out[key];
    if (!text) continue;
    const keep = Math.max(0, text.length - over);
    over -= text.length - keep;
    out[key] = keep > 1 ? text.slice(0, keep - 1) + "…" : null;
  }
  return out;
}

/** Builds the discord.js embed, filling template variables in every text part. */
export function buildEmbedFromSpec(spec: EmbedSpec, values?: TemplateValues): EmbedBuilder {
  const filled = fillEmbedSpec(spec, values);
  const embed = new EmbedBuilder();
  if (filled.title) embed.setTitle(filled.title);
  if (filled.description) embed.setDescription(filled.description);
  if (filled.color !== null) embed.setColor(filled.color);
  if (filled.authorName) embed.setAuthor({ name: filled.authorName });
  if (filled.footerText) embed.setFooter({ text: filled.footerText });
  if (filled.imageUrl) embed.setImage(filled.imageUrl);
  if (filled.thumbnailUrl) embed.setThumbnail(filled.thumbnailUrl);
  if (filled.fields.length) embed.addFields(filled.fields);
  return embed;
}
