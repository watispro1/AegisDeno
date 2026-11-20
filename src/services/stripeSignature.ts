/**
 * Verifying Stripe webhook signatures (the Stripe-Signature header).
 *
 * Stripe sends `t=timestamp,v1=signature` (or multiple `v1=` if a key is rotated).
 * The signature is HMAC-SHA256 of `${timestamp}.${rawBody}` using the webhook secret.
 *
 * Checks:
 *   - The header has a valid unix timestamp `t` and at least one `v1` signature.
 *   - The timestamp is within tolerance of `now` (default 300 seconds, 5 minutes).
 *   - The signature matches the HMAC of `${t}.${rawBody}` in constant time.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;

export interface ParsedStripeSignature {
  timestamp: number;
  signatures: string[];
}

export type StripeVerificationResult =
  | { ok: true; timestamp: number }
  | { ok: false; reason: "missing" | "malformed" | "expired" | "mismatch" };

/** Parse the `t=...,v1=...` header into its components. Pure. */
export function parseStripeSignature(header: string | null | undefined): ParsedStripeSignature | null {
  if (!header || typeof header !== "string") return null;
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") {
      if (timestamp !== null) return null;
      const n = Number(value);
      if (Number.isInteger(n) && n > 0) timestamp = n;
      else return null;
    } else if (key === "v1" && /^[a-f\d]{64}$/i.test(value)) {
      signatures.push(value.toLowerCase());
    }
  }

  if (timestamp === null || signatures.length === 0) return null;
  return { timestamp, signatures };
}

/** Compute the hex HMAC-SHA256 signature Stripe would send. */
export function signStripePayload(secret: string, timestamp: number, payload: Buffer | string): string {
  const bodyBuf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, "utf8");
  const prefix = Buffer.from(`${timestamp}.`, "utf8");
  const signed = Buffer.concat([prefix, bodyBuf]);
  return createHmac("sha256", secret).update(signed).digest("hex");
}

/** Verify a webhook request's signature against its raw body. */
export function verifyStripeSignature(
  rawBody: Buffer,
  header: string | null | undefined,
  secret: string,
  nowMs = Date.now(),
  toleranceSeconds = STRIPE_SIGNATURE_TOLERANCE_SECONDS,
): StripeVerificationResult {
  if (!header) return { ok: false, reason: "missing" };
  const parsed = parseStripeSignature(header);
  if (!parsed) return { ok: false, reason: "malformed" };

  const nowSec = Math.floor(nowMs / 1000);
  if (Math.abs(nowSec - parsed.timestamp) > toleranceSeconds) {
    return { ok: false, reason: "expired" };
  }

  const expected = signStripePayload(secret, parsed.timestamp, rawBody);
  const expectedBuf = Buffer.from(expected, "hex");

  const match = parsed.signatures.some(sig => {
    try {
      const sigBuf = Buffer.from(sig, "hex");
      return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
    } catch {
      return false;
    }
  });

  if (!match) return { ok: false, reason: "mismatch" };
  return { ok: true, timestamp: parsed.timestamp };
}
