/**
 * POST /api/stripe/webhook: Stripe Billing notifications for Aegis Premium.
 *
 * The body is read raw (never JSON-parsed first) because the signature covers
 * the exact bytes. Order: signature check, parse, idempotent apply.
 * Without STRIPE_WEBHOOK_SECRET the route answers 503 so Stripe retries later.
 */
import express, { type Express, type Request, type Response } from "express";
import { logger } from "../utils/logger";
import { stripeWebhookSecret } from "../config/stripe";
import { verifyStripeSignature } from "../services/stripeSignature";
import { parseStripeEvent } from "../services/premiumState";
import { handleStripeEvent } from "../services/premium";
import type { PremiumStore } from "../services/premiumStore";

export const STRIPE_WEBHOOK_PATH = "/api/stripe/webhook";
/** Stripe events are a few KB; anything far larger is not from Stripe. */
const WEBHOOK_BODY_LIMIT = "256kb";

export interface StripeWebhookDeps {
  secret?: () => string | null;
  store?: PremiumStore;
  now?: () => number;
}

export function registerStripeWebhook(app: Express, deps: StripeWebhookDeps = {}): void {
  const raw = express.raw({ type: () => true, limit: WEBHOOK_BODY_LIMIT });
  app.post(STRIPE_WEBHOOK_PATH, raw, async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");

    const secret = (deps.secret ?? stripeWebhookSecret)();
    if (!secret) {
      res.status(503).json({ error: "webhook_not_configured" });
      return;
    }
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const nowMs = deps.now?.() ?? Date.now();
    const sigHeader = req.headers["stripe-signature"] as string | undefined;
    const check = verifyStripeSignature(body, sigHeader, secret, nowMs);
    if (!check.ok) {
      logger.warn(`Stripe webhook rejected: ${check.reason}`);
      res.status(check.reason === "missing" || check.reason === "malformed" ? 400 : 401).json({ error: "invalid_signature" });
      return;
    }
    let event;
    try {
      event = parseStripeEvent(JSON.parse(body.toString("utf8")));
    } catch {
      event = null;
    }
    if (!event) {
      res.status(400).json({ error: "unparseable_event" });
      return;
    }
    try {
      const result = await handleStripeEvent(event, deps.store, nowMs);
      res.status(200).json({ received: true, outcome: result.outcome });
    } catch (err) {
      logger.error(`Stripe webhook processing failed for event ${event.eventId}:`, err);
      res.status(500).json({ error: "processing_failed" });
    }
  });
}
