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

import {
  fmtDuration,
  parseMessageRef,
  giveawayTitle,
  scheduleGiveawayEnd,
  initGiveawayScheduler,
  handleGiveawayButton,
  endGiveaway,
  rerollGiveaway,
} from "../../services/giveawayService";

export {
  fmtDuration,
  parseMessageRef,
  giveawayTitle,
  scheduleGiveawayEnd,
  initGiveawayScheduler,
  handleGiveawayButton,
  endGiveaway,
  rerollGiveaway,
} from "../../services/giveawayService";

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

export default command;
