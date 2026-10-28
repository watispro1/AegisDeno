import { definePlugin } from "../definePlugin";
import { MessageFlags } from "discord.js";

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
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const match = interaction.customId.match(/^rolepanel_([^_]+)_(.+)$/);
        if (!match) return;
        const [, panelId, roleId] = match;

        const { applyRolePanelPick, describePanelChange } = await import("../../services/rolePanelService");
        const member = await interaction.guild.members.fetch(interaction.user.id);

        try {
          const res = await applyRolePanelPick(interaction.guild, member, panelId, interaction.message.id, [roleId]);
          await interaction.editReply({ content: describePanelChange(res) });
        } catch (err: any) {
          await interaction.editReply({ content: `❌ ${err.message || "Failed to update role."}` });
        }
      },
    },
    {
      // Dropdown panels: `rolepanelsel_<panelId>`; the selected values are role IDs.
      pattern: /^rolepanelsel_(.+)$/,
      async handler(interaction, match) {
        if (!interaction.isStringSelectMenu() || !interaction.guild || !interaction.member) return;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const panelId = match?.[1];
        if (!panelId) return;

        const { applyRolePanelPick, describePanelChange } = await import("../../services/rolePanelService");
        const member = await interaction.guild.members.fetch(interaction.user.id);

        try {
          const res = await applyRolePanelPick(interaction.guild, member, panelId, interaction.message.id, interaction.values);
          await interaction.editReply({ content: describePanelChange(res) });
        } catch (err: any) {
          await interaction.editReply({ content: `❌ ${err.message || "Failed to update roles."}` });
        }
      },
    },
  ],
});
