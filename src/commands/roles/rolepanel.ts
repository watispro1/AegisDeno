import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
  EmbedBuilder,
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
        .setDescription("Create a button role panel.")
        .addChannelOption(opt => opt.setName("channel").setDescription("Target channel").addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addStringOption(opt => opt.setName("title").setDescription("Embed title").setRequired(true))
        .addStringOption(opt => opt.setName("description").setDescription("Embed instructions").setRequired(true))
        .addRoleOption(opt => opt.setName("role1").setDescription("First role").setRequired(true))
        .addStringOption(opt => opt.setName("label1").setDescription("Label for first role button").setRequired(false))
        .addRoleOption(opt => opt.setName("role2").setDescription("Second role").setRequired(false))
        .addStringOption(opt => opt.setName("label2").setDescription("Label for second role button").setRequired(false))
        .addRoleOption(opt => opt.setName("role3").setDescription("Third role").setRequired(false))
        .addStringOption(opt => opt.setName("label3").setDescription("Label for third role button").setRequired(false))
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

    if (subcommand === "create") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
        await interaction.reply({ content: "❌ You need `Manage Roles` permission to create role panels.", ephemeral: true });
        return;
      }

      const channel = interaction.options.getChannel("channel", true) as TextChannel;
      const title = interaction.options.getString("title", true);
      const description = interaction.options.getString("description", true);

      const rolesInput = [];
      const role1 = interaction.options.getRole("role1", true);
      const label1 = interaction.options.getString("label1") || role1.name;
      rolesInput.push({ roleId: role1.id, label: label1 });

      const role2 = interaction.options.getRole("role2");
      if (role2) {
        rolesInput.push({ roleId: role2.id, label: interaction.options.getString("label2") || role2.name });
      }

      const role3 = interaction.options.getRole("role3");
      if (role3) {
        rolesInput.push({ roleId: role3.id, label: interaction.options.getString("label3") || role3.name });
      }

      await interaction.deferReply({ ephemeral: true });
      const panel = await createRolePanel(interaction.guild, channel, title, description, rolesInput);

      if (panel) {
        await interaction.editReply({ content: `✅ Role panel **${title}** (\`${panel.id}\`) created in ${channel}!` });
      } else {
        await interaction.editReply({ content: "❌ Failed to create role panel." });
      }
      return;
    }

    if (subcommand === "list") {
      const panels = await getRolePanels(interaction.guild.id);
      if (panels.length === 0) {
        await interaction.reply({ content: "ℹ️ No role panels configured.", ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("🎭 Active Role Panels")
        .setColor(0x9B59B6)
        .setDescription(
          panels
            .map(p => `• **ID:** \`${p.id}\` | **Title:** ${p.title} | **Channel:** <#${p.channelId}> (${p.roles.length} roles)`)
            .join("\n")
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (subcommand === "delete") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
        await interaction.reply({ content: "❌ You need `Manage Roles` permission to delete role panels.", ephemeral: true });
        return;
      }

      const id = interaction.options.getString("id", true);
      const ok = await deleteRolePanel(interaction.guild.id, id);
      await interaction.reply({
        content: ok ? `✅ Role panel \`${id}\` deleted.` : `❌ Panel \`${id}\` not found.`,
        ephemeral: true,
      });
      return;
    }
  },
};

export default command;
