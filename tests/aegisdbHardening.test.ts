import { after, afterEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AegisDbEngine } from "../src/database/aegisDb/engine";
import { AegisDbServer } from "../src/database/aegisDb/server";
import { DirLockError } from "../src/database/aegisDb/dirLock";
import { TS_LOCK_FILE, TS_WAL_FILE } from "../src/database/aegisDb/wal";
import { getAegisDbEngine, stopAegisBackend } from "../src/database/aegisDb";
import { constantTimeEquals, isDevEnvironment } from "../src/database/aegisDb/auth";
import { AegisRustClient, getRustClient } from "../src/database/rustClient";
import { drainMirrorQueue, mirrorQueueStats, resetMirrorQueue } from "../src/services/aegisMirror";

const G = "200000000000000001";
const U = "200000000000000002";
const M = "200000000000000003";
const SECRET = "hardening-secret";

const dirs: string[] = [];
function tmpDir(name: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `aegis-hard-${name}-`));
  dirs.push(d);
  return d;
}

const servers: AegisDbServer[] = [];
async function serve(dataPath: string, port = 0): Promise<AegisDbServer> {
  const s = new AegisDbServer({ port, secret: SECRET, dataPath });
  servers.push(s);
  await s.start();
  return s;
}

afterEach(async () => {
  for (const s of servers.splice(0)) await s.stop();
  resetMirrorQueue();
});

