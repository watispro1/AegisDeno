import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { AegisRustClient } from "../src/database/rustClient";
import { aegisDbState, buildStatusPayload, overallState, type StatusInput } from "../src/web/statusData";
import { registerApiRoutes } from "../src/web/apiRoutes";

const NOW = Date.parse("2026-11-01T14:00:00Z");

function fakeStatusInput(over: Partial<StatusInput> = {}): StatusInput {
  return {
    nowMs: NOW,
    online: true,
    ping: 42,
    guilds: 100,
    shards: 1,
    memoryRss: 200 * 1024 * 1024,
    version: "3.14.0",
    startedAt: NOW - 60_000,
    commands: 50,
    dbConnected: true,
    dbLatency: 5,
    registration: { ok: true, count: 50, at: NOW - 60_000 },
    samples: [],
    notices: [],
    ...over,
  };
}

test("aegisDbState: operational when healthy, degraded with note when unhealthy", () => {
  const op = aegisDbState(true);
  assert.equal(op.id, "aegisdb");
  assert.equal(op.state, "operational");

  const deg = aegisDbState(false);
  assert.equal(deg.id, "aegisdb");
  assert.equal(deg.state, "degraded");
  assert.ok(deg.detail.includes("primary store"));
});

test("buildStatusPayload: includes AegisDB when aegisDbHealthy is provided", () => {
  const p = buildStatusPayload({
    ...fakeStatusInput(),
    aegisDbHealthy: true,
  });
  const aegisComp = p.components.find((c) => c.id === "aegisdb");
  assert.ok(aegisComp);
  assert.equal(aegisComp?.state, "operational");
  assert.equal(p.status, "operational");

  // When AegisDB is degraded, overall bot status is still operational because Mongo is up
  const pDegraded = buildStatusPayload({
    ...fakeStatusInput(),
    aegisDbHealthy: false,
  });
  assert.equal(pDegraded.status, "operational");
  assert.equal(pDegraded.components.find((c) => c.id === "aegisdb")?.state, "degraded");
});

test("AegisRustClient: createWarning, patchCase, and ping", async () => {
  let warningPayload: Record<string, unknown> = {};
  let patchedPayload: Record<string, unknown> = {};

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", service: "aegis-db", version: "0.1.0", uptime_seconds: 10 }));
    } else if (req.url === "/api/guilds/g99/warnings" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => { body += c; });
      req.on("end", () => {
        warningPayload = JSON.parse(body);
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ id: "w1", ...warningPayload }));
      });
    } else if (req.url === "/api/guilds/g99/cases/c42" && req.method === "PATCH") {
      let body = "";
      req.on("data", (c) => { body += c; });
      req.on("end", () => {
        patchedPayload = JSON.parse(body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ case_id: 42, ...patchedPayload }));
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;

  try {
    const client = new AegisRustClient({ baseUrl: `http://127.0.0.1:${port}` });

    const isAlive = await client.ping();
    assert.equal(isAlive, true);

    const warnRes = await client.createWarning("g99", {
      user_id: "u123",
      mod_id: "m456",
      reason: "Spamming emotes",
      proof_url: "https://example.com/proof.png",
    });
    assert.equal(warningPayload.user_id, "u123");
    assert.equal((warnRes as { id: string }).id, "w1");

    const patchRes = await client.patchCase("g99", "c42", { reason: "Updated reason" });
    assert.equal(patchedPayload.reason, "Updated reason");
    assert.equal(patchRes?.case_id, 42);
  } finally {
    server.close();
  }
});

test("registerApiRoutes: /api/stats includes rustBackend status", async () => {
  const app = express();
  registerApiRoutes(app, {
    online: () => true,
    databaseReady: () => true,
    stats: () => ({ guilds: 5, users: 100, commands: 20, ping: 15, uptime: 30_000 }),
    version: "3.14.0",
    startedAt: Date.now() - 30_000,
  });

  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/stats`);
    assert.equal(res.status, 200);
    const body = await res.json() as { rustBackend?: { healthy: boolean } };
    assert.ok(body.rustBackend);
    assert.equal(typeof body.rustBackend.healthy, "boolean");

    const healthRes = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(healthRes.status, 200);
    const healthBody = await healthRes.json() as { rustBackend?: boolean; database?: boolean };
    assert.equal(typeof healthBody.rustBackend, "boolean");
    assert.equal(healthBody.database, true);
  } finally {
    server.close();
  }
});
