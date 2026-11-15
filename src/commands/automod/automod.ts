import { guardCollect } from "../../utils/collectorGuard";
import { logger } from "../../utils/logger";
import { ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, type AutocompleteInteraction } from "discord.js";
import { Command } from "../../types/discord";
import { getAutomodConfig, updateAutomodConfig, type AutomodConfig } from "../../services/automod";
import { editExemption, parseScope } from "../../services/automodExempt";
import { automodEdit, RULE_LABELS } from "../../services/automodSettings";
import { requestConfirmation } from "../../utils/confirmation";
import { replyPagedList } from "../../utils/listPager";
import { automodData } from "./automod/builder";
import { buildStatusPayload, toggleKeyFromId } from "./automod/status";
import { actionPermissionWarning, afterChangeLine, automodChoices, findStoredWord, wordListLines } from "./automod/views";
import { dashboardRow } from "../config/kit/setupKit";

const PAGE = "settings/automod" as const;

/** The status card with its quick toggles; the buttons only answer the person who opened it. */
async function showStatus(interaction: ChatInputCommandInteraction, config: AutomodConfig): Promise<void> {
  const guildId = interaction.guildId!;
  const link = dashboardRow(guildId, PAGE);
  const initial = buildStatusPayload(config);
  const sent = await interaction.editReply({ embeds: [initial.embed], components: [...initial.rows, link] });

  const collector = sent.createMessageComponentCollector({
    time: 180_000,
    filter: (i) => i.user.id === interaction.user.id,
  });

  collector.on("collect", (i) => guardCollect("automod", i, async () => {
    const key = toggleKeyFromId(i.customId);
    if (!key) return;
    // Acknowledge first: the save below can take longer than Discord's 3-second window.
    await i.deferUpdate();
    // Re-read so a change made elsewhere since /automod status opened is not overwritten.
    const fresh = await getAutomodConfig(guildId);
    const saved = await updateAutomodConfig(guildId, { [key]: { enabled: !fresh[key].enabled } });
    const updated = buildStatusPayload(saved);
    await interaction.editReply({ embeds: [updated.embed], components: [...updated.rows, link] });
  }));

  collector.on("end", async () => {
    await interaction.editReply({ components: [link] }).catch(() => null);
  });
}

/** /automod words clear: confirm, then empty the list. */
async function clearWords(interaction: ChatInputCommandInteraction, config: AutomodConfig): Promise<void> {
  const count = config.words.list.length;
  if (count === 0) {
    await interaction.editReply("ℹ️ There are no blocked words to remove.");
    return;
  }
  const answer = await requestConfirmation(interaction, {
    content: `⚠️ Remove all **${count}** blocked word(s)? The blocked words filter stays ${config.words.enabled ? "on" : "off"} but has nothing to catch until you add words again.`,
    confirmLabel: "Remove all words",
  });
  if (answer !== "confirmed") return;
  const saved = await updateAutomodConfig(interaction.guildId!, { words: { list: [] } });
  await interaction.editReply({
    content: `✅ Removed all ${count} blocked word(s).${afterChangeLine(saved, "words")}`,
    components: [dashboardRow(interaction.guildId!, PAGE)],
  });
}

