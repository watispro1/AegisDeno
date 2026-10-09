import { logger } from "../../utils/logger";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  TextChannel,
  ChannelType,
} from "discord.js";
import { Command } from "../../types/discord";
import { sendGuildLog } from "../../services/logging";

// ─── Slowmode presets ─────────────────────────────────────────────────────────

const PRESET_CHOICES = [
  { name: "Off (disabled)",   value: 0    },
  { name: "5 seconds",        value: 5    },
  { name: "10 seconds",       value: 10   },
  { name: "15 seconds",       value: 15   },
  { name: "30 seconds",       value: 30   },
  { name: "1 minute",         value: 60   },
  { name: "2 minutes",        value: 120  },
  { name: "5 minutes",        value: 300  },
  { name: "10 minutes",       value: 600  },
  { name: "15 minutes",       value: 900  },
  { name: "30 minutes",       value: 1800 },
  { name: "1 hour",           value: 3600 },
  { name: "6 hours (max)",    value: 21600},
];

function formatDuration(seconds: number): string {
  if (seconds === 0)    return "**Disabled**";
  if (seconds < 60)    return `**${seconds} second${seconds !== 1 ? "s" : ""}**`;
  if (seconds < 3600)  return `**${seconds / 60} minute${seconds / 60 !== 1 ? "s" : ""}**`;
  return `**${seconds / 3600} hour${seconds / 3600 !== 1 ? "s" : ""}**`;
}

// ─── Command ─────────────────────────────────────────────────────────────────

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Manage message rate limits on text channels.")
    .addSubcommand(sub =>
      sub
        .setName("set")
        .setDescription("Set slowmode on a channel using a friendly preset.")
        .addIntegerOption(opt =>
          opt
            .setName("duration")
            .setDescription("Slowmode preset (or use 'custom' subcommand for a specific value)")
            .setRequired(true)
            .addChoices(...PRESET_CHOICES)
        )
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel to configure (defaults to current)").setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName("reason").setDescription("Reason for setting slowmode").setMaxLength(256).setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("custom")
        .setDescription("Set a specific slowmode value in seconds (0–21600).")
        .addIntegerOption(opt =>
          opt
            .setName("seconds")
            .setDescription("Slowmode duration in seconds (0 to disable)")
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(21600)
        )
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel to configure (defaults to current)").setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName("reason").setDescription("Reason for setting slowmode").setMaxLength(256).setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("check")
        .setDescription("Check the current slowmode on a channel.")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel to check (defaults to current)").setRequired(false)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageChannels],
  botPermissions:  [PermissionFlagsBits.ManageChannels],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    const targetChan = (interaction.options.getChannel("channel") ?? interaction.channel) as TextChannel | null;

    if (!targetChan || !("setRateLimitPerUser" in targetChan)) {
      return interaction.reply({ content: "❌ Slowmode can only be set on text channels.", ephemeral: true });
    }

    // ── /slowmode check ────────────────────────────────────────────────────
    if (sub === "check") {
      const currentRate = (targetChan as TextChannel).rateLimitPerUser ?? 0;
      const embed = new EmbedBuilder()
        .setColor(currentRate === 0 ? 0x57F287 : 0x3498DB)
        .setTitle("🐌 Slowmode Status")
        .addFields(
          { name: "📌 Channel",     value: `<#${targetChan.id}>`, inline: true },
          { name: "⏱️ Current Rate", value: formatDuration(currentRate), inline: true },
          { name: "📊 Max (Discord)", value: "6 hours", inline: true },
        )
        .setFooter({ text: `Checked by ${interaction.user.tag}` })
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── /slowmode set / custom ─────────────────────────────────────────────
    const seconds = sub === "set"
      ? interaction.options.getInteger("duration", true)
      : interaction.options.getInteger("seconds", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided.";

    await interaction.deferReply();
    try {
      await (targetChan as TextChannel).setRateLimitPerUser(
        seconds,
        `${reason} | Set by ${interaction.user.tag}`,
      );

      const action = seconds === 0 ? "🔓 Slowmode Disabled" : "🐌 Slowmode Set";
      const color  = seconds === 0 ? 0x57F287 : 0x3498DB;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(action)
        .addFields(
          { name: "📌 Channel",      value: `<#${targetChan.id}>`, inline: true },
          { name: "⏱️ New Duration",  value: formatDuration(seconds), inline: true },
          { name: "📝 Reason",        value: reason, inline: false },
          { name: "🛡️ Set By",       value: interaction.user.tag, inline: true },
        )
        .setTimestamp();

      // Quick-adjust buttons
      const quickRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`slowmode_off_${targetChan.id}`)
          .setLabel("Turn Off")
          .setStyle(ButtonStyle.Success)
          .setEmoji("🔓")
          .setDisabled(seconds === 0),
        new ButtonBuilder()
          .setCustomId(`slowmode_5s_${targetChan.id}`)
          .setLabel("5s")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`slowmode_30s_${targetChan.id}`)
          .setLabel("30s")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`slowmode_5m_${targetChan.id}`)
          .setLabel("5m")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`slowmode_1h_${targetChan.id}`)
          .setLabel("1h")
          .setStyle(ButtonStyle.Danger),
      );

      const sent = await interaction.editReply({ embeds: [embed], components: [quickRow] });

      await sendGuildLog(interaction.client, guildId, {
        title: action,
        color,
        description: `**Channel:** <#${targetChan.id}>\n**Duration:** ${formatDuration(seconds)}\n**Reason:** ${reason}\n**Set By:** ${interaction.user.tag}`,
      });

      // Collect quick-adjust clicks
      const quickPresets: Record<string, number> = { off: 0, "5s": 5, "30s": 30, "5m": 300, "1h": 3600 };
      const collector = sent.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60_000,
        filter: (i) => i.memberPermissions?.has(PermissionFlagsBits.ManageChannels) === true,
      });

      collector.on("collect", async (i) => {
        const parts = i.customId.split("_");
        const key = parts.slice(1, -1).join("_");
        const newRate = quickPresets[key] ?? 0;

        await i.deferUpdate();
        try {
          await (targetChan as TextChannel).setRateLimitPerUser(
            newRate,
            `Quick-adjust by ${i.user.tag}`,
          );
          const updatedEmbed = EmbedBuilder.from(embed)
            .setTitle(newRate === 0 ? "🔓 Slowmode Disabled" : "🐌 Slowmode Set")
            .setColor(newRate === 0 ? 0x57F287 : 0x3498DB)
            .spliceFields(1, 1, { name: "⏱️ New Duration", value: formatDuration(newRate), inline: true });
          await interaction.editReply({ embeds: [updatedEmbed], components: [quickRow] });
        } catch (err) {
          logger.warn("Quick-adjust slowmode failed", err);
        }
      });

      collector.on("end", async () => {
        await interaction.editReply({ components: [] }).catch(() => null);
      });

    } catch (err) {
      logger.error(`Failed to set slowmode on channel ${targetChan.id}`, err);
      await interaction.editReply("❌ Failed to set slowmode. Check my permissions.");
    }
  },
};

export default command;
