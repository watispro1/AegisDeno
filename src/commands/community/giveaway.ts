import { logger } from "../../utils/logger";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  TextChannel,
  MessageFlags,
  Client,
} from "discord.js";
import { Command } from "../../types/discord";
import { isSendableChannel } from "../../utils/channels";
import { sendGuildLog } from "../../services/logging";
import { GiveawayModel } from "../../database/mongo";
import { MAX_TIMEOUT_MS } from "../../services/timedActions";
import { pickWeightedWinners } from "../../services/communityLogic";

const giveawayTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

interface DrawableGiveaway {
  entrants?: string[] | null;
  boosterEntrants?: string[] | null;
  boosterMultiplier?: number | null;
  winners?: string[] | null;
  previousWinners?: string[] | null;
}

/** Draw winners, giving boosters their bonus tickets. `excludePast` is used on reroll. */
function drawWinners(giveaway: DrawableGiveaway, count: number, excludePast = false): string[] {
  return pickWeightedWinners(giveaway.entrants ?? [], count, {
    boosterIds: giveaway.boosterEntrants ?? [],
    multiplier: giveaway.boosterMultiplier ?? 1,
    exclude: excludePast ? [...(giveaway.winners ?? []), ...(giveaway.previousWinners ?? [])] : [],
  });
}

function rerollRow(disabled = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("giveaway_reroll")
      .setLabel("Reroll")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🔄")
      .setDisabled(disabled),
  );
}

function scheduleGiveawayEnd(client: Client, guildId: string, messageId: string, endsAt: Date): void {
  if (giveawayTimers.has(messageId)) return;
  const delay = Math.max(0, endsAt.getTime() - Date.now());
  const handle = setTimeout(async () => {
    giveawayTimers.delete(messageId);
    if (delay > MAX_TIMEOUT_MS) {
      scheduleGiveawayEnd(client, guildId, messageId, endsAt);
      return;
    }
    try {
      await endGiveaway(client, guildId, messageId);
    } catch (error) {
      logger.error(`Auto-end giveaway ${messageId} failed`, error);
    }
  }, Math.min(delay, MAX_TIMEOUT_MS));
  giveawayTimers.set(messageId, handle);
}

/** Restore active giveaway timers after a bot restart. */
export async function initGiveawayScheduler(client: Client): Promise<void> {
  const active = await GiveawayModel.find({ ended: false }).lean();
  for (const giveaway of active) {
    scheduleGiveawayEnd(client, giveaway.guildId, giveaway.messageId, new Date(giveaway.endsAt));
  }
  logger.info(`Giveaway scheduler initialised: ${active.length} active giveaway(s).`);
}

