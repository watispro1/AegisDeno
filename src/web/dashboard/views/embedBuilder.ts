/**
 * The embed/message builder: form fields for one embed plus a live preview
 * styled like Discord. Shared by welcome, goodbye and announcements. The
 * preview is rendered on the server too (so it is right without JavaScript);
 * /assets/dashboard.js keeps it current as you type, using data attributes
 * only, never inline script or style.
 */
import { escapeHtml as esc } from "../../pages";
import { EMBED_BUILDER_FIELDS, EMBED_LIMITS, TEMPLATE_VARIABLES, renderTemplate, type EmbedSpec, type TemplateValues } from "../../../services/embedSpec";
import type { Form, Values } from "./form";

/** Form values for a stored embed under prefix `p`. */
export function embedValues(spec: EmbedSpec | null | undefined, p: string): Values {
  const v: Values = {
    [`${p}title`]: spec?.title ?? "",
    [`${p}description`]: spec?.description ?? "",
    [`${p}color`]: spec?.color !== null && spec?.color !== undefined ? `#${spec.color.toString(16).padStart(6, "0")}` : "",
    [`${p}author`]: spec?.authorName ?? "",
    [`${p}footer`]: spec?.footerText ?? "",
    [`${p}image`]: spec?.imageUrl ?? "",
    [`${p}thumbnail`]: spec?.thumbnailUrl ?? "",
  };
  for (let i = 0; i < EMBED_BUILDER_FIELDS; i++) {
    const f = spec?.fields[i];
    v[`${p}fname_${i}`] = f?.name ?? "";
    v[`${p}fvalue_${i}`] = f?.value ?? "";
    v[`${p}finline_${i}`] = f?.inline ?? false;
  }
  return v;
}

/** The variables table, shown next to every template box. */
export function variableReference(): string {
  return `<details class="var-ref"><summary>Variables you can use</summary>
    <table class="var-table"><thead><tr><th scope="col">Variable</th><th scope="col">Becomes</th></tr></thead><tbody>
    ${TEMPLATE_VARIABLES.map(([k, d]) => `<tr><td><code class="inline">${esc(k)}</code></td><td>${esc(d)}</td></tr>`).join("")}
    </tbody></table></details>`;
}

function previewText(text: string, sample: TemplateValues): string {
  return esc(renderTemplate(text, sample));
}

/** Server-side first render of the preview card (the script re-renders it on input). */
function previewCard(f: Form, p: string, sample: TemplateValues, contentKey?: string): string {
  const s = (k: string) => f.str(`${p}${k}`);
  const color = /^#?[0-9a-f]{6}$/i.test(s("color")) ? s("color").replace(/^#?/, "") : "";
  const fields = Array.from({ length: EMBED_BUILDER_FIELDS }, (_, i) => i)
    .filter(i => s(`fname_${i}`) && s(`fvalue_${i}`))
    .map(i => `<div class="ep-field${f.on(`${p}finline_${i}`) ? " inline" : ""}"><div class="ep-fname">${previewText(s(`fname_${i}`), sample)}</div><div class="ep-fvalue">${previewText(s(`fvalue_${i}`), sample)}</div></div>`)
    .join("");
  const img = (key: string, cls: string) => (s(key) ? `<div class="${cls}" data-ep="${key}">Image: ${esc(hostOf(s(key)))}</div>` : `<div class="${cls}" data-ep="${key}" hidden></div>`);
  return `<div class="ep-message">
    <div class="ep-avatar" aria-hidden="true">A</div>
    <div class="ep-body">
      <div class="ep-name">Aegis <span class="ep-bot">APP</span></div>
      <div class="ep-content" data-ep="content"${contentKey ? ` data-ep-source="${esc(contentKey)}"` : ""}>${contentKey ? previewText(f.str(contentKey), sample) : ""}</div>
      <div class="ep-embed" data-ep="embed" data-color="${esc(color)}">
        <div class="ep-main">
          <div class="ep-author" data-ep="author">${previewText(s("author"), sample)}</div>
          <div class="ep-title" data-ep="title">${previewText(s("title"), sample)}</div>
          <div class="ep-desc" data-ep="description">${previewText(s("description"), sample)}</div>
          <div class="ep-fields" data-ep="fields">${fields}</div>
          ${img("image", "ep-image")}
          <div class="ep-footer" data-ep="footer">${previewText(s("footer"), sample)}</div>
        </div>
        ${img("thumbnail", "ep-thumb")}
      </div>
    </div>
  </div>`;
}

