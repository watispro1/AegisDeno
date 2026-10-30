import { escapeHtml as esc } from "../../pages";
import type { ChannelOption, RoleOption } from "../botView";
import type { SettingsSnapshot } from "../data";
import { AUTOMOD_ACTIONS, ESCALATION_ROWS, LOG_CATEGORY_LABELS, type FormBody, type SettingsSection } from "../validation";

/* ── Settings ──────────────────────────────────────────────────────── */

export type Values = Record<string, string | boolean>;

export interface FormState {
  values: Values;
  errors: Record<string, string>;
}

/** Flatten the stored settings into form field values. */
export function settingsValues(section: SettingsSection, s: SettingsSnapshot): Values {
  switch (section) {
    case "logging": {
      const v: Values = { loggingEnabled: s.guild.loggingEnabled, loggingChannelId: s.guild.loggingChannelId ?? "" };
      for (const [key] of LOG_CATEGORY_LABELS) v[`cat_${key}`] = s.guild.logCategories?.[key] !== false;
      return v;
    }
    case "escalation": {
      const v: Values = { enabled: s.guild.escalation.enabled, warnExpiryDays: String(s.guild.escalation.warnExpiryDays ?? 0) };
      s.guild.escalation.thresholds.slice(0, ESCALATION_ROWS).forEach((t, i) => {
        v[`t_at_${i}`] = String(t.atWarnings);
        v[`t_action_${i}`] = t.action;
        v[`t_duration_${i}`] = t.durationMinutes ? String(t.durationMinutes) : "";
      });
      return v;
    }
    case "automod": {
      const a = s.automod;
      return {
        words_enabled: a.words.enabled, words_action: a.words.action,
        links_enabled: a.links.enabled, links_action: a.links.action,
        mentions_enabled: a.mentions.enabled, mentions_action: a.mentions.action, mentions_threshold: String(a.mentions.threshold),
        spam_enabled: a.spam.enabled, spam_action: a.spam.action, spam_maxMessages: String(a.spam.maxMessages), spam_windowSeconds: String(a.spam.windowSeconds),
        caps_enabled: a.caps.enabled, caps_action: a.caps.action, caps_threshold: String(a.caps.threshold),
        words_list: a.words.list.join("\n"),
        exempt_roles: a.exemptRoleIds.join(","),
        exempt_channels: a.exemptChannelIds.join(","),
      };
    }
    case "welcome":
      return {
        welcomeEnabled: s.guild.welcomeEnabled,
        welcomeChannelId: s.guild.welcomeChannelId ?? "",
        welcomeMessage: s.guild.welcomeMessage,
        welcomeRoleId: s.guild.welcomeRoleId ?? "",
      };
    case "tickets":
      return {
        logChannelId: s.tickets.logChannelId ?? "",
        autoCloseHours: String(s.tickets.autoCloseHours),
        transcriptLogging: s.tickets.transcriptLogging,
      };
    case "verification":
      return s.verification
        ? {
            enabled: s.verification.enabled,
            verifiedRoleId: s.verification.verifiedRoleId,
            type: s.verification.type,
            kickUnverifiedMinutes: String(s.verification.kickUnverifiedMinutes),
            channelId: s.verification.channelId ?? "",
          }
        : {};
    case "starboard":
      return {
        enabled: s.starboard.enabled,
        channelId: s.starboard.channelId ?? "",
        threshold: String(s.starboard.threshold),
        selfStar: s.starboard.selfStar,
        emoji: s.starboard.emoji,
        ignoredChannels: (s.starboard.ignoredChannels ?? []).join(","),
        ignoredRoles: (s.starboard.ignoredRoles ?? []).join(","),
      };
  }
}

/** Checkbox groups: posted once per ticked item, kept as comma-joined IDs in form values. */
export const MULTI_FIELDS: Partial<Record<SettingsSection, string[]>> = {
  automod: ["exempt_roles", "exempt_channels"],
  starboard: ["ignoredChannels", "ignoredRoles"],
};
const MULTI_KEYS = new Set(Object.values(MULTI_FIELDS).flat());

