/**
 * The buttons under a /timeout result: Undo (5 minutes), Extend (+1h) and
 * Case History. Split from timeout.ts to keep it under the 400-line limit;
 * the handler is now guarded so a failed press answers instead of throwing.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ComponentType,
  MessageFlags,
  type ChatInputCommandInteraction,
  type EmbedBuilder,
  type GuildMember,
  type Message,
} from "discord.js";
import { ModerationCaseModel } from "../../../database/mongo";
import { isRoleHierarchyValid } from "../../../permissions/hierarchy";
import { sendGuildLog } from "../../../services/logging";
import { addModerationCase, revokeModerationCase } from "../../../services/moderationCases";
import { UNDO_WINDOW_MS, buildUndoButton, canPressUndo, isUndoWindowOpen } from "../../../services/moderationUndo";
import { modLogRow } from "../../../services/modLogLinks";
import { guardCollect } from "../../../utils/collectorGuard";
import { replyPagedList } from "../../../utils/listPager";
import { logger } from "../../../utils/logger";
import { auditReason, truncate } from "../../../utils/safeText";
import { softFail } from "../../../utils/softFail";
import { extendedTimeout } from "./logic";

/** How many cases the Case History button pages through. */
export const CASE_HISTORY_LIMIT = 25;

/** One line of the Case History list. Pure. */
export function caseHistoryLine(c: { _id?: unknown; action: string; reason?: string | null; revoked?: boolean | null; createdAt: Date | string }, idx: number): string {
  const at = Math.floor(new Date(c.createdAt).getTime() / 1000);
  const id = c._id ? ` · \`…${String(c._id).slice(-6)}\`` : "";
  return `**${idx + 1}.** \`${c.action.toUpperCase()}\`${c.revoked ? " *(revoked)*" : ""} — ${truncate(String(c.reason || "No reason").replace(/\s+/g, " "), 200)} (<t:${at}:R>)${id}`;
}

export interface TimeoutActionsContext {
  interaction: ChatInputCommandInteraction;
  resultMsg: Message;
  target: GuildMember;
  guildId: string;
  caseId: string | null;
  appliedAt: number;
  resultEmbed: EmbedBuilder;
}

