import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  TextChannel,
  PermissionFlagsBits,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ModalSubmitInteraction,
} from "discord.js";
import { Command } from "../../types/discord";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Create and post a fully customized rich embed message.")
    .addSubcommand(sub =>
      sub
        .setName("builder")
        .setDescription("Open an interactive embed builder with live preview and modal editor.")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Target channel to post the embed").setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName("title").setDescription("Embed title").setRequired(true).setMaxLength(256)
        )
        .addStringOption(opt =>
          opt.setName("color").setDescription("Hex color (e.g. #5865F2)").setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName("footer").setDescription("Footer text").setRequired(false).setMaxLength(2048)
        )
        .addStringOption(opt =>
          opt.setName("image").setDescription("Large image URL (shown at bottom)").setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName("thumbnail").setDescription("Small thumbnail URL (top-right corner)").setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName("author").setDescription("Author name shown above the title").setRequired(false).setMaxLength(256)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("quick")
        .setDescription("Quickly post a simple embed without interactive preview.")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Target channel").setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName("title").setDescription("Embed title").setRequired(true).setMaxLength(256)
        )
        .addStringOption(opt =>
          opt.setName("description").setDescription("Embed body text").setRequired(true).setMaxLength(4000)
        )
        .addStringOption(opt =>
          opt.setName("color").setDescription("Hex color (e.g. #5865F2)").setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName("footer").setDescription("Footer text").setRequired(false)
        )
    ),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageMessages],
  botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();

    const parseColor = (input: string | null): number => {
      if (!input) return 0x5865F2;
      return parseInt(input.replace("#", ""), 16) || 0x5865F2;
    };

    // ─── QUICK MODE ──────────────────────────────────────────────────────────
    if (sub === "quick") {
      const channel = interaction.options.getChannel("channel", true);
      const title = interaction.options.getString("title", true);
      const description = interaction.options.getString("description", true).replace(/\\n/g, "\n");
      const color = parseColor(interaction.options.getString("color"));
      const footer = interaction.options.getString("footer");

      if (!("send" in channel) || typeof (channel as any).send !== "function") {
        return interaction.reply({ content: "❌ Please select a valid text channel.", ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();
      if (footer) embed.setFooter({ text: footer });

      await (channel as TextChannel).send({ embeds: [embed] }).catch(() => null);
      return interaction.reply({ content: `✅ Embed posted to <#${channel.id}>.`, ephemeral: true });
    }

    // ─── BUILDER MODE ─────────────────────────────────────────────────────────
    const channel = interaction.options.getChannel("channel", true);
    const title = interaction.options.getString("title", true);
    const color = parseColor(interaction.options.getString("color"));
    const footer = interaction.options.getString("footer");
    const image = interaction.options.getString("image");
    const thumbnail = interaction.options.getString("thumbnail");
    const author = interaction.options.getString("author");

    if (!("send" in channel) || typeof (channel as any).send !== "function") {
      return interaction.reply({ content: "❌ Please select a valid text channel.", ephemeral: true });
    }

    let description = "*Click **Edit Description** to write the embed body...*";

    const buildEmbed = () => {
      const e = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();
      if (footer) e.setFooter({ text: footer });
      if (image) e.setImage(image);
      if (thumbnail) e.setThumbnail(thumbnail);
      if (author) e.setAuthor({ name: author });
      return e;
    };

    const buildButtons = (sent: boolean) => new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("embed_edit_desc")
        .setLabel("Edit Description")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("✏️"),
      new ButtonBuilder()
        .setCustomId("embed_send")
        .setLabel("Post Embed")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🚀")
        .setDisabled(sent),
      new ButtonBuilder()
        .setCustomId("embed_cancel")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("✖️"),
    );

    const sent = await interaction.reply({
      content: `👇 **Embed Preview** — Posting to <#${channel.id}>`,
      embeds: [buildEmbed()],
      components: [buildButtons(false)],
      ephemeral: true,
      fetchReply: true,
    });

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300_000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    let posted = false;

    collector.on("collect", async (i) => {
      if (i.customId === "embed_cancel") {
        collector.stop();
        await i.update({ content: "❌ Embed creation cancelled.", embeds: [], components: [] });
        return;
      }

      if (i.customId === "embed_edit_desc") {
        const modal = new ModalBuilder()
          .setCustomId("embed_desc_modal")
          .setTitle("Edit Embed Description");

        const input = new TextInputBuilder()
          .setCustomId("embed_desc_input")
          .setLabel("Description (supports \\n for newlines)")
          .setStyle(TextInputStyle.Paragraph)
          .setValue(description === "*Click **Edit Description** to write the embed body...*" ? "" : description)
          .setMaxLength(4000)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        await i.showModal(modal);

        const modalSubmit = await i.awaitModalSubmit({ time: 180_000 }).catch(() => null) as ModalSubmitInteraction | null;
        if (!modalSubmit) return;

        description = modalSubmit.fields.getTextInputValue("embed_desc_input").replace(/\\n/g, "\n");
        await modalSubmit.deferUpdate();
        await interaction.editReply({ embeds: [buildEmbed()], components: [buildButtons(posted)] });
        return;
      }

      if (i.customId === "embed_send") {
        posted = true;
        await (channel as TextChannel).send({ embeds: [buildEmbed()] }).catch(() => null);
        await i.update({
          content: `✅ Embed successfully posted to <#${channel.id}>!`,
          embeds: [],
          components: [],
        });
        collector.stop();
      }
    });

    collector.on("end", async (_, reason) => {
      if (reason === "time" && !posted) {
        await interaction.editReply({ content: "⏰ Embed builder timed out.", components: [] }).catch(() => null);
      }
    });
  },
};

export default command;
