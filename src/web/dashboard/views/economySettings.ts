/** The Economy page's settings form: same fields and bounds as /economy config and /economy risk. No inline styles or scripts. */
import { ECONOMY_LIMITS, ECONOMY_NUMBER_KEYS, type EconomyConfig, type EconomyNumberKey } from "../../../services/economyLogic";
import { csrfField, type GuildContext } from "./layout";
import { Form, type Values } from "./form";
import { errorSummary } from "./parts";

export function economyValues(c: EconomyConfig): Values {
  const v: Values = { enabled: c.enabled, crimeEnabled: c.crimeEnabled, gamblingEnabled: c.gamblingEnabled, currencyName: c.currencyName, currencyEmoji: c.currencyEmoji };
  for (const key of ECONOMY_NUMBER_KEYS) v[key] = String(c[key]);
  return v;
}

function num(f: Form, key: EconomyNumberKey, label: string, help?: string): string {
  return f.number(key, label, ECONOMY_LIMITS[key][0], ECONOMY_LIMITS[key][1], help);
}

const pair = (a: string, b: string) => `<div class="field-row two">${a}${b}</div>`;

export function settingsSection(ctx: GuildContext, base: string, settings: Form, errors: Record<string, string>): string {
  const f = settings;
  return `<section class="panel-card" aria-labelledby="eco-cfg-h"><h2 id="eco-cfg-h">Settings</h2>
    ${errorSummary(errors, "f-eco-")}
    <form class="dash-form" method="post" action="${base}/settings" novalidate data-track-changes>
      ${csrfField(ctx.viewer)}
      ${f.checkbox("enabled", "Economy on", "Off by default. Same as /economy toggle.")}
      ${pair(
        f.text("currencyName", "Currency name", 24, "e.g. coins, gems, credits"),
        f.text("currencyEmoji", "Currency emoji", 64, "One emoji, or a custom one like &lt;:coin:123…&gt;", ' spellcheck="false" autocapitalize="off"'),
      )}
      <h3>Daily, weekly and work</h3>
      ${pair(num(f, "dailyAmount", "Daily amount"), num(f, "dailyCooldownHours", "Daily cooldown (hours)"))}
      ${pair(
        num(f, "dailyStreakBonus", "Streak bonus per day", "Added for each day in a row. Claiming within two cooldowns keeps the streak."),
        num(f, "dailyStreakCapDays", "Streak bonus days", "The bonus stops growing after this many days. 0 turns it off."),
      )}
      ${pair(num(f, "weeklyAmount", "Weekly amount", "Once every 7 days. 0 turns /weekly off."), num(f, "workCooldownMinutes", "Work cooldown (minutes)"))}
      ${pair(num(f, "workMin", "Work pays at least"), num(f, "workMax", "Work pays at most"))}
      <h3>Bank and payments</h3>
      ${pair(
        num(f, "bankCap", "Bank limit per member", "0 = no limit. Bank coins are safe from /crime fines."),
        num(f, "payConfirmThreshold", "Ask to confirm /pay at or above", "0 turns the confirmation off."),
      )}
      ${pair(
        num(f, "payMinMemberHours", "Hours in the server before paying", "Stops new or throwaway accounts sending coins straight away."),
        num(f, "payDailyLimit", "Daily sending limit per member", "Resets at 00:00 UTC. 0 = no limit."),
      )}
      ${pair(
        num(f, "payTaxPercent", "Pay tax (%)", "Removed from each payment; the recipient gets the rest."),
        num(f, "shopSellPercent", "Sell-back rate (%)", "What /shop sell pays, as a share of the current price. 0 turns selling off."),
      )}
      <h3>Crime</h3>
      ${f.checkbox("crimeEnabled", "Allow /crime", "A risky alternative to /work with a fine when caught.")}
      ${pair(num(f, "crimeSuccessPercent", "Success chance (%)"), num(f, "crimeCooldownMinutes", "Crime cooldown (minutes)"))}
      ${pair(num(f, "crimeMin", "Crime pays at least"), num(f, "crimeMax", "Crime pays at most"))}
      ${num(f, "crimeFine", "Fine when caught", "Never more than the member's wallet, so nobody goes below zero.")}
      <h3>Gambling</h3>
      ${f.checkbox("gamblingEnabled", "Allow /gamble", "Off by default. Coinflip has a 2% house edge, slots about 3.6%.")}
      ${pair(num(f, "gambleMinBet", "Minimum bet"), num(f, "gambleMaxBet", "Maximum bet"))}
      ${pair(
        num(f, "gambleDailyLossCap", "Daily loss limit per member", "Net losses per UTC day. 0 = no limit."),
        num(f, "gambleCooldownSeconds", "Seconds between bets"),
      )}
      <button class="btn" type="submit" data-save-button>Save economy settings</button>
    </form>
  </section>`;
}