/** Turn a submitted body back into form values, so a rejected form keeps what was typed. */
export function submittedValues(body: FormBody): Values {
  const v: Values = {};
  for (const [key, raw] of Object.entries(body ?? {})) {
    if (key === "_csrf") continue;
    if (MULTI_KEYS.has(key)) {
      v[key] = (Array.isArray(raw) ? raw : [raw]).filter((x): x is string => typeof x === "string").join(",");
      continue;
    }
    const value = Array.isArray(raw) ? raw[raw.length - 1] : raw;
    if (typeof value !== "string") continue;
    v[key] = value === "on" ? true : value;
  }
  return v;
}

export class Form {
  constructor(private readonly state: FormState, private readonly px = "") {}

  str(key: string): string {
    const v = this.state.values[key];
    return typeof v === "string" ? v : "";
  }

  on(key: string): boolean {
    return this.state.values[key] === true;
  }

  private errAttrs(key: string, helpId?: string): string {
    const err = this.state.errors[key];
    const ids = [err ? `${this.px}${key}-error` : "", helpId ?? ""].filter(Boolean).join(" ");
    return `${err ? ' aria-invalid="true"' : ""}${ids ? ` aria-describedby="${ids}"` : ""}`;
  }

  private errText(key: string): string {
    const err = this.state.errors[key];
    return err ? `<span class="field-error" id="${this.px}${key}-error">${esc(err)}</span>` : "";
  }

  private help(key: string, text?: string): string {
    return text ? `<span class="field-help" id="${this.px}${key}-help">${text}</span>` : "";
  }

  checkbox(key: string, label: string, help?: string): string {
    return `<div class="field"><label class="check" for="f-${this.px}${key}">
      <input type="checkbox" id="f-${this.px}${key}" name="${key}"${this.on(key) ? " checked" : ""}${this.errAttrs(key)}>
      <span>${esc(label)}${help ? `<small>${help}</small>` : ""}</span>
    </label>${this.errText(key)}</div>`;
  }

  number(key: string, label: string, min: number, max: number, help?: string, extra = ""): string {
    return `<div class="field">
      <label for="f-${this.px}${key}">${esc(label)}</label>
      <input type="number" id="f-${this.px}${key}" name="${key}" min="${min}" max="${max}" step="1" inputmode="numeric" value="${esc(this.str(key))}"${this.errAttrs(key, help ? `${this.px}${key}-help` : undefined)}${extra}>
      ${this.errText(key)}${this.help(key, help)}
    </div>`;
  }

  select(key: string, label: string, options: Array<{ value: string; label: string; disabled?: boolean; group?: string | null }>, help?: string, extra = ""): string {
    const current = this.str(key);
    let html = "";
    let openGroup: string | null | undefined;
    for (const o of options) {
      if (o.group !== undefined && o.group !== openGroup) {
        if (openGroup) html += "</optgroup>";
        if (o.group) html += `<optgroup label="${esc(o.group)}">`;
        openGroup = o.group;
      }
      html += `<option value="${esc(o.value)}"${o.value === current ? " selected" : ""}${o.disabled ? " disabled" : ""}>${esc(o.label)}</option>`;
    }
    if (openGroup) html += "</optgroup>";
    return `<div class="field">
      <label for="f-${this.px}${key}">${esc(label)}</label>
      <select id="f-${this.px}${key}" name="${key}"${this.errAttrs(key, help ? `${this.px}${key}-help` : undefined)}${extra}>${html}</select>
      ${this.errText(key)}${this.help(key, help)}
    </div>`;
  }

  text(key: string, label: string, max: number, help?: string, extra = ""): string {
    return `<div class="field">
      <label for="f-${this.px}${key}">${esc(label)}</label>
      <input type="text" id="f-${this.px}${key}" name="${key}" maxlength="${max}" autocomplete="off" value="${esc(this.str(key))}"${this.errAttrs(key, help ? `${this.px}${key}-help` : undefined)}${extra}>
      ${this.errText(key)}${this.help(key, help)}
    </div>`;
  }

