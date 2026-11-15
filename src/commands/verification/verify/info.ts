/** /verify info (settings card with a two-step disable) and /verify disable. */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Guild,
} from "discord.js";
import { guardCollect } from "../../../utils/collectorGuard";
import { requestConfirmation } from "../../../utils/confirmation";
import { VerificationModel } from "../../../database/mongo";
import { getVerificationConfig, type VerificationConfig } from "../../../services/verificationService";
import { botHas, dashboardButton, dashboardRow } from "../../config/kit/setupKit";
import { verifiedRoleProblem } from "./members";

const PAGE = "settings/verification" as const;

/** Problems an admin should fix for verification to work, as short lines. */
export function verificationWarnings(guild: Pick<Guild, "roles">, cfg: VerificationConfig, canKick: boolean): string[] {
  const out: string[] = [];
  const roleProblem = cfg.verifiedRoleId ? verifiedRoleProblem(guild, cfg.verifiedRoleId) : "❌ No verified role is set.";
  if (roleProblem) out.push(roleProblem.replace(/^❌ /, "⚠️ "));
  if (!cfg.channelId || !cfg.messageId) out.push("⚠️ No panel is posted. Run `/verify setup` to post one.");
  if (cfg.kickUnverifiedMinutes > 0 && !canKick) out.push("⚠️ Auto-kick is on but Aegis lacks **Kick Members**.");
  return out;
}

export function buildVerificationEmbed(cfg: VerificationConfig | null, warnings: string[] = []): EmbedBuilder {
  const embed = new EmbedBuilder().setTitle("🛡️ Verification Settings").setTimestamp();
  if (!cfg || !cfg.enabled) {
    return embed.setColor(0xED4245).setDescription("The verification system is currently **disabled**.\nUse `/verify setup` to post a panel and turn it on.");
  }
  return embed
    .setColor(warnings.length ? 0xFEE75C : 0x3498DB)
    .setDescription(warnings.join("\n") || null)
    .addFields(
      { name: "🟢 Status",        value: "**Enabled**", inline: true },
      { name: "⚙️ Mode",          value: cfg.type === "captcha" ? "`CAPTCHA` (a quick maths question)" : "`BUTTON` (one click)", inline: true },
      { name: "🛡️ Verified Role", value: `<@&${cfg.verifiedRoleId}>`, inline: true },
      { name: "📌 Channel",       value: cfg.channelId ? `<#${cfg.channelId}>` : "Not set", inline: true },
      { name: "📨 Panel",         value: cfg.channelId && cfg.messageId ? `[Jump to panel](https://discord.com/channels/${cfg.guildId}/${cfg.channelId}/${cfg.messageId})` : "Not posted", inline: true },
      { name: "👢 Auto-kick",     value: cfg.kickUnverifiedMinutes > 0 ? `Unverified after ${cfg.kickUnverifiedMinutes} min` : "Off", inline: true },
    );
}

const askRow = (guildId: string) => new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder().setCustomId("verify_disable_quick").setLabel("Disable Verification").setStyle(ButtonStyle.Danger).setEmoji("🔴"),
  dashboardButton(guildId, PAGE),
);
const confirmRow = () => new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder().setCustomId("verify_disable_confirm").setLabel("Yes, disable it").setStyle(ButtonStyle.Danger),
  new ButtonBuilder().setCustomId("verify_disable_cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary),
);

export async function verifyInfo(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const config = await getVerificationConfig(guild.id);
  const on = Boolean(config?.enabled);
  const warnings = config && on ? verificationWarnings(guild, config, botHas(guild, PermissionFlagsBits.KickMembers)) : [];
  const sent = await interaction.editReply({
    embeds: [buildVerificationEmbed(config, warnings)],
    components: on ? [askRow(guild.id)] : [dashboardRow(guild.id, PAGE)],
    allowedMentions: { parse: [] },
  });
  if (!on) return;

  const collector = sent.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60_000,
    filter: (i) => i.user.id === interaction.user.id,
  });
  collector.on("collect", (i) => guardCollect("verify", i, async () => {
    if (i.customId === "verify_disable_quick") {
      await i.update({ content: "⚠️ Disable verification? New members won't be able to verify until you run `/verify setup` again.", components: [confirmRow()] });
      return;
    }
    if (i.customId === "verify_disable_cancel") {
      await i.update({ content: "", components: [askRow(guild.id)] });
      return;
    }
    if (i.customId === "verify_disable_confirm") {
      await i.deferUpdate();
      await VerificationModel.updateOne({ guildId: guild.id }, { $set: { enabled: false } });
      await i.editReply({ content: "🔴 Verification has been disabled.", embeds: [buildVerificationEmbed(await getVerificationConfig(guild.id))], components: [dashboardRow(guild.id, PAGE)] });
      collector.stop("done");
    }
  }));
  collector.on("end", (_c, reason) => {
    if (reason !== "done") interaction.editReply({ content: "", components: [dashboardRow(guild.id, PAGE)] }).catch(() => null);
  });
}

export async function verifyDisable(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const config = await getVerificationConfig(guild.id);
  if (!config || !config.enabled) {
    await interaction.editReply("ℹ️ Verification is already off. Turn it on with `/verify setup`.");
    return;
  }
  const answer = await requestConfirmation(interaction, {
    content: `⚠️ Disable verification? New members won't be able to verify, and members waiting on <@&${config.verifiedRoleId}> stay without it until you run \`/verify setup\` again.`,
    confirmLabel: "Disable verification",
  });
  if (answer !== "confirmed") return;
  await VerificationModel.updateOne({ guildId: guild.id }, { $set: { enabled: false } });
  await interaction.editReply({
    content: "",
    embeds: [
      new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle("🔴 Verification Disabled")
        .setDescription("The verification system has been disabled. The panel stays posted but no longer hands out the role; your settings are kept for next time.")
        .setTimestamp(),
    ],
    components: [dashboardRow(guild.id, PAGE)],
  });
}
