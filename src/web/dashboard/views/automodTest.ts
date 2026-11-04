/** The "Test a message" panel on the Automod settings page. Nothing is saved or posted. */
import { escapeHtml as esc } from "../../pages";
import type { AutomodPreview } from "../../../services/automodChecks";
import { type GuildContext, csrfField } from "./layout";

/** Longest message the preview accepts (Discord's own message limit). */
export const AUTOMOD_TEST_MAX = 2000;

const ACTION_TEXT: Record<string, string> = { delete: "deletes the message", warn: "deletes it and warns the member", timeout: "deletes it and times the member out" };

export interface AutomodTestState {
  content: string;
  result: AutomodPreview | null;
  error?: string;
}

function resultBlock(r: AutomodPreview): string {
  const verdict = r.acting
    ? `<p class="status-pill off">Would be caught</p><p>Automod ${esc(ACTION_TEXT[r.acting.action] ?? r.acting.action)} (<strong>${esc(r.acting.label)}</strong>: ${esc(r.acting.detail)}).</p>`
    : `<p class="status-pill on">Would pass</p><p>No enabled rule matches this message.</p>`;
  const all = r.hits.length > 1
    ? `<p class="muted">Also matches: ${r.hits.slice(1).map(h => `${esc(h.label)} (${esc(h.detail)})`).join(", ")}. Automod acts on the first rule only.</p>`
    : "";
  const off = r.offButWouldMatch.length
    ? `<p class="muted">Would match if switched on: ${r.offButWouldMatch.map(esc).join(", ")}.</p>`
    : "";
  return `<div class="preview" role="status" aria-live="polite">${verdict}${all}${off}</div>`;
}

export function automodTestPanel(ctx: GuildContext, state: AutomodTestState | null | undefined): string {
  const action = `/dashboard/${esc(ctx.guild.id)}/settings/automod/test`;
  const content = state?.content ?? "";
  return `<section class="panel-card" aria-labelledby="am-test-h" id="automod-test">
    <h2 id="am-test-h">Test a message</h2>
    <p class="muted">Checks text against the <strong>saved</strong> rules, as if a member without an exempt role posted it in a channel that isn't exempt. Nothing is posted or stored. Message spam and duplicate messages depend on what was posted before, so they can't be tested here, and your server's own vanity invite is treated like any other invite. Server staff with Manage Server are always exempt.</p>
    <form class="dash-form" method="post" action="${action}" novalidate>
      ${csrfField(ctx.viewer)}
      <div class="field">
        <label for="f-am-test">Message</label>
        <textarea id="f-am-test" name="content" maxlength="${AUTOMOD_TEST_MAX}" rows="3" spellcheck="false" data-count-max="${AUTOMOD_TEST_MAX}"${state?.error ? ' aria-invalid="true" aria-describedby="f-am-test-err"' : ""}>${esc(content)}</textarea>
        ${state?.error ? `<p class="field-error" id="f-am-test-err">${esc(state.error)}</p>` : ""}
      </div>
      <button class="btn ghost" type="submit">Test message</button>
    </form>
    ${state?.result ? resultBlock(state.result) : ""}
  </section>`;
}
