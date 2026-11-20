import { after, afterEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { AegisDbEngine } from "../src/database/aegisDb/engine";
import { AegisDbServer } from "../src/database/aegisDb/server";
import { getAegisDbEngine, startAegisBackend, stopAegisBackend } from "../src/database/aegisDb";
import * as ops from "../src/database/aegisDb/operations";
import { AegisRustClient } from "../src/database/rustClient";

const G = "300000000000000001";
const G2 = "300000000000000002";
const U = "300000000000000002";
const M = "300000000000000003";
const SECRET = "cases-secret";
const caseBody = (extra: Record<string, unknown> = {}) => ({ target_id: U, mod_id: M, action: "warn", reason: "r", ...extra });

const dirs: string[] = [];
function tmpDir(name: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `aegis-cases-${name}-`));
  dirs.push(d);
  return d;
}
const engines: AegisDbEngine[] = [];
function engine(dir = tmpDir("e")): AegisDbEngine {
  const e = new AegisDbEngine(dir);
  engines.push(e);
  return e;
}
const servers: AegisDbServer[] = [];

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return fn().finally(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

afterEach(async () => {
  for (const e of engines.splice(0)) e.close();
  for (const s of servers.splice(0)) await s.stop();
  await stopAegisBackend();
});
after(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

test("case ids come from a per-guild counter and case_ref lookups never scan", () => {
  const db = engine();
  const a = ops.createCase(db, G, caseBody({ case_ref: "ref-a" }));
  const b = ops.createCase(db, G, caseBody({ case_ref: "ref-b" }));
  const other = ops.createCase(db, G2, caseBody());
  assert.equal(a.status, 201);
  assert.equal((a.body as { case_id: number }).case_id, 1);
  assert.equal((b.body as { case_id: number }).case_id, 2);
  assert.equal((other.body as { case_id: number }).case_id, 1, "counters are per guild");
  assert.equal(db.get("counters", ops.caseCounterKey(G)), 2);
  assert.equal(db.get("case_refs", ops.caseRefKey(G, "ref-b")), 2);

  const scan = mock.method(db, "prefixScan");
  try {
    const c = ops.createCase(db, G, caseBody({ case_ref: "ref-c" }));
    assert.equal((c.body as { case_id: number }).case_id, 3);
    const dup = ops.createCase(db, G, caseBody({ case_ref: "ref-a" }));
    assert.equal(dup.status, 200, "a repeated case_ref is an idempotent retry");
    assert.equal((dup.body as { case_id: number }).case_id, 1);
    assert.equal((ops.getCase(db, G, "ref-b").body as { case_id: number }).case_id, 2);
    const patched = ops.patchCase(db, G, "ref-c", { revoked: true, revoked_by: M });
    assert.equal((patched.body as { revoked: boolean }).revoked, true);
    assert.equal(ops.getCase(db, G, "ref-zzz").status, 404);
    assert.equal(scan.mock.callCount(), 0, "no prefix scans once the guild is indexed");
  } finally {
    scan.mock.restore();
  }
});

test("lazy backfill: a guild with pre-index data is scanned once, then never again", () => {
  const dir = tmpDir("legacy");
  const legacy = new AegisDbEngine(dir);
  // Data written by the old code: cases only, no counter, no case_ref index.
  legacy.put("cases", `case:${G}:1`, { case_id: 1, case_ref: "old-1", guild_id: G, target_id: U, mod_id: M, action: "ban", reason: "", created_at: 1 });
  legacy.put("cases", `case:${G}:7`, { case_id: 7, case_ref: "old-7", guild_id: G, target_id: U, mod_id: M, action: "kick", reason: "", created_at: 2 });
  legacy.close();

  const db = engine(dir);
  const scan = mock.method(db, "prefixScan");
  try {
    assert.equal((ops.getCase(db, G, "old-7").body as { case_id: number }).case_id, 7, "ref lookup works on legacy data");
    const next = ops.createCase(db, G, caseBody({ case_ref: "new-1" }));
    assert.equal((next.body as { case_id: number }).case_id, 8, "counter seeded from the highest existing id");
    assert.equal(ops.createCase(db, G, caseBody({ case_ref: "old-1" })).status, 200, "legacy refs are deduplicated");
    ops.createCase(db, G, caseBody());
    ops.getCase(db, G, "old-1");
    assert.equal(scan.mock.callCount(), 1, "exactly one backfill scan");
  } finally {
    scan.mock.restore();
  }
  assert.equal(db.get("counters", ops.caseCounterKey(G)), 9);
  assert.equal(db.get("case_refs", ops.caseRefKey(G, "old-1")), 1);
});

test("counter and case_ref index survive a restart (WAL replay and snapshot)", () => {
  const dir = tmpDir("restart");
  const e1 = new AegisDbEngine(dir);
  ops.createCase(e1, G, caseBody({ case_ref: "r1" }));
  ops.createCase(e1, G, caseBody({ case_ref: "r2" }));
  e1.close();
  const e2 = engine(dir);
  const scan = mock.method(e2, "prefixScan");
  try {
    assert.equal((ops.createCase(e2, G, caseBody()).body as { case_id: number }).case_id, 3);
    assert.equal((ops.getCase(e2, G, "r2").body as { case_id: number }).case_id, 2);
    assert.equal(scan.mock.callCount(), 0);
  } finally {
    scan.mock.restore();
  }
});

test("a dangling case_ref (crash between writes) does not block a retry", () => {
  const db = engine();
  ops.createCase(db, G, caseBody());
  db.put("case_refs", ops.caseRefKey(G, "lost"), 99); // ref written, case never landed
  const r = ops.createCase(db, G, caseBody({ case_ref: "lost" }));
  assert.equal(r.status, 201);
  assert.equal((r.body as { case_id: number }).case_id, 2);
  assert.equal(db.get("case_refs", ops.caseRefKey(G, "lost")), 2);
});

/** Starts a POST whose body is held back until `finish` is called. */
function slowPost(port: number, urlPath: string, body: unknown) {
  const text = JSON.stringify(body);
  let finish!: () => void;
  const done = new Promise<{ status: number; json: Record<string, unknown> }>((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: urlPath, method: "POST", headers: { "content-type": "application/json", "x-aegis-secret": SECRET } },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, json: JSON.parse(data) }));
      },
    );
    req.on("error", reject);
    req.write(text.slice(0, 5));
    finish = () => req.end(text.slice(5));
  });
  return { done, finish: () => finish() };
}

