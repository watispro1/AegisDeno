/**
 * /trust user — explainable Trust Score v2 for one member (Moderate Members, ephemeral).
 * /trust config — settings and opt-in integrations (Manage Server).
 * The older /trustscore command keeps working unchanged.
 */
import {
  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, MessageFlags, type Role,
} from "discord.js";
import { Command } from "../../types/discord";
import { getGuildConfig, updateGuildConfig } from "../../services/configuration";
import { clearTrustCache, getMemberTrust, subjectFromMember } from "../../services/trustService";
import {
  TRUST_PRESETS, formatPoints, isLowTrust, normalizeTrustConfig, type TrustConfig, type TrustResult, type TrustPreset,
} from "../../services/trustEngine";
import { scoreBar } from "../../services/trustScore";
import { sendGuildLog } from "../../services/logging";

const BAND_COLOR: Record<TrustResult["band"], number> = {
  trusted: 0x57f287, established: 0x5865f2, neutral: 0xfee75c, low: 0xffa500, "high-risk": 0xed4245,
};

export function trustEmbed(tag: string, avatar: string | null, r: TrustResult, config: TrustConfig): EmbedBuilder {
  const lines = r.factors.map(f => `\`${formatPoints(f.points).padStart(6)}\` **${f.label}** · ${f.detail}`);
  return new EmbedBuilder()
    .setColor(BAND_COLOR[r.band])
    .setAuthor({ name: `Trust Score — ${tag}`, iconURL: avatar ?? undefined })
    .setTitle(`${r.score}/100 · ${r.bandLabel}`)
    .setDescription(`\`${scoreBar(r.score)}\`${isLowTrust(r.score, config) ? `\n⚠️ Below this server's low-trust threshold (${config.lowThreshold}).` : ""}`)
    .addFields({ name: "Why", value: lines.join("\n").slice(0, 1024) })
    .setFooter({ text: `Preset: ${r.preset} · counts and dates only, never message content` });
}

export function describeTrustConfig(c: TrustConfig): string {
  return [
    `**Integrations:** ${c.enabled ? "on" : "off"}`,
    `**Preset:** ${c.preset}`,
    `**Low-trust threshold:** below ${c.lowThreshold}`,
    `**Link filter only for low trust:** ${c.linkFilterLowTrustOnly ? "yes" : "no"}`,
    `**Incident join gate uses trust:** ${c.incidentGate ? "yes" : "no"}`,
    `**Low-trust role on join:** ${c.lowTrustRoleId ? `<@&${c.lowTrustRoleId}>` : "off"}`,
  ].join("\n");
}

/** Why a role can't be the low-trust role, or null. Same hierarchy rule as the dashboard. */
export function lowTrustRoleProblem(role: Pick<Role, "id" | "managed" | "position">, guildId: string, botTop: number, actorTop: number, actorIsOwner: boolean): string | null {
  if (role.id === guildId) return "@everyone can't be the low-trust role.";
  if (role.managed) return "That role is managed by an integration.";
  if (role.position >= botTop) return "That role is above (or equal to) Aegis's highest role, so Aegis can't give it.";
  if (!actorIsOwner && role.position >= actorTop) return "That role is above (or equal to) your highest role.";
  return null;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("trust")
    .setDescription("Explainable Trust Score for members, and its settings.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(s => s.setName("user").setDescription("Show a member's Trust Score with every factor explained")
      .addUserOption(o => o.setName("user").setDescription("Member to check").setRequired(true)))
    .addSubcommand(s => s.setName("config").setDescription("Trust Score settings and integrations (Manage Server)")
      .addBooleanOption(o => o.setName("enabled").setDescription("Turn the integrations below on or off"))
      .addStringOption(o => o.setName("preset").setDescription("How strict the score is")
        .addChoices(...TRUST_PRESETS.map(p => ({ name: p, value: p }))))
      .addIntegerOption(o => o.setName("threshold").setDescription("Scores below this are low trust (5–90, default 30)").setMinValue(5).setMaxValue(90))
      .addBooleanOption(o => o.setName("link_filter_low_trust_only").setDescription("Automod link filter only applies to low-trust members"))
      .addBooleanOption(o => o.setName("incident_gate").setDescription("Incident Mode's join gate also gates low-trust joins"))
      .addRoleOption(o => o.setName("low_trust_role").setDescription("Give this role to low-trust members when they join"))
      .addBooleanOption(o => o.setName("clear_low_trust_role").setDescription("Stop giving a low-trust role"))),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guild = interaction.guild!;
    const sub = interaction.options.getSubcommand();
    const current = normalizeTrustConfig((await getGuildConfig(guild.id)).trust);

    if (sub === "user") {
      const user = interaction.options.getUser("user", true);
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        await interaction.editReply("❌ That user isn't in this server, so there is no tenure or roles to score. Use `/case` or the dashboard member page for their record.");
        return;
      }
      if (user.bot) {
        await interaction.editReply("🤖 Bots aren't scored: only someone with Manage Server can add one.");
        return;
      }
      const result = await getMemberTrust(subjectFromMember(member), { fresh: true, preset: current.preset });
      await interaction.editReply({ embeds: [trustEmbed(user.tag, user.displayAvatarURL(), result, current)] });
      return;
    }

    // config
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: "❌ Changing Trust Score settings needs **Manage Server**.", flags: MessageFlags.Ephemeral });
      return;
    }
    const enabled = interaction.options.getBoolean("enabled");
    const preset = interaction.options.getString("preset") as TrustPreset | null;
    const threshold = interaction.options.getInteger("threshold");
    const links = interaction.options.getBoolean("link_filter_low_trust_only");
    const gate = interaction.options.getBoolean("incident_gate");
    const role = interaction.options.getRole("low_trust_role");
    const clearRole = interaction.options.getBoolean("clear_low_trust_role") === true;

    const changed = [enabled, preset, threshold, links, gate, role].some(v => v !== null) || clearRole;
    if (!changed) {
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("Trust Score settings").setDescription(describeTrustConfig(current))], flags: MessageFlags.Ephemeral });
      return;
    }
    if (role && clearRole) {
      await interaction.reply({ content: "❌ Pick a low-trust role or clear it, not both.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (role) {
      const me = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
      const actor = await guild.members.fetch(interaction.user.id).catch(() => null);
      const problem = lowTrustRoleProblem(
        { id: role.id, managed: Boolean(role.managed), position: role.position }, guild.id,
        me?.roles.highest.position ?? 0, actor?.roles.highest.position ?? 0, guild.ownerId === interaction.user.id,
      );
      if (problem) {
        await interaction.reply({ content: `❌ ${problem}`, flags: MessageFlags.Ephemeral });
        return;
      }
    }
    const next = normalizeTrustConfig({
      ...current,
      ...(enabled !== null ? { enabled } : {}),
      ...(preset ? { preset } : {}),
      ...(threshold !== null ? { lowThreshold: threshold } : {}),
      ...(links !== null ? { linkFilterLowTrustOnly: links } : {}),
      ...(gate !== null ? { incidentGate: gate } : {}),
      ...(role ? { lowTrustRoleId: role.id } : {}),
      ...(clearRole ? { lowTrustRoleId: null } : {}),
    });
    await updateGuildConfig(guild.id, { trust: next });
    clearTrustCache(guild.id);
    await sendGuildLog(interaction.client, guild.id, {
      title: "🧭 Trust Score settings changed",
      color: 0x5865f2,
      description: `${interaction.user.tag} (<@${interaction.user.id}>) updated Trust Score settings.\n\n${describeTrustConfig(next)}`,
    }, "modActions").catch(() => null);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x57f287).setTitle("✅ Trust Score settings saved").setDescription(describeTrustConfig(next))
        .setFooter({ text: next.enabled ? "Integrations are on." : "Integrations are off: /trust user still works." })],
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
