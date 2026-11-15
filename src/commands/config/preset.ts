import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import type { Command } from "../../types/discord";
import { applyPreset, PRESETS, PresetType, type PresetDetails } from "../../services/presetService";
import { getAutomodConfig, updateAutomodConfig } from "../../services/automod";
import { getGuildConfig, updateGuildConfig } from "../../services/configuration";
import { requestConfirmation } from "../../utils/confirmation";
import { logger } from "../../utils/logger";
import { dashboardRow, replyError } from "./kit/setupKit";

const PRESET_CHOICES = [
  { name: "Casual Server", value: "casual" },
  { name: "Standard Community", value: "community" },
  { name: "Gaming Hub", value: "gaming" },
  { name: "Strict Security", value: "strict" },
] as const;

function isPresetType(value: string | null): value is PresetType {
  return value !== null && Object.prototype.hasOwnProperty.call(PRESETS, value);
}

const ACTION = { delete: "delete", warn: "delete + warn", timeout: "delete + timeout" } as const;

/** The card describing a preset: every setting it changes. Pure. */
export function presetEmbed(preset: PresetDetails, title = `⚙️ Server Preset: ${preset.name}`): EmbedBuilder {
  const a = preset.automod;
  const rule = (on: boolean, action: keyof typeof ACTION, extra = "") => `${on ? "🟢 On" : "🔴 Off"}${on ? ` · ${ACTION[action]}` : ""}${extra}`;
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(0x3498DB)
    .setDescription(preset.description)
    .addFields(
      { name: "🔤 Blocked words", value: rule(a.words.enabled, a.words.action), inline: true },
      { name: "🔗 Links", value: rule(a.links.enabled, a.links.action), inline: true },
      { name: "📢 Mention spam", value: rule(a.mentions.enabled, a.mentions.action, ` · limit ${a.mentions.threshold}`), inline: true },
      { name: "⚡ Message spam", value: rule(a.spam.enabled, a.spam.action, ` · ${a.spam.maxMessages} msgs / ${a.spam.windowSeconds}s`), inline: true },
      { name: "📈 Warning escalation", value: preset.escalation.thresholds.map(t => `• ${t.atWarnings} warnings → \`${t.action.toUpperCase()}\`${t.durationMinutes ? ` (${t.durationMinutes} min)` : ""}`).join("\n") || "None", inline: false },
    )
    .setFooter({ text: "Other automod rules, allow-lists, exemptions and your own blocked words are kept." });
}

/**
 * Apply a preset without losing what it doesn't cover: the preset service
 * replaces the blocked-word list and the escalation block, so the server's own
 * words and its warning-expiry setting are put back afterwards.
 */
async function applyKeepingCustom(guildId: string, type: PresetType): Promise<PresetDetails> {
  const [beforeAutomod, beforeGuild] = await Promise.all([getAutomodConfig(guildId), getGuildConfig(guildId)]);
  const applied = await applyPreset(guildId, type);
  const after = await getAutomodConfig(guildId);
  const merged = [...new Set([...after.words.list, ...beforeAutomod.words.list])];
  if (merged.length !== after.words.list.length) await updateAutomodConfig(guildId, { words: { list: merged } });
  const expiry = beforeGuild.escalation?.warnExpiryDays ?? null;
  if (expiry !== null) await updateGuildConfig(guildId, { escalation: { ...applied.escalation, warnExpiryDays: expiry } });
  return applied;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("preset")
    .setDescription("Apply a ready-made automod and warning-escalation setup in one step.")
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName("apply")
        .setDescription("Apply a preset to automod and escalation (Administrator; asks to confirm).")
        .addStringOption(opt => opt.setName("type").setDescription("Preset to apply").setRequired(true).addChoices(...PRESET_CHOICES))
    )
    .addSubcommand(sub =>
      sub
        .setName("view")
        .setDescription("See exactly what a preset would change (default: Standard Community).")
        .addStringOption(opt => opt.setName("type").setDescription("Preset to inspect").setRequired(false).addChoices(...PRESET_CHOICES))
    ),

  category: "config",
  guildOnly: true,

  async execute(interaction) {
    if (!interaction.guild) return;
    const subcommand = interaction.options.getSubcommand();
    const raw = interaction.options.getString("type");

    if (subcommand === "view") {
      const type: PresetType = isPresetType(raw) ? raw : "community";
      await interaction.reply({ embeds: [presetEmbed(PRESETS[type])], flags: MessageFlags.Ephemeral });
      return;
    }

    if (subcommand === "apply") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await replyError(interaction, "❌ You need `Administrator` permission to apply presets.");
        return;
      }
      if (!isPresetType(raw)) {
        await replyError(interaction, "❌ Unknown preset. Pick one from the list.");
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const answer = await requestConfirmation(interaction, {
        content: "⚠️ This replaces your blocked-words, links, mention-spam and spam rule settings and your warning escalation steps with the preset below. Your own blocked words are kept.",
        embeds: [presetEmbed(PRESETS[raw], `Apply ${PRESETS[raw].name}?`)],
        confirmLabel: "Apply preset",
      });
      if (answer !== "confirmed") return;

      try {
        const applied = await applyKeepingCustom(interaction.guild.id, raw);
        await interaction.editReply({
          content: "",
          embeds: [presetEmbed(applied, `✅ Applied Preset: ${applied.name}`).setColor(0x2ECC71)],
          components: [dashboardRow(interaction.guild.id, "settings/automod", "Review automod on dashboard")],
        });
      } catch (err) {
        logger.error(`Failed to apply preset ${raw} in guild ${interaction.guild.id}`, err);
        await interaction.editReply({ content: "❌ Couldn't apply the preset. Some settings may have changed; check `/automod status`.", embeds: [], components: [] });
      }
    }
  },
};

export default command;
