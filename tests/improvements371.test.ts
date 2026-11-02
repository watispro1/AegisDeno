/** 3.7.1 improvements: ticketService split, /serverinfo and /userinfo text helpers, file-size guard. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dateAndAgo, fitNames, serverSecurityText, timeoutLine } from "../src/services/infoFormat";

test("ticketService still exports the close/transcript/settings API from its split modules", async () => {
  const svc = await import("../src/services/ticketService");
  const close = await import("../src/services/ticketClose");
  const settings = await import("../src/services/ticketSettings");
  assert.equal(svc.closeTicket, close.closeTicket);
  assert.equal(svc.buildTicketTranscript, close.buildTicketTranscript);
  assert.equal(svc.ensureAutoCloseChecks, close.ensureAutoCloseChecks);
  assert.equal(svc.runTicketAutoClose, close.runTicketAutoClose);
  assert.equal(svc.getTicketSettings, settings.getTicketSettings);
  assert.equal(svc.updateTicketSettings, settings.updateTicketSettings);
  for (const fn of ["createTicketChannel", "claimTicket", "canManageTicket", "canCloseTicket", "postTicketPanel", "addUserToTicket", "removeUserFromTicket", "buildTicketControls"] as const) {
    assert.equal(typeof svc[fn], "function", fn);
  }
});

test("files added or split in 3.7.1 stay under 400 lines", () => {
  for (const f of [
    "src/services/ticketService.ts", "src/services/ticketClose.ts", "src/services/ticketSettings.ts",
    "src/services/economyLogic.ts", "src/services/economyStore.ts", "src/services/economyMongo.ts", "src/services/economyService.ts", "src/services/economyDiscord.ts",
    "src/commands/economy/shop.ts", "src/commands/economy/economy.ts", "src/commands/automod/automod.ts", "src/services/automodExempt.ts",
    "src/web/dashboard/routes/economy.ts", "src/web/dashboard/views/economy.ts", "src/web/dashboard/economyValidation.ts", "src/services/infoFormat.ts",
  ]) {
    const lines = readFileSync(join(__dirname, "..", f), "utf8").split("\n").length;
    assert.ok(lines < 400, `${f} has ${lines} lines`);
  }
});

test("/serverinfo security text uses labels, not Discord's raw numbers", () => {
  const text = serverSecurityText({ name: "Test", verificationLevel: 2, explicitContentFilter: 1, defaultMessageNotifications: 1, mfaLevel: 1 });
  assert.match(text, /Medium \(Registered > 5m\)/);
  assert.match(text, /Members Without Roles/);
  assert.match(text, /Only @mentions/);
  assert.match(text, /Required for moderators \(2FA\)/);
  assert.doesNotMatch(text, /`\d`/);
  assert.match(serverSecurityText({ name: "T", verificationLevel: 9, explicitContentFilter: 0, defaultMessageNotifications: 0, mfaLevel: 0 }), /Level 9/);
});

test("fitNames: fits the limit, says how many were left out, defuses mentions and markdown", () => {
  assert.equal(fitNames(["Admin", "Mod"], 100), "Admin, Mod");
  assert.equal(fitNames([], 100), "None");
  const many = Array.from({ length: 300 }, (_, i) => `Role number ${i}`);
  const out = fitNames(many, 200);
  assert.ok(out.length <= 200, String(out.length));
  assert.match(out, /\+\d+ more$/);
  const shown = out.replace(/ \+\d+ more$/, "").split(", ").length;
  assert.equal(Number(out.match(/\+(\d+) more$/)![1]) + shown, 300, "counts add up");
  assert.equal(fitNames(["@everyone", "**bold**"], 100), "@\u200beveryone, bold");
});

test("timeoutLine and dateAndAgo", () => {
  const now = 1_700_000_000_000;
  assert.equal(timeoutLine(null, now), null);
  assert.equal(timeoutLine(now - 1, now), null, "an expired timeout is not shown");
  assert.equal(timeoutLine(now + 60_000, now), `Timed out, ends <t:${(now + 60_000) / 1000}:R>`);
  assert.equal(dateAndAgo(now), `<t:${now / 1000}:D> (<t:${now / 1000}:R>)`);
});