function hostOf(url: string): string {
  try { return new URL(url).hostname; } catch { return "invalid link"; }
}

/**
 * The builder. `p` prefixes every field (e_, we_, ge_). `contentKey` names the
 * plain-text box that is sent with the embed, so the preview shows both.
 */
export function embedBuilder(f: Form, p: string, o: { legend: string; sample: TemplateValues; contentKey?: string; help?: string }): string {
  const rows = Array.from({ length: EMBED_BUILDER_FIELDS }, (_, i) => `
    <div class="embed-field-row" data-embed-field-row${i > 1 && !f.str(`${p}fname_${i}`) && !f.str(`${p}fvalue_${i}`) ? " data-optional" : ""}>
      ${f.text(`${p}fname_${i}`, `Field ${i + 1} name`, EMBED_LIMITS.fieldName)}
      ${f.textarea(`${p}fvalue_${i}`, `Field ${i + 1} value`, EMBED_LIMITS.fieldValue, undefined, ' rows="2"')}
      ${f.checkbox(`${p}finline_${i}`, "Inline")}
    </div>`).join("");
  return `<div class="embed-builder" data-embed-builder="${esc(p)}"
      data-sample-user="${esc(o.sample.user)}" data-sample-username="${esc(o.sample.username)}"
      data-sample-server="${esc(o.sample.server)}" data-sample-count="${esc(String(o.sample.memberCount))}">
    <fieldset class="embed-inputs"><legend>${esc(o.legend)}</legend>
      ${o.help ? `<p class="field-help">${o.help}</p>` : ""}
      <div class="field-row two">
        ${f.text(`${p}author`, "Author", EMBED_LIMITS.author)}
        ${f.text(`${p}color`, "Colour (hex)", 7, "Such as #5865F2. Blank uses Discord's default.", ' spellcheck="false" autocapitalize="off" placeholder="#5865F2"')}
      </div>
      ${f.text(`${p}title`, "Title", EMBED_LIMITS.title, undefined, ` data-count-max="${EMBED_LIMITS.title}"`)}
      ${f.textarea(`${p}description`, "Description", EMBED_LIMITS.description, `Up to ${EMBED_LIMITS.description.toLocaleString("en-US")} characters. Markdown works.`, ` rows="5" data-count-max="${EMBED_LIMITS.description}"`)}
      <div class="field-row two">
        ${f.text(`${p}image`, "Image URL", EMBED_LIMITS.url, "https:// links only.", ' inputmode="url" spellcheck="false" autocapitalize="off"')}
        ${f.text(`${p}thumbnail`, "Thumbnail URL", EMBED_LIMITS.url, "https:// links only.", ' inputmode="url" spellcheck="false" autocapitalize="off"')}
      </div>
      ${f.text(`${p}footer`, "Footer", EMBED_LIMITS.footer)}
      <details class="embed-fields"${rows && Array.from({ length: EMBED_BUILDER_FIELDS }, (_, i) => f.str(`${p}fname_${i}`)).some(Boolean) ? " open" : ""}>
        <summary>Fields (up to ${EMBED_BUILDER_FIELDS})</summary>
        ${rows}
      </details>
      ${variableReference()}
      <p class="field-help">Total across the embed: <span data-embed-total>0</span> of ${EMBED_LIMITS.total.toLocaleString("en-US")} characters.</p>
    </fieldset>
    <div class="embed-preview-wrap">
      <p class="field-help" id="${esc(p)}preview-label">Preview</p>
      <div class="embed-preview" data-embed-preview aria-live="polite" aria-labelledby="${esc(p)}preview-label">${previewCard(f, p, o.sample, o.contentKey)}</div>
      <p class="field-help">Images are not loaded in the preview; their link is shown instead.</p>
    </div>
  </div>`;
}
