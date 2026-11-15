import { guardCollect } from "../../utils/collectorGuard";
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
  MessageFlags,
} from "discord.js";
import { Command } from "../../types/discord";
import { AUTOMOD_RULE_KEYS, enabledAutomodRules, getAutomodConfig } from "../../services/automod";
import { getGuildConfig } from "../../services/configuration";
import { SuggestionModel, TicketModel, WarningModel, ModerationCaseModel, WatchlistEntryModel } from "../../database/mongo";
import { getVerificationConfig } from "../../services/verificationService";
import { isObfuscatedChannel } from "../../utils/channels";
import { dashboardUrl } from "../../config/links";
import { automodSummaryText } from "./dashboard/automodSummary";
import { hasModerationPermissions } from "../../services/commandAccess";
import { COLORS, footer } from "../../utils/embedStyle";
import { replyPagedList } from "../../utils/listPager";
import { ownsComponent } from "../shared/componentOwner";

/** Buttons that show moderation records or security settings: staff only. */
export const DASHBOARD_STAFF_BUTTONS: readonly string[] = ["dash_automod", "dash_escalation", "dash_verify", "dash_warnings"];

/** Whether a button on /dashboard needs moderation permissions. Pure. */
export function dashboardButtonNeedsStaff(customId: string): boolean {
  return DASHBOARD_STAFF_BUTTONS.includes(customId);
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("dashboard")
    .setDescription("Server control panel: members, tickets, suggestions and (for staff) moderation and security status."),

  guildOnly: true,
  botPermissions: [PermissionFlagsBits.EmbedLinks],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guild = interaction.guild!;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    // Warning and case totals, escalation and verification settings are for staff.
    const staff = hasModerationPermissions(interaction.memberPermissions?.bitfield ?? null);

    const fetchStats = async () => {
      const [automod, config, openTickets, pendingSuggestions, totalWarnings, totalCases, vConfig, watchlistCount] = await Promise.all([
        getAutomodConfig(guild.id).catch(() => null),
        getGuildConfig(guild.id).catch(() => null),
        TicketModel.countDocuments({ guildId: guild.id, status: "open" }).catch(() => 0),
        SuggestionModel.countDocuments({ guildId: guild.id, status: "pending" }).catch(() => 0),
        staff ? WarningModel.countDocuments({ guildId: guild.id }).catch(() => 0) : 0,
        staff ? ModerationCaseModel.countDocuments({ guildId: guild.id }).catch(() => 0) : 0,
        staff ? getVerificationConfig(guild.id).catch(() => null) : null,
        staff ? WatchlistEntryModel.countDocuments({ guildId: guild.id }).catch(() => 0) : 0,
      ]);

      const automodActive = automod
        ? enabledAutomodRules(automod).length
        : 0;

      // Channels Discord has hidden from Aegis (obfuscated) are left out of the counts.
      const textChannels = guild.channels.cache.filter(c => !isObfuscatedChannel(c) && (
        c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement
      )).size;
      const voiceChannels = guild.channels.cache.filter(c => !isObfuscatedChannel(c) && (
        c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice
      )).size;

      const staffFields = [
          { name: "⚠️ Total Warnings", value: `**${totalWarnings}**`, inline: true },
          { name: "📂 Total Mod Cases", value: `**${totalCases}**`, inline: true },
          { name: "📋 Mod Log", value: config?.loggingChannelId ? `<#${config.loggingChannelId}>` : "Not configured", inline: true },
          { name: "⚡ Auto-Escalation", value: config?.escalation?.enabled ? `✅ Active (${config.escalation.thresholds?.length ?? 0} tiers)` : "❌ Disabled", inline: true },
          { name: "🛡️ Verification", value: vConfig?.enabled ? `✅ Active (${vConfig.type})` : "Not setup", inline: true },
          { name: "👁️ Watchlist", value: `**${watchlistCount}** monitored`, inline: true },
        ];
      const embed = new EmbedBuilder()
        .setTitle(`🛡️ ${guild.name} — Control Panel`)
        .setColor(COLORS.brand)
        .setThumbnail(guild.iconURL() || null)
        .setDescription(`Server management overview • Boost Level **${guild.premiumTier}** • ${guild.premiumSubscriptionCount ?? 0} boost(s)`)
        .addFields(
          { name: "👥 Members", value: `**${guild.memberCount.toLocaleString()}**`, inline: true },
          { name: "🛡️ AutoMod Filters", value: `**${automodActive} / ${AUTOMOD_RULE_KEYS.length}** Active`, inline: true },
          { name: "🤖 Bot Latency", value: `**${Math.round(interaction.client.ws.ping)}ms**`, inline: true },
          { name: "🎫 Open Tickets", value: `**${openTickets}**`, inline: true },
          { name: "💡 Pending Suggestions", value: `**${pendingSuggestions}**`, inline: true },
          { name: "💬 Text / Voice", value: `**${textChannels}** text • **${voiceChannels}** voice`, inline: true },
          ...(staff ? staffFields : []),
        )
        .setFooter(footer(staff ? "Last refreshed" : "Last refreshed · moderation details are shown to staff only"))
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
          .setCustomId("dash_escalation")
          .setLabel("Escalation")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("⚡"),
        new ButtonBuilder()
          .setCustomId("dash_verify")
          .setLabel("Verification")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("🛡️"),
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
      );
      const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("dash_roles")
          .setLabel("Roles Overview")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("🎭"),
        new ButtonBuilder()
          .setLabel("Web Dashboard")
          .setStyle(ButtonStyle.Link)
          .setURL(dashboardUrl(interaction.guildId ?? undefined))
          .setEmoji("🌐"),
      );
      if (!staff) {
        for (const row of [row1, row2]) {
          for (const b of row.components) {
            const id = "custom_id" in b.data ? b.data.custom_id : undefined;
            if (id && dashboardButtonNeedsStaff(id)) b.setDisabled(true);
          }
        }
      }
      return [row1, row2, row3];
    };

    const initialEmbed = await fetchStats();
    const sent = await interaction.editReply({
      embeds: [initialEmbed],
      components: buildRows(),
    });

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      idle: 180_000,
      filter: (i) => i.customId.startsWith("dash_"),
    });

    collector.on("collect", (i) => guardCollect("dashboard", i, async () => {
      if (!(await ownsComponent(i, interaction.user.id, "dashboard"))) return;
      if (dashboardButtonNeedsStaff(i.customId) && !hasModerationPermissions(i.memberPermissions?.bitfield ?? null)) {
        await i.reply({ content: "❌ That part of the dashboard is for moderators.", flags: MessageFlags.Ephemeral });
        return;
      }
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
            ? automodSummaryText(guild.name, automod)
            : "❌ AutoMod is not yet configured. Run `/automod` to set it up.";
          await i.reply({ content: text, flags: MessageFlags.Ephemeral });
          break;
        }
        case "dash_tickets": {
          const [count, closed] = await Promise.all([
            TicketModel.countDocuments({ guildId: guild.id, status: "open" }).catch(() => 0),
            TicketModel.countDocuments({ guildId: guild.id, status: "closed" }).catch(() => 0),
          ]);
          await i.reply({ content: `🎫 **Ticket Summary for ${guild.name}:**\n• Open: **${count}**\n• Closed (all-time): **${closed}**`, flags: MessageFlags.Ephemeral });
          break;
        }
        case "dash_suggestions": {
          const [pending, approved, rejected] = await Promise.all([
            SuggestionModel.countDocuments({ guildId: guild.id, status: "pending" }).catch(() => 0),
            SuggestionModel.countDocuments({ guildId: guild.id, status: "approved" }).catch(() => 0),
            SuggestionModel.countDocuments({ guildId: guild.id, status: "rejected" }).catch(() => 0),
          ]);
          await i.reply({ content: `💡 **Suggestions Summary for ${guild.name}:**\n• ⏳ Pending: **${pending}**\n• ✅ Approved: **${approved}**\n• ❌ Rejected: **${rejected}**`, flags: MessageFlags.Ephemeral });
          break;
        }
        case "dash_warnings": {
          const [total, last7Days] = await Promise.all([
            WarningModel.countDocuments({ guildId: guild.id }).catch(() => 0),
            WarningModel.countDocuments({ guildId: guild.id, createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }).catch(() => 0),
          ]);
          await i.reply({ content: `⚠️ **Warnings Summary for ${guild.name}:**\n• All-time: **${total}**\n• Last 7 days: **${last7Days}**\n\nUse \`/modstats\` for the full moderation dashboard.`, flags: MessageFlags.Ephemeral });
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
            flags: MessageFlags.Ephemeral,
          });
          break;
        }
        case "dash_escalation": {
          const cfg = await getGuildConfig(guild.id).catch(() => null);
          const esc = cfg?.escalation;
          const lines = esc?.thresholds?.length
            ? [...esc.thresholds].sort((a, b) => a.atWarnings - b.atWarnings).map(t => "• **" + t.atWarnings + " warns** → `" + t.action.toUpperCase() + "`" + (t.durationMinutes ? " (" + t.durationMinutes + "m)" : "")).join("\n")
            : "No escalation thresholds configured.";
          const expiryText = esc?.warnExpiryDays ? (esc.warnExpiryDays + " day(s)") : "Never expire";
          await i.reply({
            content: "⚡ **Auto-Escalation Status for " + guild.name + ":**\n• Status: **" + (esc?.enabled ? "✅ Enabled" : "❌ Disabled") + "**\n• Warn Expiry: **" + expiryText + "**\n\n**Thresholds:**\n" + lines,
            flags: MessageFlags.Ephemeral,
          });
          break;
        }
        case "dash_verify": {
          const vc = await getVerificationConfig(guild.id).catch(() => null);
          if (!vc?.enabled) {
            await i.reply({
              content: "❌ **Verification is not configured on this server.** Use `/verify setup` to enable it.",
              flags: MessageFlags.Ephemeral,
            });
            break;
          }
          const kickText = vc.kickUnverifiedMinutes > 0 ? ("**" + vc.kickUnverifiedMinutes + " minutes**") : "Disabled";
          const chanText = vc.channelId ? ("<#" + vc.channelId + ">") : "Unknown";
          await i.reply({
            content: "🛡️ **Verification Config for " + guild.name + ":**\n• Status: **✅ Active**\n• Verified Role: <@&" + vc.verifiedRoleId + ">\n• Channel: " + chanText + "\n• Challenge: `" + vc.type + "`\n• Auto-Kick: " + kickText,
            flags: MessageFlags.Ephemeral,
          });
          break;
        }
        case "dash_roles": {
          // Every role, highest first, paged instead of cut at 15.
          const roles = guild.roles.cache.filter(r => r.id !== guild.id).sort((a, b) => b.position - a.position);
          await replyPagedList(i, {
            title: `🎭 Roles in ${guild.name.slice(0, 200)} (${roles.size})`,
            lines: roles.map(r => `<@&${r.id}> · ${r.members.size} loaded member${r.members.size === 1 ? "" : "s"}${r.managed ? " · managed" : ""}`),
            empty: "This server has no roles besides @everyone.",
            perPage: 20,
            ephemeral: true,
          });
          break;
        }
      }
    }));

    collector.on("end", async () => {
      const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("Web Dashboard")
          .setStyle(ButtonStyle.Link)
          .setURL(dashboardUrl(interaction.guildId ?? undefined))
          .setEmoji("🌐"),
      );
      await interaction.editReply({ components: [linkRow] }).catch(() => null);
    });
  },
};

export default command;
