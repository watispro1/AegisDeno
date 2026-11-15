import { memberPermsIn, postRefusal } from "../../utils/channelAccess";
import { guardCollect } from "../../utils/collectorGuard";
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
  MessageFlags,
  ChannelType,
} from "discord.js";
import { scopedModalId } from "../../utils/modal";
import { Command } from "../../types/discord";
import { isSendableChannel } from "../../utils/channels";
import { sendGuildLog } from "../../services/logging";
import { logger } from "../../utils/logger";
import { checkLink, expandNewlines, embedTextProblem } from "../shared/inputChecks";
import { footer } from "../../utils/embedStyle";

/** How long the preview's buttons keep working after the last press. */
export const ANNOUNCE_PREVIEW_IDLE_MS = 180_000;

/** Channel kinds an announcement can go to. */
export const ANNOUNCE_CHANNEL_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.AnnouncementThread] as const;

// Color presets

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

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Preview, edit and send an announcement embed to a channel, with an optional ping.")
    .addChannelOption(opt =>
      opt.setName("channel").setDescription("Channel to send the announcement to").addChannelTypes(...ANNOUNCE_CHANNEL_TYPES).setRequired(true)
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
      opt.setName("image_url").setDescription("Optional image link (https://…) shown under the text").setMaxLength(512).setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName("thumbnail_url").setDescription("Optional small image link (https://…) in the top-right corner").setMaxLength(512).setRequired(false)
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

    if (!isSendableChannel(channel)) {
      return interaction.reply({ content: "❌ Pick a text or announcement channel (or a thread) I can post in.", flags: MessageFlags.Ephemeral });
    }
    // Bad links used to fail only when sending, as a generic error.
    const image = checkLink(imageUrl, "image link");
    if (!image.ok) return interaction.reply({ content: `❌ ${image.error}`, flags: MessageFlags.Ephemeral });
    const thumbnail = checkLink(thumbnailUrl, "thumbnail link");
    if (!thumbnail.ok) return interaction.reply({ content: `❌ ${thumbnail.error}`, flags: MessageFlags.Ephemeral });
    if (!bodyRaw.trim()) return interaction.reply({ content: "❌ The announcement text can't be empty.", flags: MessageFlags.Ephemeral });

    // The announcer must be able to post there (and ping everyone, if asked) themselves.
    const refusal = postRefusal(await memberPermsIn(interaction, channel.id), channel.id, { pingEveryone: pingChoice === "everyone" || pingChoice === "here" });
    if (refusal) return interaction.reply({ content: `❌ ${refusal}`, flags: MessageFlags.Ephemeral });

    const me = interaction.guild?.members.me;
    if (me && "permissionsFor" in channel) {
      const perms = channel.permissionsFor(me);
      const needed: Array<[bigint, string]> = [
        [PermissionFlagsBits.ViewChannel, "View Channel"],
        [channel.isThread() ? PermissionFlagsBits.SendMessagesInThreads : PermissionFlagsBits.SendMessages, channel.isThread() ? "Send Messages in Threads" : "Send Messages"],
        [PermissionFlagsBits.EmbedLinks, "Embed Links"],
        ...(pingChoice !== "none" ? [[PermissionFlagsBits.MentionEveryone, "Mention @everyone"] as [bigint, string]] : []),
      ];
      const lacking = perms ? needed.filter(([flag]) => !perms.has(flag)).map(([, label]) => `**${label}**`) : [];
      if (lacking.length) {
        return interaction.reply({ content: `❌ I need ${lacking.join(", ")} in <#${channel.id}> to post this announcement.`, flags: MessageFlags.Ephemeral });
      }
    }

    const body = expandNewlines(bodyRaw);
    const tooLong = embedTextProblem({ title, description: body, footer: `Announced by ${interaction.user.tag}`, author: interaction.guild?.name });
    if (tooLong) return interaction.reply({ content: `❌ ${tooLong}`, flags: MessageFlags.Ephemeral });
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
    if (image.value)     embed.setImage(image.value);
    if (thumbnail.value) embed.setThumbnail(thumbnail.value);

    let pingContent = "";
    if (pingChoice === "everyone") pingContent = "@everyone";
    if (pingChoice === "here")     pingContent = "@here";

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
      .setFooter(footer(`Preview closes after ${ANNOUNCE_PREVIEW_IDLE_MS / 60_000} minutes without a press.`));

    await interaction.reply({
      content: "**📋 Announcement Preview** — review before sending:",
      embeds: [previewEmbed, embed],
      components: [previewRow],
      flags: MessageFlags.Ephemeral,
    });

    let currentBody = body;
    let currentEmbed = embed;

    const collector = (await interaction.fetchReply()).createMessageComponentCollector({
      componentType: ComponentType.Button,
      idle: ANNOUNCE_PREVIEW_IDLE_MS,
      filter: (i) => i.user.id === interaction.user.id,
    });

    let isSending = false;
    collector.on("collect", (i) => guardCollect("announce", i, async () => {
      if (i.customId === "ann_cancel") {
        collector.stop();
        await i.update({ content: "❌ Announcement cancelled.", embeds: [], components: [] });
        return;
      }

      if (i.customId === "ann_edit") {
        const modal = new ModalBuilder()
          .setCustomId(scopedModalId("ann_edit_modal", i.id))
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
        // Typing in the modal doesn't count as a press; keep the preview open meanwhile.
        collector.resetTimer({ idle: ANNOUNCE_PREVIEW_IDLE_MS + 120_000 });
        const resp = await i.awaitModalSubmit({ time: 120_000, filter: m => m.user.id === interaction.user.id && m.customId === scopedModalId("ann_edit_modal", i.id) }).catch(() => null);
        if (resp) {
          const newTitle = resp.fields.getTextInputValue("ann_title_input");
          const newBody  = expandNewlines(resp.fields.getTextInputValue("ann_body_input"));
          currentBody = newBody;
          currentEmbed = EmbedBuilder.from(currentEmbed).setTitle(newTitle).setDescription(newBody);
          await resp.deferUpdate();
          await interaction.editReply({ embeds: [previewEmbed, currentEmbed], components: [previewRow] });
        }
        return;
      }

      if (i.customId === "ann_send") {
        if (isSending) return;
        isSending = true;
        collector.stop("sent");
        await i.update({ content: "⏳ Sending announcement...", components: [] });
        try {
          const sent = await channel.send({
            content: pingContent || undefined,
            embeds: [currentEmbed],
            // The client default blocks @everyone/@here; this announcement asked for it.
            allowedMentions: { parse: pingContent ? ["everyone"] : [] },
          });

          // Publish to followers in announcement channels
          let crossposted: boolean | null = null;
          if (crosspost) {
            crossposted = channel.type === ChannelType.GuildAnnouncement && "crosspost" in sent && typeof sent.crosspost === "function"
              ? await sent.crosspost().then(() => true, () => false)
              : false;
          }

          await interaction.editReply({
            content: `✅ Announcement sent to <#${channel.id}>.` + (crossposted === false
              ? "\n⚠️ It wasn't published to following servers: that only works in an announcement channel, and Discord limits how often a channel can publish (10 per hour)."
              : crossposted ? " Published to following servers too." : ""),
            embeds: [],
            components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder().setLabel("Jump to announcement").setStyle(ButtonStyle.Link).setURL(sent.url).setEmoji("🔗"),
            )],
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
    }));

    collector.on("end", async (_, reason) => {
      if (reason === "time") {
        await interaction.editReply({ content: "⏰ Preview expired.", embeds: [], components: [] }).catch(() => null);
      }
    });
  },
};

export default command;
