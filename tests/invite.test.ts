import test from "node:test";
import assert from "node:assert/strict";
import { buildInviteUrl, guildInviteUrl } from "../src/web/invite";
import { renderPicker } from "../src/web/dashboard/views";
import { layout } from "../src/web/layout";
import type { SiteConfig } from "../src/web/pages";

const APP = "1554631691421876254";
const GUILD = "100000000000000001";

test("invite URL is the standard https authorize link", () => {
  const href = buildInviteUrl({ appId: APP, permissions: "1099645938774" });
  const u = new URL(href);
  assert.equal(u.origin + u.pathname, "https://discord.com/oauth2/authorize");
  assert.equal(u.searchParams.get("client_id"), APP);
  assert.equal(u.searchParams.get("permissions"), "1099645938774");
  assert.equal(u.searchParams.get("scope"), "bot applications.commands");
  assert.equal(u.searchParams.get("integration_type"), "0");
  assert.ok(href.includes("scope=bot%20applications.commands"), href);
  assert.ok(!href.includes("+"), href);
  assert.equal(u.searchParams.get("response_type"), null);
  assert.equal(u.searchParams.get("redirect_uri"), null);
});

test("BOT_INVITE_URL is used only when it is an https discord.com link", () => {
  for (const bad of ["discord://-/oauth2/authorize?client_id=1", "http://discord.com/oauth2/authorize", "https://evil.example/oauth2/authorize", "javascript:alert(1)", "not a url"]) {
    const href = buildInviteUrl({ appId: APP, permissions: "8", configured: bad });
    assert.ok(href.startsWith("https://discord.com/oauth2/authorize?"), `${bad} -> ${href}`);
  }
  assert.equal(buildInviteUrl({ permissions: "8", configured: "discord://x" }), "#");
  assert.equal(buildInviteUrl({ permissions: "8" }), "#");
  const configured = buildInviteUrl({
    appId: APP,
    permissions: "8",
    configured: "https://discord.com/oauth2/authorize?client_id=999&scope=bot&response_type=code&redirect_uri=https%3A%2F%2Fx.example%2Fcb",
  });
  const u = new URL(configured);
  assert.equal(u.searchParams.get("client_id"), APP);
  assert.equal(u.searchParams.get("response_type"), null);
  assert.equal(u.searchParams.get("redirect_uri"), null);
  // Without an app id a valid configured URL is kept as-is, plus integration_type.
  const keep = new URL(buildInviteUrl({ permissions: "8", configured: "https://discord.com/oauth2/authorize?client_id=42&permissions=0&scope=bot" }));
  assert.equal(keep.searchParams.get("client_id"), "42");
  assert.equal(keep.searchParams.get("scope"), "bot");
  assert.equal(keep.searchParams.get("integration_type"), "0");
});

test("guild invite preselects the server and locks the picker", () => {
  const base = buildInviteUrl({ appId: APP, permissions: "8" });
  const href = guildInviteUrl(base, GUILD);
  assert.ok(href);
  const u = new URL(href!);
  assert.equal(u.searchParams.get("guild_id"), GUILD);
  assert.equal(u.searchParams.get("disable_guild_select"), "true");
  assert.equal(u.searchParams.get("integration_type"), "0");
  assert.equal(u.searchParams.get("client_id"), APP);
  assert.ok(href!.includes("scope=bot%20applications.commands"));
  assert.equal(guildInviteUrl(base, "not-a-snowflake"), null);
  assert.equal(guildInviteUrl(base, "1"), null);
  assert.equal(guildInviteUrl("discord://-/oauth2/authorize?client_id=1", GUILD), null);
  assert.equal(guildInviteUrl("https://discord.com/oauth2/authorize", GUILD), null);
});

test("dashboard picker renders a plain link, a copy fallback and no deep link", () => {
  const cfg: SiteConfig = { inviteUrl: buildInviteUrl({ appId: APP, permissions: "8" }), supportUrl: "", version: "t", contactEmail: "", assetVersion: "t" };
  const viewer = { userId: "1", username: "u", csrf: "c" } as unknown as Parameters<typeof renderPicker>[1];
  const guild = { id: GUILD, name: "Owned <b>", owner: true, permissions: "8" };
  const html = renderPicker(cfg, viewer, [], [{ guild, inviteUrl: guildInviteUrl(cfg.inviteUrl, GUILD) }], null);
  const link = html.match(/<a class="btn ghost sm" href="([^"]+)"/);
  assert.ok(link, "invite link present");
  const href = link![1].replace(/&amp;/g, "&");
  assert.ok(href.startsWith("https://discord.com/oauth2/authorize?"));
  assert.equal(new URL(href).searchParams.get("guild_id"), GUILD);
  assert.match(html, /data-copy="https:\/\/discord\.com\/oauth2\/authorize\?/);
  assert.ok(!html.includes("discord://"));
  assert.ok(!/<a[^>]+invite[^>]+target=/.test(html), "no target attribute on the invite link");
  assert.ok(!html.includes("Owned <b>"), "guild name escaped");
  assert.match(html, /continue in the browser/);
});

test("site nav uses the https invite and drops non-http values", () => {
  const href = buildInviteUrl({ appId: APP, permissions: "8" });
  const html = layout({ title: "t", description: "d", path: "/", body: "", inviteUrl: href, supportUrl: "", version: "0" });
  assert.ok(html.includes(href.replace(/&/g, "&amp;")));
  assert.ok(!html.includes("discord://"));
  const bad = layout({ title: "t", description: "d", path: "/", body: "", inviteUrl: "discord://x", supportUrl: "", version: "0" });
  assert.ok(!bad.includes("discord://"));
});
