/** Giveaway engine: timers, the Enter button, ending and rerolling (split from commands/community/giveaway.ts). */
import { moduleEnabled, moduleOffMessage } from "../services/moduleSwitches";
import { logger } from "../utils/logger";
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
  ChannelType,
  AutocompleteInteraction,
} from "discord.js";
import { Command } from "../types/discord";
import { isSendableChannel, isObfuscatedChannel } from "../utils/channels";
import { sendGuildLog } from "../services/logging";
import { GiveawayModel } from "../database/mongo";
import { MAX_TIMEOUT_MS } from "../services/timedActions";
import { formatDurationLong, parseFriendlyDuration } from "../utils/duration";
import { DISCORD_LIMITS, truncate } from "../utils/safeText";
import { pickWeightedWinners } from "../services/communityLogic";
import { enterGiveaway, entryConfirmation, giveawayEntryBlock, needsMemberLookup, type GiveawayEntryStore } from "../services/giveawayEntry";
import { notifyWinners } from "./giveawayNotify";
import {
  cancelTransition, endTransition, finalizeEnd, rerollTransition,
  type GiveawayTransitionStore, type TransitionGiveaway, type TransitionResult,
} from "../services/giveawayTransitions";

const giveawayTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Helpers

export const fmtDuration = formatDurationLong;

/** Accept a bare message ID or a pasted message link (…/channels/<guild>/<channel>/<message>). */
export function parseMessageRef(raw: string): string | null {
  const text = String(raw ?? "").trim();
  const link = /^https?:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/channels\/\d{17,20}\/\d{17,20}\/(\d{17,20})\/?$/.exec(text);
  if (link) return link[1];
  return /^\d{17,20}$/.test(text) ? text : null;
}

/** Giveaway embed title, cut to Discord's 256-character limit. */
export function giveawayTitle(prefix: string, prize: string): string {
  return truncate(`${prefix} — ${prize}`, DISCORD_LIMITS.embedTitle);
}

interface DrawableGiveaway {
  entrants?: string[] | null;
  boosterEntrants?: string[] | null;
  boosterMultiplier?: number | null;
  bonusEntrants?: string[] | null;
  bonusEntries?: number | null;
  winners?: string[] | null;
  previousWinners?: string[] | null;
}

