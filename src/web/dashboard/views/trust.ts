/** Trust Score page (/:guildId/trust) and the member-page card. Plain SVG, no inline styles or scripts. */
import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { RoleOption } from "../botView";
import { formatPoints, isLowTrust, type TrustConfig, type TrustResult } from "../../../services/trustEngine";
import type { TrustMemberPage, TrustMemberQuery, TrustOverview } from "../extras";
import { trustMemberList, trustPill } from "./trustMembers";
import { helpPanel, pill, sectionJump, summaryStrip } from "./moduleKit";
import { type GuildContext, copyId, csrfField, emptyState, notice } from "./layout";
import { Form, ROLE_PICKER_HELP, roleOptions, type FormState, type Values } from "./form";
import { errorSummary, modulePage } from "./parts";

export function trustValues(c: TrustConfig): Values {
  return {
    enabled: c.enabled, preset: c.preset, lowThreshold: String(c.lowThreshold),
    linkFilterLowTrustOnly: c.linkFilterLowTrustOnly, incidentGate: c.incidentGate, lowTrustRoleId: c.lowTrustRoleId ?? "",
  };
}

/** Ten-bucket histogram of scores; buckets under the threshold get the "low" class. */
export function trustHistogram(buckets: readonly number[], threshold: number): string {
  const w = 300, h = 100, step = w / 10;
  const max = Math.max(1, ...buckets);
  const total = buckets.reduce((a, b) => a + b, 0);
  const bars = buckets.map((n, i) => {
    const bh = n === 0 ? 2 : Math.max(3, (n / max) * (h - 4));
    const lo = i * 10, hi = i === 9 ? 100 : i * 10 + 9;
    const cls = `bar${n === 0 ? " zero" : ""}${hi < threshold ? " low" : ""}`;
    return `<rect class="${cls}" x="${(i * step + step * 0.12).toFixed(2)}" y="${(h - bh).toFixed(2)}" width="${(step * 0.76).toFixed(2)}" height="${bh.toFixed(2)}"><title>${lo}–${hi}: ${n} member(s)</title></rect>`;
  }).join("");
  return `<figure class="chart trust-chart">
    <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Trust Score distribution: ${total} member(s) in ten bands from 0 to 100" preserveAspectRatio="none">${bars}</svg>
    <figcaption><span>0</span><span>${total.toLocaleString("en-US")} scored</span><span>100</span></figcaption>
  </figure>
  <table class="visually-hidden"><caption>Members per score band</caption><tbody>${buckets.map((n, i) => `<tr><th scope="row">${i * 10}–${i === 9 ? 100 : i * 10 + 9}</th><td>${n}</td></tr>`).join("")}</tbody></table>`;
}

export function trustFactorList(r: TrustResult): string {
  return `<ul class="trust-factors">${r.factors.map(f => `<li class="${f.key === "base" ? "base" : f.points > 0 ? "pos" : f.points < 0 ? "neg" : "zero"}">
      <span class="trust-pts">${esc(formatPoints(f.points))}</span> <strong>${esc(f.label)}</strong> <span class="faint">${esc(f.detail)}</span></li>`).join("")}</ul>`;
}

/** Card on the member page. */
export function trustCard(guildId: string, r: TrustResult | null, config: TrustConfig): string {
  const body = r
    ? `<p class="trust-score"><strong>${r.score}</strong>/100 · ${esc(r.bandLabel)}${isLowTrust(r.score, config) ? ` <span class="tag warn">below threshold ${config.lowThreshold}</span>` : ""}</p>${trustFactorList(r)}`
    : `<p class="muted">Not scored: they are not in the server, or they are a bot.</p>`;
  return `<section class="panel-card" aria-labelledby="trust-h"><h2 id="trust-h">Trust Score</h2>${body}
    <p class="field-help">Counts and dates only, never message content. Same as <code class="inline">/trust user</code>. <a href="/dashboard/${esc(guildId)}/trust">Trust settings</a></p></section>`;
}

