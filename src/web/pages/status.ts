import { breadcrumb, escapeHtml, fmtUptime, page, type SiteConfig } from "./shared";
import type { ComponentState, HistoryWindow, OverallState, StatusPayload } from "../statusData";

/* Status */

const STATE_LABEL: Record<ComponentState, string> = { operational: "Operational", degraded: "Degraded", outage: "Outage", unknown: "Unknown" };
const OVERALL_CLASS: Record<OverallState, string> = { operational: "ok", degraded: "warn", major_outage: "bad", maintenance: "info" };

/** What each component covers, in plain words. Static copy; the live state and detail come from the payload. */
export const COMPONENT_ABOUT: Record<string, string> = {
  gateway: "The live connection to Discord that delivers messages, joins and slash commands to Aegis.",
  web: "This website, the public API and the moderator dashboard.",
  database: "Where server settings, cases, warnings and reminders are stored.",
  latency: "How long Discord takes to answer the bot's heartbeat. High values make commands feel slow.",
  commands: "Whether the slash commands were registered with Discord after the last restart.",
};

/** Seconds between automatic checks while the page is open (the client script uses the same value). */
export const STATUS_REFRESH_SECONDS = 30;

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

/** Level class for a latency reading, matching the thresholds of the latency component. */
export function pingLevel(ms: number | null): string {
  if (ms === null || ms <= 0) return "none";
  if (ms < 300) return "ok";
  if (ms < 1000) return "warn";
  return "bad";
}

/** "4 of 5 components operational" — the line under the headline. */
export function componentSummary(components: ReadonlyArray<{ state: ComponentState }>): string {
  const ok = components.filter(c => c.state === "operational").length;
  const total = components.length;
  if (ok === total) return `All ${total} components operational`;
  const bad = components.filter(c => c.state === "outage").length;
  const slow = components.filter(c => c.state === "degraded").length;
  const parts = [`${ok} of ${total} operational`];
  if (bad) parts.push(`${bad} down`);
  if (slow) parts.push(`${slow} degraded`);
  return parts.join(", ");
}

function when(iso: string): string {
  return `<time datetime="${escapeHtml(iso)}" data-local-time>${escapeHtml(iso.replace("T", " ").slice(0, 16))} UTC</time>`;
}

/** SVG bar chart of average heartbeat per bucket. Heights are SVG attributes, so the CSP needs no inline styles. */
export function latencyChart(w: HistoryWindow, id: string): string {
  const H = 48;
  const n = w.buckets.length || 1;
  const width = n * 10;
  const values = w.buckets.map(b => b.pingMs).filter((v): v is number => v !== null);
  const max = Math.max(300, ...values);
  const rects = w.buckets.map((b, i) => {
    const label = `${b.start.replace("T", " ").slice(0, 16)} UTC: ${b.pingMs === null ? "no data" : `${b.pingMs} ms average`}`;
    const h = b.pingMs === null ? 2 : Math.max(3, Math.round((b.pingMs / max) * H));
    return `<rect class="lb lb-${pingLevel(b.pingMs)}" x="${i * 10 + 1}" y="${H - h}" width="8" height="${h}" rx="1"><title>${escapeHtml(label)}</title></rect>`;
  }).join("");
  return `<svg class="latency-chart" data-status-latency="${id}" viewBox="0 0 ${width} ${H}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(`Average heartbeat per hour, ${w.label.toLowerCase()}`)}">${rects}</svg>`;
}

function history(id: string, w: HistoryWindow): string {
  const bars = w.buckets.map(b => {
    const label = `${b.start.replace("T", " ").slice(0, 16)}–${b.end.slice(11, 16)} UTC: ${pct(b.uptime)}`;
    return `<li class="ub ub-${barLevel(b.uptime)}" title="${escapeHtml(label)}"><span class="visually-hidden">${escapeHtml(label)}</span></li>`;
  }).join("");
  const span = id === "day" ? "each bar is 1 hour" : "each bar is 6 hours";
  return `<section class="uptime-card" aria-labelledby="${id}-h">
      <div class="uptime-head">
        <h3 id="${id}-h">${escapeHtml(w.label)}</h3>
        <strong class="uptime-pct" data-status-uptime="${id}">${pct(w.uptime)}</strong>
      </div>
      <ol class="uptime-bars" data-status-bars="${id}" aria-label="${escapeHtml(w.label)} uptime, oldest first">${bars}</ol>
      <div class="uptime-axis faint" aria-hidden="true"><span>${id === "day" ? "24h ago" : "7d ago"}</span><span>${span}</span><span>now</span></div>
    </section>`;
}

