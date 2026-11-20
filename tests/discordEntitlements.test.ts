import test from "node:test";
import assert from "node:assert/strict";
import { discordSkuId, isDiscordSkuConfigured } from "../src/config/discordSku";
import { applyDiscordEntitlement, removeDiscordEntitlement, isPremiumSku } from "../src/services/discordEntitlements";
import { memoryPremiumStore } from "../src/services/premiumStore";
import { isPremium, setPremiumStore } from "../src/services/premium";
import { command as premiumCommand } from "../src/commands/general/premium";
import { ButtonStyle } from "discord.js";

const GUILD = "800000000000000001";
const USER = "900000000000000002";
const SKU = "123456789012345678";
const ENT_ID = "987654321098765432";

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
  assert.equal(isPremiumSku(SKU, null), true);
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

test("/premium interaction displays native button when SKU is configured", async () => {
  const origSku = process.env.DISCORD_PREMIUM_SKU_ID;
  process.env.DISCORD_PREMIUM_SKU_ID = SKU;
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

    // Dashboard link should also be present
    const dashBtn = buttons.find((b: any) => b.label?.includes("Dashboard"));
    assert.ok(dashBtn, "dashboard link button must be present");
  } finally {
    process.env.DISCORD_PREMIUM_SKU_ID = origSku;
    setPremiumStore(null);
  }
});
