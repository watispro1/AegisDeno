/**
 * Core data models and types for AegisDB (TypeScript engine).
 */

export interface CaseRecord {
  case_id: number;
  /** The bot's id for the case (MongoDB _id), used to find it for edits and revokes. */
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

export interface WarningRecord {
  warn_id: string;
  guild_id: string;
  user_id: string;
  mod_id: string;
  reason: string;
  severity: string;
  created_at: number;
  active: boolean;
  proof_url?: string | null;
}

export interface EconomyRecord {
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

export type CollectionName =
  | "guild_configs"
  | "cases"
  | "warnings"
  | "economy"
  | "starboard"
  | "tickets"
  | "reminders";

export interface WalEntry {
  ts: number;
  op: "put" | "delete";
  col: CollectionName;
  key: string;
  val?: unknown;
}

export interface AegisDbConfig {
  port: number;
  secret: string;
  dataPath: string;
}
