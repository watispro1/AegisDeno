import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/discord";
import { applyPreset, PRESETS, PresetType } from "../../services/presetService";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("preset")
    .setDescription("Apply curated 1-click server moderation presets.")
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName("apply")
        .setDescription("Apply a server preset to automod, warnings, and escalation.")
        .addStringOption(opt =>
          opt
            .setName("type")
            .setDescription("Preset type to apply")
            .setRequired(true)
            .addChoices(
              { name: "Casual Server", value: "casual" },
              { name: "Standard Community", value: "community" },
              { name: "Gaming Hub", value: "gaming" },
              { name: "Strict Security", value: "strict" }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("view")
        .setDescription("View preset descriptions and configuration rules.")
        .addStringOption(opt =>
          opt
            .setName("type")
            .setDescription("Preset type to inspect")
            .setRequired(false)
            .addChoices(
              { name: "Casual Server", value: "casual" },
              { name: "Standard Community", value: "community" },
              { name: "Gaming Hub", value: "gaming" },
              { name: "Strict Security", value: "strict" }
            )
        )
    ),

  category: "config",
  guildOnly: true,

  async execute(interaction) {
    if (!interaction.guild) return;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "view") {
      const type = (interaction.options.getString("type") || "community") as PresetType;
      const preset = PRESETS[type];

      const embed = new EmbedBuilder()
        .setTitle(`⚙️ Server Preset: ${preset.name}`)
        .setColor(0x3498DB)
        .setDescription(preset.description)
        .addFields(
          { name: "Automod Words Filter", value: preset.automod.words.enabled ? "🟢 Enabled" : "🔴 Disabled", inline: true },
          { name: "Automod Links Filter", value: preset.automod.links.enabled ? "🟢 Enabled" : "🔴 Disabled", inline: true },
          { name: "Spam Protection Threshold", value: `${preset.automod.spam.maxMessages} msgs / ${preset.automod.spam.windowSeconds}s`, inline: true },
          { name: "Escalation Rules", value: preset.escalation.thresholds.map(t => `• ${t.atWarnings} Warnings → \`${t.action.toUpperCase()}\``).join("\n") || "None", inline: false }
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (subcommand === "apply") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "❌ You need `Administrator` permission to apply presets.", ephemeral: true });
        return;
      }

      const type = interaction.options.getString("type", true) as PresetType;
      await interaction.deferReply({ ephemeral: true });

      const applied = await applyPreset(interaction.guild.id, type);

      const embed = new EmbedBuilder()
        .setTitle(`✅ Applied Preset: ${applied.name}`)
        .setColor(0x2ECC71)
        .setDescription(`Successfully applied **${applied.name}** configuration to ${interaction.guild.name}!`)
        .setFooter({ text: "Automod and warning escalation settings updated." });

      await interaction.editReply({ embeds: [embed] });
      return;
    }
  },
};

export default command;
