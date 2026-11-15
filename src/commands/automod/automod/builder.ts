/** Slash-command definition for /automod. */
import { PermissionFlagsBits, SlashCommandBuilder, type SlashCommandSubcommandGroupBuilder } from "discord.js";
import { EXEMPT_SCOPE_CHOICES } from "../../../services/automodExempt";
import { MAX_AUTOMOD_TIMEOUT_MINUTES } from "../../../services/automod";

const ACTION_CHOICES = [
  { name: "Delete message", value: "delete" },
  { name: "Delete and warn", value: "warn" },
  { name: "Delete and timeout", value: "timeout" },
] as const;

/** Adds the toggle and action subcommands every rule group has. */
function ruleBasics(group: SlashCommandSubcommandGroupBuilder, label: string): SlashCommandSubcommandGroupBuilder {
  return group
    .addSubcommand(sub => sub.setName("toggle").setDescription(`Turn the ${label} on or off`)
      .addBooleanOption(opt => opt.setName("enabled").setDescription("True to turn it on, false to turn it off").setRequired(true)))
    .addSubcommand(sub => sub.setName("action").setDescription(`Choose what happens when the ${label} catches a message`)
      .addStringOption(opt => opt.setName("action").setDescription("Delete only, delete and warn, or delete and time out").setRequired(true).addChoices(...ACTION_CHOICES)));
}

