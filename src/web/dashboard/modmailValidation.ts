/** Form parsing for the ModMail and Digest pages. Same rules as validation.ts. */
import { MODMAIL_PREFIX_MAX, normalizeModmailConfig, withBlocked, type ModmailConfig } from "../../services/modmailLogic";
import { isValidTimeZone, normalizeDigestConfig, type DigestConfig } from "../../services/digestLogic";
import { readEmbed } from "./moduleValidation";
import { Errors, ROLE_ABOVE_VIEWER_ERROR, channel, checkbox, field, finish, integer, type FormBody, type Parsed, type ValidationContext } from "./validation";

const SNOWFLAKE = /^\d{17,20}$/;

/** A saved channel may be kept as is (it can be a forum set with /modmail setup); a new pick must be a visible text channel. */
function keptOrChannel(body: FormBody, key: string, ctx: ValidationContext, errors: Errors, required: boolean, label: string, saved: string | null): string | null {
  const raw = field(body, key);
  if (raw && raw === saved && !ctx.hiddenChannelIds?.has(raw)) return raw;
  return channel(body, key, ctx, errors, required, label);
}

export function parseModmailSettings(body: FormBody, ctx: ValidationContext, saved: ModmailConfig, guildId = ""): Parsed<ModmailConfig> {
  const errors = new Errors();
  const enabled = checkbox(body, "enabled");
  const channelId = keptOrChannel(body, "channelId", ctx, errors, enabled, "ModMail channel", saved.channelId);
  const roleRaw = field(body, "staffRoleId");
  let staffRoleId: string | null = null;
  if (roleRaw) {
    const found = ctx.roles.get(roleRaw);
    // @everyone as the staff role would let every member answer and close tickets.
    if (roleRaw === guildId) errors.add("staffRoleId", "@everyone can't be the staff role. Pick a staff role.");
    else if (!found) errors.add("staffRoleId", "That role does not exist in this server. Pick one from the list.");
    // Granting ModMail access is a privilege: same hierarchy rule as every role picker.
    else if (found.aboveViewer && roleRaw !== saved.staffRoleId) errors.add("staffRoleId", ROLE_ABOVE_VIEWER_ERROR);
    else staffRoleId = roleRaw;
  }
  const prefix = field(body, "relayPrefix").trim();
  if (prefix.length > MODMAIL_PREFIX_MAX || /\s/.test(prefix)) errors.add("relayPrefix", `The prefix is up to ${MODMAIL_PREFIX_MAX} characters with no spaces, or blank to turn it off.`);
  const greeting = checkbox(body, "mg_on") ? readEmbed(body, "mg_", errors) : null;
  const closeMessage = checkbox(body, "mc_on") ? readEmbed(body, "mc_", errors) : null;
  return finish(errors, normalizeModmailConfig({
    ...saved, enabled, channelId, staffRoleId, relayPrefix: prefix,
    pingStaff: checkbox(body, "pingStaff"), anonymousByDefault: checkbox(body, "anonymousByDefault"),
    greeting, closeMessage,
  }));
}

export function parseModmailBlock(body: FormBody, saved: ModmailConfig, block: boolean): Parsed<{ userId: string; config: ModmailConfig }> {
  const errors = new Errors();
  const userId = field(body, "userId").trim();
  if (!SNOWFLAKE.test(userId)) errors.add("userId", "Enter a Discord user ID (17–20 digits). Right-click the member → Copy User ID.");
  return finish(errors, { userId, config: withBlocked(saved, userId, block) });
}

export function parseDigestSettings(body: FormBody, ctx: ValidationContext, saved: DigestConfig): Parsed<DigestConfig> {
  const errors = new Errors();
  const tz = field(body, "timezone").trim() || "UTC";
  if (!isValidTimeZone(tz)) errors.add("timezone", "Use an IANA time zone such as UTC, America/Chicago or Europe/London.");
  return finish(errors, normalizeDigestConfig({
    enabled: checkbox(body, "enabled"),
    channelId: keptOrChannel(body, "channelId", ctx, errors, false, "digest channel", saved.channelId),
    day: integer(body, "day", 0, 6, "The day", errors, { blank: 1 }),
    hour: integer(body, "hour", 0, 23, "The hour", errors, { blank: 9 }),
    timezone: tz,
  }));
}
