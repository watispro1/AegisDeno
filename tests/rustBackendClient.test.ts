import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { AegisRustClient } from "../src/database/rustClient";

test("AegisRustClient: health, stats and compact endpoints", async () => {
  let receivedSecret = "";
  const server = http.createServer((req, res) => {
    receivedSecret = req.headers["x-aegis-secret"] as string;
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", service: "aegis-db", version: "0.1.0", uptime_seconds: 42 }));
    } else if (req.url === "/api/db/stats") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ total_documents: 10, collections_count: 5 }));
    } else if (req.url === "/api/db/compact" && req.method === "POST") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "success", message: "compacted" }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;

  try {
    const client = new AegisRustClient({
      baseUrl: `http://127.0.0.1:${port}`,
      secret: "test-secret-123",
    });

    const health = await client.health();
    assert.equal(health.status, "ok");
    assert.equal(health.service, "aegis-db");
    assert.equal(health.uptime_seconds, 42);
    assert.equal(receivedSecret, "test-secret-123");

    const stats = await client.stats();
    assert.equal(stats.total_documents, 10);

    const compact = await client.compact();
    assert.equal(compact.status, "success");
  } finally {
    server.close();
  }
});

test("AegisRustClient: guild config and cases roundtrip", async () => {
  let storedConfig: Record<string, unknown> = {};
  const server = http.createServer((req, res) => {
    if (req.url === "/api/guilds/g123/config" && req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        storedConfig = JSON.parse(body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(storedConfig));
      });
    } else if (req.url === "/api/guilds/g123/config" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(storedConfig));
    } else if (req.url === "/api/guilds/g404/config") {
      res.writeHead(404);
      res.end();
    } else if (req.url?.startsWith("/api/guilds/g123/cases") && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        guild_id: "g123",
        total: 1,
        skip: 0,
        limit: 50,
        cases: [{ case_id: 1, action: "ban", reason: "Spam" }],
      }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;

  try {
    const client = new AegisRustClient({ baseUrl: `http://127.0.0.1:${port}` });

    // 404 returns null
    const notFound = await client.getGuildConfig("g404");
    assert.equal(notFound, null);

    // Save and fetch
    await client.saveGuildConfig("g123", { prefix: "!", automod: { enabled: true } });
    const fetched = await client.getGuildConfig("g123");
    assert.equal(fetched?.prefix, "!");

    // Cases
    const cases = await client.getCases("g123", { limit: 10 });
    assert.equal(cases.total, 1);
    assert.equal(cases.cases[0].action, "ban");
  } finally {
    server.close();
  }
});

test("AegisRustClient: economy and leaderboard", async () => {
  const server = http.createServer((req, res) => {
    if (req.url === "/api/guilds/g1/economy/u1" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ guild_id: "g1", user_id: "u1", wallet: 500, bank: 1000, bank_capacity: 5000, daily_streak: 3 }));
    } else if (req.url === "/api/guilds/g1/economy/u1/transact" && req.method === "POST") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ guild_id: "g1", user_id: "u1", wallet: 600, bank: 1000, bank_capacity: 5000, daily_streak: 3 }));
    } else if (req.url?.startsWith("/api/guilds/g1/economy/leaderboard")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ guild_id: "g1", count: 1, leaderboard: [{ rank: 1, user_id: "u1", wallet: 600, bank: 1000, net_worth: 1600 }] }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;

  try {
    const client = new AegisRustClient({ baseUrl: `http://127.0.0.1:${port}` });
    const eco = await client.getEconomy("g1", "u1");
    assert.equal(eco.wallet, 500);

    const updated = await client.transactEconomy("g1", "u1", { kind: "add_wallet", amount: 100 });
    assert.equal(updated.wallet, 600);

    const lb = await client.getLeaderboard("g1", 5);
    assert.equal(lb.count, 1);
    assert.equal(lb.leaderboard[0].net_worth, 1600);
  } finally {
    server.close();
  }
});
