/**
 * The 60-second Undo button on /lock channel and /lock unlock (one channel).
 * Captures the @everyone Send Messages overwrite before the change and puts it
 * back exactly (allow, deny or inherit), dropping any pending auto-unlock.
 */
import { PermissionFlagsBits, type ChatInputCommandInteraction, type Message } from "discord.js";
import { clearPendingUnlocks, type LockableChannel } from "./channelLock";
import { sendGuildLog } from "./logging";
import { auditReason } from "../utils/safeText";
import { everyoneSendState, offerQuickUndo, quickUndoId, quickUndoRow } from "../utils/quickUndo";

export function offerLockUndo(interaction: ChatInputCommandInteraction, channel: LockableChannel, isLocking: boolean) {
  const guild = channel.guild;
  const previous = everyoneSendState(channel, guild.roles.everyone);
  const customId = quickUndoId(interaction.id);
  return {
    rows: [quickUndoRow(customId)],
    async attach(message: Message): Promise<void> {
      offerQuickUndo(interaction, {
        message,
        customId,
        actionAtMs: Date.now(),
        undo: async (i) => {
          if (!i.inCachedGuild() || !i.member.permissionsIn(channel.id).has(PermissionFlagsBits.ManageChannels)) {
            return { ok: false, message: `❌ You no longer have **Manage Channels** in <#${channel.id}>.` };
          }
          await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: previous }, { reason: auditReason(`Undo ${isLocking ? "lock" : "unlock"} by ${i.user.tag}`) });
          await clearPendingUnlocks(guild.id, channel.id);
          const verb = isLocking ? "Lock" : "Unlock";
          await sendGuildLog(interaction.client, guild.id, {
            title: `↩️ Channel ${verb} Undone`,
            color: 0x99aab5,
            description: `**Channel:** <#${channel.id}>\n**By:** ${i.user.tag}`,
          }, "modActions");
          const note = isLocking ? "" : " It stays locked until someone runs `/lock unlock`.";
          return { ok: true, message: `↩️ ${verb} undone: <#${channel.id}> is back the way it was.${note}` };
        },
      });
    },
  };
}
