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
  TextChannel,
} from "discord.js";
import { Command } from "../../types/discord";
import { sendGuildLog } from "../../services/logging";
import { GiveawayModel } from "../../database/mongo";

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseDuration(raw: string): number | null {
  const match = raw.trim().match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!match) return null;
  const n = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multi: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return n * multi[unit];
}

function fmtDuration(seconds: number): string {
  if (seconds < 60)     return `${seconds}s`;
  if (seconds < 3600)   return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400)  return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

async function pickWinners(entrants: string[], count: number): Promise<string[]> {
  const shuffled = [...entrants].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// ─── Command ─────────────────────────────────────────────────────────────────

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Manage server giveaways with automated winner selection.")
    .addSubcommand(sub =>
      sub
        .setName("start")
        .setDescription("Start a new giveaway.")
        .addStringOption(opt =>
          opt.setName("prize").setDescription("What is the prize?").setRequired(true).setMaxLength(256)
        )
        .addStringOption(opt =>
          opt.setName("duration").setDescription("Duration (e.g. 1h, 30m, 2d)").setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel to host the giveaway (defaults to current)").setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName("winners").setDescription("Number of winners (default: 1)").setMinValue(1).setMaxValue(20).setRequired(false)
        )
        .addRoleOption(opt =>
          opt.setName("required_role").setDescription("Only members with this role can enter").setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName("description").setDescription("Extra description or instructions").setMaxLength(1024).setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("end")
        .setDescription("End a giveaway early and draw winners.")
        .addStringOption(opt =>
          opt.setName("message_id").setDescription("Message ID of the giveaway to end").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("reroll")
        .setDescription("Reroll a completed giveaway to pick new winners.")
        .addStringOption(opt =>
          opt.setName("message_id").setDescription("Message ID of the completed giveaway").setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName("winners").setDescription("Number of winners to reroll (default: same as original)").setMinValue(1).setMaxValue(20).setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription("List all active giveaways in this server.")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageGuild],
  botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    // ── /giveaway start ────────────────────────────────────────────────────
    if (sub === "start") {
      const prize       = interaction.options.getString("prize", true);
      const durationRaw = interaction.options.getString("duration", true);
      const winnerCount = interaction.options.getInteger("winners") ?? 1;
      const reqRole     = interaction.options.getRole("required_role");
      const description = interaction.options.getString("description") ?? null;
      const targetChan  = interaction.options.getChannel("channel") ?? interaction.channel;

      const durationSec = parseDuration(durationRaw);
      if (!durationSec || durationSec < 10) {
        return interaction.reply({ content: "❌ Invalid duration. Use formats like `30m`, `2h`, `1d`. Minimum is 10 seconds.", ephemeral: true });
      }
      if (durationSec > 86400 * 30) {
        return interaction.reply({ content: "❌ Giveaway duration cannot exceed 30 days.", ephemeral: true });
      }

      if (!targetChan || !("send" in targetChan) || typeof (targetChan as any).send !== "function") {
        return interaction.reply({ content: "❌ Cannot send messages in that channel.", ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      const endsAt = new Date(Date.now() + durationSec * 1000);
      const endsTs = Math.floor(endsAt.getTime() / 1000);

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle(`🎉 GIVEAWAY — ${prize}`)
        .setDescription(
          `${description ? `${description}\n\n` : ""}` +
          `Click **🎉 Enter Giveaway** below to participate!\n\n` +
          `${reqRole ? `> ⚠️ **Required Role:** <@&${reqRole.id}>\n\n` : ""}` +
          `**Ends:** <t:${endsTs}:R> (<t:${endsTs}:f>)`
        )
        .addFields(
          { name: "🏆 Prize",   value: prize, inline: true },
          { name: "🎟️ Winners", value: `**${winnerCount}**`, inline: true },
          { name: "👤 Host",    value: `<@${interaction.user.id}>`, inline: true },
          { name: "📊 Entries", value: "**0** entered", inline: true },
        )
        .setFooter({ text: `Giveaway hosted by ${interaction.user.tag}` })
        .setTimestamp(endsAt);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("giveaway_enter")
          .setLabel("Enter Giveaway")
          .setStyle(ButtonStyle.Success)
          .setEmoji("🎉"),
        new ButtonBuilder()
          .setCustomId("giveaway_entrants")
          .setLabel("View Entries")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("👥"),
      );

      const gMsg = await (targetChan as TextChannel).send({ embeds: [embed], components: [row] });

      // Save to DB
      await GiveawayModel.create({
        guildId,
        channelId: targetChan.id,
        messageId: gMsg.id,
        prize,
        description,
        winnerCount,
        requiredRoleId: reqRole?.id ?? null,
        hostId: interaction.user.id,
        entrants: [],
        endsAt,
        ended: false,
      });

      await interaction.editReply(`✅ Giveaway started in <#${targetChan.id}>! Ends <t:${endsTs}:R>.`);

      await sendGuildLog(interaction.client, guildId, {
        title: "🎉 Giveaway Started",
        color: 0xF1C40F,
        description: `**Prize:** ${prize}\n**Duration:** ${fmtDuration(durationSec)}\n**Winners:** ${winnerCount}\n**Host:** ${interaction.user.tag}\n**Channel:** <#${targetChan.id}>`,
      });

      // Auto-end after duration
      setTimeout(async () => {
        try {
          await endGiveaway(interaction.client, guildId, gMsg.id);
        } catch (e) {
          logger.error(`Auto-end giveaway ${gMsg.id} failed`, e);
        }
      }, durationSec * 1000);

      return;
    }

    // ── /giveaway end ─────────────────────────────────────────────────────
    if (sub === "end") {
      const messageId = interaction.options.getString("message_id", true);
      await interaction.deferReply({ ephemeral: true });
      const result = await endGiveaway(interaction.client, guildId, messageId);
      if (!result.ok) {
        await interaction.editReply(`❌ ${result.error}`);
        return;
      }
      await interaction.editReply(`✅ Giveaway ended. Winners: ${result.winners?.map(w => `<@${w}>`).join(", ") ?? "None"}`);
      return;
    }

    // ── /giveaway reroll ───────────────────────────────────────────────────
    if (sub === "reroll") {
      const messageId   = interaction.options.getString("message_id", true);
      const rerollCount = interaction.options.getInteger("winners") ?? null;
      await interaction.deferReply({ ephemeral: true });

      const giveaway = await GiveawayModel.findOne({ guildId, messageId, ended: true }).lean() as any;
      if (!giveaway) {
        await interaction.editReply("❌ No completed giveaway found with that message ID.");
        return;
      }

      const count = rerollCount ?? giveaway.winnerCount ?? 1;
      const winners = await pickWinners(giveaway.entrants ?? [], count);

      const channel = interaction.client.channels.cache.get(giveaway.channelId) as TextChannel | null;
      if (channel) {
        const winnerMentions = winners.length > 0
          ? winners.map(w => `<@${w}>`).join(", ")
          : "No eligible entrants.";
        await channel.send({
          content: `🎉 **Giveaway Rerolled!**\n\n🏆 New winner${winners.length !== 1 ? "s" : ""}: ${winnerMentions}\n\nPrize: **${giveaway.prize}**`,
        });
      }

      // DM new winners
      for (const winnerId of winners) {
        const winner = interaction.client.users.cache.get(winnerId) ?? await interaction.client.users.fetch(winnerId).catch(() => null);
        if (winner) {
          await winner.send({
            embeds: [new EmbedBuilder()
              .setColor(0xF1C40F)
              .setTitle("🎉 You've been rerolled as a Giveaway Winner!")
              .addFields({ name: "🏆 Prize", value: giveaway.prize })
              .setTimestamp()],
          }).catch(() => null);
        }
      }

      await sendGuildLog(interaction.client, guildId, {
        title: "🔄 Giveaway Rerolled",
        color: 0xF1C40F,
        description: `**Prize:** ${giveaway.prize}\n**New Winners:** ${winners.map(w => `<@${w}>`).join(", ") || "None"}\n**Rerolled by:** ${interaction.user.tag}`,
      });

      await interaction.editReply(`✅ Rerolled! New winners: ${winners.map(w => `<@${w}>`).join(", ") || "No entrants to reroll."}`);
      return;
    }

    // ── /giveaway list ─────────────────────────────────────────────────────
    if (sub === "list") {
      await interaction.deferReply({ ephemeral: true });
      const active = await GiveawayModel.find({ guildId, ended: false }).sort({ endsAt: 1 }).limit(10).lean();
      if (active.length === 0) {
        await interaction.editReply("ℹ️ No active giveaways in this server.");
        return;
      }
      const lines = active.map((g: any, i: number) => {
        const ts = Math.floor(new Date(g.endsAt).getTime() / 1000);
        return `**${i + 1}.** 🏆 **${g.prize}** — ${g.winnerCount} winner(s) — ends <t:${ts}:R> — [Jump](https://discord.com/channels/${guildId}/${g.channelId}/${g.messageId})`;
      });
      await interaction.editReply(`🎉 **Active Giveaways (${active.length}):**\n\n${lines.join("\n")}`);
      return;
    }
  },
};

// ─── Shared end logic ─────────────────────────────────────────────────────────

async function endGiveaway(
  client: any,
  guildId: string,
  messageId: string,
): Promise<{ ok: boolean; winners?: string[]; error?: string }> {
  const giveaway = await GiveawayModel.findOne({ guildId, messageId }).lean() as any;
  if (!giveaway) return { ok: false, error: "No giveaway found with that message ID." };
  if (giveaway.ended) return { ok: false, error: "That giveaway has already ended." };

  const winners = await pickWinners(giveaway.entrants ?? [], giveaway.winnerCount ?? 1);

  await GiveawayModel.updateOne(
    { guildId, messageId },
    { $set: { ended: true, winners, endedAt: new Date() } },
  );

  const channel = client.channels.cache.get(giveaway.channelId) as TextChannel | null;
  if (channel) {
    const winnerMentions = winners.length > 0
      ? winners.map((w: string) => `<@${w}>`).join(", ")
      : "No eligible entrants.";

    const endedEmbed = new EmbedBuilder()
      .setColor(0xBDC3C7)
      .setTitle(`🎉 GIVEAWAY ENDED — ${giveaway.prize}`)
      .setDescription(
        `**Winner${winners.length !== 1 ? "s" : ""}:** ${winnerMentions}\n\n` +
        `**Total Entries:** ${giveaway.entrants?.length ?? 0}`
      )
      .addFields(
        { name: "🏆 Prize", value: giveaway.prize, inline: true },
        { name: "👤 Host",  value: `<@${giveaway.hostId}>`, inline: true },
      )
      .setFooter({ text: "Use /giveaway reroll to pick new winners" })
      .setTimestamp();

    try {
      const msg = await channel.messages.fetch(messageId).catch(() => null);
      if (msg) {
        await msg.edit({ embeds: [endedEmbed], components: [] });
      }
      await channel.send({
        content: `🎉 **Giveaway Ended!** Congratulations to ${winnerMentions}!\n\nPrize: **${giveaway.prize}**`,
      });
    } catch (e) {
      logger.warn("Could not edit or send giveaway end message", e);
    }

    // DM winners
    for (const winnerId of winners) {
      const winner = client.users.cache.get(winnerId) ?? await client.users.fetch(winnerId).catch(() => null);
      if (winner) {
        await winner.send({
          embeds: [new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle("🎉 Congratulations! You won a Giveaway!")
            .setDescription(`You were selected as a winner!`)
            .addFields(
              { name: "🏆 Prize", value: giveaway.prize },
            )
            .setFooter({ text: "Contact the host to claim your prize." })
            .setTimestamp()],
        }).catch(() => null);
      }
    }
  }

  return { ok: true, winners };
}

export default command;
