/**
 * The DMs /ban sends: the ban notice (now with the length and end time for a
 * temporary ban, which the member was never told) and the appeal code.
 * Split from ban.ts to keep it under the 400-line limit.
 */
import { EmbedBuilder, type Guild, type User } from "discord.js";
import { BanAppealModel } from "../../../database/mongo";
import { logger } from "../../../utils/logger";
import { softFail } from "../../../utils/softFail";
import { generateAppealCode } from "../appeal";

/** The ban notice embed. `endsAtMs` is set for a temporary ban. Pure. */
export function banNoticeEmbed(guildName: string, reason: string, temp: { label: string; endsAtMs: number } | null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle(`🔨 You have been banned from **${guildName}**`)
    .addFields({ name: "📝 Reason", value: reason })
    .setFooter({ text: "If you believe this was a mistake, please contact server staff." })
    .setTimestamp();
  if (temp) {
    embed.addFields(
      { name: "⏳ Length", value: temp.label, inline: true },
      { name: "🔓 Ends", value: `<t:${Math.floor(temp.endsAtMs / 1000)}:F> (<t:${Math.floor(temp.endsAtMs / 1000)}:R>)`, inline: true },
    );
  }
  return embed;
}

export async function sendBanNotice(target: User, embed: EmbedBuilder): Promise<boolean> {
  return (await target.send({ embeds: [embed] }).catch(softFail(`Ban notice DM to ${target.id}`, "debug"))) !== null;
}

/**
 * Create the appeal record and, unless silent, DM the code with instructions.
 * Never throws: returns an empty code when the record could not be saved.
 */
export async function issueAppealCode(input: {
  guild: Guild;
  target: User;
  moderatorId: string;
  reason: string;
  silent: boolean;
}): Promise<{ appealCode: string; appealDelivered: boolean }> {
  const { guild, target, reason } = input;
  try {
    const appealCode = generateAppealCode();
    await BanAppealModel.create({ appealCode, guildId: guild.id, userId: target.id, moderatorId: input.moderatorId, banReason: reason });
    if (input.silent) return { appealCode, appealDelivered: false };
    const appealEmbed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle("📋 You Have Been Banned — Appeal Information")
      .setDescription(
        `You were banned from **${guild.name}**.\n\n` +
        `If you believe this was a mistake, you may submit a ban appeal.\n` +
        `**Your appeal code is: \`${appealCode}\`**\n\n` +
        `To submit your appeal:\n` +
        `1. Join a server where **Aegis** is present\n` +
        `2. Use the command: \`/appeal submit code:${appealCode}\`\n` +
        `3. Staff will review your appeal and DM you the decision.`,
      )
      .addFields(
        { name: "📝 Ban Reason", value: reason, inline: false },
        { name: "🆔 Appeal Code", value: `\`${appealCode}\``, inline: true },
        { name: "📅 Banned On", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      )
      .setFooter({ text: `Aegis Ban Appeal System • ${guild.name}` })
      .setTimestamp();
    const appealDelivered = (await target.send({ embeds: [appealEmbed] }).catch(softFail(`Appeal code DM to ${target.id}`, "debug"))) !== null;
    return { appealCode, appealDelivered };
  } catch (err) {
    logger.warn(`Failed to create/send appeal for ban of ${target.id} in ${guild.id}:`, err);
    return { appealCode: "", appealDelivered: false };
  }
}

/** The Appeal Code field on the moderator's result embed. Pure. */
export function appealFieldText(appealCode: string, silent: boolean, delivered: boolean): string {
  if (silent) return `\`${appealCode}\` — not sent (silent); share it if you want them to appeal`;
  return delivered
    ? `\`${appealCode}\` — DM sent with instructions`
    : `\`${appealCode}\` — the DM didn't go through; share it if you want them to appeal`;
}
