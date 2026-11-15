/** /rolepanel list and delete, plus the panel-ID autocomplete. */
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, type AutocompleteInteraction, type ChatInputCommandInteraction, type Guild } from "discord.js";
import { getRolePanels, deleteRolePanel, type RolePanel } from "../../../services/rolePanelService";
import { rankChoices, shortAge } from "../../../utils/autocomplete";
import { requestConfirmation } from "../../../utils/confirmation";
import { replyPagedList } from "../../../utils/listPager";
import { dashboardRow, replyError } from "../../config/kit/setupKit";

type PanelSummary = Pick<RolePanel, "id" | "title" | "channelId" | "roles" | "panelStyle" | "mode" | "requiredRoleId"> & { createdAt?: Date | string };

/** Autocomplete entry: title, role count and age shown, ID sent. Pure. */
export function panelChoice(p: PanelSummary, now = Date.now()) {
  return {
    name: `${p.title} · ${p.roles.length} role(s)${p.createdAt ? ` · ${shortAge(p.createdAt, now)}` : ""} · ${p.id}`,
    value: p.id,
    keywords: p.roles.map(r => r.label).join(" "),
  };
}

/** One list entry per panel. Pure. */
export function panelLines(panels: readonly PanelSummary[]): string[] {
  return panels.map(p => {
    const extras = [
      p.panelStyle === "dropdown" ? "Dropdown" : "Buttons",
      p.mode === "exclusive" ? "pick one" : null,
      p.requiredRoleId ? `requires <@&${p.requiredRoleId}>` : null,
    ].filter(Boolean).join(" · ");
    const roles = p.roles.map(r => `<@&${r.roleId}>`).join(", ");
    return `**${p.title.slice(0, 100)}** · ID \`${p.id}\`\n> <#${p.channelId}> · ${extras}\n> ${roles.length > 300 ? `${p.roles.length} roles` : roles}`;
  });
}

export async function panelAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  if (!interaction.guildId || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.respond([]).catch(() => null);
    return;
  }
  const focused = interaction.options.getFocused(true);
  if (focused.name !== "id") {
    await interaction.respond([]).catch(() => null);
    return;
  }
  const panels = await getRolePanels(interaction.guildId);
  await interaction.respond(rankChoices(panels.map(p => panelChoice(p)), String(focused.value ?? ""))).catch(() => null);
}

export async function listPanels(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const panels = await getRolePanels(guild.id);
  await replyPagedList(interaction, {
    title: `🎭 Active Role Panels (${panels.length})`,
    lines: panelLines(panels),
    empty: "ℹ️ No role panels in this server yet. Create one with `/rolepanel create`.",
    perPage: 6,
    color: 0x9B59B6,
    ephemeral: true,
    note: "Delete one with /rolepanel delete",
  });
}

export async function deletePanel(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
    return replyError(interaction, "❌ You need `Manage Roles` permission to delete role panels.");
  }
  const id = interaction.options.getString("id", true).trim();
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const panel = (await getRolePanels(guild.id)).find(p => p.id === id);
  if (!panel) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0xED4245).setTitle("❌ Panel Not Found")
        .setDescription(`No panel with ID \`${id.slice(0, 40)}\`. Start typing in the \`id\` option to pick one, or run \`/rolepanel list\`.`)],
    });
    return;
  }
  const answer = await requestConfirmation(interaction, {
    content: `🗑️ Delete the role panel **${panel.title.slice(0, 100)}** in <#${panel.channelId}>? Its message is removed too; members keep the roles they already have.`,
    confirmLabel: "Delete panel",
  });
  if (answer !== "confirmed") return;
  const ok = await deleteRolePanel(guild, id);
  await interaction.editReply({
    content: "",
    embeds: [ok
      ? new EmbedBuilder().setColor(0x57F287).setTitle("🗑️ Role Panel Deleted").setDescription(`**${panel.title.slice(0, 100)}** and its message in <#${panel.channelId}> have been deleted.`).setTimestamp()
      : new EmbedBuilder().setColor(0xED4245).setTitle("❌ Couldn't delete the panel").setDescription("It may have just been removed. Run `/rolepanel list` to check.")],
    components: ok ? [dashboardRow(guild.id, "panels")] : [],
  });
}
