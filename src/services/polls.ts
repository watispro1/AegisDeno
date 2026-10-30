/**
 * Persistent /poll engine.
 *
 * Polls and their votes are stored in MongoDB (`PollModel`), the buttons are
 * routed by customId in src/bot/interactions/community.ts (so they keep working
 * after the command finishes or the bot restarts), and timed polls are closed
 * by a `poll_close` task in the existing Mongo-backed scheduler.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Client,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { PollModel } from "../database/mongo";
import { createTask, deleteTask, type ScheduledTask } from "./scheduler";
import { cancelTask, scheduleTask } from "./schedulerRunner";
import { sendGuildLog } from "./logging";
import { isSendableChannel, isObfuscatedChannel } from "../utils/channels";
import { logger } from "../utils/logger";
import {
  applyPollVote,
  buildResultBar,
  pollLeaders,
  pollVoteGuard,
  renderPollResultsText,
  tallyPoll,
  type PollVotes,
} from "./communityLogic";

/** Compare-and-set attempts before a vote gives up (only reachable under heavy click spam). */
const VOTE_ATTEMPTS = 5;

export const NUMBER_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

/** Shape of a stored poll as read with `.lean()`. */
export interface PollRecord {
  guildId: string;
  channelId: string;
  messageId: string;
  creatorId: string;
  creatorTag?: string | null;
  question: string;
  options: string[];
  multiselect: boolean;
  anonymous: boolean;
  imageUrl?: string | null;
  votes?: PollVotes | null;
  endsAt?: Date | null;
  closeTaskId?: string | null;
  ended: boolean;
}

// ─── Rendering ───────────────────────────────────────────────────────────────

export function renderPollEmbed(poll: Omit<PollRecord, "messageId" | "channelId"> & { messageId?: string }, ended = poll.ended): EmbedBuilder {
  const { counts, totalVotes, voters } = tallyPoll(poll.votes ?? {}, poll.options.length);
  const endsTs = poll.endsAt ? Math.floor(new Date(poll.endsAt).getTime() / 1000) : null;

  const modes = [
    poll.multiselect ? "☑️ Pick as many as you like" : "🔘 Pick one",
    poll.anonymous ? "🕶️ Anonymous" : null,
  ].filter(Boolean).join(" · ");
  const timing = ended
    ? "🔒 **This poll is closed.**"
    : endsTs ? `⏰ Closes <t:${endsTs}:R> (<t:${endsTs}:f>)` : "⏰ No time limit — a moderator or the creator can end it.";

  const embed = new EmbedBuilder()
    .setColor(ended ? 0x99AAB5 : 0x5865F2)
    .setTitle(`${ended ? "🔒" : "📊"} ${poll.question}`.slice(0, 256))
    .setDescription(`${modes}\n${timing}`)
    .addFields(poll.options.map((opt, i) => ({
      name: `${NUMBER_EMOJIS[i]} ${opt}`.slice(0, 256),
      value: `\`${buildResultBar(counts[i], totalVotes)}\` — **${counts[i]}** vote${counts[i] !== 1 ? "s" : ""}`,
      inline: false,
    })))
    .setFooter({
      text: `${voters} voter${voters !== 1 ? "s" : ""} · ${totalVotes} vote${totalVotes !== 1 ? "s" : ""}${poll.creatorTag ? ` · Poll by ${poll.creatorTag}` : ""}`,
    })
    .setTimestamp(ended ? new Date() : null);

  if (poll.imageUrl) embed.setImage(poll.imageUrl);
  return embed;
}

export function renderPollComponents(optionCount: number, options: string[], disabled = false): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let start = 0; start < optionCount; start += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (let i = start; i < Math.min(start + 5, optionCount); i++) {
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
  rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("poll_end").setLabel("End Poll").setStyle(ButtonStyle.Danger).setEmoji("🔒").setDisabled(disabled),
    new ButtonBuilder().setCustomId("poll_results").setLabel("My Votes").setStyle(ButtonStyle.Secondary).setEmoji("📋"),
  ));
  return rows;
}