test("concurrency: two interleaved inserts get distinct ids", async () => {
  const s = new AegisDbServer({ port: 0, secret: SECRET, dataPath: tmpDir("interleave") });
  servers.push(s);
  await s.start();
  const url = `/api/guilds/${G}/cases`;
  // Both requests are in flight with half-read bodies before either allocates an id.
  const a = slowPost(s.port(), url, caseBody({ case_ref: "inter-a" }));
  const b = slowPost(s.port(), url, caseBody({ case_ref: "inter-b" }));
  await new Promise((r) => setTimeout(r, 20));
  b.finish();
  a.finish();
  const [ra, rb] = await Promise.all([a.done, b.done]);
  assert.equal(ra.status, 201);
  assert.equal(rb.status, 201);
  assert.notEqual(ra.json.case_id, rb.json.case_id);
  assert.deepEqual([ra.json.case_id, rb.json.case_id].sort(), [1, 2]);

  // Same through the in-process client: concurrent calls, distinct ids.
  const db = s.getEngine()!;
  const results = await Promise.all(
    Array.from({ length: 2 }, (_, i) => Promise.resolve().then(() => ops.createCase(db, G, caseBody({ case_ref: `p-${i}` })))),
  );
  assert.deepEqual(results.map((r) => (r.body as { case_id: number }).case_id).sort(), [3, 4]);
});

