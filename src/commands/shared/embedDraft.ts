/**
 * The /embed builder's draft: what the user has typed so far, the embed it
 * makes, the modals that edit it, and the checks that run before anything is
 * posted. Kept out of the command file so each stays small; the checks are pure.
 */
import { ActionRowBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, type ModalSubmitInteraction } from "discord.js";
import { checkLink, embedTextProblem, expandNewlines, parseHexColor } from "./inputChecks";

export const EMBED_PLACEHOLDER = "*Click **Edit Description** to write or edit the embed body...*";

export interface EmbedDraft {
  title: string;
  description: string;
  color: number;
  url: string | null;
  footer: string | null;
  image: string | null;
  thumbnail: string | null;
  author: string | null;
}

/** Raw option values → a draft, or the first problem with them. Pure. */
export function draftFromInput(raw: { title: string; description?: string | null; color?: string | null; url?: string | null; footer?: string | null; image?: string | null; thumbnail?: string | null; author?: string | null }): { ok: true; draft: EmbedDraft } | { ok: false; error: string } {
  const color = parseHexColor(raw.color);
  if (!color.ok) return color;
  const url = checkLink(raw.url, "title link");
  if (!url.ok) return url;
  const image = checkLink(raw.image, "image link");
  if (!image.ok) return image;
  const thumbnail = checkLink(raw.thumbnail, "thumbnail link");
  if (!thumbnail.ok) return thumbnail;
  const title = raw.title.trim();
  if (!title) return { ok: false, error: "The title can't be empty." };
  const draft: EmbedDraft = {
    title,
    description: raw.description?.trim() ? expandNewlines(raw.description) : EMBED_PLACEHOLDER,
    color: color.value,
    url: url.value,
    footer: raw.footer?.trim() || null,
    image: image.value,
    thumbnail: thumbnail.value,
    author: raw.author?.trim() || null,
  };
  const problem = embedTextProblem(draft);
  return problem ? { ok: false, error: problem } : { ok: true, draft };
}

/** Why a draft can't be posted yet (still the placeholder, or too long), or null. Pure. */
export function draftPostProblem(d: EmbedDraft): string | null {
  if (d.description === EMBED_PLACEHOLDER) return "Write the description first with **Edit Description**.";
  return embedTextProblem(d);
}

export function buildDraftEmbed(d: EmbedDraft): EmbedBuilder {
  const e = new EmbedBuilder().setTitle(d.title).setDescription(d.description).setColor(d.color).setTimestamp();
  if (d.url) e.setURL(d.url);
  if (d.footer) e.setFooter({ text: d.footer });
  if (d.image) e.setImage(d.image);
  if (d.thumbnail) e.setThumbnail(d.thumbnail);
  if (d.author) e.setAuthor({ name: d.author });
  return e;
}

const input = (id: string, label: string, style: TextInputStyle, value: string, max: number, required = false) => new ActionRowBuilder<TextInputBuilder>().addComponents(
  new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setValue(value.slice(0, max)).setMaxLength(max).setRequired(required),
);

export type DraftModalKind = "desc" | "meta" | "media";

/** The modal behind each edit button, filled with the draft's current values. */
export function draftModal(kind: DraftModalKind, customId: string, d: EmbedDraft): ModalBuilder {
  const modal = new ModalBuilder().setCustomId(customId);
  if (kind === "desc") {
    return modal.setTitle("Edit Embed Description").addComponents(
      input("embed_desc_input", "Description (supports \\n for newlines)", TextInputStyle.Paragraph, d.description === EMBED_PLACEHOLDER ? "" : d.description, 4000, true),
    );
  }
  if (kind === "meta") {
    return modal.setTitle("Edit Title, Link & Colour").addComponents(
      input("embed_title_input", "Embed Title", TextInputStyle.Short, d.title, 256, true),
      input("embed_url_input", "Title Clickable Link URL (optional)", TextInputStyle.Short, d.url ?? "", 2000),
      input("embed_color_input", "Colour (hex like #5865F2, optional)", TextInputStyle.Short, `#${d.color.toString(16).padStart(6, "0").toUpperCase()}`, 16),
    );
  }
  return modal.setTitle("Edit Images & Author").addComponents(
    input("embed_author_input", "Author Name (above title)", TextInputStyle.Short, d.author ?? "", 256),
    input("embed_image_input", "Large Image URL (bottom)", TextInputStyle.Short, d.image ?? "", 2000),
    input("embed_thumb_input", "Small Thumbnail URL (top right)", TextInputStyle.Short, d.thumbnail ?? "", 2000),
    input("embed_footer_input", "Footer Text", TextInputStyle.Short, d.footer ?? "", 2048),
  );
}

/** Apply a submitted modal to the draft: the new draft, or why it was refused (the old one stays). */
export function applyDraftModal(kind: DraftModalKind, submit: Pick<ModalSubmitInteraction, "fields">, d: EmbedDraft): { ok: true; draft: EmbedDraft } | { ok: false; error: string } {
  const get = (id: string) => {
    try { return submit.fields.getTextInputValue(id); } catch { return ""; }
  };
  if (kind === "desc") {
    const description = expandNewlines(get("embed_desc_input"));
    if (!description.trim()) return { ok: false, error: "The description can't be empty." };
    const next = { ...d, description };
    const problem = embedTextProblem(next);
    return problem ? { ok: false, error: problem } : { ok: true, draft: next };
  }
  const hex = `#${d.color.toString(16).padStart(6, "0")}`;
  const description = d.description === EMBED_PLACEHOLDER ? null : d.description;
  if (kind === "meta") {
    // A cleared colour box keeps the current colour.
    return fix(draftFromInput({ ...d, description, title: get("embed_title_input"), url: get("embed_url_input"), color: get("embed_color_input").trim() || hex }), d);
  }
  return fix(draftFromInput({
    ...d,
    description,
    color: hex,
    author: get("embed_author_input"), image: get("embed_image_input"), thumbnail: get("embed_thumb_input"), footer: get("embed_footer_input"),
  }), d);
}

/** draftFromInput turns a cleared description back into the placeholder; keep that the same as before. */
function fix(r: ReturnType<typeof draftFromInput>, before: EmbedDraft): ReturnType<typeof draftFromInput> {
  if (!r.ok) return r;
  return { ok: true, draft: { ...r.draft, description: before.description === EMBED_PLACEHOLDER ? EMBED_PLACEHOLDER : r.draft.description } };
}
