/** /ticket add, remove, rename and settings: the staff tools inside a ticket and the module settings. */
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, type ChatInputCommandInteraction, type Guild, type TextChannel } from "discord.js";
import {
  addUserToTicket,
  removeUserFromTicket,
  canManageTicket,
  getTicketSettings,
  updateTicketSettings,
  ensureAutoCloseChecks,
} from "../../../services/ticketService";
import { requestConfirmation } from "../../../utils/confirmation";
import { botChannelProblem, dashboardRow, POST_FILE_PERMISSIONS, replyError } from "../../config/kit/setupKit";
import { cleanTicketName } from "./builder";

/** How long /ticket rename waits before saying Discord's rename limit is holding it up. */
export const RENAME_WAIT_MS = 8_000;

const NOT_TICKET = "❌ Run this inside an open ticket channel. Only support staff (the ticket's staff role or Manage Channels) can use it.";

/** The ticket channel this command runs in, when the invoker may manage it; null otherwise. */
async function managedTicketChannel(interaction: ChatInputCommandInteraction, guild: Guild): Promise<TextChannel | null> {
  const channel = interaction.channel as TextChannel | null;
  if (!channel || !("permissionOverwrites" in channel)) return null;
  return (await canManageTicket(guild, channel.id, interaction.user.id)) ? channel : null;
}

export async function addToTicket(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const channel = await managedTicketChannel(interaction, guild);
  if (!channel) return replyError(interaction, NOT_TICKET);
  const target = interaction.options.getUser("user", true);
  if (target.id === interaction.client.user?.id) return replyError(interaction, "ℹ️ Aegis already has access to every ticket.");
  const member = await guild.members.fetch(target.id).catch(() => null);
  if (!member) return replyError(interaction, `❌ <@${target.id}> isn't in this server, so they can't be added.`);
  if (channel.permissionsFor(member)?.has(PermissionFlagsBits.ViewChannel)) {
    return replyError(interaction, `ℹ️ <@${target.id}> can already see this ticket.`);
  }
  const ok = await addUserToTicket(channel, target.id);
  if (!ok) {
    return replyError(interaction, "❌ Couldn't add them. Aegis needs **Manage Channels** and **Manage Permissions** in this ticket channel.");
  }
  // Public, so the added member gets a ping that leads them to the ticket.
  await interaction.reply({ content: `✅ <@${target.id}> was added to this ticket by <@${interaction.user.id}>.`, allowedMentions: { users: [target.id] } });
}

export async function removeFromTicket(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const channel = await managedTicketChannel(interaction, guild);
  if (!channel) return replyError(interaction, NOT_TICKET);
  const target = interaction.options.getUser("user", true);
  if (target.id === interaction.client.user?.id) return replyError(interaction, "❌ Aegis can't be removed from a ticket; it needs access to close it.");

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const { TicketModel } = await import("../../../database/mongo");
  const ticket = await TicketModel.findOne({ guildId: guild.id, channelId: channel.id, status: "open" }).lean();
  if (ticket?.userId === target.id) {
    const answer = await requestConfirmation(interaction, {
      content: `⚠️ <@${target.id}> opened this ticket. Remove them anyway? They won't be able to read or reply here.`,
      confirmLabel: "Remove the opener",
    });
    if (answer !== "confirmed") return;
  }
  const ok = await removeUserFromTicket(channel, target.id);
  if (!ok) {
    await interaction.editReply({ content: "❌ Couldn't remove them. Aegis needs **Manage Channels** and **Manage Permissions** in this ticket channel.", components: [] });
    return;
  }
  const member = await guild.members.fetch(target.id).catch(() => null);
  const stillSees = member ? channel.permissionsFor(member)?.has(PermissionFlagsBits.ViewChannel) : false;
  await interaction.editReply({
    content: `✅ Removed <@${target.id}> from the ticket.${stillSees ? "\nℹ️ They can still see it through one of their roles (staff role or Manage Channels)." : ""}`,
    components: [],
    allowedMentions: { parse: [] },
  });
}

