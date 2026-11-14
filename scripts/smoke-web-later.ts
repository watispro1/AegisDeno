/**
 * Later smoke-web.ts sections: security.txt, legal pages, 404 suggestions,
 * changelogs, social image, content integrity, client script, asset
 * versioning and gzip size. Same checks and order as before the split.
 */
import { ROUTES, check } from "./smoke-web-lib";

/** Values fetched earlier in the smoke run that these sections reuse. */
export interface SmokeShared { origin: string; csp: string; dashHtml: string; homeHtml: string; feed: string; sitemap: string }

export async function smokeLaterSections({ origin, csp, dashHtml, homeHtml, feed, sitemap }: SmokeShared): Promise<void> {
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
    check(`${name} last updated November 2, 2026`, html.includes("Last updated: <time datetime=\"2026-11-02\">November 2, 2026</time>"));
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

}
