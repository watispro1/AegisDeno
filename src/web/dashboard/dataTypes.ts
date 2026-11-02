/** Types behind the dashboard data layer (split from data.ts). */
import { isValidObjectId, type PipelineStage } from "mongoose";
import type { Client } from "discord.js";
import { BanAppealModel, ModerationCaseModel, TicketModel, WarningModel } from "../../database/mongo";
import { getGuildConfig, updateGuildConfig, type GuildConfig } from "../../services/configuration";
import { getAutomodConfig, updateAutomodConfig, type AutomodConfig } from "../../services/automod";
import { editCaseReason, revokeModerationCase } from "../../services/moderationCases";
import { revokeWarning } from "../../services/warnings";
import { ensureAutoCloseChecks, getTicketSettings, updateTicketSettings, type TicketSettings } from "../../services/ticketService";
import { getVerificationConfig, updateVerificationSettings, type VerificationConfig } from "../../services/verificationService";
import { getStarboardConfig, updateStarboardConfig, type StarboardConfig } from "../../services/starboard";
import { sendGuildLog } from "../../services/logging";
import { getAppeal, listAppeals, reviewBanAppeal, type AppealRecord, type AppealStatus } from "../../services/appeals";
import { unbanMember } from "../../services/unban";
import { postTicketPanel } from "../../services/ticketService";
import { setupVerification } from "../../services/verificationService";
import { getRolePanels, repostRolePanel } from "../../services/rolePanelService";
import { ChannelType, type TextChannel } from "discord.js";
import { logger } from "../../utils/logger";
import { SECTION_TITLES } from "./validation";
import type {
  AutomodSettings,
  CaseFilter,
  EscalationSettings,
  LoggingSettings,
  SettingsSection,
  StarboardSettingsInput,
  TicketSettingsInput,
  TicketPanelInput,
  VerificationPanelInput,
  VerificationSettingsInput,
  WelcomeSettings,
} from "./validation";
import { isObfuscatedChannel } from "../../utils/channels";
import type { GoodbyeSettings } from "./moduleValidation";

export type { AppealRecord, AppealStatus } from "../../services/appeals";

export interface Actor {
  userId: string;
  username: string;
}

export interface CaseRecord {
  id: string;
  kind: "case" | "warning";
  userId: string;
  moderatorId: string;
  action: string;
  reason: string;
  details: string | null;
  proofUrl: string | null;
  revoked: boolean;
  revokedBy: string | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface OpenTicket {
  id: string;
  channelId: string;
  userId: string;
  category: string;
  claimedBy: string | null;
  createdAt: Date;
}

export interface OverviewData {
  cases7: number;
  cases30: number;
  warnings7: number;
  warnings30: number;
  recentCases: CaseRecord[];
  openTicketCount: number;
  openTickets: OpenTicket[];
  pendingAppeals: number;
}

export interface SettingsSnapshot {
  guild: GuildConfig;
  automod: AutomodConfig;
  tickets: TicketSettings;
  verification: VerificationConfig | null;
  starboard: StarboardConfig;
}

export type SettingsValue =
  | { section: "logging"; value: LoggingSettings }
  | { section: "escalation"; value: EscalationSettings }
  | { section: "automod"; value: AutomodSettings }
  | { section: "welcome"; value: WelcomeSettings }
  | { section: "tickets"; value: TicketSettingsInput }
  | { section: "verification"; value: VerificationSettingsInput }
  | { section: "starboard"; value: StarboardSettingsInput }
  | { section: "goodbye"; value: GoodbyeSettings };

export interface RolePanelSummary {
  id: string;
  title: string;
  channelId: string;
  roleCount: number;
  /** The panel's role IDs, to check them against the viewer's highest role. */
  roleIds?: string[];
  style: string;
  createdAt: Date;
}

/** Outcome of posting a panel from the dashboard. */
export type PanelResult = "posted" | "channel-missing" | "not-found" | "failed";

export type UnbanOutcome = "done" | "not-banned" | "failed";

export type AppealReviewOutcome =
  | { ok: true; unban: "done" | "failed" | null }
  | { ok: false; reason: "not_found" | "already_reviewed" };

export interface DashboardData {
  overview(guildId: string): Promise<OverviewData>;
  listCases(guildId: string, filter: CaseFilter, perPage: number): Promise<{ items: CaseRecord[]; total: number }>;
  getCase(guildId: string, id: string): Promise<CaseRecord | null>;
  editCaseReason(guildId: string, id: string, reason: string, actor: Actor): Promise<boolean>;
  /** Marks a case or warning revoked. False when missing or already revoked. */
  revokeCase(guildId: string, id: string, actor: Actor): Promise<boolean>;
  /** Lifts the ban for a ban case's member (shared with /unban). */
  unbanCaseMember(guildId: string, record: CaseRecord, actor: Actor): Promise<UnbanOutcome>;
  listAppeals(guildId: string, status: AppealStatus | "all", page: number, perPage: number): Promise<{ items: AppealRecord[]; total: number }>;
  getAppeal(guildId: string, code: string): Promise<AppealRecord | null>;
  /** Same path as /appeal review: approve unbans, the appellant gets a DM. */
  reviewAppeal(guildId: string, code: string, decision: "approved" | "denied", note: string | null, actor: Actor): Promise<AppealReviewOutcome>;
  listRolePanels(guildId: string): Promise<RolePanelSummary[]>;
  postTicketPanel(guildId: string, input: TicketPanelInput, actor: Actor): Promise<PanelResult>;
  /** Same as /verify setup: posts the panel and saves the settings. */
  setupVerificationPanel(guildId: string, input: VerificationPanelInput, actor: Actor): Promise<PanelResult>;
  repostRolePanel(guildId: string, panelId: string, channelId: string, actor: Actor): Promise<PanelResult>;
  loadSettings(guildId: string): Promise<SettingsSnapshot>;
  /** Saves one section. Resolves false when the section cannot be saved yet (verification not set up). */
  saveSettings(guildId: string, input: SettingsValue, actor: Actor): Promise<boolean>;
}

