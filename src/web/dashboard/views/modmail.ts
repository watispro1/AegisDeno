/** ModMail page (/:guildId/modmail) and the transcript viewer. No inline styles or scripts. */
import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { ChannelOption, RoleOption } from "../botView";
import type { ModmailConfig, TranscriptLine } from "../../../services/modmailLogic";
import type { ModmailOverview, ModmailTicketRow } from "../modmailData";
import { type GuildContext, copyId, csrfField, emptyState, notice, person, relTime } from "./layout";
import { Form, channelOptions, roleOptions, type FormState, type Values } from "./form";
import { embedBuilder, embedValues } from "./embedBuilder";
import { actionButton, errorSummary, modulePage } from "./parts";
import { helpPanel, listFoot, listTools, pagedTable, pill, rowAttrs, sectionJump, summaryStrip } from "./moduleKit";

export function modmailValues(c: ModmailConfig): Values {
  return {
    enabled: c.enabled, channelId: c.channelId ?? "", staffRoleId: c.staffRoleId ?? "", pingStaff: c.pingStaff,
    relayPrefix: c.relayPrefix, anonymousByDefault: c.anonymousByDefault,
    mg_on: Boolean(c.greeting), mc_on: Boolean(c.closeMessage),
    ...embedValues(c.greeting, "mg_"), ...embedValues(c.closeMessage, "mc_"),
  };
}

function ticketTable(ctx: GuildContext, id: string, rows: ModmailTicketRow[], closed: boolean): string {
  const g = esc(ctx.guild.id);
  const tools = rows.length > 1 ? listTools(id, {
    search: closed ? "Filter transcripts by member or reason" : "Filter open conversations",
    sorts: closed
      ? [{ value: "when:desc", label: "Closed most recently" }, { value: "when:asc", label: "Closed longest ago" }, { value: "messages:desc", label: "Most messages" }]
      : [{ value: "when:asc", label: "Waiting longest" }, { value: "when:desc", label: "Newest first" }, { value: "messages:desc", label: "Most messages" }],
  }) : "";
  return `${tools}<div class="table-wrap"><table class="case-table" id="${id}"${pagedTable(15)}><caption class="visually-hidden">${closed ? "Closed conversations" : "Open conversations"}</caption>
    <thead><tr><th scope="col">Member</th><th scope="col">${closed ? "Closed" : "Opened"}</th><th scope="col">Messages</th><th scope="col">${closed ? "Reason" : "Thread"}</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
    <tbody>${rows.map(r => `<tr${rowAttrs(null, { when: (closed ? r.closedAt ?? r.createdAt : r.createdAt).getTime(), messages: r.messageCount })}>
      <td data-label="Member">${person(ctx, r.userId)} ${copyId(r.userId)}</td>
      <td data-label="${closed ? "Closed" : "Opened"}">${relTime(closed ? r.closedAt : r.createdAt)}</td>
      <td data-label="Messages">${r.messageCount}</td>
      <td data-label="${closed ? "Reason" : "Thread"}">${closed ? esc(r.closeReason ?? "—") : `<a href="https://discord.com/channels/${g}/${esc(r.threadId)}" rel="noopener">Open in Discord</a>`}</td>
      <td data-label="Actions" class="cell-actions-td"><a class="btn sm ghost" href="/dashboard/${g}/modmail/${esc(r.id)}">${closed ? "Transcript" : "Read so far"}</a></td></tr>`).join("")}</tbody></table></div>${rows.length > 1 ? listFoot(id) : ""}`;
}

