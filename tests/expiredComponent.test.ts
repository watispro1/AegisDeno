/** Expired component interactions get a "run the command again" notice, not silence. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
import { answerExpiredComponent, EXPIRED_COMPONENT_MESSAGE, type UnhandledComponent } from "../src/bot/interactions/expired";

function fake(state: Partial<Pick<UnhandledComponent, "replied" | "deferred">> = {}) {
  const replies: Array<{ content: string; flags: number }> = [];
  const interaction: UnhandledComponent = {
    replied: state.replied ?? false,
    deferred: state.deferred ?? false,
    async reply(options) { replies.push(options); },
  };
  return { interaction, replies };
}

test("an unhandled component gets an ephemeral explanation", async () => {
  const { interaction, replies } = fake();
  assert.equal(await answerExpiredComponent(interaction, 10, 5), true);
  assert.deepEqual(replies, [{ content: EXPIRED_COMPONENT_MESSAGE, flags: MessageFlags.Ephemeral }]);
  assert.match(EXPIRED_COMPONENT_MESSAGE, /Run the command again/);
});

test("an interaction a collector already acknowledged is left alone", async () => {
  const deferred = fake({ deferred: true });
  assert.equal(await answerExpiredComponent(deferred.interaction, 10, 5), false);
  assert.equal(deferred.replies.length, 0);

  const replied = fake({ replied: true });
  assert.equal(await answerExpiredComponent(replied.interaction, 10, 5), false);
  assert.equal(replied.replies.length, 0);
});

test("a collector that answers while we wait keeps the interaction", async () => {
  const { interaction, replies } = fake();
  const handled = answerExpiredComponent(interaction, 100, 5);
  interaction.deferred = true;
  assert.equal(await handled, false);
  assert.equal(replies.length, 0);
});

test("a dead interaction token does not throw", async () => {
  const interaction: UnhandledComponent = {
    replied: false,
    deferred: false,
    async reply() { throw new Error("10062 Unknown interaction"); },
  };
  assert.equal(await answerExpiredComponent(interaction, 5, 5), false);
});
