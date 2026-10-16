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
} from "discord.js";
import { Command } from "../../types/discord";
import { sendGuildLog } from "../../services/logging";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDuration(raw: string): number | null {
  const match = raw.trim().match(/^(\d+)\s*(s|m|h|d|w)$/i);
  if (!match) return null;
  const n = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multi: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
  return n * multi[unit];
}

function formatDuration(seconds: number): string {
  if (seconds < 60)    return `${seconds}s`;
  if (seconds < 3600)  return `${Math.floor(seconds / 60)}m ${seconds % 60 > 0 ? `${seconds % 60}s` : ""}`.trim();
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return `${Math.floor(seconds / 604800)}w`;
}

// ─── Command ─────────────────────────────────────────────────────────────────

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("remindme")
    .setDescription("Set a personal reminder that Aegis will DM you after the specified time.")
    .addStringOption(opt =>
      opt.setName("reminder").setDescription("What should I remind you about?").setRequired(true).setMaxLength(512)
    )
    .addStringOption(opt =>
      opt.setName("duration").setDescription("When to remind you (e.g. 30m, 2h, 1d, 1w)").setRequired(true).setAutocomplete(true)
    )
    .addBooleanOption(opt =>
      opt.setName("channel_reminder").setDescription("Also ping you in this channel (default: DM only)").setRequired(false)
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    const reminderText  = interaction.options.getString("reminder", true);
    const durationRaw   = interaction.options.getString("duration", true);
    const inChannel     = interaction.options.getBoolean("channel_reminder") ?? false;

    const durationSec = parseDuration(durationRaw);
    if (!durationSec || durationSec < 10) {
      return interaction.reply({
        content: "❌ Invalid duration. Use formats like `30m`, `2h`, `1d`. Minimum is 10 seconds.",
        ephemeral: true,
      });
    }
    if (durationSec > 86400 * 24) {
      return interaction.reply({
        content: "❌ Reminders cannot be set more than 24 days ahead.",
        ephemeral: true,
      });
    }

    const fireAt = new Date(Date.now() + durationSec * 1000);
    const fireTs = Math.floor(fireAt.getTime() / 1000);

    const confirmEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("⏰ Reminder Set!")
      .setDescription(`I'll remind you <t:${fireTs}:R> (at <t:${fireTs}:f>).`)
      .addFields(
        { name: "📝 Reminder", value: reminderText, inline: false },
        { name: "⏳ Duration", value: formatDuration(durationSec), inline: true },
        { name: "🔔 Delivery",  value: inChannel ? "DM + Channel Ping" : "DM only", inline: true },
      )
      .setFooter({ text: "You can close this. I'll DM you when the time comes." })
      .setTimestamp();

    await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });

    // Schedule the reminder
    setTimeout(async () => {
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("⏰ Reminder!")
          .setDescription(`You asked me to remind you about:\n\n**${reminderText}**`)
          .addFields(
            { name: "⏳ Set",  value: `<t:${Math.floor((fireAt.getTime() - durationSec * 1000) / 1000)}:R>` },
            { name: "📌 From", value: interaction.guild?.name ?? "Direct Message" },
          )
          .setFooter({ text: "Set with /remindme" })
          .setTimestamp();

        // Send DM
        const user = await interaction.client.users.fetch(interaction.user.id).catch(() => null);
        if (user) {
          await user.send({ embeds: [dmEmbed] }).catch(() => null);
        }

        // Channel ping if opted in
        if (inChannel && interaction.channel && "send" in interaction.channel) {
          await (interaction.channel as any).send({
            content: `<@${interaction.user.id}> ⏰ **Reminder:** ${reminderText}`,
          }).catch(() => null);
        }
      } catch (err) {
        logger.warn(`Reminder delivery failed for user ${interaction.user.id}`, err);
      }
    }, durationSec * 1000);
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().trim().toLowerCase();
    const presets = [
      { name: "10 minutes", value: "10m" },
      { name: "30 minutes", value: "30m" },
      { name: "1 hour", value: "1h" },
      { name: "2 hours", value: "2h" },
      { name: "4 hours", value: "4h" },
      { name: "8 hours", value: "8h" },
      { name: "12 hours", value: "12h" },
      { name: "1 day (tomorrow)", value: "1d" },
      { name: "3 days", value: "3d" },
      { name: "1 week", value: "1w" },
    ];
    const filtered = presets.filter(p => !focused || p.name.toLowerCase().includes(focused) || p.value.toLowerCase().includes(focused));
    await interaction.respond(filtered.slice(0, 10).map(p => ({ name: `${p.value} (${p.name})`, value: p.value })));
  },
};

export default command;
