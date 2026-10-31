import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { ChannelOption, RoleOption } from "../botView";
import type { SettingsSnapshot } from "../data";
import { ESCALATION_ROWS, LOG_CATEGORY_LABELS, MAX_TIMEOUT_MINUTES, SECTION_TITLES, WELCOME_MESSAGE_MAX, AUTOMOD_WORD_MAX, AUTOMOD_WORDS_MAX_COUNT, AUTOMOD_WORDS_TEXT_MAX, welcomePreview, type SettingsSection } from "../validation";
import { MAX_WARN_EXPIRY_DAYS } from "../../../services/configuration";
import { MAX_TICKET_AUTOCLOSE_HOURS } from "../../../services/ticketTranscript";
import { MAX_KICK_UNVERIFIED_MINUTES } from "../../../services/verificationLogic";
import { type GuildContext, type GuildSection, csrfField, head, moduleStatus, notice, shell } from "./layout";
import { embedBuilder } from "./embedBuilder";
import { GOODBYE_MESSAGE_MAX } from "../../../services/configuration";
import { ACTION_OPTIONS, Form, ROLE_PICKER_HELP, type FormState, channelOptions, channelPickerEmptyNote, channelPicks, hiddenChannelNote, missingNote, roleOptions, rolePickerEmptyNote, rolePicks } from "./form";

