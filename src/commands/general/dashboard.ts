import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";
import { Command } from "../../types/discord";
import { getAutomodConfig } from "../../services/automod";
import { getGuildConfig } from "../../services/configuration";
import { SuggestionModel, TicketModel, WarningModel, ModerationCaseModel } from "../../database/mongo";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("dashboard")
    .setDescription("Display an interactive server management and stats dashboard."),

  guildOnly: true,
  botPermissions: [PermissionFlagsBits.EmbedLinks],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guild = interaction.guild!;
    await interaction.deferReply({ ephemeral: true });

    const fetchStats = async () => {
      const [automod, config, openTickets, pendingSuggestions, totalWarnings, totalCases] = await Promise.all([
        getAutomodConfig(guild.id).catch(() => null),
        getGuildConfig(guild.id).catch(() => null),
        TicketModel.countDocuments({ guildId: guild.id, status: "open" }).catch(() => 0),
        SuggestionModel.countDocuments({ guildId: guild.id, status: "pending" }).catch(() => 0),
        WarningModel.countDocuments({ guildId: guild.id }).catch(() => 0),
        ModerationCaseModel.countDocuments({ guildId: guild.id }).catch(() => 0),
      ]);

      const automodActive = automod
        ? [automod.words.enabled, automod.links.enabled, automod.mentions.enabled, automod.spam.enabled].filter(Boolean).length
        : 0;

      const textChannels = guild.channels.cache.filter(c =>
        c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement
      ).size;
      const voiceChannels = guild.channels.cache.filter(c =>
        c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice
      ).size;

      const embed = new EmbedBuilder()
        .setTitle(`🛡️ ${guild.name} — Control Panel`)
        .setColor(0x5865F2)
        .setThumbnail(guild.iconURL() || null)
        .setDescription(`Server management overview • Boost Level **${guild.premiumTier}** • ${guild.premiumSubscriptionCount ?? 0} boost(s)`)
        .addFields(
          { name: "👥 Members", value: `**${guild.memberCount.toLocaleString()}**`, inline: true },
          { name: "🛡️ AutoMod Filters", value: `**${automodActive} / 4** Active`, inline: true },
          { name: "🤖 Bot Latency", value: `**${Math.round(interaction.client.ws.ping)}ms**`, inline: true },
          { name: "🎫 Open Tickets", value: `**${openTickets}**`, inline: true },
          { name: "💡 Pending Suggestions", value: `**${pendingSuggestions}**`, inline: true },
          { name: "⚠️ Total Warnings", value: `**${totalWarnings}**`, inline: true },
          { name: "📂 Total Mod Cases", value: `**${totalCases}**`, inline: true },
          { name: "💬 Text / Voice", value: `**${textChannels}** text • **${voiceChannels}** voice`, inline: true },
          { name: "📋 Mod Log", value: config?.loggingChannelId ? `<#${config.loggingChannelId}>` : "Not configured", inline: true },
        )
        .setFooter({ text: `AegisDeno • Last refreshed` })
        .setTimestamp();

      return embed;
    };

    const buildRows = () => {
      const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("dash_refresh")
          .setLabel("Refresh Stats")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🔄"),
        new ButtonBuilder()
          .setCustomId("dash_automod")
          .setLabel("AutoMod Status")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("🛡️"),
        new ButtonBuilder()
          .setCustomId("dash_tickets")
          .setLabel("Open Tickets")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("🎫"),
        new ButtonBuilder()
          .setCustomId("dash_suggestions")
          .setLabel("Pending Suggestions")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("💡"),
      );
      const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("dash_warnings")
          .setLabel("Warnings Summary")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("⚠️"),
        new ButtonBuilder()
          .setCustomId("dash_health")
          .setLabel("Server Health")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("❤️"),
        new ButtonBuilder()
          .setCustomId("dash_roles")
          .setLabel("Roles Overview")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("🎭"),
      );
      return [row1, row2];
    };

    const initialEmbed = await fetchStats();
    const sent = await interaction.editReply({
      embeds: [initialEmbed],
      components: buildRows(),
    });

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 180_000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on("collect", async (i) => {
      switch (i.customId) {
        case "dash_refresh": {
          await i.deferUpdate();
          const updated = await fetchStats();
          await i.editReply({ embeds: [updated], components: buildRows() });
          break;
        }
        case "dash_automod": {
          const automod = await getAutomodConfig(guild.id).catch(() => null);
          const text = automod
            ? [
                `🛡️ **AutoMod Configuration for ${guild.name}:**`,
                ``,
                `**Word Filter:** ${automod.words.enabled ? "✅ Enabled" : "❌ Disabled"} — Action: \`${automod.words.action}\` — Words: \`${automod.words.list.length}\``,
                `**Link Filter:** ${automod.links.enabled ? "✅ Enabled" : "❌ Disabled"} — Action: \`${automod.links.action}\``,
                `**Mention Spam:** ${automod.mentions.enabled ? "✅ Enabled" : "❌ Disabled"} — Threshold: \`${automod.mentions.threshold}\``,
                `**Chat Spam:** ${automod.spam.enabled ? "✅ Enabled" : "❌ Disabled"} — Limit: \`${automod.spam.maxMessages}\` msgs / \`${automod.spam.windowSeconds}s\``,
                ``,
                `**Exempt Roles:** ${automod.exemptRoleIds.length > 0 ? automod.exemptRoleIds.map((id: string) => `<@&${id}>`).join(", ") : "None"}`,
                `**Exempt Channels:** ${automod.exemptChannelIds.length > 0 ? automod.exemptChannelIds.map((id: string) => `<#${id}>`).join(", ") : "None"}`,
              ].join("\n")
            : "❌ AutoMod is not yet configured. Run `/automod` to set it up.";
          await i.reply({ content: text, ephemeral: true });
          break;
        }
        case "dash_tickets": {
          const count = await TicketModel.countDocuments({ guildId: guild.id, status: "open" }).catch(() => 0);
          const closed = await TicketModel.countDocuments({ guildId: guild.id, status: "closed" }).catch(() => 0);
          await i.reply({ content: `🎫 **Ticket Summary for ${guild.name}:**\n• Open: **${count}**\n• Closed (all-time): **${closed}**`, ephemeral: true });
          break;
        }
        case "dash_suggestions": {
          const [pending, approved, rejected] = await Promise.all([
            SuggestionModel.countDocuments({ guildId: guild.id, status: "pending" }).catch(() => 0),
            SuggestionModel.countDocuments({ guildId: guild.id, status: "approved" }).catch(() => 0),
            SuggestionModel.countDocuments({ guildId: guild.id, status: "rejected" }).catch(() => 0),
          ]);
          await i.reply({ content: `💡 **Suggestions Summary for ${guild.name}:**\n• ⏳ Pending: **${pending}**\n• ✅ Approved: **${approved}**\n• ❌ Rejected: **${rejected}**`, ephemeral: true });
          break;
        }
        case "dash_warnings": {
          const total = await WarningModel.countDocuments({ guildId: guild.id }).catch(() => 0);
          const last7Days = await WarningModel.countDocuments({
            guildId: guild.id,
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          }).catch(() => 0);
          await i.reply({ content: `⚠️ **Warnings Summary for ${guild.name}:**\n• All-time: **${total}**\n• Last 7 days: **${last7Days}**\n\nUse \`/modstats\` for the full moderation dashboard.`, ephemeral: true });
          break;
        }
        case "dash_health": {
          const ping = Math.round(interaction.client.ws.ping);
          const pingStatus = ping < 100 ? "🟢 Excellent" : ping < 200 ? "🟡 Good" : ping < 400 ? "🟠 Degraded" : "🔴 Poor";
          const uptime = process.uptime();
          const h = Math.floor(uptime / 3600);
          const m = Math.floor((uptime % 3600) / 60);
          await i.reply({
            content: [
              `❤️ **Server Health — ${guild.name}:**`,
              `• API Latency: **${ping}ms** (${pingStatus})`,
              `• Bot Uptime: **${h}h ${m}m**`,
              `• Guilds Connected: **${interaction.client.guilds.cache.size}**`,
            ].join("\n"),
            ephemeral: true,
          });
          break;
        }
        case "dash_roles": {
          const topRoles = guild.roles.cache
            .filter(r => r.id !== guild.id)
            .sort((a, b) => b.position - a.position)
            .map(r => r.name)
            .slice(0, 15)
            .join(", ");
          await i.reply({
            content: `🎭 **Roles Overview for ${guild.name}:**\n• Total Roles: **${Math.max(0, guild.roles.cache.size - 1)}**\n• Top Roles: ${topRoles || "None"}`,
            ephemeral: true,
          });
          break;
        }
      }
    });

    collector.on("end", async () => {
      await interaction.editReply({ components: [] }).catch(() => null);
    });
  },
};

export default command;
