import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  TEMP_ROLE_MAX_SECONDS,
  decideTempRoleExpiry,
  decodeTempRole,
  encodeTempRole,
  isUnknownMemberError,
  parseTempRoleDuration,
  planTempRoleAdd,
  tempRoleBlock,
  tempRoleListLine,
  type TempRolePayload,
} from "../src/services/tempRoleLogic";
import { planRestore } from "../src/services/scheduler";
import { lookupBanStatus, softbanBanReason, softbanBlock, softbanDeleteSeconds, softbanRecheckBlock } from "../src/commands/moderation/softban/logic";
import { CASE_SEARCH_ACTIONS } from "../src/commands/shared/caseSearch";
import { CASE_TYPES } from "../src/web/dashboard/caseValidation";

const GUILD = "100000000000000001";
const ROLE = "200000000000000002";

test("parseTempRoleDuration reads friendly lengths and caps at a year", () => {
  assert.deepEqual(parseTempRoleDuration("2h"), { ok: true, seconds: 7200 });
  assert.deepEqual(parseTempRoleDuration("1d 12h"), { ok: true, seconds: 129_600 });
  assert.deepEqual(parseTempRoleDuration("365d"), { ok: true, seconds: TEMP_ROLE_MAX_SECONDS });
  assert.equal(parseTempRoleDuration("366d").ok, false);
  assert.equal(parseTempRoleDuration("30s").ok, false);
  assert.equal(parseTempRoleDuration("soon").ok, false);
  assert.equal(parseTempRoleDuration("").ok, false);
  assert.equal(parseTempRoleDuration(null).ok, false);
});

test("tempRoleBlock enforces @everyone, managed roles and both hierarchies", () => {
  const base = { guildId: GUILD, isOwner: false, actorTopPosition: 10, botTopPosition: 20 };
  const role = { id: ROLE, position: 5, managed: false };
  assert.equal(tempRoleBlock({ ...base, role }), null);
  assert.match(tempRoleBlock({ ...base, role: { ...role, id: GUILD } }) ?? "", /@everyone/);
  assert.match(tempRoleBlock({ ...base, role: { ...role, managed: true } }) ?? "", /managed/);
  assert.match(tempRoleBlock({ ...base, role: { ...role, position: 20 } }) ?? "", /my highest role/);
  assert.match(tempRoleBlock({ ...base, role: { ...role, position: 10 } }) ?? "", /your highest role/);
  assert.match(tempRoleBlock({ ...base, actorTopPosition: null, role }) ?? "", /your highest role/);
  // The owner may use roles above their own top role, but never above Aegis.
  assert.equal(tempRoleBlock({ ...base, isOwner: true, actorTopPosition: 1, role: { ...role, position: 15 } }), null);
  assert.match(tempRoleBlock({ ...base, isOwner: true, role: { ...role, position: 25 } }) ?? "", /my highest role/);
});

test("planTempRoleAdd adds, extends, and leaves permanent or longer roles alone", () => {
  assert.deepEqual(planTempRoleAdd({ memberHasRole: false, pendingExpiryMs: null, newExpiryMs: 5 }), { kind: "add" });
  // A stale timer for a role the member no longer has is simply replaced.
  assert.deepEqual(planTempRoleAdd({ memberHasRole: false, pendingExpiryMs: 99, newExpiryMs: 5 }), { kind: "add" });
  assert.deepEqual(planTempRoleAdd({ memberHasRole: true, pendingExpiryMs: null, newExpiryMs: 5 }), { kind: "already-permanent" });
  assert.deepEqual(planTempRoleAdd({ memberHasRole: true, pendingExpiryMs: 10, newExpiryMs: 20 }), { kind: "extend", previousExpiryMs: 10 });
  assert.deepEqual(planTempRoleAdd({ memberHasRole: true, pendingExpiryMs: 20, newExpiryMs: 20 }), { kind: "already-longer", currentExpiryMs: 20 });
});

test("temp role payload round-trips and rejects payloads without a role", () => {
  const payload: TempRolePayload = { roleId: ROLE, moderatorId: "1", moderatorTag: "mod", reason: "x".repeat(600), durationSeconds: 3600, caseId: "abc", setAt: 1000 };
  const decoded = decodeTempRole(encodeTempRole(payload));
  assert.ok(decoded);
  assert.equal(decoded.roleId, ROLE);
  assert.equal(decoded.reason.length, 512);
  assert.equal(decoded.durationSeconds, 3600);
  assert.equal(decoded.caseId, "abc");
  assert.equal(decodeTempRole("not json"), null);
  assert.equal(decodeTempRole(JSON.stringify({ roleId: "<@&1>" })), null);
  assert.deepEqual(decodeTempRole(JSON.stringify({ roleId: ROLE })), { roleId: ROLE, moderatorId: "", moderatorTag: "Unknown", reason: "", durationSeconds: 0, caseId: null, setAt: 0 });
});