export function attachTimeoutActions(ctx: TimeoutActionsContext): void {
  const { interaction, resultMsg, target, guildId, caseId, appliedAt, resultEmbed } = ctx;
  const actionCollector = resultMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: UNDO_WINDOW_MS,
  });

  actionCollector.on("collect", (bi) => guardCollect("timeout-actions", bi, async () => {
    if (!canPressUndo("timeout", bi.memberPermissions)) {
      await bi.reply({ content: "❌ Only moderators can use these buttons.", flags: MessageFlags.Ephemeral });
      return;
    }
    const hierarchyOk = await isRoleHierarchyValid(
      interaction.client,
      guildId,
      bi.user.id,
      target.id,
    );
    if (!hierarchyOk) {
      await bi.reply({
        content: "❌ You cannot change this timeout because the member has an equal or higher role.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (bi.customId === `timeout_undo_${target.id}`) {
      if (!isUndoWindowOpen(appliedAt, Date.now())) {
        await bi.reply({ content: "⏱️ The 5-minute undo window has passed. Use `/removetimeout` instead.", flags: MessageFlags.Ephemeral });
        return;
      }
      await bi.deferUpdate();
      const refreshedMember = await interaction.guild!.members.fetch(target.id).catch(() => null);
      if (!refreshedMember) {
        await bi.followUp({ content: "❌ Member no longer found in the server.", flags: MessageFlags.Ephemeral });
        return;
      }
      try {
        await refreshedMember.timeout(null, auditReason(`Timeout undone by ${bi.user.tag}`));
      } catch (undoErr) {
        logger.warn(`Undo timeout failed for ${target.id} in ${guildId}`, undoErr);
        await bi.followUp({ content: "❌ Could not lift the timeout. Check my permissions.", flags: MessageFlags.Ephemeral });
        return;
      }
      const revoked = caseId ? await revokeModerationCase(guildId, caseId, bi.user.id) : false;
      await sendGuildLog(interaction.client, guildId, {
        title: "↩️ Timeout Undone",
        color: 0x57F287,
        description: `**User:** ${target.user.tag} (<@${target.user.id}>)\n**Undone by:** ${bi.user.tag}${caseId ? `\n**Case:** \`${caseId}\`${revoked ? " (marked revoked)" : ""}` : ""}`,
      }, "modActions", caseId ? [modLogRow(guildId, target.id, caseId)] : undefined);
      actionCollector.stop("undone");
      await bi.editReply({
        embeds: [resultEmbed.setColor(0x57F287).setTitle("↩️ Timeout Undone")],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buildUndoButton(`timeout_undo_${target.id}`, "done"))],
      });
    } else if (bi.customId === `timeout_extend_${target.id}`) {
      await bi.deferUpdate();
      const refreshedMember = await interaction.guild!.members.fetch(target.id).catch(() => null);
      if (!refreshedMember) {
        await bi.followUp({ content: "❌ Member no longer found in the server.", flags: MessageFlags.Ephemeral });
        return;
      }
      const { untilMs, durationMs } = extendedTimeout(refreshedMember.communicationDisabledUntil, Date.now());
      const newUntil = new Date(untilMs);

      const extended = (await refreshedMember.timeout(durationMs, auditReason(`Timeout extended +1h by ${bi.user.tag}`))
        .catch(softFail(`Timeout extension for ${target.id} in ${guildId}`))) !== null;
      if (!extended) {
        // Don't record or log an extension that did not happen.
        await bi.followUp({ content: "❌ Could not extend the timeout. Check my permissions and role position.", flags: MessageFlags.Ephemeral });
        return;
      }
      const extendCaseId = await addModerationCase({
        guildId,
        userId: target.id,
        moderatorId: bi.user.id,
        action: "timeout",
        reason: `Timeout extended by +1h via quick action by ${bi.user.tag}`,
        details: `Extended until ${newUntil.toISOString()}`,
      });
      await sendGuildLog(interaction.client, guildId, {
        title: "⏱️ Timeout Extended (+1h)",
        color: 0xFEE75C,
        description: `**User:** ${target.user.tag} (<@${target.user.id}>)\n**Extended by:** ${bi.user.tag}\n**New Expiry:** <t:${Math.floor(newUntil.getTime() / 1000)}:R>`,
      }, "modActions", [modLogRow(guildId, target.id, extendCaseId)]);
      await bi.followUp({
        content: `⏩ Timeout extended. New expiry: <t:${Math.floor(newUntil.getTime() / 1000)}:R>`,
        flags: MessageFlags.Ephemeral,
      });
    } else if (bi.customId === `timeout_cases_${target.id}`) {
      const cases = await ModerationCaseModel.find({ guildId, userId: target.id })
        .select("_id action reason revoked createdAt")
        .sort({ createdAt: -1 })
        .limit(CASE_HISTORY_LIMIT)
        .lean();
      // Paged (it used to stop at 5) and ephemeral; only the presser can turn pages.
      await replyPagedList(bi, {
        title: `📜 Recent cases for ${target.user.tag}`,
        lines: cases.map((c, idx) => caseHistoryLine(c, idx)),
        empty: `✅ <@${target.id}> has no moderation cases recorded.`,
        perPage: 8,
        note: cases.length >= CASE_HISTORY_LIMIT ? `Newest ${CASE_HISTORY_LIMIT} · /case user for all` : "/case view for details",
        ephemeral: true,
      });
    }
  }));

  actionCollector.on("end", async (_c, endReason) => {
    if (endReason === "undone") return;
    await interaction.editReply({ components: [] }).catch(() => null);
  });
}
