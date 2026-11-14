/**
 * Public /why page: the reasons to pick Aegis, each tied to what the code
 * actually does (a test checks the numbers against the source constants),
 * followed by the comparison table from the features page.
 */
import { UNDO_WINDOW_MS } from "../../services/moderationUndo";
import { INCIDENT_MAX_MINUTES } from "../../services/incidentLogic";
import { WHY_ROWS, type IconId } from "./featuresData";
import { icon, iconSprite } from "./icons";
import { type SiteConfig, breadcrumb, endNote, escapeHtml as esc, page } from "./shared";

export interface WhyReason {
  id: string;
  icon: IconId;
  title: string;
  /** Escaped-at-source HTML (links and inline code only). */
  html: string;
  /** Where to see it for yourself. */
  proof: string;
}

const undoMinutes = Math.round(UNDO_WINDOW_MS / 60_000);
const incidentHours = Math.round(INCIDENT_MAX_MINUTES / 60);

export const WHY_REASONS: WhyReason[] = [
  {
    id: "reversible",
    icon: "clock",
    title: "Actions you can take back",
    html: `<p>/warn, /timeout and /ban post an Undo button that works for ${undoMinutes} minutes. Undoing reverses the action and marks the case revoked, so the record stays honest. Temporary bans and temporary roles lift themselves when they run out, even after a restart, and staff can revoke a case from the dashboard as well, with the option to lift the ban when the case was one.</p>`,
    proof: `<a href="/commands#cmd-case">/case</a> and the dashboard's Cases page show every revoked case with who revoked it.`,
  },
  {
    id: "explainable",
    icon: "gauge",
    title: "A Trust Score you can read",
    html: `<p>The score is plain arithmetic: account age, time in the server, the member's record and how active they are. Every reply lists the factors, biggest first. Activity is stored as counts and timestamps only, never message content, and the counters are deleted after 180 days of silence.</p>`,
    proof: `Run <a href="/commands#cmd-trust-user"><code class="inline">/trust user</code></a> on yourself, or read the <a href="/features#trust-score">scoring rules</a>.`,
  },
  {
    id: "incident",
    icon: "alert",
    title: "Incident Mode puts things back exactly",
    html: `<p>Before it changes a channel, Incident Mode records what the channel looked like. Ending it, by hand or on its timer (up to ${incidentHours} hours, even across restarts), restores each recorded slowmode and permission overwrite instead of guessing at defaults. A full report goes to the mod log.</p>`,
    proof: `<a href="/commands#cmd-incident">/incident</a> start, status and end, or the Incident Mode page on the dashboard.`,
  },
  {
    id: "permissions",
    icon: "lock",
    title: "Only the permissions it uses",
    html: `<p>The invite link is built from the permissions each command declares, and Administrator is stripped out even if a command asked for it. Aegis also checks role order before acting, in commands and on the dashboard alike, so a moderator can't act on anyone whose top role is level with or above their own.</p>`,
    proof: `The <a href="/docs#permissions">permissions table</a> lists every permission and the commands that need it.`,
  },
  {
    id: "free",
    icon: "star",
    title: "Free, with nothing locked",
    html: `<p>There is no paid tier, no premium flag in the code and no feature held back. Every command on the <a href="/commands">commands page</a> works in every server.</p>`,
    proof: `The <a href="/commands">commands page</a> is generated from the bot's own command definitions.`,
  },
  {
    id: "retention",
    icon: "shield",
    title: "Records that expire",
    html: `<p>Warnings, moderation cases and staff notes are deleted by the database a year after they were created. Dashboard activity entries go after 180 days, and dashboard sessions after 7 days. Each server's data is kept separately and never shared with another server.</p>`,
    proof: `The <a href="/privacy">privacy policy</a> lists everything stored and for how long.`,
  },
];

export function renderWhy(cfg: SiteConfig): string {
  const cards = WHY_REASONS.map(r => `<li class="f-card" id="${r.id}">
      <div class="f-card-head">${icon(r.icon)}<h3>${esc(r.title)}</h3></div>
      ${r.html}
      <p class="faint">${r.proof}</p>
    </li>`).join("\n    ");
  const table = `<section class="f-cat" id="compare" aria-labelledby="compare-title">
    <h2 id="compare-title"><a class="group-anchor" href="#compare">Side by side</a></h2>
    <p class="f-lead">How these compare with doing it by hand or with a typical moderation bot.</p>
    <div class="table-wrap"><table class="f-why"><caption class="visually-hidden">Aegis compared with doing it by hand or other bots</caption>
      <thead><tr><th scope="col">What matters</th><th scope="col">Aegis</th><th scope="col">Elsewhere</th></tr></thead>
      <tbody>${WHY_ROWS.map(([a, b, c]) => `<tr><th scope="row">${esc(a)}</th><td>${esc(b)}</td><td>${esc(c)}</td></tr>`).join("")}</tbody></table></div>
  </section>`;
  const body = `${iconSprite(WHY_REASONS.map(r => r.icon))}
<div class="wrap">
  ${breadcrumb("Why Aegis")}
  <div class="page-head f-head">
    <h1>Why Aegis</h1>
    <p class="lead">Moderation that keeps up with your community and shows its work. Each reason below says where to check it for yourself.</p>
  </div>
  <h2 class="visually-hidden" id="reasons-title">Reasons</h2>
  <ul class="f-grid" aria-labelledby="reasons-title">
    ${cards}
  </ul>
  ${table}
  ${endNote(cfg, `Questions first? The <a href="/docs#faq">FAQ</a> and the <a href="/security">security page</a> cover the details.`)}
</div>`;
  return page(cfg, {
    title: "Why Aegis | Aegis",
    description: "Why pick Aegis for Discord moderation: reversible actions, an explainable Trust Score, exact Incident Mode restore, no Administrator permission, free, and records that expire.",
    path: "/why",
    body,
  });
}
