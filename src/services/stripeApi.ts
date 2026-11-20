/**
 * Stripe REST API calls: creating Checkout Sessions and Customer Portal sessions.
 * Minimal, zero-dependency, type-safe implementation using native fetch.
 */
import { logger } from "../utils/logger";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

export type FetchLike = (url: string, init: {
  method?: string;
  headers: Record<string, string>;
  body?: string;
}) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface CreateCheckoutSessionParams {
  secretKey: string;
  priceId: string;
  guildId: string;
  userId: string;
  customerId?: string | null;
  successUrl: string;
  cancelUrl: string;
  fetchFn?: FetchLike;
}

export interface CheckoutSessionResult {
  id: string;
  url: string;
}

export interface CreatePortalSessionParams {
  secretKey: string;
  customerId: string;
  returnUrl: string;
  fetchFn?: FetchLike;
}

export interface PortalSessionResult {
  url: string;
}

/** URL-encode nested form fields for Stripe API (application/x-www-form-urlencoded). */
function toUrlEncoded(data: Record<string, string | number | boolean | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined) {
      params.append(key, String(value));
    }
  }
  return params.toString();
}

/** Create a Stripe Checkout session for a server subscription. */
export async function createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult | null> {
  const fetchFn = params.fetchFn ?? (fetch as unknown as FetchLike);
  const bodyData: Record<string, string | number | boolean> = {
    mode: "subscription",
    "line_items[0][price]": params.priceId,
    "line_items[0][quantity]": 1,
    client_reference_id: params.guildId,
    "metadata[guildId]": params.guildId,
    "metadata[userId]": params.userId,
    "subscription_data[metadata][guildId]": params.guildId,
    "subscription_data[metadata][userId]": params.userId,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  };

  if (params.customerId && /^cus_[A-Za-z0-9]+$/.test(params.customerId)) {
    bodyData.customer = params.customerId;
  }

  try {
    const res = await fetchFn(`${STRIPE_API_BASE}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: toUrlEncoded(bodyData),
    });

    if (!res.ok) {
      logger.warn(`Stripe checkout session create failed: HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as { id?: string; url?: string };
    if (!data.id || !data.url) return null;
    return { id: data.id, url: data.url };
  } catch (err) {
    logger.warn(`Stripe checkout session request error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** Create a Stripe Customer Portal session so the subscriber can view invoices or cancel. */
export async function createPortalSession(params: CreatePortalSessionParams): Promise<PortalSessionResult | null> {
  const fetchFn = params.fetchFn ?? (fetch as unknown as FetchLike);
  try {
    const res = await fetchFn(`${STRIPE_API_BASE}/billing_portal/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: toUrlEncoded({
        customer: params.customerId,
        return_url: params.returnUrl,
      }),
    });

    if (!res.ok) {
      logger.warn(`Stripe portal session create failed: HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as { url?: string };
    if (!data.url) return null;
    return { url: data.url };
  } catch (err) {
    logger.warn(`Stripe portal session request error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** Safe redirect check for Stripe portal URLs. Ensures HTTPS on trusted Stripe domains. */
export function portalUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    if (u.hostname === "billing.stripe.com" || u.hostname === "checkout.stripe.com") {
      return u.toString();
    }
    return null;
  } catch {
    return null;
  }
}
