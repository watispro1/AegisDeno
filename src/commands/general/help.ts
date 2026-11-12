import { guardCollect } from "../../utils/collectorGuard";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
  PermissionFlagsBits,
  MessageFlags,
  PermissionsBitField,
  type AutocompleteInteraction,
  InteractionContextType,
} from "discord.js";
import { Command } from "../../types/discord";
import { footer } from "../../utils/embedStyle";
import { commands, COMMAND_CATEGORIES } from "../loader";
import { canUseCommand, searchCommands } from "../../services/commandAccess";
import { commandUrl, docsUrl, inviteUrl, siteUrl, supportServerUrl } from "../../config/links";
import { contextMenus } from "../contextMenus";
import {
  APPS_PAGE, CATEGORIES, CATEGORY_ICONS, accessLabel, appsSectionText, categoryDocsUrl, formatCooldown, formatPermissions, subcommandNames, truncate,
} from "../../services/helpFormat";

type Invoker = Pick<ChatInputCommandInteraction | AutocompleteInteraction, "inGuild" | "memberPermissions">;

/** Commands the invoking member is allowed to run where /help was used. */
function visibleCommands(interaction: Invoker): Command[] {
  const inGuild = interaction.inGuild();
  const memberPermissions = interaction.memberPermissions?.bitfield ?? null;
  return Array.from(commands.values()).filter(cmd => {
    const json = cmd.data.toJSON() as { default_member_permissions?: string | null; dm_permission?: boolean | null };
    let userPermissions: bigint | undefined;
    try {
      userPermissions = cmd.userPermissions?.length ? PermissionsBitField.resolve(cmd.userPermissions) : undefined;
    } catch {
      userPermissions = undefined;
    }
    return canUseCommand(
      {
        guildOnly: cmd.guildOnly,
        userPermissions,
        defaultMemberPermissions: json.default_member_permissions ?? null,
        dmPermission: json.dm_permission ?? null,
      },
      { inGuild, memberPermissions },
    );
  });
}

