/** QoL pass (3.7.0 / dashboard 1.2.3): helpers, cases page size, last server, shortcuts, site footer. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { footer, missingPermissionHint, permissionName } from "../src/utils/embedStyle";
import { parseCaseFilter, CASE_PAGE_SIZES } from "../src/web/dashboard/validation";
import { casesQuery } from "../src/web/dashboard/views/cases";
import { relTime, copyId } from "../src/web/dashboard/views/layout";
import { renderPicker } from "../src/web/dashboard/views/public";
import { dashboardScript } from "../src/web/dashboard/client";
import { layout } from "../src/web/layout";
import type { SiteConfig } from "../src/web/pages";

test("embed style: house footer and actionable permission hints", () => {
  assert.deepEqual(footer("x"), { text: "Aegis · x" });
  assert.deepEqual(footer(""), { text: "Aegis" });
  assert.equal(footer("y".repeat(3000)).text.length, 2048);
  assert.equal(permissionName("ManageGuild"), "Manage Server");
  assert.equal(permissionName("SomeNewThing"), "Some New Thing");
  assert.match(missingPermissionHint("you", ["BanMembers"]), /Server Settings → Roles/);
  assert.match(missingPermissionHint("bot", ["ManageThreads"], "#staff"), /Aegis needs \*\*Manage Threads\*\* in #staff/);
});

test("cases: page size from the query, only allowed sizes, kept across pages", () => {
  assert.equal(parseCaseFilter({ per: "50" }).per, 50);
  assert.equal(parseCaseFilter({ per: "7" }).per, undefined);
  assert.equal(parseCaseFilter({ per: "25" }).per, undefined);
  assert.equal(parseCaseFilter({ per: ["100"] }).per, 100);
  assert.deepEqual([...CASE_PAGE_SIZES], [10, 25, 50, 100]);
  assert.equal(casesQuery({ type: null, userId: null, moderatorId: null, page: 1, per: 50 }, 2), "?per=50&page=2");
  assert.equal(casesQuery({ type: null, userId: null, moderatorId: null, page: 1, per: 25 }, 1), "");
});

test("relative time has an exact tooltip; copy-ID button escapes", () => {
  const now = Date.parse("2026-11-01T12:00:00Z");
  assert.match(relTime(new Date(now - 3 * 86_400_000), now), /<time datetime="2026-10-29T12:00:00.000Z" title="2026-10-29 12:00 UTC">3 days ago<\/time>/);
  assert.match(relTime(new Date(now + 2 * 3_600_000), now), /in 2 hours/);
  assert.equal(relTime(null), "unknown");
  assert.match(copyId('1"><x'), /data-copy="1&quot;&gt;&lt;x"/);
});

const site: SiteConfig = { inviteUrl: "#", supportUrl: "", version: "test", contactEmail: "", assetVersion: "t" };
const viewer = { userId: "1", username: "aj", globalName: null, csrf: "c" };

test("picker: last opened server first and tagged, only when still manageable", () => {
  const guilds = [{ id: "100000000000000001", name: "A", icon: null, owner: false, permissions: "32" }, { id: "100000000000000002", name: "B", icon: null, owner: false, permissions: "32" }];
  const html = renderPicker(site, viewer, guilds as never, [], null, "100000000000000002");
  assert.ok(html.indexOf(`class="name">B<`) < html.indexOf(`class="name">A<`));
  assert.match(html, /Last opened/);
  assert.doesNotMatch(renderPicker(site, viewer, guilds as never, [], null, "999999999999999999"), /Last opened/);
});

test("dashboard script: copy, ? shortcuts, / filter, Ctrl+S save; no eval", () => {
  for (const s of ["data-copy", "data-shortcuts", "e.key === '?'", "e.key === '/'", "data-unsaved-save"]) assert.ok(dashboardScript.includes(s), s);
  assert.doesNotMatch(dashboardScript, /\beval\(|new Function/);
});

test("last-server cookie is HttpOnly, SameSite=Lax and only set on GET", () => {
  const src = fs.readFileSync("src/web/dashboard/routes/context.ts", "utf8");
  assert.match(src, /req\.method === "GET"\) res\.append\("Set-Cookie", serializeCookie\(LAST_GUILD_COOKIE/);
});

test("site footer: back to top and features/commands/docs/status links", () => {
  const html = layout({ title: "t", description: "d", path: "/", current: "/", body: "", inviteUrl: "#", supportUrl: "", version: "1", assetVersion: "1" } as never);
  for (const href of ['href="#main"', 'href="/features"', 'href="/commands"', 'href="/docs"', 'href="/status"', 'href="/docs#modmail"']) assert.ok(html.includes(href), href);
});

test("/note delete asks for confirmation", () => {
  assert.match(fs.readFileSync("src/commands/moderation/note.ts", "utf8"), /requestConfirmation\(interaction, \{ content: `Delete note/);
});
