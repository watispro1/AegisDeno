import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types/discord";
import { BETA_GUILD_ID } from "../../config/env";
import {
  BETA_FEATURES,
  canUseBetaFeature,
  createBetaFeedback,
  getBetaProgram,
  getRecentBetaFeedback,
  setFeature,
  setTester,
  type BetaFeatureKey,
} from "../../services/beta";
import { sendGuildLog } from "../../services/logging";

const FEATURE_CHOICES = Object.entries(BETA_FEATURES).map(([value, feature]) => ({ name: feature.label, value }));

function isBetaFeature(value: string): value is BetaFeatureKey {
  return value in BETA_FEATURES;
}

function requireBetaGuild(interaction: Parameters<Command["execute"]>[0]): boolean {
  return interaction.guildId === BETA_GUILD_ID;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("beta")
    .setDescription("Manage the Aegis beta program and tester feedback.")
    .setDMPermission(false)
    .addSubcommand(sub => sub.setName("status").setDescription("View beta program status and enabled features."))
    .addSubcommand(sub => sub.setName("tester-add").setDescription("Add a member as a beta tester.")
      .addUserOption(option => option.setName("user").setDescription("Member to add").setRequired(true)))
    .addSubcommand(sub => sub.setName("tester-remove").setDescription("Remove a beta tester.")
      .addUserOption(option => option.setName("user").setDescription("Member to remove").setRequired(true)))
    .addSubcommand(sub => sub.setName("feature-enable").setDescription("Enable a beta feature for testers.")
      .addStringOption(option => option.setName("feature").setDescription("Beta feature").addChoices(...FEATURE_CHOICES).setRequired(true)))
    .addSubcommand(sub => sub.setName("feature-disable").setDescription("Disable a beta feature for testers.")
      .addStringOption(option => option.setName("feature").setDescription("Beta feature").addChoices(...FEATURE_CHOICES).setRequired(true)))
    .addSubcommand(sub => sub.setName("feedback").setDescription("Send private feedback to the beta team.")
      .addStringOption(option => option.setName("message").setDescription("What happened, what you expected, and any context").setMaxLength(1_500).setRequired(true)))
    .addSubcommand(sub => sub.setName("lab").setDescription("[Beta] Preview experimental AutoMod caps detection without enforcing it.")
      .addStringOption(option => option.setName("message").setDescription("Example message to evaluate").setMaxLength(1_000).setRequired(true)))
    .addSubcommand(sub => sub.setName("feedback-list").setDescription("Review recent beta feedback.")),

  guildOnly: true,

  async execute(interaction) {
    if (!requireBetaGuild(interaction)) {
      await interaction.reply({ content: "❌ The managed beta program is only available in the Aegis beta server.", ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const canManage = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
    const requireManager = async (): Promise<boolean> => {
      if (canManage) return true;
      await interaction.reply({ content: "❌ You need **Manage Server** to manage the beta program.", ephemeral: true });
      return false;
    };

    if (subcommand === "status") {
      const program = await getBetaProgram(BETA_GUILD_ID);
      const enabled = program.enabledFeatures.length
        ? program.enabledFeatures.map(feature => `• **${BETA_FEATURES[feature].label}** — ${BETA_FEATURES[feature].description}`).join("\n")
        : "No beta features are currently enabled.";
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("🧪 Aegis Beta Program")
          .setDescription("Feature access is opt-in: a member must be on the tester roster and the feature must be enabled.")
          .addFields(
            { name: "👥 Testers", value: `**${program.testerIds.length}** enrolled`, inline: true },
            { name: "⚡ Enabled Features", value: `**${program.enabledFeatures.length}**`, inline: true },
            { name: "Feature Rollout", value: enabled, inline: false },
          )
          .setTimestamp()],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === "tester-add" || subcommand === "tester-remove") {
      if (!await requireManager()) return;
      const user = interaction.options.getUser("user", true);
      const enabled = subcommand === "tester-add";
      const program = await setTester(BETA_GUILD_ID, user.id, enabled, interaction.user.id);
      await interaction.reply({ content: `${enabled ? "✅ Added" : "🗑️ Removed"} ${user} ${enabled ? "as a beta tester" : "from the beta roster"}. **${program.testerIds.length}** tester(s) enrolled.`, ephemeral: true });
      return;
    }

    if (subcommand === "feature-enable" || subcommand === "feature-disable") {
      if (!await requireManager()) return;
      const rawFeature = interaction.options.getString("feature", true);
      if (!isBetaFeature(rawFeature)) {
        await interaction.reply({ content: "❌ Unknown beta feature.", ephemeral: true });
        return;
      }
      const enabled = subcommand === "feature-enable";
      await setFeature(BETA_GUILD_ID, rawFeature, enabled, interaction.user.id);
      await interaction.reply({ content: `${enabled ? "✅ Enabled" : "⏸️ Disabled"} **${BETA_FEATURES[rawFeature].label}** for beta testers.`, ephemeral: true });
      await sendGuildLog(interaction.client, BETA_GUILD_ID, {
        title: "🧪 Beta Feature Updated",
        color: enabled ? 0x5865F2 : 0xFEE75C,
        description: `**Feature:** ${BETA_FEATURES[rawFeature].label}\n**Status:** ${enabled ? "Enabled" : "Disabled"}\n**Updated by:** ${interaction.user.tag}`,
      });
      return;
    }

    if (subcommand === "feedback") {
      const allowed = await canUseBetaFeature(BETA_GUILD_ID, interaction.user.id, "beta-feedback");
      if (!allowed) {
        await interaction.reply({ content: "❌ Beta feedback is available only to enrolled testers while the feature is enabled.", ephemeral: true });
        return;
      }
      const content = interaction.options.getString("message", true).trim();
      const id = await createBetaFeedback({ guildId: BETA_GUILD_ID, authorId: interaction.user.id, feature: "beta-feedback", content });
      await interaction.reply({ content: `✅ Feedback received privately. Reference: \`${id}\``, ephemeral: true });
      await sendGuildLog(interaction.client, BETA_GUILD_ID, {
        title: "🧪 Beta Feedback Received",
        color: 0x5865F2,
        description: `**Tester:** ${interaction.user.tag}\n**Reference:** \`${id}\`\n\n${content}`,
      });
      return;
    }

    if (subcommand === "lab") {
      const allowed = await canUseBetaFeature(BETA_GUILD_ID, interaction.user.id, "command-lab");
      if (!allowed) {
        await interaction.reply({ content: "❌ Command Lab is available only to enrolled testers while the feature is enabled.", ephemeral: true });
        return;
      }
      const message = interaction.options.getString("message", true);
      const letters = message.match(/[a-z]/gi) ?? [];
      const uppercase = letters.filter(letter => letter === letter.toUpperCase()).length;
      const percentage = letters.length ? Math.round((uppercase / letters.length) * 100) : 0;
      const program = await getBetaProgram(BETA_GUILD_ID);
      const capsEnabled = program.enabledFeatures.includes("experimental-automod");
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(capsEnabled && letters.length >= 8 && percentage >= 80 ? 0xFEE75C : 0x5865F2)
          .setTitle("🧪 Command Lab — Caps Filter Preview")
          .setDescription("This preview does not send, delete, warn, or timeout anyone.")
          .addFields(
            { name: "Letters analyzed", value: String(letters.length), inline: true },
            { name: "Uppercase", value: `${percentage}%`, inline: true },
            { name: "Experimental AutoMod", value: capsEnabled ? "✅ Enabled" : "⏸️ Disabled", inline: true },
            { name: "Result", value: !capsEnabled ? "Feature is disabled." : letters.length < 8 ? "Ignored — fewer than 8 letters." : percentage >= 80 ? "Would trigger at the default 80% threshold." : "Would not trigger at the default 80% threshold.", inline: false },
          )
          .setTimestamp()],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === "feedback-list") {
      if (!await requireManager()) return;
      const feedback = await getRecentBetaFeedback(BETA_GUILD_ID);
      const description = feedback.length
        ? feedback.map(item => `• \`${item.id}\` — <@${item.authorId}>\n> ${item.content.slice(0, 180)}${item.content.length > 180 ? "…" : ""}`).join("\n")
        : "No beta feedback has been submitted yet.";
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle("🧪 Recent Beta Feedback").setDescription(description.slice(0, 4_000)).setTimestamp()], ephemeral: true });
    }
  },
};

export default command;
