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
    )
    .addSubcommandGroup(group =>
      group
        .setName("links")
        .setDescription("Link filtering")
        .addSubcommand(sub =>
          sub.setName("toggle").setDescription("Enable or disable link filtering")
             .addBooleanOption(opt => opt.setName("enabled").setDescription("Enabled status").setRequired(true))
        )
    )
    .addSubcommand(sub =>
      sub.setName("status").setDescription("View current automod settings")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageGuild],

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
        const word = interaction.options.getString("word", true).toLowerCase();
        if (config.words.list.includes(word)) return interaction.reply("❌ That word is already blocked.");
        config.words.list.push(word);
        await updateAutomodConfig(guildId, config);
        return interaction.reply(`✅ Added \`${word}\` to blocked words.`);
      }
      if (sub === "remove") {
        const word = interaction.options.getString("word", true).toLowerCase();
        config.words.list = config.words.list.filter(w => w !== word);
        await updateAutomodConfig(guildId, config);
        return interaction.reply(`✅ Removed \`${word}\` from blocked words.`);
      }
    }

    if (group === "links" && sub === "toggle") {
      const enabled = interaction.options.getBoolean("enabled", true);
      config.links.enabled = enabled;
      await updateAutomodConfig(guildId, config);
      return interaction.reply(`✅ Link filtering is now **${enabled ? "enabled" : "disabled"}**.`);
    }
  },
};
