import { test } from "node:test";
import assert from "node:assert/strict";
import { editDistance, normalisePath, suggestPages } from "../src/web/notFound";
import { securityTxt } from "../src/web/wellKnown";
import { renderNotFound, renderPrivacy, renderSecurity, renderTerms, LEGAL_LAST_UPDATED, type SiteConfig } from "../src/web/pages";
import { layout } from "../src/web/layout";
import { DASHBOARD_VERSION, VERSION } from "../src/version";

const cfg: SiteConfig = { inviteUrl: "https://discord.com/oauth2/authorize?client_id=1", supportUrl: "", version: VERSION, contactEmail: "", assetVersion: "t" };
const PAGES = [
  { href: "/features", label: "Features" },
  { href: "/commands", label: "Commands" },
  { href: "/docs", label: "Docs" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/security", label: "Security" },
];

test("editDistance counts single edits and stops early past the cap", () => {
  assert.equal(editDistance("commands", "commands"), 0);
  assert.equal(editDistance("/comands", "/commands"), 1);
  assert.equal(editDistance("/docz", "/docs"), 1);
  assert.ok(editDistance("/a-very-long-path", "/docs", 3) > 3);
});

test("normalisePath strips query, hash, trailing slash and .html", () => {
  assert.equal(normalisePath("/Commands/?q=1#x"), "/commands");
  assert.equal(normalisePath("/privacy.html"), "/privacy");
  assert.equal(normalisePath("terms"), "/terms");
});

test("suggestPages offers near-miss pages, parent pages and commands", () => {
  assert.deepEqual(suggestPages("/comands", PAGES, []).map(s => s.href), ["/commands"]);
  assert.deepEqual(suggestPages("/privacy-polcy.html", PAGES, []).map(s => s.href), []);
  assert.ok(suggestPages("/docs/automod", PAGES, []).some(s => s.href === "/docs"));
  assert.ok(suggestPages("/ban", PAGES, ["ban", "kick"]).some(s => s.href === "/commands#cmd-ban"));
  assert.deepEqual(suggestPages("/totally-unrelated-thing", PAGES, ["ban"]), []);
  assert.ok(suggestPages("/" + "x".repeat(500), PAGES, []).length === 0, "long paths are not scored");
  assert.ok(suggestPages("/feature", PAGES, []).length <= 3);
});

test("404 page renders suggestions escaped, a command search form and no canonical", () => {
  const html = renderNotFound(cfg, [{ href: "/commands", label: "Commands <b>" }]);
  assert.ok(html.includes('class="suggest"'));
  assert.ok(html.includes('href="/commands">Commands &lt;b&gt;</a>'));
  assert.ok(html.includes('action="/commands" method="get"'));
  assert.ok(html.includes('name="q"'));
  assert.ok(!html.includes('rel="canonical"'));
  assert.ok(html.includes('content="noindex'));
  assert.ok(!renderNotFound(cfg).includes('class="suggest"'), "no suggestion paragraph when there is nothing to suggest");
});

test("security.txt has RFC 9116 Contact and a future Expires", () => {
  const now = Date.UTC(2026, 9, 30);
  const txt = securityTxt("https://aegis.example", now);
  assert.match(txt, /^Contact: https:\/\/github\.com\/watispro1\/AegisDeno\/security\/advisories\/new$/m);
  const expires = txt.match(/^Expires: (.+)$/m);
  assert.ok(expires);
  const when = Date.parse(expires[1]);
  assert.ok(when > now && when - now < 366 * 86_400_000, "expires within a year");
  assert.match(txt, /^Canonical: https:\/\/aegis\.example\/\.well-known\/security\.txt$/m);
  assert.ok(!securityTxt("", now).includes("Canonical:"));
});

test("terms and privacy share the last-updated date and table of contents", () => {
  assert.equal(LEGAL_LAST_UPDATED, "October 30, 2026");
  for (const html of [renderTerms(cfg), renderPrivacy(cfg)]) {
    assert.ok(html.includes(`Last updated: <time datetime="2026-10-30">October 30, 2026</time>`));
    assert.ok(html.includes('class="toc"') && html.includes('class="toc-mobile"'));
    assert.ok(html.includes('id="contact"'));
    assert.ok(html.includes("/issues"), "GitHub issues as a contact route");
    assert.ok(html.includes('href="/security"'));
    assert.ok(!html.includes("aegisdeno.fly.dev\">") && !html.includes("support@aegisdeno.fly.dev"), "no invented inbox");
    assert.ok(!html.includes("mailto:"), "no email link unless CONTACT_EMAIL is set");
  }
  const withEmail = renderPrivacy({ ...cfg, contactEmail: "privacy@example.com" });
  assert.ok(withEmail.includes('mailto:privacy@example.com'));
});

test("privacy policy matches what the code stores", () => {
  const html = renderPrivacy(cfg);
  for (const fact of [
    "<code class=\"inline\">identify</code>", "<code class=\"inline\">guilds</code>",
    "aegis_dash", "aegis_oauth", "10 minutes", "7 days", "180 days", "SHA-256",
    "one year", "first 200 characters", "anonymous polls", "Aegis does not keep a copy",
    "Fly.io", "MongoDB", "Top.gg", "13 in most countries", "does not delete",
  ]) {
    assert.ok(html.includes(fact), fact);
  }
  assert.ok(!/deleted on removal|we do not keep a separate copy/i.test(html), "old inaccurate claims are gone");
});

test("security page names the supported versions and private reporting", () => {
  const html = renderSecurity(cfg);
  assert.ok(html.includes(`bot ${VERSION}`) && html.includes(`dashboard ${DASHBOARD_VERSION}`));
  assert.ok(html.includes("Report a vulnerability"));
  assert.ok(html.includes("/.well-known/security.txt"));
});

test("footer links legal pages, security, the source and the release notes", () => {
  const html = layout({ title: "t", description: "d", path: "/", body: "", inviteUrl: "#", supportUrl: "", version: "9.9.9" });
  for (const href of ["/terms", "/privacy", "/security", "https://github.com/watispro1/AegisDeno", "https://github.com/watispro1/AegisDeno/issues", "/changelog#v9.9.9", "/dashboard/changelog"]) {
    assert.ok(html.includes(`href="${href}"`), href);
  }
});
