import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} from "discord.js";
import { Command } from "../../types/discord";
import { commands, COMMAND_CATEGORIES } from "../loader";

const CATEGORY_ICONS: Record<string, string> = {
  general:    "🌐",
  moderation: "🔨",
  config:     "⚙️",
  logging:    "📋",
  automod:    "🛡️",
  welcome:    "👋",
  community:  "🗳️",
  automation: "⏰",
  developer:  "🔧",
};

const CATEGORIES: Record<string, string> = Object.fromEntries(
  COMMAND_CATEGORIES.map(cat => [cat, `${CATEGORY_ICONS[cat] ?? "•"} ${cat[0].toUpperCase()}${cat.slice(1)}`])
);

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
      const cmds  = allCmds.filter(c => c.category === category);

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
        { label: "Home", description: "Return to the main help menu", value: "all", emoji: "🏠" },
        ...COMMAND_CATEGORIES.map(cat => ({
          label: CATEGORIES[cat].replace(/^\S+\s/, ""),
          description: `View ${CATEGORIES[cat].replace(/^\S+\s/, "")} commands`,
          value: cat,
          emoji: CATEGORY_ICONS[cat] ?? "•",
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
