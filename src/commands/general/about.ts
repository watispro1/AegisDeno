import { guardCollect } from "../../utils/collectorGuard";
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
  MessageFlags,
} from "discord.js";
import { Command } from "../../types/discord";
import { VERSION } from "../../version";
import { dashboardUrl, docsUrl, inviteUrl, siteUrl } from "../../config/links";
import mongoose from "mongoose";
import { isObfuscatedChannel } from "../../utils/channels";
import { databaseLatency } from "../../services/statusMonitor";
import { footer } from "../../utils/embedStyle";
import { ownsComponent } from "../shared/componentOwner";

export type AboutView = "overview" | "runtime" | "network" | "database";
export const ABOUT_VIEWS: readonly AboutView[] = ["overview", "runtime", "network", "database"];

/** A view picked in the menu, or the overview for anything else. Pure. */
export function aboutView(value: string | null | undefined): AboutView {
  return (ABOUT_VIEWS as readonly string[]).includes(value ?? "") ? value as AboutView : "overview";
}

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
    .setDescription("About Aegis: version, uptime, servers, memory and database health.")
    .addStringOption(o => o.setName("view").setDescription("Which page to open first (default: overview)").setRequired(false)
      .addChoices(
        { name: "System overview", value: "overview" },
        { name: "Runtime telemetry", value: "runtime" },
        { name: "Network & servers", value: "network" },
        { name: "Database diagnostics", value: "database" },
      ))
    .addBooleanOption(o => o.setName("private").setDescription("Only you can see the reply (default: false)").setRequired(false)),

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
        .setFooter({ ...footer(`${pingLabel} · v${VERSION}`), iconURL: client.user?.displayAvatarURL() })
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
        .setFooter({ ...footer("Runtime metrics · press Refresh for new numbers"), iconURL: client.user?.displayAvatarURL() })
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
        .setFooter({ ...footer("Network telemetry"), iconURL: client.user?.displayAvatarURL() })
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
        // Bounded (2 s) like /ping, so a stalled database can't hang the menu.
        const ms = await databaseLatency().catch(() => null);
        dbLatency = ms === null ? "Timed out" : `${ms}ms`;
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
        .setFooter({ ...footer("Database telemetry"), iconURL: client.user?.displayAvatarURL() })
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
          .setURL(siteUrl("/status")),
        new ButtonBuilder()
          .setLabel("Documentation").setStyle(ButtonStyle.Link)
          .setURL(docsUrl()),
        new ButtonBuilder()
          .setLabel("Dashboard").setStyle(ButtonStyle.Link)
          .setURL(dashboardUrl()),
        new ButtonBuilder()
          .setLabel("Invite").setStyle(ButtonStyle.Link)
          .setURL(inviteUrl()),
      );

    const buildView = async (v: AboutView): Promise<EmbedBuilder> => {
      switch (v) {
        case "runtime":  return buildRuntimeEmbed();
        case "network":  return buildNetworkEmbed();
        case "database": return buildDatabaseEmbed();
        default:         return buildOverviewEmbed();
      }
    };

    let view: AboutView = aboutView(interaction.options.getString("view"));
    const isPrivate = interaction.options.getBoolean("private") ?? false;
    const response = await interaction.reply({
      embeds: [await buildView(view)],
      components: [buildSelectMenu(view), buildButtonRow()],
      withResponse: true,
      ...(isPrivate ? { flags: MessageFlags.Ephemeral as const } : {}),
    });
    const sent = response.resource?.message;
    if (!sent) return;

    const collector = sent.createMessageComponentCollector({
      idle: 120_000,
      filter: (i) => i.customId === "about_view" || i.customId === "about_refresh",
    });

    collector.on("collect", (i) => guardCollect("about", i, async () => {
      if (!(await ownsComponent(i, interaction.user.id, "about"))) return;
      await i.deferUpdate();
      if (i.componentType === ComponentType.StringSelect && i.customId === "about_view") {
        view = aboutView(i.values[0]);
      }
      const embed = await buildView(view);
      await interaction.editReply({ embeds: [embed], components: [buildSelectMenu(view), buildButtonRow()] });
    }));

    collector.on("end", async () => {
      await interaction.editReply({ components: [buildButtonRow(true)] }).catch(() => null);
    });
  },
};

export default command;
