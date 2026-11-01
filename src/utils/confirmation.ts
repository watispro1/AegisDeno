import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type EmbedBuilder,
  type Message,
} from "discord.js";

/** How long a destructive-action prompt waits before giving up. */
export const CONFIRMATION_TIMEOUT_MS = 30_000;

export type ConfirmationResult = "confirmed" | "cancelled" | "timeout";

export interface ConfirmationIds {
  yes: string;
  no: string;
}

/** Button custom IDs scoped to one interaction so two prompts never cross. */
export function confirmationIds(interactionId: string): ConfirmationIds {
  return { yes: `confirm_yes_${interactionId}`, no: `confirm_no_${interactionId}` };
}

/** The Confirm / Cancel row. The confirm button is red because the action cannot be undone. */
export function confirmationRow(ids: ConfirmationIds, confirmLabel = "Confirm"): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(ids.yes).setLabel(confirmLabel.slice(0, 80)).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(ids.no).setLabel("Cancel").setStyle(ButtonStyle.Secondary),
  );
}

/** True when a button press belongs to this prompt and comes from the person who ran the command. */
export function isConfirmationClick(ids: ConfirmationIds, invokerId: string, click: { customId: string; user: { id: string } }): boolean {
  return (click.customId === ids.yes || click.customId === ids.no) && click.user.id === invokerId;
}

export interface ConfirmationPrompt {
  content?: string;
  embeds?: EmbedBuilder[];
  /** Label for the red button, e.g. "Delete case". */
  confirmLabel?: string;
  timeoutMs?: number;
}

/**
 * Ask the invoker to confirm a destructive action with Confirm / Cancel buttons.
 *
 * Works whether or not the interaction was already deferred: a fresh
 * interaction gets an ephemeral prompt, a deferred one has its reply edited.
 * Listens on the prompt message itself, so it does not depend on the channel
 * being cached or visible to Aegis. On Cancel or timeout the prompt is
 * replaced with a short note and nothing is changed; on Confirm the buttons
 * are removed and the caller edits the reply with the outcome.
 */
export async function requestConfirmation(
  interaction: ChatInputCommandInteraction,
  prompt: ConfirmationPrompt | string,
): Promise<ConfirmationResult> {
  const p: ConfirmationPrompt = typeof prompt === "string" ? { content: prompt } : prompt;
  const ids = confirmationIds(interaction.id);
  const payload = {
    content: p.content ?? "",
    embeds: p.embeds ?? [],
    components: [confirmationRow(ids, p.confirmLabel)],
  };

  let message: Message | null | undefined;
  if (interaction.deferred || interaction.replied) {
    message = await interaction.editReply(payload).catch(() => null);
  } else {
    const response = await interaction
      .reply({ ...payload, flags: MessageFlags.Ephemeral, withResponse: true })
      .catch(() => null);
    message = response?.resource?.message;
  }
  if (!message) return "cancelled";

  let click: ButtonInteraction;
  try {
    click = await message.awaitMessageComponent({
      componentType: ComponentType.Button,
      time: p.timeoutMs ?? CONFIRMATION_TIMEOUT_MS,
      filter: (i) => isConfirmationClick(ids, interaction.user.id, i),
    });
  } catch {
    await interaction
      .editReply({ content: "⏱️ No answer, so nothing was changed.", embeds: [], components: [] })
      .catch(() => null);
    return "timeout";
  }

  await click.deferUpdate().catch(() => null);
  if (click.customId !== ids.yes) {
    await interaction.editReply({ content: "Cancelled. Nothing was changed.", embeds: [], components: [] }).catch(() => null);
    return "cancelled";
  }
  await interaction.editReply({ components: [] }).catch(() => null);
  return "confirmed";
}
