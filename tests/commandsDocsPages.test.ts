/**
 * /commands and /docs are generated from the command definitions; these tests
 * keep the pages, their anchors and their examples in step with the code.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { loadCommands, commands } from "../src/commands/loader";
import { buildCatalog, botPermissionRows, clearCatalogCache } from "../src/web/catalog";
import { renderCommands, renderDocs, commandAnchor, docAnchors, DOC_GROUPS, SUBCOMMAND_CHECKS, type SiteConfig } from "../src/web/pages";
import { CURATED_EXAMPLES, checkExample, choiceKeyword, examplesFor, generatedExamples, parseExample } from "../src/web/commandExamples";
import { clientScript } from "../src/web/client";
import { styles } from "../src/web/theme";
import { VERSION } from "../src/version";

const cfg: SiteConfig = { inviteUrl: "https://discord.com/oauth2/authorize?client_id=1", supportUrl: "", version: VERSION, contactEmail: "", assetVersion: "t" };

before(async () => {
  await loadCommands();
  clearCatalogCache();
});

function ids(html: string): string[] {
  return [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
}

test("commands page: one card per registered command, one anchor per subcommand, ids unique", () => {
  const html = renderCommands(cfg);
  const catalog = buildCatalog();
  assert.equal(catalog.length, commands.size);
  assert.equal((html.match(/<details class="cmd-card"/g) ?? []).length, catalog.length);
  for (const cmd of catalog) {
    assert.ok(html.includes(`id="${commandAnchor(cmd.name)}"`), `/${cmd.name} card`);
    for (const sub of cmd.subcommands) {
      assert.ok(html.includes(`id="${commandAnchor(cmd.name, sub.path)}"`), `/${cmd.name} ${sub.path} anchor`);
    }
  }
  assert.equal(commandAnchor("automod", "words add"), "cmd-automod-words-add");
  const all = ids(html);
  assert.deepEqual(all.filter((id, i) => all.indexOf(id) !== i), [], "no duplicate ids");
});

test("commands page shows options, permissions, cooldown and copy-link from the definitions", () => {
  const html = renderCommands(cfg);
  const ban = html.slice(html.indexOf('id="cmd-ban"'), html.indexOf("</details>", html.indexOf('id="cmd-ban"')));
  assert.match(ban, /<dt>Who can run it<\/dt><dd><strong>Ban Members<\/strong>/);
  assert.match(ban, /<dt>Aegis needs<\/dt><dd>Ban Members/);
  assert.match(ban, /<dt>Cooldown<\/dt><dd>1\.5s per member/);
  assert.match(ban, /data-copy-link="#cmd-ban"/);
  assert.match(ban, /<code>user<\/code><\/td>\s*<td>user<\/td>\s*<td><span class="opt-req">yes/);
  assert.match(ban, /From 0 to 7\./, "numeric range from the definition");
  assert.match(ban, /Suggests values as you type\./, "autocomplete from the definition");
  const ar = html.slice(html.indexOf('id="cmd-autoresponder"'));
  assert.match(ar, /Up to 100 characters\./, "max length from the definition");
  // Subcommand groups get their own heading and blocks.
  assert.match(html, /<code>\/automod words add<\/code>/);
  assert.match(html, /Manage Server/);
  assert.ok(!html.includes("Manage Guild"), "Discord's UI name is used");
});

test("commands page keeps CSP and phone rules: no inline script or style, 16px search, 44px targets", () => {
  const html = renderCommands(cfg);
  assert.ok(!/<script(?![^>]*type="application\/ld\+json")[^>]*>[^<]+<\/script>/.test(html), "no inline executable script");
  assert.ok(!/\sstyle="/.test(html), "no inline styles");
  assert.ok(!/\son[a-z]+="/.test(html), "no inline handlers");
  assert.match(html, /id="cmd-empty" class="empty-state" hidden/);
  assert.match(html, /data-cmd-clear/);
  assert.match(html, /aria-describedby="cmd-keys"/);
  assert.ok(/@media \(max-width: 860px\), \(pointer: coarse\) \{\s*\.search input/.test(styles));
  assert.ok(/\.cmd-sticky \{[^}]*position: sticky/.test(styles));
  assert.ok(/\.examples code \{[^}]*overflow-wrap: anywhere/.test(styles), "long examples wrap instead of widening the page");
  assert.ok(/\.cmd-facts \{[^}]*minmax\(min\(12rem, 100%\), 1fr\)/.test(styles), "facts grid fits 360px");
  assert.ok(/\.linklike \{[^}]*min-height: 44px/.test(styles));
});

test("client script: keyboard navigation, copy-link, did-you-mean, expand all, subcommand deep links", () => {
  assert.doesNotThrow(() => new Function(clientScript));
  for (const needle of ["'Enter'", "'ArrowDown'", "'ArrowUp'", "data-copy-link", "cmd-didyoumean", "cmd-expand", "hashchange", "searchParams.set('q'"]) {
    assert.ok(clientScript.includes(needle), needle);
  }
});

test("examples: every hand-written example matches the live definitions", () => {
  const catalog = buildCatalog();
  for (const [name, list] of Object.entries(CURATED_EXAMPLES)) {
    assert.ok(catalog.some(c => c.name === name), `curated examples for unknown /${name}`);
    for (const e of list) assert.equal(checkExample(e, catalog), null, e);
  }
  for (const cmd of catalog) {
    for (const e of generatedExamples(cmd)) assert.equal(checkExample(e, catalog), null, e);
    assert.ok(examplesFor(cmd, catalog).length > 0, `/${cmd.name} has examples`);
  }
});

test("examples: the checker catches drift", () => {
  const catalog = buildCatalog();
  assert.match(checkExample("/nope", catalog)!, /no command/);
  assert.match(checkExample("/automod words zap word:x", catalog)!, /no subcommand/);
  assert.match(checkExample("/ban reason:x", catalog)!, /missing required option "user"/);
  assert.match(checkExample("/ban user:@m colour:red", catalog)!, /no option/);
  assert.match(checkExample("/modstats period:Last 2 years", catalog)!, /not a choice/);
  assert.equal(choiceKeyword("🟡 Low — Minor infraction"), "Low");
  assert.equal(choiceKeyword("📅 Last 24 Hours"), "Last 24 Hours");
  assert.deepEqual(parseExample("/automod words add word:free nitro"), { command: "automod", path: "words add", options: [["word", "free nitro"]] });
});

test("docs: every table-of-contents entry has exactly one heading, and old links still land", () => {
  const html = renderDocs(cfg);
  const all = ids(html);
  for (const id of docAnchors()) {
    assert.equal(all.filter(x => x === id).length, 1, `#${id}`);
    assert.ok(html.includes(`href="#${id}"`), `TOC links #${id}`);
  }
  for (const legacy of ["quickstart", "moderation", "automod", "trustscore", "appeal", "watchlist", "modreport", "logging", "tickets", "verification", "community", "automation", "configuration", "permissions", "self-hosting", "data"]) {
    assert.ok(all.includes(legacy), `#${legacy} kept for existing links`);
  }
  assert.deepEqual(all.filter((id, i) => all.indexOf(id) !== i), [], "no duplicate ids");
  assert.deepEqual(DOC_GROUPS.map(g => g.title), ["Getting started", "Guides", "Reference", "Help"]);
  assert.match(html, /<details class="toc-mobile">/, "collapsible table of contents on phones");
  assert.match(html, /class="h-anchor" href="#hidden-channels"/, "headings carry copyable links");
});

test("docs copy matches the code: hidden channels, permissions, subcommand checks", () => {
  const html = renderDocs(cfg);
  const catalog = buildCatalog();
  assert.match(html, /CHANNEL_OBFUSCATED/);
  assert.match(html, /a real channel that happens to be called <code>___hidden___<\/code> is treated normally/);
  assert.match(html, /View Channel/);
  assert.ok(!html.includes("id:12 "), "suggestion IDs are UUIDs");
  assert.ok(!/Warn, timeout, kick and ban each/.test(html), "warn does not ask for confirmation");
  for (const row of SUBCOMMAND_CHECKS) {
    const m = row.command.match(/^\/(\S+)\s+(.+?)(?:\s*\(.*\))?$/)!;
    const cmd = catalog.find(c => c.name === m[1]);
    assert.ok(cmd, row.command);
    for (const sub of m[2].split(",").map(s => s.trim())) {
      assert.ok(cmd.subcommands.some(s => s.path === sub), `${row.command}: ${sub}`);
    }
  }
  const botRows = botPermissionRows();
  assert.ok(!botRows.some(r => r.permission === "Administrator"));
  assert.ok(botRows.some(r => r.permission === "View Channel"));
  for (const r of botRows) assert.ok(html.includes(`<strong>${r.permission}</strong>`), r.permission);
  for (const [cmd, sub] of [["clearwarnings", ""], ["case", "delete"], ["escalation", "clear"], ["warnings", ""]]) {
    assert.ok(html.includes(`/${cmd}${sub ? ` ${sub}` : ""}`), `docs mention /${cmd} ${sub}`);
  }
});
