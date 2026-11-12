/**
 * Per-rule automod exemptions on the Automod settings page: one small form per
 * rule, each saving only that rule's role and channel lists. The same lists as
 * /automod exempt addrole|addchannel with rule:.
 */
import { escapeHtml as esc } from "../../pages";
import type { ChannelOption, RoleOption } from "../botView";
import type { AutomodConfig } from "../../../services/automod";
import { EXEMPTION_RULES, EXEMPTION_RULE_LABELS, RULE_EXEMPTIONS_MAX, type ExemptionRule } from "../validation";
import { type GuildContext, csrfField } from "./layout";
import { Form, channelPicks, type Values } from "./form";
import { errorSummary } from "./parts";
import { pill } from "./moduleKit";

/** A rejected per-rule form: which rule, what was ticked, and why it was refused. */
export interface RuleExemptionState {
  rule: ExemptionRule;
  values: Values;
  errors: Record<string, string>;
}

export function ruleExemptionValues(config: AutomodConfig, rule: ExemptionRule): Values {
  return {
    roles: (config[rule].exemptRoleIds ?? []).join(","),
    channels: (config[rule].exemptChannelIds ?? []).join(","),
  };
}

/** Role picks for exemptions; roles the viewer can't change are labelled so the refusal is no surprise. */
function exemptRolePicks(roles: RoleOption[]) {
  return roles.map(r => ({ value: r.id, label: r.aboveViewer ? `@${r.name} (at or above your highest role)` : `@${r.name}`, group: null }));
}

function countLabel(config: AutomodConfig, rule: ExemptionRule): string {
  const roles = config[rule].exemptRoleIds?.length ?? 0;
  const channels = config[rule].exemptChannelIds?.length ?? 0;
  if (!roles && !channels) return "none";
  const part = (n: number, noun: string) => (n ? `${n} ${noun}${n === 1 ? "" : "s"}` : "");
  return [part(roles, "role"), part(channels, "channel")].filter(Boolean).join(", ");
}

export function ruleExemptionsPanel(
  ctx: GuildContext,
  config: AutomodConfig,
  roles: RoleOption[],
  channels: ChannelOption[],
  hidden: ReadonlySet<string>,
  state: RuleExemptionState | null,
): string {
  const action = `/dashboard/${esc(ctx.guild.id)}/settings/automod/exemptions`;
  const forms = EXEMPTION_RULES.map(rule => {
    const own = state?.rule === rule ? state : null;
    const f = new Form({ values: own?.values ?? ruleExemptionValues(config, rule), errors: own?.errors ?? {} }, `rx-${rule}-`);
    return `<details class="panel-card" id="rx-${rule}"${own ? " open" : ""}>
      <summary>${esc(EXEMPTION_RULE_LABELS[rule])} <span class="faint">(${esc(countLabel(config, rule))})</span> ${countLabel(config, rule) === "none" ? pill("No exemptions", "off") : pill("Has exemptions", "info")}</summary>
      ${errorSummary(own?.errors ?? {}, `f-rx-${rule}-`)}
      <form class="dash-form" method="post" action="${action}" novalidate data-track-changes>
        ${csrfField(ctx.viewer)}
        <input type="hidden" name="rule" value="${rule}">
        ${f.multi("roles", "Roles this rule skips", exemptRolePicks(roles), `Up to ${RULE_EXEMPTIONS_MAX}. You can only change roles below your highest role.`)}
        ${f.multi("channels", "Channels where this rule is off", channelPicks(channels, hidden, f.str("channels")), `Up to ${RULE_EXEMPTIONS_MAX}. Threads follow their parent channel.`)}
        <button class="btn" type="submit" data-save-button>Save ${esc(EXEMPTION_RULE_LABELS[rule].toLowerCase())} exemptions</button>
      </form>
    </details>`;
  }).join("");
  const withAny = EXEMPTION_RULES.filter(rule => countLabel(config, rule) !== "none").length;
  return `<section aria-labelledby="rx-h">
    <h2 class="section-title" id="rx-h">Per-rule exemptions <span class="faint">${withAny} of ${EXEMPTION_RULES.length} rules have some</span></h2>
    <p class="muted">Roles and channels one rule skips, on top of the exemptions above. Each rule saves on its own; the main form above keeps these lists. Open a rule to change it; untick everything and save to clear it.</p>
    ${forms}
  </section>`;
}