function notice(n: StatusPayload["notices"][number]): string {
  const kind = n.kind === "maintenance" ? "Maintenance" : "Incident";
  return `<li class="notice-item ${n.open ? "open" : "closed"} sev-${escapeHtml(n.severity)}">
          <div class="notice-top">
            <span class="tag">${kind}</span>
            <strong class="notice-title">${escapeHtml(n.title)}</strong>
            <span class="notice-state ${n.open ? "is-open" : "is-closed"}">${n.open ? (n.kind === "maintenance" ? "Scheduled" : "Ongoing") : "Resolved"}</span>
          </div>
          ${n.body ? `<p>${escapeHtml(n.body)}</p>` : ""}
          <p class="notice-times faint">Started ${when(n.startsAt)}${n.endsAt ? ` · ${n.kind === "maintenance" ? "planned end" : "ended"} ${when(n.endsAt)}` : ""}${n.resolvedAt ? ` · resolved ${when(n.resolvedAt)}` : ""}</p>
        </li>`;
}

function glyph(state: ComponentState | "ok" | "warn" | "bad" | "info"): string {
  // Simple shapes, so the state never relies on colour alone.
  const paths: Record<string, string> = {
    operational: `<path d="M5 10.5l3.2 3.2L15 7"/>`,
    ok: `<path d="M5 10.5l3.2 3.2L15 7"/>`,
    degraded: `<path d="M10 5.5v5.5"/><path d="M10 14.2v.3"/>`,
    warn: `<path d="M10 5.5v5.5"/><path d="M10 14.2v.3"/>`,
    outage: `<path d="M6.5 6.5l7 7M13.5 6.5l-7 7"/>`,
    bad: `<path d="M6.5 6.5l7 7M13.5 6.5l-7 7"/>`,
    info: `<path d="M10 9v5.5"/><path d="M10 5.8v.3"/>`,
    unknown: `<path d="M7.8 7.6a2.3 2.3 0 1 1 3 2.2c-.6.3-.8.7-.8 1.3"/><path d="M10 14.2v.3"/>`,
  };
  return `<svg class="st-icon" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[state]}</svg>`;
}

