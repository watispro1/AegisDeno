import { guardCollect } from "../../utils/collectorGuard";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ChannelType,
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
import { sendGreetingTest } from "../../services/welcomeTest";
import { memberTopRolePosition, roleAboveActor } from "../../permissions/hierarchy";
import { logger } from "../../utils/logger";
import { botChannelProblem, botRoleProblem, dashboardRow, replyError, type PermissionList } from "../config/kit/setupKit";
import { buildWelcomeButtons, buildWelcomeStatus, unknownVariables, welcomeMessageProblem, WELCOME_MESSAGE_MAX } from "./welcome/view";

const PAGE = "settings/welcome" as const;

/** Resolve template variables with the invoking moderator as a stand-in for the new member. */
function applyVariables(text: string, interaction: ChatInputCommandInteraction): string {
  return renderWelcomeTemplate(text, {
    userId: interaction.user.id,
    username: interaction.user.username,
    serverName: interaction.guild?.name ?? "this server",
    memberCount: interaction.guild?.memberCount ?? null,
  });
}

function previewEmbed(message: string | null | undefined, interaction: ChatInputCommandInteraction): EmbedBuilder {
  const text = message
    ? applyVariables(message, interaction)
    : `👋 Welcome to **${interaction.guild!.name}**, <@${interaction.user.id}>! You are member #${interaction.guild!.memberCount}.`;
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle("👁️ Welcome Message Preview")
    .setDescription(text.slice(0, 4096))
    .setThumbnail(interaction.user.displayAvatarURL())
    .setFooter({ text: "Variables are resolved with your account as a stand-in." })
    .setTimestamp();
}

async function showStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const icon = interaction.guild!.iconURL() ?? null;
  const config = await getGuildConfig(guildId);
  const sent = await interaction.reply({
    embeds: [buildWelcomeStatus(config, icon)], components: [buildWelcomeButtons(config, guildId)],
    flags: MessageFlags.Ephemeral, withResponse: true, allowedMentions: { parse: [] },
  });
  const message = sent.resource?.message;
  if (!message) return;

  const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120_000, filter: (i) => i.user.id === interaction.user.id });
  collector.on("collect", (i) => guardCollect("welcome", i, async () => {
    await i.deferUpdate();
    let fresh = await getGuildConfig(guildId);
    if (i.customId === "welcome_preview_btn") {
      await i.followUp({ embeds: [previewEmbed(fresh.welcomeMessage, interaction)], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
      return;
    }
    if (i.customId === "welcome_toggle_on" || i.customId === "welcome_toggle_off") {
      fresh = await updateGuildConfig(guildId, { welcomeEnabled: i.customId === "welcome_toggle_on" });
      await i.editReply({ embeds: [buildWelcomeStatus(fresh, icon)], components: [buildWelcomeButtons(fresh, guildId)] });
    }
  }));
  collector.on("end", async () => {
    await interaction.editReply({ components: [dashboardRow(guildId, PAGE)] }).catch(() => null);
  });
}

async function editMessage(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const config = await getGuildConfig(guildId);
  const modal = new ModalBuilder()
    .setCustomId(scopedModalId("welcome_msg_modal", interaction.id))
    .setTitle("Welcome Message Editor");
  const msgInput = new TextInputBuilder()
    .setCustomId("welcome_msg_input")
    .setLabel("Welcome message")
    .setStyle(TextInputStyle.Paragraph)
    // The settings store keeps at most 1000 characters; a longer one used to fall back to the default unseen.
    .setMaxLength(WELCOME_MESSAGE_MAX)
    .setRequired(true)
    .setPlaceholder("e.g. Welcome to {server}, {user}! You are member #{count} 🎉")
    .setValue((config.welcomeMessage ?? "").slice(0, WELCOME_MESSAGE_MAX));
  const hintInput = new TextInputBuilder()
    .setCustomId("welcome_hint")
    .setLabel("Variables you can use (this box is ignored)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setValue("{user} {username} {server} {count} {memberOrdinal}");
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

  const newMsg = modalResponse.fields.getTextInputValue("welcome_msg_input").trim();
  const problem = welcomeMessageProblem(newMsg);
  if (problem) {
    await modalResponse.editReply(problem);
    return;
  }
  const saved = await updateGuildConfig(guildId, { welcomeMessage: newMsg });
  const unknown = unknownVariables(newMsg);
  const notes = [
    unknown.length ? `⚠️ ${unknown.map(v => `\`${v}\``).join(", ")} isn't a variable Aegis fills in, so it will appear as typed.` : "",
    !saved.welcomeEnabled || !saved.welcomeChannelId ? "ℹ️ Welcoming is off or has no channel yet, so this won't be sent until you run `/welcome channel`." : "",
  ].filter(Boolean).join("\n");
  await modalResponse.editReply({
    content: notes || undefined,
    embeds: [
      new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle("✅ Welcome Message Updated")
        .addFields(
          { name: "📝 New Message (raw)", value: `\`\`\`\n${newMsg.replace(/`/g, "ˋ").slice(0, 900)}\n\`\`\``, inline: false },
          { name: "👁️ Preview", value: applyVariables(newMsg, interaction).slice(0, 1024), inline: false },
        )
        .setFooter({ text: "Variables are substituted when a member actually joins. Run /welcome test to post it for real." })
        .setTimestamp(),
    ],
    components: [dashboardRow(guildId, PAGE)],
    allowedMentions: { parse: [] },
  });
}