export function renderTrust(cfg: SiteConfig, ctx: GuildContext, o: {
  overview: TrustOverview; roles: RoleOption[]; noticeCode: string | null; state?: FormState;
  /** The member list; absent on pages rendered without it (a rejected settings form). */
  members?: { query: TrustMemberQuery; page: TrustMemberPage | null };
}): string {
  const base = `/dashboard/${esc(ctx.guild.id)}/trust`;
  const ov = o.overview;
  const f = new Form(o.state ?? { values: trustValues(ov.config), errors: {} }, "trust-");
  const lowest = ov.lowest.length
    ? `<div class="table-wrap"><table class="case-table"><caption class="visually-hidden">Lowest-trust members</caption>
      <thead><tr><th scope="col">Member</th><th scope="col">Score</th><th scope="col">Band</th></tr></thead>
      <tbody>${ov.lowest.map(m => `<tr><td data-label="Member"><a href="/dashboard/${esc(ctx.guild.id)}/members/${esc(m.userId)}">${esc(m.name)}</a> ${copyId(m.userId, "Copy user ID")}</td>
        <td data-label="Score">${m.score}</td><td data-label="Band">${trustPill(m.score, m.bandLabel)}</td></tr>`).join("")}</tbody></table></div>
      <p class="field-help">Open a member to see every factor behind their score and take action.</p>`
    : emptyState("No members scored yet.", "Scores appear once Aegis can read this server's member list. Check that Aegis has the Server Members intent, then reload.");
  const cfgOn = ov.config.enabled;
  const integrations = [ov.config.linkFilterLowTrustOnly, ov.config.incidentGate, Boolean(ov.config.lowTrustRoleId)].filter(Boolean).length;
  const lowShare = ov.scored ? Math.round((ov.lowCount / ov.scored) * 100) : 0;
  return modulePage(cfg, ctx, {
    active: "trust",
    title: "Trust Score",
    lead: "An explainable 0–100 score per member from account age, time here, verification, activity, cases, warnings, automod hits and Incident Mode gates. Same as <code class=\"inline\">/trust</code>.",
    path: base,
    body: `${notice(o.noticeCode)}
  ${summaryStrip([
    { label: "Members scored", value: ov.scored, hint: ov.truncated ? "First part of a large server" : undefined },
    { label: "Average score", value: ov.average ?? "—", tone: ov.average === null ? undefined : ov.average >= 60 ? "ok" : ov.average >= 40 ? "info" : "warn" },
    { label: `Below ${ov.config.lowThreshold}`, value: ov.lowCount, hint: ov.scored ? `${lowShare}% of scored` : undefined, tone: ov.lowCount ? "warn" : "ok", href: o.members ? `${base}?low=1#trust-members-h` : undefined },
    { label: "Integrations", value: cfgOn ? `${integrations} of 3 on` : "Off", tone: cfgOn ? "ok" : "off", href: `${base}#trust-cfg-h` },
  ], "Trust Score summary")}
  <p class="trust-status">${cfgOn ? pill("Integrations on", "ok") : pill("Integrations off", "off")} ${pill(`Weights: ${ov.config.preset}`, "info")}</p>
  ${sectionJump([["trust-dist-h", "Distribution"], ["trust-low-h", "Lowest trust"], ...(o.members ? [["trust-members-h", "All members"] as [string, string]] : []), ["trust-cfg-h", "Settings"]])}
  ${helpPanel("How Trust Score works", [
    ["Bands", "80+ Trusted · 60–79 Established · 40–59 Neutral · 20–39 Low trust · under 20 High risk."],
    ["What counts", "Account age, time in this server, verification, activity, cases, warnings, automod hits and Incident Mode gates. Counts and dates only, never message content."],
    ["Weights", "Strict makes penalties weigh more; Lenient makes them weigh less. Scores change straight away."],
    ["Integrations", "Optional: limit the link filter to low-trust members, gate low-trust joins during an incident, or give low-trust members a role."],
  ])}
  <section class="panel-card" aria-labelledby="trust-dist-h"><h2 id="trust-dist-h">Distribution</h2>
    ${trustHistogram(ov.distribution, ov.config.lowThreshold)}
    ${ov.truncated ? `<p class="faint">Large server: the first ${ov.scored.toLocaleString("en-US")} members are scored here. Every member is listed below.</p>` : ""}
    <p class="faint">Refreshed every few minutes.</p></section>
  <section class="panel-card" aria-labelledby="trust-low-h"><h2 id="trust-low-h">Lowest trust</h2>${lowest}</section>
  ${o.members ? `<section class="panel-card" aria-labelledby="trust-members-h"><h2 id="trust-members-h">All members</h2>${trustMemberList(ctx, base, o.members.query, o.members.page)}</section>` : ""}
  <section class="panel-card" aria-labelledby="trust-cfg-h"><h2 id="trust-cfg-h">Settings and integrations</h2>
    <p class="muted">Every integration is off until you turn it on. Scores themselves work either way.</p>
    ${errorSummary(o.state?.errors ?? {}, "f-trust-")}
    <form class="dash-form" method="post" action="${base}/settings" novalidate data-track-changes>
      ${csrfField(ctx.viewer)}
      ${f.checkbox("enabled", "Turn on Trust Score integrations", "Master switch for the three options below.")}
      <div class="field-row two">
        ${f.select("preset", "Weights", [{ value: "strict", label: "Strict: penalties weigh more" }, { value: "balanced", label: "Balanced" }, { value: "lenient", label: "Lenient: penalties weigh less" }])}
        ${f.number("lowThreshold", "Low trust is below", 5, 90, "Default 30.")}
      </div>
      ${f.checkbox("linkFilterLowTrustOnly", "Automod link filter only for low-trust members", "Needs the automod link filter on. Trusted members can post links.")}
      ${f.checkbox("incidentGate", "Incident Mode join gate also gates low-trust joins", "Applies only while an incident is active and its join gate is on.")}
      ${f.select("lowTrustRoleId", "Give low-trust members this role", roleOptions(o.roles, "No role"), `Given on join and whenever a score drops below the threshold; taken away again once it recovers. ${ROLE_PICKER_HELP}`)}
      <button class="btn" type="submit" data-save-button>Save trust settings</button>
      <p class="field-help">Saved changes are listed on the Activity page.</p>
    </form>
  </section>`,
  });
}
