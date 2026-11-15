/** Slash-command definition for /ticket. */
import { ChannelType, SlashCommandBuilder } from "discord.js";
import { MAX_TICKET_AUTOCLOSE_HOURS } from "../../../services/ticketTranscript";

/** Discord's embed limits for the panel's title and description. */
export const PANEL_TITLE_MAX = 256;
export const PANEL_DESCRIPTION_MAX = 4000;

export const ticketData = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Support tickets: post the panel, manage open tickets and change ticket settings.")
  .setDMPermission(false)
  .addSubcommand(sub =>
    sub
      .setName("setup")
      .setDescription("Post the \"Create Ticket\" panel in a channel (replaces older panels there).")
      .addChannelOption(opt => opt.setName("channel").setDescription("Text channel for the panel").addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addRoleOption(opt => opt.setName("staff_role").setDescription("Support role that can see and handle every ticket").setRequired(false))
      .addStringOption(opt => opt.setName("title").setDescription("Panel title (default: 🎫 Support Tickets)").setMaxLength(PANEL_TITLE_MAX).setRequired(false))
      .addStringOption(opt => opt.setName("description").setDescription("Panel text shown above the button").setMaxLength(PANEL_DESCRIPTION_MAX).setRequired(false))
  )
  .addSubcommand(sub =>
    sub
      .setName("close")
      .setDescription("Close this ticket: saves a transcript and deletes the channel (asks to confirm).")
      .addStringOption(opt => opt.setName("reason").setDescription("Reason for closing (shown in the transcript log)").setMaxLength(500).setRequired(false))
  )
  .addSubcommand(sub =>
    sub
      .setName("add")
      .setDescription("Give a member access to this ticket (staff only).")
      .addUserOption(opt => opt.setName("user").setDescription("Member to add").setRequired(true))
  )
  .addSubcommand(sub =>
    sub
      .setName("remove")
      .setDescription("Take a member's access to this ticket away (staff only).")
      .addUserOption(opt => opt.setName("user").setDescription("Member to remove").setRequired(true))
  )
  .addSubcommand(sub =>
    sub
      .setName("claim")
      .setDescription("Mark yourself as the staff member handling this ticket.")
  )
  .addSubcommand(sub =>
    sub
      .setName("transcript")
      .setDescription("Get an HTML transcript of this ticket so far (only you see it).")
  )
  .addSubcommand(sub =>
    sub
      .setName("rename")
      .setDescription("Rename this ticket's channel (Discord allows 2 renames per 10 minutes).")
      .addStringOption(opt => opt.setName("name").setDescription("New channel name; spaces become dashes").setRequired(true).setMaxLength(100))
  )
  .addSubcommand(sub =>
    sub
      .setName("settings")
      .setDescription("View or change the transcript log channel and inactivity auto-close.")
      .addChannelOption(opt =>
        opt.setName("log_channel").setDescription("Channel that receives transcripts when tickets close").addChannelTypes(ChannelType.GuildText).setRequired(false)
      )
      .addIntegerOption(opt =>
        opt
          .setName("autoclose_hours")
          .setDescription("Close tickets after this many hours without messages (0 = off, default 48)")
          .setMinValue(0)
          .setMaxValue(MAX_TICKET_AUTOCLOSE_HOURS)
          .setRequired(false)
      )
      .addBooleanOption(opt =>
        opt.setName("transcripts").setDescription("Post transcripts to the log channel on close (default on)").setRequired(false)
      )
      .addBooleanOption(opt =>
        opt.setName("clear_log_channel").setDescription("Stop posting transcripts to a log channel").setRequired(false)
      )
  );

/**
 * A Discord-safe channel name: lowercase, spaces to dashes, only letters,
 * numbers, dashes and underscores, no leading/trailing dashes. Empty when
 * nothing usable is left. Pure.
 */
export function cleanTicketName(raw: string): string {
  return raw
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}
