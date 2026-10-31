/**
 * Dashboard role hierarchy (3.6.2 / dashboard 1.2.3): roles the dashboard hands
 * out (verified role, join role, role panel re-posts) must sit below the
 * viewer's own highest role, the same rule as /rolepanel create and
 * /verify setup. The server owner is exempt; Administrator is not.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits, type Client } from "discord.js";
import { discordBotView, markRolesForViewer, rolePickable, type RoleOption } from "../src/web/dashboard/botView";
import {
  ROLE_ABOVE_VIEWER_ERROR,
  parseVerification,
  parseVerificationPanel,
  parseWelcome,
  rolePanelBlockedRole,
  type ValidationContext,
} from "../src/web/dashboard/validation";
import { Form, roleOptions, rolePickerEmptyNote } from "../src/web/dashboard/views/form";

const OWNER = "900000000000000099";
const VIEWER = "900000000000000001";
const CH = "111111111111111111";
const LOW = "333333333333333331";
const MID = "333333333333333332";
const HIGH = "333333333333333333";

const roles: RoleOption[] = [
  { id: HIGH, name: "Admin", position: 10, assignable: false },
  { id: MID, name: "Senior Mod", position: 6, assignable: true },
  { id: LOW, name: "Verified", position: 2, assignable: true },
];

function vctx(marked: RoleOption[]): ValidationContext {
  return {
    textChannelIds: new Set([CH]),
    roles: new Map(marked.map(r => [r.id, { assignable: r.assignable, aboveViewer: r.aboveViewer === true }])),
  };
}

test("markRolesForViewer: roles at or above the viewer's top role are marked, owner exempt, unknown fails closed", () => {
  const mod = markRolesForViewer(roles, VIEWER, { ownerId: OWNER, topPosition: 6 });
  assert.deepEqual(mod.map(r => [r.id, r.aboveViewer]), [[HIGH, true], [MID, true], [LOW, false]], "equal position counts as above");
  assert.deepEqual(mod.filter(rolePickable).map(r => r.id), [LOW]);

  const owner = markRolesForViewer(roles, OWNER, { ownerId: OWNER, topPosition: 0 });
  assert.ok(owner.every(r => !r.aboveViewer), "owner may pick any role");
  assert.deepEqual(owner.filter(rolePickable).map(r => r.id), [MID, LOW], "but still only roles Aegis can assign");

  const unknown = markRolesForViewer(roles, VIEWER, { ownerId: OWNER, topPosition: null });
  assert.ok(unknown.every(r => r.aboveViewer), "viewer who could not be fetched gets nothing");
  assert.ok(markRolesForViewer(roles, VIEWER, undefined).every(r => r.aboveViewer), "no limit in context fails closed");
});

test("discordBotView.viewerRoleLimit reads the top role live; Administrator is still bounded by it", async () => {
  const member = {
    id: VIEWER,
    roles: { highest: { position: 4 } },
    permissions: { has: (p: bigint) => p === PermissionFlagsBits.Administrator, bitfield: PermissionFlagsBits.Administrator },
  };
  const guild = {
    id: "800000000000000001",
    ownerId: OWNER,
    members: {
      cache: new Map<string, unknown>(),
      fetch: async (id: string) => { if (id === VIEWER) return member; throw new Error("Unknown Member"); },
      me: { roles: { highest: { position: 8 } }, permissions: { has: () => true } },
    },
    roles: { cache: new Map([
      ["800000000000000001", { id: "800000000000000001", name: "@everyone", position: 0, managed: false }],
      [MID, { id: MID, name: "Senior Mod", position: 6, managed: false }],
      [LOW, { id: LOW, name: "Verified", position: 2, managed: false }],
    ]) },
    channels: { cache: new Map() },
  };
  const client = { guilds: { cache: new Map([[guild.id, guild]]) }, users: { cache: new Map() } } as unknown as Client;
  const view = discordBotView(client);

  assert.deepEqual(await view.viewerRoleLimit(guild.id, VIEWER), { ownerId: OWNER, topPosition: 4 });
  assert.deepEqual(await view.viewerRoleLimit(guild.id, "900000000000000002"), { ownerId: OWNER, topPosition: null }, "unknown member fails closed");
  assert.deepEqual(await view.viewerRoleLimit("800000000000000404", VIEWER), { ownerId: null, topPosition: null });
  assert.deepEqual(view.roles(guild.id).map(r => [r.id, r.position, r.assignable]), [[MID, 6, true], [LOW, 2, true]]);

  const marked = markRolesForViewer(view.roles(guild.id), VIEWER, await view.viewerRoleLimit(guild.id, VIEWER));
  assert.deepEqual(marked.filter(rolePickable).map(r => r.id), [LOW], "Administrator with a low top role cannot hand out a higher role");
});

test("validation refuses a role above the viewer server-side, whatever the form posted", () => {
  const ctx = vctx(markRolesForViewer(roles, VIEWER, { ownerId: OWNER, topPosition: 5 }));
  const panel = parseVerificationPanel({ channelId: CH, verifiedRoleId: MID, type: "button" }, ctx);
  assert.deepEqual(panel, { ok: false, errors: { verifiedRoleId: ROLE_ABOVE_VIEWER_ERROR } });
  assert.ok(parseVerificationPanel({ channelId: CH, verifiedRoleId: LOW, type: "button" }, ctx).ok);

  const welcome = parseWelcome({ welcomeMessage: "hi", welcomeRoleId: MID }, ctx);
  assert.ok(!welcome.ok && welcome.errors.welcomeRoleId === ROLE_ABOVE_VIEWER_ERROR);
  assert.ok(parseWelcome({ welcomeMessage: "hi", welcomeRoleId: LOW }, ctx).ok);

  const verification = parseVerification({ verifiedRoleId: MID, type: "button" }, ctx);
  assert.ok(!verification.ok && verification.errors.verifiedRoleId === ROLE_ABOVE_VIEWER_ERROR);

  // Aegis's own limit still comes first.
  const high = parseVerificationPanel({ channelId: CH, verifiedRoleId: HIGH, type: "button" }, ctx);
  assert.ok(!high.ok && /Aegis cannot assign/.test(high.errors.verifiedRoleId));

  const ownerCtx = vctx(markRolesForViewer(roles, OWNER, { ownerId: OWNER, topPosition: 0 }));
  assert.ok(parseVerificationPanel({ channelId: CH, verifiedRoleId: MID, type: "button" }, ownerCtx).ok, "owner may pick it");
});

test("settings may keep an already-saved role above the viewer, but not switch to one", () => {
  const ctx = vctx(markRolesForViewer(roles, VIEWER, { ownerId: OWNER, topPosition: 5 }));
  const keep = parseVerification({ verifiedRoleId: MID, type: "captcha" }, ctx, { verifiedRoleId: MID });
  assert.ok(keep.ok && keep.value.verifiedRoleId === MID && keep.value.type === "captcha");
  assert.ok(parseWelcome({ welcomeMessage: "hi", welcomeRoleId: MID }, ctx, { welcomeRoleId: MID }).ok);
  assert.ok(!parseWelcome({ welcomeMessage: "hi", welcomeRoleId: MID }, ctx, { welcomeRoleId: LOW }).ok);
  // Posting a panel is a new grant: no saved-role exemption there.
  assert.ok(!parseVerificationPanel({ channelId: CH, verifiedRoleId: MID, type: "button" }, ctx).ok);
});

test("rolePanelBlockedRole finds the first panel role above the viewer", () => {
  const ctx = vctx(markRolesForViewer(roles, VIEWER, { ownerId: OWNER, topPosition: 5 }));
  assert.equal(rolePanelBlockedRole([LOW, MID], ctx), MID);
  assert.equal(rolePanelBlockedRole([LOW], ctx), null);
  assert.equal(rolePanelBlockedRole(["999999999999999999"], ctx), null, "a deleted role is not a hierarchy problem");
  assert.equal(rolePanelBlockedRole([MID], vctx(markRolesForViewer(roles, OWNER, { ownerId: OWNER, topPosition: 0 }))), null);
});

test("role pickers grey out roles with the reason, and explain an empty picker", () => {
  const marked = markRolesForViewer(roles, VIEWER, { ownerId: OWNER, topPosition: 5 });
  const opts = roleOptions(marked, "No role");
  assert.deepEqual(opts.map(o => [o.label, o.disabled ?? false]), [
    ["No role", false],
    ["@Admin (Aegis cannot assign)", true],
    ["@Senior Mod (above your highest role)", true],
    ["@Verified", false],
  ]);
  assert.equal(rolePickerEmptyNote(marked), "");
  const none = markRolesForViewer(roles, VIEWER, { ownerId: OWNER, topPosition: 1 });
  assert.match(rolePickerEmptyNote(none), /equal to or above your highest role/);
  assert.match(rolePickerEmptyNote(roles.map(r => ({ ...r, assignable: false }))), /Manage Roles/);
  assert.match(rolePickerEmptyNote([]), /no roles besides @everyone/);
});

test("a saved choice that is now greyed out stays selected and is submitted, not silently dropped", () => {
  const marked = markRolesForViewer(roles, VIEWER, { ownerId: OWNER, topPosition: 5 });
  const html = new Form({ values: { welcomeRoleId: MID }, errors: {} }).select("welcomeRoleId", "Role", roleOptions(marked, "No role"));
  assert.match(html, new RegExp(`<option value="${MID}" selected>`), "saved option is selected and not disabled");
  assert.match(html, new RegExp(`<option value="${HIGH}" disabled>`), "other blocked options stay disabled");
});