/** Where a first-time user should go next, naming only commands they can run here. */
export function newHereLine(inGuild: boolean, visibleNames: ReadonlySet<string>): string {
  if (!inGuild) return "Add me to a server with **Add Aegis**, then run `/help` there. In a server, `/dashboard` shows an overview.";
  const starters = ["setup", "dashboard", "diagnostics"].filter(n => visibleNames.has(n)).map(n => `\`/${n}\``);
  const lead = starters.length ? `Try ${starters.join(" or ")}` : "Ask a server admin to set me up";
  return `${lead}, or open the web dashboard with the button below. @mention me any time for a quick start.`;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Browse the commands you can use, or search for one.")
    .addStringOption(opt =>
      opt.setName("command").setDescription("Search commands by name, description or subcommand (e.g. warn, transcript)").setAutocomplete(true).setRequired(false)
    )
    // Usable in servers and in DMs with Aegis, by anyone (no default member permissions).
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),

  botPermissions: [PermissionFlagsBits.EmbedLinks],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const targetCommandName = interaction.options.getString("command")?.toLowerCase().trim();
    // Only commands this member can actually use here.
    const allCmds = visibleCommands(interaction);
    const visibleNames = new Set(allCmds.map(c => c.data.name));
    const categories = COMMAND_CATEGORIES.filter(cat => allCmds.some(c => c.category === cat));

    // Specific command lookup
    if (targetCommandName) {
      const cleanName = targetCommandName.replace(/^\//, "");
      let foundCmd = visibleNames.has(cleanName) ? commands.get(cleanName) : undefined;
      if (!foundCmd) {
        // Free text that was not picked from autocomplete: use the best search match.
        const best = searchCommands(
          allCmds.map(c => ({ name: c.data.name, description: c.data.description, category: c.category ?? "general", subcommands: subcommandNames(c) })),
          cleanName,
          1,
        )[0];
        foundCmd = best ? commands.get(best.name) : undefined;
      }

      if (!foundCmd) {
        await interaction.reply({
          content: `❌ No command you can use matches \`${cleanName}\`. Use \`/help\` to browse the commands available to you.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const json = foundCmd.data.toJSON();
      const userPerms = formatPermissions(foundCmd.userPermissions);
      const botPerms = (foundCmd.botPermissions?.length ? formatPermissions(foundCmd.botPermissions) : "Send Messages") +
        (foundCmd.featurePermissions?.length ? `\nSome parts also use: ${formatPermissions(foundCmd.featurePermissions)}` : "");

      const shownName = json.name;
      const subcommands = json.options?.filter((o) => o.type === 1 || o.type === 2) ?? [];
      const normalOptions = json.options?.filter((o) => o.type !== 1 && o.type !== 2) ?? [];

      const optionsList = normalOptions.length > 0
        ? truncate(normalOptions.map((o) => `• \`${o.name}\`${o.required ? " *(required)*" : ""}: ${o.description}`).join("\n"))
        : (subcommands.length > 0 ? "*See subcommands below*" : "None");

      const subcommandsList = subcommands.length > 0
        ? truncate(subcommands.map((s) => `• \`/${shownName} ${s.name}\`: ${s.description}`).join("\n"))
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
          { name: "⏱️ Cooldown", value: formatCooldown(foundCmd.cooldownMs), inline: true },
          { name: "⚙️ Options", value: optionsList, inline: false },
          { name: "🔀 Subcommands", value: subcommandsList, inline: false },
          { name: "💡 Usage Example", value: `\`/${shownName}${subcommands.length > 0 ? ` ${subcommands[0].name}` : ""}\``, inline: false }
        )
        .setFooter(footer("Command manual · /help command:<name>"))
        .setTimestamp();

      const cmdButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("View on Web")
          .setStyle(ButtonStyle.Link)
          .setURL(commandUrl(shownName))
          .setEmoji("🌐"),
        new ButtonBuilder()
          .setLabel("Category docs")
          .setStyle(ButtonStyle.Link)
          .setURL(categoryDocsUrl(foundCmd.category))
          .setEmoji("📖"),
        new ButtonBuilder()
          .setLabel("Add Aegis")
          .setStyle(ButtonStyle.Link)
          .setURL(inviteUrl())
          .setEmoji("➕"),
        new ButtonBuilder()
          .setLabel("Support Server")
          .setStyle(ButtonStyle.Link)
          .setURL(supportServerUrl())
          .setEmoji("💬")
      );

      await interaction.reply({ embeds: [detailEmbed], components: [cmdButtons], flags: MessageFlags.Ephemeral });
      return;
    }

    // Interactive category hub
    const generateCategoryEmbed = (category: string | null) => {
      if (!category || category === "all") {
        return new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("🛡️ Aegis — Command Hub")
          .setDescription(
            `Select a category from the dropdown below to view specific commands.\n\n` +
            `💡 *Tip: Type \`/help command:name\` (e.g. \`/help command:warn\`) for detailed options & permission rules.*`
          )
          .addFields(
            { name: "📊 Your Commands", value: `**${allCmds.length}** of ${commands.size} commands are available to you, across ${categories.length} categories`, inline: false },
            { name: "⚡ Quick Start", value: "• `/help` — Browse available commands & permission requirements\n• `/diagnostics` — Audit server configuration and bot permissions\n• `/warn` — Issue warnings with automatic auto-escalation\n• `/logging channel` — Configure audit logging\n• `/dashboard` — Manage your server from the web", inline: false },
            { name: "🖱️ Apps (right-click)", value: appsSectionText(contextMenus.values(), interaction.inGuild()), inline: false },
            { name: "🚀 New here?", value: newHereLine(interaction.inGuild(), visibleNames), inline: false },
          )
          .setFooter(footer("Pick a category below · /help command:<name> for details"))
          .setTimestamp();
      }

      if (category === APPS_PAGE) {
        return new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`🖱️ Apps — right-click commands (${contextMenus.size})`)
          .setDescription(appsSectionText(contextMenus.values(), interaction.inGuild()) +
            "\n\nOn desktop, right-click a member or message and open **Apps**. On mobile, long-press it, then tap **Apps**.")
          .setFooter(footer("Pick a category below · /help command:<name> for details"))
          .setTimestamp();
      }

      const label = CATEGORIES[category] ?? category;
      const cmds = allCmds.filter((c) => c.category === category);

      return new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${label} Commands (${cmds.length})`)
        .setDescription(
          cmds.length
            ? truncate(cmds
                .map((c) => {
                  const access = accessLabel(c);
                  return `**/${c.data.name}** — ${c.data.description}${access ? `\n> 🔒 ${access}` : ""}`;
                })
                .join("\n"), 4_000)
            : "No commands you can use in this category.",
        )
        .setFooter(footer("Pick a category below · /help command:<name> for details"))
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
        ...categories.map((cat) => ({
          label: (CATEGORIES[cat] ?? cat).replace(/^\S+\s/, ""),
          description: `View ${(CATEGORIES[cat] ?? cat).replace(/^\S+\s/, "")} commands`,
          value: cat,
          emoji: CATEGORY_ICONS[cat] ?? "•",
        })),
        { label: "Apps", description: "Right-click commands on members and messages", value: APPS_PAGE, emoji: "🖱️" },
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu,
    );

    const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Web Catalog")
        .setStyle(ButtonStyle.Link)
        .setURL(siteUrl("/commands"))
        .setEmoji("📋"),
      new ButtonBuilder()
        .setLabel("Documentation")
        .setStyle(ButtonStyle.Link)
        .setURL(docsUrl())
        .setEmoji("📖"),
      new ButtonBuilder()
        .setLabel("Status")
        .setStyle(ButtonStyle.Link)
        .setURL(siteUrl("/status"))
        .setEmoji("📊"),
      new ButtonBuilder()
        .setLabel("Add Aegis")
        .setStyle(ButtonStyle.Link)
        .setURL(inviteUrl())
        .setEmoji("➕"),
      new ButtonBuilder()
        .setLabel("Support")
        .setStyle(ButtonStyle.Link)
        .setURL(supportServerUrl())
        .setEmoji("💬"),
    );

    const sent = await interaction.reply({
      embeds: [generateCategoryEmbed("all")],
      components: [row, linkRow],
      flags: MessageFlags.Ephemeral,
      fetchReply: true,
    });

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 300_000,
      filter: (componentInteraction) =>
        componentInteraction.user.id === interaction.user.id &&
        componentInteraction.customId === "help_category_select",
    });

    collector.on("collect", (componentInteraction) => guardCollect("help", componentInteraction, async () => {
      const selected = componentInteraction.values[0];
      await componentInteraction.update({
        embeds: [generateCategoryEmbed(selected)],
        components: [row, linkRow],
      });
    }));

    collector.on("end", async () => {
      await interaction
        .editReply({ components: [linkRow] })
        .catch(() => undefined);
    });
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const ranked = searchCommands(
      visibleCommands(interaction).map(command => ({
        name: command.data.name,
        description: command.data.description,
        category: command.category ?? "general",
        subcommands: subcommandNames(command),
      })),
      focused,
      25,
    );

    await interaction.respond(ranked.map(command => ({
      name: `/${command.name} — ${command.description}`.slice(0, 100),
      value: command.name,
    })));
  },
};

export default command;
