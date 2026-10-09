import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { Command } from "../../types/discord";
import { BOT_OWNER_IDS } from "../../config/env";
import { commands } from "../loader";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("developer")
    .setDescription("Developer-only commands.")
    .addSubcommand(sub =>
      sub.setName("stats").setDescription("View advanced bot memory and runtime statistics")
    )
    .addSubcommand(sub =>
      sub.setName("guilds").setDescription("List all guilds the bot is currently in")
    )
    .addSubcommand(sub =>
      sub.setName("commands").setDescription("List all currently loaded commands in memory")
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!BOT_OWNER_IDS.has(interaction.user.id)) {
      return interaction.reply({ content: "❌ You do not have permission to use developer commands.", ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "stats") {
      const mem = process.memoryUsage();
      const uptimeSecs = Math.floor(process.uptime());
      const days    = Math.floor(uptimeSecs / 86400);
      const hours   = Math.floor((uptimeSecs % 86400) / 3600);
      const minutes = Math.floor((uptimeSecs % 3600) / 60);
      const seconds = uptimeSecs % 60;

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle("🔧 Developer Stats")
        .addFields(
          { name: "Heap Total",   value: `\`${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB\``, inline: true },
          { name: "Heap Used",    value: `\`${(mem.heapUsed  / 1024 / 1024).toFixed(2)} MB\``, inline: true },
          { name: "RSS",          value: `\`${(mem.rss       / 1024 / 1024).toFixed(2)} MB\``, inline: true },
          { name: "External",     value: `\`${(mem.external  / 1024 / 1024).toFixed(2)} MB\``, inline: true },
          { name: "Node.js",      value: `\`${process.version}\``,                             inline: true },
          { name: "Platform",     value: `\`${process.platform} ${process.arch}\``,            inline: true },
          { name: "Uptime",       value: `\`${days}d ${hours}h ${minutes}m ${seconds}s\``,     inline: false },
          { name: "Guilds",       value: `\`${interaction.client.guilds.cache.size}\``,        inline: true },
          { name: "Commands",     value: `\`${commands.size}\``,                               inline: true },
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === "guilds") {
      const guildList = interaction.client.guilds.cache
        .map(g => `\`${g.id}\` — **${g.name}** (${g.memberCount} members)`)
        .join("\n") || "No guilds cached.";

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🌐 Guild List (${interaction.client.guilds.cache.size} total)`)
        .setDescription(guildList.length > 4000 ? guildList.substring(0, 4000) + "\n..." : guildList)
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === "commands") {
      const byCategory = new Map<string, string[]>();
      for (const [name, cmd] of commands) {
        const cat = cmd.category ?? "unknown";
        if (!byCategory.has(cat)) byCategory.set(cat, []);
        byCategory.get(cat)!.push(`\`/${name}\``);
      }

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle(`📋 Loaded Commands (${commands.size} total)`)
        .setTimestamp();

      for (const [category, names] of byCategory) {
        embed.addFields({ name: `${category[0].toUpperCase()}${category.slice(1)}`, value: names.join(", "), inline: false });
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

export default command;
