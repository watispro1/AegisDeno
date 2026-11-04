/**
 * Winner DMs for giveaways. Sent whether or not the giveaway's channel can
 * still be reached: a deleted or hidden channel used to skip the DMs, so
 * winners never heard they had won.
 */
import { EmbedBuilder } from "discord.js";
import { logger } from "../utils/logger";
import { truncate } from "../utils/safeText";

export type WinnerNoticeKind = "won" | "rerolled";

interface NotifiableGiveaway {
  guildId: string;
  channelId: string;
  messageId: string;
  prize: string;
  hostId?: string | null;
}

interface DmUser { send(options: { embeds: EmbedBuilder[] }): Promise<unknown> }

/** The bits of the client used here, so tests can pass a fake. */
export interface NotifyClient {
  users: { cache: { get(id: string): DmUser | undefined }; fetch(id: string): Promise<DmUser> };
  guilds: { cache: { get(id: string): { name: string } | undefined } };
}

export function winnerDmEmbed(g: NotifiableGiveaway, kind: WinnerNoticeKind, guildName: string | null): EmbedBuilder {
  const where = guildName ? `in **${truncate(guildName, 100)}**` : "in a server you're in";
  const jump = `https://discord.com/channels/${g.guildId}/${g.channelId}/${g.messageId}`;
  return new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle(kind === "won" ? "🎉 You won a giveaway!" : "🎉 You were drawn in a giveaway reroll!")
    .setDescription(`You were picked as a winner ${where}. [Jump to the giveaway](${jump})`)
    .addFields(
      { name: "🏆 Prize", value: truncate(g.prize, 1024) },
      ...(g.hostId ? [{ name: "👤 Host", value: `<@${g.hostId}> (contact them to claim your prize)` }] : []),
    )
    .setTimestamp();
}

/** DM every winner. Returns how many DMs were delivered (closed DMs are skipped quietly). */
export async function notifyWinners(client: NotifyClient, g: NotifiableGiveaway, winners: readonly string[], kind: WinnerNoticeKind): Promise<number> {
  const guildName = client.guilds.cache.get(g.guildId)?.name ?? null;
  const embed = winnerDmEmbed(g, kind, guildName);
  let delivered = 0;
  for (const winnerId of winners) {
    const user = client.users.cache.get(winnerId) ?? await client.users.fetch(winnerId).catch(() => null);
    if (!user) continue;
    const sent = await user.send({ embeds: [embed] }).then(() => true, () => false);
    if (sent) delivered++;
  }
  if (winners.length && delivered < winners.length) {
    logger.debug(`Giveaway ${g.messageId}: ${winners.length - delivered} winner DM(s) not delivered (DMs closed or user gone).`);
  }
  return delivered;
}
