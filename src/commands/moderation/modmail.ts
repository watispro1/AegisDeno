/**
 * /modmail — DM tickets. Members DM Aegis; staff answer here.
 * setup needs Manage Server; everything else needs Manage Server or the ModMail staff role.
 */
import {
  ChannelType, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder,
  type AutocompleteInteraction, type ChatInputCommandInteraction, type GuildMember,
} from "discord.js";
import type { Command } from "../../types/discord";
import { getGuildConfig, updateGuildConfig } from "../../services/configuration";
import {
  MODMAIL_MAX_SNIPPETS, MODMAIL_REPLY_MAX, MODMAIL_SNIPPET_MAX, isModmailStaff, normalizeModmailConfig, snippetNameProblem, withBlocked,
  type ModmailConfig,
} from "../../services/modmailLogic";
import { closeTicket, staffReply } from "../../services/modmailService";
import { ModmailSnippetModel, ModmailThreadModel, isDuplicateKey } from "../../database/modmailModels";
import { requestConfirmation } from "../../utils/confirmation";
import { rankChoices } from "../../utils/autocomplete";
import { isObfuscatedChannel } from "../../utils/channels";
import { sendGuildLog } from "../../services/logging";
import { footer } from "../../utils/embedStyle";

const err = (i: ChatInputCommandInteraction, content: string) =>
  (i.deferred || i.replied ? i.editReply({ content }) : i.reply({ content, flags: MessageFlags.Ephemeral })).then(() => undefined);

