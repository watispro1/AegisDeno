import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStarboard } from "../src/web/dashboard/validation";
import { parseSettingsImport, exportSettings } from "../src/web/dashboard/settingsTransfer";
import { normalizeGuildConfig } from "../src/services/guildConfigNormalize";
import { DEFAULT_ECONOMY_CONFIG } from "../src/services/economyLogic";
import { moduleLines } from "../src/commands/shared/configOverview";
import { command as configCommand } from "../src/commands/config/config";
import type { AutomodConfig } from "../src/services/automod";

const GUILD = "800000000000000001";
const ctx = { textChannelIds: new Set<string>(), hiddenChannelIds: new Set<string>(), roles: new Map() };

test("dashboard starboard form: flagged-media fields are validated, and optional", () => {
  const on = parseStarboard({ threshold: "3", mediaSafetyEnabled: "on", mediaSafetyMode: "placeholder" }, ctx as never);
  assert.ok(on.ok && on.value.mediaSafety?.enabled === true && on.value.mediaSafety.mode === "placeholder");
  const off = parseStarboard({ threshold: "3", mediaSafetyMode: "spoiler" }, ctx as never);
  assert.ok(off.ok);
  assert.deepEqual(off.ok && off.value.mediaSafety, { enabled: false, mode: "spoiler" });
  const bad = parseStarboard({ threshold: "3", mediaSafetyEnabled: "on", mediaSafetyMode: "blur" }, ctx as never);
  assert.ok(!bad.ok && bad.errors.mediaSafetyMode);
  const arr = parseStarboard({ threshold: "3", mediaSafetyMode: ["spoiler", "$gt"] } as never, ctx as never);
  assert.ok(!arr.ok, "an array posts its last value, which must still be a mode");
  const absent = parseStarboard({ threshold: "3" }, ctx as never);
  assert.ok(absent.ok && absent.value.mediaSafety === undefined, "an old form leaves the setting alone");
});

const automod = { guildId: GUILD, timeoutMinutes: 5, exemptRoleIds: [], exemptChannelIds: [] } as unknown as AutomodConfig;

test("settings export carries mediaSafety, import validates it, older exports leave it alone", () => {
  const cfg = normalizeGuildConfig(GUILD, { mediaSafety: { enabled: false, mode: "spoiler" } } as never);
  const file = exportSettings(GUILD, "x", cfg, automod, DEFAULT_ECONOMY_CONFIG);
  assert.deepEqual(file.config.mediaSafety, { enabled: false, mode: "spoiler" });
  const r = parseSettingsImport(JSON.stringify(file), ctx as never);
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.update.mediaSafety, { enabled: false, mode: "spoiler" });

  const junk = JSON.parse(JSON.stringify(file));
  junk.config.mediaSafety = { enabled: "yes", mode: "<script>" };
  const j = parseSettingsImport(JSON.stringify(junk), ctx as never);
  assert.deepEqual(j.ok && j.update.mediaSafety, { enabled: true, mode: "placeholder" }, "re-normalised");

  const op = JSON.parse(JSON.stringify(file));
  op.config.mediaSafety = { $set: { enabled: false } };
  assert.equal(parseSettingsImport(JSON.stringify(op), ctx as never).ok, false, "$ keys refused");

  const old = JSON.parse(JSON.stringify(file));
  delete old.config.mediaSafety;
  const o = parseSettingsImport(JSON.stringify(old), ctx as never);
  assert.ok(o.ok && !("mediaSafety" in o.update));
});

test("/config media-safety: Manage Server, both options optional, choices match the stored modes", () => {
  const json = configCommand.data.toJSON();
  const sub = json.options?.find(o => o.name === "media-safety") as { options?: { name: string; required?: boolean; choices?: { value: string }[] }[] } | undefined;
  assert.ok(sub, "subcommand exists");
  assert.deepEqual(sub.options?.map(o => [o.name, o.required ?? false]), [["enabled", false], ["mode", false]]);
  assert.deepEqual(sub.options?.[1].choices?.map(c => c.value), ["placeholder", "spoiler"]);
  assert.equal(json.default_member_permissions, "32", "Manage Server");
});

test("/config overview lists the flagged-media guard", () => {
  const base = { automod: { words: { enabled: false }, links: { enabled: false }, mentions: { enabled: false }, spam: { enabled: false }, caps: { enabled: false } } as never, starboard: null, verification: null, ticketLogChannelId: null };
  const on = moduleLines({ guild: normalizeGuildConfig(GUILD), ...base }).find(l => l.name === "Flagged media");
  assert.equal(on?.state, "on");
  const off = moduleLines({ guild: normalizeGuildConfig(GUILD, { mediaSafety: { enabled: false } } as never), ...base }).find(l => l.name === "Flagged media");
  assert.equal(off?.state, "off");
  assert.match(off!.fix!, /\/config media-safety/);
});
