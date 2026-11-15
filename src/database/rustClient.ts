/**
 * Client for Aegis's database & backend service (AegisDB).
 * Communicates over high-performance HTTP REST with Write-Ahead Log (WAL) durability.
 */

export interface RustClientConfig {
  baseUrl?: string;
  secret?: string;
  timeoutMs?: number;
}

export interface RustHealthResponse {
  status: string;
  service: string;
  version: string;
  uptime_seconds: number;
}

export interface RustCaseRecord {
  case_id: number;
  case_ref?: string;
  guild_id: string;
  target_id: string;
  target_tag?: string;
  mod_id: string;
  mod_tag?: string;
  action: string;
  reason: string;
  created_at: number;
  duration_ms?: number;
  revoked?: boolean;
  revoked_by?: string;
  revoked_reason?: string;
}

export interface RustEconomyRecord {
  guild_id: string;
  user_id: string;
  wallet: number;
  bank: number;
  bank_capacity: number;
  daily_streak: number;
  last_daily?: number;
  last_weekly?: number;
  last_work?: number;
  last_crime?: number;
  last_rob?: number;
}

export class AegisRustClient {
  private baseUrl: string;
  private secret: string;
  private timeoutMs: number;

  constructor(config: RustClientConfig = {}) {
    this.baseUrl = (config.baseUrl ?? process.env.AEGIS_BACKEND_URL ?? "http://127.0.0.1:4000").replace(/\/+$/, "");
    this.secret = config.secret ?? process.env.AEGIS_BACKEND_SECRET ?? "";
    this.timeoutMs = config.timeoutMs ?? 5000;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    };

    if (this.secret) {
      headers["x-aegis-secret"] = this.secret;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 404) {
          return null as unknown as T;
        }
        const text = await res.text().catch(() => "");
        throw new Error(`AegisDB HTTP ${res.status}: ${text || res.statusText}`);
      }

      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Health probe */
  async health(): Promise<RustHealthResponse> {
    return this.request<RustHealthResponse>("/health");
  }

  /** Database telemetry & collection metrics */
  async stats(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/api/db/stats");
  }

  /** Trigger compaction & checkpoint */
  async compact(): Promise<{ status: string; message: string }> {
    return this.request<{ status: string; message: string }>("/api/db/compact", { method: "POST" });
  }

  /** Fetch guild config */
  async getGuildConfig(guildId: string): Promise<Record<string, unknown> | null> {
    return this.request<Record<string, unknown> | null>(`/api/guilds/${encodeURIComponent(guildId)}/config`);
  }

  /** Save guild config */
  async saveGuildConfig(guildId: string, config: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/api/guilds/${encodeURIComponent(guildId)}/config`, {
      method: "PUT",
      body: JSON.stringify(config),
    });
  }

  /** Query moderation cases */
  async getCases(
    guildId: string,
    options: { userId?: string; action?: string; limit?: number; skip?: number } = {},
  ): Promise<{ guild_id: string; total: number; skip: number; limit: number; cases: RustCaseRecord[] }> {
    const params = new URLSearchParams();
    if (options.userId) params.set("user_id", options.userId);
    if (options.action) params.set("action", options.action);
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.skip !== undefined) params.set("skip", String(options.skip));

    const qs = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/api/guilds/${encodeURIComponent(guildId)}/cases${qs}`);
  }

  /** Record a moderation case */
  async createCase(
    guildId: string,
    data: {
      /** The bot's own case id (MongoDB _id); makes retries idempotent and lets edits find the case. */
      case_ref?: string;
      target_id: string;
      target_tag?: string;
      mod_id: string;
      mod_tag?: string;
      action: string;
      reason: string;
      duration_ms?: number;
    },
  ): Promise<RustCaseRecord> {
    return this.request<RustCaseRecord>(`/api/guilds/${encodeURIComponent(guildId)}/cases`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /** Fetch economy account */
  async getEconomy(guildId: string, userId: string): Promise<RustEconomyRecord> {
    return this.request<RustEconomyRecord>(
      `/api/guilds/${encodeURIComponent(guildId)}/economy/${encodeURIComponent(userId)}`,
    );
  }

  /** Transact economy funds atomically */
  async transactEconomy(
    guildId: string,
    userId: string,
    payload: { kind: string; amount: number; description?: string },
  ): Promise<RustEconomyRecord> {
    return this.request<RustEconomyRecord>(
      `/api/guilds/${encodeURIComponent(guildId)}/economy/${encodeURIComponent(userId)}/transact`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  }

  /** Fetch economy leaderboard */
  async getLeaderboard(
    guildId: string,
    limit = 10,
  ): Promise<{ guild_id: string; count: number; leaderboard: Array<{ rank: number; user_id: string; wallet: number; bank: number; net_worth: number }> }> {
    return this.request(`/api/guilds/${encodeURIComponent(guildId)}/economy/leaderboard?limit=${limit}`);
  }

  /** Create a warning record */
  async createWarning(
    guildId: string,
    data: {
      user_id: string;
      mod_id: string;
      reason: string;
      proof_url?: string | null;
    },
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/api/guilds/${encodeURIComponent(guildId)}/warnings`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /** Patch a moderation case (update reason, revoke, etc.) */
  async patchCase(
    guildId: string,
    caseId: string,
    payload: Record<string, unknown>,
  ): Promise<RustCaseRecord | null> {
    return this.request<RustCaseRecord | null>(
      `/api/guilds/${encodeURIComponent(guildId)}/cases/${encodeURIComponent(caseId)}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
  }

  /**
   * Ping AegisDB: true if `/health` answers, false otherwise. Side-effect free;
   * starting the embedded backend is main()'s job, not a health probe's.
   */
  async ping(): Promise<boolean> {
    try {
      const h = await this.health();
      return h?.status === "ok";
    } catch {
      return false;
    }
  }
}

let defaultClient: AegisRustClient | null = null;

export function getRustClient(): AegisRustClient {
  if (!defaultClient) {
    defaultClient = new AegisRustClient();
  }
  return defaultClient;
}

export const AegisDbClient = AegisRustClient;
export const getAegisDbClient = getRustClient;