export function describeModmail(c: ModmailConfig): string {
  return [
    `**Status:** ${c.enabled ? "on" : "off"}`,
    `**Channel:** ${c.channelId ? `<#${c.channelId}>` : "not set"}`,
    `**Staff role:** ${c.staffRoleId ? `<@&${c.staffRoleId}>` : "Manage Server only"}`,
    `**Ping staff on new thread:** ${c.pingStaff ? "yes" : "no"}`,
    `**Relay prefix:** ${c.relayPrefix ? `\`${c.relayPrefix}\`` : "off"}`,
    `**Blocked members:** ${c.blockedUserIds.length}`,
  ].join("\n");
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("modmail")
    .setDescription("ModMail: members DM Aegis, staff reply from a private thread.")
    .addSubcommand(s => s.setName("setup").setDescription("Turn ModMail on and pick its channel and staff role (Manage Server)")
      .addChannelOption(o => o.setName("channel").setDescription("Staff-only text channel (private threads) or forum").setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildForum))
      .addRoleOption(o => o.setName("role").setDescription("Staff role that can answer"))
      .addBooleanOption(o => o.setName("ping_staff").setDescription("Ping the staff role when a new thread opens (default off)"))
      .addBooleanOption(o => o.setName("enabled").setDescription("Turn ModMail on or off (default on)")))
    .addSubcommand(s => s.setName("reply").setDescription("Reply to the member in this ModMail thread")
      .addStringOption(o => o.setName("message").setDescription("What to send").setRequired(true).setMaxLength(MODMAIL_REPLY_MAX))
      .addBooleanOption(o => o.setName("anonymous").setDescription("Hide your name from the member"))
      .addAttachmentOption(o => o.setName("attachment").setDescription("A file to link (up to 25 MB)")))
    .addSubcommand(s => s.setName("close").setDescription("Close this ModMail thread and save its transcript")
      .addStringOption(o => o.setName("reason").setDescription("Shown to the member and in the mod log").setMaxLength(300)))
    .addSubcommand(s => s.setName("block").setDescription("Stop a member from opening ModMail here")
      .addUserOption(o => o.setName("user").setDescription("Member to block").setRequired(true)))
    .addSubcommand(s => s.setName("unblock").setDescription("Let a blocked member use ModMail again")
      .addUserOption(o => o.setName("user").setDescription("Member to unblock").setRequired(true)))
    .addSubcommandGroup(g => g.setName("snippet").setDescription("Saved replies")
      .addSubcommand(s => s.setName("add").setDescription("Save a reply")
        .addStringOption(o => o.setName("name").setDescription("Short name, e.g. rules").setRequired(true).setMaxLength(32))
        .addStringOption(o => o.setName("content").setDescription("The reply").setRequired(true).setMaxLength(MODMAIL_SNIPPET_MAX)))
      .addSubcommand(s => s.setName("remove").setDescription("Delete a saved reply")
        .addStringOption(o => o.setName("name").setDescription("Snippet").setRequired(true).setAutocomplete(true)))
      .addSubcommand(s => s.setName("use").setDescription("Send a saved reply in this thread")
        .addStringOption(o => o.setName("name").setDescription("Snippet").setRequired(true).setAutocomplete(true))
        .addBooleanOption(o => o.setName("anonymous").setDescription("Hide your name from the member")))
      .addSubcommand(s => s.setName("list").setDescription("List saved replies"))),

  guildOnly: true,
  cooldownMs: 1500,

  async autocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guildId) return interaction.respond([]);
    const rows = await ModmailSnippetModel.find({ guildId: interaction.guildId }).select("name content").limit(MODMAIL_MAX_SNIPPETS).lean();
    await interaction.respond(rankChoices(rows.map(r => ({ name: `${r.name} — ${String(r.content).slice(0, 60)}`, value: String(r.name) })), String(interaction.options.getFocused())));
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const member = interaction.member as GuildMember;
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();
    const cfg = normalizeModmailConfig((await getGuildConfig(guild.id)).modmail);
    const manageGuild = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) === true;

    if (sub === "setup" && !group) {
      if (!manageGuild) return err(interaction, "❌ `/modmail setup` needs the **Manage Server** permission. Ask an admin, or have them give your role Manage Server in Server Settings → Roles.");
      const channel = interaction.options.getChannel("channel", true);
      if (isObfuscatedChannel(channel)) return err(interaction, "❌ Aegis can't see that channel. Give Aegis **View Channel** there, or pick another one.");
      const role = interaction.options.getRole("role");
      if (role && role.id === guild.id) return err(interaction, "❌ @everyone can't be the staff role. Pick a staff role.");
      const me = guild.members.me;
      const perms = me ? (guild.channels.cache.get(channel.id) ?? null)?.permissionsFor(me) : null;
      const needed: Array<[bigint, string]> = channel.type === ChannelType.GuildForum
        ? [[PermissionFlagsBits.SendMessages, "Send Messages (create posts)"], [PermissionFlagsBits.SendMessagesInThreads, "Send Messages in Threads"], [PermissionFlagsBits.ManageThreads, "Manage Threads"]]
        : [[PermissionFlagsBits.CreatePrivateThreads, "Create Private Threads"], [PermissionFlagsBits.SendMessagesInThreads, "Send Messages in Threads"], [PermissionFlagsBits.ManageThreads, "Manage Threads"]];
      const missing = perms ? needed.filter(([p]) => !perms.has(p)).map(([, n]) => n) : [];
      const next: ModmailConfig = {
        ...cfg,
        enabled: interaction.options.getBoolean("enabled") ?? true,
        channelId: channel.id,
        staffRoleId: role?.id ?? cfg.staffRoleId,
        pingStaff: interaction.options.getBoolean("ping_staff") ?? cfg.pingStaff,
      };
      await updateGuildConfig(guild.id, { modmail: next });
      await sendGuildLog(interaction.client, guild.id, { color: 0x5865f2, title: "ModMail settings changed", description: `By <@${interaction.user.id}>\n${describeModmail(next)}` }, "modActions");
      const embed = new EmbedBuilder().setColor(0x57f287).setTitle("✅ ModMail saved").setDescription(describeModmail(next)).setFooter(footer("Members can now DM Aegis"));
      if (missing.length) embed.addFields({ name: "⚠️ Aegis is missing permissions there", value: `${missing.join(", ")}. Add them in the channel's settings → Permissions → Aegis.` });
      if (channel.type === ChannelType.GuildText) embed.addFields({ name: "Who sees threads", value: "Private threads show only to people added and to members with **Manage Threads**. Give your staff role Manage Threads on that channel, or turn on `ping_staff` so they're added." });
      return void (await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }));
    }

    if (!isModmailStaff(cfg, { roleIds: [...member.roles.cache.keys()], manageGuild })) {
      return err(interaction, `❌ You need ${cfg.staffRoleId ? `the <@&${cfg.staffRoleId}> role` : "the ModMail staff role"} or **Manage Server** to use ModMail. An admin can set the role with \`/modmail setup\`.`);
    }

    if (group === "snippet") {
      const name = (interaction.options.getString("name") ?? "").trim().toLowerCase();
      if (sub === "list") {
        const rows = await ModmailSnippetModel.find({ guildId: guild.id }).sort({ name: 1 }).limit(MODMAIL_MAX_SNIPPETS).lean();
        const text = rows.length ? rows.map(r => `• \`${r.name}\` — ${String(r.content).slice(0, 80).replace(/\n/g, " ")}`).join("\n") : "No snippets yet. Add one with `/modmail snippet add`.";
        return void (await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("ModMail snippets").setDescription(text.slice(0, 4000)).setFooter(footer(`${rows.length}/${MODMAIL_MAX_SNIPPETS}`))], flags: MessageFlags.Ephemeral }));
      }
      const problem = snippetNameProblem(name);
      if (problem) return err(interaction, `❌ ${problem}`);
      if (sub === "add") {
        if (await ModmailSnippetModel.countDocuments({ guildId: guild.id }) >= MODMAIL_MAX_SNIPPETS) return err(interaction, `❌ This server has the most snippets allowed (${MODMAIL_MAX_SNIPPETS}). Remove one first.`);
        try {
          await ModmailSnippetModel.create({ guildId: guild.id, name, content: interaction.options.getString("content", true), createdBy: interaction.user.id });
        } catch (e) {
          if (isDuplicateKey(e)) return err(interaction, `❌ A snippet called \`${name}\` already exists. Remove it first or pick another name.`);
          throw e;
        }
        return void (await interaction.reply({ content: `✅ Saved snippet \`${name}\`. Send it with \`/modmail snippet use name:${name}\`.`, flags: MessageFlags.Ephemeral }));
      }
      const snippet = await ModmailSnippetModel.findOne({ guildId: guild.id, name }).lean();
      if (!snippet) return err(interaction, `❌ No snippet called \`${name}\`. See them with \`/modmail snippet list\`.`);
      if (sub === "remove") {
        const ok = await requestConfirmation(interaction, { content: `Delete snippet \`${name}\`?`, confirmLabel: "Delete snippet" });
        if (ok !== "confirmed") return;
        await ModmailSnippetModel.deleteOne({ guildId: guild.id, name });
        return void (await interaction.editReply({ content: `🗑️ Deleted snippet \`${name}\`.`, components: [] }));
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const r = await staffReply(interaction.client, { guild, threadId: interaction.channelId, staff: interaction.user, content: String(snippet.content), anonymous: interaction.options.getBoolean("anonymous") ?? cfg.anonymousByDefault });
      return void (await interaction.editReply({ content: r.ok ? `✅ Sent snippet \`${name}\`.` : `❌ ${r.error}` }));
    }

    if (sub === "reply") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const att = interaction.options.getAttachment("attachment");
      const r = await staffReply(interaction.client, {
        guild, threadId: interaction.channelId, staff: interaction.user,
        content: interaction.options.getString("message", true),
        anonymous: interaction.options.getBoolean("anonymous") ?? cfg.anonymousByDefault,
        attachments: att ? [{ name: att.name, url: att.url, size: att.size }] : [],
      });
      return void (await interaction.editReply({ content: r.ok ? "✅ Sent to the member." : `❌ ${r.error}` }));
    }

    if (sub === "close") {
      const open = await ModmailThreadModel.exists({ threadId: interaction.channelId, guildId: guild.id, status: "open" });
      if (!open) return err(interaction, "❌ Run `/modmail close` inside an open ModMail thread.");
      const reason = interaction.options.getString("reason");
      const ok = await requestConfirmation(interaction, { content: `Close this ModMail conversation${reason ? ` (reason: ${reason})` : ""}? The member is told, and the transcript is saved for 90 days.`, confirmLabel: "Close" });
      if (ok !== "confirmed") return;
      const r = await closeTicket(interaction.client, { guild, threadId: interaction.channelId, staff: interaction.user, reason });
      return void (await interaction.editReply({ content: r.ok ? "🔒 Closed. The transcript is in the dashboard's ModMail page." : `❌ ${r.error}`, components: [] }).catch(() => null));
    }

    if (sub === "block" || sub === "unblock") {
      const user = interaction.options.getUser("user", true);
      if (sub === "block" && user.id === interaction.user.id) return err(interaction, "❌ You can't block yourself.");
      const blocked = cfg.blockedUserIds.includes(user.id);
      if ((sub === "block") === blocked) return err(interaction, `ℹ️ <@${user.id}> is ${blocked ? "already" : "not"} blocked.`);
      await updateGuildConfig(guild.id, { modmail: withBlocked(cfg, user.id, sub === "block") });
      await sendGuildLog(interaction.client, guild.id, { color: 0xffa500, title: `ModMail ${sub}`, description: `<@${user.id}> (\`${user.id}\`) by <@${interaction.user.id}>` }, "modActions");
      return void (await interaction.reply({ content: sub === "block" ? `🚫 <@${user.id}> can no longer open ModMail here. Undo with \`/modmail unblock\`.` : `✅ <@${user.id}> can use ModMail again.`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }));
    }
  },
};

export default command;
