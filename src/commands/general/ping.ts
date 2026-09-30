import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { Command } from "../../types/discord";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check the bot's latency and responsiveness."),

  execute: async (interaction: ChatInputCommandInteraction) => {
    const generateEmbed = (messageLatency: number, apiLatency: number) => {
      return new EmbedBuilder()
        .setColor(messageLatency < 100 ? 0x57F287 : messageLatency < 250 ? 0xFEE75C : 0xED4245)
        .setTitle("🏓 Pong!")
        .addFields(
          { name: "Message Latency", value: `\`${messageLatency}ms\``, inline: true },
          { name: "API Latency",     value: `\`${apiLatency}ms\``, inline: true },
        )
        .setTimestamp();
    };

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("ping_refresh")
        .setLabel("Refresh")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🔄")
    );

    const sent = await interaction.reply({ content: "🏓 Pinging...", fetchReply: true });
    const initialLatency = sent.createdTimestamp - interaction.createdTimestamp;

    await interaction.editReply({
      content: null,
      embeds: [generateEmbed(initialLatency, Math.round(interaction.client.ws.ping))],
      components: [row]
    });

    // Create a collector for the refresh button
    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000,
      filter: i => i.customId === "ping_refresh" && i.user.id === interaction.user.id,
    });

    collector.on("collect", async (i) => {
      const pingSent = await i.deferUpdate({ fetchReply: true });
      const newLatency = pingSent.createdTimestamp - i.createdTimestamp;
      await interaction.editReply({
        embeds: [generateEmbed(newLatency, Math.round(interaction.client.ws.ping))],
        components: [row]
      });
    });

    collector.on("end", () => {
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("ping_refresh")
          .setLabel("Refresh")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🔄")
          .setDisabled(true)
      );
      interaction.editReply({ components: [disabledRow] }).catch(() => null);
    });
  },
};