export function renderStatus(cfg: SiteConfig, s: StatusPayload): string {
  const metric = (key: string, label: string, value: string, hint: string) =>
    `<div class="metric"><span class="metric-label">${label}</span><strong class="metric-value" data-status-metric="${key}">${value}</strong><span class="metric-hint">${hint}</span></div>`;
  const m = s.metrics;
  const cls = OVERALL_CLASS[s.status];
  const open = s.notices.filter(n => n.open);
  const past = s.notices.filter(n => !n.open);
  const day = s.history.day;

  const body = `
<div class="wrap status-page" data-status-page data-refresh-seconds="${STATUS_REFRESH_SECONDS}">
  ${breadcrumb("Status")}
  <div class="page-head">
    <span class="eyebrow">System status</span>
    <h1>Aegis status</h1>
    <p class="lead">Live from the running bot: the Discord connection, the database and this website. Every number on this page is measured, not estimated.</p>
  </div>

  <section class="status-banner ${cls}" data-status-banner aria-labelledby="status-headline">
    <div class="st-hero-main">
      <span class="status-glyph" data-status-glyph aria-hidden="true">${glyph(cls as "ok")}</span>
      <div class="st-hero-text">
        <h2 id="status-headline" data-status-headline aria-live="polite">${escapeHtml(s.headline)}</h2>
        <p class="st-summary" data-status-summary>${escapeHtml(componentSummary(s.components))} · v${escapeHtml(m.version)}</p>
      </div>
    </div>
    <div class="st-hero-side">
      <p class="st-checked">Checked <span data-status-updated>${when(s.updatedAt)}</span> <span class="st-ago" data-status-ago></span></p>
      <div class="st-refresh" data-js-only>
        <progress class="st-progress" data-status-progress max="${STATUS_REFRESH_SECONDS}" value="${STATUS_REFRESH_SECONDS}" aria-hidden="true"></progress>
        <span class="st-countdown" data-status-countdown>Checks every ${STATUS_REFRESH_SECONDS} seconds</span>
      </div>
      <div class="st-actions">
        <button class="btn ghost sm" type="button" data-status-refresh>Check now</button>
        <button class="btn ghost sm" type="button" data-status-pause aria-pressed="false" data-js-only>Pause</button>
      </div>
    </div>
  </section>
  <p class="st-stale" data-status-stale role="alert" hidden>Could not reach the status API on the last check. The values below are from the last successful check; retrying automatically.</p>

  ${open.length ? `<section class="st-section" aria-labelledby="active-h">
    <h2 id="active-h">Active incidents &amp; maintenance</h2>
    <ul class="notices notices-active">${open.map(notice).join("")}</ul>
  </section>` : ""}

  <section class="st-section" aria-labelledby="components-h">
    <div class="st-section-head">
      <h2 id="components-h">Components</h2>
      <ul class="st-legend" aria-label="Legend">
        <li><span class="state-pill st-operational">${glyph("operational")}Operational</span></li>
        <li><span class="state-pill st-degraded">${glyph("degraded")}Degraded</span></li>
        <li><span class="state-pill st-outage">${glyph("outage")}Outage</span></li>
        <li><span class="state-pill st-unknown">${glyph("unknown")}Unknown</span></li>
      </ul>
    </div>
    <ul class="components" data-status-components>
      ${s.components.map(c => `<li class="component is-${c.state}" data-component="${escapeHtml(c.id)}">
        <div class="comp-top">
          <h3 class="comp-name">${escapeHtml(c.name)}</h3>
          <span class="state-pill st-${c.state}" data-component-state>${glyph(c.state)}<span data-component-label>${STATE_LABEL[c.state]}</span></span>
        </div>
        <p class="comp-detail" data-component-detail>${escapeHtml(c.detail)}</p>
        ${COMPONENT_ABOUT[c.id] ? `<p class="comp-about">${escapeHtml(COMPONENT_ABOUT[c.id])}</p>` : ""}
      </li>`).join("\n      ")}
    </ul>
  </section>

  <section class="st-section" aria-labelledby="latency-h">
    <h2 id="latency-h">Gateway latency</h2>
    <div class="latency-card">
      <div class="latency-now">
        <span class="metric-label">Right now</span>
        <strong class="latency-value lv-${pingLevel(m.pingMs)}" data-status-ping>${m.pingMs > 0 ? `${m.pingMs} ms` : "No reading"}</strong>
        <span class="metric-hint">heartbeat round trip</span>
      </div>
      <div class="latency-now">
        <span class="metric-label">24-hour average</span>
        <strong class="latency-value" data-status-ping-avg="day">${day.pingMs === null ? "No data" : `${day.pingMs} ms`}</strong>
        <span class="metric-hint">7 days: <span data-status-ping-avg="week">${s.history.week.pingMs === null ? "no data" : `${s.history.week.pingMs} ms`}</span></span>
      </div>
      <figure class="latency-figure">
        ${latencyChart(day, "day")}
        <figcaption class="uptime-axis faint"><span>24h ago</span><span>hourly average · under 300 ms is healthy</span><span>now</span></figcaption>
      </figure>
    </div>
  </section>

  <section class="st-section" aria-labelledby="history-h">
    <h2 id="history-h">Uptime history</h2>
    <p class="muted st-explain">A bar is green when the gateway and database were both up for every check in it, amber below 99.9%, red below 95%. Grey means no data: the bot was not running, or history is still filling in.</p>
    <div class="uptime-grid">${history("day", s.history.day)}${history("week", s.history.week)}</div>
    <ul class="ub-legend faint" aria-hidden="true">
      <li><span class="ub ub-ok"></span>Fully up</li>
      <li><span class="ub ub-warn"></span>Some failed checks</li>
      <li><span class="ub ub-bad"></span>Mostly down</li>
      <li><span class="ub ub-none"></span>No data</li>
    </ul>
  </section>

  <section class="st-section" aria-labelledby="metrics-h">
    <h2 id="metrics-h">Live metrics</h2>
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
  </section>

  <section class="st-section" aria-labelledby="notices-h">
    <h2 id="notices-h">Past incidents &amp; maintenance</h2>
    <ul class="notices" data-status-notices>${past.length ? past.map(notice).join("") : `<li class="notice-item none"><p>${open.length ? "Nothing else in the last 7 days." : "No incidents or maintenance in the last 7 days."}</p></li>`}</ul>
  </section>

  <section class="st-section" aria-labelledby="monitoring-h">
    <h2 id="monitoring-h">For your monitoring</h2>
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
    <p class="faint" data-status-note>Times are shown in UTC until the page script loads, then in your local time. Values refresh every ${STATUS_REFRESH_SECONDS} seconds while this tab is open.</p>
  </section>
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
