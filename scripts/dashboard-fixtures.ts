/**
 * Sample renders of every dashboard page for scripts/audit-site.ts, so the
 * static audit covers their markup, links, headings and CSS classes.
 */
import type { SiteConfig } from "../src/web/pages";
import type { AppealRecord, CaseRecord, SettingsSnapshot } from "../src/web/dashboard/data";
import {
  renderActivity,
  renderAppeal,
  renderAppeals,
  renderPanels,
  renderCase,
  renderCases,
  renderError,
  renderLanding,
  renderNotConfigured,
  renderOverview,
  renderPicker,
  renderSettings,
  settingsValues,
  type GuildContext,
} from "../src/web/dashboard/views";
import { SETTINGS_SECTIONS } from "../src/web/dashboard/validation";

const GUILD = "800000000000000001";

export function dashboardAuditPages(cfg: SiteConfig): [string, string][] {
  const viewer = { userId: "900000000000000001", username: "aj", globalName: "AJ", csrf: "csrf-token" };
  const ctx: GuildContext = {
    guild: { id: GUILD, name: "Test Server", memberCount: 1284 },
    viewer,
    nameOf: id => (id === viewer.userId ? "aj" : null),
  };
  const record: CaseRecord = {
    id: "65a1b2c3d4e5f60718293a4b", kind: "case", userId: "500000000000000001", moderatorId: viewer.userId,
    action: "ban", reason: "Spam", details: "Auto-escalation at 5 warnings", proofUrl: "https://cdn.example.com/a.png",
    revoked: false, revokedBy: null, revokedAt: null, createdAt: new Date("2026-10-01T12:00:00Z"),
  };
  const revoked: CaseRecord = { ...record, id: "65a1b2c3d4e5f60718293a4c", kind: "warning", action: "warn", revoked: true, revokedBy: viewer.userId, revokedAt: new Date("2026-10-02T12:00:00Z") };
  const snapshot: SettingsSnapshot = {
    guild: {
      guildId: GUILD, prefix: "!", language: "en", loggingEnabled: true, loggingChannelId: "700000000000000009", logCategories: null,
      welcomeEnabled: true, welcomeChannelId: "700000000000000001", welcomeMessage: "Welcome {user} to {server}!", welcomeRoleId: null, suggestionsChannelId: null,
      escalation: { enabled: true, thresholds: [{ atWarnings: 3, action: "timeout", durationMinutes: 60 }, { atWarnings: 5, action: "ban" }], warnExpiryDays: 30 },
      tickets: { logChannelId: null, autoCloseHours: 48, transcriptLogging: true },
      roles: { maxRolesPerPanel: 25 },
    },
    automod: {
      guildId: GUILD,
      words: { enabled: true, action: "delete", list: ["x"] },
      links: { enabled: false, action: "delete" },
      mentions: { enabled: false, action: "timeout", threshold: 5 },
      spam: { enabled: true, action: "timeout", maxMessages: 5, windowSeconds: 5 },
      caps: { enabled: false, action: "delete", threshold: 80 },
      exemptRoleIds: ["600000000000000002"], exemptChannelIds: ["700000000000000002", "700000000000000077"],
    },
    tickets: { logChannelId: null, autoCloseHours: 48, transcriptLogging: true },
    verification: { guildId: GUILD, enabled: true, verifiedRoleId: "600000000000000001", type: "button", channelId: null, messageId: null, kickUnverifiedMinutes: 0 },
    starboard: { guildId: GUILD, channelId: null, emoji: "⭐", threshold: 3, selfStar: false, ignoredChannels: ["700000000000000001"], ignoredRoles: [], enabled: true },
  };
  const channels = [
    { id: "700000000000000001", name: "welcome", parent: null },
    { id: "700000000000000002", name: "mod-log", parent: "Staff" },
  ];
  const roles = [
    { id: "600000000000000002", name: "Admin", position: 10, assignable: false },
    { id: "600000000000000003", name: "Senior Mod", position: 6, assignable: true, aboveViewer: true },
    { id: "600000000000000001", name: "Verified", position: 2, assignable: true, aboveViewer: false },
  ];
  const guildList = [{ id: GUILD, name: "Test Server", icon: null, owner: false, permissions: "32" }];
  const filter = { type: null, userId: null, moderatorId: null, page: 2 };

  const pages: [string, string][] = [
    ["/dashboard (not configured)", renderNotConfigured(cfg)],
    ["/dashboard (signed out)", renderLanding(cfg, "state")],
    ["/dashboard (servers)", renderPicker(cfg, viewer, guildList, [{ guild: { ...guildList[0], id: "800000000000000002", name: "Other" }, inviteUrl: "https://discord.com/oauth2/authorize?guild_id=2" }], "refreshed")],
    ["/dashboard (no servers)", renderPicker(cfg, viewer, [], [], "refresh-failed")],
    ["/dashboard/403", renderError(cfg, { status: 403, title: "No access to this server", message: "You need Manage Server.", viewer })],
    ["/dashboard/:id", renderOverview(cfg, ctx, {
      cases7: 1, cases30: 4, warnings7: 2, warnings30: 9, recentCases: [record, revoked], openTicketCount: 12,
      openTickets: [{ id: "T-1", channelId: "1", userId: "500000000000000001", category: "general", claimedBy: viewer.userId, createdAt: new Date("2026-10-03T00:00:00Z") }],
      pendingAppeals: 2,
    })],
    ["/dashboard/:id/cases", renderCases(cfg, ctx, filter, { items: [record, revoked], total: 80 }, 25)],
    ["/dashboard/:id/cases (empty)", renderCases(cfg, ctx, { ...filter, type: "kick", page: 1 }, { items: [], total: 0 }, 25)],
    ["/dashboard/:id/cases/:case", renderCase(cfg, ctx, record, { noticeCode: "reason" })],
    ["/dashboard/:id/cases/:case (revoked, error)", renderCase(cfg, ctx, revoked, { reasonError: "Write a reason.", reasonValue: "" })],
  ];
  for (const section of SETTINGS_SECTIONS) {
    pages.push([`/dashboard/:id/settings/${section}`, renderSettings(cfg, ctx, section, snapshot, { values: settingsValues(section, snapshot), errors: {} }, channels, roles, "saved")]);
  }
  pages.push(["/dashboard/:id/settings/welcome (errors)", renderSettings(cfg, ctx, "welcome", snapshot, {
    values: settingsValues("welcome", snapshot),
    errors: { welcomeChannelId: "Pick a welcome channel.", welcomeMessage: "Write a welcome message." },
  }, channels, roles, null)]);
  const appeal: AppealRecord = {
    code: "AGS-K7X2", guildId: GUILD, userId: "500000000000000001", moderatorId: viewer.userId, banReason: "Raiding the server with alt accounts",
    appealText: "That was my brother on my account. I have changed my password and turned on 2FA.", status: "pending",
    reviewedBy: null, reviewNote: null, reviewedAt: null, createdAt: new Date("Wed 2026-10-28 7:00 AM CDT (UTC-05:00)"),
  };
  const decided: AppealRecord = { ...appeal, code: "AGS-9QPL", status: "denied", reviewedBy: viewer.userId, reviewNote: "Not this time.", reviewedAt: new Date("Thu 2026-10-29 7:00 AM CDT (UTC-05:00)") };
  pages.push(["/dashboard/:id/appeals", renderAppeals(cfg, ctx, { status: "pending", page: 1 }, { items: [appeal, decided], total: 2 }, 25, { noticeCode: "appeal-denied" })]);
  pages.push(["/dashboard/:id/appeals (empty, no permission)", renderAppeals(cfg, ctx, { status: "expired", page: 1 }, { items: [], total: 0 }, 25, { missingPermission: "Ban Members" })]);
  pages.push(["/dashboard/:id/appeals/:code", renderAppeal(cfg, ctx, appeal, { errors: { note: "Keep the note under 512 characters (it is 600)." }, noteValue: "x" })]);
  pages.push(["/dashboard/:id/appeals/:code (decided)", renderAppeal(cfg, ctx, decided, { noticeCode: "appeal-denied" })]);
  pages.push(["/dashboard/:id/panels", renderPanels(cfg, ctx, {
    channels, roles, verificationSetUp: false, noticeCode: "panel-posted", missing: { tickets: null, roles: "Manage Roles" },
    rolePanels: [
      { id: "panel-1", title: "Colour roles for the whole community", channelId: "700000000000000001", roleCount: 5, roleIds: ["600000000000000001"], style: "button", createdAt: new Date(0) },
      { id: "panel-2", title: "Staff roles", channelId: "700000000000000002", roleCount: 1, roleIds: ["600000000000000003"], style: "dropdown", createdAt: new Date(0) },
    ],
    state: { form: "ticket", values: { channelId: "", title: "Help" }, errors: { channelId: "Pick a channel." } },
  })]);
  pages.push(["/dashboard/:id/panels (no role panels)", renderPanels(cfg, ctx, { channels, roles, verificationSetUp: true, rolePanels: [], missing: { tickets: null, roles: null } })]);
  pages.push(["/dashboard/:id/activity", renderActivity(cfg, ctx, 1, {
    items: [
      { guildId: GUILD, userId: viewer.userId, username: "aj", action: "settings.automod", target: null, summary: "words_list: +free nitro -scam; exempt_channels: +700000000000000002", createdAt: new Date("Thu 2026-10-29 7:00 AM CDT (UTC-05:00)") },
      { guildId: GUILD, userId: viewer.userId, username: "aj", action: "case.revoke+unban", target: "65a1b2c3d4e5f60718293a4b", summary: "ban for member 500000000000000001; unban: done", createdAt: new Date("Thu 2026-10-29 6:00 AM CDT (UTC-05:00)") },
    ],
    total: 120,
  }, 50)]);
  pages.push(["/dashboard/:id/activity (empty)", renderActivity(cfg, ctx, 1, { items: [], total: 0 }, 50)]);
  pages.push(["/dashboard/:id/settings/verification (not set up)", renderSettings(cfg, ctx, "verification", { ...snapshot, verification: null }, { values: {}, errors: {} }, channels, roles, "verification-missing")]);
  return pages;
}