test("decideTempRoleExpiry removes only when the member still has a manageable role", () => {
  const ok = { guildAvailable: true, roleExists: true, memberFound: true, memberHasRole: true, roleBelowBot: true };
  assert.equal(decideTempRoleExpiry(ok), "remove");
  assert.equal(decideTempRoleExpiry({ ...ok, guildAvailable: false }), "retry");
  assert.equal(decideTempRoleExpiry({ ...ok, roleExists: false, memberFound: false }), "skip-role-deleted");
  assert.equal(decideTempRoleExpiry({ ...ok, memberFound: false, memberHasRole: false }), "skip-member-left");
  assert.equal(decideTempRoleExpiry({ ...ok, memberHasRole: false }), "skip-not-present");
  assert.equal(decideTempRoleExpiry({ ...ok, roleBelowBot: false }), "skip-unmanageable");
  assert.equal(isUnknownMemberError({ code: 10007 }), true);
  assert.equal(isUnknownMemberError({ code: 50013 }), false);
  assert.equal(isUnknownMemberError(null), false);
});

test("temprole_remove tasks are restored however overdue", () => {
  const now = Date.now();
  assert.deepEqual(planRestore({ type: "temprole_remove", executeAt: new Date(now - 10 * 86_400_000), intervalMs: null }, now), { kind: "fire" });
  assert.deepEqual(planRestore({ type: "temprole_remove", executeAt: new Date(now + 60_000), intervalMs: null }, now), { kind: "schedule" });
});

test("tempRoleListLine shows the member only on the server-wide list", () => {
  const line = tempRoleListLine({ userId: "3", roleId: ROLE, expiresAtMs: 2_000_000, reason: "" }, true);
  assert.equal(line, `<@3> · <@&${ROLE}> · ends <t:2000:R>`);
  assert.ok(!tempRoleListLine({ userId: "3", roleId: ROLE, expiresAtMs: 2_000_000, reason: "r".repeat(80) }, false).startsWith("<@3>"));
});

test("softban deletes 1 to 7 days of messages, defaulting to 1", () => {
  assert.equal(softbanDeleteSeconds(null), 86_400);
  assert.equal(softbanDeleteSeconds(3), 3 * 86_400);
  assert.equal(softbanDeleteSeconds(0), 86_400);
  assert.equal(softbanDeleteSeconds(9), 7 * 86_400);
  assert.equal(softbanDeleteSeconds(2.5), 86_400);
});

test("softbanBlock refuses self, the bot, the owner and anyone already banned", () => {
  const base = { targetId: "5", actorId: "1", botId: "2", ownerId: "3", banStatus: "not_banned" as const };
  assert.equal(softbanBlock(base), null);
  assert.match(softbanBlock({ ...base, targetId: "1" }) ?? "", /yourself/);
  assert.match(softbanBlock({ ...base, targetId: "2" }) ?? "", /me/);
  assert.match(softbanBlock({ ...base, targetId: "3" }) ?? "", /owner/);
  assert.match(softbanBlock({ ...base, banStatus: "banned" }) ?? "", /already banned/);
  assert.match(softbanBlock({ ...base, banStatus: "unknown" }) ?? "", /couldn't check/);
  assert.ok(encodeURIComponent(softbanBanReason("x".repeat(900), "mod")).length <= 512);
});

test("softban and temprole are case types everywhere cases are filtered or labelled", () => {
  for (const t of ["softban", "temprole"]) {
    assert.ok((CASE_SEARCH_ACTIONS as readonly string[]).includes(t));
    assert.ok((CASE_TYPES as readonly string[]).includes(t));
  }
  for (const f of ["case.ts", "modhistory.ts", "modstats.ts", "modreport.ts", "infractions.ts"]) {
    // /case keeps its action icons next to the /case user list in case/user.ts.
    const src = fs.readFileSync(`src/commands/moderation/${f}`, "utf8")
      + (f === "case.ts" ? fs.readFileSync("src/commands/moderation/case/user.ts", "utf8") : "");
    assert.match(src, /softban:/, f);
    assert.match(src, /temprole:/, f);
  }
});

test("softban and temprole logs go to the modActions category", () => {
  for (const f of ["src/commands/moderation/softban.ts", "src/commands/moderation/temprole.ts", "src/services/tempRole.ts"]) {
    const src = fs.readFileSync(f, "utf8");
    const calls = src.split("sendGuildLog(").slice(1);
    assert.ok(calls.length > 0, f);
    for (const c of calls) assert.match(c, /"modActions"/, f);
  }
});

test("lookupBanStatus treats only Unknown Ban (10026) as not banned", async () => {
  assert.equal(await lookupBanStatus(async () => ({ user: { id: "5" } })), "banned");
  assert.equal(await lookupBanStatus(async () => { throw Object.assign(new Error("Unknown Ban"), { code: 10026 }); }), "not_banned");
  assert.equal(await lookupBanStatus(async () => { throw Object.assign(new Error("Missing Access"), { code: 50001 }); }), "unknown");
  assert.equal(await lookupBanStatus(async () => { throw new Error("socket hang up"); }), "unknown");
  assert.equal(await lookupBanStatus(async () => null), "unknown");
});

test("softban re-check after confirming aborts unless the user is confirmed not banned", () => {
  assert.equal(softbanRecheckBlock("not_banned"), null);
  assert.match(softbanRecheckBlock("banned") ?? "", /banned while you were confirming/);
  assert.match(softbanRecheckBlock("unknown") ?? "", /couldn't check/);
});
