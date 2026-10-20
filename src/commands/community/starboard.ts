/**
 * /starboard — Configure and inspect the Starboard plugin.
 *
 * Subcommands:
 *   setup     — Set the channel where starred messages are posted
 *   threshold — Change the minimum reaction count required
 *   emoji     — Change the trigger emoji
 *   selfstar  — Allow/deny the message author's own reaction from counting
 *   ignore    — Add or remove a channel/role from the ignore list
 *   list      — Show the most recent starboard entries
 *   config    — Show the current configuration
 *   toggle    — Enable or disable the starboard
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
} from "discord.js";
import type { Command } from "../../types/discord";
import {
  getStarboardConfig,
  updateStarboardConfig,
  listStarboardEntries,
} from "../../services/starboard";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("starboard")
    .setDescription("Configure or inspect the server's starboard.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // ── setup ──────────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Set the channel where starred messages will be posted.")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("The starboard channel")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    )

    // ── threshold ──────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName("threshold")
        .setDescription("Set the minimum number of reactions needed to reach the starboard.")
        .addIntegerOption((opt) =>
          opt
            .setName("count")
            .setDescription("Minimum reaction count (1–100)")
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(true),
        ),
    )

    // ── emoji ──────────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName("emoji")
        .setDescription("Set the emoji that triggers starring.")
        .addStringOption((opt) =>
          opt
            .setName("emoji")
            .setDescription("Emoji to use (e.g. ⭐, 🌟, or a custom emoji)")
            .setRequired(true),
        ),
    )

    // ── selfstar ───────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName("selfstar")
        .setDescription("Allow or deny the message author's own reaction from counting.")
        .addBooleanOption((opt) =>
          opt
            .setName("allowed")
            .setDescription("true = author can star their own message")
            .setRequired(true),
        ),
    )

    // ── ignore ─────────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName("ignore")
        .setDescription("Add or remove a channel or role from the starboard ignore list.")
        .addStringOption((opt) =>
          opt
            .setName("action")
            .setDescription("add or remove")
            .setRequired(true)
            .addChoices(
              { name: "add", value: "add" },
              { name: "remove", value: "remove" },
            ),
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to add/remove from ignore list")
            .setRequired(false),
        )
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("Role to add/remove from ignore list")
            .setRequired(false),
        ),
    )

    // ── list ───────────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Show the most recent starred messages.")
        .addIntegerOption((opt) =>
          opt
            .setName("limit")
            .setDescription("How many to show (1–20, default 10)")
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(false),
        ),
    )

    // ── config ─────────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName("config")
        .setDescription("Show the current starboard configuration."),
    )

    // ── toggle ─────────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName("toggle")
        .setDescription("Enable or disable the starboard.")
        .addBooleanOption((opt) =>
          opt
            .setName("enabled")
            .setDescription("true = on, false = off")
            .setRequired(true),
        ),
    ),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageGuild],
  botPermissions: [
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
  ],
  category: "community",

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // ── /starboard setup ──────────────────────────────────────────────────
    if (sub === "setup") {
      const channel = interaction.options.getChannel("channel", true) as TextChannel;
      await updateStarboardConfig(guildId, { channelId: channel.id });
      await interaction.reply({
        content: `⭐ Starboard channel set to ${channel}. Messages that hit the reaction threshold will be reposted there.`,
        ephemeral: true,
      });
      return;
    }

    // ── /starboard threshold ──────────────────────────────────────────────
    if (sub === "threshold") {
      const count = interaction.options.getInteger("count", true);
      await updateStarboardConfig(guildId, { threshold: count });
      await interaction.reply({
        content: `⭐ Starboard threshold updated to **${count}** reaction(s).`,
        ephemeral: true,
      });
      return;
    }

    // ── /starboard emoji ──────────────────────────────────────────────────
    if (sub === "emoji") {
      const emoji = interaction.options.getString("emoji", true).trim();
      await updateStarboardConfig(guildId, { emoji });
      await interaction.reply({
        content: `⭐ Starboard trigger emoji set to **${emoji}**.`,
        ephemeral: true,
      });
      return;
    }

    // ── /starboard selfstar ───────────────────────────────────────────────
    if (sub === "selfstar") {
      const allowed = interaction.options.getBoolean("allowed", true);
      await updateStarboardConfig(guildId, { selfStar: allowed });
      await interaction.reply({
        content: `⭐ Self-starring is now **${allowed ? "allowed" : "disabled"}**.`,
        ephemeral: true,
      });
      return;
    }

    // ── /starboard ignore ─────────────────────────────────────────────────
    if (sub === "ignore") {
      const action = interaction.options.getString("action", true) as "add" | "remove";
      const channel = interaction.options.getChannel("channel");
      const role = interaction.options.getRole("role");

      if (!channel && !role) {
        await interaction.reply({
          content: "❌ Please specify at least a channel or a role to ignore.",
          ephemeral: true,
        });
        return;
      }

      const config = await getStarboardConfig(guildId);
      let ignoredChannels = [...config.ignoredChannels];
      let ignoredRoles = [...config.ignoredRoles];

      if (channel) {
        if (action === "add" && !ignoredChannels.includes(channel.id)) {
          ignoredChannels.push(channel.id);
        } else if (action === "remove") {
          ignoredChannels = ignoredChannels.filter((id) => id !== channel.id);
        }
      }
      if (role) {
        if (action === "add" && !ignoredRoles.includes(role.id)) {
          ignoredRoles.push(role.id);
        } else if (action === "remove") {
          ignoredRoles = ignoredRoles.filter((id) => id !== role.id);
        }
      }

      await updateStarboardConfig(guildId, { ignoredChannels, ignoredRoles });

      const what = [channel && `<#${channel.id}>`, role && `<@&${role.id}>`].filter(Boolean).join(" and ");
      await interaction.reply({
        content: `⭐ ${action === "add" ? "Added" : "Removed"} ${what} ${action === "add" ? "to" : "from"} the starboard ignore list.`,
        ephemeral: true,
      });
      return;
    }

    // ── /starboard list ───────────────────────────────────────────────────
    if (sub === "list") {
      const limit = interaction.options.getInteger("limit") ?? 10;
      await interaction.deferReply({ ephemeral: true });

      const entries = await listStarboardEntries(guildId, limit);
      if (!entries.length) {
        await interaction.editReply({ content: "⭐ No messages have hit the starboard yet." });
        return;
      }

      const lines = entries.map((e, i) => {
        const timestamp = Math.floor(new Date(e.createdAt as Date).getTime() / 1000);
        return `**${i + 1}.** ${e.starCount}⭐ · <#${e.sourceChannelId}> · <t:${timestamp}:R>`;
      });

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle("⭐ Recent Starboard Entries")
        .setDescription(lines.join("\n"))
        .setFooter({ text: `Showing ${entries.length} most recent` });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // ── /starboard config ─────────────────────────────────────────────────
    if (sub === "config") {
      const config = await getStarboardConfig(guildId);

      const channelStr = config.channelId ? `<#${config.channelId}>` : "Not set";
      const ignoredCh = config.ignoredChannels.length
        ? config.ignoredChannels.map((id) => `<#${id}>`).join(", ")
        : "None";
      const ignoredRoles = config.ignoredRoles.length
        ? config.ignoredRoles.map((id) => `<@&${id}>`).join(", ")
        : "None";

      const embed = new EmbedBuilder()
        .setColor(config.enabled ? 0xffd700 : 0x636363)
        .setTitle("⭐ Starboard Configuration")
        .addFields(
          { name: "Status",           value: config.enabled ? "✅ Enabled" : "❌ Disabled", inline: true },
          { name: "Channel",          value: channelStr, inline: true },
          { name: "Emoji",            value: config.emoji, inline: true },
          { name: "Threshold",        value: `${config.threshold} reaction(s)`, inline: true },
          { name: "Self-starring",    value: config.selfStar ? "Allowed" : "Disabled", inline: true },
          { name: "\u200b",           value: "\u200b", inline: true },
          { name: "Ignored Channels", value: ignoredCh },
          { name: "Ignored Roles",    value: ignoredRoles },
        )
        .setFooter({ text: "Use /starboard to modify settings" });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // ── /starboard toggle ─────────────────────────────────────────────────
    if (sub === "toggle") {
      const enabled = interaction.options.getBoolean("enabled", true);
      await updateStarboardConfig(guildId, { enabled });
      await interaction.reply({
        content: `⭐ Starboard is now **${enabled ? "enabled" : "disabled"}**.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({ content: "❌ Unknown subcommand.", ephemeral: true });
  },
};
