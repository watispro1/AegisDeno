import { logger } from "../../utils/logger";
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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageGuild],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    await interaction.deferReply();
    try {
      const config = await getGuildConfig(guildId);

      if (sub === "view") {
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("⚙️ Server Configuration")
          .addFields(
            { name: "Prefix",   value: `\`${config.prefix}\``, inline: true },
            { name: "Language", value: `\`${config.language}\``, inline: true },
            { name: "Logging",  value: config.loggingEnabled ? `✅ <#${config.loggingChannelId}>` : "❌ Disabled", inline: true },
            { name: "Welcome",  value: config.welcomeEnabled ? `✅ <#${config.welcomeChannelId}>` : "❌ Disabled", inline: true },
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (sub === "set") {
        const key   = interaction.options.getString("key", true);
        const value = interaction.options.getString("value", true).trim();

        if (!value) {
          await interaction.editReply("❌ Value cannot be empty.");
          return;
        }

        const updates: Record<string, string> = {};
        if (key === "prefix")   updates.prefix   = value.substring(0, 5);
        else if (key === "language") updates.language = value.substring(0, 10).toLowerCase();

        await updateGuildConfig(guildId, updates);
        await interaction.editReply(`✅ Configuration updated. **${key}** is now \`${updates[key]}\`.`);
      }
    } catch (err) {
      logger.error(`Failed to handle /config ${sub} for guild ${guildId}`, err);
      await interaction.editReply("❌ Failed to update configuration. Please try again.");
    }
  },
};