/** Process persistent giveaway controls after the originating command has finished. */
export async function handleGiveawayButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guildId || !interaction.guild) return;

  if (interaction.customId === "giveaway_reroll") {
    const ended = await GiveawayModel.findOne({
      guildId: interaction.guildId,
      messageId: interaction.message.id,
      ended: true,
    }).lean();
    if (!ended) {
      await interaction.reply({ content: "❌ This giveaway is still running or no longer exists.", flags: MessageFlags.Ephemeral });
      return;
    }
    const canReroll = interaction.user.id === ended.hostId
      || interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
    if (!canReroll) {
      await interaction.reply({ content: "❌ Only the host or a moderator with **Manage Server** can reroll.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await rerollGiveaway(interaction.client, interaction.guildId, interaction.message.id, null, interaction.user.tag);
    await interaction.editReply(result.ok
      ? `✅ Rerolled! New winners: ${result.winners!.map(w => `<@${w}>`).join(", ") || "No eligible entrants left."}`
      : `❌ ${result.error}`);
    return;
  }

  const giveaway = await GiveawayModel.findOne({
    guildId: interaction.guildId,
    messageId: interaction.message.id,
    ended: false,
  }).lean();

  if (!giveaway) {
    await interaction.reply({ content: "❌ This giveaway has ended or is no longer available.", flags: MessageFlags.Ephemeral });
    return;
  }

  if (interaction.customId === "giveaway_entrants") {
    await interaction.reply({
      content: `👥 **${giveaway.entrants?.length ?? 0}** member(s) have entered this giveaway.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.customId !== "giveaway_enter") return;

  const multiplier = giveaway.boosterMultiplier ?? 1;
  const needMember = Boolean(giveaway.requiredRoleId) || multiplier > 1;
  const member = needMember
    ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
    : null;

  if (giveaway.requiredRoleId && !member?.roles.cache.has(giveaway.requiredRoleId)) {
    await interaction.reply({ content: "❌ You do not have the required role for this giveaway.", flags: MessageFlags.Ephemeral });
    return;
  }

  const isBooster = multiplier > 1 && Boolean(member?.premiumSince);
  const updated = await GiveawayModel.findOneAndUpdate(
    { guildId: interaction.guildId, messageId: interaction.message.id, ended: false },
    {
      $addToSet: isBooster
        ? { entrants: interaction.user.id, boosterEntrants: interaction.user.id }
        : { entrants: interaction.user.id },
    },
    { new: true },
  ).lean();
  if (!updated) {
    await interaction.reply({ content: "❌ This giveaway just ended. Better luck next time!", flags: MessageFlags.Ephemeral });
    return;
  }

  const alreadyEntered = (giveaway.entrants ?? []).includes(interaction.user.id);
  await interaction.reply({
    content: alreadyEntered
      ? "ℹ️ You are already entered in this giveaway."
      : isBooster
        ? `✅ You are entered with **${multiplier}×** entries as a server booster! Good luck!`
        : "✅ You are entered! Good luck!",
    flags: MessageFlags.Ephemeral,
  });

  const embed = interaction.message.embeds[0];
  if (embed) {
    const refreshed = EmbedBuilder.from(embed).spliceFields(3, 1, {
      name: "📊 Entries",
      value: `**${updated.entrants.length}** entered`,
      inline: true,
    });
    await interaction.message.edit({ embeds: [refreshed] }).catch(() => null);
  }
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
        .addIntegerOption(opt =>
          opt.setName("booster_multiplier").setDescription("Entries each server booster gets (default 1 = no bonus)").setMinValue(1).setMaxValue(10).setRequired(false)
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
      const boosterMult = interaction.options.getInteger("booster_multiplier") ?? 1;

      const durationSec = parseDuration(durationRaw);
      if (!durationSec || durationSec < 10) {
        return interaction.reply({ content: "❌ Invalid duration. Use formats like `30m`, `2h`, `1d`. Minimum is 10 seconds.", flags: MessageFlags.Ephemeral });
      }
      if (durationSec > 86400 * 30) {
        return interaction.reply({ content: "❌ Giveaway duration cannot exceed 30 days.", flags: MessageFlags.Ephemeral });
      }

      if (!isSendableChannel(targetChan)) {
        return interaction.reply({ content: "❌ Cannot send messages in that channel.", flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const endsAt = new Date(Date.now() + durationSec * 1000);
      const endsTs = Math.floor(endsAt.getTime() / 1000);

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle(`🎉 GIVEAWAY — ${prize}`)
        .setDescription(
          `${description ? `${description}\n\n` : ""}` +
          `Click **🎉 Enter Giveaway** below to participate!\n\n` +
          `${reqRole ? `> ⚠️ **Required Role:** <@&${reqRole.id}>\n` : ""}` +
          `${boosterMult > 1 ? `> 🚀 **Server boosters** get **${boosterMult}×** entries\n` : ""}` +
          `${reqRole || boosterMult > 1 ? "\n" : ""}` +
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

      const gMsg = await targetChan.send({ embeds: [embed], components: [row] });

      // Save to DB
      await GiveawayModel.create({
        guildId,
        channelId: targetChan.id,
        messageId: gMsg.id,
        prize,
        description,
        winnerCount,
        requiredRoleId: reqRole?.id ?? null,
        boosterMultiplier: boosterMult,
        hostId: interaction.user.id,
        entrants: [],
        endsAt,
        ended: false,
      });

      await interaction.editReply(`✅ Giveaway started in <#${targetChan.id}>! Ends <t:${endsTs}:R>.`);

      await sendGuildLog(interaction.client, guildId, {
        title: "🎉 Giveaway Started",
        color: 0xF1C40F,
        description: `**Prize:** ${prize}\n**Duration:** ${fmtDuration(durationSec)}\n**Winners:** ${winnerCount}\n${boosterMult > 1 ? `**Booster bonus:** ${boosterMult}×\n` : ""}**Host:** ${interaction.user.tag}\n**Channel:** <#${targetChan.id}>`,
      });

      // Auto-end after duration
      scheduleGiveawayEnd(interaction.client, guildId, gMsg.id, endsAt);

      return;
    }

    // ── /giveaway end ─────────────────────────────────────────────────────
    if (sub === "end") {
      const messageId = interaction.options.getString("message_id", true);
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const result = await rerollGiveaway(interaction.client, guildId, messageId, rerollCount, interaction.user.tag);
      if (!result.ok) {
        await interaction.editReply(`❌ ${result.error}`);
        return;
      }
      await interaction.editReply(`✅ Rerolled! New winners: ${result.winners!.map(w => `<@${w}>`).join(", ") || "No eligible entrants left."}`);
      return;
    }

    // ── /giveaway list ─────────────────────────────────────────────────────
    if (sub === "list") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
  client: Client,
  guildId: string,
  messageId: string,
): Promise<{ ok: boolean; winners?: string[]; error?: string }> {
  const timer = giveawayTimers.get(messageId);
  if (timer) clearTimeout(timer);
  giveawayTimers.delete(messageId);
  const giveaway = await GiveawayModel.findOneAndUpdate(
    { guildId, messageId, ended: false },
    { $set: { ended: true, endedAt: new Date() } },
    { new: false },
  ).lean();
  if (!giveaway) return { ok: false, error: "No active giveaway found with that message ID." };

  const winners = drawWinners(giveaway, giveaway.winnerCount ?? 1);

  await GiveawayModel.updateOne({ guildId, messageId }, { $set: { winners } });

  const channel = (client.channels.cache.get(giveaway.channelId)
    ?? await client.channels.fetch(giveaway.channelId).catch(() => null)) as TextChannel | null;
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
      .setFooter({ text: "The host or a moderator can press Reroll to pick new winners" })
      .setTimestamp();

    try {
      const msg = await channel.messages.fetch(messageId).catch(() => null);
      if (msg) {
        await msg.edit({ embeds: [endedEmbed], components: [rerollRow()] });
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

// ─── Shared reroll logic ──────────────────────────────────────────────────────

/**
 * Pick new winners for an ended giveaway, skipping everyone who already won it.
 * Used by `/giveaway reroll` and the Reroll button.
 */
export async function rerollGiveaway(
  client: Client,
  guildId: string,
  messageId: string,
  count: number | null,
  rerolledBy: string,
): Promise<{ ok: boolean; winners?: string[]; error?: string }> {
  const giveaway = await GiveawayModel.findOne({ guildId, messageId, ended: true }).lean();
  if (!giveaway) return { ok: false, error: "No completed giveaway found with that message ID." };

  const winners = drawWinners(giveaway, count ?? giveaway.winnerCount ?? 1, true);
  if (winners.length === 0) {
    return { ok: false, error: "Every entrant has already won this giveaway; there is nobody new to draw." };
  }

  await GiveawayModel.updateOne(
    { guildId, messageId },
    { $set: { winners }, $addToSet: { previousWinners: { $each: giveaway.winners ?? [] } } },
  );

  const channel = (client.channels.cache.get(giveaway.channelId)
    ?? await client.channels.fetch(giveaway.channelId).catch(() => null)) as TextChannel | null;
  if (channel) {
    const winnerMentions = winners.map(w => `<@${w}>`).join(", ");
    await channel.send({
      content: `🎉 **Giveaway Rerolled!**\n\n🏆 New winner${winners.length !== 1 ? "s" : ""}: ${winnerMentions}\n\nPrize: **${giveaway.prize}**`,
    }).catch(err => logger.warn("Could not post giveaway reroll message", err));
  }

  for (const winnerId of winners) {
    const winner = client.users.cache.get(winnerId) ?? await client.users.fetch(winnerId).catch(() => null);
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

  await sendGuildLog(client, guildId, {
    title: "🔄 Giveaway Rerolled",
    color: 0xF1C40F,
    description: `**Prize:** ${giveaway.prize}\n**New Winners:** ${winners.map(w => `<@${w}>`).join(", ")}\n**Rerolled by:** ${rerolledBy}`,
  });

  return { ok: true, winners };
}

export default command;
