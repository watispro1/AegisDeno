import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  PermissionFlagsBits,
} from "discord.js";
import { Command } from "../../types/discord";
import { commands, COMMAND_CATEGORIES } from "../loader";

const CATEGORY_ICONS: Record<string, string> = {
  general: "🌐",
  moderation: "🔨",
  config: "⚙️",
  logging: "📋",
  automod: "🛡️",
  welcome: "👋",
  community: "🗳️",
  automation: "⏰",
  tickets: "🎫",
  verification: "🛡️",
  autoresponder: "🤖",
  roles: "🎭",
  developer: "🔧",
};

const CATEGORIES: Record<string, string> = Object.fromEntries(
  COMMAND_CATEGORIES.map((cat) => [
    cat,
    `${CATEGORY_ICONS[cat] ?? "•"} ${cat[0].toUpperCase()}${cat.slice(1)}`,
  ]),
);

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Browse all available bot commands interactively or inspect a specific command.")
    .addStringOption(opt =>
      opt.setName("command").setDescription("Specific command to inspect (e.g. warn, ticket, embed)").setRequired(false)
    ),

  botPermissions: [PermissionFlagsBits.EmbedLinks],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const targetCommandName = interaction.options.getString("command")?.toLowerCase().trim();
    const allCmds = Array.from(commands.values());

    // ─── SPECIFIC COMMAND LOOKUP ──────────────────────────────────────────────
    if (targetCommandName) {
      const cleanName = targetCommandName.replace(/^\//, "");
      const foundCmd = commands.get(cleanName);

      if (!foundCmd) {
        await interaction.reply({
          content: `❌ Command \`/${cleanName}\` not found. Use \`/help\` to view the list of available commands.`,
          ephemeral: true,
        });
        return;
      }

      const json = foundCmd.data.toJSON();
      const formatPerms = (perms: any) => {
        if (!perms) return null;
        if (Array.isArray(perms)) {
          return perms.map(p => typeof p === "string" ? p : String(p)).join(", ");
        }
        return String(perms);
      };

      const userPerms = formatPerms(foundCmd.userPermissions) || "Everyone";
      const botPerms = formatPerms(foundCmd.botPermissions) || "Send Messages";

      const subcommands = json.options?.filter((o: any) => o.type === 1 || o.type === 2) ?? [];
      const normalOptions = json.options?.filter((o: any) => o.type !== 1 && o.type !== 2) ?? [];

      const optionsList = normalOptions.length > 0
        ? normalOptions.map((o: any) => `• \`${o.name}\`${o.required ? " *(required)*" : ""}: ${o.description}`).join("\n")
        : (subcommands.length > 0 ? "*See subcommands below*" : "None");

      const subcommandsList = subcommands.length > 0
        ? subcommands.map((s: any) => `• \`/${cleanName} ${s.name}\`: ${s.description}`).join("\n")
        : "None";

      const categoryIcon = CATEGORY_ICONS[foundCmd.category ?? "general"] ?? "🌐";

      const detailEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${categoryIcon} Command: /${json.name}`)
        .setDescription(json.description || "No description available.")
        .addFields(
          { name: "📁 Category", value: foundCmd.category ? foundCmd.category.toUpperCase() : "GENERAL", inline: true },
          { name: "👤 Required User Permissions", value: userPerms, inline: true },
          { name: "🤖 Required Bot Permissions", value: botPerms, inline: true },
          { name: "⚙️ Options", value: optionsList, inline: false },
          { name: "🔀 Subcommands", value: subcommandsList, inline: false },
          { name: "💡 Usage Example", value: `\`/${cleanName}${subcommands.length > 0 ? ` ${subcommands[0].name}` : ""}\``, inline: false }
        )
        .setFooter({ text: "Aegis Bot • Command Manual" })
        .setTimestamp();

      await interaction.reply({ embeds: [detailEmbed], ephemeral: true });
      return;
    }

    // ─── INTERACTIVE CATEGORY HUB ─────────────────────────────────────────────
    const generateCategoryEmbed = (category: string | null) => {
      if (!category || category === "all") {
        return new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("🛡️ Aegis — Command Hub")
          .setDescription(
            `Select a category from the dropdown below to view specific commands.\n\n` +
            `💡 *Tip: Type \`/help command:name\` (e.g. \`/help command:warn\`) for detailed options & permission rules.*`
          )
          .addFields({ name: "📊 Total Commands", value: `**${allCmds.length}** commands registered across ${COMMAND_CATEGORIES.length} categories`, inline: false })
          .setFooter({ text: "Aegis Bot • Interactive Menu" })
          .setTimestamp();
      }

      const label = CATEGORIES[category] ?? category;
      const cmds = allCmds.filter((c) => c.category === category);

      return new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${label} Commands (${cmds.length})`)
        .setDescription(
          cmds.length
            ? cmds
                .map((c) => `**/${c.data.name}** — ${c.data.description}`)
                .join("\n")
            : "No commands found in this category.",
        )
        .setFooter({ text: "Aegis Bot • Interactive Menu" })
        .setTimestamp();
    };

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("help_category_select")
      .setPlaceholder("Select a command category...")
      .addOptions(
        {
          label: "Home",
          description: "Return to the main help menu",
          value: "all",
          emoji: "🏠",
        },
        ...COMMAND_CATEGORIES.map((cat) => ({
          label: (CATEGORIES[cat] ?? cat).replace(/^\S+\s/, ""),
          description: `View ${(CATEGORIES[cat] ?? cat).replace(/^\S+\s/, "")} commands`,
          value: cat,
          emoji: CATEGORY_ICONS[cat] ?? "•",
        })),
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu,
    );

    const sent = await interaction.reply({
      embeds: [generateCategoryEmbed("all")],
      components: [row],
      ephemeral: true,
      fetchReply: true,
    });

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 300_000,
      filter: (componentInteraction) =>
        componentInteraction.user.id === interaction.user.id &&
        componentInteraction.customId === "help_category_select",
    });

    collector.on("collect", async (componentInteraction) => {
      const selected = componentInteraction.values[0];
      await componentInteraction.update({
        embeds: [generateCategoryEmbed(selected)],
        components: [row],
      });
    });

    collector.on("end", async () => {
      await interaction
        .editReply({ components: [] })
        .catch(() => undefined);
    });
  },
};

export default command;
