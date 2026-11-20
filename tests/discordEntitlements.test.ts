import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { discordPremiumOffer, discordSkuId, discordStoreUrl, isDiscordSkuConfigured } from "../src/config/discordSku";
import { applyDiscordEntitlement, removeDiscordEntitlement, isPremiumSku } from "../src/services/discordEntitlements";
import { memoryPremiumStore } from "../src/services/premiumStore";
import { isPremium, setPremiumStore } from "../src/services/premium";
import { command as premiumCommand } from "../src/commands/general/premium";
import { ButtonStyle } from "discord.js";

const GUILD = "800000000000000001";
const USER = "900000000000000002";
const SKU = "123456789012345678";
const ENT_ID = "987654321098765432";
const APP_ID = "223456789012345678";

// Granting Premium requires DISCORD_PREMIUM_SKU_ID, so these tests run with it set
// (and the application ID, which the store link needs), restoring the env after.
const saved = { sku: process.env.DISCORD_PREMIUM_SKU_ID, app: process.env.DISCORD_APPLICATION_ID };
const restore = (k: "DISCORD_PREMIUM_SKU_ID" | "DISCORD_APPLICATION_ID", v: string | undefined) => {
  if (v === undefined) delete process.env[k];
  else process.env[k] = v;
};
before(() => {
  process.env.DISCORD_PREMIUM_SKU_ID = SKU;
  process.env.DISCORD_APPLICATION_ID = APP_ID;
});
after(() => {
  restore("DISCORD_PREMIUM_SKU_ID", saved.sku);
  restore("DISCORD_APPLICATION_ID", saved.app);
});

test("discordSkuId parses valid snowflakes and rejects invalid ones", () => {
  assert.equal(discordSkuId({ DISCORD_PREMIUM_SKU_ID: SKU }), SKU);
  assert.equal(discordSkuId({ DISCORD_PREMIUM_SKU_ID: "invalid" }), null);
  assert.equal(discordSkuId({ DISCORD_PREMIUM_SKU_ID: "" }), null);
  assert.equal(discordSkuId({}), null);
  assert.equal(isDiscordSkuConfigured({ DISCORD_PREMIUM_SKU_ID: SKU }), true);
  assert.equal(isDiscordSkuConfigured({}), false);
});

test("isPremiumSku validates SKU matching", () => {
  assert.equal(isPremiumSku(SKU, SKU), true);
  assert.equal(isPremiumSku("999999999999999999", SKU), false);
  assert.equal(isPremiumSku(SKU, null), false, "no configured SKU: nothing grants Premium");
});

test("applyDiscordEntitlement activates Premium for a guild", async () => {
  const store = memoryPremiumStore();
  setPremiumStore(store);
  try {
    assert.equal(await isPremium(GUILD), false);

    const now = new Date("2026-11-15T12:00:00Z");
    const endsAt = new Date("2026-12-15T12:00:00Z");
    const res = await applyDiscordEntitlement(
      {
        id: ENT_ID,
        skuId: SKU,
        guildId: GUILD,
        userId: USER,
        startsAt: now,
        endsAt,
        deleted: false,
      },
      store,
      now,
    );

    assert.ok(res);
    assert.equal(res.guildId, GUILD);
    assert.equal(res.userId, USER);
    assert.equal(res.subscriptionId, `discord_${ENT_ID}`);
    assert.equal(res.status, "active");
    assert.equal(res.currentPeriodEnd?.toISOString(), endsAt.toISOString());

    // isPremium now returns true
    assert.equal(await isPremium(GUILD, now.getTime()), true);
  } finally {
    setPremiumStore(null);
  }
});

test("applyDiscordEntitlement rejects entitlements without guildId", async () => {
  const store = memoryPremiumStore();
  const res = await applyDiscordEntitlement(
    {
      id: ENT_ID,
      skuId: SKU,
      guildId: null,
      userId: USER,
    },
    store,
  );
  assert.equal(res, null);
});

test("removeDiscordEntitlement cancels an active entitlement", async () => {
  const store = memoryPremiumStore();
  setPremiumStore(store);
  try {
    const now = new Date("2026-11-15T12:00:00Z");
    await applyDiscordEntitlement(
      {
        id: ENT_ID,
        skuId: SKU,
        guildId: GUILD,
        userId: USER,
        startsAt: now,
        endsAt: new Date("2026-12-15T12:00:00Z"),
      },
      store,
      now,
    );
    assert.equal(await isPremium(GUILD, now.getTime()), true);

    const removed = await removeDiscordEntitlement(
      {
        id: ENT_ID,
        skuId: SKU,
        guildId: GUILD,
      },
      store,
      new Date("2026-11-20T12:00:00Z"),
    );

    assert.ok(removed);
    assert.equal(removed.status, "canceled");
    assert.equal(removed.currentPeriodEnd, null);
    assert.equal(await isPremium(GUILD, new Date("2026-11-20T12:00:00Z").getTime()), false);
  } finally {
    setPremiumStore(null);
  }
});

