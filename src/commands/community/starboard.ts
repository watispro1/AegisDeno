/** /starboard: configure and inspect the starboard. */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  MessageFlags,
  type AutocompleteInteraction,
} from "discord.js";
import type { Command } from "../../types/discord";
import {
  getStarboardConfig,
  updateStarboardConfig,
  listStarboardEntries,
} from "../../services/starboard";
import { hiddenChannelMessage, isObfuscatedChannel } from "../../utils/channels";
import { runStarboardTop } from "../shared/starboardTop";
import { checkReactionEmoji } from "../shared/inputChecks";
import { applyIgnoreChange, clippedMentions, ignoreChangeMessage, starboardListLine, starEmojiChoices } from "../shared/starboardSettings";
import { replyPagedList } from "../../utils/listPager";
import { footer } from "../../utils/embedStyle";

/** What Aegis needs in the starboard channel to post there. */
const STARBOARD_CHANNEL_PERMISSIONS: ReadonlyArray<[bigint, string]> = [
  [PermissionFlagsBits.ViewChannel, "View Channel"],
  [PermissionFlagsBits.SendMessages, "Send Messages"],
  [PermissionFlagsBits.EmbedLinks, "Embed Links"],
];

/** The permissions from the list above that `has` says Aegis lacks, as labels. */
export function missingStarboardPermissions(has: (flag: bigint) => boolean): string[] {
  return STARBOARD_CHANNEL_PERMISSIONS.filter(([flag]) => !has(flag)).map(([, label]) => label);
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("starboard")
    .setDescription("Set up the starboard (channel, emoji, threshold, ignores) and browse starred posts.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // setup
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

    // threshold
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

    // emoji
    .addSubcommand((sub) =>
      sub
        .setName("emoji")
        .setDescription("Set the emoji that triggers starring.")
        .addStringOption((opt) =>
          opt
            .setName("emoji")
            .setDescription("One emoji (e.g. ⭐, 🌟), or pick a server emoji from the list")
            .setRequired(true)
            .setMaxLength(64)
            .setAutocomplete(true),
        ),
    )

    // selfstar
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

    // ignore
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

    // list
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Show the most recent starred messages.")
        .addIntegerOption((opt) =>
          opt
            .setName("limit")
            .setDescription("How many to show (1–50, default 10), paged")
            .setMinValue(1)
            .setMaxValue(50)
            .setRequired(false),
        ),
    )

    // top
    .addSubcommand((sub) =>
      sub
        .setName("top")
        .setDescription("Show the most-starred posts and the members with the most stars.")
        .addStringOption((opt) =>
          opt
            .setName("period")
            .setDescription("Which starboard posts to count (default: all time)")
            .setRequired(false)
            .addChoices(
              { name: "Past 7 days", value: "week" },
              { name: "Past 30 days", value: "month" },
              { name: "All time", value: "all" },
            ),
        )
        .addUserOption((opt) =>
          opt.setName("user").setDescription("Only posts by this member").setRequired(false),
        )
        .addBooleanOption((opt) =>
          opt.setName("share").setDescription("Post the list in the channel instead of only to you").setRequired(false),
        ),
    )

    // config
    .addSubcommand((sub) =>
      sub
        .setName("config")
        .setDescription("Show the current starboard configuration."),
    )

    // toggle
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

  /** `emoji`: what was typed, a few common choices, then this server's emojis. */
  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== "emoji") return interaction.respond([]);
    const emojis = [...(interaction.guild?.emojis.cache.values() ?? [])].map(e => ({ id: e.id, name: e.name, animated: e.animated }));
    await interaction.respond(starEmojiChoices(String(focused.value ?? ""), emojis));
  },

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "❌ This command can only be used in a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // /starboard setup
    if (sub === "setup") {
      const picked = interaction.options.getChannel("channel", true);
      const channel = (interaction.guild?.channels.cache.get(picked.id)
        ?? await interaction.guild?.channels.fetch(picked.id).catch(() => null)) as TextChannel | null | undefined;
      // A channel Aegis can't see (Discord obfuscates it) can never receive starboard posts.
      if (isObfuscatedChannel(channel) || isObfuscatedChannel(picked)) {
        await interaction.reply({ content: `❌ ${hiddenChannelMessage(picked.id)}`, flags: MessageFlags.Ephemeral });
        return;
      }
      const me = interaction.guild?.members.me ?? null;
      const perms = channel && me && "permissionsFor" in channel ? channel.permissionsFor(me) : null;
      const missing = perms ? missingStarboardPermissions(flag => perms.has(flag)) : [];
      if (missing.length) {
        await interaction.reply({
          content: `❌ I need **${missing.join("**, **")}** in <#${picked.id}> to post starred messages there. Give my role those permissions in the channel, then run this again.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await updateStarboardConfig(guildId, { channelId: picked.id });
      const config = await getStarboardConfig(guildId);
      await interaction.reply({
        content: `⭐ Starboard channel set to <#${picked.id}>. Messages that reach **${config.threshold}** ${config.emoji} will be reposted there.` +
          (config.enabled ? "" : "\n⚠️ The starboard is switched off; turn it on with `/starboard toggle enabled:true` or on the dashboard."),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // /starboard threshold
    if (sub === "threshold") {
      const count = interaction.options.getInteger("count", true);
      const before = await getStarboardConfig(guildId);
      await updateStarboardConfig(guildId, { threshold: count });
      await interaction.reply({
        content: before.threshold === count
          ? `⭐ The threshold was already **${count}** ${before.emoji}.`
          : `⭐ Starboard threshold changed from **${before.threshold}** to **${count}** ${before.emoji}. Posts already on the starboard stay.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // /starboard emoji
    if (sub === "emoji") {
      // Any text used to be saved, so a typo left the starboard waiting on an emoji nobody can react with.
      const checked = checkReactionEmoji(interaction.options.getString("emoji", true));
      if (!checked.ok) {
        await interaction.reply({ content: `❌ ${checked.error}`, flags: MessageFlags.Ephemeral });
        return;
      }
      const emoji = checked.value;
      const customId = /^<a?:\w+:(\d+)>$/.exec(emoji)?.[1];
      if (customId && interaction.guild && !interaction.guild.emojis.cache.has(customId)) {
        await interaction.reply({ content: "❌ That emoji isn't from this server, so members may not be able to react with it. Pick one of this server's emojis or a standard one.", flags: MessageFlags.Ephemeral });
        return;
      }
      await updateStarboardConfig(guildId, { emoji });
      await interaction.reply({
        content: `⭐ Starboard trigger emoji set to **${emoji}**.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // /starboard selfstar
    if (sub === "selfstar") {
      const allowed = interaction.options.getBoolean("allowed", true);
      await updateStarboardConfig(guildId, { selfStar: allowed });
      await interaction.reply({
        content: `⭐ Self-starring is now **${allowed ? "allowed" : "disabled"}**.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // /starboard ignore
    if (sub === "ignore") {
      const action = interaction.options.getString("action", true) as "add" | "remove";
      const channel = interaction.options.getChannel("channel");
      const role = interaction.options.getRole("role");

      if (!channel && !role) {
        await interaction.reply({
          content: "❌ Please specify at least a channel or a role to ignore.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const config = await getStarboardConfig(guildId);
      const change = applyIgnoreChange(config, action, { channelId: channel?.id, roleId: role?.id });
      if (change.changed.length) await updateStarboardConfig(guildId, { ignoredChannels: change.ignoredChannels, ignoredRoles: change.ignoredRoles });
      await interaction.reply({ content: ignoreChangeMessage(action, change), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
      return;
    }

    // /starboard list
    if (sub === "list") {
      const limit = interaction.options.getInteger("limit") ?? 10;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const [entries, config] = await Promise.all([listStarboardEntries(guildId, limit), getStarboardConfig(guildId)]);
      if (!entries.length) {
        await interaction.editReply({ content: "⭐ No messages have hit the starboard yet." });
        return;
      }

      await replyPagedList(interaction, {
        title: `${config.emoji} Recent Starboard Entries`,
        lines: entries.map((e, i) => starboardListLine(e as Parameters<typeof starboardListLine>[0], i, guildId, config.emoji)),
        perPage: 10,
        color: 0xffd700,
        note: `${entries.length} most recent · /starboard top for the most-starred`,
        ephemeral: true,
      });
      return;
    }

    // /starboard top
    if (sub === "top") {
      await runStarboardTop(interaction, guildId);
      return;
    }

    // /starboard config
    if (sub === "config") {
      const config = await getStarboardConfig(guildId);

      const channelStr = config.channelId ? `<#${config.channelId}>` : "Not set";
      // Long ignore lists used to overflow the 1024-character field and fail the reply.
      const ignoredCh = clippedMentions(config.ignoredChannels.map((id) => `<#${id}>`));
      const ignoredRoles = clippedMentions(config.ignoredRoles.map((id) => `<@&${id}>`));

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
        .setFooter(footer("Change settings with /starboard setup, threshold, emoji, selfstar, ignore or toggle"));

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    // /starboard toggle
    if (sub === "toggle") {
      const enabled = interaction.options.getBoolean("enabled", true);
      await updateStarboardConfig(guildId, { enabled });
      const channelId = enabled ? (await getStarboardConfig(guildId)).channelId : "set";
      await interaction.reply({
        content: `⭐ Starboard is now **${enabled ? "enabled" : "disabled"}**.` + (channelId ? "" : "\n⚠️ No starboard channel is set yet, so nothing will be posted. Pick one with `/starboard setup`."),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({ content: "❌ Unknown subcommand.", flags: MessageFlags.Ephemeral });
  },
};
