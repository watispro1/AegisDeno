/**
 * Self-role panel buttons and dropdowns.
 *
 * customIds (unchanged): rolepanel_<panelId>_<roleId> (button), rolepanelsel_<panelId> (select; values are role IDs)
 */
import { MessageFlags } from "discord.js";
import type { ComponentRoute } from "./router";
import { applyRolePanelPick, describePanelChange } from "../../services/rolePanelService";

const STALE_PANEL = "❌ This role panel button is out of date. Ask staff to re-post the panel.";

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export const roleRoutes: ComponentRoute[] = [
  {
    name: "rolepanel-button",
    match: /^rolepanel_/,
    async handle(interaction) {
      if (!interaction.isButton() || !interaction.guild || !interaction.member) return;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const parts = interaction.customId.match(/^rolepanel_([^_]+)_(.+)$/);
      // Already deferred: a bare return left the member on "thinking…" forever.
      if (!parts) {
        await interaction.editReply({ content: STALE_PANEL });
        return;
      }
      const [, panelId, roleId] = parts;
      const member = await interaction.guild.members.fetch(interaction.user.id);

      try {
        const res = await applyRolePanelPick(interaction.guild, member, panelId, interaction.message.id, [roleId]);
        await interaction.editReply({ content: describePanelChange(res) });
      } catch (err) {
        await interaction.editReply({ content: `❌ ${errorText(err, "Failed to update role.")}` });
      }
    },
  },
  {
    name: "rolepanel-select",
    match: /^rolepanelsel_(.+)$/,
    async handle(interaction, match) {
      if (!interaction.isStringSelectMenu() || !interaction.guild || !interaction.member) return;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const panelId = match?.[1];
      if (!panelId) {
        await interaction.editReply({ content: STALE_PANEL });
        return;
      }
      const member = await interaction.guild.members.fetch(interaction.user.id);

      try {
        const res = await applyRolePanelPick(interaction.guild, member, panelId, interaction.message.id, interaction.values);
        await interaction.editReply({ content: describePanelChange(res) });
      } catch (err) {
        await interaction.editReply({ content: `❌ ${errorText(err, "Failed to update roles.")}` });
      }
    },
  },
];