export const automodData = new SlashCommandBuilder()
  .setName("automod")
  .setDescription("Set up automod: blocked words, links, invites, spam and more.")
  .addSubcommandGroup(group => ruleBasics(group.setName("words").setDescription("Blocked words filter"), "blocked words filter")
    .addSubcommand(sub => sub.setName("add").setDescription("Block a word or phrase (2-100 characters, not case-sensitive)")
      .addStringOption(opt => opt.setName("word").setDescription("Word or phrase to block").setRequired(true).setMaxLength(100)))
    .addSubcommand(sub => sub.setName("remove").setDescription("Unblock a word; start typing to pick one from the list")
      .addStringOption(opt => opt.setName("word").setDescription("Blocked word to remove").setRequired(true).setMaxLength(100).setAutocomplete(true)))
    .addSubcommand(sub => sub.setName("list").setDescription("Show every blocked word, a page at a time (only you see it)"))
    .addSubcommand(sub => sub.setName("clear").setDescription("Remove every blocked word (asks you to confirm first)")))
  .addSubcommandGroup(group => ruleBasics(group.setName("links").setDescription("Link filtering"), "link filter")
    .addSubcommand(sub => sub.setName("allow").setDescription("Let links to a domain (and its subdomains) through")
      .addStringOption(opt => opt.setName("domain").setDescription("Domain, e.g. youtube.com").setRequired(true).setMaxLength(253)))
    .addSubcommand(sub => sub.setName("unallow").setDescription("Remove a domain from the allowed list; start typing to pick one")
      .addStringOption(opt => opt.setName("domain").setDescription("Allowed domain to remove").setRequired(true).setMaxLength(253).setAutocomplete(true))))
  .addSubcommandGroup(group => ruleBasics(group.setName("invites").setDescription("Discord invites to other servers"), "invite filter")
    .addSubcommand(sub => sub.setName("allow").setDescription("Let one invite code through (your own vanity invite always passes)")
      .addStringOption(opt => opt.setName("code").setDescription("Invite code or link, e.g. discord.gg/partner").setRequired(true).setMaxLength(100)))
    .addSubcommand(sub => sub.setName("unallow").setDescription("Remove an invite code from the allowed list; start typing to pick one")
      .addStringOption(opt => opt.setName("code").setDescription("Allowed invite code or link").setRequired(true).setMaxLength(100).setAutocomplete(true))))
  .addSubcommandGroup(group => ruleBasics(group.setName("mentions").setDescription("Mention-spam filter"), "mention-spam filter")
    .addSubcommand(sub => sub.setName("limit").setDescription("Set how many mentions trigger the filter")
      .addIntegerOption(opt => opt.setName("count").setDescription("Mentions allowed before enforcement").setRequired(true).setMinValue(2).setMaxValue(50))))
  .addSubcommandGroup(group => ruleBasics(group.setName("spam").setDescription("Rapid-message spam detection"), "spam filter")
    .addSubcommand(sub => sub.setName("limit").setDescription("Set the message rate limit (max messages per window)")
      .addIntegerOption(opt => opt.setName("max").setDescription("Max messages before enforcement (2-30)").setRequired(true).setMinValue(2).setMaxValue(30))
      .addIntegerOption(opt => opt.setName("window").setDescription("Time window in seconds (2-60)").setRequired(true).setMinValue(2).setMaxValue(60))))
  .addSubcommandGroup(group => ruleBasics(group.setName("duplicates").setDescription("Same message sent over and over"), "duplicate-message filter")
    .addSubcommand(sub => sub.setName("limit").setDescription("Set how many identical messages are allowed in a window")
      .addIntegerOption(opt => opt.setName("repeats").setDescription("Identical messages allowed (2-10)").setRequired(true).setMinValue(2).setMaxValue(10))
      .addIntegerOption(opt => opt.setName("window").setDescription("Time window in seconds (10-600)").setRequired(true).setMinValue(10).setMaxValue(600))))
  .addSubcommandGroup(group => ruleBasics(group.setName("caps").setDescription("Excessive capitals and character floods"), "caps filter")
    .addSubcommand(sub => sub.setName("limit").setDescription("Set uppercase percentage that triggers the filter")
      .addIntegerOption(opt => opt.setName("percent").setDescription("Uppercase percentage (50-100)").setMinValue(50).setMaxValue(100).setRequired(true))))
  .addSubcommandGroup(group => ruleBasics(group.setName("emoji").setDescription("Emoji walls and zalgo text"), "emoji filter")
    .addSubcommand(sub => sub.setName("limit").setDescription("Set the most emoji one message may have")
      .addIntegerOption(opt => opt.setName("max").setDescription("Emoji allowed per message (3-50)").setRequired(true).setMinValue(3).setMaxValue(50))
      .addBooleanOption(opt => opt.setName("zalgo").setDescription("Also catch zalgo text (default on)"))))
  .addSubcommandGroup(group => {
    group.setName("exempt").setDescription("Safe-list roles or channels from all automod rules or one rule");
    for (const [name, description, kind] of [
      ["addrole", "Exempt a role from automod (all rules, or one)", "role"],
      ["removerole", "Remove a role exemption", "role"],
      ["addchannel", "Exempt a channel from automod (all rules, or one)", "channel"],
      ["removechannel", "Remove a channel exemption", "channel"],
    ] as const) {
      group.addSubcommand(sub => {
        sub.setName(name).setDescription(description);
        if (kind === "role") sub.addRoleOption(opt => opt.setName("role").setDescription("Role whose members automod should skip").setRequired(true));
        else sub.addChannelOption(opt => opt.setName("channel").setDescription("Channel (or category) automod should skip").setRequired(true));
        return sub.addStringOption(opt => opt.setName("rule").setDescription("Only this rule (default: all rules)").addChoices(...EXEMPT_SCOPE_CHOICES));
      });
    }
    return group;
  })
  .addSubcommand(sub => sub.setName("timeout").setDescription("Set how long the \"Delete and timeout\" action times members out")
    .addIntegerOption(opt => opt.setName("minutes").setDescription(`Minutes (1-${MAX_AUTOMOD_TIMEOUT_MINUTES}, default 5)`).setRequired(true).setMinValue(1).setMaxValue(MAX_AUTOMOD_TIMEOUT_MINUTES)))
  .addSubcommand(sub => sub.setName("status").setDescription("See every rule and switch rules on or off with buttons"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);
