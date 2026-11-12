import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { styles } from "../src/web/theme";
import { dashboardScript } from "../src/web/dashboard/client";
import { countBy, helpPanel, listFoot, listTools, pill, rowAttrs, soonest, summaryStrip, usage } from "../src/web/dashboard/views/moduleKit";
import { PANEL_DEFAULTS, panelPreview } from "../src/web/dashboard/views/panels";
import { TEST_SAMPLES, automodTestPanel } from "../src/web/dashboard/views/automodTest";
import { renderAppeals, renderCases, type GuildContext } from "../src/web/dashboard/views";
import { renderAutoResponders, renderAutomations } from "../src/web/dashboard/views/automation";
import { renderModmail } from "../src/web/dashboard/views/modmail";
import type { SiteConfig } from "../src/web/pages";

const cfg: SiteConfig = { inviteUrl: "https://discord.com/oauth2/authorize?client_id=1", supportUrl: "", version: "0.0.0", contactEmail: "", assetVersion: "t" };
const viewer = { userId: "900000000000000001", username: "aj", globalName: null, csrf: "tok" };
const ctx: GuildContext = { guild: { id: "800000000000000001", name: "G", memberCount: 3 }, viewer, nameOf: () => null };
const NO_INLINE = /style="|\son[a-z]+="|<script>(?!\s*<\/script>)[^<]/;

test("summary strip escapes values, links cells and marks tones", () => {
  const html = summaryStrip([{ label: "Open", value: 1234, tone: "warn", hint: "<b>" }, { label: "Go", value: "x", href: "#a" }], "S");
  assert.ok(html.startsWith('<dl class="stat-grid module-stats" aria-label="S">'));
  assert.ok(html.includes('<div class="stat stat-warn"><dt>Open</dt><dd>1,234</dd><dd class="stat-hint">&lt;b&gt;</dd></div>'));
  assert.ok(html.includes('<a class="stat-link" href="#a">'));
  assert.equal(summaryStrip([]), "");
  assert.equal(pill("on <x>", "ok"), '<span class="pill pill-ok">on &lt;x&gt;</span>');
});

test("list tools: chips total their counts, sort menu, row attributes are sanitised", () => {
  const html = listTools("t1", { search: "Find", chips: [{ value: "on", label: "On", count: 2 }, { value: "off", label: "Off", count: 3 }], sorts: [{ value: "a:asc", label: "A" }] });
  assert.ok(html.includes('data-filter-target="t1"'));
  assert.ok(html.includes('data-chip="" aria-pressed="true">All <span class="chip-count">5</span>'));
  assert.ok(html.includes('<select id="sort-t1" data-sort-target="t1">'));
  assert.equal(rowAttrs("on", { "Bad Key!": 3, skip: null }), ' data-chip-value="on" data-sort-badkey="3"');
  assert.equal(rowAttrs(null, { t: "a\"b" }), ' data-sort-t="a&quot;b"');
  assert.ok(listFoot("t1").includes('data-more-for="t1" hidden'));
  assert.ok(helpPanel("H", [["<a>", "<code>x</code>"]]).includes("<dt>&lt;a&gt;</dt><dd><code>x</code></dd>"));
});

test("countBy, soonest and usage", () => {
  assert.deepEqual([...countBy(["a", "b", "a"], x => x)], [["a", 2], ["b", 1]]);
  const a = new Date("Fri 2026-11-13 9:00 AM CST (UTC-06:00)"), b = new Date("Thu 2026-11-12 9:00 AM CST (UTC-06:00)");
  assert.equal(soonest([a, null, b, new Date(NaN)]), b);
  assert.equal(soonest([]), null);
  assert.equal(usage(5, 10).tone, "ok");
  assert.equal(usage(8, 10).tone, "warn");
  assert.equal(usage(10, 10).tone, "bad");
  assert.equal(usage(3, 10).hint, "7 left");
});

