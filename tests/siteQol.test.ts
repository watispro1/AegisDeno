/**
 * Quality-of-life pass on the public site: the Ctrl/Cmd+K palette, the command
 * filters and pins, docs section links and the changelog filter. These tests
 * keep the markup hooks and the client features in step.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { loadCommands } from "../src/commands/loader";
import { clearCatalogCache } from "../src/web/catalog";
import { renderChangelog, renderCommands, renderDocs, type SiteConfig } from "../src/web/pages";
import { clientScript } from "../src/web/client";
import { styles } from "../src/web/theme";
import { VERSION } from "../src/version";

const cfg: SiteConfig = {
  inviteUrl: "/invite",
  supportUrl: "",
  version: VERSION,
  contactEmail: "",
  assetVersion: "t",
};

before(async () => {
  await loadCommands();
  clearCatalogCache();
});

test("search palette: fuzzy match, grouped results, recents and keyboard navigation", () => {
  assert.doesNotThrow(() => new Function(clientScript));
  for (const needle of [
    "fuzzyScore",
    "site-search-group",
    "Subcommands",
    "aegis-search-recent",
    "data-site-search-recent",
    "'ArrowUp'",
    "setActive",
    "aria-selected",
  ]) {
    assert.ok(clientScript.includes(needle), needle);
  }
  assert.ok(styles.includes(".site-search-result.is-active"), "active row style");
  assert.ok(styles.includes(".site-search-recent"), "recent chip style");
});

test("commands page: access filter, feature chips and per-command pins", () => {
  const html = renderCommands(cfg);
  assert.ok(html.includes('id="cmd-access"'), "access filter bar");
  for (const access of ["all", "everyone", "moderator", "admin"]) {
    assert.ok(html.includes(`data-access="${access}"`), access);
  }
  for (const flag of ["pinned", "subs", "autocomplete"]) {
    assert.ok(html.includes(`data-flag="${flag}"`), flag);
  }
  assert.match(html, /class="cmd-card"[^>]*data-access="(everyone|moderator|admin)"/);
  assert.match(html, /class="cmd-pin" type="button" data-pin="ban"/);
  assert.ok(styles.includes(".cmd-pin[aria-pressed=\"true\"]"), "pinned star style");
  assert.ok(clientScript.includes("aegis-command-pins"), "pins persist locally");
  assert.ok(clientScript.includes("url.searchParams.set('access'"), "access level is in the URL");
  assert.ok(clientScript.includes("url.searchParams.set('pinned'"), "pins filter is in the URL");
});

test("docs: copyable headings, section pager and inline command links", () => {
  const html = renderDocs(cfg);
  assert.match(html, /class="h-copy" type="button" data-copy-link="#quickstart"/);
  assert.ok(html.includes("data-doc-pager"), "pager markup");
  assert.ok(html.includes("data-doc-prev") && html.includes("data-doc-next"), "pager links");
  assert.match(html, /<a class="cmd-link" href="\/commands#cmd-[a-z-]+"><code(?: class="inline")?>\/[a-z-]+<\/code><\/a>/);
  assert.ok(!/class="cmd-link"[^>]*>\s*<a /.test(html), "no nested anchors around command links");
  assert.ok(styles.includes(".doc-pager-link"), "pager style");
  assert.ok(clientScript.includes("renderPager"), "pager follows the section in view");
});

test("changelog: release filter, latest badge and per-release copy link", () => {
  const html = renderChangelog(cfg);
  assert.ok(html.includes('id="cl-search"'), "search box");
  assert.ok(html.includes('id="cl-count"'), "live count");
  assert.ok(html.includes('id="cl-empty"'), "empty state");
  assert.match(html, /class="release" id="[^"]+" data-search="[^"]+"/);
  assert.ok(html.includes('class="release-latest"'), "newest release badge");
  assert.match(html, /class="release-copy" type="button" data-copy-link="#v[^"]+"/);
  assert.match(html, /<li data-release="v[^"]+">/);
  assert.ok(styles.includes(".release[hidden]"), "hidden releases stay hidden");
  assert.ok(clientScript.includes("applyChangelog"), "filter client");
});
