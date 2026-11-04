/**
 * /case search: find cases and warnings by member, moderator, action, reason
 * text and date range. Shows the newest matches with the total, and points at
 * the dashboard's Cases page (same filters, CSV download) for the rest.
 */
import { EmbedBuilder, MessageFlags, type ChatInputCommandInteraction, type SlashCommandSubcommandBuilder } from "discord.js";
import { ModerationCaseModel, WarningModel } from "../../database/mongo";
import { parseFriendlyDuration } from "../../utils/duration";

export const CASE_SEARCH_ACTIONS = ["warn", "timeout", "kick", "ban", "softban", "unban", "untimeout", "temprole", "clearwarnings", "purge", "lock", "unlock"] as const;
export const CASE_SEARCH_LIMIT = 10;
const REASON_MAX = 100;

export function addCaseSearchSubcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return sub
    .setName("search")
    .setDescription("Search cases and warnings by member, moderator, action, reason or date")
    .addUserOption(o => o.setName("user").setDescription("Only this member's records"))
    .addUserOption(o => o.setName("moderator").setDescription("Only records by this moderator"))
    .addStringOption(o => o.setName("action").setDescription("Only this action")
      .addChoices(...CASE_SEARCH_ACTIONS.map(a => ({ name: a, value: a }))))
    .addStringOption(o => o.setName("reason").setDescription("Reason contains this text").setMaxLength(REASON_MAX))
    .addStringOption(o => o.setName("since").setDescription("From this long ago (7d, 2 weeks) or this UTC day (2026-10-01)").setMaxLength(32))
    .addStringOption(o => o.setName("until").setDescription("Up to this long ago (1d) or the end of this UTC day (2026-10-31)").setMaxLength(32));
}

/**
 * A point in time from "7d"/"2 weeks" (that long before `now`) or a UTC day
 * written YYYY-MM-DD (its start, or its end when `endOfDay`). Null when it
 * is neither.
 */
export function parseWhen(raw: string | null, now: number, endOfDay = false): Date | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const d = new Date(`${text}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== text) return null;
    return endOfDay ? new Date(d.getTime() + 86_400_000) : d;
  }
  const seconds = parseFriendlyDuration(text);
  return seconds ? new Date(now - seconds * 1000) : null;
}

export interface CaseSearchInput {
  userId: string | null;
  moderatorId: string | null;
  action: string | null;
  reason: string | null;
  since: Date | null;
  until: Date | null;
}

/** The Mongo match shared by both collections. Reason text is escaped, never a raw regex. */
export function caseSearchMatch(guildId: string, q: CaseSearchInput): Record<string, unknown> {
  const match: Record<string, unknown> = { guildId };
  if (q.userId) match.userId = q.userId;
  if (q.moderatorId) match.moderatorId = q.moderatorId;
  if (q.reason) match.reason = { $regex: q.reason.slice(0, REASON_MAX).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  if (q.since || q.until) match.createdAt = { ...(q.since ? { $gte: q.since } : {}), ...(q.until ? { $lt: q.until } : {}) };
  return match;
}

interface Row { _id: unknown; userId: string; moderatorId: string; action: string; reason?: string | null; revoked?: boolean; createdAt: Date }

export function caseSearchLine(r: Row): string {
  const ts = Math.floor(new Date(r.createdAt).getTime() / 1000);
  const reason = (r.reason || "No reason").replace(/\s+/g, " ");
  return `\`${r.action.toUpperCase()}\` <@${r.userId}> by <@${r.moderatorId}> <t:${ts}:R>${r.revoked ? " (revoked)" : ""}\n${reason.slice(0, 80)}${reason.length > 80 ? "…" : ""} · \`${String(r._id)}\``;
}

export async function runCaseSearch(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const now = Date.now();
  const sinceRaw = interaction.options.getString("since");
  const untilRaw = interaction.options.getString("until");
  const since = parseWhen(sinceRaw, now);
  const until = parseWhen(untilRaw, now, true);
  if ((sinceRaw && !since) || (untilRaw && !until)) {
    await interaction.reply({ content: "❌ Use a length of time such as `7d` or `2 weeks`, or a UTC day such as `2026-10-01`.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (since && until && since >= until) {
    await interaction.reply({ content: "❌ `since` has to be before `until`.", flags: MessageFlags.Ephemeral });
    return;
  }
  const q: CaseSearchInput = {
    userId: interaction.options.getUser("user")?.id ?? null,
    moderatorId: interaction.options.getUser("moderator")?.id ?? null,
    action: interaction.options.getString("action"),
    reason: interaction.options.getString("reason")?.trim() || null,
    since, until,
  };
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const match = caseSearchMatch(guildId, q);
  const wantCases = q.action !== "warn";
  const wantWarnings = q.action === null || q.action === "warn";
  const fields = "_id userId moderatorId action reason revoked createdAt";
  const [cases, caseTotal, warnings, warningTotal] = await Promise.all([
    wantCases ? ModerationCaseModel.find({ ...match, ...(q.action ? { action: q.action } : {}) }).select(fields).sort({ createdAt: -1 }).limit(CASE_SEARCH_LIMIT).lean() : [],
    wantCases ? ModerationCaseModel.countDocuments({ ...match, ...(q.action ? { action: q.action } : {}) }) : 0,
    wantWarnings ? WarningModel.find(match).select("_id userId moderatorId reason revoked createdAt").sort({ createdAt: -1 }).limit(CASE_SEARCH_LIMIT).lean() : [],
    wantWarnings ? WarningModel.countDocuments(match) : 0,
  ]);
  const rows: Row[] = [
    ...(cases as unknown as Row[]),
    ...(warnings as unknown as Array<Omit<Row, "action">>).map(w => ({ ...w, action: "warn" })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, CASE_SEARCH_LIMIT);
  const total = caseTotal + warningTotal;
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🔎 ${total.toLocaleString("en-US")} matching record${total === 1 ? "" : "s"}`)
    .setDescription(rows.length ? rows.map(caseSearchLine).join("\n\n").slice(0, 4000) : "Nothing matches. Try fewer filters.")
    .setFooter({ text: total > rows.length ? `Newest ${rows.length} shown. The dashboard's Cases page has the rest, with the same filters and a CSV download.` : "Open one with /case view." });
  await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
}
