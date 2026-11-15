/**
 * Shields-style SVG badges built from the public status payload:
 * /badge/status.svg (overall state) and /badge/servers.svg (server count).
 * The SVG is pure and escaped, so it is unit-tested without a server; the
 * routes cache the payload briefly so a README full of badges can't make
 * every request rebuild it.
 */
import type { Express, Request, Response } from "express";
import type { OverallState, StatusPayload } from "./statusData";

/** How long a built badge is reused, in the process and by browsers and proxies. */
export const BADGE_CACHE_SECONDS = 60;

const COLORS = {
  label: "#555",
  ok: "#2ea043",
  warn: "#d29922",
  bad: "#cf222e",
  info: "#0969da",
  idle: "#9f9f9f",
} as const;

const STATE_BADGE: Record<OverallState, { text: string; color: string }> = {
  operational: { text: "operational", color: COLORS.ok },
  degraded: { text: "degraded", color: COLORS.warn },
  major_outage: { text: "major outage", color: COLORS.bad },
  maintenance: { text: "maintenance", color: COLORS.info },
};

function xml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Approximate rendered width of 11px Verdana, the font shields-style badges use. */
export function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += /[ilj.,:;'|!]/.test(ch) ? 3.5 : /[mwMW@]/.test(ch) ? 10 : /[A-Z0-9]/.test(ch) ? 7.5 : 6.5;
  return Math.ceil(w);
}

/** A two-part flat badge: grey label on the left, coloured message on the right. */
export function badgeSvg(label: string, message: string, color: string): string {
  const safeColor = /^#[0-9a-f]{3,6}$/i.test(color) ? color : COLORS.idle;
  const lw = textWidth(label) + 12;
  const mw = textWidth(message) + 12;
  const w = lw + mw;
  const title = xml(`${label}: ${message}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${title}"><title>${title}</title>` +
    `<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>` +
    `<clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>` +
    `<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="${COLORS.label}"/><rect x="${lw}" width="${mw}" height="20" fill="${safeColor}"/><rect width="${w}" height="20" fill="url(#s)"/></g>` +
    `<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">` +
    `<text x="${lw / 2}" y="14">${xml(label)}</text><text x="${lw + mw / 2}" y="14">${xml(message)}</text></g></svg>`;
}

export function statusBadge(p: Pick<StatusPayload, "status">): string {
  const b = STATE_BADGE[p.status] ?? { text: "unknown", color: COLORS.idle };
  return badgeSvg("aegis", b.text, b.color);
}

export function serversBadge(p: { metrics: Pick<StatusPayload["metrics"], "guilds"> }): string {
  const n = Math.max(0, Math.round(p.metrics.guilds || 0));
  return badgeSvg("servers", n.toLocaleString("en-US"), COLORS.info);
}

/** Badge paths, for the status page's copy-paste snippets. */
export const BADGES = [
  { path: "/badge/status.svg", alt: "Aegis status", what: "Overall status: operational, degraded, major outage or maintenance." },
  { path: "/badge/servers.svg", alt: "Aegis servers", what: "How many servers Aegis is in right now." },
] as const;

/** Memoises `load` for `ttlMs`; a failed load is not cached. */
export function cached<T>(load: () => Promise<T>, ttlMs: number, now: () => number = Date.now): () => Promise<T> {
  let value: { at: number; v: T } | null = null;
  return async () => {
    if (value && now() - value.at < ttlMs) return value.v;
    const v = await load();
    value = { at: now(), v };
    return v;
  };
}

export function registerBadgeRoutes(app: Express, statusPayload: () => Promise<StatusPayload>): void {
  const payload = cached(statusPayload, BADGE_CACHE_SECONDS * 1000);
  const send = (render: (p: StatusPayload) => string) => async (_req: Request, res: Response) => {
    let svg: string;
    try {
      svg = render(await payload());
    } catch {
      svg = badgeSvg("aegis", "unknown", COLORS.idle);
    }
    res.setHeader("Cache-Control", `public, max-age=${BADGE_CACHE_SECONDS}, stale-while-revalidate=${BADGE_CACHE_SECONDS * 5}`);
    res.setHeader("X-Robots-Tag", "noindex");
    res.type("image/svg+xml").send(svg);
  };
  app.get("/badge/status.svg", send(statusBadge));
  app.get("/badge/servers.svg", send(serversBadge));
}
