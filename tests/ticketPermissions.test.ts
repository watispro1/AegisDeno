/** Ticket-channel creation: overwrites may only grant permissions Aegis itself holds. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits, PermissionsBitField } from "discord.js";
import {
  canCreateTicketChannels,
  grantablePermissions,
  ticketCreationFailureMessage,
  ticketPermissionOverwrites,
  TICKET_OPENER_PERMISSIONS,
} from "../src/services/ticketPermissions";

const GUILD = "800000000000000001";
const MEMBER = "500000000000000001";
const BOT = "400000000000000001";
const STAFF = "600000000000000001";

const holder = (...permissions: bigint[]) => ({ permissions: new PermissionsBitField(permissions) });

const WITHOUT_ATTACH = holder(
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles,
);

test("a bot without Attach Files still gets a working ticket channel", () => {
  const overwrites = ticketPermissionOverwrites({ guildId: GUILD, userId: MEMBER, botId: BOT, me: WITHOUT_ATTACH });
  const opener = overwrites.find(o => o.id === MEMBER);

  assert.ok(opener?.allow?.includes(PermissionFlagsBits.ViewChannel));
  assert.ok(opener?.allow?.includes(PermissionFlagsBits.SendMessages));
  assert.ok(opener?.allow?.includes(PermissionFlagsBits.ReadMessageHistory));
  assert.ok(!opener?.allow?.includes(PermissionFlagsBits.AttachFiles), "Attach Files is optional, not a creation blocker");
});

test("every overwrite only grants permissions Aegis has", () => {
  const overwrites = ticketPermissionOverwrites({
    guildId: GUILD, userId: MEMBER, botId: BOT, staffRoleId: STAFF, me: WITHOUT_ATTACH,
  });
  for (const overwrite of overwrites) {
    for (const permission of overwrite.allow ?? []) {
      assert.ok(WITHOUT_ATTACH.permissions.has(permission), `overwrite ${overwrite.id} granted a permission Aegis lacks`);
    }
  }
  assert.deepEqual(overwrites.find(o => o.id === GUILD)?.deny, [PermissionFlagsBits.ViewChannel], "private by default");
  assert.ok(overwrites.some(o => o.id === STAFF), "the staff role is included");
});

test("grantablePermissions keeps everything when the member is not cached", () => {
  assert.deepEqual(grantablePermissions(null, TICKET_OPENER_PERMISSIONS), [...TICKET_OPENER_PERMISSIONS]);
});

test("creating channels needs Manage Channels, and the failure says so", () => {
  assert.equal(canCreateTicketChannels(WITHOUT_ATTACH), true);
  assert.equal(canCreateTicketChannels(holder(PermissionFlagsBits.SendMessages)), false);
  assert.equal(canCreateTicketChannels(null), false);

  assert.match(ticketCreationFailureMessage("missing_permissions"), /Manage Channels/);
  assert.match(ticketCreationFailureMessage("failed"), /Manage Channels/);
  assert.doesNotMatch(ticketCreationFailureMessage("missing_permissions"), /already have an open ticket/);
});
