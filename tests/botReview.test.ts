/**
 * Regression tests for the bot-side review pass (src/bot, commands, services,
 * database, utils). Each test names the bug it pins down.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const BOT_DIRS = ["src/bot", "src/commands", "src/services", "src/database", "src/permissions", "src/utils"];

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsFiles(rel));
    else if (entry.name.endsWith(".ts")) out.push(rel);
  }
  return out;
}

test("findOneAndUpdate uses returnDocument, not the deprecated `new` option (mongoose 9 warns on every call)", () => {
  const offenders = BOT_DIRS.flatMap(tsFiles).filter((f) => /\bnew:\s*true\b/.test(fs.readFileSync(path.join(ROOT, f), "utf8")));
  assert.deepEqual(offenders, []);
});

test("per-guild collections queried on hot paths have a guildId-led index", async () => {
  const { SuggestionModel, RolePanelModel, GiveawayModel } = await import("../src/database/mongo");
  const keys = (m: { schema: { indexes(): Array<[Record<string, unknown>, unknown]> } }) => m.schema.indexes().map(([k]) => JSON.stringify(k));
  assert.ok(keys(SuggestionModel).includes(JSON.stringify({ guildId: 1, status: 1, createdAt: -1 })));
  assert.ok(keys(SuggestionModel).includes(JSON.stringify({ guildId: 1, createdAt: -1 })));
  assert.ok(keys(RolePanelModel).includes(JSON.stringify({ guildId: 1, createdAt: -1 })));
  assert.ok(keys(GiveawayModel).includes(JSON.stringify({ ended: 1, winnersDrawn: 1 })), "boot restore query is indexed");
});

test("runLatest: refreshes for one key run in order and a waiting refresh absorbs later ones", async () => {
  const { runLatest } = await import("../src/utils/latestOnly");
  const order: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const first = runLatest("k", async () => { await gate; order.push("first"); });
  await new Promise((r) => setImmediate(r)); // let the first refresh start (it now waits on the gate)
  const second = runLatest("k", async () => { order.push("second"); });
  const third = runLatest("k", async () => { order.push("third"); });
  assert.equal(second, third, "the third joins the still-waiting second");
  const forced = runLatest("k", async () => { order.push("close"); }, { coalesce: false });
  const after = runLatest("k", async () => { order.push("after-close"); });
  release();
  await Promise.all([first, second, forced, after]);
  assert.deepEqual(order, ["first", "second", "close", "after-close"]);
});

test("runLatest: a failed refresh does not block the next one", async () => {
  const { runLatest } = await import("../src/utils/latestOnly");
  const failing = runLatest("err", async () => { throw new Error("boom"); });
  await assert.rejects(failing, /boom/);
  let ran = false;
  await runLatest("err", async () => { ran = true; });
  assert.equal(ran, true);
});

test("poll vote refresh renders the newest votes and never re-opens a closed poll", async () => {
  const { refreshPollMessage } = await import("../src/services/polls");
  const base = {
    guildId: "g", channelId: "c", messageId: "m1", creatorId: "u", creatorTag: "u", question: "Q?",
    options: ["a", "b"], multiselect: false, anonymous: false, imageUrl: null, endsAt: null,
    closeTaskId: null, endedAt: null, createdAt: new Date(),
  };
  const edits: string[] = [];
  const message = { edit: async (o: { embeds: Array<{ toJSON(): { description?: string; fields?: Array<{ value: string }> } }> }) => { edits.push(JSON.stringify(o.embeds[0].toJSON())); } };
  let stored: Record<string, unknown> = { ...base, votes: { u1: [0] }, ended: false };
  const load = async () => stored as never;
  const a = refreshPollMessage("g", "m1", message as never, load);
  stored = { ...base, votes: { u1: [0], u2: [1] }, ended: false };
  const b = refreshPollMessage("g", "m1", message as never, load);
  await Promise.all([a, b]);
  assert.ok(edits.length >= 1);
  assert.match(edits[edits.length - 1], /2 voters · 2 votes/, "last edit carries both votes");
  edits.length = 0;
  stored = { ...base, votes: {}, ended: true };
  await refreshPollMessage("g", "m1", message as never, load);
  assert.equal(edits.length, 0, "closed poll is left to closePoll's final render");
});
