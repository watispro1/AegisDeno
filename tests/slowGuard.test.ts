/** Slow-command safety net: defer before Discord's deadline and keep replies working. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
import {
  isEphemeralReply,
  startSlowCommandGuard,
  type SlowGuardInteraction,
} from "../src/commands/slowGuard";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function fakeInteraction() {
  const calls = {
    reply: [] as Array<Record<string, unknown>>,
    editReply: [] as Array<Record<string, unknown>>,
    followUp: [] as Array<Record<string, unknown>>,
    defer: 0,
    deleteReply: 0,
  };
  const interaction: SlowGuardInteraction & { settled: boolean } = {
    replied: false,
    deferred: false,
    settled: false,
    async deferReply() {
      calls.defer++;
      interaction.deferred = true;
    },
    async reply(options) {
      calls.reply.push(options);
      interaction.replied = true;
      return { id: "reply" };
    },
    async editReply(options) {
      calls.editReply.push(options);
      if (options.withResponse) return { resource: { message: { id: "edited" } } };
      return { id: "edited" };
    },
    async deleteReply() {
      calls.deleteReply++;
    },
    async followUp(options) {
      calls.followUp.push(options);
      return { id: "followup" };
    },
  };
  return { interaction, calls };
}

test("a fast reply is left exactly as the command wrote it", async () => {
  const { interaction, calls } = fakeInteraction();
  const stop = startSlowCommandGuard(interaction, 50);
  await interaction.reply({ content: "fast", flags: MessageFlags.Ephemeral });
  stop();

  assert.equal(calls.defer, 0);
  assert.deepEqual(calls.reply, [{ content: "fast", flags: MessageFlags.Ephemeral }]);
  assert.equal(calls.editReply.length, 0);
});

test("a slow public reply defers, then edits the deferred response", async () => {
  const { interaction, calls } = fakeInteraction();
  const stop = startSlowCommandGuard(interaction, 5);
  await sleep(20);

  assert.equal(calls.defer, 1, "the guard deferred for the command");
  await interaction.reply({ content: "done later" });
  stop();

  assert.equal(calls.reply.length, 0);
  assert.deepEqual(calls.editReply, [{ content: "done later" }]);
});

test("a slow ephemeral reply keeps its privacy: placeholder removed, private follow-up", async () => {
  const { interaction, calls } = fakeInteraction();
  const stop = startSlowCommandGuard(interaction, 5);
  await sleep(20);
  await interaction.reply({ content: "only for you", flags: MessageFlags.Ephemeral });
  stop();

  assert.equal(calls.deleteReply, 1, "the public placeholder is deleted");
  assert.equal(calls.reply.length, 0);
  assert.equal(calls.followUp.length, 1);
  assert.equal(calls.followUp[0].content, "only for you");
  assert.ok(isEphemeralReply(calls.followUp[0]), "the follow-up stays ephemeral");
});

test("fetchReply on a slow reply still returns a message", async () => {
  const { interaction } = fakeInteraction();
  const stop = startSlowCommandGuard(interaction, 5);
  await sleep(20);
  const message = await interaction.reply({ content: "with message", fetchReply: true });
  stop();

  assert.deepEqual(message, { id: "edited" });
});

test("a command that defers itself in time is not deferred twice", async () => {
  const { interaction, calls } = fakeInteraction();
  const stop = startSlowCommandGuard(interaction, 20);
  await interaction.deferReply();
  await sleep(30);
  stop();

  assert.equal(calls.defer, 1);
});

test("a partial interaction without deferReply is left alone instead of crashing the command", async () => {
  const replies: Array<Record<string, unknown>> = [];
  const partial = {
    replied: false,
    deferred: false,
    async reply(options: Record<string, unknown>) { replies.push(options); },
  } as unknown as SlowGuardInteraction;

  const stop = startSlowCommandGuard(partial, 5);
  await sleep(20);
  await partial.reply({ content: "still works" });
  stop();

  assert.deepEqual(replies, [{ content: "still works" }]);
});

test("ephemeral flags are recognised", () => {
  assert.equal(isEphemeralReply({ flags: MessageFlags.Ephemeral }), true);
  assert.equal(isEphemeralReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }), true);
  assert.equal(isEphemeralReply({ flags: 0 }), false);
  assert.equal(isEphemeralReply({}), false);
  assert.equal(isEphemeralReply(undefined), false);
});
