/**
 * Boots the website with a stub Discord client and smoke-tests every route.
 * Not part of the build; run manually with `npx tsx scripts/smoke-web.ts`.
 */
import { startWebServer } from "../src/web/server";
import { loadCommands } from "../src/commands/loader";
import { PermissionFlagsBits } from "discord.js";
import type { Client } from "discord.js";
import { ROUTES, check, failures } from "./smoke-web-lib";
import { smokeLaterSections } from "./smoke-web-later";

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

async function main() {
  process.env.PORT = String(PORT);
  process.env.SITE_URL = origin;
  process.env.DISCORD_APPLICATION_ID = "1234567890";
  process.env.CONTACT_EMAIL = "legal@example.com";
  delete process.env.DISCORD_CLIENT_SECRET;
  delete process.env.DASHBOARD_SESSION_SECRET;

  await loadCommands();
  // No database in the smoke run; report it as connected so /health reads ok.
  startWebServer(fakeClient, { databaseReady: () => true });
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

  console.log("\nFeatures page");
  const featuresHtml = await (await fetch(origin + "/features")).text();
  for (const id of ["moderation", "automod", "incident", "trust", "community", "tickets", "dashboard", "reliability", "why"]) {
    check(`/features has #${id}`, featuresHtml.includes(`id="${id}"`));
  }
  check("/features links commands to /commands anchors", /href="\/commands#cmd-trust-user"/.test(featuresHtml));
  check("/features has no unlinked command refs", !/<li><code>\/[a-z]/.test(featuresHtml));
  check("/features has invite and dashboard CTAs", featuresHtml.includes('href="/invite"') && featuresHtml.includes('href="/dashboard"'));
  check("/features has no inline style or script", !/\sstyle=|<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)/.test(featuresHtml));

  console.log("\nRedesigned pages");
  const filtered = await fetch(origin + "/commands?q=ban&access=moderator");
  const filteredHtml = await filtered.text();
  check("/commands?q= filters server-side", filtered.status === 200 && /<input id="cmd-search" name="q" type="search" value="ban"/.test(filteredHtml)
    && /<details class="cmd-card" id="cmd-ban"[^>]*data-access="moderator"[^>]*>/.test(filteredHtml)
    && /<details class="cmd-card" id="cmd-ping"[^>]*\shidden>/.test(filteredHtml));
  check("/commands?q= escapes the query", !(await (await fetch(origin + "/commands?q=%3Cscript%3Ex")).text()).includes("<script>x"));
  const nf = await fetch(origin + "/no/such/%3Cb%3Epage");
  const nfHtml = await nf.text();
  check("404 shows the escaped path", nf.status === 404 && nfHtml.includes("nf-path") && !nfHtml.includes("<b>page"));
  const rdHomeHtml = await (await fetch(origin + "/")).text();
  check("home has the stats strip and latest release", rdHomeHtml.includes("stat-strip") && rdHomeHtml.includes('id="new-title"'));
  const rdDocsHtml = await (await fetch(origin + "/docs")).text();
  check("docs has the sticky TOC filter and start cards", rdDocsHtml.includes('id="toc-filter"') && rdDocsHtml.includes('class="doc-start"'));
  for (const [name, html] of [["/", rdHomeHtml], ["/commands?q=ban", filteredHtml], ["/docs", rdDocsHtml], ["404", nfHtml]] as const) {
    check(`${name} has no inline style or handler`, !/\sstyle="|\son[a-z]+="/.test(html));
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

  const statusRes = await fetch(origin + "/api/status");
  const statusText = await statusRes.text();
  const statusJson = JSON.parse(statusText);
  check("status api has components", Array.isArray(statusJson.components) && statusJson.components.length === 5);
  check("status api has history", statusJson.history?.day?.buckets?.length === 24 && statusJson.history?.week?.buckets?.length === 28);
  check("status api short public cache", (statusRes.headers.get("cache-control") ?? "").includes("max-age=15"));
  check("status api leaks no hosts or env", !/127\.0\.0\.1|localhost|mongodb|fly\.dev|MONGO|TOKEN|SECRET/i.test(statusText));

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
  check("no gradient text; blur only in the opt-in Glass theme", !/background-clip:\s*text/.test(cssText) && [...cssText.matchAll(/([^{}]*)\{[^{}]*backdrop-filter:\s*blur/g)].every(m => m[1].split(",").every(sel => sel.includes('[data-theme="glass"]'))));
  const init = await (await fetch(origin + "/assets/theme-init.js")).text();
  check("theme-init adds js class", init.includes("classList.add(\"js\")"));

  console.log("\nAccessibility");
  const commandsHtml = await (await fetch(origin + "/commands")).text();
  // Filters are links (they work without JavaScript); the active one carries aria-current.
  check("filters are labelled link navs", commandsHtml.includes('<nav class="tabs" id="cmd-filter" aria-label="Filter by category">'));
  check("active filter uses aria-current", /<a class="tab"[^>]*data-cat="all" aria-current="true"/.test(commandsHtml));
  check("no role=tablist", !commandsHtml.includes('role="tablist"'));
  check("no aria-selected on filters", !commandsHtml.includes("aria-selected"));
  check("per-command anchors exist", commandsHtml.includes('id="cmd-ban"'));
  check("deep link route documented", commandsHtml.includes("/api/commands/ban"));

  console.log("\nFeeds and metadata");
  const feed = await (await fetch(origin + "/changelog.xml")).text();
  check("atom feed is xml", feed.startsWith("<?xml") && feed.includes("<feed"));
  check("atom has entries", feed.includes("<entry>"));
  const clJsonRes = await fetch(origin + "/changelog.json");
  const clJson = await clJsonRes.json() as { bot?: Array<{ version: string }>; dashboard?: unknown[] };
  check("changelog.json lists bot and dashboard releases", clJson.bot?.[0]?.version === (await import("../src/version")).VERSION && Array.isArray(clJson.dashboard) && clJson.dashboard.length > 0);
  const statusHtml = await (await fetch(origin + "/status")).text();
  check("status page has components, latency chart and countdown", statusHtml.includes('data-component="gateway"') && statusHtml.includes("data-status-latency") && statusHtml.includes("data-status-countdown"));
  check("layout links feed", commandsHtml.includes('type="application/atom+xml"'));
  const sitemap = await (await fetch(origin + "/sitemap.xml")).text();
  check("sitemap has lastmod", sitemap.includes("<lastmod>"));
  check("home has JSON-LD", (await (await fetch(origin + "/")).text()).includes("application/ld+json"));

  await smokeLaterSections({ origin, csp, dashHtml, homeHtml, feed, sitemap });

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
