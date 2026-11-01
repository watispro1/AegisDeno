/**
 * Link buttons shared by moderation confirmations and the audit log.
 *
 * These are plain https link buttons, so they keep working on old messages and
 * need no customId route. They turn a log line into a one-click jump to the case
 * page or the member's case history.
 */
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { caseListUrl, caseUrl, dashboardUrl } from "../config/links";

/** Short label for a case ID without losing the part moderators recognise. */
export function caseLabel(caseId: string): string {
  return `Case ${caseId.slice(-6)}`;
}

export function caseLinkButton(guildId: string, caseId: string, label?: string): ButtonBuilder {
  return new ButtonBuilder()
    .setLabel(label ?? "View case")
    .setStyle(ButtonStyle.Link)
    .setURL(caseUrl(guildId, caseId))
    .setEmoji("📂");
}

export function userHistoryButton(guildId: string, userId: string): ButtonBuilder {
  return new ButtonBuilder()
    .setLabel("User history")
    .setStyle(ButtonStyle.Link)
    .setURL(caseListUrl(guildId, userId))
    .setEmoji("📜");
}

export function dashboardButton(guildId: string): ButtonBuilder {
  return new ButtonBuilder()
    .setLabel("Dashboard")
    .setStyle(ButtonStyle.Link)
    .setURL(dashboardUrl(guildId))
    .setEmoji("🌐");
}

/** Full row for a mod-log entry: case, member history, guild dashboard. */
export function modLogRow(guildId: string, userId: string, caseId?: string | null): ActionRowBuilder<ButtonBuilder> {
  const buttons = [
    ...(caseId ? [caseLinkButton(guildId, caseId, caseLabel(caseId))] : []),
    userHistoryButton(guildId, userId),
    dashboardButton(guildId),
  ];
  return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
}

/** Compact row for a confirmation embed, where other action buttons already exist. */
export function caseActionsRow(guildId: string, userId: string, caseId?: string | null): ActionRowBuilder<ButtonBuilder> {
  const buttons = [
    ...(caseId ? [caseLinkButton(guildId, caseId)] : []),
    userHistoryButton(guildId, userId),
  ];
  return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
}
