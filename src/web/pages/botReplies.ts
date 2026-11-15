/**
 * Faithful HTML recreations of two real Aegis replies in Discord: /trust user
 * (Trust Score embed) and /incident start (Incident Mode embed). Pure HTML and
 * classes only (no images, inline styles or scripts), so it passes the CSP.
 *
 * The numbers are not typed in by hand: the Trust Score example runs the real
 * scoring engine (computeTrust) on made-up facts, and the incident summary
 * lines come from the real summarizeIncident(), so the wording always matches
 * what the bot sends. Every name, ID and time is fictional.
 */
import { computeTrust, formatPoints, type TrustBand } from "../../services/trustEngine";
import { scoreBar } from "../../services/trustScore";
import { formatMinutes, summarizeIncident } from "../../services/incidentLogic";
import { escapeHtml as esc } from "./shared";

const DAY = 86_400_000;
/** Fixed "now" so the example never changes between renders. */
const NOW = Date.UTC(2026, 0, 15, 20, 14);

/** Made-up people. Never real users, servers or IDs. */
export const SHOWCASE_NAMES = { moderator: "mod_rowan", member: "pixel_fern", incidentId: "7f3a91c2" } as const;

export function showcaseTrust() {
  return computeTrust({
    accountCreatedAt: new Date(NOW - 692 * DAY),
    joinedAt: new Date(NOW - 13 * DAY),
    verified: true,
    messageCount: 44,
    activeDays30: 3,
    lastActiveAt: new Date(NOW - 2 * DAY),
    warnings: [],
    cases: [],
    automodHits30: 0,
    gateFlags: 0,
  }, "balanced", NOW);
}

export function showcaseIncidentSummary(): string[] {
  const started = new Date(NOW - 6 * 60_000);
  const ch = (name: string) => ({ channelId: name, name, slowmode: { from: 0, to: 10 } });
  return summarizeIncident({
    startedAt: started,
    endedAt: new Date(NOW),
    counts: { joins: 23, gated: 19, cases: 19, deleted: 41 },
    changes: [ch("general"), ch("memes"), ch("media"), ch("introductions")],
    invitesPaused: false,
    caseIds: [],
  });
}

/** The 🚨 emoji as a small SVG, so it renders the same without an emoji font. */
const SIREN = `<svg class="dcx-siren" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><rect x="3" y="15" width="14" height="3" rx="1" fill="#b9bbbe"/><path d="M5 15V10a5 5 0 0 1 10 0v5z" fill="#ed4245"/><path d="M10 7v5M8 9.5l4 0" stroke="#fff" stroke-width="1.4"/><path d="M10 1v2M3 4l1.4 1.4M17 4l-1.4 1.4" stroke="#ed4245" stroke-width="1.4"/></svg>`;

/**
 * The score bar exactly as the bot sends it: scoreBar() gives ten emoji
 * squares (🟩 80+, 🟦 60+, 🟨 40+, 🟧 20+, 🟥 below, ⬛ empty) in the embed
 * description, outside any code span. Each square is drawn as a small SVG in
 * the Twemoji colour Discord uses, so it looks the same on machines without
 * an emoji font. The emoji text itself stays in the aria-label.
 */
const SQUARE_FILL: Record<string, string> = {
  "🟩": "#78b159", "🟦": "#55acee", "🟨": "#fdcb58", "🟧": "#f4900c", "🟥": "#dd2e44", "⬛": "#31373d",
};

export function barHtml(score: number): string {
  const bar = scoreBar(score);
  const squares = [...bar].map(ch => {
    const fill = SQUARE_FILL[ch] ?? SQUARE_FILL["⬛"];
    return `<svg class="dcx-sq" viewBox="0 0 36 36" width="18" height="18" aria-hidden="true" focusable="false"><rect x="1" y="1" width="34" height="34" rx="4" fill="${fill}"/></svg>`;
  }).join("");
  return `<div class="dcx-bar" role="img" aria-label="Score bar ${esc(bar)}, ${score} out of 100">${squares}</div>`;
}

const BAND_CLASS: Record<TrustBand, string> = {
  trusted: "green", established: "blurple", neutral: "yellow", low: "orange", "high-risk": "red",
};

