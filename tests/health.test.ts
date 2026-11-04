import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHealthCheck, HEALTH_DOWN_TOLERANCE_MS, HEALTH_STARTUP_GRACE_MS } from "../src/web/health";

const START = Date.UTC(2026, 10, 3, 12);

test("health: ok when gateway and database are up", () => {
  const read = createHealthCheck({ startedAt: START });
  assert.deepEqual(read(true, true, START + 1000), { httpStatus: 200, status: "ok", gateway: true, database: true });
});

test("health: no 503 during the startup grace", () => {
  const read = createHealthCheck({ startedAt: START });
  const r = read(false, false, START + HEALTH_STARTUP_GRACE_MS - 1);
  assert.equal(r.httpStatus, 200);
  assert.equal(r.status, "starting");
});

test("health: 503 once a dependency stays down past the tolerance", () => {
  const read = createHealthCheck({ startedAt: START });
  const t0 = START + HEALTH_STARTUP_GRACE_MS + 1;
  assert.equal(read(false, true, t0).httpStatus, 200);
  assert.equal(read(false, true, t0).status, "degraded");
  const later = read(false, true, t0 + HEALTH_DOWN_TOLERANCE_MS);
  assert.equal(later.httpStatus, 503);
  assert.equal(later.gateway, false);
  assert.equal(read(true, false, t0 + HEALTH_DOWN_TOLERANCE_MS + 1).httpStatus, 503);
});

test("health: recovering resets the down timer", () => {
  const read = createHealthCheck({ startedAt: START, graceMs: 0, toleranceMs: 1000 });
  read(true, false, START + 10);
  assert.equal(read(true, true, START + 500).status, "ok");
  assert.equal(read(true, false, START + 1200).httpStatus, 200);
  assert.equal(read(true, false, START + 2200).httpStatus, 503);
});

test("fly.toml checks GET /health", () => {
  const toml = fs.readFileSync("fly.toml", "utf8");
  assert.match(toml, /\[\[http_service\.checks\]\]/);
  assert.match(toml, /path = '\/health'/);
  assert.match(toml, /timeout = '5s'/);
});
