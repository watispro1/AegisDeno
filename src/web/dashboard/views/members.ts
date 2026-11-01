/** Member lookup (/:guildId/members[/:userId]) and global search (/:guildId/search). */
import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { CaseRecord } from "../data";
import type { MemberProfile, MemberRecords, SearchHit } from "../extras";
import { TIMEOUT_CHOICES } from "../extrasValidation";
import { type GuildContext, csrfField, emptyState, fmtDate, notice, person } from "./layout";
import { errorSummary, modulePage } from "./parts";

/** Only Discord's CDN is allowed by the CSP's img-src; anything else falls back to an initial. */
export function avatarImg(url: string | null, name: string, cls = "avatar-img"): string {
  if (url && /^https:\/\/cdn\.discordapp\.com\//.test(url)) return `<img class="${cls}" src="${esc(url)}" alt="" width="40" height="40" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
  return `<span class="${cls} avatar-fallback" aria-hidden="true">${esc((Array.from(name.trim())[0] ?? "?").toUpperCase())}</span>`;
}

function searchForm(base: string, q: string, label: string, action = `${base}/search`): string {
  return `<form class="search-row" method="get" action="${action}" role="search">
    <label class="visually-hidden" for="dash-q">${esc(label)}</label>
    <input type="search" id="dash-q" name="q" value="${esc(q)}" maxlength="64" placeholder="${esc(label)}" autocomplete="off" required>
    <button class="btn" type="submit">Search</button>
  </form>`;
}

function caseRows(ctx: GuildContext, rows: CaseRecord[]): string {
  if (!rows.length) return `<p class="muted">None.</p>`;
  return `<div class="table-wrap"><table class="case-table"><thead><tr><th scope="col">When</th><th scope="col">Action</th><th scope="col">Reason</th><th scope="col">By</th></tr></thead><tbody>
    ${rows.map(c => `<tr${c.revoked ? ' class="revoked"' : ""}>
      <td data-label="When"><a href="/dashboard/${esc(ctx.guild.id)}/cases/${esc(c.id)}">${esc(fmtDate(c.createdAt))}</a></td>
      <td data-label="Action">${esc(c.action)}${c.revoked ? ' <span class="tag warn">revoked</span>' : ""}</td>
      <td data-label="Reason">${esc(c.reason.slice(0, 120))}</td>
      <td data-label="By">${person(ctx, c.moderatorId)}</td></tr>`).join("")}
  </tbody></table></div>`;
}

export function renderMemberSearch(cfg: SiteConfig, ctx: GuildContext, o: { q: string; members: Array<{ id: string; name: string; avatarUrl: string | null }>; noticeCode?: string | null }): string {
  const base = `/dashboard/${esc(ctx.guild.id)}`;
  return modulePage(cfg, ctx, {
    active: "members",
    title: "Members",
    lead: "Look up anyone by name or ID: their cases, warnings, notes and timeout, with quick actions.",
    path: `${base}/members`,
    body: `${notice(o.noticeCode ?? null)}${searchForm(base, o.q, "Name, username or user ID", `${base}/members`)}
    ${o.q ? (o.members.length ? `<ul class="member-list">${o.members.map(m => `<li><a href="${base}/members/${esc(m.id)}">${avatarImg(m.avatarUrl, m.name)}<span>${esc(m.name)}</span><span class="faint">${esc(m.id)}</span></a></li>`).join("")}</ul>`
      : emptyState("No members found.", "Try their user ID (right-click → Copy User ID with Developer Mode on). People who left can still be opened by ID."))
      : `<p class="muted">Search above, or open a member from a case.</p>`}`,
  });
}

export function renderMember(cfg: SiteConfig, ctx: GuildContext, o: { member: MemberProfile; records: MemberRecords; noticeCode: string | null; errors?: Record<string, string>; values?: Record<string, string> }): string {
  const m = o.member;
  const base = `/dashboard/${esc(ctx.guild.id)}/members/${esc(m.id)}`;
  const now = Date.now();
  const timedOut = m.timeoutUntil && m.timeoutUntil.getTime() > now;
  const activeWarnings = o.records.warnings.filter(w => !w.revoked).length;
  const v = o.values ?? {};
  const actions: Array<[string, string, boolean]> = [
    ["warn", "Warn", !m.bot],
    ["timeout", "Time out", m.inServer && m.botCan.timeout && !timedOut],
    ["untimeout", "Remove timeout", Boolean(timedOut) && m.botCan.timeout],
    ["kick", "Kick", m.inServer && m.botCan.kick],
    ["ban", "Ban", m.inServer ? m.botCan.ban : m.botCan.ban],
  ];
  const quick = m.owner
    ? `<p class="muted">This is the server owner; no moderation action can be taken on them.</p>`
    : `${errorSummary(o.errors ?? {}, "f-act-")}
    <form class="dash-form" method="post" action="${base}/action" novalidate data-confirm="Take this action? It is posted to the mod log and recorded as a case.">
      ${csrfField(ctx.viewer)}
      <div class="field"><label for="f-act-action">Action</label><select id="f-act-action" name="action">${actions.map(([value, label, ok]) => `<option value="${value}"${v.action === value ? " selected" : ""}${ok ? "" : " disabled"}>${label}${ok ? "" : " (not available)"}</option>`).join("")}</select></div>
      <div class="field"><label for="f-act-minutes">Timeout length</label><select id="f-act-minutes" name="minutes">${TIMEOUT_CHOICES.map(([mins, label]) => `<option value="${mins}"${String(mins) === (v.minutes ?? "60") ? " selected" : ""}>${label}</option>`).join("")}</select><span class="field-help">Only used for a timeout.</span></div>
      <div class="field"><label for="f-act-reason">Reason</label><input type="text" id="f-act-reason" name="reason" maxlength="400" required value="${esc(v.reason ?? "")}"${o.errors?.reason ? ' aria-invalid="true"' : ""}>${o.errors?.reason ? `<span class="field-error">${esc(o.errors.reason)}</span>` : ""}</div>
      <button class="btn danger" type="submit">Apply</button>
      <p class="field-help">Checked against your highest role and Aegis's, the same as the slash commands. Needs the matching permission (Moderate Members, Kick Members or Ban Members).</p>
    </form>`;
  const name = m.globalName ?? m.username;
  return modulePage(cfg, ctx, {
    active: "members",
    title: name,
    lead: `<code class="inline">${esc(m.id)}</code>${m.bot ? ' <span class="tag">bot</span>' : ""}${m.inServer ? "" : ' <span class="tag warn">not in server</span>'}`,
    path: base,
    body: `${notice(o.noticeCode)}
  <div class="member-head">${avatarImg(m.avatarUrl, name, "avatar-lg")}
    <dl class="member-facts">
      <dt>Username</dt><dd>${esc(m.username)}</dd>
      <dt>Joined server</dt><dd>${m.joinedAt ? esc(fmtDate(m.joinedAt)) : "—"}</dd>
      <dt>Account created</dt><dd>${m.createdAt ? esc(fmtDate(m.createdAt)) : "—"}</dd>
      <dt>Timeout</dt><dd>${timedOut ? `Until ${esc(fmtDate(m.timeoutUntil!))}` : "None"}</dd>
      <dt>Warnings</dt><dd>${activeWarnings} active</dd>
      <dt>Roles</dt><dd>${m.roles.length ? m.roles.map(r => `<span class="tag">${esc(r.name)}</span>`).join(" ") : "—"}</dd>
    </dl>
  </div>
  <section class="panel-card" aria-labelledby="act-h"><h2 id="act-h">Quick actions</h2>${quick}</section>
  <section class="panel-card"><h2>Cases</h2>${caseRows(ctx, o.records.cases)}</section>
  <section class="panel-card"><h2>Warnings</h2>${caseRows(ctx, o.records.warnings)}</section>
  <section class="panel-card"><h2>Staff notes</h2>${o.records.notes.length ? `<ul class="note-list">${o.records.notes.map(n => `<li><p>${esc(n.note)}</p><p class="faint">${person(ctx, n.moderatorId)} · ${esc(fmtDate(n.createdAt))}</p></li>`).join("")}</ul>` : `<p class="muted">No notes. Add one with <code class="inline">/note add</code>.</p>`}</section>`,
  });
}

export function renderSearch(cfg: SiteConfig, ctx: GuildContext, o: { q: string; hits: SearchHit[] }): string {
  const base = `/dashboard/${esc(ctx.guild.id)}`;
  const groups: Array<[SearchHit["kind"], string]> = [["page", "Pages"], ["member", "Members"], ["case", "Cases and warnings"]];
  return modulePage(cfg, ctx, {
    active: "overview",
    title: "Search",
    lead: "Find cases by ID, member ID or reason; members by name or ID; and dashboard pages.",
    path: `${base}/search`,
    body: `${searchForm(base, o.q, "Case ID, member, reason or page")}
    ${!o.q ? "" : o.hits.length ? groups.map(([kind, title]) => {
      const hits = o.hits.filter(h => h.kind === kind);
      return hits.length ? `<h2>${title}</h2><ul class="search-hits">${hits.map(h => `<li><a href="${esc(h.href)}">${esc(h.label)}</a> <span class="faint">${esc(h.detail)}</span></li>`).join("")}</ul>` : "";
    }).join("") : emptyState("Nothing found.", "Try a full case ID, a user ID, or a word from a case reason.")}`,
  });
}
