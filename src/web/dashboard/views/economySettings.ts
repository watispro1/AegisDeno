/** The Economy page's settings form: same fields and bounds as /economy config and /economy risk. No inline styles or scripts. */
import { ECONOMY_LIMITS, ECONOMY_NUMBER_KEYS, type EconomyConfig, type EconomyNumberKey } from "../../../services/economyLogic";
import { csrfField, type GuildContext } from "./layout";
import { Form, type Values } from "./form";
import { errorSummary } from "./parts";
import { helpPanel } from "./moduleKit";

export function economyValues(c: EconomyConfig): Values {
  const v: Values = { enabled: c.enabled, crimeEnabled: c.crimeEnabled, gamblingEnabled: c.gamblingEnabled, robEnabled: c.robEnabled, currencyName: c.currencyName, currencyEmoji: c.currencyEmoji };
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
    ${helpPanel("How coins move", [
      ["Earning", "<code class=\"inline\">/daily</code>, <code class=\"inline\">/weekly</code>, <code class=\"inline\">/work</code> and a successful <code class=\"inline\">/crime</code> or <code class=\"inline\">/rob</code> add to the wallet. <code class=\"inline\">/interest</code> pays a share of the bank once a day."],
      ["Spending and losing", "The shop, <code class=\"inline\">/pay</code> tax, gambling, fines and being robbed take coins out of the wallet."],
      ["Safe", "Coins in the bank can't be fined or robbed. A bank limit stops one member hoarding."],
    ])}
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
      ${num(f, "workLevelBonusPercent", "Work level bonus (% per level)", "Each /work earns 1 XP; every level above 1 adds this much pay, up to level 10. 0 turns it off.")}
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
      ${pair(
        num(f, "bankInterestBps", "Bank interest (basis points a day)", "100 = 1% of the bank, claimed with /interest once a day. Nothing builds up while unclaimed. 0 turns it off."),
        num(f, "bankInterestMaxDaily", "Most interest per claim", "0 = no cap besides the bank limit."),
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
      <h3>Rob</h3>
      ${f.checkbox("robEnabled", "Allow /rob", "Off by default. Members can try to take coins from another member's wallet (never the bank). A failed rob fines the robber; fines are removed from circulation.")}
      ${pair(num(f, "robSuccessPercent", "Success chance (%)"), num(f, "robCooldownMinutes", "Rob cooldown (minutes)"))}
      ${pair(
        num(f, "robMaxStealPercent", "Takes at most (% of target's wallet)", "A random 1% up to this."),
        num(f, "robMaxSteal", "Takes at most (coins)", "Hard cap on one rob, whatever the target holds."),
      )}
      ${pair(
        num(f, "robFinePercent", "Fine when caught (% of robber's wallet)"),
        num(f, "robMinWallet", "Robber must hold at least", "So a failed rob always costs something."),
      )}
      ${pair(
        num(f, "robMinTargetWallet", "Target must hold at least", "Members with less can't be robbed."),
        num(f, "robProtectMinutes", "Protection after being robbed (minutes)", "0 turns it off. Rob shields from the shop also protect."),
      )}
      <button class="btn" type="submit" data-save-button>Save economy settings</button>
    </form>
  </section>`;
}
