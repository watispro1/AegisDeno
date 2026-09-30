import {
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  InteractionCollector,
  ButtonInteraction,
} from "discord.js";

/**
 * Sends a confirmation prompt with Confirm / Cancel buttons and waits for the user's response.
 * Returns true if the user clicked Confirm, false otherwise (cancel, timeout, or error).
 */
export async function requestConfirmation(
  interaction: ChatInputCommandInteraction,
  promptMessage: string,
  timeoutMs = 15_000
): Promise<boolean> {
  const yesId = `confirm_yes_${interaction.id}`;
  const noId  = `confirm_no_${interaction.id}`;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(yesId)
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("✅"),
    new ButtonBuilder()
      .setCustomId(noId)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("❌"),
  );

  await interaction.reply({
    content: promptMessage,
    components: [row],
    ephemeral: true,
  });

  try {
    const response = await interaction.channel?.awaitMessageComponent({
      filter: (i: ButtonInteraction) =>
        (i.customId === yesId || i.customId === noId) && i.user.id === interaction.user.id,
      componentType: ComponentType.Button,
      time: timeoutMs,
    });

    if (!response) return false;
    await response.deferUpdate();
    return response.customId === yesId;
  } catch {
    // Timeout or collector error — treat as cancel
    await interaction.editReply({ content: "⏱️ Confirmation timed out.", components: [] }).catch(() => null);
    return false;
  }
}
