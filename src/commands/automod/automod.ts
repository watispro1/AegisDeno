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
    .addSubcommand(sub =>
      sub.setName("status").setDescription("View current automod settings")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageGuild],
  botPermissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const group = interaction.options.getSubcommandGroup(false);
    const sub   = interaction.options.getSubcommand(true);
    const guildId = interaction.guildId!;

    const config = await getAutomodConfig(guildId);

    if (sub === "status") {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🛡️ Automod Configuration")
        .addFields(
          { name: "Blocked Words", value: `Status: **${config.words.enabled ? "On" : "Off"}**\nWords: ${config.words.list.length}`, inline: true },
          { name: "Link Filtering", value: `Status: **${config.links.enabled ? "On" : "Off"}**\nAction: ${config.links.action}`, inline: true },
          { name: "Mention Spam", value: `Status: **${config.mentions.enabled ? "On" : "Off"}**\nLimit: ${config.mentions.threshold}`, inline: true },
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (group === "words") {
      if (sub === "toggle") {
        const enabled = interaction.options.getBoolean("enabled", true);
        config.words.enabled = enabled;
        await updateAutomodConfig(guildId, config);
        return interaction.reply(`✅ Blocked words filter is now **${enabled ? "enabled" : "disabled"}**.`);
      }
      if (sub === "add") {
        const word = interaction.options.getString("word", true).trim().toLowerCase();
        if (word.length < 2 || word.length > 100) {
          return interaction.reply({ content: "❌ Blocked words must be between 2 and 100 characters.", ephemeral: true });
        }
        if (config.words.list.includes(word)) return interaction.reply("❌ That word is already blocked.");
        config.words.list.push(word);
        await updateAutomodConfig(guildId, config);
        return interaction.reply(`✅ Added \`${word}\` to blocked words.`);
      }
      if (sub === "remove") {
        const word = interaction.options.getString("word", true).trim().toLowerCase();
        config.words.list = config.words.list.filter(w => w !== word);
        await updateAutomodConfig(guildId, config);
        return interaction.reply(`✅ Removed \`${word}\` from blocked words.`);
      }
      if (sub === "action") {
        config.words.action = interaction.options.getString("action", true) as typeof config.words.action;
        await updateAutomodConfig(guildId, config);
        return interaction.reply(`✅ Blocked-word action set to **${config.words.action}**.`);
      }
    }

    if (group === "links" && sub === "toggle") {
      const enabled = interaction.options.getBoolean("enabled", true);
      config.links.enabled = enabled;
      await updateAutomodConfig(guildId, config);
      return interaction.reply(`✅ Link filtering is now **${enabled ? "enabled" : "disabled"}**.`);
    }

    if (group === "links" && sub === "action") {
      config.links.action = interaction.options.getString("action", true) as typeof config.links.action;
      await updateAutomodConfig(guildId, config);
      return interaction.reply(`✅ Link-filter action set to **${config.links.action}**.`);
    }

    if (group === "mentions") {
      if (sub === "toggle") {
        const enabled = interaction.options.getBoolean("enabled", true);
        config.mentions.enabled = enabled;
        await updateAutomodConfig(guildId, config);
        return interaction.reply(`✅ Mention-spam filter is now **${enabled ? "enabled" : "disabled"}**.`);
      }
      if (sub === "limit") {
        config.mentions.threshold = interaction.options.getInteger("count", true);
        await updateAutomodConfig(guildId, config);
        return interaction.reply(`✅ Mention-spam limit set to **${config.mentions.threshold}** mentions.`);
      }
      if (sub === "action") {
        config.mentions.action = interaction.options.getString("action", true) as typeof config.mentions.action;
        await updateAutomodConfig(guildId, config);
        return interaction.reply(`✅ Mention-spam action set to **${config.mentions.action}**.`);
      }
    }
  },
};
