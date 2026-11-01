import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  Colors,
} from "discord.js";
import { Command } from "../../types/discord";
import { siteUrl } from "../../config/links";
import mongoose from "mongoose";

/** Formats a millisecond uptime into a human-readable string. */
function fmtUptime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

/** Determines health quality tier, emoji, and color. */
function getHealthTier(ping: number) {
  if (ping <= 0) return { label: "Connecting", emoji: "🟡", color: Colors.Yellow };
  if (ping < 100) return { label: "Excellent", emoji: "🟢", color: Colors.Green };
  if (ping < 200) return { label: "Good", emoji: "🟢", color: Colors.Green };
  if (ping < 350) return { label: "Degraded", emoji: "🟡", color: Colors.Yellow };
  return { label: "Unstable", emoji: "🔴", color: Colors.Red };
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check real-time gateway heartbeat, round-trip message latency, and database performance."),

  botPermissions: ["EmbedLinks"],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const measureDb = async (): Promise<string> => {
      if (mongoose.connection.readyState !== 1) return "Disconnected";
      try {
        const start = Date.now();
        await mongoose.connection.db?.admin().ping();
        return `${Date.now() - start}ms`;
      } catch {
        return "Error";
      }
    };

    const buildEmbed = (roundtrip: number, wsPing: number, dbPing: string) => {
      const tier = getHealthTier(wsPing);
      const uptime = fmtUptime(interaction.client.uptime ?? 0);
      const memMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

      return new EmbedBuilder()
        .setColor(tier.color)
        .setTitle("🏓 Pong! System Telemetry")
        .setDescription(
          `**Health Tier:** ${tier.emoji} **${tier.label}**\n` +
          `Gateway heartbeat and message latency are within active operating parameters.`
        )
        .addFields(
          { name: "⚡ Round-trip", value: `\`${roundtrip}ms\``, inline: true },
          { name: "📡 Gateway WS", value: `\`${wsPing}ms\``, inline: true },
          { name: "🗄️ MongoDB",    value: `\`${dbPing}\``, inline: true },
          { name: "⏰ Bot Uptime", value: `\`${uptime}\``, inline: true },
          { name: "💾 Heap Memory", value: `\`${memMb} MB\``, inline: true },
          { name: "🌐 Servers",    value: `\`${interaction.client.guilds.cache.size.toLocaleString()}\``, inline: true },
        )
        .setFooter({
          text: `Aegis • Latency Probe • ${tier.label}`,
          iconURL: interaction.client.user?.displayAvatarURL(),
        })
        .setTimestamp();
    };

    const buildButtonRow = (disabled = false) => {
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("ping_refresh")
          .setLabel("Refresh")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🔄")
          .setDisabled(disabled),
        new ButtonBuilder()
          .setLabel("Live Status")
          .setStyle(ButtonStyle.Link)
          .setURL(siteUrl("/status"))
          .setEmoji("📊"),
      );
    };

    const initialSent = await interaction.reply({ content: "🏓 Pinging gateway and database...", fetchReply: true });
    const initialRoundtrip = Math.max(1, initialSent.createdTimestamp - interaction.createdTimestamp);
    const initialDb = await measureDb();
    const initialWs = Math.round(interaction.client.ws.ping);

    await interaction.editReply({
      content: null,
      embeds: [buildEmbed(initialRoundtrip, initialWs, initialDb)],
      components: [buildButtonRow(false)],
    });

    const collector = initialSent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 90_000,
      filter: (i) => i.customId === "ping_refresh" && i.user.id === interaction.user.id,
    });

    collector.on("collect", async (i) => {
      const clickStart = Date.now();
      await i.deferUpdate();
      const dbPing = await measureDb();
      const roundtrip = Math.max(1, Date.now() - clickStart);
      const wsPing = Math.round(interaction.client.ws.ping);

      await interaction.editReply({
        embeds: [buildEmbed(roundtrip, wsPing, dbPing)],
        components: [buildButtonRow(false)],
      });
    });

    collector.on("end", async () => {
      await interaction.editReply({ components: [buildButtonRow(true)] }).catch(() => null);
    });
  },
};

export default command;
