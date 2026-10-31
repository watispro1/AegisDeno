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
  ["/troubleshooting", 200],
  ["/changelog", 200],
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
  delete process.env.DISCORD_CLIENT_SECRET;
  delete process.env.DASHBOARD_SESSION_SECRET;

  await loadCommands();
  startWebServer(fakeClient);
  await new Promise(r => setTimeout(r, 400));

  console.log("\nRoutes");
  const saysUnreleased: string[] = [];
  for (const [path, expected] of ROUTES) {
    const res = await fetch(origin + path);
    check(`${path} -> ${expected}`, res.status === expected, `got ${res.status}`);
    if (/unreleased/i.test(await res.text())) saysUnreleased.push(path);
  }
  for (const path of ["/changelog.xml", "/dashboard/changelog"]) {
    if (/unreleased/i.test(await (await fetch(origin + path)).text())) saysUnreleased.push(path);
  }
  check("no rendered page says Unreleased", saysUnreleased.length === 0, saysUnreleased.join(", "));

  console.log("\nRedirects");
  for (const [path, target] of [
    ["/guide", "/docs"],
    ["/playground", "/features"],
    ["/terms-of-service", "/terms"],
    ["/privacy-policy", "/privacy"],
    ["/status.json", "/health"],
    ["/command", "/commands"],
    ["/commands/ban", "/commands#cmd-ban"],
    ["/add", "/invite"],
  ] as [string, string][]) {
    const res = await fetch(origin + path, { redirect: "manual" });
    check(`${path} -> ${target}`, res.headers.get("location") === target, `got ${res.headers.get("location")}`);
  }

  console.log("\nInvite");
  const inviteHomeHtml = await (await fetch(origin + "/")).text();
  const hrefs = Array.from(inviteHomeHtml.matchAll(/href="(https:\/\/discord\.com\/oauth2\/authorize[^"]*)"/g)).map(m => m[1].replace(/&amp;/g, "&"));
  check("home has an https invite link", hrefs.length > 0);
  check("no discord:// links on the home page", !inviteHomeHtml.includes("discord://"));
  for (const href of new Set(hrefs)) {
    const u = new URL(href);
    check(`invite link ${href}`, u.searchParams.get("client_id") === "1234567890"
      && u.searchParams.get("scope") === "bot applications.commands"
      && u.searchParams.get("integration_type") === "0"
      && /^\d+$/.test(u.searchParams.get("permissions") ?? "")
      && href.includes("scope=bot%20applications.commands"));
  }
  const inv = await fetch(origin + "/invite", { redirect: "manual" });
  check("/invite -> 302 Discord authorize", inv.status === 302 && (inv.headers.get("location") ?? "").startsWith("https://discord.com/oauth2/authorize?"), `${inv.status} ${inv.headers.get("location")}`);
  const invG = await fetch(origin + "/invite?guild_id=100000000000000001", { redirect: "manual" });
  const invGLoc = new URL(invG.headers.get("location") ?? "http://x");
  check("/invite?guild_id preselects the server", invGLoc.searchParams.get("guild_id") === "100000000000000001" && invGLoc.searchParams.get("disable_guild_select") === "true");
  const invBad = await fetch(origin + "/invite?guild_id=javascript:alert(1)", { redirect: "manual" });
  check("/invite ignores a bad guild_id", !(invBad.headers.get("location") ?? "").includes("guild_id"));

  console.log("\nDashboard (no env)");
  // DISCORD_CLIENT_SECRET and DASHBOARD_SESSION_SECRET are not set here.
  const dash = await fetch(origin + "/dashboard", { redirect: "manual" });
  const dashHtml = await dash.text();
  check("/dashboard 200 when not configured", dash.status === 200, String(dash.status));
  check("/dashboard says not configured", dashHtml.includes("not configured"));
  check("/dashboard no-store", dash.headers.get("cache-control") === "no-store", dash.headers.get("cache-control") ?? "");
  check("/dashboard noindex", (dash.headers.get("x-robots-tag") ?? "").includes("noindex"));
  check("/dashboard sets no cookie", dash.headers.get("set-cookie") === null);
  check("/dashboard has no login link", !dashHtml.includes("/dashboard/login"));
  const dashLogin = await fetch(origin + "/dashboard/login", { redirect: "manual" });
  check("/dashboard/login does not redirect to Discord", dashLogin.status === 200 && !(dashLogin.headers.get("location") ?? "").includes("discord.com"));
  const dashPost = await fetch(origin + "/dashboard/logout", { method: "POST" });
  check("dashboard POST 503 when not configured", dashPost.status === 503, String(dashPost.status));
  const dashJs = await (await fetch(origin + "/assets/dashboard.js")).text();
  let dashJsParses = true;
  try {
    // eslint-disable-next-line no-new-func
    new Function(dashJs);
  } catch {
    dashJsParses = false;
  }
  check("dashboard.js parses", dashJsParses);
  check("dashboard.js has the app shell helpers", ["data-drawer-toggle", "data-unsaved-bar", "data-confirm-dialog", "data-embed-builder", "data-filter-target"].every(k => dashJs.includes(k)));
  check("dashboard.js never uses eval or innerHTML", !/\beval\(|innerHTML/.test(dashJs));
  const siteCss = await (await fetch(origin + "/assets/site.css")).text();
  check("site.css styles the dashboard sidebar and embed preview", siteCss.includes(".app-side") && siteCss.includes(".embed-preview") && siteCss.includes(".unsaved-bar"));
  for (const path of ["/dashboard/800000000000000001/autoresponders", "/dashboard/800000000000000001/giveaways", "/dashboard/800000000000000001/announce"]) {
    const page = await fetch(origin + path, { redirect: "manual" });
    check(`${path} answers not configured without dashboard env`, page.status === 200 && (await page.text()).includes("not configured"), String(page.status));
  }
  check("robots disallows /dashboard", (await (await fetch(origin + "/robots.txt")).text()).includes("Disallow: /dashboard"));

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
  check("CSP has no unsafe-inline", !csp.includes("unsafe-inline"), csp);
  check("CSP blocks framing and plugins", csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'") && csp.includes("base-uri 'none'"));
  check("Referrer-Policy", home.headers.get("referrer-policy") === "strict-origin-when-cross-origin");
  check("Permissions-Policy", (home.headers.get("permissions-policy") ?? "").includes("camera=()"));
  check("COOP same-origin", home.headers.get("cross-origin-opener-policy") === "same-origin");
  check("CORP same-origin on pages", home.headers.get("cross-origin-resource-policy") === "same-origin");
  const dashHeaders = await fetch(origin + "/dashboard");
  check("dashboard has the same CSP", dashHeaders.headers.get("content-security-policy") === csp);
  const sneaky = await fetch(origin + "/commands/%2F%2Fevil.example", { redirect: "manual" });
  check("command redirect stays on site", (sneaky.headers.get("location") ?? "").startsWith("/commands"), sneaky.headers.get("location") ?? "");
  const bigBody = await fetch(origin + "/api/topgg/webhook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ x: "y".repeat(700 * 1024) }) });
  check("oversized request refused", bigBody.status === 413, String(bigBody.status));
  const badJson = await fetch(origin + "/api/topgg/webhook", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "x" }, body: "{not json" });
  const badText = await badJson.text();
  check("bad JSON gets no stack trace", !badText.includes("at ") && !badText.includes("SyntaxError"), badText.slice(0, 120));

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

  console.log("\nAPI Endpoints");
  const healthJson = await (await fetch(origin + "/health")).json();
  check("health returns status: ok", healthJson.status === "ok", healthJson.status);
  check("health returns valid guilds count", typeof healthJson.guilds === "number");

  const statsJson = await apiStats.clone().json();
  check("stats returns online: true", statsJson.online === true);
  check("stats returns valid ping", typeof statsJson.ping === "number");
  check("stats omits runtime internals", !("nodeVersion" in statsJson) && !("memoryMb" in statsJson) && !("startedAt" in statsJson));

  const commandsJson = await (await fetch(origin + "/api/commands")).json();
  check("commands api returns array", Array.isArray(commandsJson.commands));


  const oversizedWebhook = await fetch(origin + "/api/topgg/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: "x".repeat(20 * 1024) }),
  });
  check("webhook rejects oversized payload", oversizedWebhook.status === 413, String(oversizedWebhook.status));

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
  check("no hidden-until-scroll content", !/\.reveal\b/.test(cssText));
  check("no gradient text or blur effects", !/background-clip:\s*text|backdrop-filter/.test(cssText));
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

  console.log("\nSecurity, legal and 404");
  const secTxtRes = await fetch(origin + "/.well-known/security.txt");
  const secTxt = await secTxtRes.text();
  check("security.txt is text/plain", (secTxtRes.headers.get("content-type") ?? "").startsWith("text/plain"));
  check("security.txt has Contact", /^Contact: https:\/\//m.test(secTxt));
  const expiresMatch = secTxt.match(/^Expires: (.+)$/m);
  check("security.txt Expires is in the future", Boolean(expiresMatch) && Date.parse(expiresMatch![1]) > Date.now());
  const secRedirect = await fetch(origin + "/security.txt", { redirect: "manual" });
  check("/security.txt -> /.well-known/security.txt", secRedirect.headers.get("location") === "/.well-known/security.txt");
  check("sitemap lists /security", sitemap.includes("/security</loc>"));
  check("footer links /security", homeHtml.includes('href="/security"'));
  const termsHtml = await (await fetch(origin + "/terms")).text();
  const privacyHtml = await (await fetch(origin + "/privacy")).text();
  for (const [name, html] of [["terms", termsHtml], ["privacy", privacyHtml]] as [string, string][]) {
    check(`${name} last updated October 30, 2026`, html.includes("Last updated: <time datetime=\"2026-10-30\">October 30, 2026</time>"));
    check(`${name} uses CONTACT_EMAIL when set`, html.includes("mailto:legal@example.com"));
    check(`${name} has no invented fly.dev inbox`, !html.includes("support@aegisdeno.fly.dev"));
  }
  check("privacy lists the dashboard audit retention", privacyHtml.includes("180 days"));
  const typo = await fetch(origin + "/comands");
  const typoHtml = await typo.text();
  check("404 suggests /commands for /comands", typo.status === 404 && /class="suggest"[^]*href="\/commands"/.test(typoHtml));
  const cmdTypo = await (await fetch(origin + "/ban")).text();
  check("404 suggests the command for /ban", cmdTypo.includes('href="/commands#cmd-ban"'));
  check("404 has a command search form", typoHtml.includes('action="/commands" method="get"'));
  const reflected = await (await fetch(origin + "/%3Cscript%3Ealert(1)%3C%2Fscript%3E")).text();
  check("404 does not reflect the path", !reflected.includes("<script>alert(1)"));
  check("/commands?q= serves the page", (await fetch(origin + "/commands?q=ban")).status === 200);


  const { VERSION } = await import("../src/version");
  const { getChangelog, getReleases } = await import("../src/web/changelog");
  const releases = getReleases();
  check("CHANGELOG.md parsed", releases.length > 5, `${releases.length} releases`);
  check("newest release matches src/version.ts", releases[0]?.version === VERSION, `${releases[0]?.version} vs ${VERSION}`);
  check("every release has sections", releases.every(r => r.sections.length > 0 && r.sections.every(sec => sec.items.length > 0)));
  check("releases are newest first", releases.every((r, i) => i === 0 || (r.date ?? "") <= (releases[i - 1].date ?? "")));
  const changelogHtml = await (await fetch(origin + "/changelog")).text();
  check("/changelog shows every version", getChangelog().releases.every(r => changelogHtml.includes(`id="${r.id}"`)));
  check("/changelog shows the v3.6.0 release", changelogHtml.includes('id="v3.6.0"'));
  check("/changelog has no Unreleased section", !changelogHtml.includes('id="unreleased"') && !changelogHtml.includes("Not released yet"));
  check("/changelog renders inline code", changelogHtml.includes('<code class="inline">/remindme set</code>'));
  const dashLog = await fetch(origin + "/dashboard/changelog");
  const dashLogHtml = await dashLog.text();
  check("/dashboard/changelog 200 without dashboard config", dashLog.status === 200, String(dashLog.status));
  check("/dashboard/changelog is not the not-configured page", !dashLogHtml.includes("The dashboard is not configured") && dashLogHtml.includes("<h1>Dashboard changelog</h1>"));
  check("/dashboard/changelog shows the v1.2.1 and v1.2.0 releases", dashLogHtml.includes('id="v1.2.1"') && dashLogHtml.includes(">v1.2.1<") && dashLogHtml.includes('id="v1.2.0"'));
  check("/dashboard/changelog has no Unreleased section", !dashLogHtml.includes('id="unreleased"') && !dashLogHtml.includes("Not released yet"));
  check("/dashboard/changelog renders nested lists", /<li>[^<]*<strong>Settings<\/strong>[\s\S]*?<ul><li>Logging:/.test(dashLogHtml));
  check("/dashboard/changelog sets no cookie", dashLog.headers.get("set-cookie") === null);
  check("/dashboard/changelog is indexable", !(dashLog.headers.get("x-robots-tag") ?? "").includes("noindex") && !dashLogHtml.includes('content="noindex'));
  check("/dashboard/changelog is publicly cacheable", (dashLog.headers.get("cache-control") ?? "").startsWith("public"));
  check("/changelog links the dashboard changelog", changelogHtml.includes('href="/dashboard/changelog"'));
  check("/dashboard links the dashboard changelog", dashHtml.includes('href="/dashboard/changelog"'));
  const robots = await (await fetch(origin + "/robots.txt")).text();
  check("robots allows /dashboard/changelog", robots.includes("Allow: /dashboard/changelog"));
  check("sitemap lists /dashboard/changelog", sitemap.includes("/dashboard/changelog</loc>"));
  check("/changelog has no raw markdown", !/\]\(|\*\*|^- /m.test(changelogHtml.replace(/<pre[\s\S]*?<\/pre>/g, "")));
  check("atom has one entry per release", (feed.match(/<entry>/g) ?? []).length === releases.length);

  console.log("\nSocial image and fonts");
  const png = await fetch(origin + "/assets/og.png");
  const pngBytes = new Uint8Array(await png.arrayBuffer());
  check("og.png is a PNG", png.headers.get("content-type") === "image/png" && pngBytes[1] === 0x50 && pngBytes[2] === 0x4e);
  check("pages point og:image at the PNG", homeHtml.includes('og:image" content="') && homeHtml.includes("/assets/og.png"));
  check("no third-party font requests", !homeHtml.includes("fonts.googleapis.com") && !csp.includes("googleapis"));
  const docsHtml = await (await fetch(origin + "/docs")).text();
  check("docs has self-hosting section", docsHtml.includes('id="self-hosting"'));

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
