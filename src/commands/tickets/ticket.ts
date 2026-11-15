import { PermissionFlagsBits, TextChannel, EmbedBuilder, MessageFlags, type ChatInputCommandInteraction, type Guild } from "discord.js";
import type { Command } from "../../types/discord";
import {
  closeTicket,
  canCloseTicket,
  canManageTicket,
  claimTicket,
  buildTicketTranscript,
  postTicketPanel,
} from "../../services/ticketService";
import { hiddenChannelMessage, isObfuscatedChannel } from "../../utils/channels";
import { requestConfirmation } from "../../utils/confirmation";
import { logger } from "../../utils/logger";
import { botChannelProblem, botHas, dashboardRow, POST_EMBED_PERMISSIONS, replyError, type PermissionList } from "../config/kit/setupKit";
import { ticketData } from "./ticket/builder";
import { addToTicket, removeFromTicket, renameTicket, ticketSettings } from "./ticket/manage";

/** The panel channel also needs Read Message History so older panels can be found and replaced. */
const PANEL_PERMISSIONS: PermissionList = [...POST_EMBED_PERMISSIONS, [PermissionFlagsBits.ReadMessageHistory, "Read Message History"]];

/** Server-wide permissions Aegis needs to open ticket channels when members click the panel. */
export function ticketCreationGaps(has: (bit: bigint) => boolean): string[] {
  return ([[PermissionFlagsBits.ManageChannels, "Manage Channels"], [PermissionFlagsBits.ManageRoles, "Manage Roles"]] as const)
    .filter(([bit]) => !has(bit)).map(([, name]) => name);
}

async function setupPanel(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
    return replyError(interaction, "❌ You need `Manage Channels` permission to set up ticket panels.");
  }
  const channel = interaction.options.getChannel("channel", true) as TextChannel;
  const staffRole = interaction.options.getRole("staff_role");
  const title = interaction.options.getString("title")?.trim() || null;
  const description = interaction.options.getString("description")?.trim() || null;

  if (staffRole && staffRole.id === guild.id) {
    return replyError(interaction, "❌ @everyone can't be the staff role: every member would see every ticket. Pick your support team's role.");
  }
  // Check the channel first so a missing permission is named instead of surfacing as a generic error.
  const problem = await botChannelProblem(guild, channel as never, PANEL_PERMISSIONS);
  if (problem) return replyError(interaction, problem);

  // Replacing older panels reads and deletes messages, which can outlast Discord's 3-second window.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    await postTicketPanel(channel, { staffRoleId: staffRole?.id ?? null, title, description });
  } catch (err) {
    logger.warn(`Ticket panel could not be posted in ${channel.id} of guild ${guild.id}:`, err);
    await interaction.editReply(`❌ Aegis couldn't post the ticket panel in ${channel}. Check that it can **View Channel**, **Send Messages** and **Embed Links** there, then run this again.`);
    return;
  }
  const gaps = ticketCreationGaps((bit) => botHas(guild, bit));
  const embed = new EmbedBuilder()
    .setColor(gaps.length ? 0xFEE75C : 0x57F287)
    .setTitle("✅ Ticket Panel Posted")
    .setDescription(`The panel is live in ${channel}. Older Aegis ticket panels there were replaced.${gaps.length ? `\n⚠️ Aegis lacks **${gaps.join("**, **")}** server-wide, so clicking the panel can't open tickets yet. Grant it in Server Settings → Roles → Aegis.` : ""}`)
    .addFields(
      { name: "🛡️ Staff role", value: staffRole ? `<@&${staffRole.id}>` : "None (only members with Manage Channels see tickets)", inline: true },
      { name: "⚙️ More settings", value: "`/ticket settings` for transcripts and auto-close", inline: true },
    )
    .setTimestamp();
  await interaction.editReply({ embeds: [embed], components: [dashboardRow(guild.id, "settings/tickets")], allowedMentions: { parse: [] } });
}

async function closeHere(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const reason = interaction.options.getString("reason")?.trim() || "Resolved";
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!await canCloseTicket(guild, interaction.channelId, interaction.user.id)) {
    await interaction.editReply("❌ Run this inside an open ticket. Only the ticket opener or support staff can close it.");
    return;
  }
  if (isObfuscatedChannel(interaction.channel)) {
    await interaction.editReply(`❌ ${hiddenChannelMessage(interaction.channelId)} The ticket stays open until then.`);
    return;
  }
  const answer = await requestConfirmation(interaction, {
    content: `🔒 Close this ticket? A transcript is saved and the channel is deleted.\n**Reason:** ${reason.slice(0, 500)}`,
    confirmLabel: "Close ticket",
  });
  if (answer !== "confirmed") return;

  const closed = await closeTicket(guild, interaction.channelId, interaction.user.id, reason);
  await interaction.editReply({ content: closed ? "🔒 Closing the ticket…" : "❌ This ticket was already closed, or isn't an active ticket.", components: [] }).catch(() => null);
}

async function claimHere(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const result = await claimTicket(guild, interaction.channelId, interaction.user.id);
  if (result.status === "not_ticket") return replyError(interaction, "❌ This command can only be used inside an active ticket channel.");
  if (result.status === "forbidden") return replyError(interaction, "❌ Only support staff can claim tickets.");
  if (result.status === "already") {
    return replyError(interaction, result.claimedBy === interaction.user.id ? "ℹ️ You've already claimed this ticket." : `ℹ️ This ticket is already claimed by <@${result.claimedBy}>.`);
  }
  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle("🙋 Ticket Claimed")
    .setDescription(`This ticket is now being handled by <@${interaction.user.id}>.`)
    .setTimestamp();
  await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
}

async function transcriptHere(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const channel = interaction.channel as TextChannel | null;
  if (!channel || !("name" in channel) || !await canManageTicket(guild, channel.id, interaction.user.id)) {
    return replyError(interaction, "❌ Run this inside an open ticket channel. Only support staff can export transcripts.");
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { TicketModel } = await import("../../database/mongo");
  const ticket = await TicketModel.findOne({ guildId: guild.id, channelId: channel.id, status: "open" }).lean();
  const { file, messageCount } = await buildTicketTranscript(channel, {
    ticketId: ticket?.id ?? channel.id,
    openerId: ticket?.userId ?? "unknown",
  });
  if (messageCount === 0) {
    await interaction.editReply("❌ No messages found in this ticket to export. Aegis needs **Read Message History** here.");
    return;
  }
  await interaction.editReply({ content: `📄 **Ticket Transcript Generated** (${messageCount} messages)`, files: [file] });
}

export const command: Command = {
  data: ticketData,

  category: "tickets",
  guildOnly: true,
  // Used by subcommands, buttons or background work; requested on the invite, checked where used.
  featurePermissions: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.AttachFiles],

  async execute(interaction) {
    if (!interaction.guild) return;
    const guild = interaction.guild;
    const subcommand = interaction.options.getSubcommand();
    try {
      switch (subcommand) {
        case "setup": return await setupPanel(interaction, guild);
        case "close": return await closeHere(interaction, guild);
        case "add": return await addToTicket(interaction, guild);
        case "remove": return await removeFromTicket(interaction, guild);
        case "rename": return await renameTicket(interaction, guild);
        case "claim": return await claimHere(interaction, guild);
        case "settings": return await ticketSettings(interaction, guild);
        case "transcript": return await transcriptHere(interaction, guild);
      }
    } catch (err) {
      logger.error(`Failed to handle /ticket ${subcommand} in guild ${guild.id}`, err);
      await replyError(interaction, "❌ Something went wrong with that ticket action. Nothing else was changed; try again in a moment.");
    }
  },
};

export default command;
