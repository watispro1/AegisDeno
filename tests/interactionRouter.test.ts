import { test } from "node:test";
import assert from "node:assert/strict";
import { InteractionRouter, type ComponentRoute, type RoutableInteraction } from "../src/bot/interactions/router";
import { componentRouter } from "../src/bot/interactions";
import { serializeByKey } from "../src/bot/events/starboard";
import { starEmojiMatches } from "../src/services/communityLogic";

function fakeInteraction(customId: string, state: Partial<Pick<RoutableInteraction, "replied" | "deferred">> = {}) {
  const replies: string[] = [];
  const edits: string[] = [];
  const interaction: RoutableInteraction = {
    customId,
    replied: state.replied ?? false,
    deferred: state.deferred ?? false,
    async reply(options) { replies.push(options.content); },
    async editReply(options) { edits.push(options.content); },
  };
  return { interaction, replies, edits };
}

function route(name: string, match: string | RegExp, calls: Array<[string, RegExpMatchArray | null]>, fail = false): ComponentRoute {
  return {
    name,
    match,
    async handle(_interaction, m) {
      calls.push([name, m]);
      if (fail) throw new Error("boom");
    },
  };
}

test("string routes match by prefix and regex routes pass their match", async () => {
  const calls: Array<[string, RegExpMatchArray | null]> = [];
  const router = new InteractionRouter([
    route("prefix", "verify_start", calls),
    route("regex", /^ticket_claim_(.+)$/, calls),
  ]);

  assert.equal(await router.dispatch(fakeInteraction("verify_start").interaction), true);
  assert.equal(await router.dispatch(fakeInteraction("ticket_claim_abc-123").interaction), true);
  assert.equal(calls[0][0], "prefix");
  assert.equal(calls[0][1], null);
  assert.equal(calls[1][0], "regex");
  assert.equal(calls[1][1]?.[1], "abc-123");
});

test("the first matching route wins", () => {
  const calls: Array<[string, RegExpMatchArray | null]> = [];
  const router = new InteractionRouter([route("a", /^x_/, calls), route("b", "x_", calls)]);
  assert.equal(router.find("x_1")?.route.name, "a");
});

test("unknown customIds are left alone so command collectors can take them", async () => {
  const router = new InteractionRouter([]);
  const { interaction, replies } = fakeInteraction("help_page_2");
  assert.equal(await router.dispatch(interaction), false);
  assert.deepEqual(replies, []);
  assert.equal(await router.dispatch(fakeInteraction("").interaction), false);
});

test("a throwing handler gets an ephemeral error reply, or an edit once deferred", async () => {
  const calls: Array<[string, RegExpMatchArray | null]> = [];
  const router = new InteractionRouter([route("bad", "bad", calls, true)]);

  const fresh = fakeInteraction("bad");
  assert.equal(await router.dispatch(fresh.interaction), true);
  assert.equal(fresh.replies.length, 1);
  assert.match(fresh.replies[0], /error occurred/);

  const deferred = fakeInteraction("bad", { deferred: true });
  await router.dispatch(deferred.interaction);
  assert.equal(deferred.replies.length, 0);
  assert.equal(deferred.edits.length, 1);

  const answered = fakeInteraction("bad", { replied: true, deferred: true });
  await router.dispatch(answered.interaction);
  assert.equal(answered.replies.length + answered.edits.length, 0);
});

test("every customId the bot has ever posted still reaches the same handler", () => {
  const expected: Record<string, string> = {
    "giveaway_enter": "giveaway",
    "giveaway_entrants": "giveaway",
    "giveaway_reroll": "giveaway",
    "poll_vote_0": "poll",
    "poll_vote_9": "poll",
    "poll_end": "poll",
    "poll_results": "poll",
    "suggest_up_s-1": "suggestion",
    "suggest_down_s-1": "suggestion",
    "suggest_info_s-1": "suggestion",
    "suggest_approve_s-1": "suggestion",
    "suggest_deny_s-1": "suggestion",
    "suggest_consider_s-1": "suggestion",
    "suggestreview_approve_s-1": "suggestion-review",
    "suggestreview_deny_s-1": "suggestion-review",
    "suggestreview_consider_s-1": "suggestion-review",
    "ticket_create_general": "ticket-create",
    "ticket_create_123456789012345678": "ticket-create",
    "ticket_claim_t-1": "ticket-claim",
    "ticket_close_t-1": "ticket-close",
    "rolepanel_p1_123456789012345678": "rolepanel-button",
    "rolepanelsel_p1": "rolepanel-select",
    "verify_start": "verify-start",
    "verify_captcha_modal": "verify-captcha",
    "remindsnooze_123456789012345678_10": "reminder-snooze",
  };
  for (const [customId, name] of Object.entries(expected)) {
    assert.equal(componentRouter.find(customId)?.route.name, name, customId);
  }
});

test("customIds owned by command collectors are not routed", () => {
  for (const customId of ["poll_vote_x", "giveaway_join", "suggestreview_up_1", "confirm_yes", "case_page_2", "help_select"]) {
    assert.equal(componentRouter.find(customId), null, customId);
  }
});

test("reactions on one message are handled one after another", async () => {
  const order: string[] = [];
  const slow = serializeByKey("m1", async () => {
    order.push("a:start");
    await new Promise((r) => setTimeout(r, 20));
    order.push("a:end");
  });
  const fast = serializeByKey("m1", async () => { order.push("b"); });
  const other = serializeByKey("m2", async () => { order.push("other"); });
  await Promise.all([slow, fast, other]);
  assert.deepEqual(order.filter((o) => o !== "other"), ["a:start", "a:end", "b"]);
  assert.ok(order.indexOf("other") < order.indexOf("a:end"));
});

test("a failed reaction does not block the next one on the same message", async () => {
  await assert.rejects(serializeByKey("m3", async () => { throw new Error("x"); }));
  let ran = false;
  await serializeByKey("m3", async () => { ran = true; });
  assert.equal(ran, true);
});

test("starboard emoji matching accepts unicode names and custom emoji strings", () => {
  assert.equal(starEmojiMatches("⭐", "⭐", "⭐"), true);
  assert.equal(starEmojiMatches("<:gold:123>", "gold", "<:gold:123>"), true);
  assert.equal(starEmojiMatches("⭐", "🔥", "🔥"), false);
  assert.equal(starEmojiMatches("⭐", null, "⭐"), true);
});
