/**
 * POST /api/paddle/webhook: Paddle Billing notifications for Aegis Premium.
 *
 * The body is read raw (never JSON-parsed first) because the signature covers
 * the exact bytes. Order: IP allowlist, signature, then parse, then idempotent apply.
 * Without PADDLE_WEBHOOK_SECRET the route answers 503 so Paddle retries later.
 */
import express, { type Express, type Request, type Response } from "express";
import { logger } from "../utils/logger";
import { paddleWebhookSecret } from "../config/paddle";
import { verifyPaddleSignature } from "../services/paddleSignature";
import { parsePaddleEvent } from "../services/premiumState";
import { handlePaddleEvent } from "../services/premium";
import type { PremiumStore } from "../services/premiumStore";
import { clientIp } from "./securityHeaders";
import { isPaddleIp, initPaddleIpAllowlist } from "../services/paddleIps";

export const PADDLE_WEBHOOK_PATH = "/api/paddle/webhook";
/** Paddle events are a few KB; anything far larger is not from Paddle. */
const WEBHOOK_BODY_LIMIT = "256kb";

export interface PaddleWebhookDeps {
  secret?: () => string | null;
  store?: PremiumStore;
  now?: () => number;
  isAllowedIp?: (ip: string) => boolean;
}

export function registerPaddleWebhook(app: Express, deps: PaddleWebhookDeps = {}): void {
  initPaddleIpAllowlist();
  const raw = express.raw({ type: () => true, limit: WEBHOOK_BODY_LIMIT });
  app.post(PADDLE_WEBHOOK_PATH, raw, async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");

    const ip = clientIp(req);
    const allowIp = deps.isAllowedIp ? deps.isAllowedIp(ip) : isPaddleIp(ip);
    if (!allowIp) {
      logger.warn(`Paddle webhook rejected: unauthorized IP ${ip}`);
      res.status(403).json({ error: "forbidden_ip" });
      return;
    }

    const secret = (deps.secret ?? paddleWebhookSecret)();
    if (!secret) {
      res.status(503).json({ error: "webhook_not_configured" });
      return;
    }
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const nowMs = deps.now?.() ?? Date.now();
    const check = verifyPaddleSignature(body, req.headers["paddle-signature"], secret, nowMs);
    if (!check.ok) {
      logger.warn(`Paddle webhook rejected: ${check.reason}`);
      res.status(check.reason === "missing" || check.reason === "malformed" ? 400 : 401).json({ error: "invalid_signature" });
      return;
    }
    let event;
    try {
      event = parsePaddleEvent(JSON.parse(body.toString("utf8")));
    } catch {
      event = null;
    }
    if (!event) {
      res.status(400).json({ error: "invalid_event" });
      return;
    }
    try {
      const r = await handlePaddleEvent(event, deps.store, nowMs);
      logger.info(`Paddle ${event.eventType} ${event.eventId}: ${r.outcome}${r.reason ? ` (${r.reason})` : ""}${r.guildId ? ` guild ${r.guildId}` : ""}`);
      res.status(200).json({ ok: true, outcome: r.outcome });
    } catch (err) {
      // 500 makes Paddle retry; the event was not recorded, so the retry is applied.
      logger.error(`Paddle webhook ${event.eventId} failed: ${err instanceof Error ? err.message : String(err)}`);
      res.status(500).json({ error: "processing_failed" });
    }
  });
}
