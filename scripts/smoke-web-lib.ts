/**
 * Shared pieces of scripts/smoke-web.ts: the route table and the PASS/FAIL
 * reporter, so the smoke run itself stays under the 400-line limit.
 */

export const ROUTES: [string, number][] = [
  ["/", 200],
  ["/features", 200],
  ["/why", 200],
  ["/commands", 200],
  ["/docs", 200],
  ["/troubleshooting", 200],
  ["/changelog", 200],
  ["/roadmap", 200],
  ["/dashboard/changelog", 200],
  ["/status", 200],
  ["/privacy", 200],
  ["/terms", 200],
  ["/security", 200],
  ["/.well-known/security.txt", 200],
  ["/dashboard", 200],
  ["/health", 200],
  ["/api/stats", 200],
  ["/api/commands", 200],
  ["/api/status", 200],
  ["/assets/status.js", 200],
  ["/badge/status.svg", 200],
  ["/badge/servers.svg", 200],
  ["/api/plugins", 404],
  ["/api/commands/ban", 200],
  ["/api/commands/timeout", 200],
  ["/api/commands/definitely-not-a-command", 404],
  ["/assets/site.css", 200],
  ["/assets/site.js", 200],
  ["/assets/theme-init.js", 200],
  ["/assets/dashboard.js", 200],
  ["/assets/favicon.svg", 200],
  ["/assets/og.svg", 200],
  ["/assets/og.png", 200],
  ["/manifest.webmanifest", 200],
  ["/robots.txt", 200],
  ["/sitemap.xml", 200],
  ["/changelog.xml", 200],
  ["/changelog.json", 200],
  ["/this-page-does-not-exist", 404],
];

export const failures: string[] = [];

export function check(label: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label} ${detail}`);
    failures.push(label);
  }
}
