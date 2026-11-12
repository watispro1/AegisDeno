/** The Trust page's member list: one page of Discord's member list at a time, scored. */
import { escapeHtml as esc } from "../../pages";
import { TRUST_PAGE_SIZES, type TrustMemberPage, type TrustMemberQuery } from "../extras";
import { type GuildContext, copyId, emptyState } from "./layout";
import { countBy, listFoot, listTools, pagedTable, pill, rowAttrs, type Tone } from "./moduleKit";

/** Pill tone for a Trust Score: green when trusted, red when high risk. */
export function trustTone(score: number): Tone {
  return score >= 60 ? "ok" : score >= 40 ? "info" : score >= 20 ? "warn" : "bad";
}

/** A score shown as a coloured pill with its band, e.g. "72 · Established". */
export function trustPill(score: number, bandLabel: string): string {
  return pill(`${score} · ${bandLabel}`, trustTone(score));
}

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
  const rows = page.rows.map(m => `<tr${rowAttrs(m.bandLabel, { score: m.score, name: m.name.toLowerCase() })}>
      <td data-label="Member"><a href="/dashboard/${g}/members/${esc(m.userId)}">${esc(m.name)}</a> ${copyId(m.userId, "Copy user ID")}</td>
      <td data-label="Score">${m.score}${m.low ? ' <span class="tag warn">low</span>' : ""}</td>
      <td data-label="Band">${pill(m.bandLabel, trustTone(m.score))}</td>
    </tr>`).join("");
  const bands = [...countBy(page.rows, m => m.bandLabel)].map(([value, count]) => ({ value, label: value, count }));
  const table = page.rows.length
    ? `${listTools("trust-member-table", {
        search: "Filter this page by name or ID",
        chips: bands.length > 1 ? bands : undefined,
        chipLabel: "Band",
        sorts: [{ value: "score:asc", label: "Lowest score first" }, { value: "score:desc", label: "Highest score first" }, { value: "name:asc", label: "Name A–Z" }],
      })}<div class="table-wrap"><table class="case-table trust-member-table" id="trust-member-table"${pagedTable(25)}><caption class="visually-hidden">Members and their Trust Scores</caption>
      <thead><tr><th scope="col">Member</th><th scope="col">Score</th><th scope="col">Band</th></tr></thead>
      <tbody>${rows}</tbody></table></div>${listFoot("trust-member-table", "Nobody on this page matches. Clear the search or pick another band.")}`
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
