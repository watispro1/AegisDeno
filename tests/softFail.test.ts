import { test } from "node:test";
import assert from "node:assert/strict";
import { describeError, softFail } from "../src/utils/softFail";
import { reminderPostsInChannel } from "../src/services/timedActions";

function captureConsole<T>(fn: () => T): { result: T; warns: string[]; debugs: string[] } {
  const warns: string[] = [];
  const debugs: string[] = [];
  const ow = console.warn, od = console.debug, lvl = process.env.LOG_LEVEL;
  console.warn = (m: string) => { warns.push(String(m)); };
  console.debug = (m: string) => { debugs.push(String(m)); };
  process.env.LOG_LEVEL = "debug";
  try {
    return { result: fn(), warns, debugs };
  } finally {
    console.warn = ow; console.debug = od;
    if (lvl === undefined) delete process.env.LOG_LEVEL; else process.env.LOG_LEVEL = lvl;
  }
}

test("softFail resolves to null and warns with context", () => {
  const { result, warns } = captureConsole(() => softFail("Welcome message in guild 1")(Object.assign(new Error("Missing Access"), { code: 50001 })));
  assert.equal(result, null);
  assert.equal(warns.length, 1);
  assert.match(warns[0], /Welcome message in guild 1 failed: Missing Access \(code 50001\)/);
});

test("softFail keeps routine Discord errors at debug level", () => {
  const { warns, debugs } = captureConsole(() => softFail("Ban notice DM to 2")(Object.assign(new Error("Cannot send messages to this user"), { code: 50007 })));
  assert.equal(warns.length, 0);
  assert.equal(debugs.length, 1);
});

test("softFail at debug level never warns", () => {
  const { warns } = captureConsole(() => softFail("Reminder DM", "debug")(new Error("boom")));
  assert.equal(warns.length, 0);
});

test("describeError handles non-Error values", () => {
  assert.deepEqual(describeError("plain"), { code: null, text: "plain" });
  assert.equal(describeError({ message: "x", code: 10008 }).code, 10008);
});

test("reminder falls back to a channel ping when the DM fails", () => {
  assert.equal(reminderPostsInChannel(false, true), false);
  assert.equal(reminderPostsInChannel(false, false), true);
  assert.equal(reminderPostsInChannel(true, true), true);
});
