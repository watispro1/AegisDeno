/**
 * Illustrative dashboard examples for /features: the Cases view, a Trust
 * Score breakdown and an Incident Mode timeline, as static HTML with clearly
 * made-up data. The Trust Score example is computed by the real scoring
 * function from fictional inputs, so its numbers always add up the way the
 * bot's would. Existing classes only (f-cat, f-grid, f-card, f-why).
 */
import { calculateTrustProfile } from "../../services/trustScore";
import { icon } from "./icons";
import { escapeHtml as esc } from "./shared";

const DAY = 86_400_000;
/** A fixed "now" so the example never changes between renders. */
const EXAMPLE_NOW = Date.UTC(2026, 0, 15, 12);

export const EXAMPLE_CASES: Array<[string, string, string, string, string]> = [
  ["#1042", "Timeout · 1 hour", "@quickcash99", "sam", "Posting invite links in #general"],
  ["#1041", "Warning · medium", "@quickcash99", "sam", "Advertising"],
  ["#1040", "Ban · revoked", "@not_a_bot_42", "riley", "Raid account (appeal approved)"],
  ["#1039", "Kick", "@spam_wave_07", "AutoMod", "Mention spam: 9 mentions in one message"],
];

export function exampleTrust() {
  return calculateTrustProfile({
    accountCreatedAt: new Date(EXAMPLE_NOW - 400 * DAY),
    joinedAt: new Date(EXAMPLE_NOW - 200 * DAY),
    warnings: 1,
    cases: 1,
    messageCount: 320,
    lastActiveAt: new Date(EXAMPLE_NOW - 2 * DAY),
    now: EXAMPLE_NOW,
  });
}

export const EXAMPLE_TIMELINE: Array<[string, string]> = [
  ["21:02", "Auto-trigger: 18 accounts joined in 60 seconds. Incident Mode started for 2 hours."],
  ["21:02", "Recorded 6 channels, then set slowmode to 30 seconds and locked #general and #memes."],
  ["21:02", "Join gate on: accounts under 7 days old are timed out. Invites paused."],
  ["21:09", "Join gate timed out 14 new accounts."],
  ["21:40", "Ended by riley with /incident end. Restored all 6 channels to their recorded settings; invites resumed."],
  ["21:40", "Report posted to #mod-log."],
];

function table(caption: string, head: string[], rows: string[][]): string {
  return `<div class="table-wrap"><table class="f-why"><caption class="visually-hidden">${esc(caption)}</caption>
        <thead><tr>${head.map(h => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map(([first, ...rest]) => `<tr><th scope="row">${esc(first)}</th>${rest.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

export function dashboardExamples(): string {
  const t = exampleTrust();
  const b = t.breakdown;
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
  const trustRows = [
    ["Account age", `${t.accountAgeLabel} old`, signed(b.accountAge)],
    ["Time in the server", t.tenureLabel, signed(b.serverTenure)],
    ["Long-tenure bonus", "180 days or more", signed(b.bonus)],
    ["Message activity", `${t.counts.messages} messages, last ${t.lastActiveLabel}`, signed(b.activity)],
    ["Active warnings", String(t.counts.warnings), signed(b.warningPenalty)],
    ["Timeouts, kicks and bans", String(t.counts.cases), signed(b.casePenalty)],
    ["Score", t.tier.replace(/^\S+\s/, ""), `${b.total} / 100`],
  ];
  const cards = [
    { id: "example-cases", icon: "gavel" as const, title: "Cases view", body: table("Example case list", ["Case", "Action", "Member", "Moderator", "Reason"], EXAMPLE_CASES) },
    { id: "example-trust", icon: "gauge" as const, title: "Trust Score breakdown", body: table("Example Trust Score breakdown for @newcomer_jo", ["Factor", "Reading", "Points"], trustRows) },
    { id: "example-incident", icon: "alert" as const, title: "Incident Mode timeline", body: table("Example Incident Mode timeline", ["Time", "What happened"], EXAMPLE_TIMELINE) },
  ];
  return `<section class="f-cat" id="examples" aria-labelledby="examples-title">
    <h2 id="examples-title"><a class="group-anchor" href="#examples">What it looks like</a></h2>
    <p class="f-lead">Illustrative examples of three dashboard views. Every name, number and time here is made up; the layout and fields follow the real pages, and the Trust Score points are worked out by the real scoring rules.</p>
    <ul class="f-grid">${cards.map(c => `<li class="f-card" id="${c.id}">
      <div class="f-card-head">${icon(c.icon)}<h3>${esc(c.title)}</h3><span class="f-badge">Example data</span></div>
      ${c.body}
    </li>`).join("")}</ul>
  </section>`;
}
