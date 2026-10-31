import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { ChannelOption, RoleOption } from "../botView";
import type { SettingsSnapshot } from "../data";
import { ESCALATION_ROWS, LOG_CATEGORY_LABELS, MAX_TIMEOUT_MINUTES, SECTION_TITLES, SETTINGS_SECTIONS, WELCOME_MESSAGE_MAX, AUTOMOD_WORD_MAX, AUTOMOD_WORDS_MAX_COUNT, AUTOMOD_WORDS_TEXT_MAX, welcomePreview, type SettingsSection } from "../validation";
import { MAX_WARN_EXPIRY_DAYS } from "../../../services/configuration";
import { MAX_TICKET_AUTOCLOSE_HOURS } from "../../../services/ticketTranscript";
import { MAX_KICK_UNVERIFIED_MINUTES } from "../../../services/verificationLogic";
import { type GuildContext, csrfField, guildNav, head, notice, shell } from "./layout";
import { ACTION_OPTIONS, Form, ROLE_PICKER_HELP, type FormState, channelOptions, channelPicks, hiddenChannelNote, missingNote, roleOptions, rolePickerEmptyNote, rolePicks } from "./form";

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
      <fieldset><legend>What to log</legend>
        ${LOG_CATEGORY_LABELS.map(([key, label]) => f.checkbox(`cat_${key}`, label)).join("")}
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
      <fieldset><legend>Join role</legend>
        ${rolePickerEmptyNote(roles)}
        ${f.select("welcomeRoleId", "Give new members this role", roleOptions(roles, "No role"), ROLE_PICKER_HELP)}
      </fieldset>`;
    }

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
    title: `${SECTION_TITLES[section]} settings, ${g.name}`,
    path: `${base}/${section}`,
    viewer: ctx.viewer,
    body: `${head(`${SECTION_TITLES[section]} settings`, "", [["Servers", "/dashboard"], [g.name, `/dashboard/${g.id}`], ["Settings", null]])}
  ${guildNav(g.id, "settings")}
  <nav aria-label="Settings sections"><ul class="dash-nav">
    ${SETTINGS_SECTIONS.map(s => `<li><a href="${base}/${s}"${s === section ? ' aria-current="page"' : ""}>${SECTION_TITLES[s]}</a></li>`).join("")}
  </ul></nav>
  ${notice(noticeCode)}
  ${summary}
  <form class="dash-form" method="post" action="${base}/${section}" novalidate>
    ${csrfField(ctx.viewer)}
    ${sectionForm(section, f, ctx, channels, roles, snapshot, hiddenChannelIds)}
    ${canSave ? `<button class="btn" type="submit">Save ${SECTION_TITLES[section].toLowerCase()} settings</button>` : ""}
  </form>`,
  });
}
