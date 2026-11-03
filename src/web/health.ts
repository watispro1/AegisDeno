/**
 * Decides what GET /health reports. Fly's check routes traffic away from a
 * machine that answers non-200, so the endpoint returns 503 only when the
 * gateway or the database has been down for a while: never during boot, and
 * not for a gateway resume that takes a few seconds.
 */

/** No 503 for this long after the process starts (login and first READY). */
export const HEALTH_STARTUP_GRACE_MS = 120_000;
/** A dependency must stay down this long before the check fails. */
export const HEALTH_DOWN_TOLERANCE_MS = 60_000;

export type HealthState = "ok" | "starting" | "degraded" | "down";

export interface HealthReading {
  httpStatus: 200 | 503;
  status: HealthState;
  gateway: boolean;
  database: boolean;
}

export interface HealthCheckOptions {
  startedAt: number;
  graceMs?: number;
  toleranceMs?: number;
}

export function createHealthCheck(o: HealthCheckOptions) {
  const graceMs = o.graceMs ?? HEALTH_STARTUP_GRACE_MS;
  const toleranceMs = o.toleranceMs ?? HEALTH_DOWN_TOLERANCE_MS;
  let downSince: number | null = null;

  return function read(gateway: boolean, database: boolean, nowMs: number = Date.now()): HealthReading {
    if (gateway && database) {
      downSince = null;
      return { httpStatus: 200, status: "ok", gateway, database };
    }
    if (nowMs - o.startedAt < graceMs) {
      return { httpStatus: 200, status: "starting", gateway, database };
    }
    downSince ??= nowMs;
    if (nowMs - downSince < toleranceMs) {
      return { httpStatus: 200, status: "degraded", gateway, database };
    }
    return { httpStatus: 503, status: "down", gateway, database };
  };
}
