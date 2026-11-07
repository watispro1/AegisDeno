import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  shouldLogMessageDelete,
  markMessageDeletedByBot,
  resetDeletedMessageTracker,
  isDuplicateEvent,
} from "../src/services/deletedMessages";
import { formatPermissions } from "../src/commands/executor";
import { PermissionFlagsBits } from "discord.js";
import { commandRegistrationData } from "../src/commands/registration";
import { loadCommands } from "../src/commands/loader";

beforeEach(() => {
  resetDeletedMessageTracker();
});

test("shouldLogMessageDelete: allows first delete event for a message", () => {
  assert.equal(shouldLogMessageDelete("msg-1001"), true);
});

test("shouldLogMessageDelete: drops duplicate delete events for the same message within TTL", () => {
  assert.equal(shouldLogMessageDelete("msg-1002"), true);
  // Second event (e.g. gateway duplicate or retransmission) is dropped
  assert.equal(shouldLogMessageDelete("msg-1002"), false);
  assert.equal(shouldLogMessageDelete("msg-1002"), false);

  // Different message ID is allowed
  assert.equal(shouldLogMessageDelete("msg-1003"), true);
});

test("shouldLogMessageDelete: drops delete event when message was deleted by bot (automod / purge)", () => {
  // Automod or /purge marks the message as bot-deleted before calling message.delete()
  markMessageDeletedByBot("msg-automod-1");

  // When Discord fires MessageDelete, it is dropped to avoid sending a duplicate log
  assert.equal(shouldLogMessageDelete("msg-automod-1"), false);
});

test("formatPermissions: formats thread and moderation permission names accurately", () => {
  assert.equal(
    formatPermissions([PermissionFlagsBits.SendMessagesInThreads]),
    "Send Messages in Threads",
  );
  assert.equal(
    formatPermissions([PermissionFlagsBits.CreatePrivateThreads]),
    "Create Private Threads",
  );
  assert.equal(
    formatPermissions([PermissionFlagsBits.ManageThreads]),
    "Manage Threads",
  );
});

test("commandRegistrationData: marks guildOnly commands with dm_permission false", async () => {
  await loadCommands();
  const data = commandRegistrationData();
  const guildOnlyCommands = data.filter((d) => d.dm_permission === false);
  assert.ok(guildOnlyCommands.length > 0, "has commands with dm_permission false");

  for (const cmd of guildOnlyCommands) {
    assert.equal(cmd.dm_permission, false, `/${cmd.name} has dm_permission false`);
  }
});

test("isDuplicateEvent: detects duplicate events of the same type and ID", () => {
  assert.equal(isDuplicateEvent("msg_create", "msg-1"), false);
  assert.equal(isDuplicateEvent("msg_create", "msg-1"), true);
  assert.equal(isDuplicateEvent("msg_create", "msg-2"), false);

  // Different event types with the same ID are tracked independently
  assert.equal(isDuplicateEvent("msg_edit", "msg-1"), false);
  assert.equal(isDuplicateEvent("msg_edit", "msg-1"), true);
});

