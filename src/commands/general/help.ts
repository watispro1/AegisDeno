import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} from "discord.js";
import { Command } from "../../types/discord";
import { commands } from "../loader";

const CATEGORIES: Record<string, string> = {
  general:    "🌐 General",
  moderation: "🔨 Moderation",
  config:     "⚙️ Config",
  logging:    "📋 Logging",
  automod:    "🛡️ Automod",
  welcome:    "👋 Welcome",
  community:  "🗳️ Community",
  automation: "⏰ Automation",
  developer:  "🔧 Developer",
};

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Browse all available bot commands interactively."),

  execute: async (interaction: ChatInputCommandInteraction) => {
    const allCmds = Array.from(commands.values());

    const generateCategoryEmbed = (category: string | null) => {
      if (!category || category === "all") {
        return new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("🛡️ Aegis — Command Hub")
          .setDescription(
            `Select a category from the dropdown below to view specific commands.\n\n**${allCmds.length} commands loaded.**`
          )
          .setFooter({ text: "Aegis Bot • Interactive Menu" })
          .setTimestamp();
      }

      const label = CATEGORIES[category] ?? category;
      const cmds  = allCmds.filter(c => {
        const file = (c as any).__file ?? "";
        return file.includes(`/${category}/`);
      });

      return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${label} Commands`)
        .setDescription(
          cmds.length
            ? cmds.map(c => `**/${c.data.name}** — ${c.data.description}`).join("\n")
            : "No commands found in this category."
        )
        .setFooter({ text: "Aegis Bot • Interactive Menu" })
        .setTimestamp();
    };

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("help_category_select")
      .setPlaceholder("Select a command category...")
      .addOptions(
        { label: "🏠 Home", description: "Return to the main help menu", value: "all", emoji: "🏠" },
        ...Object.entries(CATEGORIES).map(([value, label]) => ({
          label: label.substring(3), // strip emoji from label text
          description: `View ${label.substring(3)} commands`,
          value,
          emoji: label.substring(0, 2).trim()
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const sent = await interaction.reply({
      embeds: [generateCategoryEmbed("all")],
      components: [row],
      ephemeral: true,
      fetchReply: true
    });

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 300_000,
    });

    collector.on("collect", async (i) => {
      const selected = i.values[0];
      await i.update({
        embeds: [generateCategoryEmbed(selected)],
        components: [row]
      });
    });
  },
};
