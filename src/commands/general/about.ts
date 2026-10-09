import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { Command } from "../../types/discord";
import { VERSION } from "../../version";
import mongoose from "mongoose";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("about")
    .setDescription("Display rich system status, system runtime metrics, and architecture details for Aegis."),

  botPermissions: ["EmbedLinks"],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const client = interaction.client;

    const buildEmbed = () => {
      const mem = process.memoryUsage();
      const upMs = client.uptime ?? 0;
      const upSecs = Math.floor(upMs / 1000);
      const upMins = Math.floor(upSecs / 60);
      const upHrs = Math.floor(upMins / 60);
      const days = Math.floor(upHrs / 24);

      const uptimeStr = days > 0
        ? `${days}d ${upHrs % 24}h ${upMins % 60}m`
        : `${upHrs}h ${upMins % 60}m ${upSecs % 60}s`;

      const totalMembers = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount ?? 0), 0);
      const dbState = mongoose.connection.readyState === 1 ? "🟢 Connected" : "🔴 Disconnected";

      return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🛡️ Aegis Security & Moderation Bot")
        .setDescription("A high-performance, enterprise-grade Discord bot featuring interactive ticket channels, anti-raid member verification, button role panels, and real-time AutoMod filters.")
        .setThumbnail(client.user?.displayAvatarURL({ size: 512 }) ?? null)
        .addFields(
          { name: "📌 Version", value: `\`v${VERSION}\``, inline: true },
          { name: "⚡ Node.js", value: `\`${process.version}\``, inline: true },
          { name: "📚 Library", value: "`Discord.js v14`", inline: true },
          { name: "📡 Server Count", value: `**${client.guilds.cache.size.toLocaleString()}** servers`, inline: true },
          { name: "👥 Protected Members", value: `**${totalMembers.toLocaleString()}** users`, inline: true },
          { name: "🏓 Gateway Latency", value: `\`${Math.round(client.ws.ping)}ms\``, inline: true },
          { name: "💾 Heap Usage", value: `\`${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB\``, inline: true },
          { name: "⏰ System Uptime", value: `\`${uptimeStr}\``, inline: true },
          { name: "🗄️ MongoDB Database", value: dbState, inline: true }
        )
        .setFooter({ text: `Aegis System Telemetry • ${client.user?.tag}`, iconURL: client.user?.displayAvatarURL() })
        .setTimestamp();
    };

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("about_refresh")
        .setLabel("Refresh Metrics")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🔄"),
      new ButtonBuilder()
        .setLabel("Documentation")
        .setStyle(ButtonStyle.Link)
        .setURL("https://aegisbot.dev/docs"),
      new ButtonBuilder()
        .setLabel("Dashboard")
        .setStyle(ButtonStyle.Link)
        .setURL("https://aegisbot.dev/dashboard"),
      new ButtonBuilder()
        .setLabel("Playground")
        .setStyle(ButtonStyle.Link)
        .setURL("https://aegisbot.dev/playground")
    );

    const sent = await interaction.reply({ embeds: [buildEmbed()], components: [row], fetchReply: true });

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "about_refresh") {
        await i.deferUpdate();
        await interaction.editReply({ embeds: [buildEmbed()], components: [row] });
      }
    });

    collector.on("end", async () => {
      await interaction.editReply({ components: [] }).catch(() => null);
    });
  },
};

export default command;
