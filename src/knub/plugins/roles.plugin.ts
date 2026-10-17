import { definePlugin } from "../definePlugin";

export interface RolesPluginConfig {
  maxRolesPerPanel: number;
}

export const RolesPlugin = definePlugin<RolesPluginConfig>({
  name: "roles",
  description: "Self-assignable role panels with interactive button and select-menu toggling",
  version: "1.0.0",
  defaultConfig: {
    maxRolesPerPanel: 25,
  },
  customIdHandlers: [
    {
      pattern: /^rolepanel_/,
      async handler(interaction) {
        if (!interaction.isButton() || !interaction.guild || !interaction.member) return;
        await interaction.deferReply({ ephemeral: true });

        const match = interaction.customId.match(/^rolepanel_([^_]+)_(.+)$/);
        if (!match) return;
        const [, panelId, roleId] = match;

        const { toggleRoleFromPanel } = await import("../../services/rolePanelService");
        const member = await interaction.guild.members.fetch(interaction.user.id);

        try {
          const res = await toggleRoleFromPanel(
            interaction.guild,
            member,
            roleId,
            panelId,
            interaction.message.id,
          );
          await interaction.editReply({
            content: res.added
              ? `✅ Granted role **${res.roleName}**.`
              : `🗑️ Removed role **${res.roleName}**.`,
          });
        } catch (err: any) {
          await interaction.editReply({ content: `❌ ${err.message || "Failed to update role."}` });
        }
      },
    },
  ],
});
