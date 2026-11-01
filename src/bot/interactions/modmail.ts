/**
 * ModMail components.
 * - mm_pick:<open|new>   server picker in the member's DMs
 * - mm_reply:<a|n>       staff Reply / Reply anonymously buttons → modal
 * - mm_replymodal:<a|n>  the reply modal
 * - mm_close             Close button → confirm (mm_closeyes)
 */
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ModalBuilder, PermissionFlagsBits, TextInputBuilder, TextInputStyle,
  type GuildMember,
} from "discord.js";
import type { ComponentInteraction, ComponentRoute } from "./router";
import { getGuildConfig } from "../../services/configuration";
import {
  MODMAIL_CLOSE_BUTTON, MODMAIL_CLOSE_CONFIRM, MODMAIL_PICK_ID, MODMAIL_REPLY_BUTTON, MODMAIL_REPLY_MAX, MODMAIL_REPLY_MODAL,
  isModmailStaff, normalizeModmailConfig,
} from "../../services/modmailLogic";
import { closeTicket, deliverToGuild, staffReply, takePending } from "../../services/modmailService";

async function staffGate(i: ComponentInteraction): Promise<boolean> {
  if (!i.inGuild() || !i.guild) return false;
  const cfg = normalizeModmailConfig((await getGuildConfig(i.guild.id)).modmail);
  const member = i.member as GuildMember | null;
  const ok = isModmailStaff(cfg, { roleIds: member ? [...member.roles.cache.keys()] : [], manageGuild: i.memberPermissions?.has(PermissionFlagsBits.ManageGuild) === true });
  if (!ok) await i.reply({ content: "❌ Only ModMail staff (the staff role or Manage Server) can do this.", flags: MessageFlags.Ephemeral });
  return ok;
}

export const modmailRoutes: ComponentRoute[] = [
  {
    name: "modmail-pick",
    match: /^mm_pick:(open|new)$/,
    async handle(i) {
      if (!i.isStringSelectMenu()) return;
      const guildId = i.values[0];
      const msg = takePending(i.user.id);
      if (!msg) { await i.update({ content: "That message expired. Send it again.", components: [] }); return; }
      await i.deferUpdate();
      const r = await deliverToGuild(i.client, guildId, i.user, msg.content, msg.attachments);
      const name = i.client.guilds.cache.get(guildId)?.name ?? "that server";
      await i.editReply({ content: r.ok ? `✅ Sent to **${name}** staff.` : `⚠️ ${r.error}`, components: [] });
    },
  },
  {
    name: "modmail-reply-button",
    match: /^mm_reply:([an])$/,
    async handle(i, m) {
      if (!i.isButton() || !(await staffGate(i))) return;
      const modal = new ModalBuilder().setCustomId(`${MODMAIL_REPLY_MODAL}:${m![1]}`).setTitle(m![1] === "a" ? "Reply anonymously" : "Reply to member")
        .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("text").setLabel("Message").setStyle(TextInputStyle.Paragraph).setMaxLength(MODMAIL_REPLY_MAX).setRequired(true),
        ));
      await i.showModal(modal);
    },
  },
  {
    name: "modmail-reply-modal",
    match: /^mm_replymodal:([an])$/,
    async handle(i, m) {
      if (!i.isModalSubmit() || !(await staffGate(i))) return;
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const r = await staffReply(i.client, { guild: i.guild!, threadId: i.channelId!, staff: i.user, content: i.fields.getTextInputValue("text"), anonymous: m![1] === "a" });
      await i.editReply({ content: r.ok ? "✅ Sent to the member." : `❌ ${r.error}` });
    },
  },
  {
    name: "modmail-close",
    match: new RegExp(`^(${MODMAIL_CLOSE_BUTTON}|${MODMAIL_CLOSE_CONFIRM})$`),
    async handle(i) {
      if (!i.isButton() || !(await staffGate(i))) return;
      if (i.customId === MODMAIL_CLOSE_BUTTON) {
        await i.reply({
          content: "Close this conversation? The member is told and the transcript is kept for 90 days.",
          components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(MODMAIL_CLOSE_CONFIRM).setLabel("Close").setStyle(ButtonStyle.Danger))],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await i.deferUpdate();
      const r = await closeTicket(i.client, { guild: i.guild!, threadId: i.channelId!, staff: i.user, reason: null });
      await i.editReply({ content: r.ok ? "🔒 Closed." : `❌ ${r.error}`, components: [] });
    },
  },
];

export { MODMAIL_PICK_ID, MODMAIL_REPLY_BUTTON };
