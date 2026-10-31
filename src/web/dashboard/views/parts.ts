import { escapeHtml as esc } from "../../pages";

/* ── Shared bits for the newer pages ───────────────────────────────── */

export function errorSummary(errors: Record<string, string>, prefix = "f-"): string {
  // prefix matches the Form's id prefix: "f-" + its own prefix.
  const keys = Object.keys(errors);
  if (!keys.length) return "";
  return `<div class="error-summary" role="alert" tabindex="-1" data-error-summary>
      <h2>Nothing was changed. Fix ${keys.length === 1 ? "this" : "these"} first:</h2>
      <ul>${keys.map(k => `<li><a href="#${prefix}${esc(k)}">${esc(errors[k])}</a></li>`).join("")}</ul>
    </div>`;
}

export function permissionNote(missing: string | null): string {
  return missing
    ? `<p class="callout warn">You need <strong>${esc(missing)}</strong> in this server for this, the same as the slash command. You can look, but the buttons will be refused.</p>`
    : "";
}

export function pagerNav(base: string, query: (page: number) => string, page: number, pages: number, total: number, noun: string): string {
  if (pages <= 1) return `<p class="muted">${total.toLocaleString("en-US")} ${noun}${total === 1 ? "" : "s"}.</p>`;
  return `<nav class="pager" aria-label="Pages">
      <span>Page ${page} of ${pages}, ${total.toLocaleString("en-US")} ${noun}s</span>
      <span class="btn-row">
        ${page > 1 ? `<a class="btn ghost sm" href="${base}${esc(query(page - 1))}" rel="prev">Newer</a>` : ""}
        ${page < pages ? `<a class="btn ghost sm" href="${base}${esc(query(page + 1))}" rel="next">Older</a>` : ""}
      </span>
    </nav>`;
}
