import { head, shell } from "./layout";
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

/** A module page inside the sidebar shell, with the usual breadcrumb. */
export function modulePage(
  cfg: import("../../pages").SiteConfig,
  ctx: import("./layout").GuildContext,
  o: { active: import("./layout").GuildSection; title: string; lead: string; path: string; body: string },
): string {
  const g = ctx.guild;
  return shell(cfg, {
    title: `${o.title}, ${g.name}`,
    path: o.path,
    viewer: ctx.viewer,
    guild: ctx,
    active: o.active,
    body: `${head(o.title, o.lead, [["Servers", "/dashboard"], [g.name, `/dashboard/${g.id}`], [o.title, null]])}${o.body}`,
  });
}

/** A search box that filters the rows of table #id as you type (dashboard.js); harmless without JavaScript. */
export function tableFilter(id: string, label: string): string {
  return `<div class="table-tools"><label class="visually-hidden" for="filter-${esc(id)}">${esc(label)}</label>
    <input class="table-search" type="search" id="filter-${esc(id)}" placeholder="${esc(label)}" data-filter-target="${esc(id)}" autocomplete="off">
    <span class="faint" data-filter-count="${esc(id)}" aria-live="polite"></span></div>`;
}

/** A one-button POST form (toggle, delete, end…), optionally confirmed in a dialog. */
export function actionButton(action: string, csrf: string, label: string, o: { confirm?: string; danger?: boolean; fields?: Record<string, string>; ghost?: boolean } = {}): string {
  const hidden = Object.entries(o.fields ?? {}).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join("");
  return `<form class="inline-form" method="post" action="${esc(action)}"${o.confirm ? ` data-confirm="${esc(o.confirm)}"` : ""}>
    <input type="hidden" name="_csrf" value="${esc(csrf)}">${hidden}
    <button class="btn sm${o.danger ? " danger" : o.ghost === false ? "" : " ghost"}" type="submit">${esc(label)}</button>
  </form>`;
}
