import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from "discord.js";
import { Command } from "../../types/discord";
import { BOT_OWNER_IDS } from "../../config/env";
import { commands } from "../loader";
import { contextMenus } from "../contextMenus";
import { replyPagedList } from "../../utils/listPager";

/** Category fields for /developer commands, each kept inside Discord's 1024-character field limit. Pure. */
export function commandFields(byCategory: Map<string, string[]>): Array<{ name: string; value: string; inline: boolean }> {
  return [...byCategory].sort(([a], [b]) => a.localeCompare(b)).slice(0, 24).map(([category, names]) => {
    const sorted = [...names].sort();
    let value = "";
    let shown = 0;
    for (const n of sorted) {
      const next = value ? `${value}, ${n}` : n;
      if (next.length > 1000) break;
      value = next;
      shown++;
    }
    if (shown < sorted.length) value += ` +${sorted.length - shown} more`;
    return { name: `${category[0].toUpperCase()}${category.slice(1)} (${sorted.length})`, value: value || "—", inline: false };
  });
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("developer")
    .setDescription("Bot owner tools: runtime stats, server list and loaded commands.")
    .addSubcommand(sub =>
      sub.setName("stats").setDescription("Memory, uptime, ping and cache sizes (bot owners only)")
    )
    .addSubcommand(sub =>
      sub.setName("guilds").setDescription("Every server Aegis is in, largest first, a page at a time")
    )
    .addSubcommand(sub =>
      sub.setName("commands").setDescription("Slash commands and context menus loaded right now")
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!BOT_OWNER_IDS.has(interaction.user.id)) {
      return interaction.reply({ content: "❌ You do not have permission to use developer commands.", flags: MessageFlags.Ephemeral });
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
          { name: "Commands",     value: `\`${commands.size}\` + \`${contextMenus.size}\` menus`,  inline: true },
          { name: "Gateway ping", value: `\`${Math.round(interaction.client.ws.ping)}ms\``,      inline: true },
          { name: "Cached users", value: `\`${interaction.client.users.cache.size}\``,           inline: true },
          { name: "Started",      value: `<t:${Math.floor((Date.now() - uptimeSecs * 1000) / 1000)}:R>`, inline: true },
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (sub === "guilds") {
      const guilds = [...interaction.client.guilds.cache.values()].sort((x, y) => y.memberCount - x.memberCount);
      const members = guilds.reduce((n, g) => n + g.memberCount, 0);
      await replyPagedList(interaction, {
        title: `🌐 Guild List (${guilds.length} total)`,
        lines: guilds.map((g, i) => `${i + 1}. \`${g.id}\` — **${g.name.replace(/[*_`~|]/g, "")}** (${g.memberCount.toLocaleString("en-US")} members)`),
        empty: "No guilds cached.",
        header: `${members.toLocaleString("en-US")} members in total`,
        perPage: 20,
        ephemeral: true,
      });
      return;
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

      embed.addFields(...commandFields(byCategory));
      embed.setFooter({ text: `Context menus: ${[...contextMenus.keys()].join(", ")}`.slice(0, 2048) });

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  },
};

export default command;
