import {
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits,
  SlashCommandBuilder,
  MessageFlags,
  escapeMarkdown,
} from "discord.js";
import { isBotHierarchyValid, isRoleHierarchyValid } from "../../permissions/hierarchy";
import { auditReason } from "../../utils/safeText";
import { sendGuildLog } from "../../services/logging";
import { logger } from "../../utils/logger";
import { Command } from "../../types/discord";

/** What a nickname change would do, or why it can't happen. Pure; unit-tested. */
export function nicknamePlan(input: { targetId: string; ownerId: string | null; botId: string | null; current: string | null; requested: string | null }):
  { ok: true; changed: boolean } | { ok: false; error: string } {
  if (input.targetId === input.ownerId) return { ok: false, error: "Discord doesn't let bots rename the server owner." };
  const next = input.requested && input.requested.trim() ? input.requested.trim() : null;
  if (next !== null && next.length > 32) return { ok: false, error: "Nicknames can be at most 32 characters." };
  return { ok: true, changed: (input.current ?? null) !== next };
}

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
    .addStringOption((option) =>
      option.setName("reason").setDescription("Why (shown in the audit log and mod log)").setRequired(false).setMaxLength(256),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageNicknames],
  botPermissions: [PermissionFlagsBits.ManageNicknames],

  execute: async (interaction: ChatInputCommandInteraction) => {
    let target = interaction.options.getMember("user") as GuildMember | null;
    if (!target) {
      const user = interaction.options.getUser("user");
      if (user && interaction.guild) {
        target = await interaction.guild.members.fetch(user.id).catch(() => null);
      }
    }
    const name = interaction.options.getString("name")?.trim() || null;
    const reason = interaction.options.getString("reason")?.trim() || null;
    const guildId = interaction.guildId!;

    if (!target || typeof target === "string") {
      await interaction.reply({ content: "❌ That user is not a member of this server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const plan = nicknamePlan({ targetId: target.id, ownerId: interaction.guild?.ownerId ?? null, botId: interaction.client.user?.id ?? null, current: target.nickname ?? null, requested: name });
    if (!plan.ok) {
      await interaction.reply({ content: `❌ ${plan.error}`, flags: MessageFlags.Ephemeral });
      return;
    }
    if (!plan.changed) {
      await interaction.reply({ content: name ? `ℹ️ **${escapeMarkdown(target.user.tag)}** is already called **${escapeMarkdown(name)}**; nothing changed.` : `ℹ️ **${escapeMarkdown(target.user.tag)}** has no nickname to clear.`, flags: MessageFlags.Ephemeral });
      return;
    }
    const previous = target.nickname ?? null;

    const [moderatorAllowed, botAllowed] = await Promise.all([
      isRoleHierarchyValid(interaction.client, guildId, interaction.user.id, target.id),
      isBotHierarchyValid(interaction.client, guildId, target.id),
    ]);
    if (!moderatorAllowed) {
      await interaction.reply({ content: "❌ You cannot rename a member with an equal or higher role.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (!botAllowed || !target.manageable) {
      await interaction.reply({ content: "❌ I cannot rename this member because of role hierarchy.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();
    try {
      await target.setNickname(name, auditReason(`Changed by ${interaction.user.tag}${reason ? `: ${reason}` : ""}`));
    } catch (err) {
      logger.warn(`Failed to set nickname for ${target.id} in guild ${guildId}:`, err);
      await interaction.editReply({
        content: "❌ I could not update that nickname. Check that I have **Manage Nicknames** and a role above theirs.",
      });
      return;
    }
    const tag = escapeMarkdown(target.user.tag);
    const from = previous ? escapeMarkdown(previous) : "(none)";
    // Nicknames are user text: never let one ping anyone.
    await interaction.editReply({
      content: name ? `✅ Renamed **${tag}**: ${from} → **${escapeMarkdown(name)}**.` : `✅ Cleared **${tag}**'s nickname (was ${from}).`,
      allowedMentions: { parse: [] },
    });
    await sendGuildLog(interaction.client, guildId, {
      title: "✏️ Nickname Changed",
      color: 0x5865f2,
      description: `**User:** ${tag} (<@${target.id}>)\n**Before:** ${from}\n**After:** ${name ? escapeMarkdown(name) : "Cleared"}\n**Moderator:** ${escapeMarkdown(interaction.user.tag)}${reason ? `\n**Reason:** ${escapeMarkdown(reason)}` : ""}`,
    }, "modActions");
  },
};