function sectionForm(
  section: SettingsSection,
  f: Form,
  ctx: GuildContext,
  channels: ChannelOption[],
  roles: RoleOption[],
  snapshot: SettingsSnapshot,
  hidden: ReadonlySet<string> = new Set(),
): string {
  switch (section) {
    case "logging":
      return `${missingNote(f.str("loggingChannelId"), channels, "log channel", hidden)}
      <fieldset><legend>Audit log</legend>
        ${f.checkbox("loggingEnabled", "Post moderation and server events to a log channel")}
        ${f.select("loggingChannelId", "Log channel", channelOptions(channels, "No channel"), "Aegis needs View Channel, Send Messages and Embed Links there.")}
      </fieldset>
      <fieldset><legend>What to log, and where</legend>
        <p class="field-help">Each event type can go to its own channel. Leave a channel on "Main log channel" to use the one above.</p>
        <div class="log-grid">
        ${LOG_CATEGORY_LABELS.map(([key, label]) => `<div class="log-row">${f.checkbox(`cat_${key}`, label)}${f.select(`chan_${key}`, `Channel for ${label.toLowerCase()}`, channelOptions(channels, "Main log channel"))}</div>`).join("")}
        </div>
      </fieldset>`;

    case "escalation": {
      const rows = Array.from({ length: ESCALATION_ROWS }, (_, i) => `
        <fieldset data-escalation-row><legend>Step ${i + 1}</legend>
          <div class="field-row">
            ${f.number(`t_at_${i}`, "At this many warnings", 1, 100)}
            ${f.select(`t_action_${i}`, "Do this", [
              { value: "none", label: "Nothing (unused step)" },
              { value: "timeout", label: "Time out" },
              { value: "kick", label: "Kick" },
              { value: "ban", label: "Ban" },
            ], undefined, " data-escalation-action")}
            ${f.number(`t_duration_${i}`, "Timeout length (minutes)", 1, MAX_TIMEOUT_MINUTES, "Only used for time outs.")}
          </div>
        </fieldset>`).join("");
      return `<fieldset><legend>Escalation</legend>
        ${f.checkbox("enabled", "Act automatically when a member reaches a warning count", "A step fires once, when the count is reached exactly. Revoked warnings never count.")}
        ${f.number("warnExpiryDays", "Warnings stop counting after (days)", 0, MAX_WARN_EXPIRY_DAYS, "0 means warnings never expire for escalation. They are still deleted after a year.")}
      </fieldset>
      ${rows}`;
    }

    case "automod":
      return `<fieldset><legend>Blocked words</legend>
        ${f.checkbox("words_enabled", "Filter blocked words")}
        ${f.select("words_action", "When it matches", ACTION_OPTIONS)}
        ${f.textarea("words_list", "Blocked words", AUTOMOD_WORDS_TEXT_MAX,
          `One word or phrase per line, 2 to ${AUTOMOD_WORD_MAX} characters, up to ${AUTOMOD_WORDS_MAX_COUNT}. Matching ignores case. Same list as <code class="inline">/automod words add</code>.`,
          ' spellcheck="false" autocapitalize="off"')}
      </fieldset>
      <fieldset><legend>Links</legend>
        ${f.checkbox("links_enabled", "Filter links")}
        ${f.select("links_action", "When it matches", ACTION_OPTIONS)}
      </fieldset>
      <fieldset><legend>Mention spam</legend>
        ${f.checkbox("mentions_enabled", "Limit mentions per message")}
        ${f.number("mentions_threshold", "Mentions allowed", 2, 50)}
        ${f.select("mentions_action", "When it matches", ACTION_OPTIONS)}
      </fieldset>
      <fieldset><legend>Message spam</legend>
        ${f.checkbox("spam_enabled", "Limit how fast one member can post")}
        <div class="field-row">
          ${f.number("spam_maxMessages", "Messages", 2, 30)}
          ${f.number("spam_windowSeconds", "Within (seconds)", 2, 60)}
        </div>
        ${f.select("spam_action", "When it matches", ACTION_OPTIONS)}
      </fieldset>
      <fieldset><legend>Capitals</legend>
        ${f.checkbox("caps_enabled", "Filter messages that are mostly capitals")}
        ${f.number("caps_threshold", "Percentage of capitals", 50, 100)}
        ${f.select("caps_action", "When it matches", ACTION_OPTIONS)}
      </fieldset>
      <h2 class="section-title">Exemptions</h2>
      <p class="muted">Members with an exempt role, and messages in an exempt channel, skip every automod rule.</p>
      ${f.multi("exempt_roles", "Exempt roles", rolePicks(roles))}
      ${f.multi("exempt_channels", "Exempt channels", channelPicks(channels, hidden, f.str("exempt_channels")), "Text and announcement channels are listed. Other channels exempted with /automod stay exempt and show as Unknown.")}`;

    case "welcome": {
      const sample = { username: ctx.viewer.username, serverName: ctx.guild.name, memberCount: ctx.guild.memberCount };
      return `${missingNote(f.str("welcomeChannelId"), channels, "welcome channel", hidden)}
      <fieldset><legend>Welcome message</legend>
        ${f.checkbox("welcomeEnabled", "Post a message when someone joins")}
        ${f.select("welcomeChannelId", "Channel", channelOptions(channels, "No channel"))}
        ${f.textarea("welcomeMessage", "Message", WELCOME_MESSAGE_MAX,
          `Placeholders: <code class="inline">{user}</code> mentions them, <code class="inline">{username}</code>, <code class="inline">{server}</code>, <code class="inline">{count}</code> is the member count.`,
          ` data-welcome-input data-sample-user="${esc(sample.username)}" data-sample-server="${esc(sample.serverName)}" data-sample-count="${sample.memberCount}"`)}
        <p class="field-help" id="welcome-preview-label">Preview, with you as the new member:</p>
        <div class="preview" data-welcome-preview aria-live="polite" aria-labelledby="welcome-preview-label">${esc(welcomePreview(f.str("welcomeMessage"), sample))}</div>
      </fieldset>
      <fieldset><legend>Embed</legend>
        ${f.checkbox("we_on", "Send an embed with the welcome message", "Build it below; the preview updates as you type.")}
      </fieldset>
      ${embedBuilder(f, "we_", { legend: "Welcome embed", sample: templateSample(ctx), contentKey: "welcomeMessage" })}
      <fieldset><legend>Join role</legend>
        ${rolePickerEmptyNote(roles)}
        ${f.select("welcomeRoleId", "Give new members this role", roleOptions(roles, "No role"), ROLE_PICKER_HELP)}
      </fieldset>`;
    }

    case "goodbye":
      return `${missingNote(f.str("goodbyeChannelId"), channels, "goodbye channel", hidden)}
      <fieldset><legend>Goodbye message</legend>
        ${f.checkbox("goodbyeEnabled", "Post a message when someone leaves", "Nobody is pinged: {user} shows their name as plain text.")}
        ${f.select("goodbyeChannelId", "Channel", channelOptions(channels, "No channel"))}
        ${f.textarea("goodbyeMessage", "Message", GOODBYE_MESSAGE_MAX, "Leave blank to send only the embed.")}
        ${f.checkbox("ge_on", "Send an embed with it")}
      </fieldset>
      ${embedBuilder(f, "ge_", { legend: "Goodbye embed", sample: { ...templateSample(ctx), user: ctx.viewer.username }, contentKey: "goodbyeMessage" })}`;

    case "tickets":
      return `${missingNote(f.str("logChannelId"), channels, "transcript channel", hidden)}
      <fieldset><legend>Transcripts</legend>
        ${f.checkbox("transcriptLogging", "Post a transcript to a staff channel when a ticket closes", "The member who opened the ticket also gets one by DM if their DMs are open.")}
        ${f.select("logChannelId", "Transcript channel", channelOptions(channels, "No channel"))}
      </fieldset>
      <fieldset><legend>Auto-close</legend>
        ${f.number("autoCloseHours", "Close a ticket after this many hours without messages", 0, MAX_TICKET_AUTOCLOSE_HOURS, "0 turns auto-close off.")}
      </fieldset>
      <p class="muted">The ticket panel itself is posted with <code class="inline">/ticket setup</code>.</p>`;

    case "verification":
      if (!snapshot.verification) {
        return `<div class="empty-state"><strong>Verification is not set up yet.</strong>
          New members need a panel to click before verification can work. <a class="text-link" href="/dashboard/${esc(ctx.guild.id)}/panels#verification">Post the verification panel</a> from the Panels page, or run <code class="inline">/verify setup</code> in Discord. After that you can change the settings here.</div>`;
      }
      return `${missingNote(f.str("verifiedRoleId"), roles, "verified role")}
      <fieldset><legend>Verification</legend>
        ${f.checkbox("enabled", "Verification is on")}
        ${rolePickerEmptyNote(roles)}
        ${f.select("verifiedRoleId", "Role given after verifying", roleOptions(roles, null), `${ROLE_PICKER_HELP} The saved role can be kept even if it is above yours.`)}
        ${f.select("type", "Challenge", [
          { value: "button", label: "Button: one click" },
          { value: "captcha", label: "Captcha: a short sum to solve" },
        ], "Changing this takes effect on the next click; the posted panel does not need re-posting.")}
        ${f.number("kickUnverifiedMinutes", "Kick members who have not verified after (minutes)", 0, MAX_KICK_UNVERIFIED_MINUTES, "0 turns auto-kick off. Applies to members who join after you save.")}
      </fieldset>
      ${snapshot.verification.channelId && hidden.has(snapshot.verification.channelId) ? hiddenChannelNote(snapshot.verification.channelId, "verification panel channel") : ""}
      <p class="muted">The panel is in ${snapshot.verification.channelId ? `<code class="inline">#${esc(channels.find(c => c.id === snapshot.verification?.channelId)?.name ?? snapshot.verification.channelId)}</code>` : "an unknown channel"}. To move it or change its text, <a href="/dashboard/${esc(ctx.guild.id)}/panels#verification">post it again from Panels</a>.</p>`;

    case "starboard":
      return `${missingNote(f.str("channelId"), channels, "starboard channel", hidden)}
      <fieldset><legend>Starboard</legend>
        ${f.checkbox("enabled", "Starboard is on")}
        ${f.select("channelId", "Starboard channel", channelOptions(channels, "No channel"))}
        ${f.text("emoji", "Emoji that stars a message", 64, `One emoji such as ⭐ or 🌟, or a custom emoji written as <code class="inline">&lt;:name:id&gt;</code>. Same as <code class="inline">/starboard emoji</code>.`, ' spellcheck="false" autocapitalize="off"')}
        ${f.number("threshold", "Reactions needed", 1, 100)}
        ${f.checkbox("selfStar", "Count the author's own star")}
      </fieldset>
      <h2 class="section-title">Ignored</h2>
      <p class="muted">Messages in ignored channels, or from members with an ignored role, are never posted to the starboard.</p>
      ${f.multi("ignoredChannels", "Ignored channels", channelPicks(channels, hidden, f.str("ignoredChannels")))}
      ${f.multi("ignoredRoles", "Ignored roles", rolePicks(roles))}`;
  }
}