/** Discord's light markdown: `code` and **bold**, on already-escaped text. */
function md(text: string): string {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code class="dcx-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function frame(command: string, time: string, content: string, embed: string, label: string): string {
  return `<div class="dc dcx" role="group" aria-label="${esc(label)}">
      <div class="dcx-reply"><span class="dcx-reply-line" aria-hidden="true"></span><span class="dcx-mini-av" aria-hidden="true"></span><b>${esc(SHOWCASE_NAMES.moderator)}</b> used <span class="dcx-cmdref">${esc(command)}</span></div>
      <div class="dc-msg dcx-msg">
        <div class="dc-avatar bot dcx-av" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" focusable="false"><path d="M12 3 19 6v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3Z" fill="none" stroke="currentColor" stroke-width="2"/></svg></div>
        <div class="dcx-main">
          <div class="dc-name">Aegis<span class="dc-tag">APP</span><small>Today at ${esc(time)}</small></div>
          ${content ? `<div class="dcx-content">${content}</div>` : ""}
          ${embed}
          <div class="dcx-eph"><span aria-hidden="true">◉</span> Only you can see this · <span class="dcx-link">Dismiss message</span></div>
        </div>
      </div>
    </div>`;
}

export function trustReply(): string {
  const r = showcaseTrust();
  const rows = r.factors.map(f => `<li><code class="dcx-pts">${esc(formatPoints(f.points))}</code><span><strong>${esc(f.label)}</strong> · ${esc(f.detail)}</span></li>`).join("");
  const embed = `<div class="dc-embed dcx-embed ${BAND_CLASS[r.band]}">
            <div class="dcx-author"><span class="dcx-mini-av alt" aria-hidden="true"></span>Trust Score — ${esc(SHOWCASE_NAMES.member)}</div>
            <div class="dcx-title">${r.score}/100 · ${esc(r.bandLabel)}</div>
            ${barHtml(r.score)}
            <div class="dcx-field-name">Why</div>
            <ul class="dcx-factors">${rows}</ul>
            <div class="dcx-footer">Preset: ${esc(r.preset)} · counts and dates only, never message content</div>
          </div>`;
  return frame("/trust user", "20:14", "", embed, `Example Trust Score reply for ${SHOWCASE_NAMES.member}`);
}

export function incidentReply(): string {
  const summary = showcaseIncidentSummary().map(l => `<div>${esc(l)}</div>`).join("");
  const content = `${SIREN}Incident Mode is on. Staff were alerted in the mod log (no pings).<br>Live timeline: <span class="dcx-link">aegisdeno.fly.dev/dashboard/…/incident</span>`;
  const embed = `<div class="dc-embed dcx-embed red">
            <div class="dcx-title">${SIREN}Incident Mode is on</div>
            <div class="dcx-desc"><strong>Reason:</strong> Raid of brand-new accounts in #general<br>Ends <span class="dcx-ts">in an hour</span> (<span class="dcx-ts">21:20</span>) or with ${md("`/incident end`")}.</div>
            <div class="dcx-field-name">Summary</div>
            <div class="dcx-field-val">${summary}</div>
            <div class="dcx-inline">
              <div><div class="dcx-field-name">Join gate</div><div class="dcx-field-val">Time out (${esc(formatMinutes(60))}) accounts under 7 day(s)</div></div>
              <div><div class="dcx-field-name">Slowmode</div><div class="dcx-field-val">10s</div></div>
            </div>
            <div class="dcx-footer">Incident ${esc(SHOWCASE_NAMES.incidentId)} · started by ${esc(SHOWCASE_NAMES.moderator)}</div>
          </div>`;
  return frame("/incident start", "20:20", content, embed, "Example Incident Mode reply");
}

/**
 * The two replies side by side (stacked on narrow screens). `headingId` lets
 * each page give the section its own heading level and id.
 */
export function botShowcase(opts: { id: string; title: string; lead: string; level?: 2 | 3 }): string {
  const h = `h${opts.level ?? 2}`;
  return `<section class="showcase" id="${esc(opts.id)}" aria-labelledby="${esc(opts.id)}-title">
  <div class="section-head">
    <${h} id="${esc(opts.id)}-title">${esc(opts.title)}</${h}>
    <p>${opts.lead}</p>
  </div>
  <div class="showcase-grid">
    <figure class="showcase-item">
      <figcaption><strong>Trust Score</strong> <span class="showcase-cmd">/trust user</span> <span class="f-badge">Example — names are made up</span></figcaption>
      ${trustReply()}
      <p class="showcase-note">Every point is explained. The numbers come from the real scoring rules.</p>
    </figure>
    <figure class="showcase-item">
      <figcaption><strong>Incident Mode</strong> <span class="showcase-cmd">/incident start</span> <span class="f-badge">Example — names are made up</span></figcaption>
      ${incidentReply()}
      <p class="showcase-note">One command slows channels and gates new accounts. Ending it restores each channel exactly.</p>
    </figure>
  </div>
</section>`;
}
