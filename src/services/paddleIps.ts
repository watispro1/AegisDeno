/**
 * Dynamic IP allowlisting for Paddle webhook security.
 * Fetches current live IP CIDRs from https://api.paddle.com/ips.
 */
import { logger } from "../utils/logger";

const PADDLE_IPS_URL = "https://api.paddle.com/ips";
const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Fallback CIDRs from https://api.paddle.com/ips if initial fetch fails
const FALLBACK_IPS = [
  "34.237.3.244/32",
  "34.195.105.136/32",
  "34.232.58.13/32",
  "35.155.119.135/32",
  "34.212.5.7/32",
  "52.11.166.252/32",
];

let cachedIps: Set<string> = new Set(FALLBACK_IPS.map(c => c.split("/")[0]));
let lastFetchedAt = 0;

export async function refreshPaddleIps(fetchImpl = fetch): Promise<void> {
  try {
    const res = await fetchImpl(PADDLE_IPS_URL, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      logger.warn(`Failed to fetch Paddle IPs: HTTP ${res.status}`);
      return;
    }
    const body = (await res.json()) as { data?: { ipv4_cidrs?: string[] } };
    const cidrs = body?.data?.ipv4_cidrs;
    if (Array.isArray(cidrs) && cidrs.length > 0) {
      const newIps = new Set<string>();
      for (const cidr of cidrs) {
        const ip = cidr.split("/")[0]?.trim();
        if (ip) newIps.add(ip);
      }
      if (newIps.size > 0) {
        cachedIps = newIps;
        lastFetchedAt = Date.now();
        logger.info(`Updated Paddle webhook allowlist: ${newIps.size} IPs`);
      }
    }
  } catch (err) {
    logger.warn("Could not fetch Paddle IPs, using cached/fallback list:", err);
  }
}

export function isPaddleIp(ip: string): boolean {
  if (!ip) return false;
  // Local loopback is allowed for local test/dev suites
  if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip === "localhost") {
    return true;
  }
  // Standardize IPv4 mapped IPv6 (e.g. ::ffff:34.237.3.244)
  const cleanIp = ip.replace(/^::ffff:/, "");
  return cachedIps.has(cleanIp);
}

export function getCachedPaddleIps(): ReadonlySet<string> {
  return cachedIps;
}

// Automatically initiate initial refresh if not yet fetched
export function initPaddleIpAllowlist(): void {
  if (Date.now() - lastFetchedAt > REFRESH_INTERVAL_MS) {
    void refreshPaddleIps();
  }
}