/** Which sidebar entry each settings section belongs to. */
export const SECTION_NAV: Record<SettingsSection, GuildSection> = {
  logging: "logging", escalation: "moderation", automod: "automod", welcome: "welcome", goodbye: "welcome",
  tickets: "tickets", verification: "verification", starboard: "starboard",
};

/** The page title each section shows (module names, as in the sidebar). */
const PAGE_TITLES: Record<SettingsSection, string> = {
  logging: "Logging", escalation: "Moderation", automod: "Automod", welcome: "Welcome & Goodbye", goodbye: "Welcome & Goodbye",
  tickets: "Tickets", verification: "Verification", starboard: "Starboard",
};

function templateSample(ctx: GuildContext) {
  return { user: `@${ctx.viewer.username}`, username: ctx.viewer.username, server: ctx.guild.name, memberCount: ctx.guild.memberCount };
}

/** Whether the module behind a section is switched on (null: it has no single switch). */
export function sectionEnabled(section: SettingsSection, s: SettingsSnapshot): boolean | null {
  switch (section) {
    case "logging": return s.guild.loggingEnabled;
    case "escalation": return s.guild.escalation.enabled;
    case "automod": return s.automod.words.enabled || s.automod.links.enabled || s.automod.mentions.enabled || s.automod.spam.enabled || s.automod.caps.enabled;
    case "welcome": return s.guild.welcomeEnabled;
    case "goodbye": return s.guild.goodbyeEnabled === true;
    case "verification": return s.verification?.enabled ?? false;
    case "starboard": return s.starboard.enabled;
    case "tickets": return null;
  }
}

