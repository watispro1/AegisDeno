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
  MessageFlags,
} from "discord.js";
import { Command } from "../../types/discord";
import { WatchlistEntryModel } from "../../database/mongo";
import { updateWatchCache, removeWatchFromCache } from "../../services/watchlistService";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCode(targetId: string): string {
  return `WL-${targetId.slice(-4).toUpperCase()}`;
}

// ─── Command ─────────────────────────────────────────────────────────────────

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("watchlist")
    .setDescription("Ghost-watch a member: receive instant private DM alerts on their server activity.")
    .addSubcommand(sub =>
      sub.setName("add")
        .setDescription("Add a member to your personal ghost-watch list")
        .addUserOption(o => o.setName("user").setDescription("Member to watch").setRequired(true))
        .addStringOption(o =>
          o.setName("reason").setDescription("Internal reason for the watch (not shown to the member)").setMaxLength(256)
        )
        .addStringOption(o =>
          o.setName("duration").setDescription("Watch duration: 1h · 6h · 24h · 7d · permanent (default: 24h)")
            .addChoices(
              { name: "⏱️ 1 Hour",      value: "1h" },
              { name: "⏱️ 6 Hours",     value: "6h" },
              { name: "📅 24 Hours",    value: "24h" },
              { name: "📅 7 Days",      value: "7d" },
              { name: "♾️ Permanent",   value: "permanent" },
            )
        )
        .addStringOption(o =>
          o.setName("events")
            .setDescription("Which events trigger an alert (default: all)")
            .addChoices(
              { name: "🗒️ All Events",          value: "all" },
              { name: "💬 Messages Only",        value: "messages" },
              { name: "🚪 Join / Leave Only",    value: "presence" },
              { name: "🔧 Role Changes Only",    value: "roles" },
              { name: "🎙️ Voice Joins Only",     value: "voice" },
              { name: "☀️ First Message Only",   value: "first_message" },
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName("remove")
        .setDescription("Remove a member from your ghost-watch list")
        .addUserOption(o => o.setName("user").setDescription("Member to unwatch").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("list")
        .setDescription("Show all members currently on your ghost-watch list")
    )
    .addSubcommand(sub =>
      sub.setName("info")
        .setDescription("View watch details and alert history for a specific member")
        .addUserOption(o => o.setName("user").setDescription("Member to inspect").setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const modId   = interaction.user.id;

    // ── ADD ────────────────────────────────────────────────────────────────
    if (sub === "add") {
      const target   = interaction.options.getUser("user", true);
      const reason   = interaction.options.getString("reason") ?? "No reason provided.";
      const duration = interaction.options.getString("duration") ?? "24h";
      const eventSet = interaction.options.getString("events") ?? "all";

      if (target.id === modId) {
        await interaction.reply({ content: "❌ You cannot watch yourself.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (target.bot) {
        await interaction.reply({ content: "❌ You cannot watch a bot.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (target.id === interaction.guild?.ownerId) {
        await interaction.reply({ content: "❌ You cannot watch the server owner.", flags: MessageFlags.Ephemeral });
        return;
      }

      // Resolve expiry
      const durationMap: Record<string, number> = {
        "1h":  1 * 60 * 60 * 1000,
        "6h":  6 * 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
        "7d":  7 * 24 * 60 * 60 * 1000,
      };
      const expiresAt = duration === "permanent" ? null : new Date(Date.now() + durationMap[duration]);

      // Resolve watched events
      const eventMap: Record<string, string[]> = {
        all:      ["message", "edit", "delete", "join", "leave", "roleChange", "voice", "firstMessage"],
        messages: ["message", "edit", "delete"],
        presence: ["join", "leave", "voice"],
        roles:    ["roleChange"],
        voice:    ["voice"],
        first_message: ["firstMessage"],
      };
      const events = eventMap[eventSet] ?? eventMap.all;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        await WatchlistEntryModel.findOneAndUpdate(
          { guildId, targetId: target.id, moderatorId: modId },
          {
            $set: {
              reason,
              expiresAt,
              events,
              alertCount: 0,
              createdAt: new Date(),
            },
          },
          { upsert: true, new: true }
        );

        updateWatchCache(guildId, target.id, modId, events, expiresAt);

        const expiryText = expiresAt
          ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`
          : "**Permanent**";

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("🕵️ Ghost Watch — Active")
          .setThumbnail(target.displayAvatarURL())
          .setDescription(
            `**${target.tag}** is now under silent surveillance.\n` +
            `You will receive a **private DM** for every monitored event — the member will not be notified.`
          )
          .addFields(
            { name: "👤 Target",    value: `${target.tag} (<@${target.id}>)`, inline: true },
            { name: "⏰ Expires",   value: expiryText, inline: true },
            { name: "🎯 Events",    value: events.map(e => `\`${e}\``).join(", "), inline: false },
            { name: "📝 Reason",    value: reason, inline: false },
          )
          .setFooter({ text: `Watching as ${interaction.user.tag} • Watch ID: ${makeCode(target.id)}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        logger.error("Watchlist add failed", err);
        await interaction.editReply("❌ Failed to add watch entry. Please try again.");
      }
    }

    // ── REMOVE ─────────────────────────────────────────────────────────────
    else if (sub === "remove") {
      const target = interaction.options.getUser("user", true);
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const deleted = await WatchlistEntryModel.findOneAndDelete({ guildId, targetId: target.id, moderatorId: modId });
      if (!deleted) {
        await interaction.editReply(`❌ **${target.tag}** is not on your watch list.`);
        return;
      }
      removeWatchFromCache(guildId, target.id, modId);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle("✅ Ghost Watch — Removed")
            .setDescription(`**${target.tag}** has been removed from your watch list. Alerts will stop immediately.`)
            .addFields({ name: "📊 Total Alerts Fired", value: `${deleted.alertCount}`, inline: true })
            .setTimestamp(),
        ],
      });
    }

    // ── LIST ───────────────────────────────────────────────────────────────
    else if (sub === "list") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const entries = await WatchlistEntryModel.find({ guildId, moderatorId: modId }).sort({ createdAt: -1 });
      if (entries.length === 0) {
        await interaction.editReply("🔍 Your ghost-watch list is empty. Use `/watchlist add` to start monitoring a member.");
        return;
      }

      const lines = await Promise.all(
        entries.map(async (e, idx) => {
          let tag = `<@${e.targetId}>`;
          try {
            const u = await interaction.client.users.fetch(e.targetId);
            tag = `${u.tag} (<@${e.targetId}>)`;
          } catch { /* user left Discord */ }
          const expires = e.expiresAt ? `<t:${Math.floor(new Date(e.expiresAt).getTime() / 1000)}:R>` : "Permanent";
          return `**${idx + 1}.** ${tag} — 🔔 ${e.alertCount} alerts — expires ${expires}`;
        })
      );

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🕵️ Your Ghost-Watch List — ${entries.length} member(s)`)
        .setDescription(lines.join("\n"))
        .setFooter({ text: "Alerts are sent as private DMs. Members are never notified." })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }

    // ── INFO ───────────────────────────────────────────────────────────────
    else if (sub === "info") {
      const target = interaction.options.getUser("user", true);
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const entry = await WatchlistEntryModel.findOne({ guildId, targetId: target.id, moderatorId: modId });
      if (!entry) {
        await interaction.editReply(`❌ **${target.tag}** is not on your watch list.`);
        return;
      }

      const expires = entry.expiresAt
        ? `<t:${Math.floor(new Date(entry.expiresAt).getTime() / 1000)}:R>`
        : "**Permanent**";

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🕵️ Watch Details — ${target.tag}`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: "👤 Target",         value: `${target.tag} (<@${target.id}>)`, inline: true },
          { name: "⏰ Expires",        value: expires, inline: true },
          { name: "🔔 Alerts Fired",   value: `${entry.alertCount}`, inline: true },
          { name: "🎯 Monitored Events", value: (entry.events as string[]).map((e: string) => `\`${e}\``).join(", "), inline: false },
          { name: "📝 Reason",         value: entry.reason ?? "No reason provided.", inline: false },
          { name: "📅 Watch Started",  value: `<t:${Math.floor(new Date(entry.createdAt).getTime() / 1000)}:R>`, inline: true },
          { name: "🆔 Watch ID",       value: `\`${makeCode(target.id)}\``, inline: true },
        )
        .setFooter({ text: `Watching as ${interaction.user.tag}` })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`wl_remove_${target.id}`)
          .setLabel("Remove Watch")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🗑️"),
      );

      const sent = await interaction.editReply({ embeds: [embed], components: [row] });

      const collector = sent.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30_000,
        filter: (i) => i.user.id === modId,
      });

      collector.on("collect", async (i) => {
        if (i.customId === `wl_remove_${target.id}`) {
          await WatchlistEntryModel.deleteOne({ guildId, targetId: target.id, moderatorId: modId });
          removeWatchFromCache(guildId, target.id, modId);
          await i.update({
            embeds: [
              new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle("✅ Watch Removed")
                .setDescription(`**${target.tag}** has been removed from your watch list.`)
                .setTimestamp(),
            ],
            components: [],
          });
        }
      });

      collector.on("end", () => {
        interaction.editReply({ components: [] }).catch(() => null);
      });
    }
  },
};

export default command;
