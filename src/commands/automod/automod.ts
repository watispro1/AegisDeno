import { logger } from "../../utils/logger";
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { Command } from "../../types/discord";
import { getAutomodConfig, updateAutomodConfig } from "../../services/automod";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Configure automoderation settings.")
    .addSubcommandGroup(group =>
      group
        .setName("words")
        .setDescription("Blocked words filter")
        .addSubcommand(sub =>
          sub.setName("toggle").setDescription("Enable or disable the blocked words filter")
             .addBooleanOption(opt => opt.setName("enabled").setDescription("Enabled status").setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("add").setDescription("Add a blocked word")
             .addStringOption(opt => opt.setName("word").setDescription("Word to block").setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("remove").setDescription("Remove a blocked word")
             .addStringOption(opt => opt.setName("word").setDescription("Word to remove").setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("action").setDescription("Choose what happens when a word is blocked")
             .addStringOption(opt => opt.setName("action").setDescription("Enforcement action").setRequired(true)
               .addChoices({ name: "Delete message", value: "delete" }, { name: "Delete and warn", value: "warn" }, { name: "Delete and timeout", value: "timeout" }))
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName("links")
        .setDescription("Link filtering")
        .addSubcommand(sub =>
          sub.setName("toggle").setDescription("Enable or disable link filtering")
             .addBooleanOption(opt => opt.setName("enabled").setDescription("Enabled status").setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("action").setDescription("Choose what happens when a link is blocked")
             .addStringOption(opt => opt.setName("action").setDescription("Enforcement action").setRequired(true)
               .addChoices({ name: "Delete message", value: "delete" }, { name: "Delete and warn", value: "warn" }, { name: "Delete and timeout", value: "timeout" }))
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName("mentions")
        .setDescription("Mention-spam filter")
        .addSubcommand(sub =>
          sub.setName("toggle").setDescription("Enable or disable the mention-spam filter")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Enabled status").setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("limit").setDescription("Set how many mentions trigger the filter")
            .addIntegerOption(opt => opt.setName("count").setDescription("Mentions allowed before enforcement").setRequired(true).setMinValue(2).setMaxValue(50))
        )
        .addSubcommand(sub =>
          sub.setName("action").setDescription("Choose what happens when mention spam is detected")
            .addStringOption(opt => opt.setName("action").setDescription("Enforcement action").setRequired(true)
              .addChoices({ name: "Delete message", value: "delete" }, { name: "Delete and warn", value: "warn" }, { name: "Delete and timeout", value: "timeout" }))
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName("spam")
        .setDescription("Rapid-message spam detection")
        .addSubcommand(sub =>
          sub.setName("toggle").setDescription("Enable or disable spam detection")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Enabled status").setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("limit").setDescription("Set the message rate limit (max messages per window)")
            .addIntegerOption(opt => opt.setName("max").setDescription("Max messages before enforcement (2–30)").setRequired(true).setMinValue(2).setMaxValue(30))
            .addIntegerOption(opt => opt.setName("window").setDescription("Time window in seconds (2–60)").setRequired(true).setMinValue(2).setMaxValue(60))
        )
        .addSubcommand(sub =>
          sub.setName("action").setDescription("Choose what happens when spam is detected")
            .addStringOption(opt => opt.setName("action").setDescription("Enforcement action").setRequired(true)
              .addChoices({ name: "Delete message", value: "delete" }, { name: "Delete and warn", value: "warn" }, { name: "Delete and timeout", value: "timeout" }))
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName("exempt")
        .setDescription("Safe-list roles or channels from automod")
        .addSubcommand(sub =>
          sub.setName("addrole").setDescription("Exempt a role from all automod rules")
            .addRoleOption(opt => opt.setName("role").setDescription("Role to exempt").setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("removerole").setDescription("Remove a role from the automod exemption list")
            .addRoleOption(opt => opt.setName("role").setDescription("Role to remove").setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("addchannel").setDescription("Exempt a channel from all automod rules")
            .addChannelOption(opt => opt.setName("channel").setDescription("Channel to exempt").setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("removechannel").setDescription("Remove a channel from the automod exemption list")
            .addChannelOption(opt => opt.setName("channel").setDescription("Channel to remove").setRequired(true))
        )
    )
    .addSubcommand(sub =>
      sub.setName("status").setDescription("View current automod settings")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageGuild],
  botPermissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const group   = interaction.options.getSubcommandGroup(false);
    const sub     = interaction.options.getSubcommand(true);
    const guildId = interaction.guildId!;

    await interaction.deferReply();
    try {
      const config = await getAutomodConfig(guildId);

      // ── status ──────────────────────────────────────────────────────────────
      if (sub === "status") {
        const exemptRoles    = config.exemptRoleIds.map(id => `<@&${id}>`).join(", ") || "None";
        const exemptChannels = config.exemptChannelIds.map(id => `<#${id}>`).join(", ") || "None";

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("🛡️ Automod Configuration")
          .addFields(
            { name: "Blocked Words",   value: `${config.words.enabled ? "✅" : "❌"} ${config.words.list.length} word(s) · Action: \`${config.words.action}\``, inline: false },
            { name: "Link Filtering",  value: `${config.links.enabled ? "✅" : "❌"} Action: \`${config.links.action}\``, inline: true },
            { name: "Mention Spam",    value: `${config.mentions.enabled ? "✅" : "❌"} Limit: ${config.mentions.threshold} · Action: \`${config.mentions.action}\``, inline: true },
            { name: "Spam Detection",  value: `${config.spam.enabled ? "✅" : "❌"} Max ${config.spam.maxMessages} msg / ${config.spam.windowSeconds}s · Action: \`${config.spam.action}\``, inline: false },
            { name: "Exempt Roles",    value: exemptRoles, inline: false },
            { name: "Exempt Channels", value: exemptChannels, inline: false },
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // ── words ───────────────────────────────────────────────────────────────
      if (group === "words") {
        if (sub === "toggle") {
          config.words.enabled = interaction.options.getBoolean("enabled", true);
          await updateAutomodConfig(guildId, config);
          await interaction.editReply(`✅ Blocked words filter is now **${config.words.enabled ? "enabled" : "disabled"}**.`);
          return;
        }
        if (sub === "add") {
          const word = interaction.options.getString("word", true).trim().toLowerCase();
          if (word.length < 2 || word.length > 100) {
            await interaction.editReply("❌ Blocked words must be between 2 and 100 characters.");
            return;
          }
          if (config.words.list.includes(word)) {
            await interaction.editReply("❌ That word is already blocked.");
            return;
          }
          config.words.list.push(word);
          await updateAutomodConfig(guildId, config);
          await interaction.editReply(`✅ Added \`${word}\` to blocked words (total: ${config.words.list.length}).`);
          return;
        }
        if (sub === "remove") {
          const word = interaction.options.getString("word", true).trim().toLowerCase();
          const before = config.words.list.length;
          config.words.list = config.words.list.filter(w => w !== word);
          await updateAutomodConfig(guildId, config);
          await interaction.editReply(
            config.words.list.length < before
              ? `✅ Removed \`${word}\` from blocked words.`
              : `❌ \`${word}\` was not in the blocked words list.`
          );
          return;
        }
        if (sub === "action") {
          config.words.action = interaction.options.getString("action", true) as typeof config.words.action;
          await updateAutomodConfig(guildId, config);
          await interaction.editReply(`✅ Blocked-word action set to **${config.words.action}**.`);
          return;
        }
      }

      // ── links ───────────────────────────────────────────────────────────────
      if (group === "links") {
        if (sub === "toggle") {
          config.links.enabled = interaction.options.getBoolean("enabled", true);
          await updateAutomodConfig(guildId, config);
          await interaction.editReply(`✅ Link filtering is now **${config.links.enabled ? "enabled" : "disabled"}**.`);
          return;
        }
        if (sub === "action") {
          config.links.action = interaction.options.getString("action", true) as typeof config.links.action;
          await updateAutomodConfig(guildId, config);
          await interaction.editReply(`✅ Link-filter action set to **${config.links.action}**.`);
          return;
        }
      }

      // ── mentions ─────────────────────────────────────────────────────────────
      if (group === "mentions") {
        if (sub === "toggle") {
          config.mentions.enabled = interaction.options.getBoolean("enabled", true);
          await updateAutomodConfig(guildId, config);
          await interaction.editReply(`✅ Mention-spam filter is now **${config.mentions.enabled ? "enabled" : "disabled"}**.`);
          return;
        }
        if (sub === "limit") {
          config.mentions.threshold = interaction.options.getInteger("count", true);
          await updateAutomodConfig(guildId, config);
          await interaction.editReply(`✅ Mention-spam limit set to **${config.mentions.threshold}** mentions.`);
          return;
        }
        if (sub === "action") {
          config.mentions.action = interaction.options.getString("action", true) as typeof config.mentions.action;
          await updateAutomodConfig(guildId, config);
          await interaction.editReply(`✅ Mention-spam action set to **${config.mentions.action}**.`);
          return;
        }
      }

      // ── spam ─────────────────────────────────────────────────────────────────
      if (group === "spam") {
        if (sub === "toggle") {
          config.spam.enabled = interaction.options.getBoolean("enabled", true);
          await updateAutomodConfig(guildId, config);
          await interaction.editReply(`✅ Spam detection is now **${config.spam.enabled ? "enabled" : "disabled"}**.`);
          return;
        }
        if (sub === "limit") {
          config.spam.maxMessages  = interaction.options.getInteger("max", true);
          config.spam.windowSeconds = interaction.options.getInteger("window", true);
          await updateAutomodConfig(guildId, config);
          await interaction.editReply(`✅ Spam limit set to **${config.spam.maxMessages}** messages per **${config.spam.windowSeconds}s**.`);
          return;
        }
        if (sub === "action") {
          config.spam.action = interaction.options.getString("action", true) as typeof config.spam.action;
          await updateAutomodConfig(guildId, config);
          await interaction.editReply(`✅ Spam action set to **${config.spam.action}**.`);
          return;
        }
      }

      // ── exempt ───────────────────────────────────────────────────────────────
      if (group === "exempt") {
        if (sub === "addrole") {
          const role = interaction.options.getRole("role", true);
          if (config.exemptRoleIds.includes(role.id)) {
            await interaction.editReply(`❌ <@&${role.id}> is already exempt.`);
            return;
          }
          config.exemptRoleIds.push(role.id);
          await updateAutomodConfig(guildId, config);
          await interaction.editReply(`✅ <@&${role.id}> will now bypass all automod rules.`);
          return;
        }
        if (sub === "removerole") {
          const role = interaction.options.getRole("role", true);
          config.exemptRoleIds = config.exemptRoleIds.filter(id => id !== role.id);
          await updateAutomodConfig(guildId, config);
          await interaction.editReply(`✅ Removed <@&${role.id}> from the automod exemption list.`);
          return;
        }
        if (sub === "addchannel") {
          const channel = interaction.options.getChannel("channel", true);
          if (config.exemptChannelIds.includes(channel.id)) {
            await interaction.editReply(`❌ <#${channel.id}> is already exempt.`);
            return;
          }
          config.exemptChannelIds.push(channel.id);
          await updateAutomodConfig(guildId, config);
          await interaction.editReply(`✅ <#${channel.id}> will now bypass all automod rules.`);
          return;
        }
        if (sub === "removechannel") {
          const channel = interaction.options.getChannel("channel", true);
          config.exemptChannelIds = config.exemptChannelIds.filter(id => id !== channel.id);
          await updateAutomodConfig(guildId, config);
          await interaction.editReply(`✅ Removed <#${channel.id}> from the automod exemption list.`);
          return;
        }
      }
    } catch (err) {
      logger.error(`Failed to handle /automod ${group ?? ""}/${sub} for guild ${guildId}`, err);
      await interaction.editReply("❌ Failed to update automod configuration. Please try again.");
    }
  },
};
