import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Guild,
  type Role,
} from "discord.js";
import type { Command } from "../../types/discord";
import { colorHex, notablePermissions, roleMemberCount, yesNo } from "../../services/lookupFormat";
import { dateAndAgo } from "../../services/infoFormat";
import { truncate } from "../../utils/safeText";
import { roleAssignLabel } from "../../services/infoAccess";
import { memberLine, permissionsText, roleKind, sortMembersForList } from "../../services/roleDetails";
import { replyPagedList } from "../../utils/listPager";
import { guardCollect } from "../../utils/collectorGuard";
import { COLORS, footer } from "../../utils/embedStyle";

/** Above this many members, Aegis lists only the members it already has loaded instead of fetching everyone. */
export const ROLEINFO_FULL_FETCH_MAX = 5_000;

async function roleMembers(guild: Guild, role: Role): Promise<{ list: { id: string; tag: string; bot: boolean }[]; partial: boolean }> {
  let partial = guild.memberCount > ROLEINFO_FULL_FETCH_MAX;
  if (!partial) await guild.members.fetch({ time: 10_000 }).catch(() => { partial = true; });
  const list = sortMembersForList(role.members.map(m => ({ id: m.id, tag: m.user.tag, bot: m.user.bot })));
  return { list, partial };
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("roleinfo")
    .setDescription("Show a role's colour, position, members, permissions and creation date.")
    .addRoleOption(o => o.setName("role").setDescription("The role to look up").setRequired(true))
    .addBooleanOption(o => o.setName("ephemeral").setDescription("Only show the response to you (default: false)")),
  guildOnly: true,
  cooldownMs: 2000,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const picked = interaction.options.getRole("role", true);
    const role = guild.roles.cache.get(picked.id) ?? await guild.roles.fetch(picked.id).catch(() => null);
    if (!role) {
      await interaction.reply({ content: "❌ I couldn't find that role in this server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const ephemeral = interaction.options.getBoolean("ephemeral") ?? false;

    const isEveryone = role.id === guild.id;
    const perms = notablePermissions(role.permissions.bitfield);
    const highest = guild.roles.highest;
    const botMember = guild.members.me;
    const assignLabel = roleAssignLabel({
      isEveryone,
      managed: role.managed,
      rolePosition: role.position,
      botHighestPosition: botMember ? botMember.roles.highest.position : null,
      botHasManageRoles: botMember ? botMember.permissions.has("ManageRoles") : false,
    });

    const embed = new EmbedBuilder()
      .setColor(role.color || COLORS.muted)
      .setTitle(`Role: ${truncate(role.name, 200)}`)
      .setDescription(isEveryone ? "@everyone" : `<@&${role.id}> · ${roleKind(role.tags, isEveryone)}`)
      .addFields(
        { name: "ID", value: `\`${role.id}\``, inline: true },
        { name: "Colour", value: colorHex(role.color), inline: true },
        { name: "Position", value: `${role.position} of ${Math.max(0, highest.position)}`, inline: true },
        { name: "Members", value: roleMemberCount(role.members.size, isEveryone, guild.memberCount), inline: true },
        { name: "Shown separately", value: yesNo(role.hoist), inline: true },
        { name: "Mentionable", value: yesNo(role.mentionable), inline: true },
        { name: "Managed", value: role.managed ? "Yes (by an integration or bot)" : "No", inline: true },
        { name: "Bot can assign", value: assignLabel, inline: true },
        { name: "Created", value: dateAndAgo(role.createdTimestamp), inline: true },
        { name: "Notable permissions", value: perms.length ? truncate(perms.join(", "), 1024) : "None", inline: false },
      )
      .setFooter(footer("Buttons: full permission list and members"));
    const icon = role.iconURL({ size: 256 });
    if (icon) embed.setThumbnail(icon);
    else if (role.unicodeEmoji) embed.addFields({ name: "Icon", value: role.unicodeEmoji, inline: true });

    const ids = { perms: `roleinfo_perms_${interaction.id}`, members: `roleinfo_members_${interaction.id}` };
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(ids.perms).setLabel("All permissions").setEmoji("🔑").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(ids.members).setLabel("Members").setEmoji("👥").setStyle(ButtonStyle.Secondary).setDisabled(isEveryone),
    );
    const response = await interaction.reply({
      embeds: [embed], components: [row], allowedMentions: { parse: [] }, withResponse: true,
      ...(ephemeral ? { flags: MessageFlags.Ephemeral as const } : {}),
    });
    const message = response.resource?.message;
    if (!message) return;

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      idle: 120_000,
      filter: (i) => i.customId === ids.perms || i.customId === ids.members,
    });
    collector.on("collect", (i) => guardCollect("roleinfo", i, async () => {
      if (i.customId === ids.perms) {
        const permEmbed = new EmbedBuilder()
          .setColor(role.color || COLORS.muted)
          .setTitle(`🔑 Permissions: ${truncate(role.name, 200)}`)
          .setDescription(permissionsText(role.permissions.bitfield))
          .setFooter(footer());
        await i.reply({ embeds: [permEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const { list, partial } = await roleMembers(guild, role);
      await replyPagedList(i, {
        title: `👥 ${truncate(role.name, 180)} · ${list.length.toLocaleString("en-US")} member${list.length === 1 ? "" : "s"}`,
        lines: list.map(memberLine),
        empty: "Nobody has this role.",
        perPage: 20,
        color: role.color || COLORS.muted,
        note: partial ? "Large server: only members Aegis has loaded are listed" : undefined,
        ephemeral: true,
      });
    }));
    collector.on("end", () => {
      row.components.forEach(c => c.setDisabled(true));
      interaction.editReply({ components: [row] }).catch(() => null);
    });
  },
};

export default command;
