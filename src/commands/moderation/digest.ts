/** /digest — the opt-in weekly staff digest (Manage Server). */
import {
  ChannelType, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder,
  type AutocompleteInteraction, type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../../types/discord";
import { getGuildConfig, updateGuildConfig } from "../../services/configuration";
import { DAY_NAMES, describeSchedule, isValidTimeZone, normalizeDigestConfig, type DigestConfig } from "../../services/digestLogic";
import { ensureDigestTask, previewDigest } from "../../services/digestService";
import { rankChoices } from "../../utils/autocomplete";
import { isObfuscatedChannel } from "../../utils/channels";
import { requestConfirmation } from "../../utils/confirmation";
import { footer } from "../../utils/embedStyle";

/** Offered by autocomplete; any valid IANA zone is accepted. */
export const COMMON_TIME_ZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Sao_Paulo", "America/Toronto",
  "Europe/London", "Europe/Berlin", "Europe/Paris", "Europe/Madrid", "Europe/Moscow", "Africa/Lagos", "Asia/Dubai", "Asia/Kolkata",
  "Asia/Singapore", "Asia/Tokyo", "Asia/Manila", "Australia/Sydney", "Pacific/Auckland",
];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("digest")
    .setDescription("Weekly staff digest: cases, joins, automod, trust and open tickets in one post.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName("setup").setDescription("Turn the digest on and choose when and where it posts")
      .addChannelOption(o => o.setName("channel").setDescription("Where to post (default: the mod log channel)").addChannelTypes(ChannelType.GuildText))
      .addIntegerOption(o => o.setName("day").setDescription("Day of the week (default Monday)").addChoices(...DAY_NAMES.map((d, i) => ({ name: d, value: i }))))
      .addIntegerOption(o => o.setName("hour").setDescription("Hour, 0–23 (default 9)").setMinValue(0).setMaxValue(23))
      .addStringOption(o => o.setName("timezone").setDescription("Time zone such as America/Chicago (default UTC)").setAutocomplete(true).setMaxLength(64)))
    .addSubcommand(s => s.setName("preview").setDescription("See this week's digest now (only you see it)"))
    .addSubcommand(s => s.setName("disable").setDescription("Stop posting the weekly digest")),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageGuild],

  async autocomplete(interaction: AutocompleteInteraction) {
    await interaction.respond(rankChoices(COMMON_TIME_ZONES.map(z => ({ name: z, value: z })), String(interaction.options.getFocused())));
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const sub = interaction.options.getSubcommand();
    const full = await getGuildConfig(guild.id);
    const cfg = normalizeDigestConfig(full.digest);

    if (sub === "preview") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const data = await previewDigest(interaction.client, guild.id);
      if (!data) return void (await interaction.editReply({ content: "❌ Couldn't build a preview right now. Try again in a minute." }));
      return void (await interaction.editReply({ content: cfg.enabled ? `Posts ${describeSchedule(cfg)}.` : "The digest is off. Turn it on with `/digest setup`.", embeds: [new EmbedBuilder(data)], allowedMentions: { parse: [] } }));
    }

    if (sub === "disable") {
      if (!cfg.enabled) return void (await interaction.reply({ content: "ℹ️ The weekly digest is already off.", flags: MessageFlags.Ephemeral }));
      const ok = await requestConfirmation(interaction, { content: "Stop the weekly staff digest? You can turn it back on with `/digest setup`.", confirmLabel: "Turn off" });
      if (ok !== "confirmed") return;
      const next: DigestConfig = { ...cfg, enabled: false };
      await updateGuildConfig(guild.id, { digest: next });
      await ensureDigestTask(interaction.client, guild.id, next);
      return void (await interaction.editReply({ content: "🛑 Weekly digest turned off.", components: [] }));
    }

    const channel = interaction.options.getChannel("channel");
    if (channel && isObfuscatedChannel(channel)) return void (await interaction.reply({ content: "❌ Aegis can't see that channel. Give Aegis **View Channel** there, or pick another one.", flags: MessageFlags.Ephemeral }));
    const tz = interaction.options.getString("timezone")?.trim();
    if (tz && !isValidTimeZone(tz)) return void (await interaction.reply({ content: `❌ \`${tz.slice(0, 64)}\` isn't a time zone I know. Use one like \`America/Chicago\` or \`UTC\` (the list suggests some).`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }));
    const next: DigestConfig = normalizeDigestConfig({
      ...cfg, enabled: true,
      channelId: channel?.id ?? cfg.channelId,
      day: interaction.options.getInteger("day") ?? cfg.day,
      hour: interaction.options.getInteger("hour") ?? cfg.hour,
      timezone: tz ?? cfg.timezone,
    });
    if (!next.channelId && !full.loggingChannelId) return void (await interaction.reply({ content: "❌ Pick a `channel`, or set a mod log channel first with `/logging setup`.", flags: MessageFlags.Ephemeral }));
    await updateGuildConfig(guild.id, { digest: next });
    const at = await ensureDigestTask(interaction.client, guild.id, next);
    const embed = new EmbedBuilder().setColor(0x57f287).setTitle("✅ Weekly digest on")
      .setDescription(`Posts ${describeSchedule(next)} in ${next.channelId ? `<#${next.channelId}>` : "the mod log channel"}.${at ? `\nNext: <t:${Math.floor(at.getTime() / 1000)}:F> (<t:${Math.floor(at.getTime() / 1000)}:R>)` : ""}`)
      .setFooter(footer("See it now with /digest preview"));
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default command;
