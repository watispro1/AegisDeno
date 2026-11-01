import { logger } from "../../utils/logger";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types/discord";
import { sendGuildLog } from "../../services/logging";
import { addModerationCase } from "../../services/moderationCases";
import { caseActionsRow, modLogRow } from "../../services/modLogLinks";
import {
  type PurgeCandidate,
  type PurgeFilterMode as FilterMode,
  chunk,
  isBulkDeletable,
  planPurge,
} from "../../services/purgeFilters";

/** Most messages /purge will look through in one run (10 API pages). */
const MAX_SCAN = 1_000;
const MAX_AMOUNT = 500;

type ScannedMessage = PurgeCandidate & { message: Message };

function toCandidate(msg: Message): ScannedMessage {
  return {
    id: msg.id,
    authorId: msg.author.id,
    authorBot: msg.author.bot,
    content: msg.content ?? "",
    attachmentCount: msg.attachments.size,
    embedCount: msg.embeds.length,
    hasImageEmbed: msg.embeds.some((e) => Boolean(e.image || e.thumbnail)),
    pinned: msg.pinned,
    createdTimestamp: msg.createdTimestamp,
    message: msg,
  };
}

const FILTER_LABELS: Record<FilterMode, string> = {
  all:     "All messages",
  bots:    "Bot messages only",
  humans:  "Human messages only",
  links:   "Messages with links",
  images:  "Messages with images/attachments",
  embeds:  "Messages with embeds",
  keyword: "Messages matching keyword",
};

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Bulk-delete messages from this channel with advanced filters and a preview.")
    .addIntegerOption(opt =>
      opt
        .setName("amount")
        .setDescription("How many matching messages to delete (1–500)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(MAX_AMOUNT)
    )
    .addStringOption(opt =>
      opt
        .setName("filter")
        .setDescription("Filter which messages to delete (default: all)")
        .setRequired(false)
        .addChoices(
          { name: "All messages",                  value: "all" },
          { name: "Bot messages only",             value: "bots" },
          { name: "Human messages only",           value: "humans" },
          { name: "Messages with links",           value: "links" },
          { name: "Messages with images/attachments", value: "images" },
          { name: "Messages with embeds",          value: "embeds" },
          { name: "Messages matching keyword",     value: "keyword" },
        )
    )
    .addUserOption(opt =>
      opt.setName("user").setDescription("Only delete messages from this specific user").setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName("keyword").setDescription("Only delete messages containing this text (works with any filter)").setRequired(false).setMaxLength(100)
    )
    .addStringOption(opt =>
      opt.setName("reason").setDescription("Reason for the purge (recorded in mod logs)").setRequired(false).setMaxLength(256)
    )
        .addStringOption(opt =>
      opt.setName("before_message").setDescription("Only scan messages sent before this message ID (right-click a message → Copy ID)").setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName("keep_pinned").setDescription("Protect pinned messages from being deleted (default: true)").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageMessages],
  botPermissions: [PermissionFlagsBits.ManageMessages],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const amount  = interaction.options.getInteger("amount", true);
    const filter  = (interaction.options.getString("filter") ?? "all") as FilterMode;
    const target  = interaction.options.getUser("user");
    const keyword = interaction.options.getString("keyword");
    const reason  = interaction.options.getString("reason") ?? "Channel message cleanup";
    const beforeMsgId = interaction.options.getString("before_message") ?? undefined;
    const keepPinned = interaction.options.getBoolean("keep_pinned") ?? true;
    const channel = interaction.channel;
    const guildId = interaction.guildId!;

    if (!channel || !channel.isTextBased() || !("bulkDelete" in channel)) {
      return interaction.reply({ content: "❌ This command can only be used in a text channel.", flags: MessageFlags.Ephemeral });
    }

    // The guild-wide permission check is not enough: a channel overwrite can
    // take away my access here, and bulkDelete would then fail after the preview.
    const me = interaction.guild?.members.me;
    if (me && "permissionsFor" in channel) {
      const perms = channel.permissionsFor(me);
      const need = [
        [PermissionFlagsBits.ViewChannel, "View Channel"],
        [PermissionFlagsBits.ReadMessageHistory, "Read Message History"],
        [PermissionFlagsBits.ManageMessages, "Manage Messages"],
      ] as const;
      const missing = need.filter(([flag]) => !perms?.has(flag)).map(([, label]) => label);
      if (missing.length) {
        return interaction.reply({ content: `❌ I need **${missing.join("**, **")}** in this channel to purge it.`, flags: MessageFlags.Ephemeral });
      }
    }

    if (beforeMsgId && !/^\d{17,20}$/.test(beforeMsgId)) {
      return interaction.reply({ content: "❌ `before_message` must be a valid Discord message ID (17–20 digits).", flags: MessageFlags.Ephemeral });
    }

    if (filter === "keyword" && !keyword) {
      return interaction.reply({ content: "❌ You must provide a `keyword` when using the `keyword` filter.", flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // Page backwards through history until we have enough matches, hit the
      // 14-day bulk-delete limit, or reach the scan cap.
      const scanned: ScannedMessage[] = [];
      // Use beforeMsgId as the scan start point if provided
      let before: string | undefined = beforeMsgId;
      const scanStartedAt = Date.now();
      while (scanned.length < MAX_SCAN) {
        const page = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
        if (page.size === 0) break;
        const batch = [...page.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp).map(toCandidate);
        scanned.push(...batch);
        before = batch[batch.length - 1].id;
        const oldest = batch[batch.length - 1];
        const plan = planPurge(scanned, { mode: filter, userId: target?.id, contains: keyword, skipPinned: keepPinned }, amount, scanStartedAt);
        if (plan.toDelete.length >= amount || !isBulkDeletable(oldest.createdTimestamp, scanStartedAt) || page.size < 100) break;
      }

      const plan = planPurge(scanned, { mode: filter, userId: target?.id, contains: keyword, skipPinned: keepPinned }, amount, Date.now());
      const toDelete = plan.toDelete.map((c) => c.message);
      const skippedNote = [
        plan.tooOld > 0 ? `${plan.tooOld} matching message(s) are 14+ days old and can't be bulk-deleted` : null,
        plan.pinnedSkipped > 0 ? `${plan.pinnedSkipped} pinned message(s) left alone` : null,
      ].filter(Boolean).join(" · ");

      if (toDelete.length === 0) {
        await interaction.editReply(
          `⚠️ No deletable messages matched your filters (scanned ${scanned.length}).${skippedNote ? `\n${skippedNote}.` : ""}`,
        );
        return;
      }

      // Build preview embed before deleting
      const sampleMessages = toDelete.slice(0, 5).map(m => {
        const author = m.author.tag.slice(0, 20);
        const content = (m.content || "[embed/attachment]").slice(0, 60);
        return `• **${author}**: ${content}${(m.content || "").length > 60 ? "…" : ""}`;
      });

      const previewEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle("🗑️ Purge Preview")
        .setDescription(
          `Found **${toDelete.length}** message(s) matching your filter (scanned ${scanned.length}).\n` +
          (skippedNote ? `-# ${skippedNote}\n` : "") + `\n` +
          `**Sample (up to 5):**\n${sampleMessages.join("\n")}`
        )
        .addFields(
          { name: "📌 Channel",  value: `<#${channel.id}>`, inline: true },
          { name: "🔍 Filter",   value: `\`${FILTER_LABELS[filter]}\`${keyword ? ` — \`${keyword}\`` : ""}`, inline: true },
          { name: "👤 User",     value: target ? `<@${target.id}>` : "All users", inline: true },
          { name: "🗑️ To Delete", value: `**${toDelete.length}** message(s)`, inline: true },
        )
        .setFooter({ text: "Confirm to proceed with deletion." })
        .setTimestamp();

      const previewRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("purge_confirm")
          .setLabel(`Delete ${toDelete.length} message(s)`)
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🗑️"),
        new ButtonBuilder()
          .setCustomId("purge_cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("✖️"),
      );

      const preview = await interaction.editReply({ embeds: [previewEmbed], components: [previewRow] });

      const collector = preview.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30_000,
        filter: (i) => i.user.id === interaction.user.id,
        max: 1,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "purge_cancel") {
          await i.update({ content: "❌ Purge cancelled.", embeds: [], components: [] });
          return;
        }

        await i.deferUpdate();
        try {
          let deletedCount = 0;
          for (const batch of chunk(toDelete)) {
            if (batch.length === 1) {
              const ok = await batch[0].delete().then(() => true).catch(() => false);
              if (ok) deletedCount++;
            } else {
              // filterOld=true: anything that crossed the 14-day line since the preview is skipped.
              const deleted = await channel.bulkDelete(batch, true);
              deletedCount += deleted.size;
            }
          }

          // Record the case before the result so the confirmation can link to it.
          const caseOwnerId = target?.id ?? interaction.user.id;
          const caseId = await addModerationCase({
            guildId,
            userId: caseOwnerId,
            moderatorId: interaction.user.id,
            action: "purge",
            reason,
            details: `Channel: #${channel.name || channel.id} | Deleted ${deletedCount} message(s) [Filter: ${filter}]`,
          });

          // Build a progress bar representation
          const pct = Math.round((deletedCount / toDelete.length) * 100);
          const barFilled = Math.round(pct / 10);
          const progressBar = "█".repeat(barFilled) + "░".repeat(10 - barFilled) + ` ${pct}%`;

          const resultEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("🗑️ Messages Purged")
            .addFields(
              { name: "📌 Channel",    value: `<#${channel.id}>`, inline: true },
              { name: "🗑️ Deleted",   value: `**${deletedCount}** of ${toDelete.length} message(s)`, inline: true },
              { name: "🔍 Filter",     value: `\`${filter}\`${keyword ? ` — \`${keyword}\`` : ""}${target ? ` + from <@${target.id}>` : ""}`, inline: true },
              { name: "🛡️ Moderator", value: interaction.user.tag, inline: true },
              { name: "📊 Completion", value: `\`${progressBar}\``, inline: false },
            )
            .setFooter({ text: [
              deletedCount < toDelete.length ? "Some messages were already gone or crossed the 14-day limit." : "All selected messages deleted.",
              skippedNote,
              caseId ? `Case ID: ${caseId}` : "",
            ].filter(Boolean).join(" · ") })
            .setTimestamp();

          await i.editReply({
            content: null,
            embeds: [resultEmbed],
            components: caseId ? [caseActionsRow(guildId, caseOwnerId, caseId)] : [],
          });

          await sendGuildLog(interaction.client, guildId, {
            title: "🗑️ Messages Purged",
            color: 0xED4245,
            description: `**Channel:** <#${channel.id}>\n**Deleted:** ${deletedCount}/${toDelete.length}\n**Filter:** \`${filter}\`${keyword ? ` — \`${keyword}\`` : ""}\n**User Filter:** ${target ? `<@${target.id}>` : "None"}\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`,
          }, "modActions", caseId ? [modLogRow(guildId, caseOwnerId, caseId)] : undefined);
        } catch (err) {
          logger.error(`Failed to purge messages in channel ${channel.id} guild ${guildId}`, err);
          await i.editReply({ content: "❌ Failed to delete messages. Messages older than 14 days cannot be bulk-deleted.", embeds: [], components: [] });
        }
      });

      collector.on("end", async (_, stopReason) => {
        if (stopReason === "time") {
          await interaction.editReply({ content: "⏰ Purge confirmation timed out.", embeds: [], components: [] }).catch(() => null);
        }
      });
    } catch (err) {
      logger.error(`Failed to fetch messages in channel ${channel.id} guild ${guildId}`, err);
      await interaction.editReply("❌ Failed to fetch messages. Check my permissions.");
    }
  },
};

export default command;
