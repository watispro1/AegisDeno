/** The Trust page's member list: one page of Discord's member list at a time, scored. */
import { escapeHtml as esc } from "../../pages";
import { TRUST_PAGE_SIZES, type TrustMemberPage, type TrustMemberQuery } from "../extras";
import { type GuildContext, copyId, emptyState } from "./layout";

const SNOWFLAKE = /^\d{17,20}$/;
export const TRUST_PAGE_DEFAULT = 50;

/** Query string → member list query. Anything malformed falls back to the first page. */
export function parseTrustMemberQuery(query: Record<string, unknown>): TrustMemberQuery {
  const pick = (key: string) => {
    const raw = query?.[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === "string" ? value.trim() : "";
  };
  const after = pick("after");
  const per = Number(pick("per"));
  return {
    after: SNOWFLAKE.test(after) ? after : null,
    per: (TRUST_PAGE_SIZES as readonly number[]).includes(per) ? per : TRUST_PAGE_DEFAULT,
    lowOnly: pick("low") === "1",
  };
}

function href(base: string, q: Partial<TrustMemberQuery>): string {
  const params = new URLSearchParams();
  if (q.lowOnly) params.set("low", "1");
  if (q.per && q.per !== TRUST_PAGE_DEFAULT) params.set("per", String(q.per));
  if (q.after) params.set("after", q.after);
  const s = params.toString();
  return `${base}${s ? `?${s}` : ""}#trust-members-h`;
}

export function trustMemberList(ctx: GuildContext, base: string, q: TrustMemberQuery, page: TrustMemberPage | null): string {
  const g = esc(ctx.guild.id);
  const tabs = `<nav class="tabs" aria-label="Which members">
    <a href="${esc(href(base, { per: q.per }))}"${q.lowOnly ? "" : ' aria-current="page"'}>Everyone</a>
    <a href="${esc(href(base, { per: q.per, lowOnly: true }))}"${q.lowOnly ? ' aria-current="page"' : ""}>Below the threshold</a>
  </nav>`;
  const sizes = TRUST_PAGE_SIZES.map(n => n === q.per
    ? `<strong aria-current="true">${n}</strong>`
    : `<a href="${esc(href(base, { per: n, lowOnly: q.lowOnly }))}">${n}</a>`).join(" · ");
  if (!page) {
    return `${tabs}<p class="callout warn">Aegis couldn't load the member list just now. Reload the page in a minute.</p>`;
  }
  const rows = page.rows.map(m => `<tr>
      <td data-label="Member"><a href="/dashboard/${g}/members/${esc(m.userId)}">${esc(m.name)}</a> ${copyId(m.userId, "Copy user ID")}</td>
      <td data-label="Score">${m.score}${m.low ? ' <span class="tag warn">low</span>' : ""}</td>
      <td data-label="Band">${esc(m.bandLabel)}</td>
    </tr>`).join("");
  const table = page.rows.length
    ? `<div class="table-wrap"><table class="case-table"><caption class="visually-hidden">Members and their Trust Scores</caption>
      <thead><tr><th scope="col">Member</th><th scope="col">Score</th><th scope="col">Band</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`
    : q.lowOnly && page.scanned
      ? emptyState("Nobody on this page is below the threshold.", page.next ? "Try the next page." : "That was the last page.")
      : emptyState("No members to show.", q.after ? "That was the last page." : "Aegis sees no members in this server yet.");
  const nav = [
    q.after ? `<a class="btn sm ghost" href="${esc(href(base, { per: q.per, lowOnly: q.lowOnly }))}">First page</a>` : "",
    page.next ? `<a class="btn sm" href="${esc(href(base, { per: q.per, lowOnly: q.lowOnly, after: page.next }))}" rel="next">Next page</a>` : "",
  ].filter(Boolean).join(" ");
  return `${tabs}
    ${table}
    <div class="btn-row">${nav}<span class="faint">${page.scanned.toLocaleString("en-US")} member${page.scanned === 1 ? "" : "s"} on this page, in Discord's order. Per page: ${sizes}</span></div>`;
}
