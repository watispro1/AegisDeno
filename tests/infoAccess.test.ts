import { test } from "node:test";
import assert from "node:assert/strict";
import { postAccessLabel, roleAssignLabel, type PermissionName } from "../src/services/infoAccess";

const base = { isEveryone: false, managed: false, rolePosition: 3, botHighestPosition: 10, botHasManageRoles: true };

test("roleinfo: a role below Aegis with Manage Roles is assignable", () => {
  assert.equal(roleAssignLabel(base), "Yes");
});

test("roleinfo: managed roles are never assignable, whatever the hierarchy", () => {
  assert.equal(roleAssignLabel({ ...base, managed: true }), "No (managed by a bot or integration)");
});

test("roleinfo: @everyone, missing permission and hierarchy each say why", () => {
  assert.equal(roleAssignLabel({ ...base, isEveryone: true, managed: true }), "No (@everyone)");
  assert.equal(roleAssignLabel({ ...base, botHasManageRoles: false }), "No (missing Manage Roles)");
  assert.match(roleAssignLabel({ ...base, rolePosition: 10 }), /above or equal/);
  assert.equal(roleAssignLabel({ ...base, botHighestPosition: null }), "No");
});

const grants = (...names: PermissionName[]) => (p: PermissionName) => names.includes(p);
const channel = { isThread: false, isPrivateThread: false, botInThread: false, locked: false };
const thread = { ...channel, isThread: true };

test("channelinfo: text channels use Send Messages", () => {
  assert.equal(postAccessLabel({ ...channel, has: grants("ViewChannel", "SendMessages") }), "Yes");
  assert.equal(postAccessLabel({ ...channel, has: grants("ViewChannel", "SendMessagesInThreads") }), "No (missing Send Messages)");
});

test("channelinfo: threads use Send Messages in Threads, not Send Messages", () => {
  assert.equal(postAccessLabel({ ...thread, has: grants("ViewChannel", "SendMessagesInThreads") }), "Yes");
  assert.equal(postAccessLabel({ ...thread, has: grants("ViewChannel", "SendMessages") }), "No (missing Send Messages in Threads)");
});

test("channelinfo: threads need the parent channel to be visible", () => {
  assert.equal(postAccessLabel({ ...thread, has: grants("SendMessagesInThreads") }), "No (can't view the parent channel)");
});

test("channelinfo: private threads need membership or Manage Threads", () => {
  const priv = { ...thread, isPrivateThread: true };
  assert.equal(postAccessLabel({ ...priv, has: grants("ViewChannel", "SendMessagesInThreads") }), "No (not added to this private thread)");
  assert.equal(postAccessLabel({ ...priv, botInThread: true, has: grants("ViewChannel", "SendMessagesInThreads") }), "Yes");
  assert.equal(postAccessLabel({ ...priv, has: grants("ViewChannel", "SendMessagesInThreads", "ManageThreads") }), "Yes");
});

test("channelinfo: locked threads need Manage Threads", () => {
  assert.equal(postAccessLabel({ ...thread, locked: true, has: grants("ViewChannel", "SendMessagesInThreads") }), "No (thread is locked)");
  assert.equal(postAccessLabel({ ...thread, locked: true, has: grants("ViewChannel", "SendMessagesInThreads", "ManageThreads") }), "Yes");
});
