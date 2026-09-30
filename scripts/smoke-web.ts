/**
 * Boots the website with a stub Discord client and smoke-tests every route.
 * Not part of the build; run manually with `npx tsx scripts/smoke-web.ts`.
 */
import { startWebServer } from "../src/web/server";
import { loadCommands } from "../src/commands/loader";
import { PermissionFlagsBits } from "discord.js";
import type { Client } from "discord.js";

const PORT = Number(process.env.SMOKE_PORT) || 4321;
const origin = `http://127.0.0.1:${PORT}`;

const fakeGuild = {
  memberCount: 1284,
};

const fakeClient = {
  isReady: () => true,
  guilds: { cache: new Map([["g1", fakeGuild]]) },
  ws: { ping: 42 },
  uptime: 3_723_000,
} as unknown as Client;

const ROUTES: [string, number][] = [
  ["/", 200],
  ["/features", 200],
  ["/commands", 200],
  ["/docs", 200],
  ["/changelog", 200],
  ["/status", 200],
  ["/privacy", 200],
  ["/terms", 200],
  ["/health", 200],
  ["/api/stats", 200],
  ["/api/commands", 200],
  ["/api/commands/ban", 200],
  ["/api/commands/timeout", 200],
  ["/api/commands/definitely-not-a-command", 404],
  ["/assets/site.css", 200],
  ["/assets/site.js", 200],
  ["/assets/theme-init.js", 200],
  ["/assets/favicon.svg", 200],
  ["/assets/og.svg", 200],
  ["/manifest.webmanifest", 200],
  ["/robots.txt", 200],
  ["/sitemap.xml", 200],
  ["/changelog.xml", 200],
  ["/this-page-does-not-exist", 404],
];

const failures: string[] = [];