/** Draw winners, giving boosters their bonus tickets. `excludePast` is used on reroll. */
function drawWinners(giveaway: DrawableGiveaway, count: number, excludePast = false): string[] {
  return pickWeightedWinners(giveaway.entrants ?? [], count, {
    boosterIds: giveaway.boosterEntrants ?? [],
    multiplier: giveaway.boosterMultiplier ?? 1,
    bonusIds: giveaway.bonusEntrants ?? [],
    bonusEntries: giveaway.bonusEntries ?? 1,
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

export function scheduleGiveawayEnd(client: Client, guildId: string, messageId: string, endsAt: Date): void {
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
  // A restart between claiming an end and storing its winners leaves the
  // giveaway "ending"; finish those so they can be rerolled.
  const halfEnded = await GiveawayModel.find({ ended: true, winnersDrawn: false }).lean();
  for (const giveaway of halfEnded) {
    try {
      const result = await finalizeEnd(giveawayTransitionStore, giveaway as unknown as TransitionGiveaway, drawWinners);
      if (result.ok) await announceEnd(client, result.giveaway, result.winners);
    } catch (error) {
      logger.error(`Finishing half-ended giveaway ${giveaway.messageId} failed`, error);
    }
  }
  logger.info(`Giveaway scheduler initialised: ${active.length} active giveaway(s)${halfEnded.length ? `, ${halfEnded.length} finished after restart` : ""}.`);
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

  // Acknowledge first: the member lookup and the update can take longer than
  // Discord's 3-second window on a busy shard.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const multiplier = giveaway.boosterMultiplier ?? 1;
  const member = needsMemberLookup(giveaway, multiplier)
    ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
    : null;

  const blocked = giveawayEntryBlock(giveaway, {
    hasRequiredRole: Boolean(giveaway.requiredRoleId && member?.roles.cache.has(giveaway.requiredRoleId)),
    accountCreatedAt: interaction.user.createdAt,
    joinedAt: member?.joinedAt ?? null,
  });
  if (blocked) {
    await interaction.editReply({ content: blocked, allowedMentions: { parse: [] } });
    return;
  }

  const isBooster = multiplier > 1 && Boolean(member?.premiumSince);
  const bonusEntries = giveaway.bonusEntries ?? 1;
  const hasBonusRole = Boolean(giveaway.bonusRoleId && bonusEntries > 1 && member?.roles.cache.has(giveaway.bonusRoleId));
  const { outcome, entrantCount } = await enterGiveaway(giveawayEntryStore, {
    guildId: interaction.guildId,
    messageId: interaction.message.id,
    userId: interaction.user.id,
  }, isBooster, hasBonusRole);

  if (outcome === "closed") {
    await interaction.editReply({ content: "❌ This giveaway just ended. Better luck next time!" });
    return;
  }
  await interaction.editReply({
    content: outcome === "already"
      ? "ℹ️ You are already entered in this giveaway."
      : entryConfirmation(
        1 + (isBooster ? multiplier - 1 : 0) + (hasBonusRole ? bonusEntries - 1 : 0),
        [...(isBooster ? [`${multiplier}× as a server booster`] : []), ...(hasBonusRole ? [`${bonusEntries}× from your bonus role`] : [])],
      ),
  });
  if (outcome !== "entered" || entrantCount === null) return;

  const embed = interaction.message.embeds[0];
  if (embed) {
    const fields = embed.fields ?? [];
    const index = fields.findIndex(f => f.name === "📊 Entries");
    const refreshed = EmbedBuilder.from(embed).spliceFields(index >= 0 ? index : 3, 1, {
      name: "📊 Entries",
      value: `**${entrantCount}** entered`,
      inline: true,
    });
    await interaction.message.edit({ embeds: [refreshed] }).catch(() => null);
  }
}

/** Mongo-backed store for the end/reroll transitions. */
const giveawayTransitionStore: GiveawayTransitionStore = {
  update: (filter, update) => GiveawayModel.findOneAndUpdate(filter, update, { new: true }).lean() as Promise<TransitionGiveaway | null>,
  find: (filter) => GiveawayModel.findOne(filter).lean() as Promise<TransitionGiveaway | null>,
};

/** Mongo-backed store for enterGiveaway. */
const giveawayEntryStore: GiveawayEntryStore = {
  enter: (filter, update) => GiveawayModel.findOneAndUpdate(filter, update, { new: true }).lean() as Promise<{ entrants?: string[] | null } | null>,
  exists: async (filter) => (await GiveawayModel.exists(filter)) !== null,
};


export async function endGiveaway(
  client: Client,
  guildId: string,
  messageId: string,
): Promise<{ ok: boolean; winners?: string[]; error?: string }> {
  const timer = giveawayTimers.get(messageId);
  if (timer) clearTimeout(timer);
  giveawayTimers.delete(messageId);
  const result = await endTransition(giveawayTransitionStore, { guildId, messageId }, drawWinners);
  if (!result.ok) return { ok: false, error: result.error };
  await announceEnd(client, result.giveaway, result.winners);
  return { ok: true, winners: result.winners };
}

/** Post the ended embed, the winners message and the winner DMs. */
async function announceEnd(client: Client, doc: TransitionGiveaway, winners: string[]): Promise<void> {
  const giveaway = doc as TransitionGiveaway & { channelId: string; prize: string; hostId: string };
  const messageId = giveaway.messageId;
  const channel = (client.channels.cache.get(giveaway.channelId)
    ?? await client.channels.fetch(giveaway.channelId).catch(() => null)) as TextChannel | null;
  if (channel && !isObfuscatedChannel(channel)) {
    const winnerMentions = winners.length > 0
      ? winners.map((w: string) => `<@${w}>`).join(", ")
      : "No eligible entrants.";

    const endedEmbed = new EmbedBuilder()
      .setColor(0xBDC3C7)
      .setTitle(giveawayTitle("🎉 GIVEAWAY ENDED", giveaway.prize))
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
  }
  await notifyWinners(client, giveaway, winners, "won");
}

// Shared reroll logic

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
  // Compare-and-set on `rerollSeq`, so two rerolls pressed at once (or a
  // reroll racing an end) cannot both draw and both announce.
  const result: TransitionResult = await rerollTransition(giveawayTransitionStore, { guildId, messageId }, count, drawWinners);
  if (!result.ok) return { ok: false, error: result.error };
  const giveaway = result.giveaway as TransitionGiveaway & { channelId: string; prize: string };
  const winners = result.winners;

  const channel = (client.channels.cache.get(giveaway.channelId)
    ?? await client.channels.fetch(giveaway.channelId).catch(() => null)) as TextChannel | null;
  if (channel && !isObfuscatedChannel(channel)) {
    const winnerMentions = winners.map(w => `<@${w}>`).join(", ");
    await channel.send({
      content: `🎉 **Giveaway Rerolled!**\n\n🏆 New winner${winners.length !== 1 ? "s" : ""}: ${winnerMentions}\n\nPrize: **${giveaway.prize}**`,
    }).catch(err => logger.warn("Could not post giveaway reroll message", err));
  }

  await notifyWinners(client, giveaway, winners, "rerolled");

  await sendGuildLog(client, guildId, {
    title: "🔄 Giveaway Rerolled",
    color: 0xF1C40F,
    description: `**Prize:** ${giveaway.prize}\n**New Winners:** ${winners.map(w => `<@${w}>`).join(", ")}\n**Rerolled by:** ${rerolledBy}`,
  });

  return { ok: true, winners };
}


/** End a running giveaway with no winners (`/giveaway cancel`, dashboard Cancel). */
export async function cancelGiveaway(
  client: Client,
  guildId: string,
  messageId: string,
  cancelledBy: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await cancelTransition(giveawayTransitionStore, { guildId, messageId });
  if (!result.ok) return { ok: false, error: result.error };
  const timer = giveawayTimers.get(messageId);
  if (timer) clearTimeout(timer);
  giveawayTimers.delete(messageId);

  const giveaway = result.giveaway as TransitionGiveaway & { channelId: string; prize: string };
  const channel = (client.channels.cache.get(giveaway.channelId)
    ?? await client.channels.fetch(giveaway.channelId).catch(() => null)) as TextChannel | null;
  if (channel && !isObfuscatedChannel(channel)) {
    const msg = await channel.messages.fetch(messageId).catch(() => null);
    await msg?.edit({
      embeds: [new EmbedBuilder()
        .setColor(0x95A5A6)
        .setTitle(giveawayTitle("🚫 GIVEAWAY CANCELLED", giveaway.prize))
        .setDescription(`This giveaway was cancelled. No winners were drawn.\n\n**Entries:** ${giveaway.entrants?.length ?? 0}`)
        .setTimestamp()],
      components: [],
    }).catch(err => logger.warn(`Could not edit cancelled giveaway ${messageId}`, err));
  }
  await sendGuildLog(client, guildId, {
    title: "🚫 Giveaway Cancelled",
    color: 0x95A5A6,
    description: `**Prize:** ${giveaway.prize}\n**Entries:** ${giveaway.entrants?.length ?? 0}\n**Cancelled by:** ${cancelledBy}`,
  });
  return { ok: true };
}
