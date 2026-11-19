/**
 * Overview building blocks: the case table (shared with Cases), the setup
 * checklist, the 30-day chart and the Common settings strip.
 */
import { escapeHtml as esc } from "../../pages";
import type { CaseRecord, OverviewData } from "../data";
import { type GuildContext, copyId, person, personId, relTime } from "./layout";
import { enabledAutomodRules } from "../../../services/automod";
import { type ModuleState, type OverviewModel, moduleStates } from "./overviewModules";

/* Overview */

function actionBadgeClass(action: string): string {
  const act = action.toLowerCase();
  if (act.includes("softban")) return "tag softban";
  if (act.includes("ban")) return "tag ban";
  if (act.includes("kick")) return "tag kick";
  if (act.includes("timeout") || act.includes("untimeout")) return "tag timeout";
  if (act.includes("warn")) return "tag warning";
  if (act.includes("note")) return "tag note";
  if (act.includes("unban")) return "tag ok";
  return "tag";
}

function caseRows(ctx: GuildContext, cases: CaseRecord[]): string {
  const g = esc(ctx.guild.id);
  return cases
    .map(c => `<tr>
      <td data-label="When">${relTime(c.createdAt)}</td>
      <td data-label="Action"><a class="case-link" href="/dashboard/${g}/cases/${esc(c.id)}"><span class="${actionBadgeClass(c.action)}">${esc(c.action)}</span></a>${c.revoked ? ' <span class="tag warn">revoked</span>' : ""} ${copyId(c.id, "Copy case ID")}</td>
      <td data-label="Member">${personId(ctx, c.userId)}</td>
      <td data-label="Moderator">${person(ctx, c.moderatorId)}</td>
      <td data-label="Reason">${esc(c.reason.length > 120 ? c.reason.slice(0, 117) + "…" : c.reason)}</td>
    </tr>`)
    .join("");
}

export function caseTable(ctx: GuildContext, cases: CaseRecord[], caption: string): string {
  return `<div class="table-wrap"><table class="case-table">
    <caption class="visually-hidden">${esc(caption)}</caption>
    <thead><tr><th scope="col">When</th><th scope="col">Action</th><th scope="col">Member</th><th scope="col">Moderator</th><th scope="col">Reason</th></tr></thead>
    <tbody>${caseRows(ctx, cases)}</tbody>
  </table></div>`;
}

export interface CheckItem { level: "warn" | "info"; text: string; href?: string }

/** The /diagnostics-style setup checklist. */
export function setupChecklist(guildId: string, m: OverviewModel): CheckItem[] {
  const items: CheckItem[] = [];
  const b = `/dashboard/${guildId}`;
  const s = m.snapshot;
  const hidden = m.hidden ?? new Set<string>();
  if (m.missingBotPermissions?.length) {
    items.push({ level: "warn", text: `Aegis's role is missing ${m.missingBotPermissions.join(", ")}. Some modules will fail until it is given in Server Settings → Roles.` });
  }
  if (s) {
    const configured: Array<[string | null | undefined, string, string]> = [
      [s.guild.loggingChannelId, "log channel", `${b}/settings/logging`],
      [s.guild.welcomeChannelId, "welcome channel", `${b}/settings/welcome`],
      [s.guild.goodbyeChannelId, "goodbye channel", `${b}/settings/goodbye`],
      [s.guild.suggestionsChannelId, "suggestions channel", `${b}/suggestions`],
      [s.tickets.logChannelId, "ticket transcript channel", `${b}/settings/tickets`],
      [s.starboard.channelId, "starboard channel", `${b}/settings/starboard`],
      [s.verification?.channelId, "verification panel channel", `${b}/settings/verification`],
      ...Object.entries(s.guild.logChannels ?? {}).map(([k, id]) => [id, `log channel for ${k}`, `${b}/settings/logging`] as [string, string, string]),
    ];
    for (const [id, what, href] of configured) {
      if (id && hidden.has(id)) items.push({ level: "warn", text: `Aegis can't see the ${what}. Give Aegis View Channel there, or pick another channel.`, href });
    }
    if (!s.guild.loggingEnabled || !s.guild.loggingChannelId) items.push({ level: "info", text: "Logging is off. Pick a log channel so moderation actions are recorded.", href: `${b}/settings/logging` });
    if (!enabledAutomodRules(s.automod).length) items.push({ level: "info", text: "No automod rules are on.", href: `${b}/settings/automod` });
  }
  if (hidden.size > 0) {
    items.push({ level: "info", text: `${hidden.size} channel${hidden.size === 1 ? " is" : "s are"} hidden from Aegis. From 2026-11-16 Discord hides channels a bot can't view (View Channel); Aegis skips them and never posts there. Give Aegis View Channel in any it should use.` });
  }
  return items;
}