test("panel preview shows the bot's defaults and the captcha button", () => {
  assert.ok(panelPreview("ticket", {}).includes(PANEL_DEFAULTS.ticket.title));
  assert.ok(panelPreview("ticket", { title: "<Help>" }).includes("&lt;Help&gt;"));
  assert.ok(panelPreview("verification", { type: "captcha" }).includes(">Verify with CAPTCHA<"));
  const svc = readFileSync(new URL("../src/services/ticketService.ts", import.meta.url), "utf8");
  assert.ok(svc.includes(`"${PANEL_DEFAULTS.ticket.description}"`), "ticket default matches the bot");
  const ver = readFileSync(new URL("../src/services/verificationService.ts", import.meta.url), "utf8");
  for (const s of [PANEL_DEFAULTS.verification.description, PANEL_DEFAULTS.verification.button, PANEL_DEFAULTS.verification.captcha]) assert.ok(ver.includes(s), s);
});

test("automod test offers examples that fill the box", () => {
  const html = automodTestPanel(ctx, null);
  assert.equal((html.match(/data-fill-target="f-am-test"/g) ?? []).length, TEST_SAMPLES.length);
  assert.doesNotMatch(html, NO_INLINE);
});

test("module pages render summary strips and list tools without inline code", () => {
  const SOON = new Date(Date.now() + 3_600_000), AGO = new Date(Date.now() - 86_400_000);
  const channels = [{ id: "700000000000000001", name: "general" }] as never;
  const ar = renderAutoResponders(cfg, ctx, { rows: [
    { id: "a1", trigger: "rules", matchType: "contains", response: "See #rules", enabled: true, createdAt: AGO, createdBy: viewer.userId },
    { id: "a2", trigger: "ip", matchType: "exact", response: "play.example", enabled: false, createdAt: AGO, createdBy: viewer.userId },
  ] as never, enabled: true, noticeCode: null, max: 25 });
  assert.ok(ar.includes('aria-label="Autoresponder summary"'));
  assert.ok(ar.includes('data-chip="off" aria-pressed="false">Off <span class="chip-count">1</span>'));
  assert.ok(ar.includes('data-page-size="20"'));
  assert.ok(ar.includes('data-confirm="Turn off every autoresponder?'));
  const au = renderAutomations(cfg, ctx, { rows: [{ id: "t1", channelId: "700000000000000001", creatorId: viewer.userId, type: "scheduled", payload: "Standup", executeAt: SOON, intervalMs: 86_400_000 }] as never, channels, hidden: new Set(), noticeCode: null });
  assert.ok(au.includes("Next post</dt><dd><time"));
  assert.ok(au.includes('data-chip-value="repeat"'));
  const empty = renderAutomations(cfg, ctx, { rows: [], channels, hidden: new Set(), noticeCode: null });
  assert.ok(empty.includes('href="#task-h">Schedule one</a>'));
  const cases = renderCases(cfg, ctx, { type: "ban", userId: null, moderatorId: null, page: 1 }, { items: [], total: 0 }, 25);
  assert.ok(cases.includes('href="/dashboard/800000000000000001/cases?type=ban" aria-current="true">ban</a>'));
  const appeals = renderAppeals(cfg, ctx, { status: "pending", page: 1 }, { items: [], total: 0 }, 25);
  assert.ok(appeals.includes("See all appeals"));
  const mm = renderModmail(cfg, ctx, {
    overview: { config: { enabled: true, channelId: null, staffRoleId: null, pingStaff: false, relayPrefix: "=", anonymousByDefault: false, greeting: null, closeMessage: null, blockedUserIds: ["500000000000000001"] }, open: [], closed: [] } as never,
    channels, roles: [], noticeCode: null,
  });
  assert.ok(mm.includes("ModMail is on but has no staff channel"));
  assert.ok(mm.includes('data-confirm="Unblock this member?'));
  for (const html of [ar, au, empty, cases, appeals, mm]) assert.doesNotMatch(html, NO_INLINE);
});

test("stylesheet and script carry the module page hooks", () => {
  for (const sel of [".module-stats", ".pill-ok", ".chip[aria-pressed=\"true\"]", "tr[data-paged-out]", ".help-panel", ".panel-compose"]) assert.ok(styles.includes(sel), sel);
  assert.ok(styles.indexOf(".module-stats") < styles.indexOf("── Responsive"), "loaded before responsive.ts");
  for (const hook of ["data-chip-for", "data-sort-target", "data-more-for", "data-panel-preview", "data-fill-target"]) assert.ok(dashboardScript.includes(hook), hook);
});
