import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSettingsImport, exportSettings } from "../src/web/dashboard/settingsTransfer";
import { normalizeGuildConfig } from "../src/services/guildConfigNormalize";
import { DEFAULT_ECONOMY_CONFIG } from "../src/services/economyLogic";
import { AUTOMOD_RULE_KEYS, type AutomodConfig } from "../src/services/automod";

const GUILD = "800000000000000001";
const CHANNEL = "700000000000000001";
const HIDDEN = "700000000000000050";
const GONE_CHANNEL = "700000000000000077";
const ROLE = "600000000000000001";
const GONE_ROLE = "600000000000000077";

const automod: AutomodConfig = {
  guildId: GUILD,
  words: { enabled: true, action: "delete", list: ["x"], exemptChannelIds: [CHANNEL, HIDDEN, GONE_CHANNEL], exemptRoleIds: [ROLE, GONE_ROLE] },
  links: { enabled: true, action: "delete", allowedDomains: [], exemptRoleIds: [GONE_ROLE] },
  mentions: { enabled: false, action: "timeout", threshold: 5 },
  spam: { enabled: false, action: "timeout", maxMessages: 5, windowSeconds: 5 },
  caps: { enabled: false, action: "delete", threshold: 80 },
  invites: { enabled: false, action: "delete", allowedCodes: [] },
  duplicates: { enabled: false, action: "delete", maxRepeats: 3, windowSeconds: 60 },
  emoji: { enabled: false, action: "delete", maxEmoji: 10, zalgo: true },
  timeoutMinutes: 5,
  exemptRoleIds: [ROLE],
  exemptChannelIds: [CHANNEL],
};
const ctx = { textChannelIds: new Set([CHANNEL, HIDDEN]), hiddenChannelIds: new Set([HIDDEN]), roles: new Map([[ROLE, { assignable: true, aboveViewer: false }]]) };

test("settings import filters per-rule automod exemptions like the server-wide lists", () => {
  const r = parseSettingsImport(JSON.stringify(exportSettings(GUILD, "x", normalizeGuildConfig(GUILD), automod, DEFAULT_ECONOMY_CONFIG)), ctx);
  assert.ok(r.ok);
  const words = r.automod?.words as AutomodConfig["words"];
  assert.deepEqual(words.exemptChannelIds, [CHANNEL]);
  assert.deepEqual(words.exemptRoleIds, [ROLE]);
  assert.deepEqual(words.list, ["x"]);
  assert.deepEqual((r.automod?.links as AutomodConfig["links"]).exemptRoleIds, []);
  assert.equal((r.automod?.mentions as AutomodConfig["mentions"]).exemptRoleIds, undefined);
  assert.deepEqual(r.automod?.exemptChannelIds, [CHANNEL]);
  assert.ok(r.warnings.some(w => /Automod: 4 exempt/.test(w)), r.warnings.join("; "));
});

test("settings import carries every automod rule", () => {
  const r = parseSettingsImport(JSON.stringify(exportSettings(GUILD, "x", normalizeGuildConfig(GUILD), automod, DEFAULT_ECONOMY_CONFIG)), ctx);
  assert.ok(r.ok);
  for (const key of AUTOMOD_RULE_KEYS) assert.ok(r.automod && key in r.automod, `missing ${key}`);
});