export function checklistHtml(items: CheckItem[]): string {
  if (!items.length) return `<p class="check-ok">✓ Everything Aegis checks looks good.</p>`;
  return `<ul class="checklist">${items.map(i => `<li class="${i.level}"><span class="check-icon" aria-hidden="true">${i.level === "warn" ? "!" : "i"}</span><span>${esc(i.text)}${i.href ? ` <a href="${esc(i.href)}">Fix</a>` : ""}</span></li>`).join("")}</ul>`;
}

/** A 30-day bar chart as plain SVG (no scripts, no external libraries). */
export function casesChart(series: number[], endMs: number): string {
  const max = Math.max(1, ...series);
  const w = 600, h = 140, gap = 2, bw = (w - gap * (series.length - 1)) / series.length;
  const day = (i: number) => new Date(Math.floor(endMs / 86_400_000) * 86_400_000 - (series.length - 1 - i) * 86_400_000).toISOString().slice(0, 10);
  const total = series.reduce((a, n) => a + n, 0);
  const bars = series.map((n, i) => {
    const bh = n === 0 ? 1 : Math.max(3, Math.round((n / max) * (h - 10)));
    return `<rect class="bar${n === 0 ? " zero" : ""}" x="${(i * (bw + gap)).toFixed(1)}" y="${h - bh}" width="${bw.toFixed(1)}" height="${bh}"><title>${day(i)}: ${n} case${n === 1 ? "" : "s"}</title></rect>`;
  }).join("");
  return `<figure class="chart">
    <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Cases and warnings per day for the last 30 days, ${total} in total, at most ${max} on one day" preserveAspectRatio="none">${bars}</svg>
    <figcaption><span>${esc(day(0))}</span><span>${total.toLocaleString("en-US")} in 30 days · peak ${max.toLocaleString("en-US")}/day</span><span>today</span></figcaption>
  </figure>`;
}

/** The settings people open most, one tap from the overview, each with its current state. */
const QUICK_KEYS = ["automod", "logging", "moderation", "welcome", "verification", "tickets", "appeals", "incident"] as const;

export function quickSettings(guildId: string, data: OverviewData, model: OverviewModel): string {
  const base = `/dashboard/${esc(guildId)}`;
  const byKey = new Map(moduleStates(guildId, data, model).map(st => [st.key, st]));
  const tiles = QUICK_KEYS.map(k => byKey.get(k)).filter((st): st is ModuleState => Boolean(st));
  const body = tiles.length
    ? `<ul class="quick-settings">${tiles.map(st => {
        const state = st.on === null ? "ready" : st.on ? "on" : "off";
        const word = st.on === null ? "Ready" : st.on ? "On" : "Off";
        return `<li><a class="quick-tile" href="${esc(st.href)}"><span class="quick-label">${esc(st.label)}</span><span class="quick-state" data-state="${state}"><span class="quick-dot" aria-hidden="true"></span>${word}</span>${st.detail ? `<span class="quick-detail">${esc(st.detail)}</span>` : ""}</a></li>`;
      }).join("")}</ul>`
    : `<div class="btn-row">
      <a class="btn ghost sm" href="${base}/cases">View Recent Cases</a>
      <a class="btn ghost sm" href="${base}/settings/automod">Automod Rules</a>
      <a class="btn ghost sm" href="${base}/settings/logging">Configure Logging</a>
      <a class="btn ghost sm" href="${base}/incident">Incident Mode</a>
    </div>`;
  return `<section class="panel-card quick-card" aria-labelledby="quick-actions-h">
    <div class="quick-head"><h2 id="quick-actions-h">Common settings</h2><a class="text-link" href="${base}/settings">All settings &rarr;</a></div>
    ${body}
  </section>`;
}

