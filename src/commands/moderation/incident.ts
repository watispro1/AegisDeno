/**
 * /incident start|end|status|auto: Incident Mode. One command puts a server
 * under raid protection (slowmode, lock, join gate, paused invites) and
 * records every change so ending it, by hand or on expiry, puts the server
 * back exactly as it was. Manage Server only.
 */
import {
  ChannelType, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../../types/discord";
import { parseFriendlyDuration } from "../../utils/duration";
import { isObfuscatedChannel, hiddenChannelMessage } from "../../utils/channels";
import { getGuildConfig, updateGuildConfig } from "../../services/configuration";
import { incidentService } from "../../services/incidentDiscord";
import {
  formatMinutes, normalizeIncidentConfig, parseIncidentDuration, summarizeIncident,
  MAX_SLOWMODE_SECONDS, type IncidentOptions, type JoinGateAction, type LockMode,
} from "../../services/incidentLogic";
import type { IncidentRecord } from "../../services/incidentStore";
import { dashboardUrl } from "../../config/links";

/** Reads /incident start's options over the server's saved defaults. Exported for tests. */
export function startOptionsFrom(
  get: { string(name: string): string | null; integer(name: string): number | null; boolean(name: string): boolean | null; channelId(name: string): string | null },
  defaults: IncidentOptions,
): { options: IncidentOptions } | { error: string } {
  const rawDuration = get.string("duration");
  const duration = rawDuration ? parseIncidentDuration(rawDuration, parseFriendlyDuration) : { minutes: defaults.durationMinutes };
  if ("error" in duration) return duration;
  const lock = (get.string("lock") as LockMode | "channel" | null) ?? defaults.lockMode;
  const lockChannel = get.channelId("channel");
  if (lock === "channel" && !lockChannel) return { error: "Pick the `channel` to lock, or choose another `lock` option." };
  return {
    options: {
      ...defaults,
      durationMinutes: duration.minutes,
      slowmodeSeconds: get.integer("slowmode") ?? defaults.slowmodeSeconds,
      lockMode: lock === "channel" ? "selected" : lock,
      lockChannelIds: lock === "channel" ? [lockChannel!] : defaults.lockChannelIds,
      joinGate: (get.string("join_gate") as JoinGateAction | null) ?? defaults.joinGate,
      minAccountAgeDays: get.integer("min_account_age") ?? defaults.minAccountAgeDays,
      pauseInvites: get.boolean("pause_invites") ?? defaults.pauseInvites,
    },
  };
}

export function describeIncident(rec: IncidentRecord): EmbedBuilder {
  const o = rec.options;
  const ends = Math.floor(rec.endsAt.getTime() / 1000);
  return new EmbedBuilder()
    .setColor(rec.status === "ended" ? 0x57f287 : 0xed4245)
    .setTitle(rec.status === "ended" ? "Incident ended" : "🚨 Incident Mode is on")
    .setDescription(`**Reason:** ${rec.reason}\n${rec.status === "ended" ? "" : `Ends <t:${ends}:R> (<t:${ends}:t>) or with \`/incident end\`.`}`)
    .addFields(
      { name: "Summary", value: summarizeIncident({ startedAt: rec.startedAt, endedAt: rec.endedAt, counts: rec.counts, changes: rec.changes, invitesPaused: rec.invitesPaused, caseIds: rec.caseIds }).join("\n").slice(0, 1024) },
      { name: "Join gate", value: o.joinGate === "off" ? "Off" : `${o.joinGate === "kick" ? "Kick" : `Time out (${formatMinutes(o.gateTimeoutMinutes)})`} accounts under ${o.minAccountAgeDays} day(s)`, inline: true },
      { name: "Slowmode", value: o.slowmodeSeconds ? `${o.slowmodeSeconds}s` : "Off", inline: true },
    )
    .setFooter({ text: `Incident ${rec.id.slice(0, 8)} · started by ${rec.startedBy.tag}` });
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("incident")
    .setDescription("Incident Mode: raid protection that restores your server exactly when it ends.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand(sub => sub.setName("start").setDescription("Start Incident Mode (slowmode, lock, join gate, paused invites).")
      .addStringOption(o => o.setName("reason").setDescription("Why (shown in the mod log and report)").setMaxLength(300))
      .addStringOption(o => o.setName("duration").setDescription("Auto-ends after this long, up to 24h (default: server setting, 1h)").setMaxLength(16))
      .addIntegerOption(o => o.setName("slowmode").setDescription("Slowmode seconds for public channels (0 = leave slowmode alone)").setMinValue(0).setMaxValue(MAX_SLOWMODE_SECONDS))
      .addStringOption(o => o.setName("lock").setDescription("Stop @everyone sending messages").addChoices(
        { name: "Don't lock", value: "none" },
        { name: "Every public channel", value: "public" },
        { name: "One channel (pick it in `channel`)", value: "channel" },
        { name: "The channels saved on the dashboard", value: "selected" },
      ))
      .addChannelOption(o => o.setName("channel").setDescription("Channel to lock when lock is 'One channel'").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addStringOption(o => o.setName("join_gate").setDescription("What happens to new accounts that join").addChoices(
        { name: "Time them out", value: "timeout" }, { name: "Kick them", value: "kick" }, { name: "Nothing", value: "off" },
      ))
      .addIntegerOption(o => o.setName("min_account_age").setDescription("Gate accounts younger than this many days (default 7)").setMinValue(1).setMaxValue(365))
      .addBooleanOption(o => o.setName("pause_invites").setDescription("Pause server invites (Aegis needs Manage Server)")))
    .addSubcommand(sub => sub.setName("end").setDescription("End Incident Mode and restore every change it made.")
      .addStringOption(o => o.setName("reason").setDescription("Why it is over").setMaxLength(300)))
    .addSubcommand(sub => sub.setName("status").setDescription("Show the active incident, or the last one."))
    .addSubcommand(sub => sub.setName("auto").setDescription("Auto-start Incident Mode when many accounts join at once (off by default).")
      .addBooleanOption(o => o.setName("enabled").setDescription("Turn the auto-trigger on or off").setRequired(true))
      .addIntegerOption(o => o.setName("joins").setDescription("Joins that count as a burst (default 10)").setMinValue(3).setMaxValue(500))
      .addIntegerOption(o => o.setName("seconds").setDescription("Within this many seconds (default 30)").setMinValue(5).setMaxValue(600))),
  category: "moderation",
  userPermissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  cooldownMs: 3000,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "❌ Use this inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: "❌ Incident Mode needs **Manage Server**.", flags: MessageFlags.Ephemeral });
      return;
    }
    const guild = interaction.guild;
    const svc = incidentService(interaction.client);
    const sub = interaction.options.getSubcommand();
    const actor = { id: interaction.user.id, tag: interaction.user.tag };

    if (sub === "status") {
      const current = await svc.getActive(guild.id);
      const last = current ?? (await svc.list(guild.id, 1))[0] ?? null;
      if (!last) {
        await interaction.reply({ content: "No incidents yet. Start one with `/incident start`; set defaults on the dashboard's Incident page.", flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply({ content: current ? undefined : "No incident is active. The last one:", embeds: [describeIncident(last)], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === "auto") {
      const config = await getGuildConfig(guild.id);
      const current = normalizeIncidentConfig(config.incident);
      const next = normalizeIncidentConfig({
        ...current,
        autoTrigger: {
          enabled: interaction.options.getBoolean("enabled", true),
          joins: interaction.options.getInteger("joins") ?? current.autoTrigger.joins,
          seconds: interaction.options.getInteger("seconds") ?? current.autoTrigger.seconds,
        },
      });
      await updateGuildConfig(guild.id, { incident: next });
      await interaction.reply({
        content: next.autoTrigger.enabled
          ? `✅ Incident Mode will start on its own when **${next.autoTrigger.joins}** accounts join within **${next.autoTrigger.seconds}s**, using the dashboard defaults.`
          : "✅ Auto-trigger is off. Incident Mode only starts when staff run `/incident start`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "end") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result = await svc.end(guild.id, { actor, reason: interaction.options.getString("reason") ?? "Ended by staff" });
      if (!result.ok) {
        await interaction.editReply(result.error === "busy" ? "⏳ Incident Mode is changing right now; try again in a few seconds." : "No incident is active.");
        return;
      }
      await interaction.editReply({
        content: `✅ Incident ended. Restored ${result.restored} channel(s).${result.notes.length ? `\n${result.notes.slice(0, 8).map(n => `• ${n}`).join("\n")}` : ""}\nThe full report is in the mod log and on the dashboard.`,
        embeds: [describeIncident(result.incident)],
      });
      return;
    }

    // start
    const config = await getGuildConfig(guild.id);
    const defaults = normalizeIncidentConfig(config.incident).defaults;
    const parsed = startOptionsFrom({
      string: n => interaction.options.getString(n),
      integer: n => interaction.options.getInteger(n),
      boolean: n => interaction.options.getBoolean(n),
      channelId: n => interaction.options.getChannel(n)?.id ?? null,
    }, defaults);
    if ("error" in parsed) {
      await interaction.reply({ content: `❌ ${parsed.error}`, flags: MessageFlags.Ephemeral });
      return;
    }
    const picked = interaction.options.getChannel("channel");
    if (picked && isObfuscatedChannel(picked)) {
      await interaction.reply({ content: `❌ ${hiddenChannelMessage(picked.id)}`, flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await svc.start(guild.id, { options: parsed.options, reason: interaction.options.getString("reason") ?? "", trigger: "command", actor });
    if (!result.ok) {
      await interaction.editReply(result.error === "busy" ? "⏳ Incident Mode is changing right now; try again in a few seconds." : "An incident is already active. See `/incident status`, or end it with `/incident end`.");
      return;
    }
    const skipped = result.skipped.slice(0, 6).map(s => `• #${s.name}: ${s.reason}`);
    await interaction.editReply({
      content: [
        "🚨 Incident Mode is on. Staff were alerted in the mod log (no pings).",
        result.invitesNote ? `⚠️ ${result.invitesNote}` : null,
        skipped.length ? `Skipped:\n${skipped.join("\n")}${result.skipped.length > 6 ? `\n…and ${result.skipped.length - 6} more` : ""}` : null,
        `Live timeline: ${dashboardUrl(guild.id)}/incident`,
      ].filter(Boolean).join("\n"),
      embeds: [describeIncident(result.incident)],
    });
  },
};

export default command;
