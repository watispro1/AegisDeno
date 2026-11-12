import { trustCard } from "./trust";
import { economyCard } from "./economy";
import type { EconomyConfig } from "../../../services/economyLogic";
import type { TrustConfig, TrustResult } from "../../../services/trustEngine";
/** Member lookup (/:guildId/members[/:userId]) and global search (/:guildId/search). */
import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { CaseRecord } from "../data";
import type { MemberProfile, MemberRecords, SearchHit } from "../extras";
import { TIMEOUT_CHOICES } from "../extrasValidation";
import { type GuildContext, copyId, csrfField, emptyState, idCode, notice, person, relTime, relTimeOr } from "./layout";
import { errorSummary, modulePage } from "./parts";
import { helpPanel, listFoot, listTools, pagedTable, pill, rowAttrs, sectionJump, summaryStrip } from "./moduleKit";

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

function caseRows(ctx: GuildContext, rows: CaseRecord[], id: string, empty: string): string {
  if (!rows.length) return `<p class="muted">${empty}</p>`;
  const tools = rows.length > 8;
  const active = rows.filter(c => !c.revoked).length;
  return `${tools ? listTools(id, {
    search: "Filter by action, reason or moderator",
    chips: active && active < rows.length ? [{ value: "active", label: "Active", count: active }, { value: "revoked", label: "Revoked", count: rows.length - active }] : undefined,
    chipLabel: "Status",
  }) : ""}<div class="table-wrap"><table class="case-table" id="${esc(id)}"${tools ? pagedTable(10) : ""}><thead><tr><th scope="col">When</th><th scope="col">Action</th><th scope="col">Reason</th><th scope="col">By</th></tr></thead><tbody>
    ${rows.map(c => `<tr${c.revoked ? ' class="revoked"' : ""}${tools ? rowAttrs(c.revoked ? "revoked" : "active") : ""}>
      <td data-label="When"><a href="/dashboard/${esc(ctx.guild.id)}/cases/${esc(c.id)}">${relTime(c.createdAt)}</a> ${copyId(c.id, "Copy case ID")}</td>
      <td data-label="Action">${esc(c.action)}${c.revoked ? ' <span class="tag warn">revoked</span>' : ""}</td>
      <td data-label="Reason">${esc(c.reason.slice(0, 120))}</td>
      <td data-label="By">${person(ctx, c.moderatorId)}</td></tr>`).join("")}
  </tbody></table></div>${tools ? listFoot(id) : ""}`;
}

export function renderMemberSearch(cfg: SiteConfig, ctx: GuildContext, o: { q: string; members: Array<{ id: string; name: string; avatarUrl: string | null }>; noticeCode?: string | null }): string {
  const base = `/dashboard/${esc(ctx.guild.id)}`;
  return modulePage(cfg, ctx, {
    active: "members",
    title: "Members",
    lead: "Look up anyone by name or ID: their cases, warnings, notes and timeout, with quick actions.",
    path: `${base}/members`,
    body: `${notice(o.noticeCode ?? null)}${searchForm(base, o.q, "Name, username or user ID", `${base}/members`)}
    ${o.q ? (o.members.length ? `<p class="faint member-count" role="status">${o.members.length} match${o.members.length === 1 ? "" : "es"} for “${esc(o.q)}”.</p><ul class="member-list">${o.members.map(m => `<li><a href="${base}/members/${esc(m.id)}">${avatarImg(m.avatarUrl, m.name)}<span>${esc(m.name)}</span><span class="faint">${esc(m.id)}</span></a></li>`).join("")}</ul>`
      : emptyState("No members found.", "Try their user ID (right-click → Copy User ID with Developer Mode on). People who left can still be opened by ID."))
      : `<p class="muted">Search above, or open a member from a case.</p>`}
    ${helpPanel("Finding a member", [
      ["By name", "Type part of a display name or username. Results come from members still in the server."],
      ["By ID", "Paste a user ID to open anyone, including people who left or were banned."],
      ["What you see", "Their cases, warnings, staff notes, timeout and Trust Score, with quick actions."],
    ])}`,
  });
}

