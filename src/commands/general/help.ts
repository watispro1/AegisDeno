import { guardCollect } from "../../utils/collectorGuard";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
  MessageFlags,
  PermissionsBitField,
  type AutocompleteInteraction,
  type Message,
  type MessageComponentInteraction,
  InteractionContextType,
} from "discord.js";
import { Command } from "../../types/discord";
import { COLORS, footer } from "../../utils/embedStyle";
import { commands, COMMAND_CATEGORIES } from "../loader";
import { canUseCommand, searchCommands } from "../../services/commandAccess";
import { commandUrl, docsUrl, inviteUrl, siteUrl, supportServerUrl } from "../../config/links";
import { contextMenus } from "../contextMenus";
import {
  APPS_PAGE, CATEGORIES, CATEGORY_ICONS, accessLabel, appsSectionText, categoryDocsUrl, formatCooldown, formatPermissions, subcommandNames, truncate,
} from "../../services/helpFormat";
import { HELP_NAV_IDS, helpCategoryPages, helpNavRow, helpPageOrder, neighbourLabels, stepHelpPage, usageExample } from "../shared/helpNav";

type Invoker = Pick<ChatInputCommandInteraction | AutocompleteInteraction, "inGuild" | "memberPermissions">;

/** How long the hub's menu and buttons keep working after the last press. */
export const HELP_HUB_IDLE_MS = 300_000;
const SELECT_ID = "help_category_select";

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

/** "🛠️ General" → "General"; the Apps page and Home have their own names. */
function pageName(page: string): string {
  if (page === "all") return "Home";
  if (page === APPS_PAGE) return "Apps";
  return (CATEGORIES[page] ?? page).replace(/^\S+\s/, "");
}

function linkRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setLabel("Web Catalog").setStyle(ButtonStyle.Link).setURL(siteUrl("/commands")).setEmoji("📋"),
    new ButtonBuilder().setLabel("Documentation").setStyle(ButtonStyle.Link).setURL(docsUrl()).setEmoji("📖"),
    new ButtonBuilder().setLabel("Status").setStyle(ButtonStyle.Link).setURL(siteUrl("/status")).setEmoji("📊"),
    new ButtonBuilder().setLabel("Add Aegis").setStyle(ButtonStyle.Link).setURL(inviteUrl()).setEmoji("➕"),
    new ButtonBuilder().setLabel("Support").setStyle(ButtonStyle.Link).setURL(supportServerUrl()).setEmoji("💬"),
  );
}