function renderResultsEmbed(poll: PollRecord, closedBy: string | null): EmbedBuilder {
  const votes = poll.votes ?? {};
  const { counts, totalVotes, voters } = tallyPoll(votes, poll.options.length);
  const leaders = pollLeaders(counts);

  const verdict = leaders.length === 0
    ? "No votes were cast."
    : leaders.length === 1
      ? `🏆 **${poll.options[leaders[0]]}** wins with ${counts[leaders[0]]} vote${counts[leaders[0]] !== 1 ? "s" : ""}.`
      : `🤝 Tie between ${leaders.map(i => `**${poll.options[i]}**`).join(", ")} (${counts[leaders[0]]} each).`;

  return new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle(`📊 Results: ${poll.question}`.slice(0, 256))
    .setDescription(renderPollResultsText({ ...poll, votes }, counts, totalVotes, verdict, NUMBER_EMOJIS))
    .setFooter({ text: `${voters} voter${voters !== 1 ? "s" : ""}${closedBy ? ` · Closed by ${closedBy}` : " · Closed automatically"}` })
    .setTimestamp();
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

/** Store a freshly posted poll and arm its auto-close task. */
export async function registerPoll(client: Client, poll: Omit<PollRecord, "ended" | "votes" | "closeTaskId">): Promise<void> {
  await PollModel.create({
    guildId: poll.guildId,
    channelId: poll.channelId,
    messageId: poll.messageId,
    creatorId: poll.creatorId,
    creatorTag: poll.creatorTag ?? "",
    question: poll.question,
    options: poll.options,
    multiselect: poll.multiselect,
    anonymous: poll.anonymous,
    imageUrl: poll.imageUrl ?? null,
    endsAt: poll.endsAt ?? null,
    votes: {},
    ended: false,
  });
  if (!poll.endsAt) return;

  const task = await createTask(
    poll.guildId,
    poll.channelId,
    poll.creatorId,
    "poll_close",
    JSON.stringify({ messageId: poll.messageId }),
    poll.endsAt,
  );
  await PollModel.updateOne({ messageId: poll.messageId }, { $set: { closeTaskId: task.id } });
  scheduleTask(client, task);
}

/**
 * Close a poll: lock it, freeze the poll message and post the results.
 * Idempotent; returns false when the poll was already closed or is unknown.
 */
export async function closePoll(client: Client, guildId: string, messageId: string, closedBy: string | null): Promise<boolean> {
  const poll = await PollModel.findOneAndUpdate(
    { guildId, messageId, ended: false },
    { $set: { ended: true, endedAt: new Date() } },
    { new: true },
  ).lean() as PollRecord | null;
  if (!poll) return false;

  // Closed early by hand: drop the pending auto-close task.
  if (poll.closeTaskId && closedBy) {
    cancelTask(poll.closeTaskId);
    await deleteTask(guildId, poll.closeTaskId).catch(() => null);
  }

  const channel = await client.channels.fetch(poll.channelId).catch(() => null);
  if (channel && !isObfuscatedChannel(channel) && channel.isTextBased() && "messages" in channel) {
    const msg = await channel.messages.fetch(messageId).catch(() => null);
    if (msg) {
      await msg.edit({
        embeds: [renderPollEmbed(poll, true)],
        components: renderPollComponents(poll.options.length, poll.options, true),
      }).catch(err => logger.warn(`Poll ${messageId}: could not freeze poll message`, err));
    }
    if (isSendableChannel(channel)) {
      await channel.send({
        embeds: [renderResultsEmbed(poll, closedBy)],
        reply: { messageReference: messageId, failIfNotExists: false },
        allowedMentions: { parse: [] },
      }).catch(err => logger.warn(`Poll ${messageId}: could not post results`, err));
    }
  } else {
    logger.warn(`Poll ${messageId}: channel ${poll.channelId} is gone; marked closed without posting results.`);
  }

  const { counts, voters } = tallyPoll(poll.votes ?? {}, poll.options.length);
  const leaders = pollLeaders(counts);
  await sendGuildLog(client, guildId, {
    title: "📊 Poll Ended",
    color: 0x99AAB5,
    description: `**Question:** ${poll.question}\n**Voters:** ${voters}\n${leaders.length ? `**Leading:** ${leaders.map(i => poll.options[i]).join(", ")}` : "**No votes cast.**"}\n**Closed by:** ${closedBy ?? "timer"}`,
  }).catch(() => null);

  return true;
}

/** Scheduler entry point for `poll_close` tasks. */
export async function closePollFromTask(client: Client, task: ScheduledTask): Promise<void> {
  let messageId: string | undefined;
  try {
    messageId = (JSON.parse(task.payload) as { messageId?: string }).messageId;
  } catch {
    messageId = undefined;
  }
  if (!messageId) {
    logger.warn(`Task ${task.id}: unreadable poll_close payload — removing task.`);
    return;
  }
  await closePoll(client, task.guildId, messageId, null);
}

// ─── Buttons ─────────────────────────────────────────────────────────────────

export async function handlePollButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guildId) return;
  const messageId = interaction.message.id;
  const poll = await PollModel.findOne({ guildId: interaction.guildId, messageId }).lean() as PollRecord | null;

  if (!poll) {
    await interaction.reply({ content: "❌ This poll is no longer active.", flags: MessageFlags.Ephemeral });
    return;
  }

  const id = interaction.customId;

  if (id === "poll_results") {
    const mine = (poll.votes ?? {})[interaction.user.id] ?? [];
    await interaction.reply({
      content: mine.length === 0
        ? "📋 You haven't voted yet."
        : `📋 **Your vote${mine.length !== 1 ? "s" : ""}:** ${mine.map(i => `${NUMBER_EMOJIS[i]} ${poll.options[i]}`).join(", ")}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (poll.ended) {
    await interaction.reply({ content: "🔒 This poll is closed.", flags: MessageFlags.Ephemeral });
    return;
  }

  if (id === "poll_end") {
    const allowed = interaction.user.id === poll.creatorId
      || interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages);
    if (!allowed) {
      await interaction.reply({ content: "❌ Only the poll creator or a moderator can end this poll.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const closed = await closePoll(interaction.client, interaction.guildId, messageId, interaction.user.tag);
    await interaction.editReply(closed ? "🔒 Poll closed and results posted." : "ℹ️ This poll was already closed.");
    return;
  }

  const match = /^poll_vote_(\d+)$/.exec(id);
  if (!match) return;
  const optionIndex = Number(match[1]);
  if (optionIndex >= poll.options.length) return;

  // Compare-and-set on this user's picks: two quick clicks on a multi-select
  // poll must both count, so each update only applies if the picks it was
  // computed from are still the stored ones; otherwise re-read and retry.
  let picks = (poll.votes ?? {})[interaction.user.id] ?? [];
  let added = false;
  let updated: PollRecord | null = null;
  for (let attempt = 0; attempt < VOTE_ATTEMPTS && !updated; attempt++) {
    const next = applyPollVote(picks, optionIndex, poll.multiselect);
    added = next.added;
    const voteKey = `votes.${interaction.user.id}`;
    updated = await PollModel.findOneAndUpdate(
      { guildId: interaction.guildId, messageId, ended: false, ...pollVoteGuard(interaction.user.id, picks) },
      next.choices.length ? { $set: { [voteKey]: next.choices } } : { $unset: { [voteKey]: "" } },
      { new: true },
    ).lean() as PollRecord | null;
    if (updated) break;

    const fresh = await PollModel.findOne({ guildId: interaction.guildId, messageId }).select("votes ended").lean() as Pick<PollRecord, "votes" | "ended"> | null;
    if (!fresh || fresh.ended) break;
    picks = (fresh.votes ?? {})[interaction.user.id] ?? [];
  }

  if (!updated) {
    const stillOpen = await PollModel.exists({ guildId: interaction.guildId, messageId, ended: false });
    await interaction.reply({
      content: stillOpen ? "⏳ Too many clicks at once. Please try that vote again." : "🔒 This poll just closed.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const label = `${NUMBER_EMOJIS[optionIndex]} ${poll.options[optionIndex]}`;
  await interaction.reply({
    content: added
      ? (poll.anonymous ? "✅ Vote recorded. Nobody can see who you voted for." : `✅ Voted for **${label}**.`)
      : `↩️ Removed your vote for **${label}**.`,
    flags: MessageFlags.Ephemeral,
  });

  await interaction.message.edit({ embeds: [renderPollEmbed(updated)] }).catch(() => null);
}