export function renderMember(cfg: SiteConfig, ctx: GuildContext, o: { member: MemberProfile; records: MemberRecords; noticeCode: string | null; errors?: Record<string, string>; values?: Record<string, string>; trust?: { result: TrustResult | null; config: TrustConfig }; economy?: { config: EconomyConfig; balance: number; streak: number; bank?: number } }): string {
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
      <p class="field-help">Every action asks you to confirm first. Kicks and bans can't be undone from here; revoke a ban from its case.</p>
      <p class="field-help">Checked against your highest role and Aegis's, the same as the slash commands. Needs the matching permission (Moderate Members, Kick Members or Ban Members).</p>
    </form>`;
  const name = m.globalName ?? m.username;
  const activeCases = o.records.cases.filter(c => !c.revoked).length;
  const stats = summaryStrip([
    { label: "Status", value: m.inServer ? (timedOut ? "Timed out" : "In server") : "Not in server", tone: m.inServer ? (timedOut ? "warn" : "ok") : "off" },
    { label: "Cases", value: activeCases, hint: o.records.cases.length > activeCases ? `${o.records.cases.length - activeCases} revoked` : undefined, href: "#cases-h" },
    { label: "Active warnings", value: activeWarnings, tone: activeWarnings ? "warn" : "ok", href: "#warn-h" },
    { label: "Staff notes", value: o.records.notes.length, href: "#notes-h" },
    ...(o.trust?.result ? [{ label: "Trust Score", value: `${o.trust.result.score}/100`, hint: o.trust.result.bandLabel, tone: (o.trust.result.score >= 60 ? "ok" : o.trust.result.score >= 40 ? "info" : o.trust.result.score >= 20 ? "warn" : "bad") as "ok" | "info" | "warn" | "bad", href: "#trust-h" }] : []),
  ], "Member summary");
  return modulePage(cfg, ctx, {
    active: "members",
    title: name,
    lead: `${idCode(m.id, "Copy user ID")}${m.bot ? ' <span class="tag">bot</span>' : ""}${m.inServer ? "" : ' <span class="tag warn">not in server</span>'}`,
    path: base,
    body: `${notice(o.noticeCode)}
  ${stats}
  ${sectionJump([["act-h", "Quick actions"], ...(o.trust ? [["trust-h", "Trust Score"] as [string, string]] : []), ["cases-h", "Cases"], ["warn-h", "Warnings"], ["notes-h", "Staff notes"]])}
  <div class="member-head">${avatarImg(m.avatarUrl, name, "avatar-lg")}
    <dl class="member-facts">
      <dt>Username</dt><dd>${esc(m.username)}</dd>
      <dt>Joined server</dt><dd>${relTimeOr(m.joinedAt)}</dd>
      <dt>Account created</dt><dd>${relTimeOr(m.createdAt)}</dd>
      <dt>Timeout</dt><dd>${timedOut ? `Until ${relTime(m.timeoutUntil!)} ${pill("Timed out", "warn")}` : "None"}</dd>
      <dt>Warnings</dt><dd>${activeWarnings} active</dd>
      <dt>Roles</dt><dd>${m.roles.length ? m.roles.map(r => `<span class="tag">${esc(r.name)}</span>`).join(" ") : "—"}</dd>
    </dl>
  </div>
  <section class="panel-card" aria-labelledby="act-h"><h2 id="act-h">Quick actions</h2>${quick}</section>
  ${o.trust ? trustCard(ctx.guild.id, o.trust.result, o.trust.config) : ""}
  ${o.economy && !o.member.bot ? economyCard(ctx.guild.id, o.economy.config, o.economy.balance, o.economy.streak, o.economy.bank ?? 0) : ""}
  <section class="panel-card" aria-labelledby="cases-h"><h2 id="cases-h">Cases</h2>${caseRows(ctx, o.records.cases, "member-cases", "No cases. Actions you apply above are recorded here.")}</section>
  <section class="panel-card" aria-labelledby="warn-h"><h2 id="warn-h">Warnings</h2>${caseRows(ctx, o.records.warnings, "member-warnings", "No warnings. Use Warn above or <code class=\"inline\">/warn</code>.")}</section>
  <section class="panel-card" aria-labelledby="notes-h"><h2 id="notes-h">Staff notes</h2>${o.records.notes.length ? `<ul class="note-list">${o.records.notes.map(n => `<li><p>${esc(n.note)}</p><p class="faint">${person(ctx, n.moderatorId)} · ${relTime(n.createdAt)}${n.id ? ` ${copyId(String(n.id), "Copy note ID")}` : ""}</p></li>`).join("")}</ul>` : `<p class="muted">No notes. Add one with <code class="inline">/note add</code>.</p>`}</section>`,
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
