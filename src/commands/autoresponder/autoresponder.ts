import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import type { Command } from "../../types/discord";
import { addAutoResponder, removeAutoResponder, getAutoResponders, setAutoResponderEnabled, type AutoResponder } from "../../services/autoResponderService";
import { getGuildConfig } from "../../services/configuration";
import { rankChoices, type AutocompleteItem } from "../../utils/autocomplete";
import { requestConfirmation } from "../../utils/confirmation";
import { replyPagedList } from "../../utils/listPager";
import { dashboardRow } from "../config/kit/setupKit";
import { premiumLimit } from "../../services/premium";
import { PREMIUM_LIMITS } from "../../config/premium";
import { premiumOffered } from "../../config/stripe";

export const MAX_TRIGGER_LENGTH = 100;
/** Discord's message limit; a longer response could never be sent. */
export const MAX_RESPONSE_LENGTH = 2000;
/** Lines shown by /autoresponder list before "and N more", to stay inside one embed. */
export const LIST_LIMIT = 20;
/** Most autoresponders one server keeps (the dashboard uses the same cap). */
export const MAX_AUTORESPONDERS: number = PREMIUM_LIMITS.autoresponders.free;

const MATCH_LABELS: Record<string, string> = { contains: "contains", exact: "exact", startsWith: "starts with" };