  /**
   * A group of checkboxes posting `key` once per ticked item. Saved IDs that
   * are not among the options are listed too (still ticked), so saving the
   * form never drops them silently.
   */
  multi(key: string, legend: string, options: Array<{ value: string; label: string; group?: string | null }>, help?: string): string {
    const picked = new Set(this.str(key).split(",").filter(Boolean));
    const all = options.slice();
    for (const id of picked) if (!all.some(o => o.value === id)) all.push({ value: id, label: `Unknown (${id})`, group: "Not visible to Aegis" });
    let html = "";
    let openGroup: string | null | undefined;
    all.forEach((o, i) => {
      const group = o.group ?? null;
      if (group !== openGroup) {
        if (openGroup) html += "</div>";
        if (group) html += `<div class="pick-group"><p class="pick-group-title">${esc(group)}</p>`;
        openGroup = group;
      }
      html += `<label class="check pick" for="f-${this.px}${key}-${i}"><input type="checkbox" id="f-${this.px}${key}-${i}" name="${key}" value="${esc(o.value)}"${picked.has(o.value) ? " checked" : ""}><span>${esc(o.label)}</span></label>`;
    });
    if (openGroup) html += "</div>";
    const err = this.state.errors[key];
    return `<fieldset class="pick-list" id="f-${this.px}${key}"${err ? ' aria-invalid="true"' : ""}${err || help ? ` aria-describedby="${[err ? `${this.px}${key}-error` : "", help ? `${this.px}${key}-help` : ""].filter(Boolean).join(" ")}"` : ""}>
      <legend>${esc(legend)} <span class="faint">(${picked.size} picked)</span></legend>
      ${all.length ? `<div class="pick-scroll">${html}</div>` : `<p class="muted">Nothing to pick from.</p>`}
      ${this.errText(key)}${this.help(key, help)}
    </fieldset>`;
  }

  textarea(key: string, label: string, max: number, help?: string, extra = ""): string {
    return `<div class="field">
      <label for="f-${this.px}${key}">${esc(label)}</label>
      <textarea id="f-${this.px}${key}" name="${key}" maxlength="${max}"${this.errAttrs(key, help ? `${this.px}${key}-help` : undefined)}${extra}>${esc(this.str(key))}</textarea>
      ${this.errText(key)}${this.help(key, help)}
    </div>`;
  }
}

export function channelOptions(channels: ChannelOption[], noneLabel: string) {
  return [{ value: "", label: noneLabel, group: null as string | null }].concat(
    channels.map(c => ({ value: c.id, label: `#${c.name}`, group: c.parent ?? "No category" })),
  );
}

export function roleOptions(roles: RoleOption[], noneLabel: string | null) {
  const opts: Array<{ value: string; label: string; disabled?: boolean }> = noneLabel ? [{ value: "", label: noneLabel }] : [{ value: "", label: "Pick a role" }];
  for (const r of roles) opts.push({ value: r.id, label: r.assignable ? `@${r.name}` : `@${r.name} (Aegis cannot assign)`, disabled: !r.assignable });
  return opts;
}

export function channelPicks(channels: ChannelOption[], hidden: ReadonlySet<string> = new Set(), saved = "") {
  const opts: Array<{ value: string; label: string; group: string | null }> =
    channels.map(c => ({ value: c.id, label: `#${c.name}`, group: c.parent ?? "No category" }));
  // Saved channels Discord now hides from Aegis stay ticked, with the fix spelled out.
  for (const id of saved.split(",").filter(Boolean)) {
    if (hidden.has(id) && !opts.some(o => o.value === id)) {
      opts.push({ value: id, label: `Hidden channel (${id}): give Aegis View Channel`, group: "Aegis can't see these channels" });
    }
  }
  return opts;
}

export function rolePicks(roles: RoleOption[]) {
  return roles.map(r => ({ value: r.id, label: `@${r.name}`, group: null }));
}

/** Shown where a saved channel is one Discord now hides from Aegis (obfuscated). */
export function hiddenChannelNote(id: string, what: string): string {
  return `<p class="callout warn" data-hidden-channel>Aegis can't see the saved ${what} (<code class="inline">${esc(id)}</code>). Give Aegis the <strong>View Channel</strong> permission there, or pick a new one.</p>`;
}

export function missingNote(id: string, list: Array<{ id: string }>, what: string, hidden: ReadonlySet<string> = new Set()): string {
  if (!id || list.some(x => x.id === id)) return "";
  if (hidden.has(id)) return hiddenChannelNote(id, what);
  return `<p class="callout warn">The saved ${what} (<code class="inline">${esc(id)}</code>) no longer exists or Aegis cannot see it. Pick a new one.</p>`;
}

export const ACTION_OPTIONS = AUTOMOD_ACTIONS.map(a => ({ value: a, label: a === "delete" ? "Delete the message" : a === "warn" ? "Delete and warn" : "Delete and time out" }));
