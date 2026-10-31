import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { ChannelOption, RoleOption } from "../botView";
import type { RolePanelSummary } from "../data";
import { PANEL_TITLE_MAX, TICKET_PANEL_DESCRIPTION_MAX, VERIFY_PANEL_DESCRIPTION_MAX } from "../validation";
import { MAX_KICK_UNVERIFIED_MINUTES } from "../../../services/verificationLogic";
import { type GuildContext, csrfField, guildNav, head, notice, shell } from "./layout";
import { Form, ROLE_PICKER_HELP, type Values, channelOptions, channelPickerEmptyNote, hiddenChannelNote, roleOptions, rolePickerEmptyNote } from "./form";
import { errorSummary, permissionNote } from "./parts";

/* ── Panels ────────────────────────────────────────────────────────── */

export interface PanelsState {
  form: "ticket" | "verification" | null;
  values: Values;
  errors: Record<string, string>;
}

export function renderPanels(
  cfg: SiteConfig,
  ctx: GuildContext,
  o: {
    channels: ChannelOption[];
    roles: RoleOption[];
    rolePanels: RolePanelSummary[];
    verificationSetUp: boolean;
    state?: PanelsState;
    noticeCode?: string | null;
    missing: { tickets: string | null; roles: string | null };
    /** Channels Discord hides from Aegis (obfuscated); see BotView.hiddenChannelIds. */
    hiddenChannelIds?: ReadonlySet<string>;
  },
): string {
  const hidden = o.hiddenChannelIds ?? new Set<string>();
  const g = ctx.guild;
  const base = `/dashboard/${esc(g.id)}/panels`;
  const state = o.state ?? { form: null, values: {}, errors: {} };
  const formFor = (which: "ticket" | "verification", defaults: Values) =>
    new Form(state.form === which ? { values: state.values, errors: state.errors } : { values: defaults, errors: {} }, `${which}-`);
  const t = formFor("ticket", {});
  const v = formFor("verification", { type: "button", kickUnverifiedMinutes: "0" });
  const anyRole = [{ value: "", label: "No staff role" }].concat(o.roles.map(r => ({ value: r.id, label: `@${r.name}` })));
  const summaryFor = (which: "ticket" | "verification") => (state.form === which ? errorSummary(state.errors, `f-${which}-`) : "");
  const channelName = (id: string) => o.channels.find(c => c.id === id)?.name;

  const aboveViewer = new Set(o.roles.filter(r => r.aboveViewer).map(r => r.id));
  const rolePanels = o.rolePanels.length
    ? `<ul class="panel-list">${o.rolePanels.map(p => {
        const blocked = (p.roleIds ?? []).some(id => aboveViewer.has(id));
        const noteId = `rp-blocked-${esc(p.id)}`;
        return `<li class="panel-item">
        <div class="panel-meta"><strong>${esc(p.title)}</strong>
          <span class="faint">${p.roleCount} role${p.roleCount === 1 ? "" : "s"}, ${esc(p.style)}, in ${channelName(p.channelId) ? `#${esc(channelName(p.channelId)!)}` : `<code class="inline">${esc(p.channelId)}</code>`}</span></div>
        ${hidden.has(p.channelId) ? hiddenChannelNote(p.channelId, "role panel channel") : ""}
        ${blocked ? `<p class="callout warn" id="${noteId}" data-rolepanel-blocked>This panel hands out a role equal to or above your highest role, so only someone above it (or the server owner) can re-post it.</p>` : ""}
        <form class="panel-repost" method="post" action="${base}/roles/${esc(p.id)}" novalidate>
          ${csrfField(ctx.viewer)}
          <div class="field"><label for="f-rp-${esc(p.id)}">Post to</label>
            <select id="f-rp-${esc(p.id)}" name="channelId"${blocked ? " disabled" : ""}>${channelOptions(o.channels, "Pick a channel").map(c => `<option value="${esc(c.value)}"${c.value === p.channelId ? " selected" : ""}>${esc(c.label)}</option>`).join("")}</select></div>
          <button class="btn ghost" type="submit"${blocked ? ` disabled aria-describedby="${noteId}"` : ""}>Re-post</button>
        </form>
      </li>`;
      }).join("")}</ul>`
    : `<div class="empty-state"><strong>No role panels yet.</strong>Create one with <code class="inline">/rolepanel create</code> in Discord; it will show up here to re-post.</div>`;

  return shell(cfg, {
    title: `Panels in ${g.name}`,
    path: `/dashboard/${g.id}/panels`,
    viewer: ctx.viewer,
    body: `${head("Panels", "Post the messages members click: the ticket button, the verification button and role panels. Each uses the same code as its slash command.", [["Servers", "/dashboard"], [g.name, `/dashboard/${g.id}`], ["Panels", null]])}
  ${guildNav(g.id, "panels")}
  ${notice(o.noticeCode)}
  ${channelPickerEmptyNote(o.channels, hidden)}

  <h2 id="tickets">Ticket panel</h2>
  <p class="muted">Same as <code class="inline">/ticket setup</code>. Earlier Aegis ticket panels in the channel are removed first.</p>
  ${permissionNote(o.missing.tickets)}
  ${summaryFor("ticket")}
  <form class="dash-form" method="post" action="${base}/tickets" novalidate>
    ${csrfField(ctx.viewer)}
    <fieldset><legend>Ticket panel</legend>
      ${t.select("channelId", "Channel", channelOptions(o.channels, "Pick a channel"))}
      ${t.select("staffRoleId", "Staff role to notify", anyRole, "Optional. Members of this role are added to each new ticket.")}
      ${t.text("title", "Title", PANEL_TITLE_MAX, "Optional. Default: 🎫 Support Tickets")}
      ${t.textarea("description", "Description", TICKET_PANEL_DESCRIPTION_MAX, "Optional. Default: Need assistance? Click the button below…")}
    </fieldset>
    <button class="btn" type="submit">Post ticket panel</button>
  </form>

  <h2 id="verification">Verification panel</h2>
  <p class="muted">Same as <code class="inline">/verify setup</code>. ${o.verificationSetUp
    ? "Verification is set up; posting again moves the panel or changes its text and turns verification on."
    : "<strong>Verification is not set up yet.</strong> Posting the panel turns it on."} Earlier Aegis verification panels in the channel are removed first.</p>
  ${permissionNote(o.missing.roles)}
  ${summaryFor("verification")}
  <form class="dash-form" method="post" action="${base}/verification" novalidate>
    ${csrfField(ctx.viewer)}
    <fieldset><legend>Verification panel</legend>
      ${v.select("channelId", "Channel", channelOptions(o.channels, "Pick a channel"))}
      ${rolePickerEmptyNote(o.roles)}
      ${v.select("verifiedRoleId", "Role given after verifying", roleOptions(o.roles, null), ROLE_PICKER_HELP)}
      ${v.select("type", "Challenge", [
        { value: "button", label: "Button: one click" },
        { value: "captcha", label: "Captcha: a short sum to solve" },
      ])}
      ${v.number("kickUnverifiedMinutes", "Kick members who have not verified after (minutes)", 0, MAX_KICK_UNVERIFIED_MINUTES, "0 turns auto-kick off.")}
      ${v.text("title", "Title", PANEL_TITLE_MAX, "Optional. Default: 🛡️ Server Verification Required")}
      ${v.textarea("description", "Description", VERIFY_PANEL_DESCRIPTION_MAX, "Optional. Default: Click the button below to verify your account…")}
    </fieldset>
    <button class="btn" type="submit">Post verification panel</button>
  </form>

  <h2 id="roles">Role panels</h2>
  <p class="muted">Re-post a panel made with <code class="inline">/rolepanel create</code>, in the same channel or another one. The new message replaces the old one; the roles and options stay the same.</p>
  ${permissionNote(o.missing.roles)}
  ${rolePanels}`,
  });
}
