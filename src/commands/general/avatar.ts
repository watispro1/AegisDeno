import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
  type ImageExtension,
  type User,
  type UserContextMenuCommandInteraction,
} from "discord.js";
import type { Command } from "../../types/discord";
import { avatarLinkLine } from "../../services/lookupFormat";
import { guardCollect } from "../../utils/collectorGuard";
import { COLORS, footer } from "../../utils/embedStyle";

export type AvatarView = "main" | "server" | "banner";

const VIEW_LABEL: Record<AvatarView, string> = { main: "Avatar", server: "Server avatar", banner: "Banner" };
const VIEW_EMOJI: Record<AvatarView, string> = { main: "🖼️", server: "🏠", banner: "🏞️" };

/** The views a user has: the main avatar always, a server avatar and a profile banner when set. */
export function availableAvatarViews(input: { serverAvatar: boolean; banner: boolean }): AvatarView[] {
  return ["main", ...(input.serverAvatar ? ["server" as const] : []), ...(input.banner ? ["banner" as const] : [])];
}

/** The view to open: the requested one when it exists, else the main avatar, with a note saying why. */
export function pickAvatarView(requested: AvatarView, available: readonly AvatarView[]): { view: AvatarView; note: string | null } {
  if (available.includes(requested)) return { view: requested, note: null };
  const note = requested === "server" ? "No server avatar set, so this is their main avatar." : requested === "banner" ? "They have no profile banner, so this is their avatar." : null;
  return { view: "main", note };
}

interface AvatarTarget {
  user: User;
  member: GuildMember | null;
}

function imageFor(t: AvatarTarget, view: AvatarView, extension?: string, size: 1024 | 4096 = 4096): string | null {
  const opts = { size, ...(extension ? { extension: extension as ImageExtension, forceStatic: extension !== "gif" } : {}) };
  if (view === "banner") return t.user.bannerURL(opts) ?? null;
  if (view === "server") return t.member?.avatar ? t.member.displayAvatarURL(opts) : null;
  return t.user.displayAvatarURL(opts);
}

function render(t: AvatarTarget, view: AvatarView, views: readonly AvatarView[], note: string | null, idPrefix: string) {
  const hash = view === "banner" ? t.user.banner : view === "server" ? t.member?.avatar : t.user.avatar;
  const animated = Boolean(hash?.startsWith("a_"));
  const main = imageFor(t, view) ?? t.user.displayAvatarURL({ size: 4096 });
  const embed = new EmbedBuilder()
    .setColor(t.member?.displayColor || t.user.accentColor || COLORS.brand)
    .setTitle(`${VIEW_LABEL[view]} of ${t.member?.displayName ?? t.user.displayName ?? t.user.username}`)
    .setImage(main)
    .setDescription(hash ? `Download: ${avatarLinkLine(ext => imageFor(t, view, ext) ?? main, animated)}` : "They use Discord's default avatar.")
    .setFooter(footer(note ?? `${t.user.tag} · ${t.user.id}`));
  const switcher = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...(views.length > 1 ? views.map(v => new ButtonBuilder()
      .setCustomId(`${idPrefix}${v}`).setLabel(VIEW_LABEL[v]).setEmoji(VIEW_EMOJI[v])
      .setStyle(v === view ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(v === view)) : []),
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Open full size").setURL(main),
  );
  return { embeds: [embed], components: [switcher], allowedMentions: { parse: [] as never[] } };
}

/**
 * Avatar viewer behind /avatar and the Avatar context menu: main avatar,
 * server avatar and profile banner, switchable with buttons, with download
 * links in every format. Works for users who are not in the server too.
 */
export async function showAvatar(
  interaction: ChatInputCommandInteraction | UserContextMenuCommandInteraction,
  user: User,
  requested: AvatarView,
  ephemeral: boolean,
): Promise<void> {
  await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});
  // Banners and accent colours only come with a forced fetch; one request, both views.
  const [full, member] = await Promise.all([
    user.fetch(true).catch(() => user),
    interaction.guild ? interaction.guild.members.fetch(user.id).catch(() => null) : Promise.resolve(null),
  ]);
  const target: AvatarTarget = { user: full, member };
  const views = availableAvatarViews({ serverAvatar: Boolean(member?.avatar), banner: Boolean(full.banner) });
  const picked = pickAvatarView(requested, views);
  const idPrefix = `avatar_${interaction.id}_`;
  const sent = await interaction.editReply(render(target, picked.view, views, picked.note, idPrefix));
  if (views.length < 2) return;

  const collector = sent.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120_000,
    filter: (i) => i.customId.startsWith(idPrefix),
  });
  collector.on("collect", (i) => guardCollect("avatar", i, async () => {
    const view = i.customId.slice(idPrefix.length) as AvatarView;
    if (!views.includes(view)) return;
    await i.update(render(target, view, views, null, idPrefix));
  }));
  collector.on("end", () => {
    interaction.editReply({ components: [render(target, picked.view, views, null, idPrefix).components[0].setComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Open full size").setURL(imageFor(target, picked.view) ?? full.displayAvatarURL({ size: 4096 })),
    )] }).catch(() => null);
  });
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Show a member's avatar, server avatar or banner in full size, with download links.")
    .addUserOption(o => o.setName("user").setDescription("Whose avatar (defaults to you)").setRequired(false))
    .addBooleanOption(o => o.setName("server").setDescription("Open their server avatar first, when they set one").setRequired(false))
    .addBooleanOption(o => o.setName("banner").setDescription("Open their profile banner first, when they have one").setRequired(false))
    .addBooleanOption(o => o.setName("private").setDescription("Only you can see the reply (default: false)").setRequired(false)),
  guildOnly: true,
  cooldownMs: 2000,

  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser("user") ?? interaction.user;
    const view: AvatarView = interaction.options.getBoolean("banner") ? "banner" : interaction.options.getBoolean("server") ? "server" : "main";
    await showAvatar(interaction, user, view, interaction.options.getBoolean("private") ?? false);
  },
};

export default command;
