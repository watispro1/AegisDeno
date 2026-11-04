/** The main Automod settings form: every rule, the timeout length and the global exemptions. */
import type { ChannelOption, RoleOption } from "../botView";
import {
  ALLOWED_DOMAINS_TEXT_MAX,
  ALLOWED_INVITES_TEXT_MAX,
  ALLOWED_LIST_MAX_COUNT,
  AUTOMOD_BOUNDS as B,
  AUTOMOD_WORD_MAX,
  AUTOMOD_WORDS_MAX_COUNT,
  AUTOMOD_WORDS_TEXT_MAX,
} from "../validation";
import { ACTION_OPTIONS, type Form, channelPicks, rolePicks } from "./form";

const LIST_ATTRS = ' spellcheck="false" autocapitalize="off"';

export function automodForm(f: Form, channels: ChannelOption[], roles: RoleOption[], hidden: ReadonlySet<string>): string {
  return `<fieldset><legend>Blocked words</legend>
        ${f.checkbox("words_enabled", "Filter blocked words")}
        ${f.select("words_action", "When it matches", ACTION_OPTIONS)}
        ${f.textarea("words_list", "Blocked words", AUTOMOD_WORDS_TEXT_MAX,
          `One word or phrase per line, 2 to ${AUTOMOD_WORD_MAX} characters, up to ${AUTOMOD_WORDS_MAX_COUNT}. Matching ignores case. Same list as <code class="inline">/automod words add</code>.`,
          LIST_ATTRS)}
      </fieldset>
      <fieldset><legend>Links</legend>
        ${f.checkbox("links_enabled", "Filter links")}
        ${f.select("links_action", "When it matches", ACTION_OPTIONS)}
        ${f.textarea("links_allowedDomains", "Allowed domains", ALLOWED_DOMAINS_TEXT_MAX,
          `One domain per line, up to ${ALLOWED_LIST_MAX_COUNT}. Subdomains pass too, and pasted links are trimmed to their domain. Same list as <code class="inline">/automod links allow</code>.`,
          LIST_ATTRS)}
      </fieldset>
      <fieldset><legend>Invites</legend>
        ${f.checkbox("invites_enabled", "Filter invites to other Discord servers", "This server's own vanity invite always passes.")}
        ${f.select("invites_action", "When it matches", ACTION_OPTIONS)}
        ${f.textarea("invites_allowedCodes", "Allowed invites", ALLOWED_INVITES_TEXT_MAX,
          `One invite code or discord.gg link per line, up to ${ALLOWED_LIST_MAX_COUNT}. Codes keep their case. Same list as <code class="inline">/automod invites allow</code>.`,
          LIST_ATTRS)}
      </fieldset>
      <fieldset><legend>Mention spam</legend>
        ${f.checkbox("mentions_enabled", "Limit mentions per message")}
        ${f.number("mentions_threshold", "Mentions allowed", B.mentions.min, B.mentions.max)}
        ${f.select("mentions_action", "When it matches", ACTION_OPTIONS)}
      </fieldset>
      <fieldset><legend>Message spam</legend>
        ${f.checkbox("spam_enabled", "Limit how fast one member can post")}
        <div class="field-row">
          ${f.number("spam_maxMessages", "Messages", B.spamMessages.min, B.spamMessages.max)}
          ${f.number("spam_windowSeconds", "Within (seconds)", B.spamWindow.min, B.spamWindow.max)}
        </div>
        ${f.select("spam_action", "When it matches", ACTION_OPTIONS)}
      </fieldset>
      <fieldset><legend>Duplicate messages</legend>
        ${f.checkbox("duplicates_enabled", "Catch the same message sent over and over")}
        <div class="field-row">
          ${f.number("duplicates_maxRepeats", "Identical messages allowed", B.duplicatesRepeats.min, B.duplicatesRepeats.max)}
          ${f.number("duplicates_windowSeconds", "Within (seconds)", B.duplicatesWindow.min, B.duplicatesWindow.max)}
        </div>
        ${f.select("duplicates_action", "When it matches", ACTION_OPTIONS, "The next identical copy after the limit is acted on.")}
      </fieldset>
      <fieldset><legend>Capitals</legend>
        ${f.checkbox("caps_enabled", "Filter messages that are mostly capitals")}
        ${f.number("caps_threshold", "Percentage of capitals", B.caps.min, B.caps.max)}
        ${f.select("caps_action", "When it matches", ACTION_OPTIONS)}
      </fieldset>
      <fieldset><legend>Emoji and zalgo</legend>
        ${f.checkbox("emoji_enabled", "Filter emoji walls")}
        ${f.number("emoji_maxEmoji", "Emoji allowed per message", B.emoji.min, B.emoji.max, "Unicode and custom emoji both count.")}
        ${f.checkbox("emoji_zalgo", "Also catch zalgo text (letters stacked with combining marks)")}
        ${f.select("emoji_action", "When it matches", ACTION_OPTIONS)}
      </fieldset>
      <fieldset><legend>Timeout length</legend>
        ${f.number("timeoutMinutes", "Time out for (minutes)", B.timeout.min, B.timeout.max,
          `Used by every rule set to "Delete and time out". 1 to ${B.timeout.max} minutes (7 days). Same as <code class="inline">/automod timeout</code>.`)}
      </fieldset>
      <h2 class="section-title">Exemptions</h2>
      <p class="muted">Members with an exempt role, and messages in an exempt channel, skip every automod rule.</p>
      <p class="muted">To exempt a role or channel from one rule only, use <a href="#rx-h">Per-rule exemptions</a> below (or <code class="inline">/automod exempt</code> with <code class="inline">rule:</code>). Saving this form keeps them.</p>
      ${f.multi("exempt_roles", "Exempt roles", rolePicks(roles))}
      ${f.multi("exempt_channels", "Exempt channels", channelPicks(channels, hidden, f.str("exempt_channels")), "Text and announcement channels are listed. Other channels exempted with /automod stay exempt and show as Unknown.")}`;
}
