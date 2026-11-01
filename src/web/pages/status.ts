import { breadcrumb, escapeHtml, fmtUptime, page, type SiteConfig } from "./shared";
import type { ComponentState, HistoryWindow, OverallState, StatusPayload } from "../statusData";

/* ── Status ────────────────────────────────────────────────────────── */

const STATE_LABEL: Record<ComponentState, string> = { operational: "Operational", degraded: "Degraded", outage: "Outage", unknown: "Unknown" };
const OVERALL_CLASS: Record<OverallState, string> = { operational: "ok", degraded: "warn", major_outage: "bad", maintenance: "info" };

function pct(v: number | null): string {
  return v === null ? "No data" : `${(Math.floor(v * 10000) / 100).toFixed(2)}%`;
}

/** Level class for one uptime bar (CSS colours it; no inline styles under the CSP). */
export function barLevel(v: number | null): string {
  if (v === null) return "none";
  if (v >= 0.999) return "ok";
  if (v >= 0.95) return "warn";
  return "bad";
}

function when(iso: string): string {
  return `<time datetime="${escapeHtml(iso)}">${escapeHtml(iso.replace("T", " ").slice(0, 16))} UTC</time>`;
}

function history(id: string, w: HistoryWindow): string {
  const bars = w.buckets.map(b => {
    const label = `${b.start.replace("T", " ").slice(0, 16)}–${b.end.slice(11, 16)} UTC: ${pct(b.uptime)}`;
    return `<li class="ub ub-${barLevel(b.uptime)}" title="${escapeHtml(label)}"><span class="visually-hidden">${escapeHtml(label)}</span></li>`;
  }).join("");
  return `<section class="uptime-card" aria-labelledby="${id}-h">
      <div class="uptime-head"><h3 id="${id}-h">${escapeHtml(w.label)}</h3><strong data-status-uptime="${id}">${pct(w.uptime)}</strong></div>
      <ol class="uptime-bars" data-status-bars="${id}" aria-label="${escapeHtml(w.label)} uptime, oldest first">${bars}</ol>
      <div class="uptime-axis faint" aria-hidden="true"><span>${id === "day" ? "24h ago" : "7d ago"}</span><span>now</span></div>
    </section>`;
}

export function renderStatus(cfg: SiteConfig, s: StatusPayload): string {
  const metric = (key: string, label: string, value: string, hint: string) =>
    `<div class="metric"><span class="metric-label">${label}</span><strong class="metric-value" data-status-metric="${key}">${value}</strong><span class="faint">${hint}</span></div>`;
  const m = s.metrics;
  const notices = s.notices.length
    ? s.notices.map(n => `<li class="notice-item ${n.open ? "open" : "closed"} sev-${escapeHtml(n.severity)}">
          <div class="notice-top"><span class="tag">${n.kind === "maintenance" ? "Maintenance" : "Incident"}</span><strong>${escapeHtml(n.title)}</strong><span class="faint">${n.open ? "Ongoing" : "Resolved"}</span></div>
          ${n.body ? `<p>${escapeHtml(n.body)}</p>` : ""}
          <p class="faint">Started ${when(n.startsAt)}${n.endsAt ? ` · ${n.kind === "maintenance" ? "planned end" : "ended"} ${when(n.endsAt)}` : ""}${n.resolvedAt ? ` · resolved ${when(n.resolvedAt)}` : ""}</p>
        </li>`).join("")
    : `<li class="notice-item none"><p>No incidents or maintenance in the last 7 days.</p></li>`;

  const body = `
<div class="wrap status-page" data-status-page>
  ${breadcrumb("Status")}
  <div class="page-head">
    <h1>Aegis status</h1>
    <p class="lead">Live from the running bot. This page checks again every 30 seconds while it is open.</p>
  </div>

  <section class="status-banner ${OVERALL_CLASS[s.status]}" data-status-banner aria-live="polite">
    <span class="status-glyph" aria-hidden="true"></span>
    <div>
      <h2 data-status-headline>${escapeHtml(s.headline)}</h2>
      <p class="faint">Updated <span data-status-updated>${when(s.updatedAt)}</span></p>
    </div>
    <button class="btn ghost sm" type="button" data-status-refresh>Check again</button>
  </section>

  <h2>Components</h2>
  <ul class="components" data-status-components>
    ${s.components.map(c => `<li class="component" data-component="${escapeHtml(c.id)}">
      <span class="comp-name">${escapeHtml(c.name)}</span>
      <span class="comp-detail faint" data-component-detail>${escapeHtml(c.detail)}</span>
      <span class="state-pill st-${c.state}" data-component-state>${STATE_LABEL[c.state]}</span>
    </li>`).join("\n    ")}
  </ul>

  <h2>Live metrics</h2>
  <div class="metric-grid">
    ${metric("uptime", "Uptime", fmtUptime(m.uptimeSeconds * 1000), "since the last restart")}
    ${metric("ping", "WebSocket ping", `${m.pingMs} ms`, "gateway heartbeat")}
    ${metric("guilds", "Servers", m.guilds.toLocaleString("en-US"), "Aegis is in")}
    ${metric("shards", "Shards", String(m.shards), "gateway connections")}
    ${metric("memory", "Memory", `${m.memoryMb} MB`, "resident set")}
    ${metric("version", "Version", `v${escapeHtml(m.version)}`, `<a href="/changelog">changelog</a>`)}
    ${metric("deploy", "Last deploy", when(m.lastDeploy), "process start")}
    ${metric("commands", "Commands", String(m.commands), "slash commands")}
  </div>

  <h2>Uptime history</h2>
  <p class="muted">A bar is green when the gateway and database were both up for every check in it. Grey means no data (the bot was not running, or history is still filling in).</p>
  <div class="uptime-grid">${history("day", s.history.day)}${history("week", s.history.week)}</div>

  <h2>Incidents &amp; maintenance</h2>
  <ul class="notices" data-status-notices>${notices}</ul>

  <h2>For your monitoring</h2>
  <div class="table-wrap">
    <table class="endpoints">
      <tbody>
        <tr><td><a href="/api/status"><code class="inline">/api/status</code></a></td><td>Everything on this page as JSON.</td></tr>
        <tr><td><a href="/health"><code class="inline">/health</code></a></td><td>Up or down in one small response. Good for uptime checks.</td></tr>
        <tr><td><a href="/api/stats"><code class="inline">/api/stats</code></a></td><td>Server and command counts.</td></tr>
        <tr><td><a href="/changelog.xml"><code class="inline">/changelog.xml</code></a></td><td>Atom feed of releases.</td></tr>
      </tbody>
    </table>
  </div>
  <p class="faint" data-status-note>Values refresh every 30 seconds while this tab is open.</p>
</div>`;

  const v = cfg.assetVersion ? `?v=${encodeURIComponent(cfg.assetVersion)}` : "";
  return page(cfg, {
    title: "Status | Aegis",
    description: "Live status for the Aegis Discord bot: components, gateway latency, uptime history and incidents.",
    path: "/status",
    body,
    scripts: `<script src="/assets/status.js${v}" defer></script>`,
  });
}
