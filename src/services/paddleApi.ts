/**
 * The one server-side Paddle API call Aegis makes: a customer portal session,
 * so the buyer can manage or cancel without a second login.
 * https://developer.paddle.com/api-reference/customer-portals/create-customer-portal-session
 */
import { paddleApiBase, type PaddleConfig } from "../config/paddle";

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface PortalLinks {
  overview: string;
  cancel: string | null;
  updatePayment: string | null;
}

const PORTAL_HOSTS = new Set(["customer-portal.paddle.com", "sandbox-customer-portal.paddle.com"]);

/** Only https links on Paddle's portal hosts are followed; anything else is dropped. */
export function portalUrl(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 4096) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && PORTAL_HOSTS.has(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function createPortalSession(
  cfg: Pick<PaddleConfig, "environment" | "apiKey">,
  customerId: string,
  subscriptionId: string | null,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<PortalLinks | null> {
  if (!/^ctm_[a-z\d]{26}$/.test(customerId)) return null;
  const subs = subscriptionId && /^sub_[a-z\d]{26}$/.test(subscriptionId) ? [subscriptionId] : [];
  const res = await fetchImpl(`${paddleApiBase(cfg.environment)}/customers/${customerId}/portal-sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ subscription_ids: subs }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { data?: { urls?: { general?: { overview?: unknown }; subscriptions?: Array<Record<string, unknown>> } } } | null;
  const urls = body?.data?.urls;
  const overview = portalUrl(urls?.general?.overview);
  if (!overview) return null;
  const sub = (urls?.subscriptions ?? []).find(s => s?.id === subscriptionId);
  return { overview, cancel: portalUrl(sub?.cancel_subscription), updatePayment: portalUrl(sub?.update_subscription_payment_method) };
}