/** The category hub: Home, one page per category (split when long), and Apps. */
function createHub(interaction: ChatInputCommandInteraction, allCmds: Command[]) {
  const visibleNames = new Set(allCmds.map(c => c.data.name));
  const categories = COMMAND_CATEGORIES.filter(cat => allCmds.some(c => c.category === cat));
  const order = helpPageOrder(categories, APPS_PAGE);
  const tip = "Pick a category below, or step through them with ◀ ▶ · /help command:<name> for details";

  const pagesFor = (category: string): string[] => helpCategoryPages(allCmds
    .filter(c => c.category === category)
    .map(c => {
      const access = accessLabel(c);
      return `**/${c.data.name}** — ${c.data.description}${access ? `\n> 🔒 ${access}` : ""}`;
    }));

  const embedFor = (category: string, page: number): { embed: EmbedBuilder; pages: number } => {
    if (!category || category === "all") {
      return { pages: 1, embed: new EmbedBuilder()
        .setColor(COLORS.brand)
        .setTitle("🛡️ Aegis — Command Hub")
        .setDescription(
          `Select a category from the dropdown below, or use ◀ ▶ to step through them.\n\n` +
          `💡 *Tip: Type \`/help command:name\` (e.g. \`/help command:warn\`) for detailed options & permission rules.*`,
        )
        .addFields(
          { name: "📊 Your Commands", value: `**${allCmds.length}** of ${commands.size} commands are available to you, across ${categories.length} categories`, inline: false },
          { name: "⚡ Quick Start", value: "• `/help` — Browse available commands & permission requirements\n• `/diagnostics` — Audit server configuration and bot permissions\n• `/warn` — Issue warnings with automatic auto-escalation\n• `/logging channel` — Configure audit logging\n• `/dashboard` — Manage your server from the web", inline: false },
          { name: "🖱️ Apps (right-click)", value: appsSectionText(contextMenus.values(), interaction.inGuild()), inline: false },
          { name: "🚀 New here?", value: newHereLine(interaction.inGuild(), visibleNames), inline: false },
        )
        .setFooter(footer(tip))
        .setTimestamp() };
    }
    if (category === APPS_PAGE) {
      return { pages: 1, embed: new EmbedBuilder()
        .setColor(COLORS.brand)
        .setTitle(`🖱️ Apps — right-click commands (${contextMenus.size})`)
        .setDescription(appsSectionText(contextMenus.values(), interaction.inGuild()) +
          "\n\nOn desktop, right-click a member or message and open **Apps**. On mobile, long-press it, then tap **Apps**.")
        .setFooter(footer(tip))
        .setTimestamp() };
    }
    const label = CATEGORIES[category] ?? category;
    const count = allCmds.filter(c => c.category === category).length;
    const pages = pagesFor(category);
    const shown = Math.min(Math.max(0, page), pages.length - 1);
    return { pages: pages.length, embed: new EmbedBuilder()
      .setColor(COLORS.brand)
      .setTitle(`${label} Commands (${count})`)
      .setDescription(pages[shown] || "No commands you can use in this category.")
      .setFooter(footer(`${pages.length > 1 ? `Page ${shown + 1}/${pages.length} · ` : ""}${tip}`))
      .setTimestamp() };
  };

  const selectRow = (current: string) => new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(SELECT_ID)
      .setPlaceholder("Select a command category...")
      .addOptions(
        { label: "Home", description: "Return to the main help menu", value: "all", emoji: "🏠", default: current === "all" },
        ...categories.slice(0, 23).map(cat => ({
          label: pageName(cat),
          description: `View ${pageName(cat)} commands`,
          value: cat,
          emoji: CATEGORY_ICONS[cat] ?? "•",
          default: current === cat,
        })),
        { label: "Apps", description: "Right-click commands on members and messages", value: APPS_PAGE, emoji: "🖱️", default: current === APPS_PAGE },
      ),
  );

  /** Everything the hub message shows for one page. */
  const render = (view: string, page: number) => {
    const { embed, pages } = embedFor(view, page);
    const labels = neighbourLabels(order, view, pageName);
    return {
      embeds: [embed],
      components: [selectRow(view), helpNavRow({ prevLabel: labels.prev, nextLabel: labels.next, onHome: view === "all" || !order.includes(view), page, pages }), linkRow()],
    };
  };

  /** Move the hub after a menu pick or button press; returns the new state. */
  const step = (state: { view: string; page: number }, i: Pick<MessageComponentInteraction, "customId"> & { values?: string[] }) => {
    switch (i.customId) {
      case SELECT_ID: return { view: i.values?.[0] ?? "all", page: 0 };
      case HELP_NAV_IDS.prev: return { view: stepHelpPage(order, state.view, -1), page: 0 };
      case HELP_NAV_IDS.next: return { view: stepHelpPage(order, state.view, 1), page: 0 };
      case HELP_NAV_IDS.home: return { view: "all", page: 0 };
      case HELP_NAV_IDS.more: return { view: state.view, page: (state.page + 1) % Math.max(1, embedFor(state.view, 0).pages) };
      default: return state;
    }
  };

  return { render, step };
}