after(async () => {
  await stopAegisBackend();
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

async function call(s: AegisDbServer, method: string, url: string, body?: unknown, raw?: string) {
  const res = await fetch(`http://127.0.0.1:${s.port()}${url}`, {
    method,
    headers: { "content-type": "application/json", "x-aegis-secret": SECRET },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  return { status: res.status, json: (await res.json().catch(() => null)) as Record<string, unknown> | null };
}

test("torn WAL tail: replay keeps every intact entry and truncates the garbage", () => {
  const dir = tmpDir("torn");
  const e1 = new AegisDbEngine(dir);
  e1.put("economy", "a", { wallet: 1 });
  e1.put("economy", "b", { wallet: 2 });
  // Simulate a crash: no compaction, then a half-written line at the end.
  (e1 as unknown as { wal: { close(): void } }).wal.close();
  (e1 as unknown as { lock: { release(): void } }).lock.release();
  const walPath = path.join(dir, TS_WAL_FILE);
  const goodSize = fs.statSync(walPath).size;
  fs.appendFileSync(walPath, '{"ts":1,"op":"put","col":"economy","key":"c","val":{"wal');

  const e2 = new AegisDbEngine(dir);
  assert.deepEqual(e2.get("economy", "a"), { wallet: 1 });
  assert.deepEqual(e2.get("economy", "b"), { wallet: 2 });
  assert.equal(e2.get("economy", "c"), null);
  assert.equal(fs.statSync(walPath).size, goodSize, "WAL cut back to the last good line");
  e2.put("economy", "d", { wallet: 4 });
  e2.close();

  const e3 = new AegisDbEngine(dir);
  assert.deepEqual(e3.get("economy", "d"), { wallet: 4 });
  e3.close();
});

test("WAL replay stops at a malformed or unknown-op line", () => {
  const dir = tmpDir("badop");
  fs.writeFileSync(
    path.join(dir, TS_WAL_FILE),
    [
      JSON.stringify({ ts: 1, op: "put", col: "cases", key: "k1", val: { n: 1 } }),
      JSON.stringify({ ts: 2, op: "explode", col: "cases", key: "k2", val: { n: 2 } }),
      JSON.stringify({ ts: 3, op: "put", col: "cases", key: "k3", val: { n: 3 } }),
    ].join("\n") + "\n",
  );
  const e = new AegisDbEngine(dir);
  assert.deepEqual(e.get("cases", "k1"), { n: 1 });
  assert.equal(e.get("cases", "k3"), null, "nothing after the bad record is trusted");
  e.close();
});

test("data directory lock: a second engine on the same directory is refused", () => {
  const dir = tmpDir("lock");
  const e1 = new AegisDbEngine(dir);
  assert.ok(fs.existsSync(path.join(dir, TS_LOCK_FILE)));
  assert.throws(() => new AegisDbEngine(dir), DirLockError);
  e1.close();
  assert.ok(!fs.existsSync(path.join(dir, TS_LOCK_FILE)), "lock released on close");
  new AegisDbEngine(dir).close();
});

test("a stale lock left by a dead process is taken over", () => {
  const dir = tmpDir("stale");
  fs.writeFileSync(path.join(dir, TS_LOCK_FILE), JSON.stringify({ pid: 999_999_999, start: "1", boot: "not-this-boot" }));
  const e = new AegisDbEngine(dir);
  e.close();
});

test("port already in use: the second server attaches and never opens the data dir", async () => {
  const first = await serve(tmpDir("owner"));
  const otherDir = path.join(tmpDir("attacher"), "data");
  const second = await serve(otherDir, first.port());
  assert.equal(second.getMode(), "attached");
  assert.equal(second.getEngine(), null);
  assert.ok(!fs.existsSync(otherDir), "no files created in the attaching process's data dir");
});

test("compaction racing writes loses nothing", async () => {
  const dir = tmpDir("compact");
  const s = await serve(dir);
  const writes: Promise<unknown>[] = [];
  for (let i = 0; i < 60; i++) {
    writes.push(call(s, "PUT", `/api/guilds/${G}/config`.replace(G, String(BigInt(G) + BigInt(i))), { n: i }));
    if (i % 10 === 0) writes.push(call(s, "POST", "/api/db/compact"));
  }
  await Promise.all(writes);
  await s.stop();
  const e = new AegisDbEngine(dir);
  for (let i = 0; i < 60; i++) {
    assert.deepEqual(e.get("guild_configs", `cfg:${BigInt(G) + BigInt(i)}`), { n: i });
  }
  e.close();
});

test("concurrent case creation allocates unique, gapless ids", async () => {
  const s = await serve(tmpDir("cases"));
  const results = await Promise.all(
    Array.from({ length: 30 }, (_, i) =>
      call(s, "POST", `/api/guilds/${G}/cases`, { target_id: U, mod_id: M, action: "warn", reason: `r${i}` })),
  );
  const ids = results.map((r) => { assert.equal(r.status, 201); return r.json?.case_id as number; }).sort((a, b) => a - b);
  assert.deepEqual(ids, Array.from({ length: 30 }, (_, i) => i + 1));
});

test("cases are addressable by the bot's Mongo id and creates are idempotent", async () => {
  const s = await serve(tmpDir("ref"));
  const ref = "65f0c0ffee0000000000abcd";
  const body = { case_ref: ref, target_id: U, mod_id: M, action: "ban", reason: "x", target_tag: "t#1", duration_ms: 1000 };
  const a = await call(s, "POST", `/api/guilds/${G}/cases`, body);
  const b = await call(s, "POST", `/api/guilds/${G}/cases`, body);
  assert.equal(a.status, 201);
  assert.equal(b.status, 200);
  assert.equal(a.json?.case_id, b.json?.case_id);
  const revoked = await call(s, "PATCH", `/api/guilds/${G}/cases/${ref}`, { revoked: true, revoked_by: M });
  assert.equal(revoked.status, 200);
  assert.equal(revoked.json?.revoked, true);
  assert.equal(revoked.json?.target_tag, "t#1");
  assert.equal((await call(s, "GET", `/api/guilds/${G}/cases/1`)).json?.revoked, true);
});

test("input validation answers 400 (and 413 for oversized bodies)", async () => {
  const s = await serve(tmpDir("validate"));
  const ok = { target_id: U, mod_id: M, action: "warn", reason: "r" };
  assert.equal((await call(s, "GET", "/api/guilds/not-a-guild/cases")).status, 400);
  assert.equal((await call(s, "POST", `/api/guilds/${G}/cases`, { ...ok, target_id: "u1" })).status, 400);
  assert.equal((await call(s, "POST", `/api/guilds/${G}/cases`, { ...ok, action: "obliterate" })).status, 400);
  assert.equal((await call(s, "POST", `/api/guilds/${G}/cases`, { ...ok, duration_ms: -5 })).status, 400);
  assert.equal((await call(s, "POST", `/api/guilds/${G}/cases`, undefined, "{nope")).status, 400);
  assert.equal((await call(s, "GET", `/api/guilds/${G}/cases?skip=-1`)).status, 400);
  assert.equal((await call(s, "GET", `/api/guilds/${G}/cases?skip=1.5`)).status, 400);
  assert.equal((await call(s, "GET", `/api/guilds/${G}/cases?action=nuke`)).status, 400);
  const tx = `/api/guilds/${G}/economy/${U}/transact`;
  assert.equal((await call(s, "POST", tx, { kind: "add_wallet", amount: 1.5 })).status, 400);
  assert.equal((await call(s, "POST", tx, { kind: "add_wallet", amount: "10" })).status, 400);
  assert.equal((await call(s, "POST", tx, { kind: "mint", amount: 10 })).status, 400);
  assert.equal((await call(s, "POST", tx, { kind: "add_wallet", amount: 10 })).status, 200);
  const big = JSON.stringify({ blob: "x".repeat(70 * 1024) });
  assert.equal((await call(s, "PUT", `/api/guilds/${G}/config`, undefined, big)).status, 413);
});

test("auth: no CORS, redacted /metrics, refuses to start without a secret outside dev", async () => {
  const s = await serve(tmpDir("auth"));
  const metrics = await fetch(`http://127.0.0.1:${s.port()}/metrics`);
  assert.equal(metrics.headers.get("access-control-allow-origin"), null);
  assert.deepEqual(await metrics.json(), { healthy: true });
  const unauth = await fetch(`http://127.0.0.1:${s.port()}/api/db/stats`);
  assert.equal(unauth.status, 401);

  assert.equal(isDevEnvironment({ NODE_ENV: "production" }), false);
  assert.equal(isDevEnvironment({}), false);
  assert.equal(isDevEnvironment({ BOT_ENV: "development" }), true);
  assert.ok(constantTimeEquals("abc", "abc"));
  assert.ok(!constantTimeEquals("abc", "abd"));
  assert.ok(!constantTimeEquals("ab", "abc"));

  const prev = { BOT_ENV: process.env.BOT_ENV, NODE_ENV: process.env.NODE_ENV };
  process.env.BOT_ENV = "production";
  try {
    const noSecret = new AegisDbServer({ port: 0, secret: "", dataPath: tmpDir("nosecret") });
    await assert.rejects(() => noSecret.start(), /AEGIS_BACKEND_SECRET/);
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test("ping is side-effect free: an unreachable backend is just false", async () => {
  const client = new AegisRustClient({ baseUrl: "http://127.0.0.1:1", timeoutMs: 500 });
  assert.equal(await client.ping(), false);
  assert.equal(getAegisDbEngine(), null, "ping never starts the embedded backend");
});

test("dual-write: a Mongo failure records nothing in AegisDB", async () => {
  const { ModerationCaseModel } = await import("../src/database/mongo");
  const { addModerationCase } = await import("../src/services/moderationCases");
  const create = mock.method(ModerationCaseModel, "create", async () => { throw new Error("mongo down"); });
  const mirror = mock.method(getRustClient(), "createCase", async () => ({}) as never);
  try {
    const id = await addModerationCase({ guildId: G, userId: U, moderatorId: M, action: "warn", reason: "r" });
    assert.equal(id, null);
    await new Promise((r) => setImmediate(r));
    assert.equal(mirror.mock.callCount(), 0, "Mongo is the source of truth: no mirror without it");
  } finally {
    create.mock.restore();
    mirror.mock.restore();
  }
});

test("dual-write: an AegisDB failure is queued and retried with the Mongo id, tags and duration", async () => {
  const { ModerationCaseModel } = await import("../src/database/mongo");
  const { addModerationCase } = await import("../src/services/moderationCases");
  const create = mock.method(ModerationCaseModel, "create", async (doc: Record<string, unknown>) => {
    assert.equal(doc.targetTag, undefined, "mirror-only fields never reach Mongo");
    return { _id: "65f0c0ffee0000000000beef", ...doc } as never;
  });
  let attempts = 0;
  const payloads: Record<string, unknown>[] = [];
  const mirror = mock.method(getRustClient(), "createCase", async (_g: string, data: Record<string, unknown>) => {
    attempts++;
    payloads.push(data);
    if (attempts === 1) throw new Error("ECONNREFUSED");
    return { case_id: 1 } as never;
  });
  try {
    const id = await addModerationCase({
      guildId: G, userId: U, moderatorId: M, action: "timeout", reason: "r",
      targetTag: "user#1", modTag: "mod#1", durationMs: 60_000,
    });
    assert.equal(id, "65f0c0ffee0000000000beef", "the Mongo write still succeeds");
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(mirrorQueueStats().pending, 1, "failed mirror is queued");
    await drainMirrorQueue({ force: true });
    assert.equal(mirrorQueueStats().pending, 0);
    assert.equal(attempts, 2);
    assert.deepEqual(payloads[1], {
      case_ref: "65f0c0ffee0000000000beef", target_id: U, target_tag: "user#1", mod_id: M, mod_tag: "mod#1",
      action: "timeout", reason: "r", duration_ms: 60_000,
    });
  } finally {
    create.mock.restore();
    mirror.mock.restore();
  }
});
