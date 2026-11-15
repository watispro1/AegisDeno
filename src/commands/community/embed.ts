import { memberPermsIn, postRefusal } from "../../utils/channelAccess";
import { guardCollect } from "../../utils/collectorGuard";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  ChannelType,
  type AutocompleteInteraction,
  type GuildBasedChannel,
} from "discord.js";
import { scopedModalId } from "../../utils/modal";
import { Command } from "../../types/discord";
import { isSendableChannel } from "../../utils/channels";
import { colorChoices } from "../shared/inputChecks";
import { applyDraftModal, buildDraftEmbed, draftFromInput, draftModal, draftPostProblem, type DraftModalKind, type EmbedDraft } from "../shared/embedDraft";

/** Short-term debounce lock preventing duplicate concurrent submissions by the same user to the same channel */
const activeQuickEmbeds = new Set<string>();

/** Channel kinds an embed can be posted to. */
export const EMBED_CHANNEL_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread, ChannelType.GuildVoice] as const;
export const EMBED_BUILDER_IDLE_MS = 600_000;

const MODAL_FOR: Record<string, DraftModalKind> = { embed_edit_desc: "desc", embed_edit_meta: "meta", embed_edit_media: "media" };

/** Aegis's own permissions in the target: what's missing, as names. */
function botMissing(interaction: ChatInputCommandInteraction, channel: GuildBasedChannel): string[] {
  const me = interaction.guild?.members.me;
  const perms = me && "permissionsFor" in channel ? channel.permissionsFor(me) : null;
  if (!perms) return [];
  const send = channel.isThread() ? ["SendMessagesInThreads", "Send Messages in Threads"] as const : ["SendMessages", "Send Messages"] as const;
  return ([["ViewChannel", "View Channel"], send, ["EmbedLinks", "Embed Links"]] as const)
    .filter(([flag]) => !perms.has(PermissionFlagsBits[flag])).map(([, label]) => label);
}

