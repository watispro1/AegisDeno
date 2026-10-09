import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { Command } from "../../types/discord";
import { getGuildConfig, updateGuildConfig } from "../../services/configuration";
import { sendGuildLog } from "../../services/logging";

// What gets logged in each category
const LOG_CATEGORIES = [
  { key: "modActions",   label: "Mod Actions",     emoji: "🛡️", desc: "Bans, kicks, warns, timeouts" },
  { key: "memberJoins",  label: "Member Joins",    emoji: "📥", desc: "New member join events" },
  { key: "memberLeaves", label: "Member Leaves",   emoji: "📤", desc: "Member leave/kick/ban departures" },
  { key: "messageEdits", label: "Message Edits",   emoji: "✏️", desc: "Edited message content (before/after)" },
  { key: "messageDeletes", label: "Msg Deletes",  emoji: "🗑️", desc: "Deleted messages and bulk purges" },
  { key: "roleChanges",  label: "Role Changes",    emoji: "🎭", desc: "Member role additions and removals" },
  { key: "channelEvents", label: "Channel Events", emoji: "📌", desc: "Channel creates, deletes, renames" },
] as const;

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("logging")
    .setDescription("Configure the server audit log channel and event categories.")
    .addSubcommand(sub =>
      sub
        .setName("channel")
        .setDescription("Set the channel where log events are sent.")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("The channel to send logs to").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("toggle")
        .setDescription("Enable or disable all logging.")
        .addBooleanOption(opt =>
          opt.setName("enabled").setDescription("Enable logging?").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("status").setDescription("View the logging configuration with an interactive category manager.")
    )
    .addSubcommand(sub =>
      sub.setName("test").setDescription("Send a test log entry to verify the logging channel is working.")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageGuild],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const config = await getGuildConfig(guildId);

    // ── STATUS ────────────────────────────────────────────────────────────────
    if (sub === "status") {
      const enabled = config.loggingEnabled ?? false;
      const channelId = config.loggingChannelId;
      // Read per-category toggles (stored in config or default to all on)
      const categories = (config as any).logCategories as Record<string, boolean> | undefined;

      const buildStatusEmbed = (cats: Record<string, boolean> | undefined) => {
        const catLines = LOG_CATEGORIES.map(c => {
          const on = cats ? (cats[c.key] ?? true) : true;
          return `${c.emoji} **${c.label}** — ${on ? "✅ On" : "❌ Off"}\n> ${c.desc}`;
        }).join("\n");

        return new EmbedBuilder()
          .setColor(enabled ? 0x3498DB : 0xED4245)
          .setTitle("📋 Logging Configuration")
          .addFields(
            { name: "🟢 Status",   value: enabled ? "**Enabled**" : "**Disabled**", inline: true },
            { name: "📌 Channel",  value: channelId ? `<#${channelId}>` : "❌ Not set", inline: true },
            { name: "📊 Log Events", value: catLines, inline: false },
          )
          .setFooter({ text: "Use the buttons to toggle categories on or off." })
          .setTimestamp();
      };

      const buildCategoryButtons = (cats: Record<string, boolean> | undefined) => {
        // Split into rows of up to 5
        const rows: ActionRowBuilder<ButtonBuilder>[] = [];
        const chunked = LOG_CATEGORIES.reduce((acc, c, i) => {
          const rowIdx = Math.floor(i / 4);
          if (!acc[rowIdx]) acc[rowIdx] = [];
          acc[rowIdx].push(c);
          return acc;
        }, [] as typeof LOG_CATEGORIES[number][][]);

        for (const chunk of chunked) {
          rows.push(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              ...chunk.map(c => {
                const on = cats ? (cats[c.key] ?? true) : true;
                return new ButtonBuilder()
                  .setCustomId(`log_cat_${c.key}`)
                  .setLabel(`${c.label}`)
                  .setEmoji(c.emoji)
                  .setStyle(on ? ButtonStyle.Success : ButtonStyle.Secondary);
              })
            )
          );
        }

        // Control row
        rows.push(
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId("log_toggle_master")
              .setLabel(enabled ? "Disable Logging" : "Enable Logging")
              .setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Success)
              .setEmoji(enabled ? "🔴" : "🟢"),
            new ButtonBuilder()
              .setCustomId("log_send_test")
              .setLabel("Send Test Log")
              .setStyle(ButtonStyle.Primary)
              .setEmoji("🔔")
              .setDisabled(!channelId),
          )
        );

        return rows;
      };

      let currentCats = (config as any).logCategories as Record<string, boolean> | undefined;
      let currentEnabled = enabled;

      const sent = await interaction.reply({
        embeds: [buildStatusEmbed(currentCats)],
        components: buildCategoryButtons(currentCats),
        ephemeral: true,
        fetchReply: true,
      });

      const collector = sent.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120_000,
        filter: (i) => i.user.id === interaction.user.id,
      });

      collector.on("collect", async (i) => {
        await i.deferUpdate();

        if (i.customId.startsWith("log_cat_")) {
          const key = i.customId.replace("log_cat_", "");
          if (!currentCats) currentCats = Object.fromEntries(LOG_CATEGORIES.map(c => [c.key, true]));
          currentCats[key] = !(currentCats[key] ?? true);
          await updateGuildConfig(guildId, { logCategories: currentCats } as any);
        } else if (i.customId === "log_toggle_master") {
          currentEnabled = !currentEnabled;
          await updateGuildConfig(guildId, { loggingEnabled: currentEnabled });
        } else if (i.customId === "log_send_test") {
          await sendGuildLog(interaction.client, guildId, {
            title: "🔔 Test Log Entry",
            color: 0x5865F2,
            description: `This is a test log entry sent by <@${interaction.user.id}>.\n\nIf you see this message, logging is working correctly!`,
          });
          await i.followUp({ content: "✅ Test log sent!", ephemeral: true });
          return;
        }

        await i.editReply({
          embeds: [buildStatusEmbed(currentCats)],
          components: buildCategoryButtons(currentCats),
        });
      });

      collector.on("end", async () => {
        await interaction.editReply({ components: [] }).catch(() => null);
      });

      return;
    }

    // ── CHANNEL ───────────────────────────────────────────────────────────────
    if (sub === "channel") {
      const channel = interaction.options.getChannel("channel", true);
      const me = interaction.guild?.members.me;
      const targetChannel = await interaction.guild!.channels.fetch(channel.id).catch(() => null);

      if (
        !(targetChannel instanceof TextChannel) ||
        !me ||
        !targetChannel.permissionsFor(me).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])
      ) {
        return interaction.reply({
          content: "❌ I need **View Channel**, **Send Messages**, and **Embed Links** in that channel.",
          ephemeral: true,
        });
      }

      config.loggingChannelId = channel.id;
      config.loggingEnabled = true;
      await updateGuildConfig(guildId, config);

      // Send a confirmation log to the new channel
      await sendGuildLog(interaction.client, guildId, {
        title: "📋 Logging Channel Configured",
        color: 0x3498DB,
        description: `This channel has been set as the log output by <@${interaction.user.id}>.\n\nAll server events will now be reported here.`,
      });

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle("✅ Logging Channel Set")
            .setDescription(`Logs will now be posted to <#${channel.id}>. Logging is **enabled**.`)
            .addFields({ name: "💡 Tip", value: "Use `/logging status` to manage which event categories are logged.", inline: false })
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }

    // ── TOGGLE ────────────────────────────────────────────────────────────────
    if (sub === "toggle") {
      const enabled = interaction.options.getBoolean("enabled", true);
      config.loggingEnabled = enabled;
      await updateGuildConfig(guildId, config);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(enabled ? 0x57F287 : 0xED4245)
            .setTitle(enabled ? "✅ Logging Enabled" : "🔴 Logging Disabled")
            .setDescription(
              enabled
                ? `Server events will now be logged to ${config.loggingChannelId ? `<#${config.loggingChannelId}>` : "the configured channel"}.`
                : "Server events will no longer be logged until re-enabled."
            )
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }

    // ── TEST ──────────────────────────────────────────────────────────────────
    if (sub === "test") {
      if (!config.loggingChannelId) {
        return interaction.reply({
          content: "❌ No logging channel set. Use `/logging channel` first.",
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });
      await sendGuildLog(interaction.client, guildId, {
        title: "🔔 Test Log Entry",
        color: 0x5865F2,
        description: `This is a test log entry sent by <@${interaction.user.id}>.\n\nIf you see this, logging is configured correctly ✅`,
      });

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle("✅ Test Log Sent")
            .setDescription(`A test entry was posted in <#${config.loggingChannelId}>.`)
            .setTimestamp(),
        ],
      });
    }
  },
};

export default command;
