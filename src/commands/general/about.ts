import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  Colors,
} from "discord.js";
import { Command } from "../../types/discord";
import { VERSION } from "../../version";
import mongoose from "mongoose";
import { isObfuscatedChannel } from "../../utils/channels";

/** Formats a millisecond uptime into a human-readable string. */
function fmtUptime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m ${sec}s`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

/** Returns a coloured status label and emoji for a given ping. */
function pingStatus(ping: number, online: boolean): { label: string; emoji: string; colour: number } {
  if (!online)    return { label: "Offline",    emoji: "🔴", colour: Colors.Red };
  if (ping === 0) return { label: "Connecting", emoji: "🟡", colour: Colors.Yellow };
  if (ping < 100) return { label: "Excellent",  emoji: "🟢", colour: Colors.Green };
  if (ping < 200) return { label: "Good",       emoji: "🟢", colour: Colors.Green };
  if (ping < 350) return { label: "Degraded",   emoji: "🟡", colour: Colors.Yellow };
  return                 { label: "Unstable",    emoji: "🔴", colour: Colors.Red };
}

/** Memory usage formatted to MB. */
function memMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("about")
    .setDescription("Show live system status, runtime telemetry, and bot information for Aegis."),

  botPermissions: ["EmbedLinks"],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const client = interaction.client;

    const buildOverviewEmbed = () => {
      const mem  = process.memoryUsage();
      const upMs = client.uptime ?? 0;
      const ping = Math.round(client.ws.ping);
      const { label: pingLabel, emoji: pingEmoji, colour } = pingStatus(ping, client.isReady());
      const dbState = mongoose.connection.readyState === 1 ? "🟢 Connected" : "🔴 Disconnected";
      const totalMembers = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount ?? 0), 0);

      return new EmbedBuilder()
        .setColor(colour)
        .setAuthor({ name: `Aegis v${VERSION}`, iconURL: client.user?.displayAvatarURL({ size: 256 }) })
        .setTitle("🛡️ Aegis — System Overview")
        .setDescription(
          `> A high-performance Discord moderation bot featuring interactive tickets, anti-raid verification, button role panels, real-time AutoMod, giveaways, suggestion systems, and a full moderation suite.\n\n` +
          `**Status:** ${pingEmoji} **${pingLabel}** — Gateway latency \`${ping}ms\``
        )
        .setThumbnail(client.user?.displayAvatarURL({ size: 512 }) ?? null)
        .addFields(
          { name: "📌 Version",      value: `\`v${VERSION}\``,                                  inline: true },
          { name: "⚡ Runtime",      value: `\`Node.js ${process.version}\``,                   inline: true },
          { name: "📚 Library",      value: "`Discord.js v14`",                                inline: true },
          { name: "📡 Servers",      value: `**${client.guilds.cache.size.toLocaleString()}**`, inline: true },
          { name: "👥 Members",      value: `**${totalMembers.toLocaleString()}**`,              inline: true },
          { name: "🏓 Gateway Ping", value: `\`${ping}ms\``,                                    inline: true },
          { name: "⏰ Uptime",       value: `\`${fmtUptime(upMs)}\``,                           inline: true },
          { name: "🗄️ Database",    value: dbState,                                            inline: true },
          { name: "💾 Heap Used",    value: `\`${memMB(mem.heapUsed)}\``,                       inline: true },
        )
        .setFooter({ text: `Aegis • ${pingLabel} • v${VERSION}`, iconURL: client.user?.displayAvatarURL() })
        .setTimestamp();
    };

    const buildRuntimeEmbed = () => {
      const mem  = process.memoryUsage();
      const ping = Math.round(client.ws.ping);
      const { label: pingLabel, emoji: pingEmoji, colour } = pingStatus(ping, client.isReady());
      const upMs    = client.uptime ?? 0;
      const heapPct = Math.min(100, Math.round((mem.heapUsed / (mem.heapTotal || 1)) * 100));
      const filled  = Math.min(10, Math.round(heapPct / 10));
      const heapBar = "█".repeat(filled) + "░".repeat(Math.max(0, 10 - filled));

      return new EmbedBuilder()
        .setColor(colour)
        .setTitle("⚙️ Runtime Telemetry")
        .setDescription(`${pingEmoji} Gateway status: **${pingLabel}** — \`${ping}ms\``)
        .addFields(
          { name: "🧠 Heap Used",      value: `\`${memMB(mem.heapUsed)} / ${memMB(mem.heapTotal)}\``, inline: true },
          { name: "📦 RSS",            value: `\`${memMB(mem.rss)}\``,                                inline: true },
          { name: "🔗 External",       value: `\`${memMB(mem.external)}\``,                           inline: true },
          { name: "📊 Heap Usage",     value: `\`${heapBar}\` ${heapPct}%`,                           inline: false },
          { name: "⏰ Bot Uptime",     value: `\`${fmtUptime(upMs)}\``,                               inline: true },
          { name: "🕰️ Process Uptime", value: `\`${fmtUptime(process.uptime() * 1000)}\``,            inline: true },
          { name: "🏓 Gateway Ping",   value: `\`${ping}ms\``,                                        inline: true },
          { name: "💻 Platform",       value: `\`${process.platform} (${process.arch})\``,            inline: true },
          { name: "🔧 Node Version",   value: `\`${process.version}\``,                               inline: true },
          { name: "📝 PID",            value: `\`${process.pid}\``,                                   inline: true },
        )
        .setFooter({ text: "Runtime metrics • refreshed on demand", iconURL: client.user?.displayAvatarURL() })
        .setTimestamp();
    };

    const buildNetworkEmbed = () => {
      const ping = Math.round(client.ws.ping);
      const { label: pingLabel, emoji: pingEmoji, colour } = pingStatus(ping, client.isReady());
      const totalMembers  = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount ?? 0), 0);
      const totalChannels = client.channels.cache.filter(c => !isObfuscatedChannel(c)).size;
      const topGuilds = [...client.guilds.cache.values()]
        .sort((a, b) => (b.memberCount ?? 0) - (a.memberCount ?? 0))
        .slice(0, 5);
      const topField = topGuilds.length > 0
        ? topGuilds.map(g => `• **${g.name}** — ${g.memberCount?.toLocaleString() ?? "N/A"} members`).join("\n")
        : "No guilds cached";

      return new EmbedBuilder()
        .setColor(colour)
        .setTitle("🌐 Network & Guild Overview")
        .setDescription(`${pingEmoji} Gateway status: **${pingLabel}** — \`${ping}ms\``)
        .addFields(
          { name: "📡 Servers",         value: `**${client.guilds.cache.size.toLocaleString()}**`, inline: true },
          { name: "👥 Total Members",   value: `**${totalMembers.toLocaleString()}**`,              inline: true },
          { name: "📺 Channels Cached", value: `**${totalChannels.toLocaleString()}**`,             inline: true },
          { name: "🔗 WebSocket",       value: `${pingEmoji} \`${pingLabel}\` (\`${ping}ms\`)`,    inline: false },
          { name: "🏆 Largest Servers", value: topField,                                             inline: false },
        )
        .setFooter({ text: "Network telemetry • Aegis", iconURL: client.user?.displayAvatarURL() })
        .setTimestamp();
    };

    const buildDatabaseEmbed = async () => {
      const ping = Math.round(client.ws.ping);
      const { colour } = pingStatus(ping, client.isReady());
      const dbReady = mongoose.connection.readyState;
      const stateLabels: Record<number, string> = {
        0: "🔴 Disconnected",
        1: "🟢 Connected",
        2: "🟡 Connecting",
        3: "🟡 Disconnecting",
      };
      const dbStateLabel = stateLabels[dbReady] ?? "❓ Unknown";
      let dbLatency = "N/A";
      if (dbReady === 1) {
        try {
          const before = Date.now();
          await mongoose.connection.db?.admin().ping();
          dbLatency = `${Date.now() - before}ms`;
        } catch {
          dbLatency = "Error";
        }
      }
      const dbName      = mongoose.connection.name || mongoose.connection.db?.databaseName || "unknown";
      const collections = mongoose.connection.modelNames();

      return new EmbedBuilder()
        .setColor(dbReady === 1 ? colour : Colors.Red)
        .setTitle("🗄️ Database Diagnostics")
        .addFields(
          { name: "📡 Connection State",  value: dbStateLabel,                                 inline: true },
          { name: "⚡ DB Latency",        value: `\`${dbLatency}\``,                           inline: true },
          { name: "🗃️ Database Name",     value: `\`${dbName}\``,                              inline: true },
          { name: "📋 Registered Models", value: collections.length > 0
              ? collections.map(c => `\`${c}\``).join(", ")
              : "None registered",                                                               inline: false },
        )
        .setFooter({ text: "Database telemetry • Aegis", iconURL: client.user?.displayAvatarURL() })
        .setTimestamp();
    };

    const buildSelectMenu = (currentView: string) =>
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("about_view")
          .setPlaceholder("Choose a view…")
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel("System Overview").setDescription("Bot info, version, guild count, connectivity")
              .setValue("overview").setEmoji("🛡️").setDefault(currentView === "overview"),
            new StringSelectMenuOptionBuilder()
              .setLabel("Runtime Telemetry").setDescription("Memory, heap, uptime, platform")
              .setValue("runtime").setEmoji("⚙️").setDefault(currentView === "runtime"),
            new StringSelectMenuOptionBuilder()
              .setLabel("Network & Guilds").setDescription("Guild count, member totals, WebSocket")
              .setValue("network").setEmoji("🌐").setDefault(currentView === "network"),
            new StringSelectMenuOptionBuilder()
              .setLabel("Database Diagnostics").setDescription("MongoDB connection, latency, models")
              .setValue("database").setEmoji("🗄️").setDefault(currentView === "database"),
          )
      );

    const buildButtonRow = (disabled = false) =>
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("about_refresh").setLabel("Refresh").setStyle(ButtonStyle.Primary)
          .setEmoji("🔄").setDisabled(disabled),
        new ButtonBuilder()
          .setLabel("Status Page").setStyle(ButtonStyle.Link)
          .setURL("https://aegisdeno.fly.dev/status"),
        new ButtonBuilder()
          .setLabel("Documentation").setStyle(ButtonStyle.Link)
          .setURL("https://aegisdeno.fly.dev/docs"),
        new ButtonBuilder()
          .setLabel("Dashboard").setStyle(ButtonStyle.Link)
          .setURL("https://aegisdeno.fly.dev/dashboard"),
      );

    let view = "overview";
    const sent = await interaction.reply({
      embeds: [buildOverviewEmbed()],
      components: [buildSelectMenu(view), buildButtonRow()],
      fetchReply: true,
    });

    const collector = sent.createMessageComponentCollector({
      time: 120_000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on("collect", async (i) => {
      await i.deferUpdate();
      if (i.componentType === ComponentType.StringSelect && i.customId === "about_view") {
        view = i.values[0] ?? "overview";
      }
      let embed: EmbedBuilder;
      switch (view) {
        case "runtime":  embed = buildRuntimeEmbed();           break;
        case "network":  embed = buildNetworkEmbed();           break;
        case "database": embed = await buildDatabaseEmbed();    break;
        default:         embed = buildOverviewEmbed();          break;
      }
      await interaction.editReply({ embeds: [embed], components: [buildSelectMenu(view), buildButtonRow()] });
    });

    collector.on("end", async () => {
      await interaction.editReply({ components: [buildButtonRow(true)] }).catch(() => null);
    });
  },
};

export default command;
