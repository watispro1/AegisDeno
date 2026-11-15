import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from "discord.js";
import { scopedModalId } from "../../utils/modal";
import { hiddenChannelMessage, isObfuscatedChannel } from "../../utils/channels";
import { memberTopRolePosition, roleAboveActor } from "../../permissions/hierarchy";
import type { Command } from "../../types/discord";
import { setupVerification, getVerificationConfig, setKickUnverifiedMinutes } from "../../services/verificationService";
import { MAX_KICK_UNVERIFIED_MINUTES } from "../../services/verificationLogic";
import { verifyUser, verifyBatch } from "./verify/members";
import { verifyDisable, verifyInfo } from "./verify/info";
import { botChannelProblem, botHas, botRoleProblem, dashboardRow, POST_EMBED_PERMISSIONS, type PermissionList } from "../config/kit/setupKit";

/** The panel channel also needs Read Message History so an older panel can be found and replaced. */
const PANEL_PERMISSIONS: PermissionList = [...POST_EMBED_PERMISSIONS, [PermissionFlagsBits.ReadMessageHistory, "Read Message History"]];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Member verification: post the panel, verify members by hand and change settings.")
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName("setup")
        .setDescription("Post (or replace) the verification panel; a form asks for its title and text.")
        .addChannelOption(opt => opt.setName("channel").setDescription("Text channel new members can see").addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addRoleOption(opt => opt.setName("verified_role").setDescription("Role members get once verified (must be below Aegis's role)").setRequired(true))
        .addStringOption(opt =>
          opt
            .setName("type")
            .setDescription("One click, or a quick maths CAPTCHA (default: one click)")
            .setRequired(false)
            .addChoices(
              { name: "One-Click Button", value: "button" },
              { name: "CAPTCHA Verification", value: "captcha" }
            )
        )
        .addIntegerOption(opt =>
          opt
            .setName("kick_unverified_minutes")
            .setDescription("Kick members who have not verified after this many minutes (0 = off, default)")
            .setMinValue(0)
            .setMaxValue(MAX_KICK_UNVERIFIED_MINUTES)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("autokick")
        .setDescription("Kick members who stay unverified for too long (0 turns it off).")
        .addIntegerOption(opt =>
          opt
            .setName("minutes")
            .setDescription("Minutes after joining before an unverified member is kicked (0 = off)")
            .setMinValue(0)
            .setMaxValue(MAX_KICK_UNVERIFIED_MINUTES)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("user")
        .setDescription("Give one member the verified role by hand.")
        .addUserOption(opt => opt.setName("target").setDescription("Member to verify").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("batch")
        .setDescription("Verify up to 50 members at once by pasting their user IDs.")
    )
    .addSubcommand(sub =>
      sub
        .setName("info")
        .setDescription("See the verification settings and any problems to fix.")
    )
    .addSubcommand(sub =>
      sub
        .setName("disable")
        .setDescription("Turn verification off (asks to confirm; settings are kept).")
    ),

  category: "verification",
  guildOnly: true,
  // Used by subcommands, buttons or background work; requested on the invite, checked where used.
  featurePermissions: [PermissionFlagsBits.ManageRoles, PermissionFlagsBits.KickMembers],
  userPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(interaction) {
    if (!interaction.guild) return;
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    // setup (modal)
    if (subcommand === "setup") {
      const channel = interaction.options.getChannel("channel", true) as TextChannel;
      const role = interaction.options.getRole("verified_role", true);
      const type = (interaction.options.getString("type") || "button") as "button" | "captcha";
      const kickOption = interaction.options.getInteger("kick_unverified_minutes");

      // Never post to a channel Aegis cannot see.
      if (isObfuscatedChannel(channel) || isObfuscatedChannel(interaction.guild.channels.cache.get(channel.id))) {
        return interaction.reply({ content: `❌ ${hiddenChannelMessage(channel.id)}`, flags: MessageFlags.Ephemeral });
      }
      // Everyone who verifies gets this role, the invoker included, so it must
      // be below the invoker's own highest role.
      const tooHigh = roleAboveActor({
        ownerId: interaction.guild.ownerId,
        actorId: interaction.user.id,
        actorTopPosition: await memberTopRolePosition(interaction.guild, interaction.user.id),
        roles: [role],
      });
      if (tooHigh) {
        return interaction.reply({
          content: `❌ You can't use <@&${tooHigh.id}> as the verified role: it is equal to or above your highest role.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // Aegis hands the role out and posts the panel itself, so check both before the form opens.
      const roleProblem = botRoleProblem(interaction.guild, role, "as the verified role");
      if (roleProblem) return interaction.reply({ content: roleProblem, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
      const channelProblem = await botChannelProblem(interaction.guild, channel as never, PANEL_PERMISSIONS);
      if (channelProblem) return interaction.reply({ content: channelProblem, flags: MessageFlags.Ephemeral });

      const modal = new ModalBuilder()
        .setCustomId(scopedModalId("verify_setup_modal", interaction.id))
        .setTitle("Verification Panel Details");

      const titleInput = new TextInputBuilder()
        .setCustomId("verify_title")
        .setLabel("Panel Title")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(false)
        .setPlaceholder("e.g. Member Verification");

      const descInput = new TextInputBuilder()
        .setCustomId("verify_desc")
        .setLabel("Panel Description")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(2000)
        .setRequired(false)
        .setPlaceholder("e.g. Click the button below to gain access to the server.");

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
      );

      await interaction.showModal(modal);

      const modalResponse = await interaction.awaitModalSubmit({
        time: 300_000,
        filter: (m) => m.user.id === interaction.user.id && m.customId === scopedModalId("verify_setup_modal", interaction.id),
      }).catch(() => null);

      if (!modalResponse) return;
      await modalResponse.deferReply({ flags: MessageFlags.Ephemeral });

      const title = modalResponse.fields.getTextInputValue("verify_title") || undefined;
      const description = modalResponse.fields.getTextInputValue("verify_desc") || undefined;

      // Keep the current auto-kick setting when re-running setup without the option.
      const kickMinutes = kickOption ?? (await getVerificationConfig(guildId))?.kickUnverifiedMinutes ?? 0;
      const result = await setupVerification(interaction.guild, channel, role.id, type, title, description, kickMinutes);

      if (result) {
        await modalResponse.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle("✅ Verification Configured")
              .setDescription(`The verification panel has been posted in <#${channel.id}>.${result.kickUnverifiedMinutes > 0 && !botHas(interaction.guild, PermissionFlagsBits.KickMembers) ? "\n⚠️ Auto-kick is on but Aegis lacks **Kick Members**, so nobody will be kicked." : ""}`)
              .addFields(
                { name: "🛡️ Role", value: `<@&${role.id}>`, inline: true },
                { name: "⚙️ Type", value: type === "captcha" ? "CAPTCHA" : "One-click button", inline: true },
                { name: "👢 Auto-kick", value: result.kickUnverifiedMinutes > 0 ? `After ${result.kickUnverifiedMinutes} min` : "Off", inline: true },
              )
              .setTimestamp(),
          ],
          components: [dashboardRow(guildId, "settings/verification")],
          allowedMentions: { parse: [] },
        });
      } else {
        await modalResponse.editReply("❌ Couldn't post the verification panel. Check that Aegis can **View Channel**, **Send Messages** and **Embed Links** in that channel.");
      }
      return;
    }

    if (subcommand === "info") { await verifyInfo(interaction, interaction.guild); return; }

    // Manual user verify
    if (subcommand === "user") { await verifyUser(interaction, interaction.guild, guildId); return; }

    // Batch verify
    if (subcommand === "batch") { await verifyBatch(interaction, interaction.guild, guildId); return; }

    // Auto-kick
    if (subcommand === "autokick") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
        return interaction.reply({ content: "❌ You need `Kick Members` to change the unverified auto-kick.", flags: MessageFlags.Ephemeral });
      }
      const minutes = interaction.options.getInteger("minutes", true);
      const ok = await setKickUnverifiedMinutes(guildId, minutes);
      if (!ok) {
        return interaction.reply({ content: "❌ Verification is not set up yet. Run `/verify setup` first.", flags: MessageFlags.Ephemeral });
      }
      const cfg = await getVerificationConfig(guildId);
      const notes = [
        minutes > 0 && !botHas(interaction.guild, PermissionFlagsBits.KickMembers) ? "⚠️ Aegis lacks **Kick Members**, so nobody will be kicked until you grant it." : "",
        cfg && !cfg.enabled ? "ℹ️ Verification itself is off, so auto-kick won't run until you turn it back on with `/verify setup`." : "",
      ].filter(Boolean).join("\n");
      return interaction.reply({
        content: (minutes > 0
          ? `✅ Members who join from now on will be kicked if they have not verified within **${minutes}** minute(s). Aegis's role must be above theirs.`
          : "✅ Unverified auto-kick is now **off**. Pending kicks are skipped.") + (notes ? `\n${notes}` : ""),
        flags: MessageFlags.Ephemeral,
        components: [dashboardRow(guildId, "settings/verification")],
      });
    }

    if (subcommand === "disable") { await verifyDisable(interaction, interaction.guild); return; }
  },
};

export default command;
