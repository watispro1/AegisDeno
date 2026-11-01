import { moduleEnabled, moduleOffMessage } from "../../services/moduleSwitches";
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
  ChannelType,
  AutocompleteInteraction,
} from "discord.js";
import { Command } from "../../types/discord";
import { isSendableChannel, isObfuscatedChannel } from "../../utils/channels";
import { sendGuildLog } from "../../services/logging";
import { GiveawayModel } from "../../database/mongo";
import { MAX_TIMEOUT_MS } from "../../services/timedActions";
import { formatDurationLong, parseFriendlyDuration } from "../../utils/duration";
import { DISCORD_LIMITS, truncate } from "../../utils/safeText";
import { pickWeightedWinners } from "../../services/communityLogic";
import { enterGiveaway, type GiveawayEntryStore } from "../../services/giveawayEntry";

const giveawayTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtDuration = formatDurationLong;

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

  // Acknowledge first: the member lookup and the update can take longer than
  // Discord's 3-second window on a busy shard.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const multiplier = giveaway.boosterMultiplier ?? 1;
  const needMember = Boolean(giveaway.requiredRoleId) || multiplier > 1;
  const member = needMember
    ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
    : null;

  if (giveaway.requiredRoleId && !member?.roles.cache.has(giveaway.requiredRoleId)) {
    await interaction.editReply({ content: `❌ You need the <@&${giveaway.requiredRoleId}> role to enter this giveaway.` });
    return;
  }

  const isBooster = multiplier > 1 && Boolean(member?.premiumSince);
  const { outcome, entrantCount } = await enterGiveaway(giveawayEntryStore, {
    guildId: interaction.guildId,
    messageId: interaction.message.id,
    userId: interaction.user.id,
  }, isBooster);

  if (outcome === "closed") {
    await interaction.editReply({ content: "❌ This giveaway just ended. Better luck next time!" });
    return;
  }
  await interaction.editReply({
    content: outcome === "already"
      ? "ℹ️ You are already entered in this giveaway."
      : isBooster
        ? `✅ You are entered with **${multiplier}×** entries as a server booster! Good luck!`
        : "✅ You are entered! Good luck!",
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

/** Mongo-backed store for enterGiveaway. */
const giveawayEntryStore: GiveawayEntryStore = {
  enter: (filter, update) => GiveawayModel.findOneAndUpdate(filter, update, { new: true }).lean() as Promise<{ entrants?: string[] | null } | null>,
  exists: async (filter) => (await GiveawayModel.exists(filter)) !== null,
};

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
          opt.setName("duration").setDescription("How long it runs, e.g. 30m, 2h, 1d 12h, 3 days (10s–30d)").setRequired(true).setMaxLength(64)
        )
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel to host the giveaway (defaults to current)").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false)
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
          opt.setName("message_id").setDescription("The giveaway: pick one, or paste its message ID or link").setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("reroll")
        .setDescription("Reroll a completed giveaway to pick new winners.")
        .addStringOption(opt =>
          opt.setName("message_id").setDescription("The ended giveaway: pick one, or paste its message ID or link").setRequired(true).setAutocomplete(true)
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

  /** `message_id` on end/reroll: the server's running (end) or finished (reroll) giveaways. */
  autocomplete: async (interaction: AutocompleteInteraction) => {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== "message_id" || !interaction.guildId) return interaction.respond([]);
    const ended = interaction.options.getSubcommand(false) === "reroll";
    const typed = String(focused.value ?? "").trim().toLowerCase().slice(0, 100);
    const rows = await GiveawayModel.find({ guildId: interaction.guildId, ended })
      .sort(ended ? { endedAt: -1 } : { endsAt: 1 })
      .limit(50)
      .select("messageId prize endsAt")
      .lean()
      .catch(() => []);
    const choices = (rows as Array<{ messageId: string; prize: string; endsAt: Date }>)
      .filter(g => !typed || g.prize.toLowerCase().includes(typed) || g.messageId.startsWith(typed))
      .slice(0, 25)
      .map(g => ({ name: truncate(`${g.prize} · ${ended ? "ended" : "ends"} ${new Date(g.endsAt).toISOString().slice(0, 16).replace("T", " ")} UTC`, 100), value: g.messageId }));
    await interaction.respond(choices);
  },

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    // ── /giveaway start ────────────────────────────────────────────────────
    if (sub === "start") {
      if (!(await moduleEnabled(guildId, "giveaways"))) {
        await interaction.reply({ content: moduleOffMessage("giveaways"), flags: MessageFlags.Ephemeral });
        return;
      }
      const prize       = interaction.options.getString("prize", true);
      const durationRaw = interaction.options.getString("duration", true);
      const winnerCount = interaction.options.getInteger("winners") ?? 1;
      const reqRole     = interaction.options.getRole("required_role");
      const description = interaction.options.getString("description") ?? null;
      const targetChan  = interaction.options.getChannel("channel") ?? interaction.channel;
      const boosterMult = interaction.options.getInteger("booster_multiplier") ?? 1;

      const durationSec = parseFriendlyDuration(durationRaw);
      if (!durationSec || durationSec < 10) {
        return interaction.reply({ content: "❌ I couldn't read that duration. Try `30m`, `2h`, `1d 12h` or `3 days` (minimum 10 seconds).", flags: MessageFlags.Ephemeral });
      }
      if (durationSec > 86400 * 30) {
        return interaction.reply({ content: "❌ Giveaway duration cannot exceed 30 days.", flags: MessageFlags.Ephemeral });
      }

      if (!isSendableChannel(targetChan) || !("guildId" in targetChan) || targetChan.guildId !== guildId) {
        return interaction.reply({ content: "❌ Pick a text or announcement channel in this server that I can see.", flags: MessageFlags.Ephemeral });
      }
      const me = interaction.guild?.members.me;
      const chanPerms = me && "permissionsFor" in targetChan ? targetChan.permissionsFor(me) : null;
      const missing = chanPerms
        ? (["ViewChannel", "SendMessages", "EmbedLinks"] as const).filter(p => !chanPerms.has(PermissionFlagsBits[p]))
        : [];
      if (missing.length) {
        return interaction.reply({ content: `❌ I need ${missing.map(p => `**${p.replace(/([a-z])([A-Z])/g, "$1 $2")}**`).join(", ")} in <#${targetChan.id}> to host a giveaway there.`, flags: MessageFlags.Ephemeral });
      }
      if (reqRole && reqRole.id !== guildId && "managed" in reqRole && reqRole.managed) {
        return interaction.reply({ content: "❌ That role is managed by an integration, so members can't be given it. Pick another required role.", flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const endsAt = new Date(Date.now() + durationSec * 1000);
      const endsTs = Math.floor(endsAt.getTime() / 1000);

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle(giveawayTitle("🎉 GIVEAWAY", prize))
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
      const messageId = parseMessageRef(interaction.options.getString("message_id", true));
      if (!messageId) {
        return interaction.reply({ content: "❌ That isn't a giveaway. Pick one from the list, or paste its message ID or link.", flags: MessageFlags.Ephemeral });
      }
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
      const messageId   = parseMessageRef(interaction.options.getString("message_id", true));
      const rerollCount = interaction.options.getInteger("winners") ?? null;
      if (!messageId) {
        return interaction.reply({ content: "❌ That isn't a giveaway. Pick one from the list, or paste its message ID or link.", flags: MessageFlags.Ephemeral });
      }
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
        return `**${i + 1}.** 🏆 **${truncate(String(g.prize), 80)}** — ${g.winnerCount} winner(s) — ${g.entrants?.length ?? 0} entr${(g.entrants?.length ?? 0) === 1 ? "y" : "ies"} — ends <t:${ts}:R> — [Jump](https://discord.com/channels/${guildId}/${g.channelId}/${g.messageId})`;
      });
      await interaction.editReply(`🎉 **Active Giveaways (${active.length}):**\n\n${lines.join("\n")}`);
      return;
    }
  },
};

// ─── Shared end logic ─────────────────────────────────────────────────────────

export async function endGiveaway(
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

  // Compare-and-set on the current winners, so two rerolls pressed at once
  // cannot both draw and both announce.
  const swapped = await GiveawayModel.findOneAndUpdate(
    { guildId, messageId, ended: true, winners: giveaway.winners ?? [] },
    { $set: { winners }, $addToSet: { previousWinners: { $each: giveaway.winners ?? [] } } },
    { new: true },
  ).lean();
  if (!swapped) return { ok: false, error: "Someone else rerolled this giveaway a moment ago. Check the channel for the new winners." };

  const channel = (client.channels.cache.get(giveaway.channelId)
    ?? await client.channels.fetch(giveaway.channelId).catch(() => null)) as TextChannel | null;
  if (channel && !isObfuscatedChannel(channel)) {
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
