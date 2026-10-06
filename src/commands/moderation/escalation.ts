import { logger } from "../../utils/logger";
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { Command } from "../../types/discord";
import { getGuildConfig, updateGuildConfig } from "../../services/configuration";

const ACTION_LABELS: Record<string, string> = { timeout: "Timeout", kick: "Kick", ban: "Ban" };

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("escalation")
    .setDescription("Configure automatic escalation actions when users hit warning thresholds.")
    .addSubcommand(sub =>
      sub.setName("status").setDescription("View current escalation configuration.")
    )
    .addSubcommand(sub =>
      sub.setName("toggle").setDescription("Enable or disable escalation.")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable or disable").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("add").setDescription("Add an escalation threshold.")
        .addIntegerOption(opt =>
          opt.setName("warnings").setDescription("Warning count that triggers this action").setRequired(true).setMinValue(1).setMaxValue(100)
        )
        .addStringOption(opt =>
          opt.setName("action").setDescription("Action to take").setRequired(true)
            .addChoices(
              { name: "Timeout", value: "timeout" },
              { name: "Kick", value: "kick" },
              { name: "Ban", value: "ban" },
            )
        )
        .addIntegerOption(opt =>
          opt.setName("duration").setDescription("Timeout duration in minutes (required for timeout action)").setRequired(false).setMinValue(1).setMaxValue(40320)
        )
    )
    .addSubcommand(sub =>
      sub.setName("remove").setDescription("Remove an escalation threshold.")
        .addIntegerOption(opt =>
          opt.setName("warnings").setDescription("The warning count threshold to remove").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("clear").setDescription("Remove all escalation thresholds.")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageGuild],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    await interaction.deferReply({ ephemeral: true });

    try {
      const config = await getGuildConfig(guildId);
      const { escalation } = config;

      if (sub === "status") {
        const lines = escalation.thresholds.length === 0
          ? ["*No thresholds configured.*"]
          : escalation.thresholds
              .sort((a, b) => a.atWarnings - b.atWarnings)
              .map(t => `**${t.atWarnings} warnings** → **${ACTION_LABELS[t.action] ?? t.action}**${t.action === "timeout" ? ` (${t.durationMinutes ?? 60}m)` : ""}`);

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("⚡ Escalation Configuration")
          .addFields(
            { name: "Status", value: escalation.enabled ? "✅ Enabled" : "❌ Disabled", inline: true },
            { name: "Thresholds", value: lines.join("\n"), inline: false },
          );
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (sub === "toggle") {
        const enabled = interaction.options.getBoolean("enabled", true);
        await updateGuildConfig(guildId, { escalation: { ...escalation, enabled } } as any);
        await interaction.editReply(`✅ Escalation is now **${enabled ? "enabled" : "disabled"}**.`);
        return;
      }

      if (sub === "add") {
        const atWarnings = interaction.options.getInteger("warnings", true);
        const action = interaction.options.getString("action", true) as "timeout" | "kick" | "ban";
        const durationMinutes = interaction.options.getInteger("duration") ?? 60;

        if (action === "timeout" && durationMinutes < 1) {
          await interaction.editReply("❌ Timeout action requires a duration.");
          return;
        }

        // Remove existing threshold at same warning count, then add new one
        const filtered = escalation.thresholds.filter(t => t.atWarnings !== atWarnings);
        const newThreshold: { atWarnings: number; action: "timeout" | "kick" | "ban"; durationMinutes?: number } = { atWarnings, action };
        if (action === "timeout") newThreshold.durationMinutes = durationMinutes;
        filtered.push(newThreshold);

        await updateGuildConfig(guildId, { escalation: { ...escalation, thresholds: filtered } } as any);
        await interaction.editReply(`✅ Added threshold: **${atWarnings} warnings** → **${ACTION_LABELS[action]}**${action === "timeout" ? ` (${durationMinutes}m)` : ""}.`);
        return;
      }

      if (sub === "remove") {
        const atWarnings = interaction.options.getInteger("warnings", true);
        const filtered = escalation.thresholds.filter(t => t.atWarnings !== atWarnings);
        if (filtered.length === escalation.thresholds.length) {
          await interaction.editReply(`❌ No threshold found at **${atWarnings}** warnings.`);
          return;
        }
        await updateGuildConfig(guildId, { escalation: { ...escalation, thresholds: filtered } } as any);
        await interaction.editReply(`✅ Removed threshold at **${atWarnings}** warnings.`);
        return;
      }

      if (sub === "clear") {
        await updateGuildConfig(guildId, { escalation: { ...escalation, thresholds: [] } } as any);
        await interaction.editReply("✅ All escalation thresholds cleared.");
        return;
      }
    } catch (err) {
      logger.error(`Failed /escalation ${sub} for guild ${guildId}:`, err);
      await interaction.editReply("❌ Something went wrong. Please try again.");
    }
  },
};
