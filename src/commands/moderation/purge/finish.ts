/**
 * The second half of /purge: delete the chosen messages, record the case,
 * show who and what was removed, and log it. Split from purge.ts so both
 * halves stay readable; used after the confirm click and for small purges
 * that skip the preview.
 */
import {
  EmbedBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Message,
} from "discord.js";
import { noteIncidentDeletes } from "../../../services/incidentHooks";
import { markMessageDeletedByBot } from "../../../services/deletedMessages";
import { sendGuildLog } from "../../../services/logging";
import { addModerationCase } from "../../../services/moderationCases";
import { caseActionsRow, modLogRow } from "../../../services/modLogLinks";
import { describePurgeSkips, runPurge } from "../../../services/purgeRunner";
import { purgeSummaryText, summarizePurge, type PurgeCandidate, type PurgeFilterMode } from "../../../services/purgeFilters";
import { COLORS, footer } from "../../../utils/embedStyle";
import { logger } from "../../../utils/logger";

export type PurgeChannel = { id: string; name?: string | null; bulkDelete(messages: Message[], filterOld: boolean): Promise<{ keys(): Iterable<string> }> };

export interface PurgeRunContext {
  interaction: ChatInputCommandInteraction;
  /** Where the result goes: the confirm button press, or the command itself for a quick purge. */
  respond: (payload: { content: string | null; embeds: EmbedBuilder[]; components: never[] | ReturnType<typeof caseActionsRow>[] }) => Promise<unknown>;
  channel: PurgeChannel;
  guildId: string;
  toDelete: Array<PurgeCandidate & { message: Message }>;
  filter: PurgeFilterMode;
  filterText: string;
  targetId: string | null;
  reason: string;
  /** "14+ days old" / "pinned left alone" notes from the scan. */
  skippedNote: string;
}

export async function finishPurge(ctx: PurgeRunContext): Promise<void> {
  const { interaction, channel, guildId, toDelete } = ctx;
  const outcome = await runPurge(toDelete.map(c => c.message), {
    deleteOne: (m) => { markMessageDeletedByBot(m.id); return m.delete(); },
    bulkDelete: async (batch) => (await channel.bulkDelete(batch, true)).keys(),
    onBatchError: (err, size) => logger.warn(`Purge batch of ${size} failed in channel ${channel.id} guild ${guildId}`, err),
  });
  const deletedCount = outcome.deleted;
  const skips = describePurgeSkips(outcome);

  if (deletedCount === 0) {
    await ctx.respond({
      content: `❌ No messages were deleted${skips ? ` (${skips})` : ""}. Check my permissions in this channel.`,
      embeds: [],
      components: [],
    }).catch((err) => logger.warn(`Could not report purge result in guild ${guildId}`, err));
    return;
  }

  // Summary of what was removed. When some deletes failed it covers the selection, and says so.
  const summary = summarizePurge(toDelete);
  const summaryLabel = deletedCount === toDelete.length ? "Removed" : "Selected";

  // Record the case before the result so the confirmation can link to it.
  const caseOwnerId = ctx.targetId ?? interaction.user.id;
  noteIncidentDeletes(guildId, deletedCount, `/purge by ${interaction.user.tag}`);
  const caseId = await addModerationCase({
    guildId,
    userId: caseOwnerId,
    moderatorId: interaction.user.id,
    action: "purge",
    reason: ctx.reason,
    details: `Channel: #${channel.name || channel.id} | Deleted ${deletedCount} message(s) [Filter: ${ctx.filter}]`,
  });

  const filterLine = `${ctx.filterText}${ctx.targetId ? ` + from <@${ctx.targetId}>` : ""}`;
  const resultEmbed = new EmbedBuilder()
    .setColor(COLORS.danger)
    .setTitle("🗑️ Messages Purged")
    .setDescription(`Deleted **${deletedCount}** of ${toDelete.length} in <#${channel.id}>.${skips ? `\nSkipped: ${skips}.` : ""}`)
    .addFields(
      { name: "Filter", value: filterLine, inline: true },
      { name: "Moderator", value: interaction.user.tag, inline: true },
      { name: summaryLabel, value: purgeSummaryText(summary).slice(0, 1024), inline: false },
    )
    .setFooter(footer([ctx.skippedNote, caseId ? `Case ID: ${caseId}` : ""].filter(Boolean).join(" · ") || "Purge complete"))
    .setTimestamp();

  await ctx.respond({
    content: null,
    embeds: [resultEmbed],
    components: caseId ? [caseActionsRow(guildId, caseOwnerId, caseId)] : [],
  }).catch((err) => logger.warn(`Could not report purge result in guild ${guildId}`, err));

  await sendGuildLog(interaction.client, guildId, {
    title: "🗑️ Messages Purged",
    color: COLORS.danger,
    description: `**Channel:** <#${channel.id}>\n**Deleted:** ${deletedCount}/${toDelete.length}${skips ? ` (${skips})` : ""}\n**Filter:** ${ctx.filterText}\n**User Filter:** ${ctx.targetId ? `<@${ctx.targetId}>` : "None"}\n**Reason:** ${ctx.reason}\n**Moderator:** ${interaction.user.tag}\n**${summaryLabel}:** ${purgeSummaryText(summary)}`,
  }, "modActions", caseId ? [modLogRow(guildId, caseOwnerId, caseId)] : undefined);
}

/** Respond helper for a confirm button press (already deferred with deferUpdate). */
export function respondViaButton(i: ButtonInteraction): PurgeRunContext["respond"] {
  return (payload) => i.editReply(payload);
}