/** Keep the hub's menu and buttons working on `message` until it idles out. */
function runHub(interaction: ChatInputCommandInteraction, message: Pick<Message, "createMessageComponentCollector">, hub: ReturnType<typeof createHub>, start: { view: string; page: number }, browseView?: string) {
  let state = start;
  const collector = message.createMessageComponentCollector({
    idle: HELP_HUB_IDLE_MS,
    filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith("help_"),
  });
  collector.on("collect", (i: MessageComponentInteraction & { values?: string[] }) => guardCollect("help", i, async () => {
    state = i.customId === HELP_NAV_IDS.browse && browseView ? { view: browseView, page: 0 } : hub.step(state, i);
    await i.update(hub.render(state.view, state.page));
  }));
  collector.on("end", async () => {
    await interaction.editReply({ components: [linkRow()] }).catch(() => undefined);
  });
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Browse the commands you can use, or search for one.")
    .addStringOption(opt =>
      opt.setName("command").setDescription("Search commands by name, description or subcommand (e.g. warn, transcript)").setAutocomplete(true).setRequired(false).setMaxLength(100)
    )
    // Usable in servers and in DMs with Aegis, by anyone (no default member permissions).
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),

  botPermissions: [PermissionFlagsBits.EmbedLinks],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const targetCommandName = interaction.options.getString("command")?.toLowerCase().trim();
    // Only commands this member can actually use here.
    const allCmds = visibleCommands(interaction);
    const visibleNames = new Set(allCmds.map(c => c.data.name));
    const hub = createHub(interaction, allCmds);

    // Specific command lookup
    if (targetCommandName) {
      const cleanName = targetCommandName.replace(/^\//, "").split(/\s+/)[0] ?? "";
      let foundCmd = visibleNames.has(cleanName) ? commands.get(cleanName) : undefined;
      if (!foundCmd) {
        // Free text that was not picked from autocomplete: use the best search match.
        const best = searchCommands(
          allCmds.map(c => ({ name: c.data.name, description: c.data.description, category: c.category ?? "general", subcommands: subcommandNames(c) })),
          targetCommandName.replace(/^\//, ""),
          1,
        )[0];
        foundCmd = best ? commands.get(best.name) : undefined;
      }

      if (!foundCmd) {
        await interaction.reply({
          content: `❌ No command you can use matches \`${truncate(targetCommandName.replace(/`/g, ""), 60)}\`. Use \`/help\` to browse the commands available to you.`,
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

      const category = foundCmd.category ?? "general";
      const categoryIcon = CATEGORY_ICONS[category] ?? "🌐";

      const detailEmbed = new EmbedBuilder()
        .setColor(COLORS.brand)
        .setTitle(`${categoryIcon} Command: /${json.name}`)
        .setDescription(json.description || "No description available.")
        .addFields(
          { name: "📁 Category", value: category.toUpperCase(), inline: true },
          { name: "👤 Required User Permissions", value: userPerms, inline: true },
          { name: "🤖 Required Bot Permissions", value: botPerms, inline: true },
          { name: "⏱️ Cooldown", value: formatCooldown(foundCmd.cooldownMs), inline: true },
          { name: "⚙️ Options", value: optionsList, inline: false },
          { name: "🔀 Subcommands", value: subcommandsList, inline: false },
          { name: "💡 Usage Example", value: `\`${usageExample(shownName, (json.options ?? []) as Parameters<typeof usageExample>[1])}\``, inline: false },
        )
        .setFooter(footer("Command manual · /help command:<name>"))
        .setTimestamp();

      const cmdButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setLabel("View on Web").setStyle(ButtonStyle.Link).setURL(commandUrl(shownName)).setEmoji("🌐"),
        new ButtonBuilder().setLabel("Category docs").setStyle(ButtonStyle.Link).setURL(categoryDocsUrl(foundCmd.category)).setEmoji("📖"),
        new ButtonBuilder().setLabel("Add Aegis").setStyle(ButtonStyle.Link).setURL(inviteUrl()).setEmoji("➕"),
        new ButtonBuilder().setLabel("Support Server").setStyle(ButtonStyle.Link).setURL(supportServerUrl()).setEmoji("💬"),
      );
      // Jump from the manual into the hub, on this command's category.
      const browseRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(HELP_NAV_IDS.browse).setLabel(`More ${pageName(category)} commands`).setStyle(ButtonStyle.Primary).setEmoji(categoryIcon),
        new ButtonBuilder().setCustomId(HELP_NAV_IDS.home).setLabel("All categories").setStyle(ButtonStyle.Secondary).setEmoji("🏠"),
      );

      const sent = await interaction.reply({ embeds: [detailEmbed], components: [browseRow, cmdButtons], flags: MessageFlags.Ephemeral, fetchReply: true });
      if (sent && typeof sent.createMessageComponentCollector === "function") runHub(interaction, sent, hub, { view: "all", page: 0 }, category);
      return;
    }

    // Interactive category hub
    const sent = await interaction.reply({
      ...hub.render("all", 0),
      flags: MessageFlags.Ephemeral,
      fetchReply: true,
    });
    runHub(interaction, sent, hub, { view: "all", page: 0 });
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
