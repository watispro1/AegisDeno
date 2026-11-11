/**
 * /massban: ban up to 50 pasted user IDs at once (raid clean-up), with the
 * same hierarchy rules as /ban, a confirmation step, one case per ban and a
 * single mod-log entry. Members get no DM and no appeal code.
 */
import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Guild,
} from "discord.js";
import type { Command } from "../../types/discord";
import { requestConfirmation } from "../../utils/confirmation";
import { auditReason, truncate } from "../../utils/safeText";
import { addModerationCases } from "../../services/moderationCases";
import { sendGuildLog } from "../../services/logging";
import { MASS_BAN_MAX, idList, parseUserIds, planMassBan, summarizeSkips, type MassBanPlan } from "../../services/massBan";
import { logger } from "../../utils/logger";

/** Progress is edited into the reply every this many bans. */
const PROGRESS_EVERY = 10;

async function buildPlan(guild: Guild, actorId: string, ids: readonly string[]): Promise<MassBanPlan | null> {
  const me = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
  const actor = await guild.members.fetch(actorId).catch(() => null);
  if (!me || !actor) return null;
  // One gateway request for every ID; IDs not in the server are just missing.
  const members = await guild.members.fetch({ user: [...ids], time: 15_000 }).catch(() => null);
  if (!members) return null;
  const memberTops = new Map<string, number>();
  for (const [id, m] of members) memberTops.set(id, m.roles.highest.position);
  // Only people outside the server can already be banned; check just those.
  const alreadyBanned = new Set<string>();
  const outside = ids.filter(id => !memberTops.has(id));
  for (let i = 0; i < outside.length; i += 5) {
    const chunk = outside.slice(i, i + 5);
    const bans = await Promise.all(chunk.map(id => guild.bans.fetch({ user: id, force: true }).catch(() => null)));
    bans.forEach((ban, n) => { if (ban) alreadyBanned.add(chunk[n]); });
  }
  return planMassBan(ids, {
    actorId,
    botId: me.id,
    ownerId: guild.ownerId,
    actorTop: actor.roles.highest.position,
    botTop: me.roles.highest.position,
    memberTops,
    alreadyBanned,
  });
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("massban")
    .setDescription(`Ban up to ${MASS_BAN_MAX} users by ID at once (raid clean-up), with confirmation.`)
    .setDMPermission(false)
    .addStringOption(opt =>
      opt.setName("user_ids").setDescription("User IDs or mentions, separated by spaces, commas or new lines").setRequired(true).setMaxLength(2000))
    .addStringOption(opt =>
      opt.setName("reason").setDescription("Reason recorded on every case and in the audit log").setRequired(true).setMaxLength(400))
    .addIntegerOption(opt =>
      opt.setName("delete_messages").setDescription("Delete their messages from this many days (0–7, default 1)").setMinValue(0).setMaxValue(7))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.BanMembers],
  botPermissions: [PermissionFlagsBits.BanMembers],
  // A run can issue 50 bans; one at a time per moderator is plenty.
  cooldownMs: 30_000,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    if (!guild) return;
    const parsed = parseUserIds(interaction.options.getString("user_ids", true));
    const reason = interaction.options.getString("reason", true).trim() || "No reason provided";
    const deleteDays = interaction.options.getInteger("delete_messages") ?? 1;

    if (parsed.ids.length === 0) {
      await interaction.reply({ content: "❌ No user IDs found. Paste IDs (17–20 digits) or mentions, separated by spaces, commas or new lines. Turn on Developer Mode to copy IDs (User Settings → Advanced).", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const plan = await buildPlan(guild, interaction.user.id, parsed.ids);
    if (!plan) {
      await interaction.editReply("❌ I couldn't look up the members right now (Discord didn't answer). Nothing was done; try again in a minute.");
      return;
    }
    const capNote = parsed.overCap ? `${parsed.overCap} ID(s) past the first ${MASS_BAN_MAX} were left out; run it again for those.` : "";
    const skipNote = summarizeSkips(plan.skipped);
    if (plan.ban.length === 0) {
      await interaction.editReply(["❌ Nobody to ban.", skipNote, capNote].filter(Boolean).join("\n"));
      return;
    }

    const answer = await requestConfirmation(interaction, {
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle(`🔨 Ban ${plan.ban.length} user${plan.ban.length === 1 ? "" : "s"}?`)
          .setDescription("They get no DM and no appeal code. Each ban gets its own case. Undo them one at a time with `/unban`.")
          .addFields(
            { name: "Reason", value: truncate(reason, 1024) },
            { name: "Will be banned", value: idList(plan.ban) },
            { name: "Messages deleted", value: `${deleteDays} day(s)`, inline: true },
            ...(skipNote ? [{ name: "Skipped", value: truncate(skipNote, 1024), inline: true }] : []),
            ...(capNote ? [{ name: "Over the limit", value: capNote }] : []),
          ),
      ],
      confirmLabel: `Ban ${plan.ban.length}`,
    });
    if (answer !== "confirmed") return;

    // Roles can change while the prompt is open: plan again before acting.
    const fresh = await buildPlan(guild, interaction.user.id, plan.ban);
    if (!fresh) {
      await interaction.editReply({ content: "❌ I couldn't re-check the members (Discord didn't answer). Nothing was done.", embeds: [] });
      return;
    }

    const banned: string[] = [];
    const failed: string[] = [];
    const audit = auditReason(`Mass ban by ${interaction.user.tag}: ${reason}`);
    for (const [n, id] of fresh.ban.entries()) {
      try {
        await guild.members.ban(id, { reason: audit, deleteMessageSeconds: deleteDays * 86_400 });
        banned.push(id);
      } catch (err) {
        failed.push(id);
        logger.warn(`Mass ban: could not ban ${id} in ${guild.id}:`, err);
      }
      if ((n + 1) % PROGRESS_EVERY === 0 && n + 1 < fresh.ban.length) {
        await interaction.editReply({ content: `⏳ Banning… ${n + 1}/${fresh.ban.length}`, embeds: [] }).catch(() => null);
      }
    }

    const caseIds = await addModerationCases(banned.map(userId => ({
      guildId: guild.id,
      userId,
      moderatorId: interaction.user.id,
      action: "ban" as const,
      reason,
      details: `Mass ban of ${banned.length} | Deleted messages: ${deleteDays} day(s)`,
    })));

    const lateSkips = summarizeSkips(fresh.skipped);
    const summary = new EmbedBuilder()
      .setColor(failed.length ? 0xFEE75C : 0x57F287)
      .setTitle(`🔨 Banned ${banned.length} of ${fresh.ban.length + fresh.skipped.length}`)
      .addFields(
        { name: "Banned", value: idList(banned) },
        ...(failed.length ? [{ name: "Failed", value: `${idList(failed, 900)}\nCheck my Ban Members permission and role position, then run \`/massban\` again for these.` }] : []),
        ...(lateSkips ? [{ name: "Skipped after re-check", value: truncate(lateSkips, 1024) }] : []),
        ...(banned.length && caseIds.length === 0 ? [{ name: "⚠️ Cases", value: "The bans worked but the cases could not be saved." }] : []),
      );
    await interaction.editReply({ content: "", embeds: [summary] });

    if (banned.length) {
      await sendGuildLog(interaction.client, guild.id, {
        title: `🔨 Mass Ban (${banned.length})`,
        color: 0xED4245,
        description: `**Moderator:** ${interaction.user.tag} (<@${interaction.user.id}>)\n**Reason:** ${truncate(reason, 400)}\n**Messages deleted:** ${deleteDays} day(s)`,
        fields: [
          { name: "Banned", value: idList(banned) },
          ...(failed.length ? [{ name: "Failed", value: idList(failed) }] : []),
        ],
      }, "modActions");
    }
  },
};

export default command;