export const command: Command = {
  data: automodData,

  guildOnly: true,

  // Used by subcommands, buttons or background work; requested on the invite, checked where used.
  featurePermissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers],
  userPermissions: [PermissionFlagsBits.ManageGuild],

  /** Suggests the server's blocked words, allowed domains and allowed invite codes. Managers only. */
  autocomplete: async (interaction: AutocompleteInteraction) => {
    if (!interaction.guildId || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.respond([]).catch(() => null);
      return;
    }
    const focused = interaction.options.getFocused(true);
    const config = await getAutomodConfig(interaction.guildId).catch(() => null);
    await interaction.respond(config ? automodChoices(config, focused.name, String(focused.value ?? "")) : []).catch(() => null);
  },

  execute: async (interaction: ChatInputCommandInteraction) => {
    const group   = interaction.options.getSubcommandGroup(false);
    const sub     = interaction.options.getSubcommand(true);
    const guildId = interaction.guildId!;

    // Private: replies can contain the blocked words themselves.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const config = await getAutomodConfig(guildId);

      if (sub === "status") {
        await showStatus(interaction, config);
        return;
      }

      if (group === "words" && sub === "list") {
        await replyPagedList(interaction, {
          title: `🔤 Blocked words (${config.words.list.length})`,
          lines: wordListLines(config.words.list),
          empty: "No blocked words yet. Add one with `/automod words add`.",
          header: `Filter is **${config.words.enabled ? "on" : "off"}** · action \`${config.words.action}\``,
          perPage: 25,
          ephemeral: true,
          note: "Remove one with /automod words remove",
        });
        return;
      }

      if (group === "words" && sub === "clear") {
        await clearWords(interaction, config);
        return;
      }

      if (group === "exempt") {
        const kind = sub.endsWith("role") ? "role" : "channel";
        const id = kind === "role" ? interaction.options.getRole("role", true).id : interaction.options.getChannel("channel", true).id;
        if (kind === "role" && id === guildId && sub.startsWith("add")) {
          await interaction.editReply("❌ Exempting @everyone would switch automod off for every member. Turn the rule off with `/automod <rule> toggle` instead.");
          return;
        }
        const edit = editExemption(config, parseScope(interaction.options.getString("rule")), kind, id, sub.startsWith("add"));
        if (edit.ok) await updateAutomodConfig(guildId, edit.patch);
        await interaction.editReply({ content: edit.message, allowedMentions: { parse: [] }, components: edit.ok ? [dashboardRow(guildId, PAGE)] : [] });
        return;
      }

      const o = interaction.options;

      // Blocked words saved on the dashboard may keep their capitals; match them without case.
      if (group === "words" && sub === "remove") {
        const stored = findStoredWord(config.words.list, o.getString("word", true));
        if (stored !== null) {
          const saved = await updateAutomodConfig(guildId, { words: { list: config.words.list.filter(w => w !== stored) } });
          await interaction.editReply({
            content: `✅ Removed \`${stored}\` from blocked words.${afterChangeLine(saved, "words")}`,
            allowedMentions: { parse: [] },
            components: [dashboardRow(guildId, PAGE)],
          });
          return;
        }
      }

      const edit = automodEdit(config, group, sub, {
        enabled: o.getBoolean("enabled"),
        action: o.getString("action"),
        word: o.getString("word"),
        domain: o.getString("domain"),
        code: o.getString("code"),
        count: o.getInteger("count"),
        max: o.getInteger("max"),
        window: o.getInteger("window"),
        repeats: o.getInteger("repeats"),
        percent: o.getInteger("percent"),
        zalgo: o.getBoolean("zalgo"),
        minutes: o.getInteger("minutes"),
      });
      if (!edit.ok) {
        await interaction.editReply({ content: edit.message, allowedMentions: { parse: [] } });
        return;
      }
      const saved = await updateAutomodConfig(guildId, edit.patch);
      const rule = group !== null && group in RULE_LABELS ? saved[group as keyof typeof RULE_LABELS] : null;
      const warning = rule && (sub === "toggle" || sub === "action")
        ? actionPermissionWarning(interaction.guild?.members.me?.permissions, rule.enabled, rule.action, RULE_LABELS[group as keyof typeof RULE_LABELS])
        : "";
      await interaction.editReply({
        content: `${edit.message}${afterChangeLine(saved, group)}${warning}`,
        allowedMentions: { parse: [] },
        components: [dashboardRow(guildId, PAGE)],
      });
    } catch (err) {
      logger.error(`Failed to handle /automod ${group ?? ""}/${sub} for guild ${guildId}`, err);
      await interaction.editReply({ content: "❌ Couldn't save the automod settings. Nothing was changed; try again in a moment.", components: [] }).catch(() => null);
    }
  },
};
