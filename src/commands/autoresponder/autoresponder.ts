import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import type { Command } from "../../types/discord";
import { addAutoResponder, removeAutoResponder, getAutoResponders, setAutoResponderEnabled, type AutoResponder } from "../../services/autoResponderService";
import { getGuildConfig } from "../../services/configuration";
import { rankChoices, type AutocompleteItem } from "../../utils/autocomplete";

export const MAX_TRIGGER_LENGTH = 100;
/** Discord's message limit; a longer response could never be sent. */
export const MAX_RESPONSE_LENGTH = 2000;
/** Lines shown by /autoresponder list before "and N more", to stay inside one embed. */
export const LIST_LIMIT = 20;
/** Most autoresponders one server keeps (the dashboard uses the same cap). */
export const MAX_AUTORESPONDERS = 50;

const MATCH_LABELS: Record<string, string> = { contains: "contains", exact: "exact", startsWith: "starts with" };

/** Why a new trigger is rejected, or null when it is fine. Matching is case-insensitive. */
export function validateTrigger(
  trigger: string,
  matchType: string,
  existing: Pick<AutoResponder, "trigger" | "matchType">[],
): string | null {
  const t = trigger.trim().toLowerCase();
  if (!t) return "❌ The trigger can't be empty.";
  if (existing.length >= MAX_AUTORESPONDERS) return `❌ This server already has ${MAX_AUTORESPONDERS} autoresponders, the most Aegis keeps. Remove one first.`;
  if (t.length > MAX_TRIGGER_LENGTH) return `❌ Keep the trigger under ${MAX_TRIGGER_LENGTH} characters.`;
  if (existing.some(ar => ar.trigger.toLowerCase() === t && ar.matchType === matchType)) {
    return `❌ There is already a \`${MATCH_LABELS[matchType] ?? matchType}\` autoresponder for \`${t}\`. Remove it first or pick another trigger.`;
  }
  return null;
}

/** Autocomplete entry: shows the trigger and match type, sends the ID. */
export function responderChoice(ar: Pick<AutoResponder, "id" | "trigger" | "matchType" | "response">): AutocompleteItem {
  return {
    name: `"${ar.trigger}" (${MATCH_LABELS[ar.matchType] ?? ar.matchType}) → ${ar.response}`,
    value: ar.id,
    keywords: ar.response,
  };
}