test("the Discord store URL uses the application ID and deep-links the Premium SKU", () => {
  assert.equal(discordStoreUrl({ DISCORD_APPLICATION_ID: APP_ID, DISCORD_PREMIUM_SKU_ID: SKU }), `https://discord.com/application-directory/${APP_ID}/store/${SKU}`);
  assert.equal(discordStoreUrl({ DISCORD_APPLICATION_ID: APP_ID }), `https://discord.com/application-directory/${APP_ID}/store`);
  assert.equal(discordStoreUrl({ DISCORD_PREMIUM_SKU_ID: SKU }), null);
  assert.deepEqual(discordPremiumOffer({ DISCORD_APPLICATION_ID: APP_ID, DISCORD_PREMIUM_SKU_ID: SKU }), {
    storeUrl: `https://discord.com/application-directory/${APP_ID}/store/${SKU}`,
    skuId: SKU,
  });
  assert.equal(discordPremiumOffer({ DISCORD_APPLICATION_ID: APP_ID }), null, "not on sale without the SKU");
});

test("an entitlement to any other SKU never grants Premium", async () => {
  const store = memoryPremiumStore();
  setPremiumStore(store);
  try {
    const now = new Date("2026-11-15T12:00:00Z");
    const ent = { id: ENT_ID, skuId: "999999999999999999", guildId: GUILD, userId: USER, startsAt: now, endsAt: new Date("2026-12-15T12:00:00Z") };
    assert.equal(await applyDiscordEntitlement(ent, store, now), null);
    assert.deepEqual(await store.forGuild(GUILD), []);
    assert.equal(await isPremium(GUILD, now.getTime()), false);
  } finally {
    setPremiumStore(null);
  }
});

test("without DISCORD_PREMIUM_SKU_ID no entitlement grants Premium, not even one to the usual SKU", async () => {
  const store = memoryPremiumStore();
  setPremiumStore(store);
  delete process.env.DISCORD_PREMIUM_SKU_ID;
  try {
    const now = new Date("2026-11-15T12:00:00Z");
    const ent = { id: ENT_ID, skuId: SKU, guildId: GUILD, userId: USER, startsAt: now, endsAt: new Date("2026-12-15T12:00:00Z") };
    assert.equal(await applyDiscordEntitlement(ent, store, now), null);
    assert.deepEqual(await store.forGuild(GUILD), []);
    assert.equal(await isPremium(GUILD, now.getTime()), false);
  } finally {
    process.env.DISCORD_PREMIUM_SKU_ID = SKU;
    setPremiumStore(null);
  }
});

test("/premium without the Discord SKU says Premium is coming soon on Discord, with no checkout", async () => {
  delete process.env.DISCORD_PREMIUM_SKU_ID;
  let replied: any = null;
  const mockInteraction: any = {
    guildId: GUILD,
    reply: async (payload: any) => { replied = payload; },
    deferReply: async () => { throw new Error("should not defer"); },
  };
  try {
    await premiumCommand.execute(mockInteraction);
    assert.match(replied.content, /coming soon on Discord/);
    assert.doesNotMatch(replied.content, /dashboard|checkout|stripe/i);
    assert.equal(replied.components, undefined);
  } finally {
    process.env.DISCORD_PREMIUM_SKU_ID = SKU;
  }
});

test("/premium interaction displays native button when SKU is configured", async () => {
  const store = memoryPremiumStore();
  setPremiumStore(store);

  let editedPayload: any = null;
  const mockInteraction: any = {
    guildId: GUILD,
    guild: { name: "Test Server" },
    deferReply: async () => {},
    editReply: async (payload: any) => {
      editedPayload = payload;
    },
    entitlements: new Map(),
  };

  try {
    await premiumCommand.execute(mockInteraction);
    assert.ok(editedPayload);
    assert.ok(editedPayload.components?.length > 0);
    const row = editedPayload.components[0].toJSON();
    const buttons = row.components;

    // First button should be native Discord Premium button
    const premiumBtn = buttons.find((b: any) => b.style === ButtonStyle.Premium);
    assert.ok(premiumBtn, "native premium button must be present");
    assert.equal(premiumBtn.sku_id, SKU);

    // No web checkout: no link to the dashboard to buy, only the About page
    const links = buttons.filter((b: any) => b.style === ButtonStyle.Link).map((b: any) => b.url as string);
    assert.ok(links.every((u: string) => !/\/dashboard\//.test(u)), "no dashboard purchase link");
    assert.ok(links.some((u: string) => u.endsWith("/premium")), "About Premium link");
    const embed = editedPayload.embeds[0].toJSON();
    assert.match(embed.description, /Subscribe/);
    assert.doesNotMatch(embed.description, /dashboard|stripe/i);
  } finally {
    setPremiumStore(null);
  }
});
