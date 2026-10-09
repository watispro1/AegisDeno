import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  TextChannel,
} from "discord.js";
import { Command } from "../../types/discord";
import { sendGuildLog } from "../../services/logging";
import { logger } from "../../utils/logger";

// ─── Color presets ─────────────────────────────────────────────────────────────

const COLOR_CHOICES = [
  { name: "🔵 Aegis Blue",   value: "0x3498DB" },
  { name: "🟢 Success Green", value: "0x57F287" },
  { name: "🔴 Alert Red",    value: "0xED4245" },
  { name: "🟡 Warning Gold", value: "0xFEE75C" },
  { name: "🟠 Warm Orange",  value: "0xE67E22" },
  { name: "🟣 Discord Blurple", value: "0x5865F2" },
  { name: "⚫ Midnight Black",  value: "0x23272A" },
  { name: "⚪ Subtle Gray",  value: "0x99AAB5" },
];

const PING_CHOICES = [
  { name: "None",      value: "none"     },
  { name: "@everyone", value: "everyone" },
  { name: "@here",     value: "here"     },
];

// ─── Command ─────────────────────────────────────────────────────────────────

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send a polished announcement embed to any channel.")
    .addChannelOption(opt =>
      opt.setName("channel").setDescription("Channel to send the announcement to").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("message").setDescription("Announcement body text (use \\n for newlines)").setRequired(true).setMaxLength(2048)
    )
    .addStringOption(opt =>
      opt.setName("title").setDescription("Title for the embed header").setRequired(false).setMaxLength(256)
    )
    .addStringOption(opt =>
      opt
        .setName("color")
        .setDescription("Embed accent color (default: Aegis Blue)")
        .setRequired(false)
        .addChoices(...COLOR_CHOICES)
    )
    .addStringOption(opt =>
      opt
        .setName("ping")
        .setDescription("Optional notification ping (default: None)")
        .setRequired(false)
        .addChoices(...PING_CHOICES)
    )
    .addStringOption(opt =>
      opt.setName("image_url").setDescription("Optional image URL to attach to the embed").setMaxLength(512).setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName("thumbnail_url").setDescription("Optional thumbnail URL in embed corner").setMaxLength(512).setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName("suppress_author").setDescription("Hide the server name/icon in the embed author (default: false)").setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName("crosspost").setDescription("Auto-crosspost if the target is an Announcement channel (default: false)").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageMessages],
  botPermissions:  [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const channel        = interaction.options.getChannel("channel", true);
    const bodyRaw        = interaction.options.getString("message", true);
    const title          = interaction.options.getString("title") ?? "📢 Server Announcement";
    const colorHex       = interaction.options.getString("color") ?? "0x3498DB";
    const pingChoice     = interaction.options.getString("ping") ?? "none";
    const imageUrl       = interaction.options.getString("image_url") ?? null;
    const thumbnailUrl   = interaction.options.getString("thumbnail_url") ?? null;
    const suppressAuthor = interaction.options.getBoolean("suppress_author") ?? false;
    const crosspost      = interaction.options.getBoolean("crosspost") ?? false;

    // Validate channel is sendable
    if (!("send" in channel) || typeof (channel as any).send !== "function") {
      return interaction.reply({ content: "❌ Please select a text channel.", ephemeral: true });
    }

    // Check bot perms in target channel
    const me = interaction.guild?.members.me;
    if (me && "permissionsFor" in channel && typeof (channel as any).permissionsFor === "function") {
      const perms = (channel as any).permissionsFor(me);
      if (perms && !perms.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
        return interaction.reply({ content: "❌ I need View Channel + Send Messages permissions in that channel.", ephemeral: true });
      }
    }

    const body = bodyRaw.replace(/\\n/g, "\n");
    const color = parseInt(colorHex, 16);

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(body)
      .setFooter({ text: `Announced by ${interaction.user.tag}` })
      .setTimestamp();

    if (!suppressAuthor) {
      embed.setAuthor({
        name: interaction.guild?.name ?? "Announcement",
        iconURL: interaction.guild?.iconURL() ?? undefined,
      });
    }
    if (imageUrl)     embed.setImage(imageUrl);
    if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);

    let pingContent = "";
    if (pingChoice === "everyone") pingContent = "@everyone";
    if (pingChoice === "here")     pingContent = "@here";

    // Preview before sending
    const previewRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("ann_send")
        .setLabel("Send Announcement")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("📢"),
      new ButtonBuilder()
        .setCustomId("ann_edit")
        .setLabel("Edit Message")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("✏️"),
      new ButtonBuilder()
        .setCustomId("ann_cancel")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("✖️"),
    );

    const previewEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("📋 Announcement Preview")
      .setDescription(`> This is how your announcement will look in <#${channel.id}>.\n\nPlease review the embed below before sending.`)
      .addFields(
        { name: "📌 Channel", value: `<#${channel.id}>`, inline: true },
        { name: "🔔 Ping",    value: pingChoice === "none" ? "None" : `@${pingChoice}`, inline: true },
        { name: "↩️ Crosspost", value: crosspost ? "Yes" : "No", inline: true },
      )
      .setFooter({ text: "Preview expires in 60 seconds." });

    await interaction.reply({
      content: "**📋 Announcement Preview** — review before sending:",
      embeds: [previewEmbed, embed],
      components: [previewRow],
      ephemeral: true,
    });

    let currentBody = body;
    let currentEmbed = embed;

    const collector = (await interaction.fetchReply()).createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "ann_cancel") {
        collector.stop();
        await i.update({ content: "❌ Announcement cancelled.", embeds: [], components: [] });
        return;
      }

      if (i.customId === "ann_edit") {
        const modal = new ModalBuilder()
          .setCustomId("ann_edit_modal")
          .setTitle("Edit Announcement");

        const titleInput = new TextInputBuilder()
          .setCustomId("ann_title_input")
          .setLabel("Embed Title")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(256)
          .setRequired(true)
          .setValue(currentEmbed.data.title ?? title);

        const bodyInput = new TextInputBuilder()
          .setCustomId("ann_body_input")
          .setLabel("Announcement Body")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(2048)
          .setRequired(true)
          .setValue(currentBody);

        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
          new ActionRowBuilder<TextInputBuilder>().addComponents(bodyInput),
        );

        await i.showModal(modal);
        const resp = await i.awaitModalSubmit({ time: 120_000, filter: m => m.user.id === interaction.user.id }).catch(() => null);
        if (resp) {
          const newTitle = resp.fields.getTextInputValue("ann_title_input");
          const newBody  = resp.fields.getTextInputValue("ann_body_input").replace(/\\n/g, "\n");
          currentBody = newBody;
          currentEmbed = EmbedBuilder.from(currentEmbed).setTitle(newTitle).setDescription(newBody);
          await resp.deferUpdate();
          await interaction.editReply({ embeds: [previewEmbed, currentEmbed], components: [previewRow] });
        }
        return;
      }

      if (i.customId === "ann_send") {
        collector.stop();
        await i.deferUpdate();
        try {
          const sent = await (channel as TextChannel).send({
            content: pingContent || undefined,
            embeds: [currentEmbed],
          });

          // Crosspost if announcement channel
          if (crosspost && "crosspost" in sent && typeof sent.crosspost === "function") {
            await sent.crosspost().catch(() => null);
          }

          await interaction.editReply({
            content: `✅ Announcement sent to <#${channel.id}>.`,
            embeds: [],
            components: [],
          });

          await sendGuildLog(interaction.client, interaction.guildId!, {
            title: "📢 Announcement Sent",
            color: 0x3498DB,
            description: `**Channel:** <#${channel.id}>\n**Title:** ${currentEmbed.data.title}\n**Ping:** ${pingChoice}\n**Announcer:** ${interaction.user.tag}`,
          });
        } catch (err) {
          logger.error("Failed to send announcement", err);
          await interaction.editReply({ content: "❌ Failed to send. Check my permissions.", embeds: [], components: [] });
        }
      }
    });

    collector.on("end", async (_, reason) => {
      if (reason === "time") {
        await interaction.editReply({ content: "⏰ Preview expired.", embeds: [], components: [] }).catch(() => null);
      }
    });
  },
};

export default command;
