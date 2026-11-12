/**
 * Dashboard modules: the overview's module board (categories, readiness,
 * Configure links, filter toolbar), the settings module header and its
 * switch (expanded server-side into a full save), and the smarter form
 * fields (searchable selects, pick-list toolbar, required, counters).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SettingsSnapshot } from "../src/web/dashboard/data";
import type { SiteConfig } from "../src/web/pages";
import { moduleCards, moduleGrid, moduleReadiness, moduleTotals } from "../src/web/dashboard/views/overview";
import { canToggle, renderSettings, toggleBody } from "../src/web/dashboard/views/settings";
import { Form, SEARCHABLE_OPTIONS, pickTools } from "../src/web/dashboard/views/form";
import { MODULE_META, moduleDocsHref, moduleMeta } from "../src/web/dashboard/moduleDataCatalog";
import { parseLogging, parseStarboard } from "../src/web/dashboard/validation";
import { normalizeAutomodConfig } from "../src/services/automod";
import { dashboardScript } from "../src/web/dashboard/client";
import { styles } from "../src/web/theme";
import type { GuildContext } from "../src/web/dashboard/views";

const GUILD = "800000000000000001";
const CH = "700000000000000001";
const HIDDEN = "700000000000000099";
const ROLE = "600000000000000001";
const site: SiteConfig = { inviteUrl: "https://discord.com/oauth2/authorize?client_id=1", supportUrl: "", version: "test", contactEmail: "x@example.com", assetVersion: "test" };
const viewer = { userId: "900000000000000001", username: "aj", globalName: null, csrf: "tok" };
const ctx: GuildContext = { guild: { id: GUILD, name: "G", memberCount: 1 }, viewer, nameOf: () => null };
const NO_INLINE = /\sstyle=|\son[a-z]+=|<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)/i;

function snap(over: { guild?: Record<string, unknown>; starboard?: Record<string, unknown>; verification?: unknown; tickets?: Record<string, unknown> } = {}): SettingsSnapshot {
  return {
    automod: normalizeAutomodConfig(GUILD, {}),
    guild: {
      guildId: GUILD, loggingEnabled: true, loggingChannelId: CH, logCategories: null, logChannels: {},
      welcomeEnabled: false, welcomeChannelId: null, welcomeMessage: "Hi {user}", welcomeRoleId: null,
      goodbyeEnabled: false, goodbyeChannelId: null, suggestionsChannelId: null,
      escalation: { enabled: true, thresholds: [{ atWarnings: 3, action: "timeout", durationMinutes: 10 }], warnExpiryDays: 0 },
      modules: {}, ...over.guild,
    },
    starboard: { guildId: GUILD, channelId: CH, emoji: "⭐", threshold: 3, selfStar: false, ignoredChannels: [CH], ignoredRoles: [ROLE], enabled: true, ...over.starboard },
    tickets: { logChannelId: null, autoCloseHours: 48, transcriptLogging: false, ...over.tickets },
    verification: over.verification === undefined ? null : over.verification,
  } as unknown as SettingsSnapshot;
}
const data = { openTicketCount: 2, pendingAppeals: 0 } as never;

test("every overview module has catalog facts and a command reference link", () => {
  const cards = moduleCards(GUILD, data, { snapshot: snap(), rolePanels: 1 });
  assert.ok(cards.length >= 15);
  for (const c of cards) {
    assert.ok(MODULE_META[c.key], `${c.key} is in the catalog`);
    assert.ok(c.icon && c.description, `${c.key} has an icon and description`);
  }
  assert.equal(moduleDocsHref("automod"), "/commands#cmd-automod");
  assert.equal(moduleDocsHref("logging"), "/commands#cmd-config");
  assert.equal(moduleMeta("nope").description, "");
});

test("readiness: configured, needs setup, problem and not in use", () => {
  const byKey = (m: Parameters<typeof moduleCards>[2]) => Object.fromEntries(moduleCards(GUILD, data, m).map(c => [c.key, c]));
  let c = byKey({ snapshot: snap(), rolePanels: 1 });
  assert.equal(c.logging.readiness, "ready");
  assert.equal(c.welcome.readiness, "off");
  assert.equal(c.verification.readiness, "setup", "verification never posted needs setup");
  assert.equal(c.starboard.readiness, "ready");

  c = byKey({ snapshot: snap(), hidden: new Set([CH]) });
  assert.equal(c.logging.readiness, "problem");
  assert.match(c.logging.note, /can't see/);
  assert.equal(c.starboard.readiness, "problem");
  assert.equal(c.panels.readiness, "setup", "no role panels posted");

  c = byKey({ snapshot: snap({ guild: { welcomeEnabled: true, logChannels: { messageDeletes: HIDDEN } } }), hidden: new Set([HIDDEN]) });
  assert.equal(c.welcome.readiness, "setup");
  assert.equal(c.welcome.note, "Pick a welcome channel");
  assert.equal(c.logging.readiness, "problem", "a hidden per-category log channel is a problem");

  c = byKey({ snapshot: snap({ verification: { enabled: true, verifiedRoleId: ROLE, type: "button", kickUnverifiedMinutes: 0, channelId: CH } }), missingBotPermissions: ["Manage Roles"] });
  assert.equal(c.verification.readiness, "problem");

  c = byKey({ snapshot: snap({ tickets: { transcriptLogging: true } }) });
  assert.equal(c.tickets.readiness, "setup");

  assert.deepEqual(moduleReadiness({ key: "x", label: "X", href: "/", on: false, detail: "" }, {}), { readiness: "off", note: "" });
});

test("module board: grouped by category, pill, readiness, Configure link, hidden filter toolbar, no inline code", () => {
  const cards = moduleCards(GUILD, data, { snapshot: snap(), hidden: new Set([CH]) });
  const html = moduleGrid(cards);
  for (const cat of ["Moderation", "Community", "Automation"]) assert.match(html, new RegExp(`data-module-group="${cat}"`));
  assert.match(html, /class="module-grid"/);
  assert.match(html, /<a class="mod-configure" href="\/dashboard\/800000000000000001\/settings\/logging">Configure<span class="visually-hidden"> Logging<\/span>/);
  assert.match(html, /data-readiness="problem"/);
  assert.match(html, /status-pill on">On</);
  assert.match(html, /<div class="mod-tools" data-module-tools hidden>/, "toolbar only appears with JavaScript");
  assert.match(html, /data-module-chip="attention"/);
  assert.doesNotMatch(html, NO_INLINE);
  const t = moduleTotals(cards);
  assert.equal(t.ready + t.setup + t.problem + t.off, cards.length);
  assert.match(html, new RegExp(`${t.on} on`));
  // Plain ModuleState input still renders (older callers).
  assert.match(moduleGrid([{ key: "logging", label: "Logging", href: "/x", on: true, detail: "d" }]), /Configured/);
  assert.equal(moduleGrid([]), "");
});

test("settings header: icon, status, docs link and a switch posting only _toggle with CSRF", () => {
  const html = renderSettings(site, ctx, "starboard", snap(), { values: {}, errors: {} }, [{ id: CH, name: "stars", parent: null }], [], null);
  assert.match(html, /data-module-head/);
  assert.match(html, /href="\/commands#cmd-starboard"/);
  assert.match(html, /<form class="mod-toggle-form" method="post" action="\/dashboard\/800000000000000001\/settings\/starboard" data-module-toggle>/);
  assert.match(html, /name="_csrf" value="tok"><input type="hidden" name="_toggle" value="off">/);
  assert.match(html, /role="switch" aria-checked="true"/);
  assert.match(html, /class="dash-form mod-settings"/);
  assert.match(html, /data-track-changes/);
  assert.match(html, /name="emoji"[^>]* required aria-required="true"/);
  assert.doesNotMatch(html, NO_INLINE);
  // Automod and tickets have no single switch; verification needs a posted panel first.
  assert.equal(canToggle("automod", snap()), false);
  assert.equal(canToggle("tickets", snap()), false);
  assert.equal(canToggle("verification", snap()), false);
  assert.doesNotMatch(renderSettings(site, ctx, "tickets", snap(), { values: {}, errors: {} }, [], [], null), /data-module-toggle/);
});

test("toggleBody expands the switch into the saved settings with only the switch flipped", () => {
  const vctx = { textChannelIds: new Set([CH]), roles: new Map([[ROLE, { assignable: true }]]) };
  const s = snap();
  const body = toggleBody("starboard", { _csrf: "tok", _toggle: "off" }, s);
  assert.equal(body.enabled, undefined, "switched off");
  assert.equal(body._csrf, "tok");
  assert.deepEqual(body.ignoredChannels, [CH]);
  assert.deepEqual(body.ignoredRoles, [ROLE]);
  const parsed = parseStarboard(body, vctx, { ignoredChannels: [CH], ignoredRoles: [ROLE] });
  assert.ok(parsed.ok, JSON.stringify(parsed));
  if (parsed.ok) {
    assert.equal(parsed.value.enabled, false);
    assert.equal(parsed.value.threshold, 3);
    assert.equal(parsed.value.channelId, CH);
  }
  const on = toggleBody("logging", { _csrf: "tok", _toggle: "on" }, snap({ guild: { loggingEnabled: false } }));
  assert.equal(on.loggingEnabled, "on");
  const p2 = parseLogging(on, vctx);
  assert.ok(p2.ok && p2.value.loggingEnabled === true && p2.value.loggingChannelId === CH);
  // Normal saves and bad values pass through untouched.
  const normal = { _csrf: "tok", enabled: "on", threshold: "5" };
  assert.equal(toggleBody("starboard", normal, s), normal);
  const bad = { _csrf: "tok", _toggle: "maybe" };
  assert.equal(toggleBody("starboard", bad, s), bad);
  assert.equal(toggleBody("automod", { _toggle: "off" }, s).words_enabled, undefined, "no switch: unchanged");
});

test("form fields: searchable long selects, pick-list toolbar, counters, required, server errors next to the field", () => {
  const many = Array.from({ length: SEARCHABLE_OPTIONS + 1 }, (_, i) => ({ value: String(i), label: `#c${i}` }));
  const f = new Form({ values: { a: "1", m: "1,2", t: "hey" }, errors: { t: "Too short." } }).require("a");
  assert.match(f.select("a", "A", many), /<select id="f-a" name="a" required aria-required="true" data-searchable>/);
  assert.doesNotMatch(f.select("b", "B", many.slice(0, SEARCHABLE_OPTIONS)), /data-searchable/);
  const multi = f.multi("m", "Ignored channels", many);
  assert.match(multi, /data-pick-list/);
  assert.match(multi, /<ul class="pick-chips" data-pick-chips aria-label="Picked ignored channels" hidden><\/ul>/);
  assert.match(multi, /data-pick-tools hidden>.*data-pick-search.*data-pick-all.*data-pick-none/s);
  assert.match(multi, /\(2 picked\)/);
  assert.equal(pickTools("x", "Roles", 1), "", "no toolbar for a single option");
  assert.doesNotMatch(pickTools("x", "Roles", 3), /data-pick-search/, "no search box for a short list");
  const ta = f.textarea("t", "Message", 200);
  assert.match(ta, /data-count-max="200"/);
  assert.match(ta, /aria-invalid="true" aria-describedby="t-error"/);
  assert.match(ta, /<span class="field-error" id="t-error">Too short\.<\/span>/);
  assert.equal((f.textarea("t", "M", 50, undefined, ' data-count-max="50"').match(/data-count-max/g) ?? []).length, 1, "no duplicate counter attribute");
  for (const html of [multi, ta]) assert.doesNotMatch(html, NO_INLINE);
});

test("client script and stylesheet carry the module board and form hooks", () => {
  assert.doesNotThrow(() => new Function(dashboardScript));
  for (const hook of ["[data-module-board]", "select[data-searchable]", "[data-pick-list]", "data-pick-all", "data-client-error", "aria-invalid", "data-module-chip"]) {
    assert.ok(dashboardScript.includes(hook), `script handles ${hook}`);
  }
  for (const rule of [".mod-card", ".mod-state.problem", ".mod-toggle", ".pick-chip", ".select-search", ".mod-settings > fieldset"]) {
    assert.ok(styles.includes(rule), `stylesheet has ${rule}`);
  }
  assert.ok(styles.indexOf(".mod-card {") < styles.lastIndexOf("@media"), "module styles load before responsive.ts");
});
