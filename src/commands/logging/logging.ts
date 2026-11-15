import { guardCollect } from "../../utils/collectorGuard";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ComponentType,
  MessageFlags,
  ChannelType,
} from "discord.js";
import { Command } from "../../types/discord";
import { getGuildConfig, updateGuildConfig } from "../../services/configuration";
import { sendGuildLog, isLogCategoryOn } from "../../services/logging";
import { logger } from "../../utils/logger";
import { botChannelProblem, dashboardRow, POST_EMBED_PERMISSIONS } from "../config/kit/setupKit";
import {
  buildLoggingButtons,
  buildLoggingEmbed,
  categoryLabel,
  fullCategoryMap,
  isLogCategoryKey,
  LOG_CATEGORY_CHOICES,
  testFailureReason,
  testLogEntry,
} from "./logging/panel";

const PAGE = "settings/logging" as const;

/** The interactive status card. Each click re-reads the settings so a dashboard change isn't overwritten. */
async function showStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const config = await getGuildConfig(guildId);
  const sent = await interaction.reply({
    embeds: [buildLoggingEmbed(config)],
    components: buildLoggingButtons(config, guildId),
    flags: MessageFlags.Ephemeral,
    withResponse: true,
  });
  const message = sent.resource?.message;
  if (!message) return;

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120_000,
    filter: (i) => i.user.id === interaction.user.id,
  });

  collector.on("collect", (i) => guardCollect("logging", i, async () => {
    await i.deferUpdate();
    const fresh = await getGuildConfig(guildId);
    let saved = fresh;

    if (i.customId.startsWith("log_cat_")) {
      const key = i.customId.slice("log_cat_".length);
      if (!isLogCategoryKey(key)) return;
      const cats = fullCategoryMap(fresh.logCategories);
      cats[key] = !cats[key];
      saved = await updateGuildConfig(guildId, { logCategories: cats });
    } else if (i.customId === "log_toggle_master") {
      if (!fresh.loggingEnabled && !fresh.loggingChannelId) {
        await i.followUp({ content: "❌ Set a log channel with `/logging channel` before turning logging on.", flags: MessageFlags.Ephemeral });
        return;
      }
      saved = await updateGuildConfig(guildId, { loggingEnabled: !fresh.loggingEnabled });
    } else if (i.customId === "log_send_test") {
      const ok = await sendGuildLog(interaction.client, guildId, testLogEntry(interaction.user.id));
      await i.followUp({ content: ok ? `✅ Test log sent to <#${fresh.loggingChannelId}>.` : testFailureReason(fresh), flags: MessageFlags.Ephemeral });
      return;
    } else {
      return;
    }

    await i.editReply({ embeds: [buildLoggingEmbed(saved)], components: buildLoggingButtons(saved, guildId) });
  }));

  collector.on("end", async () => {
    await interaction.editReply({ components: [dashboardRow(guildId, PAGE)] }).catch(() => null);
  });
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("logging")
    .setDescription("Choose the server log channel and which events get logged.")
    .addSubcommand(sub =>
      sub
        .setName("channel")
        .setDescription("Set the channel where log entries are posted (also turns logging on).")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Text channel Aegis can post embeds in").addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("toggle")
        .setDescription("Turn all logging on or off (keeps the channel and categories).")
        .addBooleanOption(opt =>
          opt.setName("enabled").setDescription("True to log events, false to stop").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("status").setDescription("See the log settings and switch event categories on or off with buttons.")
    )
    .addSubcommand(sub =>
      sub
        .setName("test")
        .setDescription("Post a test entry to check that logging works.")
        .addStringOption(opt =>
          opt.setName("category").setDescription("Test the channel one category posts to (default: the main log channel)").addChoices(...LOG_CATEGORY_CHOICES)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("category")
        .setDescription("Turn one event category on or off without opening the status card.")
        .addStringOption(opt => opt.setName("category").setDescription("Event category").setRequired(true).addChoices(...LOG_CATEGORY_CHOICES))
        .addBooleanOption(opt => opt.setName("enabled").setDescription("True to log it, false to stop").setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageGuild],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === "status") {
      await showStatus(interaction);
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      if (sub === "channel") {
        const channel = interaction.options.getChannel("channel", true);
        if (channel.type !== undefined && channel.type !== ChannelType.GuildText) {
          await interaction.editReply("❌ Pick a regular text channel; Aegis can't post log entries in that kind of channel.");
          return;
        }
        const problem = await botChannelProblem(interaction.guild!, channel as never, POST_EMBED_PERMISSIONS);
        if (problem) {
          await interaction.editReply(problem);
          return;
        }

        // Only these two fields: saving the whole config could undo a change made on the dashboard meanwhile.
        const saved = await updateGuildConfig(guildId, { loggingChannelId: channel.id, loggingEnabled: true });
        const posted = await sendGuildLog(interaction.client, guildId, {
          title: "📋 Logging Channel Configured",
          color: 0x3498DB,
          description: `This channel has been set as the log output by <@${interaction.user.id}>.\n\nServer events will now be reported here.`,
        });

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(posted ? 0x57F287 : 0xFEE75C)
              .setTitle("✅ Logging Channel Set")
              .setDescription(`Logs will now be posted to <#${channel.id}>. Logging is **enabled**.${posted ? "" : "\n⚠️ The confirmation entry couldn't be posted there; run `/logging test` to check."}`)
              .addFields(
                { name: "📊 Categories on", value: String(Object.values(fullCategoryMap(saved.logCategories)).filter(Boolean).length) + " of 8", inline: true },
                { name: "💡 Tip", value: "Use `/logging status` to choose which events are logged.", inline: false },
              )
              .setTimestamp(),
          ],
          components: [dashboardRow(guildId, PAGE)],
        });
        return;
      }

      if (sub === "toggle") {
        const enabled = interaction.options.getBoolean("enabled", true);
        const config = await getGuildConfig(guildId);
        if (enabled && !config.loggingChannelId) {
          await interaction.editReply("❌ There's no log channel yet. Run `/logging channel` to pick one; that turns logging on too.");
          return;
        }
        await updateGuildConfig(guildId, { loggingEnabled: enabled });
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(enabled ? 0x57F287 : 0xED4245)
              .setTitle(enabled ? "✅ Logging Enabled" : "🔴 Logging Disabled")
              .setDescription(enabled
                ? `Server events will now be logged to <#${config.loggingChannelId}>.`
                : "Server events will no longer be logged until re-enabled. Your channel and categories are kept.")
              .setTimestamp(),
          ],
          components: [dashboardRow(guildId, PAGE)],
        });
        return;
      }

      if (sub === "category") {
        const key = interaction.options.getString("category", true);
        const enabled = interaction.options.getBoolean("enabled", true);
        if (!isLogCategoryKey(key)) {
          await interaction.editReply("❌ Unknown log category. Pick one from the list.");
          return;
        }
        const config = await getGuildConfig(guildId);
        const cats = fullCategoryMap(config.logCategories);
        cats[key] = enabled;
        const saved = await updateGuildConfig(guildId, { logCategories: cats });
        const note = !saved.loggingEnabled || !saved.loggingChannelId ? "\n⚠️ Logging itself is off or has no channel, so nothing is posted yet." : "";
        await interaction.editReply({
          content: `✅ **${categoryLabel(key)}** logging is now **${isLogCategoryOn(saved.logCategories, key) ? "on" : "off"}**.${note}`,
          components: [dashboardRow(guildId, PAGE)],
        });
        return;
      }

      if (sub === "test") {
        const raw = interaction.options.getString("category");
        const category = isLogCategoryKey(raw) ? raw : null;
        const config = await getGuildConfig(guildId);
        if (!config.loggingChannelId) {
          await interaction.editReply("❌ No logging channel set. Use `/logging channel` first.");
          return;
        }
        const ok = await sendGuildLog(interaction.client, guildId, testLogEntry(interaction.user.id, category), category ?? undefined);
        if (!ok) {
          await interaction.editReply(testFailureReason(config, category));
          return;
        }
        const target = (category && config.logChannels?.[category]) || config.loggingChannelId;
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle("✅ Test Log Sent")
              .setDescription(`A test entry was posted in <#${target}>.`)
              .setTimestamp(),
          ],
        });
      }
    } catch (err) {
      logger.error(`Failed to handle /logging ${sub} for guild ${guildId}`, err);
      await interaction.editReply("❌ Couldn't update the logging settings. Nothing was changed; try again in a moment.").catch(() => null);
    }
  },
};

export default command;
