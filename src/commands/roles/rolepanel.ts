import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { Command } from "../../types/discord";
import { createRolePanel, getRolePanels, deleteRolePanel } from "../../services/rolePanelService";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("rolepanel")
    .setDescription("Interactive button-based reaction role panels.")
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName("create")
        .setDescription("Open a form to create a new role panel.")
        .addChannelOption(opt => opt.setName("channel").setDescription("Target channel").addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addRoleOption(opt => opt.setName("role1").setDescription("First role").setRequired(true))
        .addRoleOption(opt => opt.setName("role2").setDescription("Second role (optional)").setRequired(false))
        .addRoleOption(opt => opt.setName("role3").setDescription("Third role (optional)").setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription("List active role panels in this server.")
    )
    .addSubcommand(sub =>
      sub
        .setName("delete")
        .setDescription("Delete a role panel record.")
        .addStringOption(opt => opt.setName("id").setDescription("Panel ID (from /rolepanel list)").setRequired(true))
    ),

  category: "roles",
  guildOnly: true,

  async execute(interaction) {
    if (!interaction.guild) return;
    const subcommand = interaction.options.getSubcommand();

    // ── CREATE via modal ─────────────────────────────────────────────────────────
    if (subcommand === "create") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
        await interaction.reply({ content: "❌ You need `Manage Roles` permission to create role panels.", ephemeral: true });
        return;
      }

      const channel = interaction.options.getChannel("channel", true) as TextChannel;
      const role1 = interaction.options.getRole("role1", true);
      const role2 = interaction.options.getRole("role2");
      const role3 = interaction.options.getRole("role3");

      const modal = new ModalBuilder()
        .setCustomId("rolepanel_create_modal")
        .setTitle("Role Panel Details");

      const titleInput = new TextInputBuilder()
        .setCustomId("panel_title")
        .setLabel("Panel Title")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(true)
        .setPlaceholder("e.g. Choose Your Roles");

      const descInput = new TextInputBuilder()
        .setCustomId("panel_desc")
        .setLabel("Panel Description / Instructions")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(2000)
        .setRequired(true)
        .setPlaceholder("e.g. Click the buttons below to receive the corresponding roles.");

      // Optional button labels
      const label1Input = new TextInputBuilder()
        .setCustomId("label1")
        .setLabel(`Label for ${role1.name}`)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(80)
        .setRequired(false)
        .setPlaceholder(role1.name);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(label1Input),
      );

      // Add inputs for roles 2 and 3 if provided
      if (role2) {
        const label2Input = new TextInputBuilder()
          .setCustomId("label2")
          .setLabel(`Label for ${role2.name}`)
          .setStyle(TextInputStyle.Short)
          .setMaxLength(80)
          .setRequired(false)
          .setPlaceholder(role2.name);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(label2Input));
      }

      if (role3) {
        const label3Input = new TextInputBuilder()
          .setCustomId("label3")
          .setLabel(`Label for ${role3.name}`)
          .setStyle(TextInputStyle.Short)
          .setMaxLength(80)
          .setRequired(false)
          .setPlaceholder(role3.name);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(label3Input));
      }

      await interaction.showModal(modal);

      const modalResponse = await interaction.awaitModalSubmit({
        time: 300_000,
        filter: (m) => m.user.id === interaction.user.id && m.customId === "rolepanel_create_modal",
      }).catch(() => null);

      if (!modalResponse) return;
      await modalResponse.deferReply({ ephemeral: true });

      const title = modalResponse.fields.getTextInputValue("panel_title");
      const description = modalResponse.fields.getTextInputValue("panel_desc");
      
      const rolesInput = [];
      const label1 = modalResponse.fields.getTextInputValue("label1") || role1.name;
      rolesInput.push({ roleId: role1.id, label: label1 });

      if (role2) {
        const label2 = modalResponse.fields.getTextInputValue("label2") || role2.name;
        rolesInput.push({ roleId: role2.id, label: label2 });
      }

      if (role3) {
        const label3 = modalResponse.fields.getTextInputValue("label3") || role3.name;
        rolesInput.push({ roleId: role3.id, label: label3 });
      }

      const panel = await createRolePanel(interaction.guild, channel, title, description, rolesInput);

      if (panel) {
        await modalResponse.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x9B59B6)
              .setTitle("✅ Role Panel Created")
              .setDescription(`Your role panel has been successfully posted in <#${channel.id}>.`)
              .addFields(
                { name: "🆔 Panel ID", value: `\`${panel.id}\``, inline: true },
                { name: "🔘 Roles", value: `${rolesInput.length}`, inline: true },
              )
              .setTimestamp()
          ]
        });
      } else {
        await modalResponse.editReply("❌ Failed to create role panel. Check my permissions in the target channel.");
      }
      return;
    }

    // ── LIST panels ──────────────────────────────────────────────────────────────
    if (subcommand === "list") {
      const panels = await getRolePanels(interaction.guild.id);
      
      if (panels.length === 0) {
        const emptyEmbed = new EmbedBuilder()
          .setColor(0x9B59B6)
          .setTitle("🎭 Active Role Panels")
          .setDescription("ℹ️ No role panels configured on this server.")
          .setFooter({ text: "Create one using /rolepanel create" });
        await interaction.reply({ embeds: [emptyEmbed], ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("🎭 Active Role Panels")
        .setColor(0x9B59B6)
        .setDescription(
          panels
            .map(p => `**ID:** \`${p.id}\`\n> **Title:** ${p.title}\n> **Location:** <#${p.channelId}>\n> **Roles:** ${p.roles.map(r => `<@&${r.roleId}>`).join(", ")}`)
            .join("\n\n")
        )
        .setFooter({ text: `Total Panels: ${panels.length}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // ── DELETE panel ─────────────────────────────────────────────────────────────
    if (subcommand === "delete") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
        await interaction.reply({ content: "❌ You need `Manage Roles` permission to delete role panels.", ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      const id = interaction.options.getString("id", true);
      const ok = await deleteRolePanel(interaction.guild.id, id);
      
      if (ok) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle("🗑️ Role Panel Deleted")
              .setDescription(`Panel ID \`${id}\` has been removed from the database.\n\n*(Note: You may need to manually delete the Discord message if it still exists)*`)
              .setTimestamp()
          ]
        });
      } else {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle("❌ Panel Not Found")
              .setDescription(`Could not find a panel with ID \`${id}\`. Use \`/rolepanel list\` to see active panels.`)
          ]
        });
      }
      return;
    }
  },
};

export default command;
