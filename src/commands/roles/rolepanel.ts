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
  MessageFlags,
} from "discord.js";
import { scopedModalId } from "../../utils/modal";
import { hiddenChannelMessage, isObfuscatedChannel } from "../../utils/channels";
import { memberTopRolePosition, roleAboveActor } from "../../permissions/hierarchy";
import type { Command } from "../../types/discord";
import { createRolePanel } from "../../services/rolePanelService";
import { deletePanel, listPanels, panelAutocomplete } from "./rolepanel/manage";
import { botChannelProblem, botRoleProblem, dashboardRow, POST_EMBED_PERMISSIONS } from "../config/kit/setupKit";
import { normalizePanelStyle } from "../../services/rolePanelLogic";
import { getGuildConfig, MAX_ROLES_PER_PANEL } from "../../services/configuration";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("rolepanel")
    .setDescription("Role panels: members pick their own roles with buttons or a dropdown.")
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName("create")
        .setDescription("Post a role panel (up to 3 roles); a form asks for the title, text and labels.")
        .addChannelOption(opt => opt.setName("channel").setDescription("Text channel for the panel").addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addRoleOption(opt => opt.setName("role1").setDescription("First role (must be below Aegis's role)").setRequired(true))
        .addRoleOption(opt => opt.setName("role2").setDescription("Second role (optional)").setRequired(false))
        .addRoleOption(opt => opt.setName("role3").setDescription("Third role (optional)").setRequired(false))
        .addStringOption(opt =>
          opt
            .setName("style")
            .setDescription("How members pick roles (default: buttons)")
            .setRequired(false)
            .addChoices(
              { name: "Buttons", value: "button" },
              { name: "Dropdown menu", value: "dropdown" },
            )
        )
        .addBooleanOption(opt =>
          opt.setName("exclusive").setDescription("Members can hold only one role from this panel (default: off)").setRequired(false)
        )
        .addRoleOption(opt =>
          opt.setName("required_role").setDescription("Only members with this role can use the panel (optional)").setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription("List this server's role panels, a page at a time (only you see it).")
    )
    .addSubcommand(sub =>
      sub
        .setName("delete")
        .setDescription("Delete a role panel and its message (asks to confirm).")
        .addStringOption(opt => opt.setName("id").setDescription("Panel; start typing its title to pick it").setRequired(true).setAutocomplete(true))
    ),

  category: "roles",
  guildOnly: true,
  // Used by subcommands, buttons or background work; requested on the invite, checked where used.
  featurePermissions: [PermissionFlagsBits.ManageRoles],

  autocomplete: panelAutocomplete,

  async execute(interaction) {
    if (!interaction.guild) return;
    const subcommand = interaction.options.getSubcommand();

    // create (modal)
    if (subcommand === "create") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
        await interaction.reply({ content: "❌ You need `Manage Roles` permission to create role panels.", flags: MessageFlags.Ephemeral });
        return;
      }

      const channel = interaction.options.getChannel("channel", true) as TextChannel;
      const role1 = interaction.options.getRole("role1", true);
      const role2 = interaction.options.getRole("role2");
      const role3 = interaction.options.getRole("role3");
      const style = normalizePanelStyle(interaction.options.getString("style"));
      const exclusive = interaction.options.getBoolean("exclusive") ?? false;
      const requiredRole = interaction.options.getRole("required_role");

      const picked = [role1, role2, role3].filter((r): r is NonNullable<typeof r> => Boolean(r));
      if (new Set(picked.map(r => r.id)).size !== picked.length) {
        await interaction.reply({ content: "❌ Each role can only appear once on a panel.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (requiredRole && picked.some(r => r.id === requiredRole.id)) {
        await interaction.reply({ content: "❌ The required role cannot also be one of the panel's roles.", flags: MessageFlags.Ephemeral });
        return;
      }
      // Never post to a channel Aegis cannot see.
      if (isObfuscatedChannel(channel) || isObfuscatedChannel(interaction.guild.channels.cache.get(channel.id))) {
        await interaction.reply({ content: `❌ ${hiddenChannelMessage(channel.id)}`, flags: MessageFlags.Ephemeral });
        return;
      }
      // Anyone can take a panel role by clicking, the creator included, so each
      // must be below the creator's own highest role (as Discord requires for
      // assigning roles by hand).
      const tooHigh = roleAboveActor({
        ownerId: interaction.guild.ownerId,
        actorId: interaction.user.id,
        actorTopPosition: await memberTopRolePosition(interaction.guild, interaction.user.id),
        roles: picked,
      });
      if (tooHigh) {
        await interaction.reply({
          content: `❌ You can't put <@&${tooHigh.id}> on a role panel: it is equal to or above your highest role.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (requiredRole && requiredRole.id === interaction.guild.id) {
        await interaction.reply({ content: "❌ Everyone has @everyone, so it can't be the required role. Leave `required_role` empty instead.", flags: MessageFlags.Ephemeral });
        return;
      }
      // Aegis hands these roles out when members click, so check it can before opening the form.
      for (const role of picked) {
        const problem = botRoleProblem(interaction.guild, role, "on a role panel");
        if (problem) {
          await interaction.reply({ content: problem, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
          return;
        }
      }
      const channelProblem = await botChannelProblem(interaction.guild, channel as never, POST_EMBED_PERMISSIONS);
      if (channelProblem) {
        await interaction.reply({ content: channelProblem, flags: MessageFlags.Ephemeral });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(scopedModalId("rolepanel_create_modal", interaction.id))
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

      // Roles 2 and 3 are optional
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
        filter: (m) => m.user.id === interaction.user.id && m.customId === scopedModalId("rolepanel_create_modal", interaction.id),
      }).catch(() => null);

      if (!modalResponse) return;
      await modalResponse.deferReply({ flags: MessageFlags.Ephemeral });

      const title = modalResponse.fields.getTextInputValue("panel_title");
      const description = modalResponse.fields.getTextInputValue("panel_desc");
      
      const getFieldVal = (id: string, fallback: string) => {
        try {
          return modalResponse.fields.getTextInputValue(id).trim() || fallback;
        } catch {
          return fallback;
        }
      };

      const rolesInput = [];
      const label1 = getFieldVal("label1", role1.name);
      rolesInput.push({ roleId: role1.id, label: label1 });

      if (role2) {
        const label2 = getFieldVal("label2", role2.name);
        rolesInput.push({ roleId: role2.id, label: label2 });
      }

      if (role3) {
        const label3 = getFieldVal("label3", role3.name);
        rolesInput.push({ roleId: role3.id, label: label3 });
      }

      // Respect the guild's max-roles-per-panel setting (default 25).
      const maxRoles = await getGuildConfig(interaction.guild.id)
        .then((cfg) => cfg.roles.maxRolesPerPanel)
        .catch(() => MAX_ROLES_PER_PANEL);
      if (rolesInput.length > maxRoles) {
        await modalResponse.editReply(`❌ This server allows at most ${maxRoles} role(s) per panel.`);
        return;
      }

      const panel = await createRolePanel(interaction.guild, channel, title, description, rolesInput, {
        style,
        mode: exclusive ? "exclusive" : "multi",
        requiredRoleId: requiredRole?.id ?? null,
      });

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
                { name: "🎛️ Style", value: style === "dropdown" ? "Dropdown" : "Buttons", inline: true },
                { name: "☝️ Pick only one", value: exclusive ? "Yes" : "No", inline: true },
                { name: "🔒 Required role", value: requiredRole ? `<@&${requiredRole.id}>` : "None", inline: true },
              )
              .setTimestamp()
          ],
          components: [dashboardRow(interaction.guild.id, "panels")],
          allowedMentions: { parse: [] },
        });
      } else {
        await modalResponse.editReply("❌ Couldn't post the role panel. Check that Aegis can **View Channel**, **Send Messages** and **Embed Links** in that channel.");
      }
      return;
    }

    if (subcommand === "list") { await listPanels(interaction, interaction.guild); return; }
    if (subcommand === "delete") { await deletePanel(interaction, interaction.guild); return; }
  },
};

export default command;