function jumpRow(url: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setLabel("Jump to embed").setStyle(ButtonStyle.Link).setURL(url).setEmoji("🔗"));
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Create and post a custom embed: a live-preview builder, or a quick one-shot post.")
    .addSubcommand(sub =>
      sub
        .setName("builder")
        .setDescription("Open an interactive embed builder with live preview and modal editor.")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Target channel to post the embed").addChannelTypes(...EMBED_CHANNEL_TYPES).setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName("title").setDescription("Embed title").setRequired(true).setMaxLength(256)
        )
        .addStringOption(opt =>
          opt.setName("description").setDescription("Embed body text (supports \\n for newlines)").setRequired(false).setMaxLength(4000)
        )
        .addStringOption(opt =>
          opt.setName("color").setDescription("Hex colour (e.g. #5865F2) or pick a preset").setRequired(false).setAutocomplete(true).setMaxLength(16)
        )
        .addStringOption(opt =>
          opt.setName("url").setDescription("Clickable title link (https://…)").setRequired(false).setMaxLength(2000)
        )
        .addStringOption(opt =>
          opt.setName("footer").setDescription("Footer text").setRequired(false).setMaxLength(2048)
        )
        .addStringOption(opt =>
          opt.setName("image").setDescription("Large image link (https://…), shown at the bottom").setRequired(false).setMaxLength(2000)
        )
        .addStringOption(opt =>
          opt.setName("thumbnail").setDescription("Small thumbnail link (https://…), top-right corner").setRequired(false).setMaxLength(2000)
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
          opt.setName("channel").setDescription("Target channel").addChannelTypes(...EMBED_CHANNEL_TYPES).setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName("title").setDescription("Embed title").setRequired(true).setMaxLength(256)
        )
        .addStringOption(opt =>
          opt.setName("description").setDescription("Embed body text (supports \\n for newlines)").setRequired(true).setMaxLength(4000)
        )
        .addStringOption(opt =>
          opt.setName("color").setDescription("Hex colour (e.g. #5865F2) or pick a preset").setRequired(false).setAutocomplete(true).setMaxLength(16)
        )
        .addStringOption(opt =>
          opt.setName("footer").setDescription("Footer text").setRequired(false).setMaxLength(2048)
        )
    ),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageMessages],
  botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],

  /** `color`: presets, plus the typed hex when it is valid. */
  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused(true);
    await interaction.respond(focused.name === "color" ? colorChoices(String(focused.value ?? "")) : []);
  },

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const picked = interaction.options.getChannel("channel", true);
    const channel = interaction.guild?.channels.cache.get(picked.id) ?? picked;

    if (!isSendableChannel(channel) || !("guildId" in channel)) {
      return interaction.reply({ content: "❌ Pick a text or announcement channel (or a thread) I can post in.", flags: MessageFlags.Ephemeral });
    }
    const refusal = postRefusal(await memberPermsIn(interaction, channel.id), channel.id);
    if (refusal) return interaction.reply({ content: `❌ ${refusal}`, flags: MessageFlags.Ephemeral });
    const missing = botMissing(interaction, channel as GuildBasedChannel);
    if (missing.length) return interaction.reply({ content: `❌ I need **${missing.join("**, **")}** in <#${channel.id}> to post an embed there.`, flags: MessageFlags.Ephemeral });

    const parsed = draftFromInput({
      title: interaction.options.getString("title", true),
      description: interaction.options.getString("description"),
      color: interaction.options.getString("color"),
      url: sub === "builder" ? interaction.options.getString("url") : null,
      footer: interaction.options.getString("footer"),
      image: sub === "builder" ? interaction.options.getString("image") : null,
      thumbnail: sub === "builder" ? interaction.options.getString("thumbnail") : null,
      author: sub === "builder" ? interaction.options.getString("author") : null,
    });
    if (!parsed.ok) return interaction.reply({ content: `❌ ${parsed.error}`, flags: MessageFlags.Ephemeral });

    // Quick mode
    if (sub === "quick") {
      const problem = draftPostProblem(parsed.draft);
      if (problem) return interaction.reply({ content: `❌ ${problem}`, flags: MessageFlags.Ephemeral });
      // Concurrency lock to prevent duplicate submissions from rapid clicks or gateway retries
      const lockKey = `${interaction.user.id}:${channel.id}`;
      if (activeQuickEmbeds.has(lockKey)) {
        return interaction.reply({ content: "⚠️ Please wait a moment between posting embeds.", flags: MessageFlags.Ephemeral });
      }
      activeQuickEmbeds.add(lockKey);
      setTimeout(() => activeQuickEmbeds.delete(lockKey), 3000);

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const sent = await channel.send({ embeds: [buildDraftEmbed(parsed.draft)], allowedMentions: { parse: [] } });
        await interaction.editReply({ content: `✅ Embed posted to <#${channel.id}>.`, components: [jumpRow(sent.url)] });
      } catch {
        await interaction.editReply({ content: `❌ Failed to send embed to <#${channel.id}>. Please check my permissions.` });
      }
      return;
    }

    // Builder mode
    let draft: EmbedDraft = parsed.draft;
    const buildButtons = (sent: boolean) => [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("embed_edit_desc").setLabel("Edit Description").setStyle(ButtonStyle.Primary).setEmoji("✏️"),
        new ButtonBuilder().setCustomId("embed_edit_meta").setLabel("Title, Link & Colour").setStyle(ButtonStyle.Secondary).setEmoji("🏷️"),
        new ButtonBuilder().setCustomId("embed_edit_media").setLabel("Images & Author").setStyle(ButtonStyle.Secondary).setEmoji("🖼️"),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("embed_send").setLabel("Post Embed").setStyle(ButtonStyle.Success).setEmoji("🚀").setDisabled(sent),
        new ButtonBuilder().setCustomId("embed_cancel").setLabel("Cancel").setStyle(ButtonStyle.Danger).setEmoji("✖️"),
      ),
    ];
    const previewText = (note?: string) => `👇 **Embed Preview** — Posting to <#${channel.id}>${note ? `\n${note}` : ""}`;

    const sent = await interaction.reply({
      content: previewText(),
      embeds: [buildDraftEmbed(draft)],
      components: buildButtons(false),
      flags: MessageFlags.Ephemeral,
      fetchReply: true,
    });

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      idle: EMBED_BUILDER_IDLE_MS,
      filter: (i) => i.user.id === interaction.user.id,
    });

    let posted = false;

    collector.on("collect", (i) => guardCollect("embed", i, async () => {
      if (i.customId === "embed_cancel") {
        collector.stop();
        await i.update({ content: "❌ Embed creation cancelled.", embeds: [], components: [] });
        return;
      }

      const kind = MODAL_FOR[i.customId];
      if (kind) {
        const modalId = scopedModalId(`embed_${kind}_modal`, i.id);
        await i.showModal(draftModal(kind, modalId, draft));
        const submit = await i.awaitModalSubmit({ time: 300_000, filter: (m) => m.user.id === i.user.id && m.customId === modalId }).catch(() => null);
        if (!submit) return;
        const result = applyDraftModal(kind, submit, draft);
        await submit.deferUpdate();
        if (result.ok) draft = result.draft;
        await interaction.editReply({ content: previewText(result.ok ? undefined : `⚠️ ${result.error} Nothing was changed.`), embeds: [buildDraftEmbed(draft)], components: buildButtons(posted) });
        return;
      }

      if (i.customId === "embed_send") {
        if (posted) return;
        const problem = draftPostProblem(draft);
        if (problem) {
          await i.reply({ content: `❌ ${problem}`, flags: MessageFlags.Ephemeral });
          return;
        }
        posted = true;
        collector.stop("posted");

        // Immediately disable the button row and acknowledge to prevent race conditions
        await i.update({ content: `⏳ Posting embed to <#${channel.id}>...`, embeds: [], components: [] });

        try {
          const message = await channel.send({ embeds: [buildDraftEmbed(draft)], allowedMentions: { parse: [] } });
          await interaction.editReply({ content: `✅ Embed successfully posted to <#${channel.id}>!`, components: [jumpRow(message.url)] });
        } catch {
          await interaction.editReply({ content: `❌ Failed to post embed to <#${channel.id}>. Please check my permissions.` });
        }
      }
    }));

    collector.on("end", async (_, reason) => {
      if (reason === "idle" && !posted) {
        await interaction.editReply({ content: "⏰ Embed builder timed out.", components: [] }).catch(() => null);
      }
    });
  },
};

export default command;
