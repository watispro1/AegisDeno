import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { AegisDbEngine } from "../src/database/aegisDb/engine";
import { AegisDbServer } from "../src/database/aegisDb/server";
import { startAegisBackend, stopAegisBackend } from "../src/database/aegisDb";
import { AegisRustClient } from "../src/database/rustClient";
import { registerApiRoutes } from "../src/web/apiRoutes";

const TEST_DB_DIR = path.join(os.tmpdir(), `aegis-ts-db-${process.pid}`);
const G = "100000000000000101";
const U = "100000000000000501";
const M = "100000000000000999";

function cleanTestDir(): void {
  if (fs.existsSync(TEST_DB_DIR)) {
    fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
  }
}

test("AegisDbEngine: put, get, delete, prefixScan and persistence", () => {
  cleanTestDir();
  try {
    const engine = new AegisDbEngine(TEST_DB_DIR);

    // Guild config
    engine.put("guild_configs", "cfg:g101", { prefix: "!", automod: true });
    assert.deepEqual(engine.get("guild_configs", "cfg:g101"), { prefix: "!", automod: true });

    // Cases
    engine.put("cases", "case:g101:1", { case_id: 1, action: "ban" });
    engine.put("cases", "case:g101:2", { case_id: 2, action: "warn" });
    engine.put("cases", "case:g202:1", { case_id: 1, action: "kick" });

    const scan = engine.prefixScan("cases", "case:g101:");
    assert.equal(scan.length, 2);

    // Compaction
    const comp = engine.compact();
    assert.equal(comp.status, "success");

    // Close and recover
    engine.close();

    const recovered = new AegisDbEngine(TEST_DB_DIR);
    assert.deepEqual(recovered.get("guild_configs", "cfg:g101"), { prefix: "!", automod: true });
    assert.equal(recovered.prefixScan("cases", "case:g101:").length, 2);

    recovered.delete("guild_configs", "cfg:g101");
    assert.equal(recovered.get("guild_configs", "cfg:g101"), null);

    recovered.close();
  } finally {
    cleanTestDir();
  }
});

test("AegisDbServer: full REST API endpoints", async () => {
  cleanTestDir();
  const server = new AegisDbServer({ port: 0, secret: "secret99", dataPath: TEST_DB_DIR });
  assert.equal(await server.start(), "serving");

  try {
    const client = new AegisRustClient({ baseUrl: `http://127.0.0.1:${server.port()}`, secret: "secret99" });

    // Health
    const health = await client.health();
    assert.equal(health.status, "ok");
    assert.equal(health.service, "aegis-db");

    // Ping
    const pingOk = await client.ping();
    assert.equal(pingOk, true);

    // Stats
    const stats = await client.stats();
    assert.equal(stats.status, "ok");

    // Wrong secret is refused on the protected API
    const intruder = new AegisRustClient({ baseUrl: `http://127.0.0.1:${server.port()}`, secret: "nope" });
    await assert.rejects(() => intruder.stats(), /401/);

    // Guild Config
    assert.equal(await client.getGuildConfig(G), null);
    await client.saveGuildConfig(G, { welcome: { enabled: true } });
    const fetchedCfg = await client.getGuildConfig(G);
    assert.deepEqual(fetchedCfg, { welcome: { enabled: true } });

    // Moderation Cases
    const createdCase = await client.createCase(G, {
      target_id: U,
      mod_id: M,
      action: "timeout",
      reason: "Spam",
      duration_ms: 60000,
    });
    assert.equal(createdCase.case_id, 1);
    assert.equal(createdCase.action, "timeout");

    const cases = await client.getCases(G);
    assert.equal(cases.total, 1);
    assert.equal(cases.cases[0].reason, "Spam");

    // Patch case
    const patched = await client.patchCase(G, "1", { reason: "Spamming emotes" });
    assert.equal(patched?.reason, "Spamming emotes");

    // Warnings
    const warnRes = await client.createWarning(G, {
      user_id: U,
      mod_id: M,
      reason: "Zalgo text",
    });
    assert.ok(warnRes);

    // Economy
    const initialEco = await client.getEconomy(G, U);
    assert.equal(initialEco.wallet, 0);

    const transacted = await client.transactEconomy(G, U, { kind: "add_wallet", amount: 250 });
    assert.equal(transacted.wallet, 250);

    const lb = await client.getLeaderboard(G, 10);
    assert.equal(lb.count, 1);
    assert.equal(lb.leaderboard[0].user_id, U);
    assert.equal(lb.leaderboard[0].net_worth, 250);
  } finally {
    await server.stop();
    cleanTestDir();
  }
});

test("Website endpoints report rustBackend as healthy when native backend is present", async () => {
  cleanTestDir();
  await startAegisBackend({ port: 0, secret: "secret98", dataPath: TEST_DB_DIR });

  const app = express();
  registerApiRoutes(app, {
    online: () => true,
    databaseReady: () => true,
    stats: () => ({ guilds: 3, users: 150, commands: 25, ping: 20, uptime: 10_000 }),
    version: "3.14.0",
    startedAt: Date.now() - 10_000,
  });

  const webServer = app.listen(0);
  const port = (webServer.address() as { port: number }).port;

  try {
    const healthRes = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = await healthRes.json() as { status: string; rustBackend?: boolean };
    assert.equal(healthJson.status, "ok");
    assert.equal(healthJson.rustBackend, true);

    const statsRes = await fetch(`http://127.0.0.1:${port}/api/stats`);
    assert.equal(statsRes.status, 200);
    const statsJson = await statsRes.json() as { rustBackend?: { healthy: boolean } };
    assert.equal(statsJson.rustBackend?.healthy, true);

    // Without the admin secret only a yes/no health answer comes back.
    const backendStatsRes = await fetch(`http://127.0.0.1:${port}/api/backend/stats`);
    assert.equal(backendStatsRes.status, 200);
    assert.equal(backendStatsRes.headers.get("access-control-allow-origin"), null);
    const publicJson = await backendStatsRes.json() as Record<string, unknown>;
    assert.deepEqual(publicJson, { ok: true, healthy: true });

    const prev = process.env.AEGIS_BACKEND_SECRET;
    process.env.AEGIS_BACKEND_SECRET = "admin-secret";
    try {
      const authed = await fetch(`http://127.0.0.1:${port}/api/backend/stats`, { headers: { "x-aegis-secret": "admin-secret" } });
      const authedJson = await authed.json() as { ok: boolean; status?: string; total_documents?: number };
      assert.equal(authedJson.ok, true);
      assert.equal(authedJson.status, "ok");
      assert.equal(typeof authedJson.total_documents, "number");
      const wrong = await (await fetch(`http://127.0.0.1:${port}/api/backend/stats`, { headers: { "x-aegis-secret": "admin-secreT" } })).json();
      assert.deepEqual(wrong, { ok: true, healthy: true });
    } finally {
      if (prev === undefined) delete process.env.AEGIS_BACKEND_SECRET;
      else process.env.AEGIS_BACKEND_SECRET = prev;
    }
  } finally {
    webServer.close();
    await stopAegisBackend();
    cleanTestDir();
  }
});
