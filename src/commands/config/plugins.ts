import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} from "discord.js";
import { Command } from "../../types/discord";
import { knubManager } from "../../knub";
import { sendGuildLog } from "../../services/logging";
import { logger } from "../../utils/logger";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("plugins")
    .setDescription("View and configure modular Knub plugins for this server.")
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List all registered Knub plugins and their status in this server."),
    )
    .addSubcommand((sub) =>
      sub
        .setName("toggle")
        .setDescription("Enable or disable a specific plugin for this server.")
        .addStringOption((opt) =>
          opt
            .setName("plugin")
            .setDescription("The plugin to toggle")
            .setRequired(true)
            .addChoices(
              { name: "Moderation (disciplinary tools & cases)", value: "moderation" },
              { name: "Community (giveaways, suggestions, polls)", value: "community" },
              { name: "Tickets (support channels & transcripts)", value: "tickets" },
              { name: "Roles (self-assignable role panels)", value: "roles" },
              { name: "Verification (entry verification gates)", value: "verification" },
              { name: "Automod (content filters & spam rules)", value: "automod" },
              { name: "Autoresponder (custom triggers & replies)", value: "autoresponder" },
            ),
        )
        .addBooleanOption((opt) =>
          opt
            .setName("enabled")
            .setDescription("Enable (True) or Disable (False) this plugin")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("info")
        .setDescription("View detailed architecture and features of a Knub plugin.")
        .addStringOption((opt) =>
          opt
            .setName("plugin")
            .setDescription("The plugin to inspect")
            .setRequired(true)
            .addChoices(
              { name: "Moderation", value: "moderation" },
              { name: "Community", value: "community" },
              { name: "Tickets", value: "tickets" },
              { name: "Roles", value: "roles" },
              { name: "Verification", value: "verification" },
              { name: "Automod", value: "automod" },
              { name: "General / Utility", value: "general" },
              { name: "Configuration", value: "config" },
              { name: "Autoresponder", value: "autoresponder" },
            ),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageGuild],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    await interaction.deferReply({ ephemeral: true });

    // ── /plugins list ──────────────────────────────────────────────────────
    if (sub === "list") {
      const allPlugins = knubManager.getAllPlugins();
      const statusList = await Promise.all(
        allPlugins.map(async (p) => {
          const isEnabled = await knubManager.isPluginEnabledForGuild(guildId, p.name);
          return { plugin: p, isEnabled };
        }),
      );

      const buildEmbed = () => {
        const fields = statusList.map(({ plugin, isEnabled }) => ({
          name: `${isEnabled ? "🟢" : "🔴"} ${plugin.name.toUpperCase()} (v${plugin.version})`,
          value: `${plugin.description}\n**Status:** ${isEnabled ? "✅ Enabled" : "❌ Disabled"}`,
          inline: false,
        }));

        return new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`🧩 Knub Modular Plugins — ${interaction.guild!.name}`)
          .setDescription(
            "Plugins organize server features into isolated, configurable modules. " +
              "Select a plugin below to toggle its state for this server.",
          )
          .addFields(fields)
          .setFooter({ text: "Use /plugins toggle to change states directly." })
          .setTimestamp();
      };

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("plugins_toggle_select")
        .setPlaceholder("Select a plugin to toggle on/off...")
        .addOptions(
          statusList
            .filter(({ plugin }) => plugin.name !== "config" && plugin.name !== "general")
            .map(({ plugin, isEnabled }) => ({
              label: `${plugin.name.toUpperCase()}`,
              description: `Currently ${isEnabled ? "Enabled" : "Disabled"}: ${plugin.description.slice(0, 50)}...`,
              value: plugin.name,
              emoji: isEnabled ? "🟢" : "🔴",
            })),
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
      const sent = await interaction.editReply({
        embeds: [buildEmbed()],
        components: [row],
      });

      const collector = sent.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 90_000,
        filter: (i) => i.user.id === interaction.user.id,
      });

      collector.on("collect", async (i) => {
        const chosen = i.values[0];
        const target = statusList.find((s) => s.plugin.name === chosen);
        if (!target) return;

        const nextState = !target.isEnabled;
        await knubManager.setPluginEnabledForGuild(guildId, chosen, nextState);
        target.isEnabled = nextState;

        await i.deferUpdate().catch(() => null);

        // Rebuild menu
        const updatedMenu = new StringSelectMenuBuilder()
          .setCustomId("plugins_toggle_select")
          .setPlaceholder("Select a plugin to toggle on/off...")
          .addOptions(
            statusList
              .filter(({ plugin }) => plugin.name !== "config" && plugin.name !== "general")
              .map(({ plugin, isEnabled }) => ({
                label: `${plugin.name.toUpperCase()}`,
                description: `Currently ${isEnabled ? "Enabled" : "Disabled"}: ${plugin.description.slice(0, 50)}...`,
                value: plugin.name,
                emoji: isEnabled ? "🟢" : "🔴",
              })),
          );

        await interaction.editReply({
          embeds: [buildEmbed()],
          components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(updatedMenu)],
        }).catch(() => null);

        await sendGuildLog(interaction.client, guildId, {
          title: "🧩 Plugin State Changed",
          color: nextState ? 0x57f287 : 0xed4245,
          description: `**Plugin:** ${chosen}\n**New State:** ${nextState ? "Enabled" : "Disabled"}\n**Changed By:** ${interaction.user.tag}`,
        });
      });

      collector.on("end", async () => {
        await interaction.editReply({ components: [] }).catch(() => null);
      });

      return;
    }

    // ── /plugins toggle ────────────────────────────────────────────────────
    if (sub === "toggle") {
      const pluginName = interaction.options.getString("plugin", true);
      const enabled = interaction.options.getBoolean("enabled", true);

      if (pluginName === "config" || pluginName === "general") {
        await interaction.editReply({
          content: "❌ Core system plugins (config, general) cannot be disabled.",
        });
        return;
      }

      await knubManager.setPluginEnabledForGuild(guildId, pluginName, enabled);

      await sendGuildLog(interaction.client, guildId, {
        title: "🧩 Plugin State Updated",
        color: enabled ? 0x57f287 : 0xed4245,
        description: `**Plugin:** ${pluginName}\n**Status:** ${enabled ? "Enabled" : "Disabled"}\n**Updated By:** ${interaction.user.tag}`,
      });

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(enabled ? 0x57f287 : 0xed4245)
            .setTitle(`🧩 Plugin ${enabled ? "Enabled" : "Disabled"}`)
            .setDescription(
              `The **${pluginName}** plugin has been **${enabled ? "enabled" : "disabled"}** for this server.`,
            )
            .setTimestamp(),
        ],
      });
      return;
    }

    // ── /plugins info ──────────────────────────────────────────────────────
    if (sub === "info") {
      const pluginName = interaction.options.getString("plugin", true);
      const plugin = knubManager.getPlugin(pluginName);

      if (!plugin) {
        await interaction.editReply({ content: `❌ Plugin \`${pluginName}\` not found.` });
        return;
      }

      const isEnabled = await knubManager.isPluginEnabledForGuild(guildId, plugin.name);
      const customHandlersCount = plugin.customIdHandlers?.length ?? 0;
      const eventsCount = plugin.events?.length ?? 0;

      const infoEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`🧩 Plugin: ${plugin.name.toUpperCase()} (v${plugin.version})`)
        .setDescription(plugin.description)
        .addFields(
          { name: "📊 Server Status", value: isEnabled ? "🟢 Enabled" : "🔴 Disabled", inline: true },
          { name: "🎛️ Component Handlers", value: `${customHandlersCount} active`, inline: true },
          { name: "📡 Event Hooks", value: `${eventsCount} registered`, inline: true },
          {
            name: "⚙️ Default Config",
            value: `\`\`\`json\n${JSON.stringify(plugin.defaultConfig, null, 2)}\n\`\`\``,
            inline: false,
          },
        )
        .setFooter({ text: "Aegis Modular Knub Architecture" })
        .setTimestamp();

      await interaction.editReply({ embeds: [infoEmbed] });
      return;
    }
  },
};

export default command;
