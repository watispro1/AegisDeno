import { type SiteConfig, type Stats, breadcrumb, escapeHtml, fmtUptime, page, statusWord } from "./shared";

/* ── Status ────────────────────────────────────────────────────────── */

export function renderStatus(cfg: SiteConfig, stats: Stats, online: boolean, startedAt: number): string {
  const st = statusWord(stats.ping, online);
  const good = st.cls === "ok";
  const startedDate = new Date(startedAt);
  const startedISO = startedDate.toISOString();
  const startedFmt = startedDate.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
  });

  const tier = (min: number, max: number) => online && stats.ping > 0 && stats.ping >= min && stats.ping < max;
  const tiers: [string, string, boolean][] = [
    ["Operational", "under 150 ms", tier(0, 150)],
    ["Degraded", "150 to 350 ms", tier(150, 350)],
    ["Unstable", "350 ms or more", tier(350, Infinity)],
    ["Connecting", "no heartbeat yet", online && stats.ping === 0],
    ["Offline", "not connected to Discord", !online],
  ];

  const body = `
<div class="wrap">
  ${breadcrumb("Status")}
  <div class="page-head">
    <h1>Status</h1>
    <p class="lead">Read live from the running bot when the page loads, then every 30 seconds.</p>
  </div>

  <div class="status-line${good ? "" : " bad"}" data-status-banner>
    <span class="dot${good ? "" : " danger"}" data-status-dot aria-hidden="true"></span>
    <h2 data-status-title>${good ? "Everything is running" : escapeHtml(st.label)}</h2>
    <p data-status-description>${good
      ? "Connected to Discord and answering commands."
      : "Commands may be slow or failing. Numbers below are live."}</p>
    <button class="btn ghost sm" type="button" data-status-refresh-btn>Check again</button>
  </div>

  <h2>Numbers</h2>
  <div class="table-wrap">
    <table class="metrics">
      <tbody>
        <tr><td>State</td><td data-status-state>${escapeHtml(st.label)}</td><td class="faint">Derived from gateway latency</td></tr>
        <tr><td>Gateway latency</td><td class="${good ? "good" : "warn"}" data-live="ping" data-suffix=" ms">${stats.ping} ms</td><td class="faint">Discord WebSocket heartbeat round trip</td></tr>
        <tr><td>Uptime</td><td data-uptime-from="${stats.uptime}">${fmtUptime(stats.uptime)}</td><td class="faint">Since <time datetime="${startedISO}">${escapeHtml(startedFmt)}</time></td></tr>
        <tr><td>Servers</td><td data-live="guilds">${stats.guilds.toLocaleString()}</td><td class="faint">Servers the bot is in right now</td></tr>
        <tr><td>Cached members</td><td data-live="users">${stats.users.toLocaleString()}</td><td class="faint">Sum of member counts across those servers</td></tr>
        <tr><td>Commands</td><td data-live="commands">${stats.commands}</td><td class="faint">Registered slash commands</td></tr>
        <tr><td>Version</td><td>v${escapeHtml(cfg.version)}</td><td class="faint"><a href="/changelog">Changelog</a></td></tr>
      </tbody>
    </table>
  </div>

  <h2>What the states mean</h2>
  <div class="table-wrap">
    <table class="metrics">
      <thead><tr><th>State</th><th>Gateway latency</th></tr></thead>
      <tbody>
        ${tiers.map(([name, range, current]) => `<tr${current ? ` class="current"` : ""}><td>${name}${current ? ` <span class="tag">now</span>` : ""}</td><td>${range}</td></tr>`).join("\n        ")}
      </tbody>
    </table>
  </div>

  <h2>Endpoints</h2>
  <p class="muted">For your own monitoring. All return JSON except the feed.</p>
  <div class="table-wrap">
    <table class="endpoints">
      <tbody>
        <tr><td><a href="/health"><code class="inline">/health</code></a></td><td>Up or down, version, uptime, server count, latency. Good for uptime checks.</td></tr>
        <tr><td><a href="/api/stats"><code class="inline">/api/stats</code></a></td><td>The numbers on this page.</td></tr>
        <tr><td><a href="/api/commands"><code class="inline">/api/commands</code></a></td><td>The command catalog with options and permissions.</td></tr>
        <tr><td><a href="/changelog.xml"><code class="inline">/changelog.xml</code></a></td><td>Atom feed of releases.</td></tr>
      </tbody>
    </table>
  </div>

  <p class="faint"><span data-status-refreshed>Values refresh every 30 seconds while this tab is open.</span></p>
</div>`;

  return page(cfg, {
    title: "Status | Aegis",
    description: "Live status for the Aegis Discord bot: gateway latency, uptime and health endpoints.",
    path: "/status",
    body,
  });
}
