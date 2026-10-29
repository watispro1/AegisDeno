import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applySetPaths,
  createGuildConfigService,
  disabledLegacyFeatures,
  guildConfigSetPaths,
  legacySettingsPatch,
  normalizeGuildConfig,
  normalizeMaxRolesPerPanel,
  type GuildConfigStore,
  type LegacySettingsDoc,
  type StoredGuildConfig,
} from "../src/services/configuration";

const G = "100000000000000001";
const CH = "200000000000000002";

/** In-memory GuildConfigStore that counts calls. */
function memoryStore(initial: StoredGuildConfig | null, legacy: LegacySettingsDoc[] = [], opts: { failSave?: boolean } = {}) {
  let doc: StoredGuildConfig | null = initial ? structuredClone(initial) : null;
  const calls = { load: 0, save: 0, loadLegacy: 0 };
  const saves: Array<Record<string, unknown>> = [];
  const store: GuildConfigStore = {
    async load() { calls.load++; return doc ? structuredClone(doc) : null; },
    async save(_guildId, set) {
      calls.save++;
      saves.push(set);
      if (opts.failSave) throw new Error("db down");
      doc = applySetPaths(doc ?? {}, set);
      return structuredClone(doc);
    },
    async loadLegacy() { calls.loadLegacy++; return structuredClone(legacy); },
  };
  return { store, calls, saves, current: () => doc };
}

const legacyTickets: LegacySettingsDoc = {
  pluginName: "tickets",
  enabled: true,
  config: { maxOpenTicketsPerUser: 1, transcriptLogging: false, logChannelId: CH, autoCloseHours: 12 },
};
const legacyRoles: LegacySettingsDoc = { pluginName: "roles", enabled: true, config: { maxRolesPerPanel: 10 } };

test("defaults when nothing is stored: 25 roles per panel, 48h ticket auto-close", () => {
  const cfg = normalizeGuildConfig(G);
  assert.deepEqual(cfg.tickets, { logChannelId: null, autoCloseHours: 48, transcriptLogging: true });
  assert.deepEqual(cfg.roles, { maxRolesPerPanel: 25 });
});

test("legacySettingsPatch copies ticket and role settings that are not set yet", () => {
  assert.deepEqual(legacySettingsPatch(null, [legacyTickets, legacyRoles]), {
    "tickets.logChannelId": CH,
    "tickets.autoCloseHours": 12,
    "tickets.transcriptLogging": false,
    "roles.maxRolesPerPanel": 10,
  });
});

test("legacySettingsPatch never overwrites a value already in the guild config", () => {
  const current: StoredGuildConfig = { tickets: { autoCloseHours: 0, logChannelId: null }, roles: { maxRolesPerPanel: 5 } };
  assert.deepEqual(legacySettingsPatch(current, [legacyTickets, legacyRoles]), { "tickets.transcriptLogging": false });
});

test("legacySettingsPatch ignores malformed values and unrelated features", () => {
  const docs: LegacySettingsDoc[] = [
    { pluginName: "tickets", config: { logChannelId: "not-an-id", autoCloseHours: "12", transcriptLogging: "yes" } },
    { pluginName: "automod", config: { maxMentionsThreshold: 5 } },
    { pluginName: "roles", config: { maxRolesPerPanel: 400 } },
  ];
  assert.deepEqual(legacySettingsPatch(null, docs), { "roles.maxRolesPerPanel": 25 });
  assert.deepEqual(legacySettingsPatch(null, []), {});
});

test("disabledLegacyFeatures lists features switched off with the old toggle", () => {
  assert.deepEqual(disabledLegacyFeatures([
    { pluginName: "tickets", enabled: false },
    { pluginName: "community", enabled: false },
    { pluginName: "roles", enabled: true },
    { pluginName: "starboard" },
  ]), ["community", "tickets"]);
});

