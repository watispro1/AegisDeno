import { guardCollect } from "../../utils/collectorGuard";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from "discord.js";
import { scopedModalId } from "../../utils/modal";
import { Command } from "../../types/discord";
import { getGuildConfig, updateGuildConfig } from "../../services/configuration";
import { renderWelcomeTemplate } from "../../services/communityLogic";

// Variables that can be interpolated in welcome messages ({member_count} still works as an alias of {count}).
const VARIABLES = ["{user}", "{username}", "{server}", "{count}"];

/** Resolve template variables with the invoking moderator as a stand-in for the new member. */
function applyVariables(text: string, interaction: ChatInputCommandInteraction): string {
  return renderWelcomeTemplate(text, {
    userId: interaction.user.id,
    username: interaction.user.username,
    serverName: interaction.guild?.name ?? "this server",
    memberCount: interaction.guild?.memberCount ?? null,
  });
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Configure and preview welcome messages for new members.")
    .addSubcommand(sub =>
      sub
        .setName("status")
        .setDescription("View current welcome configuration with quick-toggle controls.")
    )
    .addSubcommand(sub =>
      sub
        .setName("channel")
        .setDescription("Set the channel where welcome messages are sent.")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Target welcome channel").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("message")
        .setDescription("Open a form to compose or update the welcome message.")
    )
    .addSubcommand(sub =>
      sub
        .setName("preview")
        .setDescription("Preview the current welcome message as it would appear for a new member.")
    )
    .addSubcommand(sub =>
      sub
        .setName("toggle")
        .setDescription("Enable or disable welcome messages.")
        .addBooleanOption(opt =>
          opt.setName("enabled").setDescription("Enable welcome messages?").setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageGuild],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const config = await getGuildConfig(guildId);

    // ── STATUS ────────────────────────────────────────────────────────────────
    if (sub === "status") {
      const enabled = config.welcomeEnabled ?? false;
      const hasChannel = !!config.welcomeChannelId;
      const hasMsg = !!config.welcomeMessage;

      const statusEmbed = new EmbedBuilder()
        .setColor(enabled ? 0x57F287 : 0xED4245)
        .setTitle("👋 Welcome Message Configuration")
        .setThumbnail(interaction.guild!.iconURL() ?? null)
        .addFields(
          {
            name: "🟢 Status",
            value: enabled ? "**Enabled** — messages are sent on join" : "**Disabled** — no messages are sent",
            inline: false,
          },
          {
            name: "📌 Channel",
            value: hasChannel ? `<#${config.welcomeChannelId}>` : "❌ Not set — use `/welcome channel`",
            inline: true,
          },
          {
            name: "📝 Message",
            value: hasMsg ? "✅ Custom message set" : "⚠️ Using default message",
            inline: true,
          },
          {
            name: "🔣 Available Variables",
            value: VARIABLES.map(v => `\`${v}\``).join("  "),
            inline: false,
          },
        )
        .setFooter({ text: "Use the buttons below to toggle or preview." })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("welcome_toggle_on")
          .setLabel("Enable")
          .setStyle(enabled ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setEmoji("🟢")
          .setDisabled(enabled),
        new ButtonBuilder()
          .setCustomId("welcome_toggle_off")
          .setLabel("Disable")
          .setStyle(!enabled ? ButtonStyle.Danger : ButtonStyle.Secondary)
          .setEmoji("🔴")
          .setDisabled(!enabled),
        new ButtonBuilder()
          .setCustomId("welcome_preview_btn")
          .setLabel("Preview Message")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("👁️")
          .setDisabled(!hasMsg && !hasChannel),
      );

      const sent = await interaction.reply({ embeds: [statusEmbed], components: [row], flags: MessageFlags.Ephemeral, fetchReply: true });

      const collector = sent.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60_000,
        filter: (i) => i.user.id === interaction.user.id,
      });

      collector.on("collect", (i) => guardCollect("welcome", i, async () => {
        await i.deferUpdate();
        const freshConfig = await getGuildConfig(guildId);

        if (i.customId === "welcome_toggle_on") {
          await updateGuildConfig(guildId, { welcomeEnabled: true });
          await i.editReply({
            embeds: [statusEmbed.setColor(0x57F287).spliceFields(0, 1, { name: "🟢 Status", value: "**Enabled** — messages are sent on join", inline: false })],
            components: [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId("welcome_toggle_on").setLabel("Enable").setStyle(ButtonStyle.Success).setEmoji("🟢").setDisabled(true),
                new ButtonBuilder().setCustomId("welcome_toggle_off").setLabel("Disable").setStyle(ButtonStyle.Secondary).setEmoji("🔴").setDisabled(false),
                new ButtonBuilder().setCustomId("welcome_preview_btn").setLabel("Preview Message").setStyle(ButtonStyle.Primary).setEmoji("👁️").setDisabled(!freshConfig.welcomeMessage),
              ),
            ],
          });
        } else if (i.customId === "welcome_toggle_off") {
          await updateGuildConfig(guildId, { welcomeEnabled: false });
          await i.editReply({
            embeds: [statusEmbed.setColor(0xED4245).spliceFields(0, 1, { name: "🟢 Status", value: "**Disabled** — no messages are sent", inline: false })],
            components: [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId("welcome_toggle_on").setLabel("Enable").setStyle(ButtonStyle.Secondary).setEmoji("🟢").setDisabled(false),
                new ButtonBuilder().setCustomId("welcome_toggle_off").setLabel("Disable").setStyle(ButtonStyle.Danger).setEmoji("🔴").setDisabled(true),
                new ButtonBuilder().setCustomId("welcome_preview_btn").setLabel("Preview Message").setStyle(ButtonStyle.Primary).setEmoji("👁️").setDisabled(!freshConfig.welcomeMessage),
              ),
            ],
          });
        } else if (i.customId === "welcome_preview_btn") {
          const previewText = freshConfig.welcomeMessage
            ? applyVariables(freshConfig.welcomeMessage, interaction)
            : `👋 Welcome to **${interaction.guild!.name}**, <@${interaction.user.id}>! You are member #${interaction.guild!.memberCount}.`;

          const previewEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("👁️ Welcome Message Preview")
            .setDescription(previewText)
            .setThumbnail(interaction.user.displayAvatarURL())
            .setFooter({ text: "This is how the message would appear for a new member." })
            .setTimestamp();

          await i.followUp({ embeds: [previewEmbed], flags: MessageFlags.Ephemeral });
        }
      }));

      collector.on("end", async () => {
        await interaction.editReply({ components: [] }).catch(() => null);
      });

      return;
    }

    // ── CHANNEL ───────────────────────────────────────────────────────────────
    if (sub === "channel") {
      const channel = interaction.options.getChannel("channel", true);
      const me = interaction.guild?.members.me ?? await interaction.guild?.members.fetchMe().catch(() => null);
      const targetChannel = await interaction.guild!.channels.fetch(channel.id).catch(() => null);

      if (
        !(targetChannel instanceof TextChannel) ||
        !me ||
        !targetChannel.permissionsFor(me).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])
      ) {
        return interaction.reply({
          content: "❌ I need **View Channel** and **Send Messages** permissions in that channel.",
          flags: MessageFlags.Ephemeral,
        });
      }

      await updateGuildConfig(guildId, { welcomeChannelId: channel.id, welcomeEnabled: true });

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle("✅ Welcome Channel Set")
            .setDescription(`Welcome messages will now be sent to <#${channel.id}>.\n\nWelcoming is now **enabled**.`)
            .addFields({ name: "💡 Next Step", value: "Use `/welcome message` to customize the welcome text.", inline: false })
            .setTimestamp(),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── MESSAGE ───────────────────────────────────────────────────────────────
    if (sub === "message") {
      const modal = new ModalBuilder()
        .setCustomId(scopedModalId("welcome_msg_modal", interaction.id))
        .setTitle("Welcome Message Editor");

      const msgInput = new TextInputBuilder()
        .setCustomId("welcome_msg_input")
        .setLabel("Welcome message")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(2000)
        .setRequired(true)
        .setPlaceholder("e.g. Welcome to {server}, {user}! You are member #{count} 🎉")
        .setValue(config.welcomeMessage ?? "");

      const hintInput = new TextInputBuilder()
        .setCustomId("welcome_hint")
        .setLabel("Available variables (read-only reference)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue("{user} {username} {server} {count}");

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(msgInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(hintInput),
      );

      await interaction.showModal(modal);

      const modalResponse = await interaction.awaitModalSubmit({
        time: 300_000,
        filter: (m) => m.user.id === interaction.user.id && m.customId === scopedModalId("welcome_msg_modal", interaction.id),
      }).catch(() => null);

      if (!modalResponse) return;
      await modalResponse.deferReply({ flags: MessageFlags.Ephemeral });

      const newMsg = modalResponse.fields.getTextInputValue("welcome_msg_input");
      await updateGuildConfig(guildId, { welcomeMessage: newMsg });

      const preview = applyVariables(newMsg, interaction);

      await modalResponse.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle("✅ Welcome Message Updated")
            .addFields(
              { name: "📝 New Message (raw)", value: `\`\`\`\n${newMsg.slice(0, 900)}\n\`\`\``, inline: false },
              { name: "👁️ Preview", value: preview.slice(0, 1024), inline: false },
            )
            .setFooter({ text: "Variables are substituted when a member actually joins. Run /welcome preview any time." })
            .setTimestamp(),
        ],
      });
      return;
    }

    // ── PREVIEW ───────────────────────────────────────────────────────────────
    if (sub === "preview") {
      const previewText = config.welcomeMessage
        ? applyVariables(config.welcomeMessage, interaction)
        : `👋 Welcome to **${interaction.guild!.name}**, <@${interaction.user.id}>! You are member #${interaction.guild!.memberCount}.`;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("👁️ Welcome Message Preview")
        .setDescription(previewText)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: "📌 Channel", value: config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : "❌ Not configured", inline: true },
          { name: "🟢 Status",  value: config.welcomeEnabled ? "Enabled" : "Disabled", inline: true },
        )
        .setFooter({ text: "Variables are resolved with your account as a stand-in." })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // ── TOGGLE ────────────────────────────────────────────────────────────────
    if (sub === "toggle") {
      const enabled = interaction.options.getBoolean("enabled", true);
      await updateGuildConfig(guildId, { welcomeEnabled: enabled });

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(enabled ? 0x57F287 : 0xED4245)
            .setTitle(enabled ? "✅ Welcome Messages Enabled" : "🔴 Welcome Messages Disabled")
            .setDescription(
              enabled
                ? `New members will now be greeted in ${config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : "the configured channel"}.`
                : "New members will no longer receive a welcome message."
            )
            .setTimestamp(),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
