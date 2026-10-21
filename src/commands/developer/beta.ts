import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../../types/discord";
import { BETA_GUILD_ID, BOT_OWNER_IDS } from "../../config/env";
import {
  BETA_FEATURES,
  canUseBetaFeature,
  createBetaFeedback,
  enrollGuild,
  getBetaFeedbackById,
  getBetaLeaderboard,
  getBetaProgram,
  getRecentBetaFeedback,
  getTesterStats,
  isBetaGuild,
  runFullLabSuite,
  setFeature,
  setTester,
  unenrollGuild,
  updateFeedbackStatus,
  type BetaFeatureKey,
  type BetaFeedbackCategory,
  type BetaFeedbackSeverity,
  type BetaFeedbackStatus,
} from "../../services/beta";
import { sendGuildLog } from "../../services/logging";

const FEATURE_CHOICES = Object.entries(BETA_FEATURES).map(([value, feature]) => ({
  name: `${feature.label.slice(0, 65)} [${feature.category}]`,
  value,
}));

function isBetaFeature(value: string): value is BetaFeatureKey {
  return value in BETA_FEATURES;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("beta")
    .setDescription("Manage the Aegis beta program, experimental flags, Command Lab, and tester feedback.")
    .setDMPermission(false)

    // ── Status & Info ────────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName("status").setDescription("View beta program status, active experiments, and enrolled testers.")
    )

    // ── Tester Management ───────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName("tester-add").setDescription("Add a member to the beta tester roster.")
        .addUserOption(opt => opt.setName("user").setDescription("Member to enroll").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("tester-remove").setDescription("Remove a member from the beta tester roster.")
        .addUserOption(opt => opt.setName("user").setDescription("Member to remove").setRequired(true))
    )

    // ── Feature Flags ───────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName("feature-enable").setDescription("Enable an experimental beta feature for testers.")
        .addStringOption(opt => opt.setName("feature").setDescription("Beta feature to enable").addChoices(...FEATURE_CHOICES).setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("feature-disable").setDescription("Disable an experimental beta feature.")
        .addStringOption(opt => opt.setName("feature").setDescription("Beta feature to disable").addChoices(...FEATURE_CHOICES).setRequired(true))
    )

    // ── Interactive Command Lab ─────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName("lab").setDescription("[Command Lab] Run advanced safety, caps, flood, and invite simulations on a sample text.")
        .addStringOption(opt => opt.setName("message").setDescription("Example message or pattern to evaluate").setMaxLength(1_500).setRequired(true))
        .addStringOption(opt => opt.setName("type").setDescription("Evaluation suite to execute")
          .addChoices(
            { name: "Full Multi-Scan Suite (Recommended)", value: "full" },
            { name: "Caps Percentage Analysis", value: "caps" },
            { name: "Character Flood & Spam Runs", value: "flood" },
            { name: "Discord & Disguised Invite Scanner", value: "invites" },
            { name: "Mass Mention & Ping Velocity", value: "mentions" },
            { name: "Shannon Entropy & Statistical Spam Heuristics", value: "entropy" },
          )
        )
        .addIntegerOption(opt => opt.setName("threshold").setDescription("Custom caps threshold % (50-100)").setMinValue(50).setMaxValue(100))
    )

    // ── Feedback Submission ─────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName("feedback").setDescription("Submit structured feedback, bug reports, or feature ideas to the beta staff.")
        .addStringOption(opt => opt.setName("message").setDescription("What happened, steps to reproduce, or your suggestion").setMaxLength(1_500).setRequired(true))
        .addStringOption(opt => opt.setName("category").setDescription("Feedback category")
          .addChoices(
            { name: "🐛 Bug Report", value: "bug" },
            { name: "💡 Feature Request", value: "feature" },
            { name: "✨ Quality of Life Improvement", value: "improvement" },
            { name: "❓ Implementation Question", value: "question" },
          )
        )
        .addStringOption(opt => opt.setName("severity").setDescription("Issue severity (for bugs)")
          .addChoices(
            { name: "🟡 Low (Minor or cosmetic)", value: "low" },
            { name: "🟠 Medium (Functional issue with workaround)", value: "medium" },
            { name: "🔴 High (Important feature broken)", value: "high" },
            { name: "💥 Critical / Blocker (Crash or security vulnerability)", value: "critical" },
          )
        )
    )

    // ── Feedback Management ─────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName("feedback-list").setDescription("Review recent beta feedback submissions.")
        .addStringOption(opt => opt.setName("status").setDescription("Filter by status")
          .addChoices(
            { name: "🟡 Open / Under Review", value: "open" },
            { name: "🔍 Investigating / In Progress", value: "investigating" },
            { name: "✅ Resolved / Shipped", value: "resolved" },
            { name: "❌ Declined", value: "declined" },
            { name: "All Records", value: "all" },
          )
        )
        .addStringOption(opt => opt.setName("category").setDescription("Filter by category")
          .addChoices(
            { name: "🐛 Bugs", value: "bug" },
            { name: "💡 Features", value: "feature" },
            { name: "✨ Improvements", value: "improvement" },
            { name: "❓ Questions", value: "question" },
          )
        )
        .addIntegerOption(opt => opt.setName("limit").setDescription("Max items (1-25)").setMinValue(1).setMaxValue(25))
    )
    .addSubcommand(sub =>
      sub.setName("feedback-view").setDescription("View full details of a specific feedback record.")
        .addStringOption(opt => opt.setName("id").setDescription("Feedback Reference ID (e.g. BETA-XXXXX)").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("feedback-triage").setDescription("Triage or update the status of a beta feedback ticket.")
        .addStringOption(opt => opt.setName("id").setDescription("Feedback Reference ID").setRequired(true))
        .addStringOption(opt => opt.setName("status").setDescription("New resolution status")
          .addChoices(
            { name: "🟡 Open", value: "open" },
            { name: "🔍 Investigating", value: "investigating" },
            { name: "✅ Resolved", value: "resolved" },
            { name: "❌ Declined", value: "declined" },
          )
          .setRequired(true)
        )
        .addStringOption(opt => opt.setName("note").setDescription("Staff resolution or investigation notes").setMaxLength(500))
    )

    // ── Tester Perks & Leaderboard ──────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName("profile").setDescription("View your beta tester statistics, contributions, and earned badges.")
        .addUserOption(opt => opt.setName("user").setDescription("Tester member to inspect"))
    )
    .addSubcommand(sub =>
      sub.setName("leaderboard").setDescription("View the top active beta contributors.")
        .addIntegerOption(opt => opt.setName("limit").setDescription("Number of testers (default: 10)").setMinValue(3).setMaxValue(25))
    )

    // ── Guild Multi-Server Enrollment ───────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName("guild-enroll").setDescription("[Owner] Authorize an external Discord server for the beta program.")
        .addStringOption(opt => opt.setName("guild_id").setDescription("Target Discord Guild ID").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("guild-unenroll").setDescription("[Owner] De-authorize an external Discord server from the beta program.")
        .addStringOption(opt => opt.setName("guild_id").setDescription("Target Discord Guild ID").setRequired(true))
    ),

  guildOnly: true,

  async execute(interaction) {
    const guildId = interaction.guildId!;
    const isAuthorizedGuild = await isBetaGuild(guildId);
    const isBotOwner = BOT_OWNER_IDS.has(interaction.user.id);
    const canManageGuild = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
    const subcommand = interaction.options.getSubcommand();

    // Guild enrollment check
    if (!isAuthorizedGuild && !isBotOwner) {
      await interaction.reply({
        content: "❌ The Aegis beta program is only available in the official Aegis beta guild and authorized partner servers.",
        ephemeral: true,
      });
      return;
    }

    const requireManager = async (): Promise<boolean> => {
      if (canManageGuild || isBotOwner) return true;
      await interaction.reply({
        content: "❌ You need the **Manage Server** permission to configure the beta program.",
        ephemeral: true,
      });
      return false;
    };

    const requireBotOwner = async (): Promise<boolean> => {
      if (isBotOwner) return true;
      await interaction.reply({
        content: "❌ This operation is restricted to verified Aegis bot developers.",
        ephemeral: true,
      });
      return false;
    };

    // ── /beta status ─────────────────────────────────────────────────────────
    if (subcommand === "status") {
      const program = await getBetaProgram(guildId);
      const isRoot = guildId === BETA_GUILD_ID;

      const featureList = Object.entries(BETA_FEATURES).map(([key, meta]) => {
        const isEnabled = program.enabledFeatures.includes(key as BetaFeatureKey);
        const icon = isEnabled ? "🟢" : "⚪";
        return `${icon} **${meta.label}** \`[${meta.category}]\`\n└ ${meta.description}`;
      }).join("\n\n");

      const recentCount = (await getRecentBetaFeedback(guildId, { limit: 1 })).length;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🧪 Aegis Beta Program Telemetry")
        .setDescription(
          `Operating on **${isRoot ? "Primary Beta Hub" : "Enrolled Partner Guild"}**.\n` +
          `Feature gates are strictly opt-in per server and tester roster.`
        )
        .addFields(
          { name: "👥 Enrolled Testers", value: `**${program.testerIds.length}** members`, inline: true },
          { name: "⚡ Active Flags", value: `**${program.enabledFeatures.length}** / ${Object.keys(BETA_FEATURES).length}`, inline: true },
          { name: "🌐 Enrolled Guilds", value: `**${(program.enrolledGuilds.length || 1)}** server(s)`, inline: true },
          { name: "🔬 Feature Rollout Matrix", value: featureList, inline: false },
        )
        .setFooter({ text: "Use /beta lab to simulate rules • /beta feedback to report findings" })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // ── /beta tester-add & tester-remove ────────────────────────────────────
    if (subcommand === "tester-add" || subcommand === "tester-remove") {
      if (!await requireManager()) return;
      const user = interaction.options.getUser("user", true);
      const isAdd = subcommand === "tester-add";

      const program = await setTester(guildId, user.id, isAdd, interaction.user.id);
      await interaction.reply({
        content: `${isAdd ? "✅ Enrolled" : "🗑️ Removed"} ${user} ${isAdd ? "as a verified beta tester" : "from the beta tester roster"}. Current roster: **${program.testerIds.length}** tester(s).`,
        ephemeral: true,
      });

      await sendGuildLog(interaction.client, guildId, {
        title: isAdd ? "🧪 Beta Tester Enrolled" : "🧪 Beta Tester Removed",
        color: isAdd ? 0x5865F2 : 0xED4245,
        description: `**Member:** ${user.tag} (${user.id})\n**Staff:** ${interaction.user.tag}\n**Roster Count:** ${program.testerIds.length}`,
      });
      return;
    }

    // ── /beta feature-enable & feature-disable ──────────────────────────────
    if (subcommand === "feature-enable" || subcommand === "feature-disable") {
      if (!await requireManager()) return;
      const rawFeature = interaction.options.getString("feature", true);
      if (!isBetaFeature(rawFeature)) {
        await interaction.reply({ content: "❌ Unknown beta feature flag.", ephemeral: true });
        return;
      }

      const isEnable = subcommand === "feature-enable";
      await setFeature(guildId, rawFeature, isEnable, interaction.user.id);

      const meta = BETA_FEATURES[rawFeature];
      await interaction.reply({
        content: `${isEnable ? "✅ Enabled" : "⏸️ Disabled"} experiment **${meta.label}** \`[${meta.category}]\`.`,
        ephemeral: true,
      });

      await sendGuildLog(interaction.client, guildId, {
        title: "🧪 Beta Experiment State Modified",
        color: isEnable ? 0x57F287 : 0xFEE75C,
        description: `**Experiment:** ${meta.label}\n**Category:** ${meta.category}\n**State:** ${isEnable ? "Active" : "Paused"}\n**Updated by:** ${interaction.user.tag}`,
      });
      return;
    }

    // ── /beta lab ───────────────────────────────────────────────────────────
    if (subcommand === "lab") {
      const allowed = await canUseBetaFeature(guildId, interaction.user.id, "command-lab");
      if (!allowed && !canManageGuild && !isBotOwner) {
        await interaction.reply({
          content: "❌ Command Lab is restricted to enrolled beta testers while the `command-lab` flag is active.",
          ephemeral: true,
        });
        return;
      }

      const message = interaction.options.getString("message", true);
      const testType = interaction.options.getString("type") || "full";
      const customThreshold = interaction.options.getInteger("threshold") || 80;

      const suite = runFullLabSuite(message);

      // Color coding by risk
      let embedColor = 0x57F287; // Green
      if (suite.overallRisk === "LOW RISK") embedColor = 0x5865F2;
      else if (suite.overallRisk === "SUSPICIOUS") embedColor = 0xFEE75C;
      else if (suite.overallRisk === "HIGH RISK") embedColor = 0xE67E22;
      else if (suite.overallRisk === "CRITICAL") embedColor = 0xED4245;

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`🧪 Command Lab — Simulation Diagnostic`)
        .setDescription(
          `**Risk Rating:** \`${suite.overallRisk}\` (Threat Score: **${suite.compositeScore}** / 100)\n` +
          `*Non-enforcing simulation: Evaluated safely without deleting, warning, or timing out anyone.*`
        )
        .addFields({
          name: "📝 Payload Under Analysis",
          value: `\`\`\`text\n${message.slice(0, 300)}${message.length > 300 ? "..." : ""}\n\`\`\``,
          inline: false,
        });

      // Filter results if specific type requested
      const filtered = testType === "full"
        ? suite.results
        : suite.results.filter(r => {
            if (testType === "caps") return r.rule.includes("Caps");
            if (testType === "flood") return r.rule.includes("Flood");
            if (testType === "invites") return r.rule.includes("Invite");
            if (testType === "mentions") return r.rule.includes("Mention");
            if (testType === "entropy") return r.rule.includes("Entropy");
            return true;
          });

      for (const res of filtered) {
        const badge = res.triggered ? "🚨 **TRIGGERED**" : "🛡️ **PASSED**";
        embed.addFields({
          name: `${badge} — ${res.rule}`,
          value: `**Details:** ${res.details}\n**Recommendation:** ${res.recommendation}`,
          inline: false,
        });
      }

      embed.setFooter({ text: "Aegis Heuristic Safety Lab v3.3.2 • Real-time Token Diagnostics" });
      embed.setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // ── /beta feedback ──────────────────────────────────────────────────────
    if (subcommand === "feedback") {
      const allowed = await canUseBetaFeature(guildId, interaction.user.id, "beta-feedback");
      if (!allowed && !canManageGuild && !isBotOwner) {
        await interaction.reply({
          content: "❌ Beta feedback submission is only accessible to enrolled testers while the `beta-feedback` experiment is enabled.",
          ephemeral: true,
        });
        return;
      }

      const content = interaction.options.getString("message", true).trim();
      const category = (interaction.options.getString("category") as BetaFeedbackCategory) || "bug";
      const severity = (interaction.options.getString("severity") as BetaFeedbackSeverity) || "medium";

      const refId = await createBetaFeedback({
        guildId,
        authorId: interaction.user.id,
        feature: "beta-feedback",
        content,
        category,
        severity,
      });

      const catLabels: Record<BetaFeedbackCategory, string> = {
        bug: "🐛 Bug Report",
        feature: "💡 Feature Request",
        improvement: "✨ Quality of Life",
        question: "❓ Question",
      };

      const sevLabels: Record<BetaFeedbackSeverity, string> = {
        low: "🟡 Low",
        medium: "🟠 Medium",
        high: "🔴 High",
        critical: "💥 Critical",
      };

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle("✅ Beta Feedback Dispatched")
        .setDescription(
          `Your feedback has been logged to the engineering triage queue.\n` +
          `Reference Ticket: \`${refId}\``
        )
        .addFields(
          { name: "Category", value: catLabels[category], inline: true },
          { name: "Severity", value: sevLabels[severity], inline: true },
          { name: "Content", value: `> ${content.slice(0, 1000)}`, inline: false },
        )
        .setFooter({ text: "Thank you for helping harden Aegis! Use /beta profile to view your stats." })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

      // Audit notification
      await sendGuildLog(interaction.client, guildId, {
        title: `🧪 New Beta Feedback [${refId}]`,
        color: severity === "critical" ? 0xED4245 : 0x5865F2,
        description:
          `**Author:** ${interaction.user.tag} (<@${interaction.user.id}>)\n` +
          `**Category:** ${catLabels[category]}\n` +
          `**Severity:** ${sevLabels[severity]}\n` +
          `**Reference:** \`${refId}\`\n\n` +
          `>>> ${content}`,
      });
      return;
    }

    // ── /beta feedback-list ─────────────────────────────────────────────────
    if (subcommand === "feedback-list") {
      if (!await requireManager()) return;

      const rawStatus = interaction.options.getString("status");
      const filterStatus = (rawStatus && rawStatus !== "all" ? rawStatus : undefined) as BetaFeedbackStatus | undefined;
      const category = interaction.options.getString("category") as BetaFeedbackCategory | undefined;
      const limit = interaction.options.getInteger("limit") || 10;

      const feedback = await getRecentBetaFeedback(guildId, { status: filterStatus, category, limit });

      if (feedback.length === 0) {
        await interaction.reply({
          content: "📋 No beta feedback records match your specified filter.",
          ephemeral: true,
        });
        return;
      }

      const statusBadges: Record<string, string> = {
        open: "🟡 Open",
        investigating: "🔍 Investigating",
        resolved: "✅ Resolved",
        declined: "❌ Declined",
      };

      const items = feedback.map((item, idx) => {
        const badge = statusBadges[item.status || "open"] || "⚪";
        const cat = item.category ? `\`[${item.category.toUpperCase()}]\`` : "";
        const snippet = item.content.slice(0, 120) + (item.content.length > 120 ? "…" : "");
        return `**${idx + 1}. \`${item.id}\`** — ${badge} ${cat} by <@${item.authorId}>\n> ${snippet}`;
      }).join("\n\n");

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🧪 Beta Feedback Triage Queue")
        .setDescription(items.slice(0, 4_000))
        .setFooter({ text: "Use /beta feedback-view id:<id> to inspect or /beta feedback-triage to update" })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // ── /beta feedback-view ─────────────────────────────────────────────────
    if (subcommand === "feedback-view") {
      if (!await requireManager()) return;
      const id = interaction.options.getString("id", true).trim().toUpperCase();
      const record = await getBetaFeedbackById(id);

      if (!record) {
        await interaction.reply({ content: `❌ No feedback record found matching ID \`${id}\`.`, ephemeral: true });
        return;
      }

      const statusMap: Record<string, string> = {
        open: "🟡 Open / Under Review",
        investigating: "🔍 Investigating / Working",
        resolved: "✅ Resolved / Shipped",
        declined: "❌ Declined",
      };

      const embed = new EmbedBuilder()
        .setColor(record.status === "resolved" ? 0x57F287 : record.status === "declined" ? 0xED4245 : 0x5865F2)
        .setTitle(`🧪 Beta Feedback Record: ${record.id}`)
        .addFields(
          { name: "Author", value: `<@${record.authorId}> (\`${record.authorId}\`)`, inline: true },
          { name: "Category", value: `\`${record.category || "bug"}\``, inline: true },
          { name: "Severity", value: `\`${record.severity || "medium"}\``, inline: true },
          { name: "Status", value: statusMap[record.status || "open"] || record.status, inline: true },
          { name: "Submitted", value: `<t:${Math.floor(new Date(record.createdAt).getTime() / 1000)}:R>`, inline: true },
          { name: "Feedback Details", value: `\`\`\`text\n${record.content}\n\`\`\``, inline: false },
        );

      if (record.staffNote) {
        embed.addFields({
          name: `Staff Notes (by <@${record.resolvedBy || "Staff"}>)`,
          value: `> ${record.staffNote}`,
          inline: false,
        });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // ── /beta feedback-triage ───────────────────────────────────────────────
    if (subcommand === "feedback-triage") {
      if (!await requireManager()) return;
      const id = interaction.options.getString("id", true).trim().toUpperCase();
      const status = interaction.options.getString("status", true) as BetaFeedbackStatus;
      const note = interaction.options.getString("note") || undefined;

      const updated = await updateFeedbackStatus(id, status, interaction.user.id, note);
      if (!updated) {
        await interaction.reply({ content: `❌ No feedback record found matching ID \`${id}\`.`, ephemeral: true });
        return;
      }

      await interaction.reply({
        content: `✅ Updated feedback ticket \`${id}\` to **${status.toUpperCase()}**${note ? ` with note: *"${note}"*` : ""}.`,
        ephemeral: true,
      });

      await sendGuildLog(interaction.client, guildId, {
        title: `🧪 Beta Ticket Triaged [${id}]`,
        color: status === "resolved" ? 0x57F287 : 0x5865F2,
        description: `**Ticket:** \`${id}\`\n**New Status:** ${status.toUpperCase()}\n**Triaged by:** ${interaction.user.tag}\n${note ? `**Notes:** ${note}` : ""}`,
      });
      return;
    }

    // ── /beta profile ───────────────────────────────────────────────────────
    if (subcommand === "profile") {
      const targetUser = interaction.options.getUser("user") || interaction.user;
      const stats = await getTesterStats(targetUser.id);
      const isTester = (await getBetaProgram(guildId)).testerIds.includes(targetUser.id);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🧪 Beta Contributor Profile: ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: "Roster Status", value: isTester ? "✅ Enrolled Tester" : "⚪ Community Contributor", inline: true },
          { name: "Feedback Submitted", value: `**${stats.totalSubmitted}**`, inline: true },
          { name: "Resolved Contributions", value: `**${stats.resolved}**`, inline: true },
          { name: "Bugs Identified", value: `**${stats.bugs}**`, inline: true },
          { name: "🎖️ Tester Honors & Badges", value: stats.badges.map(b => `• ${b}`).join("\n"), inline: false },
        )
        .setFooter({ text: "Submit feedback with /beta feedback to climb the contributor ranks!" })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // ── /beta leaderboard ───────────────────────────────────────────────────
    if (subcommand === "leaderboard") {
      const limit = interaction.options.getInteger("limit") || 10;
      const leaders = await getBetaLeaderboard(limit);

      if (leaders.length === 0) {
        await interaction.reply({ content: "🏆 No beta contributors recorded yet.", ephemeral: true });
        return;
      }

      const rows = leaders.map((l, idx) => {
        const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `**#${idx + 1}**`;
        return `${medal} <@${l.userId}> — **${l.count}** submissions (${l.resolved} resolved)`;
      }).join("\n");

      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle("🏆 Aegis Beta Contributor Leaderboard")
        .setDescription(rows)
        .setFooter({ text: "Top community members helping stress-test and improve Aegis" })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // ── /beta guild-enroll & guild-unenroll ─────────────────────────────────
    if (subcommand === "guild-enroll" || subcommand === "guild-unenroll") {
      if (!await requireBotOwner()) return;
      const targetGuildId = interaction.options.getString("guild_id", true).trim();
      const isEnroll = subcommand === "guild-enroll";

      const program = isEnroll
        ? await enrollGuild(targetGuildId, interaction.user.id)
        : await unenrollGuild(targetGuildId, interaction.user.id);

      await interaction.reply({
        content: `${isEnroll ? "✅ Enrolled" : "🗑️ Removed"} guild \`${targetGuildId}\` ${isEnroll ? "into" : "from"} the managed beta program. Authorized guilds: **${program.enrolledGuilds.length}**.`,
        ephemeral: true,
      });
      return;
    }
  },
};

export default command;