/** The list embed body, capped so it never exceeds Discord's 4096-character description. */
export function formatResponderList(list: Array<Pick<AutoResponder, "id" | "trigger" | "matchType" | "response"> & { enabled?: boolean }>): string {
  const lines = list.slice(0, LIST_LIMIT).map(
    ar => `• \`${ar.trigger.slice(0, 60)}\` (${MATCH_LABELS[ar.matchType] ?? ar.matchType})${ar.enabled === false ? " · **off**" : ""} · ID \`${ar.id}\`\n  ${ar.response.replace(/\s+/g, " ").slice(0, 80)}`,
  );
  if (list.length > LIST_LIMIT) lines.push(`…and ${list.length - LIST_LIMIT} more. Type in the \`id\` option of \`/autoresponder remove\` to search them all.`);
  return lines.join("\n\n").slice(0, 4000);
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("autoresponder")
    .setDescription("Configure custom automated triggers and bot responses.")
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("Add a new auto-reply trigger.")
        .addStringOption(opt => opt.setName("trigger").setDescription("Text or keyword to trigger on").setRequired(true).setMaxLength(MAX_TRIGGER_LENGTH))
        .addStringOption(opt => opt.setName("response").setDescription("Bot response message (supports {user}, {server}, {channel})").setRequired(true).setMaxLength(MAX_RESPONSE_LENGTH))
        .addStringOption(opt =>
          opt
            .setName("match_type")
            .setDescription("Matching strategy")
            .setRequired(false)
            .addChoices(
              { name: "Contains Keyword", value: "contains" },
              { name: "Exact Match", value: "exact" },
              { name: "Starts With", value: "startsWith" }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("create")
        .setDescription("Create a new auto-reply trigger.")
        .addStringOption(opt => opt.setName("trigger").setDescription("Text or keyword to trigger on").setRequired(true).setMaxLength(MAX_TRIGGER_LENGTH))
        .addStringOption(opt => opt.setName("response").setDescription("Bot response message (supports {user}, {server}, {channel})").setRequired(true).setMaxLength(MAX_RESPONSE_LENGTH))
        .addStringOption(opt =>
          opt
            .setName("match_type")
            .setDescription("Matching strategy")
            .setRequired(false)
            .addChoices(
              { name: "Contains Keyword", value: "contains" },
              { name: "Exact Match", value: "exact" },
              { name: "Starts With", value: "startsWith" }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription("Remove an auto-reply trigger.")
        .addStringOption(opt => opt.setName("id").setDescription("Autoresponder; start typing its trigger to pick it").setRequired(true).setAutocomplete(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("delete")
        .setDescription("Delete an auto-reply trigger.")
        .addStringOption(opt => opt.setName("id").setDescription("Autoresponder; start typing its trigger to pick it").setRequired(true).setAutocomplete(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("toggle")
        .setDescription("Turn one auto-responder on or off without deleting it.")
        .addStringOption(opt => opt.setName("id").setDescription("Autoresponder; start typing its trigger to pick it").setRequired(true).setAutocomplete(true))
        .addBooleanOption(opt => opt.setName("enabled").setDescription("On or off (default: flip the current state)").setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription("List all configured auto-responder triggers.")
    ),

  category: "autoresponder",
  guildOnly: true,

  async autocomplete(interaction) {
    // Autocomplete is not permission-checked by the executor; only managers may browse IDs.
    if (!interaction.guildId || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.respond([]);
      return;
    }
    const focused = interaction.options.getFocused(true);
    if (focused.name !== "id") {
      await interaction.respond([]);
      return;
    }
    const list = await getAutoResponders(interaction.guildId);
    await interaction.respond(rankChoices(list.map(responderChoice), String(focused.value)));
  },

  async execute(interaction) {
    if (!interaction.guild) return;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "add" || subcommand === "create") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "❌ You need `Manage Server` permission to add autoresponders.", flags: MessageFlags.Ephemeral });
        return;
      }

      const trigger = interaction.options.getString("trigger", true);
      const response = interaction.options.getString("response", true);
      const matchType = (interaction.options.getString("match_type") || "contains") as "exact" | "contains" | "startsWith";

      const problem = validateTrigger(trigger, matchType, await getAutoResponders(interaction.guild.id));
      if (problem) {
        await interaction.reply({ content: problem, flags: MessageFlags.Ephemeral });
        return;
      }

      const ar = await addAutoResponder({
        guildId: interaction.guild.id,
        trigger,
        response,
        matchType,
        createdBy: interaction.user.id,
      });

      if (ar) {
        await interaction.reply({
          content: `✅ Autoresponder created. Aegis now replies when a message ${matchType === "exact" ? "is exactly" : matchType === "startsWith" ? "starts with" : "contains"} \`${ar.trigger}\`.\n**ID:** \`${ar.id}\``,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({ content: "❌ Failed to create autoresponder.", flags: MessageFlags.Ephemeral });
      }
      return;
    }

    if (subcommand === "remove" || subcommand === "delete") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "❌ You need `Manage Server` permission to remove autoresponders.", flags: MessageFlags.Ephemeral });
        return;
      }

      const id = interaction.options.getString("id", true);
      const deleted = await removeAutoResponder(interaction.guild.id, id);

      if (deleted) {
        await interaction.reply({ content: `✅ Removed autoresponder \`${id}\`.`, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: `❌ No autoresponder \`${id.slice(0, 60)}\` in this server. Start typing in the \`id\` option to pick one, or run \`/autoresponder list\`.`, flags: MessageFlags.Ephemeral });
      }
      return;
    }

    if (subcommand === "toggle") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "❌ You need `Manage Server` permission to change autoresponders.", flags: MessageFlags.Ephemeral });
        return;
      }
      const id = interaction.options.getString("id", true);
      const current = (await getAutoResponders(interaction.guild.id)).find(ar => ar.id === id);
      if (!current) {
        await interaction.reply({ content: `❌ No autoresponder \`${id.slice(0, 60)}\` in this server. Start typing in the \`id\` option to pick one.`, flags: MessageFlags.Ephemeral });
        return;
      }
      const enabled = interaction.options.getBoolean("enabled") ?? current.enabled === false;
      const saved = await setAutoResponderEnabled(interaction.guild.id, id, enabled).catch(() => false);
      if (!saved) {
        // The update failed or the responder was removed after the read above: say so instead of claiming success.
        await interaction.reply({ content: `❌ Couldn't change autoresponder \`${current.trigger.slice(0, 60)}\`. It may have just been removed; run \`/autoresponder list\` and try again.`, flags: MessageFlags.Ephemeral });
        return;
      }
      const serverOff = (await getGuildConfig(interaction.guild.id)).autorespondersEnabled === false;
      await interaction.reply({
        content: `✅ Autoresponder for \`${current.trigger.slice(0, 60)}\` is now **${enabled ? "on" : "off"}**.` +
          (enabled && serverOff ? "\n⚠️ Autoresponders are switched off for the whole server; turn them back on from the dashboard's Autoresponders page." : ""),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === "list") {
      const list = await getAutoResponders(interaction.guild.id);
      if (list.length === 0) {
        await interaction.reply({ content: "ℹ️ No custom autoresponders configured for this server.", flags: MessageFlags.Ephemeral });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("🤖 Server Autoresponders")
        .setColor(0x34495E)
        .setDescription(formatResponderList(list))
        .setFooter({ text: `Total: ${list.length} of ${MAX_AUTORESPONDERS} autoresponder(s)${(await getGuildConfig(interaction.guild.id)).autorespondersEnabled === false ? " · switched off server-wide" : ""}` });

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }
  },
};

export default command;