export function renderModmail(cfg: SiteConfig, ctx: GuildContext, o: { overview: ModmailOverview; channels: ChannelOption[]; roles: RoleOption[]; noticeCode: string | null; state?: FormState }): string {
  const base = `/dashboard/${esc(ctx.guild.id)}/modmail`;
  const ov = o.overview;
  const f = new Form(o.state ?? { values: modmailValues(ov.config), errors: {} }, "mm-");
  const live = Boolean(ov.config.enabled && ov.config.channelId);
  const sample = { user: `@${ctx.viewer.username}`, username: ctx.viewer.username, server: ctx.guild.name, memberCount: ctx.guild.memberCount ?? 0 };
  const blocked = ov.config.blockedUserIds.length
    ? `<ul class="plain-list">${ov.config.blockedUserIds.map(id => `<li>${person(ctx, id)} ${copyId(id)} ${actionButton(`${base}/unblock`, ctx.viewer.csrf, "Unblock", { fields: { userId: id }, confirm: "Unblock this member? They can open ModMail conversations again." })}</li>`).join("")}</ul>`
    : emptyState("Nobody is blocked.", "Block a member here or with <code class=\"inline\">/modmail block</code>.");
  return modulePage(cfg, ctx, {
    active: "modmail",
    title: "ModMail",
    lead: "Members DM Aegis and staff answer from a private thread (or forum post). Same as <code class=\"inline\">/modmail</code>.",
    path: base,
    body: `${notice(o.noticeCode)}
  ${summaryStrip([
    { label: "Status", value: live ? "On" : "Off", tone: live ? "ok" : ov.config.enabled ? "warn" : "off", hint: live ? "Members can DM Aegis" : ov.config.enabled ? "Pick a staff channel" : "Turned off" },
    { label: "Open", value: ov.open.length, tone: ov.open.length ? "warn" : undefined, hint: ov.open.length ? "Waiting for staff" : "Nothing waiting" },
    { label: "Transcripts", value: ov.closed.length, hint: "Kept 90 days" },
    { label: "Blocked", value: ov.config.blockedUserIds.length },
  ], "ModMail summary")}
  ${sectionJump([["mm-open-h", "Open"], ["mm-closed-h", "Transcripts"], ["mm-cfg-h", "Settings"], ["mm-block-h", "Blocked"]])}
  ${ov.config.enabled && !ov.config.channelId ? `<p class="callout warn">ModMail is on but has no staff channel, so DMs can't reach staff. <a href="#f-mm-channelId">Pick one in Settings</a>.</p>` : ""}
  <section class="panel-card" aria-labelledby="mm-open-h"><h2 id="mm-open-h">Open conversations ${ov.open.length ? pill(`${ov.open.length} waiting`, "warn") : ""}</h2>
    ${ov.open.length ? ticketTable(ctx, "mm-open", ov.open, false) : live ? emptyState("No open conversations.", "New DMs to Aegis show up here.") : emptyState("No open conversations.", "ModMail is off, so members can't open one yet.", { label: "Set up ModMail", href: "#mm-cfg-h" })}</section>
  <section class="panel-card" aria-labelledby="mm-closed-h"><h2 id="mm-closed-h">Transcripts</h2>
    <p class="faint">Kept for 90 days after a conversation closes.</p>
    ${ov.closed.length ? ticketTable(ctx, "mm-closed", ov.closed, true) : emptyState("No transcripts yet.", "They appear when a conversation is closed.")}</section>
  <section class="panel-card" aria-labelledby="mm-cfg-h"><h2 id="mm-cfg-h">Settings</h2>
    ${helpPanel("How ModMail works", [
      ["Staff channel", "Each conversation opens as a private thread here (or a post, if you set a forum with <code class=\"inline\">/modmail setup</code>). Keep it staff-only."],
      ["Replying", "Staff reply with <code class=\"inline\">/modmail reply</code>, or by starting a thread message with the reply prefix. Other thread messages stay internal."],
      ["Anonymous replies", "The member sees “Staff” instead of the moderator's name. Staff can still choose per reply."],
      ["Greeting and close message", "Optional embeds the member gets when a conversation opens or closes. Off uses Aegis's short default text."],
    ])}
    ${errorSummary(o.state?.errors ?? {}, "f-mm-")}
    <form class="dash-form" method="post" action="${base}/settings" novalidate data-track-changes>
      ${csrfField(ctx.viewer)}
      ${f.checkbox("enabled", "Turn on ModMail", "Members who share this server with Aegis can DM it to reach staff.")}
      <div class="field-row two">
        ${f.select("channelId", "Staff channel", channelOptions(o.channels, "Pick a channel"), "Private threads open here. Keep it staff-only. Use /modmail setup to pick a forum instead.")}
        ${f.select("staffRoleId", "Staff role", roleOptions(o.roles, "Manage Server only"), "Members with this role can answer and close.")}
      </div>
      ${f.checkbox("pingStaff", "Ping the staff role when a new conversation opens", "The only ping ModMail ever sends.")}
      ${f.checkbox("anonymousByDefault", "Reply anonymously by default")}
      ${f.text("relayPrefix", "Thread reply prefix", 8, "Staff messages in a thread starting with this are sent to the member. Blank turns it off.", ' spellcheck="false" autocapitalize="off"')}
      ${f.checkbox("mg_on", "Custom greeting (sent when a conversation opens)")}
      ${embedBuilder(f, "mg_", { legend: "Greeting", sample })}
      ${f.checkbox("mc_on", "Custom close message")}
      ${embedBuilder(f, "mc_", { legend: "Close message", sample })}
      <button class="btn" type="submit" data-save-button>Save ModMail settings</button>
    </form>
  </section>
  <section class="panel-card" aria-labelledby="mm-block-h"><h2 id="mm-block-h">Blocked members</h2>
    ${blocked}
    <form class="dash-form inline-form" method="post" action="${base}/block" data-confirm="Block this user from ModMail? Their DMs to Aegis are ignored until unblocked.">${csrfField(ctx.viewer)}
      <label for="mm-block-id">User ID</label> <input id="mm-block-id" name="userId" inputmode="numeric" pattern="\\d{17,20}" maxlength="20" autocomplete="off">
      <button class="btn sm danger" type="submit">Block</button></form>
  </section>`,
  });
}

export function renderTranscript(cfg: SiteConfig, ctx: GuildContext, t: ModmailTicketRow & { lines: TranscriptLine[] }): string {
  const base = `/dashboard/${esc(ctx.guild.id)}/modmail`;
  const lines = t.lines.length
    ? `<ol class="transcript">${t.lines.map(l => `<li class="${l.fromStaff ? "staff" : "member"}"><span class="faint">${relTime(l.at)}</span> <strong>${esc(l.authorTag)}</strong>${l.fromStaff ? ` <span class="tag">${l.anonymous ? "staff, anonymous" : "staff"}</span>` : ""}<p>${esc(l.content)}</p></li>`).join("")}</ol>`
    : emptyState("No messages.", "This conversation has no saved messages.");
  return modulePage(cfg, ctx, {
    active: "modmail",
    title: "ModMail transcript",
    lead: `${person(ctx, t.userId)} · opened ${relTime(t.createdAt)}${t.closedAt ? ` · closed ${relTime(t.closedAt)}` : " · still open"}${t.closeReason ? ` · ${esc(t.closeReason)}` : ""}`,
    path: `${base}/${esc(t.id)}`,
    body: `<p><a href="${base}">← Back to ModMail</a></p><section class="panel-card">${lines}</section>`,
  });
}
