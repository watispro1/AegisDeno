import {
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { isBotHierarchyValid, isRoleHierarchyValid } from "../../permissions/hierarchy";
import { sendGuildLog } from "../../services/logging";
import { Command } from "../../types/discord";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("nickname")
    .setDescription("Set or clear a member's server nickname.")
    .addUserOption((option) =>
      option.setName("user").setDescription("The member to rename").setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("New nickname; leave empty to clear")
        .setRequired(false)
        .setMaxLength(32),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageNicknames],
  botPermissions: [PermissionFlagsBits.ManageNicknames],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target = interaction.options.getMember("user") as GuildMember | null;
    const name = interaction.options.getString("name")?.trim() || null;
    const guildId = interaction.guildId!;

    if (!target || typeof target === "string") {
      await interaction.reply({ content: "❌ That user is not a member of this server.", ephemeral: true });
      return;
    }

    const [moderatorAllowed, botAllowed] = await Promise.all([
      isRoleHierarchyValid(interaction.client, guildId, interaction.user.id, target.id),
      isBotHierarchyValid(interaction.client, guildId, target.id),
    ]);
    if (!moderatorAllowed) {
      await interaction.reply({ content: "❌ You cannot rename a member with an equal or higher role.", ephemeral: true });
      return;
    }
    if (!botAllowed || !target.manageable) {
      await interaction.reply({ content: "❌ I cannot rename this member because of role hierarchy.", ephemeral: true });
      return;
    }

    await interaction.deferReply();
    await target.setNickname(name, `Changed by ${interaction.user.tag}`);
    await interaction.editReply(name ? `✅ Set **${target.user.tag}**'s nickname to **${name}**.` : `✅ Cleared **${target.user.tag}**'s nickname.`);
    await sendGuildLog(interaction.client, guildId, {
      title: "✏️ Nickname Changed",
      color: 0x5865f2,
      description: `**User:** ${target.user.tag} (<@${target.id}>)\n**Nickname:** ${name ?? "Cleared"}\n**Moderator:** ${interaction.user.tag}`,
    });
  },
};
