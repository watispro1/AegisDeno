/**
 * Shared look and feel for the economy commands: one embed shape for every
 * result (title, line, Wallet/Bank fields, footer), friendly cooldown text,
 * and a private-error helper that works before or after a reply.
 * Lives in a subfolder so the command loader doesn't treat it as a command.
 */
import { EmbedBuilder, MessageFlags, type APIEmbedField, type ChatInputCommandInteraction } from "discord.js";
import { formatCoins, type EconomyConfig } from "../../../services/economyLogic";
import { NO_PINGS } from "../../../services/economyDiscord";
import { COLORS, footer } from "../../../utils/embedStyle";

export type Tone = keyof typeof COLORS;

/** "2d 4h", "2h 13m", "4m 10s", "12s". Never shorter than 1s. */
export function formatDuration(ms: number): string {
  const total = Math.max(1, Math.ceil(ms / 1000));
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 && m < 10 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

/**
 * How long until a cooldown ends, for a private reply: "in **2h 13m** (<t:…:t>)".
 * The clock time renders in the reader's own timezone; a wait of a day or
 * more shows the date too.
 */
export function waitText(retryAt: number, now = Date.now()): string {
  const left = retryAt - now;
  if (left <= 0) return "now";
  const style = left >= 20 * 3_600_000 ? "f" : "t";
  return `in **${formatDuration(left)}** (<t:${Math.ceil(retryAt / 1000)}:${style}>)`;
}

/** "✅ Ready" or "⏳ 2h 13m · <t:…:R>" for status fields that stay on screen. */
export function readyText(retryAt: number | null, command: string, now = Date.now()): string {
  if (retryAt === null || retryAt <= now) return `✅ Ready, run \`/${command}\``;
  return `⏳ ${formatDuration(retryAt - now)} · <t:${Math.ceil(retryAt / 1000)}:R>`;
}

export interface BalanceAfter { wallet?: number | null; bank?: number | null; bankCap?: number }

/** Wallet and Bank fields, in that order, for whichever are known. */
export function balanceFields(cfg: EconomyConfig, b: BalanceAfter): APIEmbedField[] {
  const fields: APIEmbedField[] = [];
  if (typeof b.wallet === "number") fields.push({ name: "👛 Wallet", value: formatCoins(cfg, b.wallet), inline: true });
  if (typeof b.bank === "number") {
    const cap = b.bankCap && b.bankCap > 0 ? ` / ${formatCoins(cfg, b.bankCap)}` : "";
    fields.push({ name: "🏦 Bank", value: `${formatCoins(cfg, b.bank)}${cap}`, inline: true });
  }
  return fields;
}

export interface ResultEmbed {
  tone: Tone;
  title?: string;
  description?: string;
  balance?: BalanceAfter;
  fields?: APIEmbedField[];
  footer?: string | null;
}

/** The one embed shape every economy result uses: balance first, then the command's own fields. */
export function economyEmbed(cfg: EconomyConfig, r: ResultEmbed): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(COLORS[r.tone]);
  if (r.title) embed.setTitle(r.title);
  if (r.description) embed.setDescription(r.description);
  const fields = [...(r.balance ? balanceFields(cfg, r.balance) : []), ...(r.fields ?? [])];
  if (fields.length) embed.addFields(fields.slice(0, 25));
  if (r.footer !== undefined) embed.setFooter(footer(r.footer));
  return embed;
}

/** Say something privately, whether or not the command already replied (e.g. after a confirmation prompt). */
export async function sayPrivately(interaction: ChatInputCommandInteraction, content: string): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content, embeds: [], components: [], allowedMentions: NO_PINGS }).catch(() => null);
    return;
  }
  await interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });
}

/** The message shown when another economy action of the same member is still running. */
export const STILL_RUNNING = "⏳ Your last economy action is still finishing. Give it a second and run this again.";
