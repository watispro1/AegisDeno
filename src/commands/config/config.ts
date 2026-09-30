import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { Command } from "../../types/discord";
import { getGuildConfig, updateGuildConfig } from "../../services/configuration";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("View or change server configuration.")
    .addSubcommand(sub =>
      sub.setName("view").setDescription("View current configuration")
    )
    .addSubcommand(sub =>
      sub
        .setName("set")
        .setDescription("Set a configuration option")
        .addStringOption(opt =>
          opt
            .setName("key")
            .setDescription("The setting to change")
            .setRequired(true)
            .addChoices(
              { name: "Prefix (Legacy)", value: "prefix" },
              { name: "Language", value: "language" }
            )
        )
        .addStringOption(opt => opt.setName("value").setDescription("The new value").setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.Administrator],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const config = await getGuildConfig(guildId);

    if (sub === "view") {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("⚙️ Server Configuration")
        .addFields(
          { name: "Prefix", value: `\`${config.prefix}\``, inline: true },
          { name: "Language", value: `\`${config.language}\``, inline: true },
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "set") {
      const key = interaction.options.getString("key", true);
      const value = interaction.options.getString("value", true);

      if (key === "prefix") config.prefix = value;
      else if (key === "language") config.language = value;

      await updateGuildConfig(guildId, config);
      return interaction.reply(`✅ Configuration updated. **${key}** is now \`${value}\`.`);
    }
  },
};
