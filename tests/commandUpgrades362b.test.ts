/** Command upgrades shipped with the 3.6.2 dashboard overhaul: /autoresponder toggle, /lock duration, /starboard setup checks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits } from "discord.js";
import { command as autoresponder, formatResponderList, validateTrigger, MAX_AUTORESPONDERS } from "../src/commands/autoresponder/autoresponder";
import { command as lock, lockDurationMinutes, MAX_LOCK_MINUTES } from "../src/commands/moderation/lock";
import { missingStarboardPermissions } from "../src/commands/community/starboard";

type Json = { name: string; type: number; options?: Json[]; autocomplete?: boolean; max_length?: number };
const json = (c: { data: { toJSON(): unknown } }) => c.data.toJSON() as Json;

test("/autoresponder toggle turns one responder on or off and picks it by trigger", () => {
  const toggle = json(autoresponder).options?.find(o => o.name === "toggle");
  assert.ok(toggle, "toggle subcommand");
  const id = toggle.options?.find(o => o.name === "id");
  assert.equal(id?.autocomplete, true);
  assert.ok(toggle.options?.some(o => o.name === "enabled"), "optional enabled flag; blank flips");
  for (const sub of ["add", "create", "remove", "delete", "list"]) assert.ok(json(autoresponder).options?.some(o => o.name === sub), `${sub} kept`);
});

test("/autoresponder caps a server at 50 and the list marks switched-off responders", () => {
  const many = Array.from({ length: MAX_AUTORESPONDERS }, (_, i) => ({ trigger: `t${i}`, matchType: "contains" as const }));
  assert.match(validateTrigger("new", "contains", many) ?? "", /already has 50/);
  assert.equal(validateTrigger("new", "contains", many.slice(1)), null);
  const list = formatResponderList([{ id: "ar-1", trigger: "hi", matchType: "exact", response: "hello", enabled: false }, { id: "ar-2", trigger: "yo", matchType: "contains", response: "hey" }]);
  assert.match(list, /`hi` \(exact\) · \*\*off\*\*/);
  assert.doesNotMatch(list.split("\n\n")[1], /off/);
});

test("/lock duration takes friendly lengths up to 7 days and never conflicts silently", () => {
  for (const sub of ["channel", "category"]) {
    const s = json(lock).options?.find(o => o.name === sub);
    assert.ok(s?.options?.some(o => o.name === "duration" && o.max_length === 32), `${sub} has duration`);
    assert.ok(s?.options?.some(o => o.name === "duration_minutes"), `${sub} keeps duration_minutes`);
  }
  assert.deepEqual(lockDurationMinutes(null, null), { minutes: 0 });
  assert.deepEqual(lockDurationMinutes(15, null), { minutes: 15 }, "old option unchanged");
  assert.deepEqual(lockDurationMinutes(null, "1d 12h"), { minutes: 2160 });
  assert.deepEqual(lockDurationMinutes(0, "90m"), { minutes: 90 });
  assert.deepEqual(lockDurationMinutes(null, "7 days"), { minutes: MAX_LOCK_MINUTES });
  assert.ok("error" in lockDurationMinutes(null, "8d"));
  assert.ok("error" in lockDurationMinutes(null, "soon"));
  assert.ok("error" in lockDurationMinutes(10, "1h"), "both given");
});

test("/starboard setup names the channel permissions Aegis is missing", () => {
  assert.deepEqual(missingStarboardPermissions(() => true), []);
  assert.deepEqual(missingStarboardPermissions(f => f !== PermissionFlagsBits.EmbedLinks), ["Embed Links"]);
  assert.deepEqual(missingStarboardPermissions(() => false), ["View Channel", "Send Messages", "Embed Links"]);
});
