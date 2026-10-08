import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/discord";
import { addAutoResponder, removeAutoResponder, getAutoResponders } from "../../services/autoResponderService";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("autoresponder")
    .setDescription("Configure custom automated triggers and bot responses.")
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("Add a new auto-reply trigger.")
        .addStringOption(opt => opt.setName("trigger").setDescription("Text or keyword to trigger on").setRequired(true))
        .addStringOption(opt => opt.setName("response").setDescription("Bot response message (supports {user}, {server}, {channel})").setRequired(true))
        .addStringOption(opt =>
          opt
            .setName("match_type")
            .setDescription("Matching strategy")
            .setRequired(false)
            .addChoices(
              { name: "Contains Keyword", value: "contains" },
              { name: "Exact Match", value: "exact" },
              { name: "Starts With", value: "startsWith" }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription("Remove an auto-reply trigger.")
        .addStringOption(opt => opt.setName("id").setDescription("Autoresponder ID (from /autoresponder list)").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription("List all configured auto-responder triggers.")
    ),

  category: "autoresponder",
  guildOnly: true,

  async execute(interaction) {
    if (!interaction.guild) return;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "add") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "❌ You need `Manage Server` permission to add autoresponders.", ephemeral: true });
        return;
      }

      const trigger = interaction.options.getString("trigger", true);
      const response = interaction.options.getString("response", true);
      const matchType = (interaction.options.getString("match_type") || "contains") as "exact" | "contains" | "startsWith";

      const ar = await addAutoResponder({
        guildId: interaction.guild.id,
        trigger,
        response,
        matchType,
        createdBy: interaction.user.id,
      });

      if (ar) {
        await interaction.reply({
          content: `✅ Autoresponder created!\n**ID:** \`${ar.id}\` | **Trigger:** \`${ar.trigger}\` | **Match:** \`${ar.matchType}\``,
          ephemeral: true,
        });
      } else {
        await interaction.reply({ content: "❌ Failed to create autoresponder.", ephemeral: true });
      }
      return;
    }

    if (subcommand === "remove") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "❌ You need `Manage Server` permission to remove autoresponders.", ephemeral: true });
        return;
      }

      const id = interaction.options.getString("id", true);
      const deleted = await removeAutoResponder(interaction.guild.id, id);

      if (deleted) {
        await interaction.reply({ content: `✅ Removed autoresponder \`${id}\`.`, ephemeral: true });
      } else {
        await interaction.reply({ content: `❌ Autoresponder \`${id}\` was not found.`, ephemeral: true });
      }
      return;
    }

    if (subcommand === "list") {
      const list = await getAutoResponders(interaction.guild.id);
      if (list.length === 0) {
        await interaction.reply({ content: "ℹ️ No custom autoresponders configured for this server.", ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("🤖 Server Autoresponders")
        .setColor(0x34495E)
        .setDescription(
          list
            .map(
              ar =>
                `• **ID:** \`${ar.id}\` | **Trigger:** \`${ar.trigger}\` (\`${ar.matchType}\`)\n  **Response:** ${ar.response.substring(0, 80)}`
            )
            .join("\n\n")
        )
        .setFooter({ text: `Total: ${list.length} autoresponder(s)` });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }
  },
};

export default command;
