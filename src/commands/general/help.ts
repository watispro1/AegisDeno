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
  type PermissionResolvable,
  MessageFlags,
  PermissionsBitField,
  type AutocompleteInteraction,
} from "discord.js";
import { Command } from "../../types/discord";
import { commands, COMMAND_CATEGORIES } from "../loader";
import { canUseCommand, searchCommands } from "../../services/commandAccess";

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

function subcommandNames(cmd: Command): string[] {
  const json = cmd.data.toJSON() as { options?: Array<{ type: number; name: string; options?: Array<{ type: number; name: string }> }> };
  const out: string[] = [];
  for (const o of json.options ?? []) {
    if (o.type === 1) out.push(o.name);
    if (o.type === 2) for (const sub of o.options ?? []) out.push(`${o.name} ${sub.name}`);
  }
  return out;
}

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

const PERMISSION_LABELS: Partial<Record<string, string>> = {
  [String(PermissionFlagsBits.Administrator)]: "Administrator",
  [String(PermissionFlagsBits.BanMembers)]: "Ban Members",
  [String(PermissionFlagsBits.KickMembers)]: "Kick Members",
  [String(PermissionFlagsBits.ManageChannels)]: "Manage Channels",
  [String(PermissionFlagsBits.ManageGuild)]: "Manage Server",
  [String(PermissionFlagsBits.ManageMessages)]: "Manage Messages",
  [String(PermissionFlagsBits.ManageRoles)]: "Manage Roles",
  [String(PermissionFlagsBits.ModerateMembers)]: "Moderate Members",
  [String(PermissionFlagsBits.SendMessages)]: "Send Messages",
  [String(PermissionFlagsBits.EmbedLinks)]: "Embed Links",
};

function formatPermissions(permissions?: PermissionResolvable[]): string {
  if (!permissions?.length) return "Everyone";
  return permissions.map(permission => PERMISSION_LABELS[String(permission)] ?? "Required permission").join(", ");
}

function truncate(value: string, limit = 1_000): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Browse the commands you can use, or search for one.")
    .addStringOption(opt =>
      opt.setName("command").setDescription("Search commands by name, description or subcommand (e.g. warn, transcript)").setAutocomplete(true).setRequired(false)
    ),

  botPermissions: [PermissionFlagsBits.EmbedLinks],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const targetCommandName = interaction.options.getString("command")?.toLowerCase().trim();
    // Only commands this member can actually use here.
    const allCmds = visibleCommands(interaction);
    const visibleNames = new Set(allCmds.map(c => c.data.name));
    const categories = COMMAND_CATEGORIES.filter(cat => allCmds.some(c => c.category === cat));

    // ─── SPECIFIC COMMAND LOOKUP ──────────────────────────────────────────────
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
      const botPerms = foundCmd.botPermissions?.length ? formatPermissions(foundCmd.botPermissions) : "Send Messages";

      const shownName = json.name;
      const subcommands = json.options?.filter((o: any) => o.type === 1 || o.type === 2) ?? [];
      const normalOptions = json.options?.filter((o: any) => o.type !== 1 && o.type !== 2) ?? [];

      const optionsList = normalOptions.length > 0
        ? truncate(normalOptions.map((o: any) => `• \`${o.name}\`${o.required ? " *(required)*" : ""}: ${o.description}`).join("\n"))
        : (subcommands.length > 0 ? "*See subcommands below*" : "None");

      const subcommandsList = subcommands.length > 0
        ? truncate(subcommands.map((s: any) => `• \`/${shownName} ${s.name}\`: ${s.description}`).join("\n"))
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
          { name: "💡 Usage Example", value: `\`/${shownName}${subcommands.length > 0 ? ` ${subcommands[0].name}` : ""}\``, inline: false }
        )
        .setFooter({ text: "Aegis Bot • Command Manual" })
        .setTimestamp();

      const cmdButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("View on Web")
          .setStyle(ButtonStyle.Link)
          .setURL(`https://aegisdeno.fly.dev/commands#cmd-${shownName}`)
          .setEmoji("🌐"),
        new ButtonBuilder()
          .setLabel("Documentation")
          .setStyle(ButtonStyle.Link)
          .setURL("https://aegisdeno.fly.dev/docs")
          .setEmoji("📖"),
        new ButtonBuilder()
          .setLabel("Support Server")
          .setStyle(ButtonStyle.Link)
          .setURL("https://discord.gg/DkZUgm3q4F")
          .setEmoji("💬")
      );

      await interaction.reply({ embeds: [detailEmbed], components: [cmdButtons], flags: MessageFlags.Ephemeral });
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
          .addFields({ name: "📊 Your Commands", value: `**${allCmds.length}** of ${commands.size} commands are available to you, across ${categories.length} categories`, inline: false })
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
        ...categories.map((cat) => ({
          label: (CATEGORIES[cat] ?? cat).replace(/^\S+\s/, ""),
          description: `View ${(CATEGORIES[cat] ?? cat).replace(/^\S+\s/, "")} commands`,
          value: cat,
          emoji: CATEGORY_ICONS[cat] ?? "•",
        })),
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu,
    );

    const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Web Catalog")
        .setStyle(ButtonStyle.Link)
        .setURL("https://aegisdeno.fly.dev/commands")
        .setEmoji("📋"),
      new ButtonBuilder()
        .setLabel("Documentation")
        .setStyle(ButtonStyle.Link)
        .setURL("https://aegisdeno.fly.dev/docs")
        .setEmoji("📖"),
      new ButtonBuilder()
        .setLabel("Status")
        .setStyle(ButtonStyle.Link)
        .setURL("https://aegisdeno.fly.dev/status")
        .setEmoji("📊"),
      new ButtonBuilder()
        .setLabel("Support")
        .setStyle(ButtonStyle.Link)
        .setURL("https://discord.gg/DkZUgm3q4F")
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

    collector.on("collect", async (componentInteraction) => {
      const selected = componentInteraction.values[0];
      await componentInteraction.update({
        embeds: [generateCategoryEmbed(selected)],
        components: [row, linkRow],
      });
    });

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
