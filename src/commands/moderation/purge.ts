import { guardCollect } from "../../utils/collectorGuard";
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
import {
  type PurgeCandidate,
  type PurgeFilterMode as FilterMode,
  isAfterSnowflake,
  isBulkDeletable,
  needsPurgeConfirmation,
  planPurge,
  PURGE_CONFIRM_ABOVE,
} from "../../services/purgeFilters";
import { finishPurge, type PurgeRunContext, respondViaButton } from "./purge/finish";
import { COLORS, footer } from "../../utils/embedStyle";

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
    mentionCount: msg.mentions.users.size + msg.mentions.roles.size + (msg.mentions.everyone ? 1 : 0),
    stickerCount: msg.stickers.size,
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
  attachments: "Messages with file attachments",
  invites: "Messages with server invites",
  mentions: "Messages that mention someone",
  stickers: "Messages with stickers",
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
          { name: "Messages with server invites",  value: "invites" },
          { name: "Messages with images/attachments", value: "images" },
          { name: "Messages with file attachments (no link previews)", value: "attachments" },
          { name: "Messages with embeds",          value: "embeds" },
          { name: "Messages that mention someone", value: "mentions" },
          { name: "Messages with stickers",        value: "stickers" },
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
    .addStringOption(opt =>
      opt.setName("after_message").setDescription("Only delete messages sent after this message ID: clears everything since a point").setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName("keep_pinned").setDescription("Protect pinned messages from being deleted (default: true)").setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName("preview").setDescription(`Always show a preview to confirm (default: only above ${PURGE_CONFIRM_ABOVE} messages)`).setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageMessages],
  botPermissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const amount  = interaction.options.getInteger("amount", true);
    const filter  = (interaction.options.getString("filter") ?? "all") as FilterMode;
    const target  = interaction.options.getUser("user");
    const keyword = interaction.options.getString("keyword");
    const reason  = interaction.options.getString("reason") ?? "Channel message cleanup";
    const beforeMsgId = interaction.options.getString("before_message") ?? undefined;
    const afterMsgId = interaction.options.getString("after_message")?.trim() || undefined;
    const forcePreview = interaction.options.getBoolean("preview") ?? false;
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

    for (const [name, id] of [["before_message", beforeMsgId], ["after_message", afterMsgId]] as const) {
      if (id && !/^\d{17,20}$/.test(id)) {
        return interaction.reply({ content: `❌ \`${name}\` must be a valid Discord message ID (17–20 digits). Right-click a message → Copy Message ID.`, flags: MessageFlags.Ephemeral });
      }
    }
    if (beforeMsgId && afterMsgId && !isAfterSnowflake(beforeMsgId, afterMsgId)) {
      return interaction.reply({ content: "❌ `after_message` must be older than `before_message`, or nothing can match.", flags: MessageFlags.Ephemeral });
    }

    if (filter === "keyword" && !keyword) {
      return interaction.reply({ content: "❌ You must provide a `keyword` when using the `keyword` filter.", flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // Page backwards through history until we have enough matches, hit the
      // 14-day bulk-delete limit, or reach the scan cap.
      const scanned: ScannedMessage[] = [];
      const criteria = { mode: filter, userId: target?.id, contains: keyword, skipPinned: keepPinned, afterId: afterMsgId };
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
        const plan = planPurge(scanned, criteria, amount, scanStartedAt);
        const reachedAfter = afterMsgId ? !isAfterSnowflake(oldest.id, afterMsgId) : false;
        if (plan.toDelete.length >= amount || reachedAfter || !isBulkDeletable(oldest.createdTimestamp, scanStartedAt) || page.size < 100) break;
      }

      const plan = planPurge(scanned, criteria, amount, Date.now());
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

      const filterText = `\`${filter}\`${keyword ? ` — \`${keyword}\`` : ""}${afterMsgId ? ` · after \`${afterMsgId}\`` : ""}`;
      const runCtx: Omit<PurgeRunContext, "respond"> = {
        interaction, channel, guildId, toDelete: plan.toDelete, filter, filterText, targetId: target?.id ?? null, reason, skippedNote,
      };
      // Small purges run straight away; bigger ones (or `preview: true`) show a preview to confirm.
      if (!needsPurgeConfirmation(toDelete.length, forcePreview)) {
        await finishPurge({ ...runCtx, respond: (payload) => interaction.editReply(payload) });
        return;
      }

      const sampleMessages = toDelete.slice(0, 5).map(m => {
        const author = m.author.tag.slice(0, 20);
        const content = (m.content || "[embed/attachment]").slice(0, 60);
        return `• **${author}**: ${content}${(m.content || "").length > 60 ? "…" : ""}`;
      });

      const previewEmbed = new EmbedBuilder()
        .setColor(COLORS.danger)
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
        .setFooter(footer(`Confirm within 30 seconds · purges of ${PURGE_CONFIRM_ABOVE} or fewer skip this step`))
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

      collector.on("collect", (i) => guardCollect("purge", i, async () => {
        if (i.customId === "purge_cancel") {
          await i.update({ content: "❌ Purge cancelled.", embeds: [], components: [] });
          return;
        }
        await i.deferUpdate();
        await finishPurge({ ...runCtx, respond: respondViaButton(i) });
      }));

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
