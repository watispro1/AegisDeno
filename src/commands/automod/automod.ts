import { guardCollect } from "../../utils/collectorGuard";
import { logger } from "../../utils/logger";
import { ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { Command } from "../../types/discord";
import { getAutomodConfig, updateAutomodConfig } from "../../services/automod";
import { editExemption, parseScope } from "../../services/automodExempt";
import { automodEdit } from "../../services/automodSettings";
import { automodData } from "./automod/builder";
import { buildStatusPayload, toggleKeyFromId } from "./automod/status";

export const command: Command = {
  data: automodData,

  guildOnly: true,

  // Used by subcommands, buttons or background work; requested on the invite, checked where used.
  featurePermissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers],
  userPermissions: [PermissionFlagsBits.ManageGuild],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const group   = interaction.options.getSubcommandGroup(false);
    const sub     = interaction.options.getSubcommand(true);
    const guildId = interaction.guildId!;

    await interaction.deferReply();
    try {
      const config = await getAutomodConfig(guildId);

      if (sub === "status") {
        const initial = buildStatusPayload(config);
        const sent = await interaction.editReply({ embeds: [initial.embed], components: initial.rows });

        const collector = sent.createMessageComponentCollector({
          time: 180_000,
          filter: (i) => i.user.id === interaction.user.id,
        });

        collector.on("collect", (i) => guardCollect("automod", i, async () => {
          const key = toggleKeyFromId(i.customId);
          if (!key) return;
          // Re-read so a change made elsewhere since /automod status opened is not overwritten.
          const fresh = await getAutomodConfig(guildId);
          const saved = await updateAutomodConfig(guildId, { [key]: { enabled: !fresh[key].enabled } });
          await i.deferUpdate();
          const updated = buildStatusPayload(saved);
          await interaction.editReply({ embeds: [updated.embed], components: updated.rows });
        }));

        collector.on("end", async () => {
          await interaction.editReply({ components: [] }).catch(() => null);
        });
        return;
      }

      if (group === "exempt") {
        const kind = sub.endsWith("role") ? "role" : "channel";
        const id = kind === "role" ? interaction.options.getRole("role", true).id : interaction.options.getChannel("channel", true).id;
        const edit = editExemption(config, parseScope(interaction.options.getString("rule")), kind, id, sub.startsWith("add"));
        if (edit.ok) await updateAutomodConfig(guildId, edit.patch);
        await interaction.editReply({ content: edit.message, allowedMentions: { parse: [] } });
        return;
      }

      const o = interaction.options;
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
      if (edit.ok) await updateAutomodConfig(guildId, edit.patch);
      await interaction.editReply({ content: edit.message, allowedMentions: { parse: [] } });
    } catch (err) {
      logger.error(`Failed to handle /automod ${group ?? ""}/${sub} for guild ${guildId}`, err);
      await interaction.editReply("❌ Couldn't save the automod settings. Nothing was changed; try again in a moment.");
    }
  },
};