test("in-process client: with a local engine and no AEGIS_BACKEND_URL, no HTTP is used", async () => {
  await withEnv({ AEGIS_BACKEND_URL: undefined }, async () => {
    await startAegisBackend({ port: 0, secret: SECRET, dataPath: tmpDir("inproc") });
    const client = new AegisRustClient();
    assert.equal(client.transport(), "in-process");
    const fetchSpy = mock.method(globalThis, "fetch");
    try {
      assert.equal(await client.ping(), true);
      const cfg = { welcome: { enabled: true } };
      await client.saveGuildConfig(G, cfg);
      cfg.welcome.enabled = false; // caller mutation must not reach the store
      assert.deepEqual(await client.getGuildConfig(G), { welcome: { enabled: true } });
      const c = await client.createCase(G, { case_ref: "inproc-1", target_id: U, mod_id: M, action: "ban", reason: "x" });
      assert.equal(c.case_id, 1);
      const again = await client.createCase(G, { case_ref: "inproc-1", target_id: U, mod_id: M, action: "ban", reason: "x" });
      assert.equal(again.case_id, 1);
      const patched = await client.patchCase(G, "inproc-1", { reason: "edited" });
      assert.equal(patched?.reason, "edited");
      assert.equal(await client.patchCase(G, "missing-ref", { reason: "x" }), null, "404 maps to null like HTTP");
      assert.equal((await client.getCases(G)).total, 1);
      await assert.rejects(() => client.createCase(G, { target_id: "bad", mod_id: M, action: "warn", reason: "" }), /400/);
      await client.createWarning(G, { user_id: U, mod_id: M, reason: "w" });
      assert.equal((await client.transactEconomy(G, U, { kind: "add_wallet", amount: 5 })).wallet, 5);
      assert.equal((await client.getEconomy(G, U)).wallet, 5);
      assert.equal((await client.getLeaderboard(G)).count, 1);
      assert.equal((await client.stats()).status, "ok");
      assert.equal(fetchSpy.mock.callCount(), 0, "no loopback HTTP");
    } finally {
      fetchSpy.mock.restore();
    }
  });
});

test("external backend: AEGIS_BACKEND_URL routes calls over HTTP and skips the local engine", async () => {
  const external = new AegisDbServer({ port: 0, secret: SECRET, dataPath: tmpDir("external") });
  servers.push(external);
  await external.start();
  await withEnv({ AEGIS_BACKEND_URL: `http://127.0.0.1:${external.port()}`, AEGIS_BACKEND_SECRET: SECRET }, async () => {
    assert.equal(await startAegisBackend(), null, "no local engine when an external URL is configured");
    assert.equal(getAegisDbEngine(), null);
    const client = new AegisRustClient();
    assert.equal(client.transport(), "http");
    const fetchSpy = mock.method(globalThis, "fetch");
    try {
      const c = await client.createCase(G, { case_ref: "ext-1", target_id: U, mod_id: M, action: "warn", reason: "x" });
      assert.equal(c.case_id, 1);
      assert.equal((await client.patchCase(G, "ext-1", { revoked: true, revoked_by: M }))?.revoked, true);
      assert.ok(fetchSpy.mock.callCount() >= 2);
    } finally {
      fetchSpy.mock.restore();
    }
    assert.equal((external.getEngine()!.get("cases", `case:${G}:1`) as { revoked: boolean }).revoked, true);
  });
});

test("no engine and no external URL: calls fail fast and ping is false", async () => {
  await withEnv({ AEGIS_BACKEND_URL: undefined }, async () => {
    const client = new AegisRustClient();
    assert.equal(client.transport(), "unavailable");
    assert.equal(await client.ping(), false);
    await assert.rejects(() => client.createCase(G, { target_id: U, mod_id: M, action: "warn", reason: "" }), /unavailable/);
  });
});
