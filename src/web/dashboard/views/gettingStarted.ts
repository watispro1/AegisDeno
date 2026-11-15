/**
 * The overview's first-run "Get started" card and its "Recent activity" card.
 * Every step's done state is read from saved settings (plus the dashboard's
 * own audit trail for "invite staff"), so the card works without JavaScript:
 * links go to the right page and Dismiss is a plain CSRF-protected form POST.
 * Reuses the overview's checklist styles and moduleKit's pills; no inline
 * styles, scripts or handlers.
 */
import { escapeHtml as esc } from "../../pages";
import type { AuditEntry } from "../audit";
import type { OverviewData, SettingsSnapshot } from "../data";
import { enabledAutomodRules } from "../../../services/automod";
import { type GuildContext, csrfField, relTime } from "./layout";
import { pill } from "./moduleKit";
import { auditLabel } from "./activity";

export interface OnboardingStep {
  key: "logging" | "automod" | "staff" | "trust" | "invite";
  label: string;
  /** One plain sentence on why, or how it was detected. */
  detail: string;
  href: string;
  done: boolean;
}

/**
 * The five first-run steps. `audit` is the newest dashboard changes: a change
 * by someone other than the viewer means another staff member has signed in.
 */
export function onboardingSteps(guildId: string, s: SettingsSnapshot, audit: readonly AuditEntry[], viewerId: string): OnboardingStep[] {
  const b = `/dashboard/${guildId}`;
  const g = s.guild;
  const trust = g.trust;
  return [
    {
      key: "logging", label: "Set a log channel", href: `${b}/settings/logging`,
      done: g.loggingEnabled && Boolean(g.loggingChannelId),
      detail: "So every warn, timeout, kick and ban is recorded where staff can see it.",
    },
    {
      key: "automod", label: "Review automod", href: `${b}/settings/automod`,
      done: enabledAutomodRules(s.automod).length > 0,
      detail: "Turn on the rules that fit your server: spam, invites, links, mass mentions.",
    },
    {
      key: "staff", label: "Set your staff role", href: `${b}/modmail`,
      done: Boolean(g.modmail?.staffRoleId),
      detail: "The role that answers ModMail and can be pinged when members need help.",
    },
    {
      key: "trust", label: "Try /trust user", href: `${b}/trust`,
      done: Boolean(trust && (trust.enabled || trust.preset !== "balanced" || trust.lowTrustRoleId)),
      detail: "Run /trust user on a member in Discord, then pick a preset on the Trust Score page.",
    },
    {
      key: "invite", label: "Invite staff to the dashboard", href: `${b}/activity`,
      done: audit.some(e => e.userId !== viewerId),
      detail: "Anyone with Manage Server can sign in here. Their changes show up in Activity.",
    },
  ];
}

/**
 * Show the card while the server still looks new (no log channel, no automod
 * rules or no cases yet), some step is left, and nobody dismissed it.
 */
export function showGettingStarted(s: SettingsSnapshot | null | undefined, data: OverviewData, steps: readonly OnboardingStep[]): boolean {
  if (!s || s.guild.onboardingDismissed === true) return false;
  if (!steps.length || steps.every(st => st.done)) return false;
  const looksNew = !s.guild.loggingChannelId || enabledAutomodRules(s.automod).length === 0 || data.recentCases.length === 0;
  return looksNew;
}

/** The card. `canDismiss` is false when the data layer can't store the flag. */
export function gettingStartedCard(ctx: GuildContext, steps: readonly OnboardingStep[], canDismiss: boolean): string {
  const g = esc(ctx.guild.id);
  const done = steps.filter(st => st.done).length;
  const items = steps.map((st, i) => `<li class="${st.done ? "info" : "warn"}" data-step="${esc(st.key)}" data-done="${st.done ? "true" : "false"}">
        <span class="check-icon" aria-hidden="true">${st.done ? "✓" : i + 1}</span>
        <span><a class="text-link" href="${esc(st.href)}">${esc(st.label)}</a> ${st.done ? pill("Done", "ok") : pill("To do", "warn")}<br><span class="muted">${esc(st.detail)}</span></span>
      </li>`).join("");
  const dismiss = canDismiss
    ? `<form method="post" action="/dashboard/${g}/onboarding/dismiss" class="btn-row">${csrfField(ctx.viewer)}<button class="btn ghost sm" type="submit">Dismiss</button></form>`
    : "";
  return `<section class="panel-card getting-started" aria-labelledby="get-started-h" data-getting-started>
    <h2 id="get-started-h">Get started</h2>
    <p class="muted">${done} of ${steps.length} done. A few steps to get Aegis ready for this server.</p>
    <ul class="checklist">${items}</ul>
    ${dismiss}
  </section>`;
}

/** "Recent activity": the newest dashboard changes with a link to the full log. */
export function recentActivityCard(guildId: string, entries: readonly AuditEntry[] | null, max = 5): string {
  const g = esc(guildId);
  const list = (entries ?? []).slice(0, max);
  const body = entries === null
    ? `<p class="muted">Recent changes couldn't be loaded right now.</p>`
    : list.length
      ? `<ul class="feed">${list.map(e => `<li>${relTime(e.createdAt)} · <strong>${esc(e.username)}</strong>: ${esc(auditLabel(e.action))}${e.target ? ` <code class="inline">${esc(e.target)}</code>` : ""}</li>`).join("")}</ul>`
      : `<p class="muted">No dashboard changes yet. Saves, revokes, appeal decisions and posted panels show up here.</p>`;
  return `<section class="panel-card" aria-labelledby="recent-activity-h" data-recent-activity>
    <h2 id="recent-activity-h">Recent activity</h2>
    ${body}
    <p><a class="text-link" href="/dashboard/${g}/activity">All activity &rarr;</a></p>
  </section>`;
}