test("first read copies legacy settings in once and marks the guild migrated", async () => {
  const mem = memoryStore({ guildId: G, prefix: "?" }, [legacyTickets, legacyRoles]);
  const svc = createGuildConfigService(mem.store);

  const cfg = await svc.getGuildConfig(G);
  assert.equal(cfg.prefix, "?");
  assert.deepEqual(cfg.tickets, { logChannelId: CH, autoCloseHours: 12, transcriptLogging: false });
  assert.equal(cfg.roles.maxRolesPerPanel, 10);
  assert.equal(mem.calls.save, 1);
  assert.ok(mem.current()?.legacySettingsMigratedAt instanceof Date);

  // A fresh process (new service) sees the flag and skips the legacy lookup.
  const again = createGuildConfigService(mem.store);
  await again.getGuildConfig(G);
  assert.equal(mem.calls.loadLegacy, 1);
  assert.equal(mem.calls.save, 1);
});

test("a guild with no config and no legacy settings costs no write", async () => {
  const mem = memoryStore(null, []);
  const svc = createGuildConfigService(mem.store);
  const cfg = await svc.getGuildConfig(G);
  assert.equal(cfg.roles.maxRolesPerPanel, 25);
  assert.equal(mem.calls.save, 0);
  svc.invalidate(G);
  await svc.getGuildConfig(G);
  assert.equal(mem.calls.loadLegacy, 1, "legacy is checked once per process");
});

test("if saving the migration fails, the old values are still used (read fallback)", async () => {
  const mem = memoryStore(null, [legacyTickets], { failSave: true });
  const svc = createGuildConfigService(mem.store);
  const cfg = await svc.getGuildConfig(G);
  assert.equal(cfg.tickets.autoCloseHours, 12);
  assert.equal(cfg.tickets.logChannelId, CH);
});

test("an update before any read migrates first, so legacy values never overwrite it", async () => {
  const mem = memoryStore(null, [legacyTickets]);
  const svc = createGuildConfigService(mem.store);
  const updated = await svc.updateGuildConfig(G, { tickets: { autoCloseHours: 6 } });
  assert.equal(updated.tickets.autoCloseHours, 6);
  assert.equal(updated.tickets.logChannelId, CH, "untouched legacy fields are kept");
  assert.equal(updated.tickets.transcriptLogging, false);

  const fresh = createGuildConfigService(mem.store);
  assert.equal((await fresh.getGuildConfig(G)).tickets.autoCloseHours, 6);
});

test("reads are cached, saves invalidate, and callers cannot mutate the cache", async () => {
  const mem = memoryStore({ guildId: G, legacySettingsMigratedAt: new Date() });
  const svc = createGuildConfigService(mem.store);

  const a = await svc.getGuildConfig(G);
  await svc.getGuildConfig(G);
  await svc.getGuildConfig(G);
  assert.equal(mem.calls.load, 1);

  a.welcomeMessage = "mutated";
  assert.notEqual((await svc.getGuildConfig(G)).welcomeMessage, "mutated");

  await svc.updateGuildConfig(G, { welcomeEnabled: true });
  assert.equal((await svc.getGuildConfig(G)).welcomeEnabled, true);
});

test("concurrent first reads share one load", async () => {
  const mem = memoryStore({ guildId: G, legacySettingsMigratedAt: new Date() });
  const svc = createGuildConfigService(mem.store);
  await Promise.all(Array.from({ length: 20 }, () => svc.getGuildConfig(G)));
  assert.equal(mem.calls.load, 1);
});

test("guildConfigSetPaths saves nested settings field by field and normalises them", () => {
  assert.deepEqual(guildConfigSetPaths({
    prefix: "!",
    tickets: { autoCloseHours: 9999, logChannelId: "bad" },
    roles: { maxRolesPerPanel: 0 },
  }), {
    prefix: "!",
    "tickets.autoCloseHours": 720,
    "tickets.logChannelId": null,
    "roles.maxRolesPerPanel": 25,
  });
  // Unknown keys are dropped, as before.
  assert.deepEqual(guildConfigSetPaths({ guildId: "x" } as never), {});
});

test("normalizeMaxRolesPerPanel clamps to Discord's 25 and falls back for junk", () => {
  assert.equal(normalizeMaxRolesPerPanel(10), 10);
  assert.equal(normalizeMaxRolesPerPanel(10.7), 10);
  assert.equal(normalizeMaxRolesPerPanel(99), 25);
  assert.equal(normalizeMaxRolesPerPanel("x"), 25);
  assert.equal(normalizeMaxRolesPerPanel(-3), 25);
});
