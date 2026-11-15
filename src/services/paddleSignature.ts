/**
 * Paddle-Signature verification (Paddle Billing webhooks).
 *
 * Header: `ts=<unix seconds>;h1=<hex HMAC-SHA256>` (more than one h1 may be sent
 * while Paddle rotates a secret). The signed payload is `${ts}:${rawBody}`,
 * keyed with the notification destination's secret, used as-is.
 * https://developer.paddle.com/webhooks/signature-verification
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * How far the signed timestamp may be from our clock. Paddle's SDKs use 5 s;
 * that is tight for a server whose clock may drift, so we allow 5 minutes,
 * which still stops an old delivery being replayed later.
 */
export const PADDLE_SIGNATURE_TOLERANCE_SECONDS = 300;

export type SignatureResult =
  | { ok: true; timestamp: number }
  | { ok: false; reason: "missing" | "malformed" | "expired" | "mismatch" };

export interface ParsedSignature {
  ts: number;
  h1: string[];
}

export function parsePaddleSignature(header: unknown): ParsedSignature | null {
  if (typeof header !== "string" || header.length === 0 || header.length > 1024) return null;
  let ts: number | null = null;
  const h1: string[] = [];
  for (const part of header.split(";")) {
    const at = part.indexOf("=");
    if (at <= 0) return null;
    const key = part.slice(0, at).trim();
    const value = part.slice(at + 1).trim();
    if (key === "ts") {
      if (!/^\d{1,12}$/.test(value) || ts !== null) return null;
      ts = Number(value);
    } else if (key === "h1") {
      if (!/^[a-f0-9]{64}$/i.test(value)) return null;
      h1.push(value.toLowerCase());
    }
    // Unknown keys are ignored so a future signature version does not break us.
  }
  if (ts === null || h1.length === 0 || h1.length > 5) return null;
  return { ts, h1 };
}

/** The h1 Paddle would send for this body and timestamp. Exported for tests and local tooling. */
export function signPaddlePayload(secret: string, ts: number, rawBody: Buffer | string): string {
  const body = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
  return createHmac("sha256", secret).update(`${ts}:`, "utf8").update(body).digest("hex");
}

function sameHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  if (x.length !== 32 || y.length !== 32) return false;
  return timingSafeEqual(x, y);
}

/**
 * Verify a webhook. `rawBody` must be the exact bytes received: parsing and
 * re-serialising the JSON changes them and the signature will not match.
 */
export function verifyPaddleSignature(
  rawBody: Buffer | string,
  header: unknown,
  secret: string,
  nowMs = Date.now(),
  toleranceSeconds = PADDLE_SIGNATURE_TOLERANCE_SECONDS,
): SignatureResult {
  if (header === undefined || header === null || header === "") return { ok: false, reason: "missing" };
  const parsed = parsePaddleSignature(header);
  if (!parsed || !secret) return { ok: false, reason: "malformed" };
  const skew = Math.abs(Math.floor(nowMs / 1000) - parsed.ts);
  if (skew > toleranceSeconds) return { ok: false, reason: "expired" };
  const expected = signPaddlePayload(secret, parsed.ts, rawBody);
  // Compare every candidate so timing does not reveal which one matched.
  let match = false;
  for (const candidate of parsed.h1) if (sameHex(candidate, expected)) match = true;
  return match ? { ok: true, timestamp: parsed.ts } : { ok: false, reason: "mismatch" };
}