function check(label: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label} ${detail}`);
    failures.push(label);
  }
}

async function main() {
  process.env.PORT = String(PORT);
  process.env.SITE_URL = origin;
  process.env.DISCORD_APPLICATION_ID = "1234567890";
  process.env.CONTACT_EMAIL = "legal@example.com";

  await loadCommands();
  startWebServer(fakeClient);
  await new Promise(r => setTimeout(r, 400));

  console.log("\nRoutes");
  for (const [path, expected] of ROUTES) {
    const res = await fetch(origin + path);
    check(`${path} -> ${expected}`, res.status === expected, `got ${res.status}`);
  }

  console.log("\nRedirects");
  for (const [path, target] of [
    ["/guide", "/docs"],
    ["/terms-of-service", "/terms"],
    ["/privacy-policy", "/privacy"],
    ["/status.json", "/health"],
    ["/command", "/commands"],
    ["/commands/ban", "/commands#cmd-ban"],
  ] as [string, string][]) {
    const res = await fetch(origin + path, { redirect: "manual" });
    check(`${path} -> ${target}`, res.headers.get("location") === target, `got ${res.headers.get("location")}`);
  }

  console.log("\nSecurity headers");
  const home = await fetch(origin + "/", { headers: { "Accept-Encoding": "gzip" } });
  const csp = home.headers.get("content-security-policy") ?? "";
  check("CSP present", csp.includes("script-src 'self'"));
  check("no inline script allowance for scripts", !csp.includes("script-src 'self' 'unsafe-inline'"));
  check("HSTS present", (home.headers.get("strict-transport-security") ?? "").includes("max-age="));
  check("nosniff", home.headers.get("x-content-type-options") === "nosniff");
  check("frame deny", home.headers.get("x-frame-options") === "DENY");
  check("gzip applied", home.headers.get("content-encoding") === "gzip", home.headers.get("content-encoding") ?? "none");
  check("Vary set", (home.headers.get("vary") ?? "").includes("Accept-Encoding"));
  check("no x-powered-by", home.headers.get("x-powered-by") === null);

  console.log("\nCache policy");
  const liveHome = await fetch(origin + "/");
  check("live page no-cache", liveHome.headers.get("cache-control") === "no-cache", liveHome.headers.get("cache-control") ?? "");
  const statusPage = await fetch(origin + "/status");
  check("status no-cache", statusPage.headers.get("cache-control") === "no-cache");
  const staticPage = await fetch(origin + "/docs");
  check("static page cached", (staticPage.headers.get("cache-control") ?? "").includes("max-age=300"));
  const notFound = await fetch(origin + "/nope");
  check("404 no-store", notFound.headers.get("cache-control") === "no-store", notFound.headers.get("cache-control") ?? "");
  const css = await fetch(origin + "/assets/site.css");
  check("asset immutable", (css.headers.get("cache-control") ?? "").includes("immutable"));
  const apiStats = await fetch(origin + "/api/stats");
  check("api stats no-store", apiStats.headers.get("cache-control") === "no-store");

  console.log("\nInvite permissions");
  const { botPermissionBitfield } = await import("../src/web/catalog");
  const bits = botPermissionBitfield();
  check("Administrator not requested", (bits & PermissionFlagsBits.Administrator) === 0n);
  check("BanMembers requested", (bits & PermissionFlagsBits.BanMembers) !== 0n);
  check("ModerateMembers requested", (bits & PermissionFlagsBits.ModerateMembers) !== 0n);
  check("SendMessages requested", (bits & PermissionFlagsBits.SendMessages) !== 0n);
  const homeHtml = await (await fetch(origin + "/")).text();
  check("invite URL uses computed bitfield", homeHtml.includes(`permissions=${bits.toString()}`));
  check("no stale permissions=8", !homeHtml.includes("permissions=8&"));
  check("no 'never requires Administrator' claim", !homeHtml.includes("never requires Administrator"));

  console.log("\nNo-JS safety");
  const cssText = await (await fetch(origin + "/assets/site.css")).text();
  check("reveal gated on .js", /\.js \.reveal\s*\{/.test(cssText));
  check(
    "no ungated .reveal opacity:0",
    !/^\s*\.reveal\s*\{\s*opacity:\s*0/m.test(cssText)
  );
  const init = await (await fetch(origin + "/assets/theme-init.js")).text();
  check("theme-init adds js class", init.includes("classList.add(\"js\")"));

  console.log("\nAccessibility");
  const commandsHtml = await (await fetch(origin + "/commands")).text();
  check("filters use role=group", commandsHtml.includes('role="group"'));
  check("filters use aria-pressed", commandsHtml.includes('aria-pressed="true"'));
  check("no role=tablist", !commandsHtml.includes('role="tablist"'));
  check("no aria-selected on filters", !commandsHtml.includes("aria-selected"));
  check("per-command anchors exist", commandsHtml.includes('id="cmd-ban"'));
  check("deep link route documented", commandsHtml.includes("/api/commands/ban"));

  console.log("\nFeeds and metadata");
  const feed = await (await fetch(origin + "/changelog.xml")).text();
  check("atom feed is xml", feed.startsWith("<?xml") && feed.includes("<feed"));
  check("atom has entries", feed.includes("<entry>"));
  check("layout links feed", commandsHtml.includes('type="application/atom+xml"'));
  const sitemap = await (await fetch(origin + "/sitemap.xml")).text();
  check("sitemap has lastmod", sitemap.includes("<lastmod>"));
  check("home has JSON-LD", (await (await fetch(origin + "/")).text()).includes("application/ld+json"));

  console.log("\nContent integrity");
  const markupRoutes = ROUTES.filter(
    ([p]) => !p.startsWith("/assets/") && !p.endsWith(".xml") && !p.endsWith(".txt")
  );
  for (const [path] of markupRoutes) {
    const body = await (await fetch(origin + path)).text();
    check(`${path} clean`, !/undefined|NaN|\$\{/.test(body));
  }

  console.log("\nClient script");
  const clientText = await (await fetch(origin + "/assets/site.js")).text();
  let clientParses = true;
  try {
    // eslint-disable-next-line no-new-func
    new Function(clientText);
  } catch {
    clientParses = false;
  }
  check("site.js parses", clientParses);
  check("site.js uses aria-pressed", clientText.includes("aria-pressed"));
  check("site.js has no feature-tab dead code", !clientText.includes("data-tabgroup"));
  check("site.js no inline interpolation", !clientText.includes("${"));

  console.log("\nAsset versioning");
  const homeWithVersion = await (await fetch(origin + "/")).text();
  check("stylesheet is versioned", /\/assets\/site\.css\?v=[0-9a-f]{8}/.test(homeWithVersion));
  check("client script is versioned", /\/assets\/site\.js\?v=[0-9a-f]{8}/.test(homeWithVersion));
  check("theme-init is versioned", /\/assets\/theme-init\.js\?v=[0-9a-f]{8}/.test(homeWithVersion));
  check("versioned assets still served", (await fetch(`${origin}/assets/site.css?v=deadbeef`)).status === 200);

  console.log("\nGzip transfer size");
  const gz = await fetch(origin + "/commands", { headers: { "Accept-Encoding": "gzip" } });
  const raw = await fetch(origin + "/commands");
  console.log(
    `  /commands  raw ${(await raw.clone().text()).length} bytes  gzip ${gz.headers.get("content-length")} bytes`
  );

  console.log(
    failures.length === 0
      ? "\nAll checks passed."
      : `\n${failures.length} check(s) failed:\n${failures.map(f => `  - ${f}`).join("\n")}`
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
