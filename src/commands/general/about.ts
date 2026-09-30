import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { Command } from "../../types/discord";

const BOT_VERSION = "1.0.0";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("about")
    .setDescription("Show information about Aegis Bot."),

  execute: async (interaction: ChatInputCommandInteraction) => {
    const client = interaction.client;
    const mem    = process.memoryUsage();
    const upMs   = client.uptime ?? 0;
    const upSecs = Math.floor(upMs / 1000);
    const upMins = Math.floor(upSecs / 60);
    const upHrs  = Math.floor(upMins / 60);

    const uptimeStr = `${upHrs}h ${upMins % 60}m ${upSecs % 60}s`;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("🛡️ About Aegis Bot")
      .setDescription("A powerful, modular Discord bot built with **TypeScript** and **Discord.js**.")
      .setThumbnail(client.user?.displayAvatarURL() ?? null)
      .addFields(
        { name: "Version",     value: `\`${BOT_VERSION}\``,             inline: true },
        { name: "Runtime",     value: `\`Node.js ${process.version}\``, inline: true },
        { name: "Library",     value: "`Discord.js v14`",               inline: true },
        { name: "Guilds",      value: `\`${client.guilds.cache.size}\``,inline: true },
        { name: "Uptime",      value: `\`${uptimeStr}\``,               inline: true },
        { name: "Memory",      value: `\`${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB\``, inline: true },
      )
      .setFooter({ text: `Bot ID: ${client.user?.id}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