/** Why a new trigger is rejected, or null when it is fine. Matching is case-insensitive. */
export function validateTrigger(
  trigger: string,
  matchType: string,
  existing: Pick<AutoResponder, "trigger" | "matchType">[],
  max: number = MAX_AUTORESPONDERS,
): string | null {
  const t = trigger.trim().toLowerCase();
  if (!t) return "❌ The trigger can't be empty.";
  if (existing.length >= max) return `❌ This server already has ${max} autoresponders, the most Aegis keeps${max < PREMIUM_LIMITS.autoresponders.premium && premiumOffered() ? ` (Aegis Premium raises it to ${PREMIUM_LIMITS.autoresponders.premium}; see /premium)` : ""}. Remove one first.`;
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

/**
 * The responder an `id` option points at: its ID (what autocomplete sends),
 * or, when someone typed instead of picking, a trigger that matches exactly one
 * responder (case-insensitive). Pure.
 */
export function resolveResponder<T extends Pick<AutoResponder, "id" | "trigger">>(list: readonly T[], input: string): T | null {
  const raw = input.trim();
  const byId = list.find(ar => ar.id === raw);
  if (byId) return byId;
  const byTrigger = list.filter(ar => ar.trigger.toLowerCase() === raw.toLowerCase());
  return byTrigger.length === 1 ? byTrigger[0] : null;
}

/** Placeholders Aegis fills in a response; anything else in braces is sent as typed. */
export const RESPONSE_PLACEHOLDERS = ["{user}", "{username}", "{tag}", "{user_id}", "{server}", "{server_id}", "{channel}", "{channel_id}", "{member_count}"];

/** `{things}` in a response Aegis won't replace (typos like `{username}`). Pure. */
export function unknownPlaceholders(response: string): string[] {
  return [...new Set((response.match(/\{[A-Za-z_]+\}/g) ?? []).filter(p => !RESPONSE_PLACEHOLDERS.includes(p)))];
}

/** One paged-list entry per responder. Pure. */
export function responderLines(list: Array<Pick<AutoResponder, "id" | "trigger" | "matchType" | "response"> & { enabled?: boolean }>): string[] {
  return list.map(ar => `• \`${ar.trigger.slice(0, 60)}\` (${MATCH_LABELS[ar.matchType] ?? ar.matchType})${ar.enabled === false ? " · **off**" : ""} · ID \`${ar.id}\`\n  ${ar.response.replace(/\s+/g, " ").slice(0, 80)}`);
}

const NOT_FOUND = (id: string) => `❌ No autoresponder \`${id.slice(0, 60)}\` in this server. Start typing in the \`id\` option to pick one, or run \`/autoresponder list\`.`;

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("autoresponder")
    .setDescription("Automatic replies: Aegis answers messages that match a trigger.")
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("Add an automatic reply to a trigger word or phrase.")
        .addStringOption(opt => opt.setName("trigger").setDescription("Word or phrase that triggers the reply (not case-sensitive)").setRequired(true).setMaxLength(MAX_TRIGGER_LENGTH))
        .addStringOption(opt => opt.setName("response").setDescription("Reply text; can use {user} {username} {server} {channel} {member_count}").setRequired(true).setMaxLength(MAX_RESPONSE_LENGTH))
        .addStringOption(opt =>
          opt
            .setName("match_type")
            .setDescription("How the trigger must match (default: message contains it)")
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
        .setDescription("Add an automatic reply (same as /autoresponder add).")
        .addStringOption(opt => opt.setName("trigger").setDescription("Word or phrase that triggers the reply (not case-sensitive)").setRequired(true).setMaxLength(MAX_TRIGGER_LENGTH))
        .addStringOption(opt => opt.setName("response").setDescription("Reply text; can use {user} {username} {server} {channel} {member_count}").setRequired(true).setMaxLength(MAX_RESPONSE_LENGTH))
        .addStringOption(opt =>
          opt
            .setName("match_type")
            .setDescription("How the trigger must match (default: message contains it)")
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
        .setDescription("Delete an automatic reply (asks to confirm).")
        .addStringOption(opt => opt.setName("id").setDescription("Autoresponder; start typing its trigger to pick it").setRequired(true).setAutocomplete(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("delete")
        .setDescription("Delete an automatic reply (same as /autoresponder remove).")
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
        .setDescription("List every automatic reply, a page at a time (only you see it).")
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

      if (!response.trim()) {
        await interaction.reply({ content: "❌ The response can't be empty.", flags: MessageFlags.Ephemeral });
        return;
      }
      const existing = await getAutoResponders(interaction.guild.id);
      const max = await premiumLimit(interaction.guild.id, "autoresponders");
      const problem = validateTrigger(trigger, matchType, existing, max);
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
        const unknown = unknownPlaceholders(response);
        const serverOff = (await getGuildConfig(interaction.guild.id)).autorespondersEnabled === false;
        const notes = [
          unknown.length ? `⚠️ ${unknown.map(p => `\`${p}\``).join(", ")} isn't a placeholder Aegis fills in (see the \`response\` option for the list), so it will be sent as typed.` : "",
          serverOff ? "⚠️ Autoresponders are switched off for the whole server; turn them back on from the dashboard." : "",
        ].filter(Boolean);
        await interaction.reply({
          content: [`✅ Autoresponder created. Aegis now replies when a message ${matchType === "exact" ? "is exactly" : matchType === "startsWith" ? "starts with" : "contains"} \`${ar.trigger}\`.`,
            `**ID:** \`${ar.id}\` · ${existing.length + 1} of ${max} used`, ...notes].join("\n"),
          components: [dashboardRow(interaction.guild.id, "autoresponders")],
          flags: MessageFlags.Ephemeral,
          allowedMentions: { parse: [] },
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
      const target = resolveResponder(await getAutoResponders(interaction.guild.id), id);
      if (!target) {
        await interaction.reply({ content: NOT_FOUND(id), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const answer = await requestConfirmation(interaction, {
        content: `🗑️ Delete the autoresponder for \`${target.trigger.slice(0, 60)}\`?\n> ${target.response.replace(/\s+/g, " ").slice(0, 200)}`,
        confirmLabel: "Delete autoresponder",
      });
      if (answer !== "confirmed") return;
      const deleted = await removeAutoResponder(interaction.guild.id, target.id);
      await interaction.editReply({
        content: deleted ? `✅ Removed the autoresponder for \`${target.trigger.slice(0, 60)}\`.` : "❌ It was already removed.",
        components: deleted ? [dashboardRow(interaction.guild.id, "autoresponders")] : [],
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (subcommand === "toggle") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "❌ You need `Manage Server` permission to change autoresponders.", flags: MessageFlags.Ephemeral });
        return;
      }
      const current = resolveResponder(await getAutoResponders(interaction.guild.id), interaction.options.getString("id", true));
      if (!current) {
        await interaction.reply({ content: NOT_FOUND(interaction.options.getString("id", true)), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
        return;
      }
      const id = current.id;
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

      const serverOff = (await getGuildConfig(interaction.guild.id)).autorespondersEnabled === false;
      await replyPagedList(interaction, {
        title: "🤖 Server Autoresponders",
        lines: responderLines(list),
        perPage: 10,
        color: 0x34495E,
        ephemeral: true,
        note: `${list.length} of ${await premiumLimit(interaction.guild.id, "autoresponders")} autoresponder(s)${serverOff ? " · switched off server-wide" : ""}`,
      });
      return;
    }
  },
};

export default command;