function sectionIntro(section: SettingsSection, s: SettingsSnapshot, base: string): string {
  const on = sectionEnabled(section, s);
  const tabs = section === "welcome" || section === "goodbye"
    ? `<nav class="tabs" aria-label="Welcome and goodbye"><a href="${base}/welcome"${section === "welcome" ? ' aria-current="page"' : ""}>Welcome</a><a href="${base}/goodbye"${section === "goodbye" ? ' aria-current="page"' : ""}>Goodbye</a></nav>`
    : "";
  const extra = section === "escalation"
    ? `<p class="muted">Cases are on the <a href="${base.replace(/\/settings$/, "")}/cases">Cases</a> page; appeals on <a href="${base.replace(/\/settings$/, "")}/appeals">Appeals</a>.</p>`
    : section === "tickets"
      ? `<p class="muted">Post or move the ticket panel from <a href="${base.replace(/\/settings$/, "")}/panels#tickets">Role panels &amp; panels</a>.</p>`
      : "";
  return `${tabs}<div class="module-head">${on === null ? "" : moduleStatus(on)}<span class="muted">${on === null ? "Always available." : on ? "Aegis is using this module." : "Turn it on below, then save."}</span></div>${extra}`;
}

export function renderSettings(
  cfg: SiteConfig,
  ctx: GuildContext,
  section: SettingsSection,
  snapshot: SettingsSnapshot,
  state: FormState,
  channels: ChannelOption[],
  roles: RoleOption[],
  noticeCode: string | null,
  hiddenChannelIds: ReadonlySet<string> = new Set(),
): string {
  const g = ctx.guild;
  const base = `/dashboard/${esc(g.id)}/settings`;
  const f = new Form(state);
  const errorKeys = Object.keys(state.errors);
  const summary = errorKeys.length
    ? `<div class="error-summary" role="alert" tabindex="-1" data-error-summary>
      <h2>Nothing was saved. Fix ${errorKeys.length === 1 ? "this" : "these"} first:</h2>
      <ul>${errorKeys.map(k => `<li><a href="#f-${esc(k)}">${esc(state.errors[k])}</a></li>`).join("")}</ul>
    </div>`
    : "";
  const canSave = !(section === "verification" && !snapshot.verification);

  return shell(cfg, {
    title: `${PAGE_TITLES[section]}, ${g.name}`,
    path: `${base}/${section}`,
    viewer: ctx.viewer,
    guild: ctx,
    active: SECTION_NAV[section],
    body: `${head(PAGE_TITLES[section], "", [["Servers", "/dashboard"], [g.name, `/dashboard/${g.id}`], [PAGE_TITLES[section], null]])}
  ${sectionIntro(section, snapshot, base)}
  ${notice(noticeCode)}
  ${summary}
  ${section === "escalation" ? "" : channelPickerEmptyNote(channels, hiddenChannelIds)}
  <form class="dash-form${section === "welcome" || section === "goodbye" ? " wide" : ""}" method="post" action="${base}/${section}" novalidate data-track-changes>
    ${csrfField(ctx.viewer)}
    ${sectionForm(section, f, ctx, channels, roles, snapshot, hiddenChannelIds)}
    ${canSave ? `<button class="btn" type="submit" data-save-button>Save ${SECTION_TITLES[section].toLowerCase()} settings</button>` : ""}
  </form>`,
  });
}
