import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { Command } from "../../types/discord";
import { sendGuildLog } from "../../services/logging";

// ─── Emoji helpers ─────────────────────────────────────────────────────────────

const NUMBER_EMOJIS = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];

function buildBar(votes: number, total: number): string {
  if (total === 0) return "░░░░░░░░░░ 0%";
  const pct = Math.round((votes / total) * 100);
  const filled = Math.round(pct / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled) + ` ${pct}%`;
}

// ─── Command ─────────────────────────────────────────────────────────────────

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create an interactive poll with live vote tracking and results.")
    .addStringOption(opt =>
      opt.setName("question").setDescription("The poll question").setRequired(true).setMaxLength(300)
    )
    .addStringOption(opt => opt.setName("option1").setDescription("Option 1").setRequired(true).setMaxLength(80))
    .addStringOption(opt => opt.setName("option2").setDescription("Option 2").setRequired(true).setMaxLength(80))
    .addStringOption(opt =>
      opt
        .setName("duration")
        .setDescription("Poll duration")
        .setRequired(false)
        .addChoices(
          { name: "10 Minutes",       value: "600" },
          { name: "30 Minutes",       value: "1800" },
          { name: "1 Hour",           value: "3600" },
          { name: "4 Hours",          value: "14400" },
          { name: "8 Hours",          value: "28800" },
          { name: "24 Hours (1 Day)", value: "86400" },
          { name: "3 Days",           value: "259200" },
          { name: "7 Days (1 Week)",  value: "604800" },
          { name: "No Limit",         value: "0" },
        )
    )
    .addStringOption(opt => opt.setName("option3").setDescription("Option 3").setRequired(false).setMaxLength(80))
    .addStringOption(opt => opt.setName("option4").setDescription("Option 4").setRequired(false).setMaxLength(80))
    .addStringOption(opt => opt.setName("option5").setDescription("Option 5").setRequired(false).setMaxLength(80))
    .addStringOption(opt => opt.setName("option6").setDescription("Option 6").setRequired(false).setMaxLength(80))
    .addStringOption(opt => opt.setName("option7").setDescription("Option 7").setRequired(false).setMaxLength(80))
    .addStringOption(opt => opt.setName("option8").setDescription("Option 8").setRequired(false).setMaxLength(80))
    .addStringOption(opt => opt.setName("option9").setDescription("Option 9").setRequired(false).setMaxLength(80))
    .addStringOption(opt => opt.setName("option10").setDescription("Option 10").setRequired(false).setMaxLength(80))
    .addBooleanOption(opt =>
      opt.setName("anonymous").setDescription("Hide who voted from everyone (default: false)").setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName("multiselect").setDescription("Allow users to vote for multiple options (default: false)").setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName("image_url").setDescription("Optional image URL to attach to the poll embed").setMaxLength(512).setRequired(false)
    ),

  botPermissions: [PermissionFlagsBits.SendMessages],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const question   = interaction.options.getString("question", true);
    const durationStr = interaction.options.getString("duration") ?? "3600";
    const durationSec = parseInt(durationStr);
    const multiselect = interaction.options.getBoolean("multiselect") ?? false;
    const anonymous   = interaction.options.getBoolean("anonymous") ?? false;
    const imageUrl    = interaction.options.getString("image_url") ?? null;

    const options: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const opt = interaction.options.getString(`option${i}`);
      if (opt) options.push(opt.trim());
    }

    if (new Set(options.map(o => o.toLowerCase())).size !== options.length) {
      return interaction.reply({ content: "❌ Poll options must be distinct.", ephemeral: true });
    }

    // vote state: optionIndex → Set of userIds
    const votes: Map<number, Set<string>> = new Map(
      options.map((_, i) => [i, new Set<string>()]),
    );

    function totalVotes(): number {
      let t = 0;
      for (const s of votes.values()) t += s.size;
      return t;
    }

    function buildPollEmbed(ended = false): EmbedBuilder {
      const total = totalVotes();
      const endsTs = durationSec > 0 ? Math.floor((Date.now() + durationSec * 1000) / 1000) : null;

      const fields = options.map((opt, i) => {
        const count = votes.get(i)?.size ?? 0;
        return {
          name: `${NUMBER_EMOJIS[i]} ${opt}`,
          value: `\`${buildBar(count, total)}\` — **${count}** vote${count !== 1 ? "s" : ""}`,
          inline: false,
        };
      });

      const embed = new EmbedBuilder()
        .setColor(ended ? 0x99AAB5 : 0x5865F2)
        .setTitle(`${ended ? "🔒" : "📊"} ${question}`)
        .addFields(...fields)
        .setFooter({
          text: [
            `${total} vote${total !== 1 ? "s" : ""} total`,
            multiselect ? "Multi-choice enabled" : null,
            anonymous ? "Anonymous poll" : null,
            ended ? "Poll ended" : endsTs ? `Ends <t:${endsTs}:R>` : "No time limit",
          ].filter(Boolean).join(" • "),
        })
        .setTimestamp();

      if (imageUrl)   embed.setImage(imageUrl);
      if (!ended)     embed.setAuthor({ name: `Poll by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

      return embed;
    }

    function buildVoteRow(disabled = false): ActionRowBuilder<ButtonBuilder>[] {
      // Split options into rows of up to 5
      const rows: ActionRowBuilder<ButtonBuilder>[] = [];
      for (let rowStart = 0; rowStart < options.length; rowStart += 5) {
        const row = new ActionRowBuilder<ButtonBuilder>();
        for (let i = rowStart; i < Math.min(rowStart + 5, options.length); i++) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`poll_vote_${i}`)
              .setLabel(options[i].slice(0, 80))
              .setStyle(ButtonStyle.Primary)
              .setEmoji(NUMBER_EMOJIS[i])
              .setDisabled(disabled),
          );
        }
        rows.push(row);
      }

      // Add end poll button as last row (if moderator)
      const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("poll_end")
          .setLabel("End Poll")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🔒")
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId("poll_results")
          .setLabel("My Votes")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("📋"),
      );
      rows.push(controlRow);

      return rows;
    }

    const sent = await interaction.reply({
      embeds: [buildPollEmbed()],
      components: buildVoteRow(),
      fetchReply: true,
    });

    const timeMs = durationSec > 0 ? durationSec * 1000 : 7 * 24 * 60 * 60 * 1000; // Max 7d if no limit

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: timeMs,
    });

    collector.on("collect", async (i) => {
      // Show personal vote summary
      if (i.customId === "poll_results") {
        const userVotes = options
          .map((opt, idx) => ({ opt, idx }))
          .filter(({ idx }) => votes.get(idx)?.has(i.user.id));

        if (userVotes.length === 0) {
          return i.reply({ content: "📋 You haven't voted yet.", ephemeral: true });
        }
        return i.reply({
          content: `📋 **Your vote${userVotes.length !== 1 ? "s" : ""}:** ${userVotes.map(v => `${NUMBER_EMOJIS[v.idx]} ${v.opt}`).join(", ")}`,
          ephemeral: true,
        });
      }

      // End poll (moderators only)
      if (i.customId === "poll_end") {
        if (!i.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
          return i.reply({ content: "❌ Only moderators can end polls early.", ephemeral: true });
        }
        collector.stop("ended");
        await i.deferUpdate();
        return;
      }

      // Regular vote
      if (i.customId.startsWith("poll_vote_")) {
        const optIdx = parseInt(i.customId.replace("poll_vote_", ""));
        const userId = i.user.id;

        if (!multiselect) {
          // Remove from all other options
          for (const [k, s] of votes) {
            if (k !== optIdx) s.delete(userId);
          }
        }

        const set = votes.get(optIdx)!;
        if (set.has(userId)) {
          // Toggle off
          set.delete(userId);
          await i.reply({ content: `↩️ Removed your vote for **${options[optIdx]}**.`, ephemeral: true });
        } else {
          set.add(userId);
          await i.reply({
            content: anonymous
              ? `✅ Vote recorded.`
              : `✅ Voted for **${NUMBER_EMOJIS[optIdx]} ${options[optIdx]}**.`,
            ephemeral: true,
          });
        }

        // Update live results
        await interaction.editReply({ embeds: [buildPollEmbed()], components: buildVoteRow() });
      }
    });

    collector.on("end", async (_, reason) => {
      // Final results
      const total = totalVotes();
      const winnerIdx = [...votes.entries()].sort((a, b) => b[1].size - a[1].size)[0]?.[0] ?? 0;
      const winnerOpt = options[winnerIdx];

      const finalEmbed = buildPollEmbed(true);
      if (total > 0) {
        finalEmbed.addFields({
          name: "🏆 Winner",
          value: `${NUMBER_EMOJIS[winnerIdx]} **${winnerOpt}** — ${votes.get(winnerIdx)?.size ?? 0} vote(s)`,
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [finalEmbed], components: buildVoteRow(true) }).catch(() => null);

      if (interaction.guildId) {
        await sendGuildLog(interaction.client, interaction.guildId, {
          title: "📊 Poll Ended",
          color: 0x99AAB5,
          description: `**Question:** ${question}\n**Total Votes:** ${total}\n${total > 0 ? `**Winner:** ${winnerOpt}` : "**No votes cast.**"}\n**Host:** ${interaction.user.tag}`,
        });
      }
    });
  },
};

export default command;
