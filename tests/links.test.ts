/**
 * Public links are environment-driven. These tests pin the defaults, the
 * fallback for malformed values, and the exact paths used by /help, permission
 * errors and the moderation log buttons.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  caseListUrl,
  caseUrl,
  commandUrl,
  dashboardUrl,
  docsUrl,
  inviteUrl,
  siteBaseUrl,
  siteUrl,
  supportServerUrl,
} from "../src/config/links";
import { caseActionsRow, caseLabel, modLogRow } from "../src/services/modLogLinks";

const ENV_KEYS = ["SITE_URL", "SUPPORT_SERVER_URL", "BOT_INVITE_URL"] as const;

function withEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>, run: () => void): void {
  const saved = new Map<string, string | undefined>();
  for (const key of ENV_KEYS) {
    saved.set(key, process.env[key]);
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const key of ENV_KEYS) {
      const value = saved.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("links: defaults and SITE_URL override", () => {
  withEnv({ SITE_URL: undefined, SUPPORT_SERVER_URL: undefined, BOT_INVITE_URL: undefined }, () => {
    assert.equal(siteBaseUrl(), "https://aegisdeno.fly.dev");
    assert.equal(siteUrl(), "https://aegisdeno.fly.dev/");
    assert.equal(docsUrl(), "https://aegisdeno.fly.dev/docs");
    assert.equal(supportServerUrl(), "https://discord.gg/DkZUgm3q4F");
    assert.equal(inviteUrl(), "https://aegisdeno.fly.dev/invite");
  });

  withEnv({ SITE_URL: "https://staging.example.com/", SUPPORT_SERVER_URL: "https://discord.gg/test" }, () => {
    assert.equal(siteBaseUrl(), "https://staging.example.com");
    assert.equal(siteUrl("/status"), "https://staging.example.com/status");
    assert.equal(siteUrl("commands"), "https://staging.example.com/commands");
    assert.equal(supportServerUrl(), "https://discord.gg/test");
  });
});

test("links: malformed values fall back instead of producing broken buttons", () => {
  withEnv({ SITE_URL: "javascript:alert(1)", SUPPORT_SERVER_URL: "not a url" }, () => {
    assert.equal(siteBaseUrl(), "https://aegisdeno.fly.dev");
    assert.equal(supportServerUrl(), "https://discord.gg/DkZUgm3q4F");
  });
});

test("links: anchors match the command reference and dashboard routes", () => {
  withEnv({ SITE_URL: "https://aegis.example" }, () => {
    assert.equal(commandUrl("ban"), "https://aegis.example/commands#cmd-ban");
    assert.equal(commandUrl("automod", "words add"), "https://aegis.example/commands#cmd-automod-words-add");
    assert.equal(docsUrl("permissions"), "https://aegis.example/docs#permissions");
    assert.equal(dashboardUrl(), "https://aegis.example/dashboard");
    assert.equal(dashboardUrl("123"), "https://aegis.example/dashboard/123");
    assert.equal(caseListUrl("123"), "https://aegis.example/dashboard/123/cases");
    assert.equal(caseListUrl("123", "456"), "https://aegis.example/dashboard/123/cases?user=456");
    assert.equal(caseUrl("123", "65f0c0ffee0000000000abcd"), "https://aegis.example/dashboard/123/cases/65f0c0ffee0000000000abcd");
  });
});

test("links: BOT_INVITE_URL wins only when it is a usable https link", () => {
  withEnv({ SITE_URL: "https://aegis.example", BOT_INVITE_URL: "https://discord.com/oauth2/authorize?client_id=1" }, () => {
    assert.equal(inviteUrl(), "https://discord.com/oauth2/authorize?client_id=1");
  });
  withEnv({ SITE_URL: "https://aegis.example", BOT_INVITE_URL: "javascript:alert(1)" }, () => {
    assert.equal(inviteUrl(), "https://aegis.example/invite");
  });
});

test("mod log row: case, history and dashboard links, with graceful fallbacks", () => {
  withEnv({ SITE_URL: "https://aegis.example" }, () => {
    const full = modLogRow("guild1", "user1", "case-abcdef").toJSON().components;
    assert.equal(full.length, 3);
    assert.equal(caseLabel("case-abcdef"), "Case abcdef");
    assert.deepEqual(full.map((c) => ("url" in c ? c.url : null)), [
      "https://aegis.example/dashboard/guild1/cases/case-abcdef",
      "https://aegis.example/dashboard/guild1/cases?user=user1",
      "https://aegis.example/dashboard/guild1",
    ]);

    const withoutCase = modLogRow("guild1", "user1").toJSON().components;
    assert.equal(withoutCase.length, 2);

    const compact = caseActionsRow("guild1", "user1", "case-abcdef").toJSON().components;
    assert.equal(compact.length, 2);
    assert.equal(caseActionsRow("guild1", "user1").toJSON().components.length, 1);
  });
});