export async function renameTicket(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const channel = await managedTicketChannel(interaction, guild);
  if (!channel) return replyError(interaction, NOT_TICKET);
  const name = cleanTicketName(interaction.options.getString("name", true));
  if (!name) return replyError(interaction, "❌ That name has no letters or numbers left once Discord's rules are applied. Try something like `billing-help`.");
  if (name === channel.name) return replyError(interaction, `ℹ️ This ticket is already called \`${name}\`.`);

  // Discord allows two renames per channel every 10 minutes and queues the rest,
  // which would outlast the interaction: answer first, then wait a bounded time.
  await interaction.deferReply();
  const rename = channel.setName(name, `Ticket renamed by ${interaction.user.tag}`).then(() => "done" as const, () => "failed" as const);
  const outcome = await Promise.race([rename, new Promise<"slow">(r => setTimeout(() => r("slow"), RENAME_WAIT_MS).unref?.())]);
  if (outcome === "done") {
    await interaction.editReply(`✅ Ticket channel renamed to \`${name}\`.`);
  } else if (outcome === "slow") {
    await interaction.editReply(`⏳ Discord allows 2 channel renames every 10 minutes. This ticket will become \`${name}\` as soon as Discord lets it.`);
  } else {
    await interaction.editReply("❌ Couldn't rename the ticket channel. Aegis needs **Manage Channels** here.");
  }
}

export async function ticketSettings(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const logChannel = interaction.options.getChannel("log_channel");
  const autoCloseHours = interaction.options.getInteger("autoclose_hours");
  const transcripts = interaction.options.getBoolean("transcripts");
  const clearLog = interaction.options.getBoolean("clear_log_channel") ?? false;
  const changing = Boolean(logChannel) || autoCloseHours !== null || transcripts !== null || clearLog;

  if (changing && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
    return replyError(interaction, "❌ You need `Manage Channels` permission to change ticket settings.");
  }
  if (logChannel && clearLog) {
    return replyError(interaction, "❌ Pick a new `log_channel` **or** set `clear_log_channel`, not both.");
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  if (logChannel) {
    // Transcripts are uploaded as files, so Attach Files is needed too.
    const problem = await botChannelProblem(guild, logChannel as never, POST_FILE_PERMISSIONS);
    if (problem) {
      await interaction.editReply(problem);
      return;
    }
  }

  const patch: Parameters<typeof updateTicketSettings>[1] = {};
  if (logChannel) patch.logChannelId = logChannel.id;
  if (clearLog) patch.logChannelId = null;
  if (autoCloseHours !== null) patch.autoCloseHours = autoCloseHours;
  if (transcripts !== null) patch.transcriptLogging = transcripts;

  const settings = changing ? await updateTicketSettings(guild.id, patch) : await getTicketSettings(guild.id);
  if (changing && settings.autoCloseHours > 0) {
    // Queue checks for tickets opened before auto-close was on; runs after the reply.
    void ensureAutoCloseChecks(guild).catch(() => 0);
  }
  const notes: string[] = [];
  if (settings.transcriptLogging && !settings.logChannelId) notes.push("⚠️ Transcripts are on but there's no log channel, so only the opener's DM copy is sent.");

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(changing ? "✅ Ticket Settings Updated" : "🎫 Ticket Settings")
    .setDescription(notes.join("\n") || null)
    .addFields(
      { name: "📄 Transcript log channel", value: settings.logChannelId ? `<#${settings.logChannelId}>` : "Not set", inline: true },
      { name: "📨 Post transcripts", value: settings.transcriptLogging ? "On" : "Off", inline: true },
      { name: "⏳ Auto-close", value: settings.autoCloseHours > 0 ? `After ${settings.autoCloseHours}h without messages` : "Off", inline: true },
    )
    .setFooter({ text: "The ticket opener always gets a transcript by DM when a ticket closes (if their DMs are open). Auto-close changes apply to the next check of each ticket." })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [dashboardRow(guild.id, "settings/tickets")] });
}