async function setRole(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild!;
  const role = interaction.options.getRole("role");
  const clear = interaction.options.getBoolean("clear") ?? false;
  if (!role && !clear) {
    const cfg = await getGuildConfig(guild.id);
    return replyError(interaction, cfg.welcomeRoleId ? `🎭 New members get <@&${cfg.welcomeRoleId}>. Pick another \`role\`, or set \`clear\` to stop.` : "🎭 No auto-role is set. Pick a `role` to give every new member.");
  }
  if (role && clear) return replyError(interaction, "❌ Pick a `role` **or** set `clear`, not both.");
  if (role) {
    const problem = botRoleProblem(guild, role, "as the welcome role");
    if (problem) return replyError(interaction, problem);
    const tooHigh = roleAboveActor({
      ownerId: guild.ownerId, actorId: interaction.user.id,
      actorTopPosition: await memberTopRolePosition(guild, interaction.user.id), roles: [role],
    });
    if (tooHigh) return replyError(interaction, `❌ You can't use <@&${role.id}> as the welcome role: it is equal to or above your highest role.`);
  }
  await updateGuildConfig(guild.id, { welcomeRoleId: role?.id ?? null });
  await interaction.reply({
    content: role ? `✅ New members will get <@&${role.id}> when they join (after membership screening, if it's on).` : "✅ New members no longer get an auto-role.",
    components: [dashboardRow(guild.id, PAGE)],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Greet new members: channel, message, auto-role, preview and test.")
    .addSubcommand(sub => sub.setName("status").setDescription("See the welcome settings with on/off and preview buttons."))
    .addSubcommand(sub =>
      sub
        .setName("channel")
        .setDescription("Set the channel where welcome messages are posted (also turns welcoming on).")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel new members can see").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true)
        )
    )
    .addSubcommand(sub => sub.setName("message").setDescription("Open a form to write the welcome message (up to 1000 characters)."))
    .addSubcommand(sub => sub.setName("preview").setDescription("Preview the welcome message with you as the new member (only you see it)."))
    .addSubcommand(sub =>
      sub
        .setName("test")
        .setDescription("Post the saved welcome or goodbye message in its channel, with you as the member.")
        .addStringOption(opt =>
          opt.setName("type").setDescription("Which message to test (default: welcome)").setRequired(false)
            .addChoices({ name: "Welcome", value: "welcome" }, { name: "Goodbye", value: "goodbye" })
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("toggle")
        .setDescription("Turn welcome messages on or off (keeps the channel and text).")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("True to greet new members, false to stop").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("role")
        .setDescription("Give every new member a role when they join, or stop doing so.")
        .addRoleOption(opt => opt.setName("role").setDescription("Role to give (must be below Aegis's role)"))
        .addBooleanOption(opt => opt.setName("clear").setDescription("Stop giving an auto-role"))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  guildOnly: true,

  // Used by subcommands, buttons or background work; requested on the invite, checked where used.
  featurePermissions: [PermissionFlagsBits.ManageRoles],
  userPermissions: [PermissionFlagsBits.ManageGuild],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    try {
      if (sub === "status") return await showStatus(interaction);
      if (sub === "message") return await editMessage(interaction);
      if (sub === "role") return await setRole(interaction);

      if (sub === "channel") {
        const channel = interaction.options.getChannel("channel", true);
        const config = await getGuildConfig(guildId);
        const needs: PermissionList = [
          [PermissionFlagsBits.ViewChannel, "View Channel"],
          [PermissionFlagsBits.SendMessages, "Send Messages"],
          ...(config.welcomeEmbed ? [[PermissionFlagsBits.EmbedLinks, "Embed Links"] as const] : []),
        ];
        const problem = await botChannelProblem(interaction.guild!, channel as never, needs);
        if (problem) return await replyError(interaction, problem);

        await updateGuildConfig(guildId, { welcomeChannelId: channel.id, welcomeEnabled: true });
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle("✅ Welcome Channel Set")
              .setDescription(`Welcome messages will now be sent to <#${channel.id}>.\n\nWelcoming is now **enabled**.`)
              .addFields({ name: "💡 Next Step", value: "Use `/welcome message` to customize the text, then `/welcome test` to try it.", inline: false })
              .setTimestamp(),
          ],
          components: [dashboardRow(guildId, PAGE)],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (sub === "preview") {
        const config = await getGuildConfig(guildId);
        const embed = previewEmbed(config.welcomeMessage, interaction).addFields(
          { name: "📌 Channel", value: config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : "❌ Not configured", inline: true },
          { name: "🟢 Status",  value: config.welcomeEnabled ? "Enabled" : "Disabled", inline: true },
        );
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
        return;
      }

      if (sub === "test") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const member = await interaction.guild!.members.fetch(interaction.user.id);
        const kind = interaction.options.getString("type") === "goodbye" ? "goodbye" : "welcome";
        await interaction.editReply({ content: await sendGreetingTest(member, kind) });
        return;
      }

      if (sub === "toggle") {
        const enabled = interaction.options.getBoolean("enabled", true);
        const config = await getGuildConfig(guildId);
        if (enabled && !config.welcomeChannelId) {
          return await replyError(interaction, "❌ There's no welcome channel yet. Run `/welcome channel` to pick one; that turns welcoming on too.");
        }
        await updateGuildConfig(guildId, { welcomeEnabled: enabled });
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(enabled ? 0x57F287 : 0xED4245)
              .setTitle(enabled ? "✅ Welcome Messages Enabled" : "🔴 Welcome Messages Disabled")
              .setDescription(enabled
                ? `New members will now be greeted in <#${config.welcomeChannelId}>.`
                : "New members will no longer receive a welcome message. Your channel and text are kept.")
              .setTimestamp(),
          ],
          components: [dashboardRow(guildId, PAGE)],
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (err) {
      logger.error(`Failed to handle /welcome ${sub} for guild ${guildId}`, err);
      await replyError(interaction, "❌ Couldn't update the welcome settings. Nothing was changed; try again in a moment.");
    }
  },
};

export default command;
