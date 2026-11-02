import {
  SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../../types/discord";
import { economy, type AdjustAction } from "../../services/economyService";
import { postAdjustLog, NO_PINGS } from "../../services/economyDiscord";
import { ECONOMY_LIMITS, MAX_BALANCE, formatCoins, type EconomyConfig, type EconomySettingsInput } from "../../services/economyLogic";
import { requestConfirmation } from "../../utils/confirmation";
import { COLORS, footer } from "../../utils/embedStyle";

const CONFIG_OPTIONS: Array<[option: string, key: keyof typeof ECONOMY_LIMITS, description: string]> = [
  ["daily_amount", "dailyAmount", "Coins from /daily"],
  ["streak_bonus", "dailyStreakBonus", "Extra coins per streak day (up to 7 days)"],
  ["daily_cooldown_hours", "dailyCooldownHours", "Hours between /daily claims"],
  ["work_min", "workMin", "Least coins from /work"],
  ["work_max", "workMax", "Most coins from /work"],
  ["work_cooldown_minutes", "workCooldownMinutes", "Minutes between /work uses"],
  ["pay_confirm_threshold", "payConfirmThreshold", "/pay asks to confirm at or above this (0 = never)"],
];

export function configEmbed(cfg: EconomyConfig): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(cfg.enabled ? COLORS.ok : COLORS.muted)
    .setTitle(`💰 Economy: ${cfg.enabled ? "on" : "off"}`)
    .addFields(
      { name: "Currency", value: `${cfg.currencyEmoji} ${cfg.currencyName}`, inline: true },
      { name: "Daily", value: `${formatCoins(cfg, cfg.dailyAmount)} every ${cfg.dailyCooldownHours}h, +${cfg.dailyStreakBonus}/streak day`, inline: true },
      { name: "Work", value: `${cfg.workMin.toLocaleString("en-US")}–${cfg.workMax.toLocaleString("en-US")} every ${cfg.workCooldownMinutes} min`, inline: true },
      { name: "Pay confirmation", value: cfg.payConfirmThreshold > 0 ? `at ${formatCoins(cfg, cfg.payConfirmThreshold)} or more` : "off", inline: true },
    )
    .setFooter(footer("Change with /economy config or on the dashboard's Economy page"));
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("economy")
    .setDescription("Set up this server's economy (Manage Server).")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName("toggle").setDescription("Turn the economy on or off (off by default).")
      .addBooleanOption(o => o.setName("enabled").setDescription("On or off (default: flip)")))
    .addSubcommand(s => {
      s.setName("config").setDescription("Show or change economy settings. Run with no options to see them.")
        .addStringOption(o => o.setName("currency_name").setDescription("e.g. coins, gems").setMaxLength(24))
        .addStringOption(o => o.setName("currency_emoji").setDescription("One emoji, or a custom emoji").setMaxLength(64));
      for (const [name, key, description] of CONFIG_OPTIONS) {
        s.addIntegerOption(o => o.setName(name).setDescription(description).setMinValue(ECONOMY_LIMITS[key][0]).setMaxValue(ECONOMY_LIMITS[key][1]));
      }
      return s;
    })
    .addSubcommand(s => s.setName("give").setDescription("Give coins to a member (logged to the mod log).")
      .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true))
      .addIntegerOption(o => o.setName("amount").setDescription("Coins").setRequired(true).setMinValue(1).setMaxValue(MAX_BALANCE))
      .addStringOption(o => o.setName("reason").setDescription("Why (shown in the mod log)").setMaxLength(200)))
    .addSubcommand(s => s.setName("take").setDescription("Take coins from a member (logged to the mod log).")
      .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true))
      .addIntegerOption(o => o.setName("amount").setDescription("Coins").setRequired(true).setMinValue(1).setMaxValue(MAX_BALANCE))
      .addStringOption(o => o.setName("reason").setDescription("Why (shown in the mod log)").setMaxLength(200)))
    .addSubcommand(s => s.setName("reset").setDescription("Set a member's balance to 0 (logged to the mod log).")
      .addUserOption(o => o.setName("user").setDescription("Member").setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Why (shown in the mod log)").setMaxLength(200))),
  category: "economy",
  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageGuild],
  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const svc = economy();
    const sub = interaction.options.getSubcommand();

    if (sub === "toggle") {
      const current = await svc.config(guildId);
      const enabled = interaction.options.getBoolean("enabled") ?? !current.enabled;
      const r = await svc.updateConfig(guildId, { enabled });
      if (!r.ok) return interaction.reply({ content: "❌ Couldn't save that.", flags: MessageFlags.Ephemeral });
      return interaction.reply({
        content: enabled
          ? "✅ The economy is **on**. Members can use `/daily`, `/work`, `/pay`, `/shop` and `/leaderboard`. Tune it with `/economy config`."
          : "💤 The economy is **off**. Balances and the shop are kept; members just can't use the commands until you turn it back on.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "config") {
      const input: EconomySettingsInput = {
        currencyName: interaction.options.getString("currency_name") ?? undefined,
        currencyEmoji: interaction.options.getString("currency_emoji") ?? undefined,
      };
      for (const [name, key] of CONFIG_OPTIONS) {
        const v = interaction.options.getInteger(name);
        if (v !== null) input[key] = v;
      }
      const changed = Object.values(input).some(v => v !== undefined);
      if (!changed) return interaction.reply({ embeds: [configEmbed(await svc.config(guildId))], flags: MessageFlags.Ephemeral });
      const r = await svc.updateConfig(guildId, input);
      if (!r.ok) return interaction.reply({ content: `❌ Nothing was changed. ${Object.values(r.errors).join(" ")}`, flags: MessageFlags.Ephemeral });
      return interaction.reply({ content: "✅ Saved.", embeds: [configEmbed(r.value)], flags: MessageFlags.Ephemeral });
    }

    // give / take / reset
    const user = interaction.options.getUser("user", true);
    if (user.bot) return interaction.reply({ content: "❌ Bots don't have balances.", flags: MessageFlags.Ephemeral });
    const action = sub as AdjustAction;
    const amount = action === "reset" ? 0 : interaction.options.getInteger("amount", true);
    const reason = interaction.options.getString("reason")?.trim() || null;
    const cfg = await svc.config(guildId);

    if (action === "reset") {
      const before = await svc.balance(guildId, user.id);
      const answer = await requestConfirmation(interaction, { content: `Reset ${user}'s balance (${formatCoins(cfg, before.balance)}) to 0?`, confirmLabel: "Reset balance" });
      if (answer !== "confirmed") return;
    }
    const r = await svc.adjust(guildId, user.id, action, amount, interaction.user.id, reason);
    const say = async (content: string) => { await (interaction.deferred || interaction.replied
      ? interaction.editReply({ content, components: [], allowedMentions: NO_PINGS })
      : interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS })); };
    if (!r.ok) {
      return say(r.reason === "insufficient"
        ? `❌ ${user} only has ${formatCoins(cfg, r.balance)}. Take less, or use \`/economy reset\`.`
        : `❌ That would put ${user} over the ${formatCoins(cfg, MAX_BALANCE)} limit.`);
    }
    await postAdjustLog(interaction.client, { guildId, userId: user.id, actorId: interaction.user.id, action, amount: action === "reset" ? r.previous : amount, balance: r.balance, reason }, interaction.user.tag, "command");
    const verb = action === "give" ? `Gave ${formatCoins(cfg, amount)} to` : action === "take" ? `Took ${formatCoins(cfg, amount)} from` : "Reset the balance of";
    return say(`✅ ${verb} ${user}. New balance: ${formatCoins(cfg, r.balance)}. Logged to the mod log.`);
  },
};

export default command;
