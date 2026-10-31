import { logger } from "../../utils/logger";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  MessageFlags,
} from "discord.js";
import { scopedModalId } from "../../utils/modal";
import { Command } from "../../types/discord";
import { BanAppealModel } from "../../database/mongo";
import { APPEAL_STATUS_LABELS, reviewBanAppeal } from "../../services/appeals";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generates a random alphanumeric appeal code, e.g. "AGS-K7X2". */
export function generateAppealCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `AGS-${code}`;
}

const STATUS_LABELS: Record<string, { emoji: string; color: number; label: string }> = APPEAL_STATUS_LABELS;

// ─── Command ─────────────────────────────────────────────────────────────────

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("appeal")
    .setDescription("Manage ban appeals. Banned users receive an appeal code via DM.")
    .addSubcommand(sub =>
      sub.setName("list")
        .setDescription("View all pending ban appeals for this server")
        .addStringOption(o =>
          o.setName("status")
            .setDescription("Filter by status (default: pending)")
            .addChoices(
              { name: "⏳ Pending",  value: "pending" },
              { name: "✅ Approved", value: "approved" },
              { name: "❌ Denied",   value: "denied" },
              { name: "💤 Expired",  value: "expired" },
              { name: "📋 All",      value: "all" },
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName("view")
        .setDescription("View a specific appeal by its code")
        .addStringOption(o =>
          o.setName("code").setDescription("Appeal code (e.g. AGS-K7X2)").setRequired(true).setMinLength(8).setMaxLength(8)
        )
    )
    .addSubcommand(sub =>
      sub.setName("review")
        .setDescription("Approve or deny a ban appeal by its code")
        .addStringOption(o =>
          o.setName("code").setDescription("Appeal code (e.g. AGS-K7X2)").setRequired(true).setMinLength(8).setMaxLength(8)
        )
        .addStringOption(o =>
          o.setName("decision")
            .setDescription("Approve or deny this appeal")
            .setRequired(true)
            .addChoices(
              { name: "✅ Approve — unban the member", value: "approved" },
              { name: "❌ Deny — keep the ban",        value: "denied" },
            )
        )
        .addStringOption(o =>
          o.setName("note").setDescription("Staff note shown to the appellant").setMaxLength(512)
        )
    )
    .addSubcommand(sub =>
      sub.setName("submit")
        .setDescription("Submit an appeal text for your pending ban appeal (use your appeal code)")
        .addStringOption(o =>
          o.setName("code").setDescription("Your appeal code (e.g. AGS-K7X2)").setRequired(true).setMinLength(8).setMaxLength(8)
        )
    ),

  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    // Enforce BanMembers permission on staff triage subcommands
    if (sub === "list" || sub === "view" || sub === "review") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
        await interaction.reply({
          content: "❌ You need the **Ban Members** permission to access ban appeal management.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    // ── LIST ───────────────────────────────────────────────────────────────
    if (sub === "list") {
      const statusFilter = interaction.options.getString("status") ?? "pending";
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const query: Record<string, any> = statusFilter === "all" ? { guildId } : { guildId, status: statusFilter };
      const appeals = await BanAppealModel.find(query).sort({ createdAt: -1 }).limit(15).lean();

      if (appeals.length === 0) {
        await interaction.editReply(`📭 No ${statusFilter === "all" ? "" : statusFilter + " "}appeals found.`);
        return;
      }

      const lines = await Promise.all(
        appeals.map(async (a: any, idx: number) => {
          const s = STATUS_LABELS[a.status] ?? STATUS_LABELS.pending;
          let userTag = `<@${a.userId}>`;
          const cachedUser = interaction.client.users.cache.get(a.userId);
          if (cachedUser) {
            userTag = cachedUser.tag;
          } else {
            try {
              const u = await interaction.client.users.fetch(a.userId);
              userTag = u.tag;
            } catch { /* left Discord */ }
          }
          const date = `<t:${Math.floor(new Date(a.createdAt).getTime() / 1000)}:R>`;
          return `**${idx + 1}.** ${s.emoji} \`${a.appealCode}\` — **${userTag}** — ${date}`;
        })
      );

      const statusInfo = STATUS_LABELS[statusFilter] ?? { emoji: "📋", label: "All", color: 0x5865F2 };
      const embed = new EmbedBuilder()
        .setColor(statusInfo.color)
        .setTitle(`${statusInfo.emoji} Ban Appeals — ${statusInfo.label}`)
        .setDescription(lines.join("\n"))
        .setFooter({ text: `Showing up to 15 most recent · Use /appeal view <code> for details` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }

    // ── VIEW ───────────────────────────────────────────────────────────────
    else if (sub === "view") {
      const code = interaction.options.getString("code", true).toUpperCase();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const appeal = await BanAppealModel.findOne({ appealCode: code, guildId }) as any;
      if (!appeal) {
        await interaction.editReply(`❌ No appeal found with code \`${code}\` in this server.`);
        return;
      }

      const s = STATUS_LABELS[appeal.status] ?? STATUS_LABELS.pending;
      let userTag  = `<@${appeal.userId}>`;
      let modTag   = `<@${appeal.moderatorId}>`;

      const cachedAppellant = interaction.client.users.cache.get(appeal.userId);
      if (cachedAppellant) {
        userTag = cachedAppellant.tag;
      } else {
        try { const u = await interaction.client.users.fetch(appeal.userId); userTag = u.tag; } catch { /**/ }
      }

      const cachedMod = interaction.client.users.cache.get(appeal.moderatorId);
      if (cachedMod) {
        modTag = cachedMod.tag;
      } else {
        try { const m = await interaction.client.users.fetch(appeal.moderatorId); modTag = m.tag; } catch { /**/ }
      }

      const embed = new EmbedBuilder()
        .setColor(s.color)
        .setTitle(`${s.emoji} Appeal \`${code}\` — ${s.label}`)
        .addFields(
          { name: "👤 Appellant",      value: `${userTag} (<@${appeal.userId}>)`, inline: true },
          { name: "🔨 Banned By",      value: `${modTag}`, inline: true },
          { name: "📅 Appeal Filed",   value: `<t:${Math.floor(new Date(appeal.createdAt).getTime() / 1000)}:R>`, inline: true },
          { name: "📋 Original Reason", value: appeal.banReason, inline: false },
          { name: "📝 Appeal Text",    value: appeal.appealText ?? "*Not yet submitted*", inline: false },
        )
        .setTimestamp();

      if (appeal.reviewedAt) {
        embed.addFields(
          { name: "🧑‍⚖️ Reviewed By", value: `<@${appeal.reviewedBy}>`, inline: true },
          { name: "📅 Reviewed",      value: `<t:${Math.floor(new Date(appeal.reviewedAt).getTime() / 1000)}:R>`, inline: true },
          { name: "💬 Staff Note",    value: appeal.reviewNote ?? "None", inline: false },
        );
      }

      await interaction.editReply({ embeds: [embed] });
    }

    // ── REVIEW ─────────────────────────────────────────────────────────────
    else if (sub === "review") {
      const code     = interaction.options.getString("code", true).toUpperCase();
      const decision = interaction.options.getString("decision", true) as "approved" | "denied";
      const note     = interaction.options.getString("note") ?? null;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const result = await reviewBanAppeal(interaction.client, guildId, code, decision, note, {
        id: interaction.user.id,
        tag: interaction.user.tag,
      });
      if (!result.ok) {
        await interaction.editReply(
          result.reason === "not_found"
            ? `❌ No appeal found with code \`${code}\` in this server.`
            : `❌ Appeal \`${code}\` is already **${result.status}** — cannot review again.`,
        );
        return;
      }

      const s = STATUS_LABELS[decision];
      const unbanResult =
        result.unban === "done"
          ? "\n✅ The member has been **automatically unbanned**."
          : result.unban === "failed"
            ? "\n⚠️ Could not automatically unban the user — they may need to be unbanned manually."
            : "";

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(s.color)
            .setTitle(`${s.emoji} Appeal ${s.label}`)
            .setDescription(`Appeal \`${code}\` has been marked as **${s.label}**.${unbanResult}`)
            .addFields(
              note ? [{ name: "💬 Your Note", value: note, inline: false }] : []
            )
            .setTimestamp(),
        ],
      });
    }

    // ── SUBMIT ─────────────────────────────────────────────────────────────
    else if (sub === "submit") {
      const code = interaction.options.getString("code", true).toUpperCase();
      // Find appeal — must be for this user (no guildId check needed — the user was banned so they're outside)
      const appeal = (await BanAppealModel.findOne({ appealCode: code, userId: interaction.user.id })) as any;

      if (!appeal) {
        await interaction.reply({
          content: `❌ No pending appeal found for code \`${code}\` under your account.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (appeal.status !== "pending") {
        await interaction.reply({
          content: `❌ Appeal \`${code}\` is already **${appeal.status}** and can no longer be edited.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Show a modal for the appeal text
      const modal = new ModalBuilder()
        .setCustomId(scopedModalId(`appeal_modal_${code}`, interaction.id))
        .setTitle("Submit Your Ban Appeal");

      const appealInput = new TextInputBuilder()
        .setCustomId("appeal_text")
        .setLabel("Why should your ban be lifted?")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Explain what happened and why you believe the ban should be reconsidered...")
        .setMinLength(30)
        .setMaxLength(1000)
        .setRequired(true);

      if (appeal.appealText) {
        appealInput.setValue(appeal.appealText);
      }

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(appealInput));
      await interaction.showModal(modal);

      // Wait for modal submission
      try {
        const modalSubmit: ModalSubmitInteraction = await interaction.awaitModalSubmit({
          time: 5 * 60_000,
          filter: (i) => i.customId === scopedModalId(`appeal_modal_${code}`, interaction.id) && i.user.id === interaction.user.id,
        });

        const appealText = modalSubmit.fields.getTextInputValue("appeal_text").trim();
        appeal.appealText = appealText;
        await appeal.save();

        await modalSubmit.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle("✅ Appeal Submitted")
              .setDescription(
                `Your appeal (\`${code}\`) has been submitted for staff review.\n` +
                `You will receive a DM when a decision is made.`
              )
              .addFields({ name: "📝 Your Statement", value: appealText })
              .setTimestamp(),
          ],
          flags: MessageFlags.Ephemeral,
        });
      } catch (err) {
        logger.error("Appeal modal submit timeout", err);
      }
    }
  },
};

export default command;
