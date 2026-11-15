import { logger } from "../../utils/logger";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
  ChannelType,
} from "discord.js";
import { Command } from "../../types/discord";
import { getGuildConfig, updateGuildConfig } from "../../services/configuration";
import { runConfigOverview } from "../shared/configOverview";
import { mediaSafetySummary, normalizeMediaSafety } from "../../services/mediaSafety";
import { memberTopRolePosition, roleAboveActor } from "../../permissions/hierarchy";
import { botChannelProblem, botRoleProblem, dashboardRow, POST_EMBED_PERMISSIONS, type DashboardPage } from "./kit/setupKit";

/** "✅ Enabled → #channel", or a warning when it is on without a channel. Pure. */
export function moduleLine(enabled: boolean, channelId: string | null | undefined): string {
  if (!enabled) return "❌ Disabled";
  return channelId ? `✅ Enabled → <#${channelId}>` : "⚠️ Enabled, but no channel is set";
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("View or change core server settings (logging, welcome, suggestions, language, media).")
    .addSubcommand(sub =>
      sub.setName("view").setDescription("See the core settings in one card (only you see it).")
    )
    .addSubcommand(sub =>
      sub.setName("overview").setDescription("Every module at a glance: what is on, what needs attention, and missing permissions.")
    )
    .addSubcommand(sub =>
      sub
        .setName("logging")
        .setDescription("Set the log channel or turn logging on/off (same as /logging).")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Text channel for log entries").addChannelTypes(ChannelType.GuildText).setRequired(false)
        )
        .addBooleanOption(opt =>
          opt.setName("enabled").setDescription("Enable or disable mod logging").setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("welcome")
        .setDescription("Change welcome channel, text, auto-role or on/off in one go.")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel for welcome messages").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false)
        )
        .addBooleanOption(opt =>
          opt.setName("enabled").setDescription("Enable or disable welcome messages").setRequired(false)
        )
        .addStringOption(opt =>
          opt
            .setName("message")
            .setDescription("Custom welcome message (use {user}, {server}, {member_count})")
            .setRequired(false)
            .setMaxLength(500)
        )
        .addRoleOption(opt =>
          opt.setName("role").setDescription("Role to give new members (must be below Aegis's role)").setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("suggestions")
        .setDescription("Set the channel where /suggest posts suggestions.")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Text channel for suggestions").addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("language")
        .setDescription("Set this server's preferred language for Aegis.")
        .addStringOption(opt =>
          opt
            .setName("language")
            .setDescription("Language code")
            .setRequired(true)
            .addChoices(
              { name: "English (en)", value: "en" },
              { name: "Spanish (es)", value: "es" },
              { name: "French (fr)", value: "fr" },
              { name: "German (de)", value: "de" },
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("media-safety")
        .setDescription("What reposts (starboard, ModMail, transcripts) do with media Discord flags as unsafe.")
        .addBooleanOption(opt =>
          opt.setName("enabled").setDescription("Keep flagged media out of reposts in channels that are not age-restricted").setRequired(false)
        )
        .addStringOption(opt =>
          opt
            .setName("mode")
            .setDescription("Replace flagged media with a note, or keep a link behind a spoiler")
            .setRequired(false)
            .addChoices(
              { name: "Placeholder — a note, no link", value: "placeholder" },
              { name: "Spoiler — a spoilered link", value: "spoiler" },
            )
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageGuild],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const config = await getGuildConfig(guildId);

      if (sub === "overview") {
        await runConfigOverview(interaction, config);
        return;
      }

      if (sub === "view") {
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(`⚙️ Server Configuration — ${interaction.guild!.name}`)
          .addFields(
            {
              name: "📋 Mod Logging",
              value: moduleLine(config.loggingEnabled, config.loggingChannelId),
              inline: true,
            },
            {
              name: "👋 Welcome Messages",
              value: moduleLine(config.welcomeEnabled, config.welcomeChannelId),
              inline: true,
            },
            {
              name: "💬 Welcome Message",
              value: `\`\`\`\n${(config.welcomeMessage || "Not set").replace(/`/g, "ˋ").slice(0, 1000)}\n\`\`\``,
              inline: false,
            },
            {
              name: "🎭 Auto-Role on Join",
              value: config.welcomeRoleId ? `<@&${config.welcomeRoleId}>` : "None",
              inline: true,
            },
            {
              name: "💡 Suggestions Channel",
              value: config.suggestionsChannelId ? `<#${config.suggestionsChannelId}>` : "Not set",
              inline: true,
            },
            {
              name: "🌐 Language",
              value: `\`${config.language || "en"}\``,
              inline: true,
            },
            {
              name: "🛡️ Flagged media",
              value: mediaSafetySummary(config.mediaSafety),
              inline: false,
            },
          )
          .setFooter({ text: "Use /config <subcommand> to update individual settings." })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed], components: [dashboardRow(guildId, "settings")], allowedMentions: { parse: [] } });
        return;
      }

      const done = (content: string, page: DashboardPage) =>
        interaction.editReply({ content, components: [dashboardRow(guildId, page)], allowedMentions: { parse: [] } });

      if (sub === "logging") {
        const channel = interaction.options.getChannel("channel");
        const enabled = interaction.options.getBoolean("enabled");
        const updates: Record<string, unknown> = {};
        if (channel !== null) updates.loggingChannelId = channel.id;
        if (enabled !== null) updates.loggingEnabled = enabled;
        if (Object.keys(updates).length === 0) {
          await interaction.editReply(`📋 **Logging:** ${moduleLine(config.loggingEnabled, config.loggingChannelId)}\nPass \`channel\` or \`enabled\` to change it.`);
          return;
        }
        if (channel !== null) {
          const problem = await botChannelProblem(interaction.guild!, channel as never, POST_EMBED_PERMISSIONS);
          if (problem) {
            await interaction.editReply(problem);
            return;
          }
        }
        if (enabled === true && !(channel?.id ?? config.loggingChannelId)) {
          await interaction.editReply("❌ Pick a `channel` too: logging needs somewhere to post.");
          return;
        }
        const saved = await updateGuildConfig(guildId, updates);
        await done(`✅ **Logging** updated: ${moduleLine(saved.loggingEnabled, saved.loggingChannelId)}`, "settings/logging");
        return;
      }

      if (sub === "welcome") {
        const channel = interaction.options.getChannel("channel");
        const enabled = interaction.options.getBoolean("enabled");
        const message = interaction.options.getString("message");
        const role = interaction.options.getRole("role");
        const updates: Record<string, unknown> = {};
        if (channel !== null) updates.welcomeChannelId = channel.id;
        if (enabled !== null) updates.welcomeEnabled = enabled;
        if (message !== null) updates.welcomeMessage = message;
        if (role !== null) updates.welcomeRoleId = role.id;
        if (Object.keys(updates).length === 0) {
          await interaction.editReply(`👋 **Welcome:** ${moduleLine(config.welcomeEnabled, config.welcomeChannelId)}\nPass an option to change it, or use \`/welcome status\`.`);
          return;
        }
        if (message !== null && !message.trim()) {
          await interaction.editReply("❌ The welcome message can't be empty.");
          return;
        }
        if (channel !== null) {
          const problem = await botChannelProblem(interaction.guild!, channel as never, [POST_EMBED_PERMISSIONS[0], POST_EMBED_PERMISSIONS[1]]);
          if (problem) {
            await interaction.editReply(problem);
            return;
          }
        }
        if (role !== null) {
          const guild = interaction.guild!;
          const problem = botRoleProblem(guild, role, "as the welcome role")
            ?? (roleAboveActor({ ownerId: guild.ownerId, actorId: interaction.user.id, actorTopPosition: await memberTopRolePosition(guild, interaction.user.id), roles: [role] })
              ? `❌ You can't use <@&${role.id}> as the welcome role: it is equal to or above your highest role.` : null);
          if (problem) {
            await interaction.editReply({ content: problem, allowedMentions: { parse: [] } });
            return;
          }
        }
        if (enabled === true && !(channel?.id ?? config.welcomeChannelId)) {
          await interaction.editReply("❌ Pick a `channel` too: welcome messages need somewhere to go.");
          return;
        }
        const saved = await updateGuildConfig(guildId, updates);
        await done([
          `✅ **Welcome** updated: ${moduleLine(saved.welcomeEnabled, saved.welcomeChannelId)}`,
          `Auto-role: ${saved.welcomeRoleId ? `<@&${saved.welcomeRoleId}>` : "none"}`,
          message !== null ? "Message saved; preview it with `/welcome preview`." : "",
        ].filter(Boolean).join("\n"), "settings/welcome");
        return;
      }

      if (sub === "suggestions") {
        const channel = interaction.options.getChannel("channel", true);
        const problem = await botChannelProblem(interaction.guild!, channel as never, POST_EMBED_PERMISSIONS);
        if (problem) {
          await interaction.editReply(problem);
          return;
        }
        await updateGuildConfig(guildId, { suggestionsChannelId: channel.id });
        await done(`✅ **Suggestions** will now be posted to <#${channel.id}>. Members send them with \`/suggest\`.`, "settings");
        return;
      }

      if (sub === "media-safety") {
        const enabled = interaction.options.getBoolean("enabled");
        const mode = interaction.options.getString("mode");
        const current = normalizeMediaSafety(config.mediaSafety);
        if (enabled === null && mode === null) {
          await interaction.editReply(`🛡️ **Flagged media:** ${mediaSafetySummary(current)}.\nChange it with the \`enabled\` or \`mode\` option.`);
          return;
        }
        const next = normalizeMediaSafety({ enabled: enabled ?? current.enabled, mode: mode ?? current.mode });
        await updateGuildConfig(guildId, { mediaSafety: next });
        await done(`✅ **Flagged media:** ${mediaSafetySummary(next)}.`, "settings");
        return;
      }

      if (sub === "language") {
        const lang = interaction.options.getString("language", true);
        await updateGuildConfig(guildId, { language: lang });
        await done(`✅ **Language** set to \`${lang}\`.`, "settings");
        return;
      }
    } catch (err) {
      logger.error(`Failed to handle /config ${sub} for guild ${guildId}`, err);
      await interaction.editReply("❌ Failed to update configuration. Please try again.");
    }
  },
};

export default command;
