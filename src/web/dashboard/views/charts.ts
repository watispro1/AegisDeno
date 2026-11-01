/**
 * Plain SVG charts for the dashboard: no scripts, no CDN, no inline styles.
 * Colours come from CSS classes in theme/dashboardApp.ts, so they follow the
 * light and dark themes. Every chart has a text alternative.
 */
import { escapeHtml as esc } from "../../pages";

/** Daily bars (one per value), with first/last day under the chart. */
export function barChart(values: readonly number[], days: readonly string[], label: string, cls = "bar"): string {
  const w = 300, h = 100;
  const max = Math.max(1, ...values);
  const step = w / Math.max(1, values.length);
  const bars = values.map((v, i) => {
    const bh = v === 0 ? 2 : Math.max(3, (v / max) * (h - 4));
    return `<rect class="${cls}${v === 0 ? " zero" : ""}" x="${(i * step + step * 0.12).toFixed(2)}" y="${(h - bh).toFixed(2)}" width="${(step * 0.76).toFixed(2)}" height="${bh.toFixed(2)}"><title>${esc(days[i] ?? "")}: ${v}</title></rect>`;
  }).join("");
  const total = values.reduce((a, b) => a + b, 0);
  return `<figure class="chart">
    <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}: ${total} in total, at most ${max === 1 && total === 0 ? 0 : max} on one day" preserveAspectRatio="none">${bars}</svg>
    <figcaption><span>${esc(days[0] ?? "")}</span><span>${total.toLocaleString("en-US")} total</span><span>${esc(days[days.length - 1] ?? "")}</span></figcaption>
  </figure>`;
}

/** Two series as lines (joins vs leaves), with a legend. */
export function lineChart(a: { label: string; values: readonly number[]; cls: string }, b: { label: string; values: readonly number[]; cls: string }, days: readonly string[], label: string): string {
  const w = 300, h = 100;
  const max = Math.max(1, ...a.values, ...b.values);
  const pts = (vals: readonly number[]) => vals.map((v, i) => `${((i / Math.max(1, vals.length - 1)) * w).toFixed(1)},${(h - 3 - (v / max) * (h - 8)).toFixed(1)}`).join(" ");
  const sum = (vals: readonly number[]) => vals.reduce((x, y) => x + y, 0);
  return `<figure class="chart line-chart">
    <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}: ${esc(a.label)} ${sum(a.values)}, ${esc(b.label)} ${sum(b.values)}" preserveAspectRatio="none">
      <polyline class="line ${esc(a.cls)}" points="${pts(a.values)}" fill="none" vector-effect="non-scaling-stroke"/>
      <polyline class="line ${esc(b.cls)}" points="${pts(b.values)}" fill="none" vector-effect="non-scaling-stroke"/>
    </svg>
    <figcaption><span>${esc(days[0] ?? "")}</span><span class="legend"><span class="key ${esc(a.cls)}"></span>${esc(a.label)} ${sum(a.values)} · <span class="key ${esc(b.cls)}"></span>${esc(b.label)} ${sum(b.values)}</span><span>${esc(days[days.length - 1] ?? "")}</span></figcaption>
  </figure>`;
}

/** Horizontal bars for a ranking (cases by type or moderator), as an accessible list. */
export function rankBars(rows: ReadonlyArray<[string, number]>, label: (key: string) => string, empty: string): string {
  if (!rows.length) return `<p class="muted">${esc(empty)}</p>`;
  const max = Math.max(1, ...rows.map(r => r[1]));
  return `<ul class="rank-bars">${rows.map(([k, n]) => {
    const pct = Math.round((n / max) * 100);
    return `<li><span class="rank-label">${label(k)}</span><svg class="rank-svg" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect class="rank-fill" x="0" y="0" width="${pct}" height="8"/></svg><span class="rank-n">${n.toLocaleString("en-US")}</span></li>`;
  }).join("")}</ul>`;
}
