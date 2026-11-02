/**
 * A cheap Undo button for quick channel and member tweaks (/lock, /slowmode,
 * /nickname). It is usable for 60 seconds and only by the moderator who ran
 * the command; the undo callback re-checks permissions before acting. Heavier
 * actions (/warn, /timeout, /ban) keep their own case-aware Undo in
 * services/moderationUndo.ts.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  PermissionFlagsBits,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type GuildBasedChannel,
  type Message,
  type Role,
} from "discord.js";
import { guardCollect } from "./collectorGuard";
import { logger } from "./logger";

/** How long the quick Undo button stays usable. */
export const QUICK_UNDO_MS = 60_000;

export type QuickUndoState = "ready" | "done" | "expired" | "failed";

/** Custom ID scoped to one command run, so two replies never share a button. */
export function quickUndoId(interactionId: string): string {
  return `qundo_${interactionId}`;
}

export function buildQuickUndoButton(customId: string, state: QuickUndoState = "ready"): ButtonBuilder {
  const label = { ready: "Undo (60s)", done: "Undone", expired: "Undo expired", failed: "Undo failed" }[state];
  return new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setEmoji("↩️")
    .setStyle(state === "ready" ? ButtonStyle.Secondary : state === "done" ? ButtonStyle.Success : ButtonStyle.Secondary)
    .setDisabled(state !== "ready");
}

export function quickUndoRow(customId: string, state: QuickUndoState = "ready"): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(buildQuickUndoButton(customId, state));
}

export type QuickUndoVerdict = "ok" | "not-author" | "expired";

/** Only the moderator who acted may undo, and only inside the window. */
export function quickUndoVerdict(authorId: string, presserId: string, actionAtMs: number, nowMs: number, windowMs = QUICK_UNDO_MS): QuickUndoVerdict {
  if (presserId !== authorId) return "not-author";
  const elapsed = nowMs - actionAtMs;
  return elapsed >= 0 && elapsed <= windowMs ? "ok" : "expired";
}

/** What an undo callback reports back: shown to the moderator privately. */
export interface QuickUndoResult {
  ok: boolean;
  message: string;
}

/** The @everyone Send Messages overwrite on a channel: true (allow), false (deny) or null (inherit). */
export function everyoneSendState(channel: GuildBasedChannel, everyone: Role): boolean | null {
  if (!("permissionOverwrites" in channel)) return null;
  const overwrite = channel.permissionOverwrites.cache.get(everyone.id);
  if (!overwrite) return null;
  if (overwrite.allow.has(PermissionFlagsBits.SendMessages)) return true;
  if (overwrite.deny.has(PermissionFlagsBits.SendMessages)) return false;
  return null;
}

export interface OfferQuickUndoOptions {
  /** The reply carrying the button. */
  message: Message;
  customId: string;
  actionAtMs: number;
  /** Other button rows on the reply to keep when the Undo button changes. */
  otherRows?: () => ActionRowBuilder<ButtonBuilder>[];
  /** Puts things back. Must re-check permissions itself. */
  undo: (presser: ButtonInteraction) => Promise<QuickUndoResult>;
}

/**
 * Listen for the Undo button for 60 seconds. Anyone else who presses it is
 * told privately that only the moderator who acted can undo.
 */
export function offerQuickUndo(interaction: ChatInputCommandInteraction, opts: OfferQuickUndoOptions): void {
  const others = () => opts.otherRows?.() ?? [];
  const collector = opts.message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: QUICK_UNDO_MS,
    filter: (i) => i.customId === opts.customId,
  });

  collector.on("collect", (i) => guardCollect("quick-undo", i, async () => {
    const verdict = quickUndoVerdict(interaction.user.id, i.user.id, opts.actionAtMs, Date.now());
    if (verdict === "not-author") {
      await i.reply({ content: `↩️ Only ${interaction.user.tag} can undo this.`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
      return;
    }
    if (verdict === "expired") {
      await i.reply({ content: "⌛ The undo window has closed. Run the command again to change it back.", flags: MessageFlags.Ephemeral });
      return;
    }
    await i.deferUpdate();
    const result = await opts.undo(i).catch((err): QuickUndoResult => {
      logger.warn(`Quick undo failed for ${opts.customId}`, err);
      return { ok: false, message: "❌ I couldn't undo that. Check my permissions and try the command again." };
    });
    if (result.ok) collector.stop("done");
    await interaction.editReply({ components: [...others(), quickUndoRow(opts.customId, result.ok ? "done" : "failed")] }).catch(() => null);
    await i.followUp({ content: result.message, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }).catch(() => null);
  }));

  collector.on("end", async (_collected, reason) => {
    if (reason === "done") return;
    const rows = others();
    await interaction.editReply({ components: rows }).catch(() => null);
  });
}
