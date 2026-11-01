/**
 * 3.7.0 bug-fix round 4: collector handlers no longer leak unhandled
 * rejections, /announce and /embed check the member's own access to the target
 * channel (and Mention Everyone for pings), and model files were split without
 * changing what mongo.ts exports.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PermissionFlagsBits, PermissionsBitField } from "discord.js";
import { guardCollect, COLLECT_FAILED } from "../src/utils/collectorGuard";
import { postRefusal } from "../src/utils/channelAccess";
import * as mongo from "../src/database/mongo";

const fakeI = (o: { deferred?: boolean; replied?: boolean; failReply?: boolean } = {}) => {
  const sent: Array<{ how: string; content: string }> = [];
  return {
    sent, deferred: o.deferred ?? false, replied: o.replied ?? false,
    reply: async (m: { content: string }) => { if (o.failReply) throw new Error("Unknown interaction"); sent.push({ how: "reply", content: m.content }); },
    followUp: async (m: { content: string }) => { sent.push({ how: "followUp", content: m.content }); },
  };
};

test("guardCollect: a throwing handler is caught and the user gets an ephemeral notice", async () => {
  const fresh = fakeI();
  await guardCollect("t", fresh, async () => { throw new Error("boom"); });
  assert.deepEqual(fresh.sent, [{ how: "reply", content: COLLECT_FAILED }]);
  const deferred = fakeI({ deferred: true });
  await guardCollect("t", deferred, async () => { throw new Error("boom"); });
  assert.equal(deferred.sent[0].how, "followUp");
  // Even when the token is gone, nothing escapes.
  await assert.doesNotReject(guardCollect("t", fakeI({ failReply: true }), async () => { throw new Error("expired"); }));
  const ok = fakeI();
  await guardCollect("t", ok, async () => undefined);
  assert.equal(ok.sent.length, 0);
});

test("every command collector uses guardCollect", () => {
  const dir = path.join(__dirname, "..", "src", "commands");
  const offenders: string[] = [];
  for (const sub of fs.readdirSync(dir)) {
    const p = path.join(dir, sub);
    if (!fs.statSync(p).isDirectory()) continue;
    for (const f of fs.readdirSync(p)) {
      const src = fs.readFileSync(path.join(p, f), "utf8");
      if (/collector\.on\("collect", async/.test(src)) offenders.push(`${sub}/${f}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("postRefusal: view + send required, Mention Everyone for pings, unknown perms refused", () => {
  const perms = (...flags: bigint[]) => new PermissionsBitField(flags);
  assert.equal(postRefusal(perms(PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages), "1"), null);
  assert.match(postRefusal(perms(PermissionFlagsBits.ViewChannel), "1") ?? "", /can't post/);
  assert.match(postRefusal(perms(PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages), "1", { pingEveryone: true }) ?? "", /Mention Everyone/);
  assert.equal(postRefusal(perms(PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.MentionEveryone), "1", { pingEveryone: true }), null);
  assert.match(postRefusal(null, "1") ?? "", /could not be checked/);
});

test("mongo.ts still exports every model after the split", () => {
  for (const name of ["GuildConfigModel", "WarningModel", "ModerationCaseModel", "StarboardConfigModel", "WatchlistEntryModel", "BanAppealModel", "AutomodHitModel", "UserActivityModel", "DashboardSessionModel", "DashboardRateLimitModel", "DashboardAuditModel"]) {
    assert.ok((mongo as Record<string, unknown>)[name], name);
  }
  const ttl = mongo.UserActivityModel.schema.indexes().find(([spec]) => "lastMessageAt" in spec);
  assert.equal(ttl?.[1]?.expireAfterSeconds, 180 * 24 * 60 * 60);
});
